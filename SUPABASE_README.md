# Supabase Implementation for BLE Scanner

This document describes the Supabase database implementation used in the BLE Scanner application, including tables structure, data collection, and helpful queries.

## Database Overview

The BLE Scanner app uses Supabase as its backend database to store:

- BLE device scan data
- WiFi network information
- Location data
- Scanning session metadata

## Connection Setup

The app connects to Supabase using the `@supabase/supabase-js` client library, with configuration in `src/supabaseClient.js`:

```javascript
import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://rtisjkrsdbxgrqjgrlgk.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export const supabase = createSupabaseClient();
```

To ensure robustness, especially on iOS, we use a `safeSupabaseOperation` wrapper function for all database operations that provides error handling and retry logic.

## Database Schema

### 1. scanned_device Table

Stores BLE device scan data:

| Column             | Type        | Description                             |
| ------------------ | ----------- | --------------------------------------- |
| id                 | BIGSERIAL   | Primary key                             |
| session_id         | TEXT        | Identifier for a scanning session       |
| location_id        | BIGINT      | Foreign key to location_scanned table   |
| location_name      | TEXT        | Human-readable location name            |
| device_id          | TEXT        | Unique identifier of the BLE device     |
| device_name        | TEXT        | Name of the BLE device (if available)   |
| rssi               | INTEGER     | Signal strength (in dBm)                |
| manufacturer_data  | TEXT        | Manufacturer-specific data              |
| service_uuids      | TEXT        | Service UUIDs as comma-separated string |
| device_latitude    | FLOAT8      | Device location latitude                |
| device_longitude   | FLOAT8      | Device location longitude               |
| device_accuracy    | FLOAT8      | Device location accuracy (meters)       |
| location_latitude  | FLOAT8      | Session location latitude               |
| location_longitude | FLOAT8      | Session location longitude              |
| location_accuracy  | FLOAT8      | Session location accuracy (meters)      |
| location_notes     | TEXT        | User notes about location               |
| scan_time          | TIMESTAMPTZ | When the device was scanned             |
| scan_duration      | INTEGER     | Duration of the scan session (seconds)  |
| created_at         | TIMESTAMPTZ | Record creation timestamp               |

### 2. location_scanned Table

Stores information about scan locations:

| Column                | Type        | Description                  |
| --------------------- | ----------- | ---------------------------- |
| id                    | BIGSERIAL   | Primary key                  |
| location_name         | TEXT        | Human-readable location name |
| latitude              | FLOAT8      | Location latitude            |
| longitude             | FLOAT8      | Location longitude           |
| accuracy              | FLOAT8      | Location accuracy (meters)   |
| notes                 | TEXT        | Additional notes             |
| scan_start_time       | TIMESTAMPTZ | When scanning started        |
| scan_duration_seconds | INTEGER     | How long scanning lasted     |
| scan_count            | INTEGER     | Number of devices scanned    |
| created_at            | TIMESTAMPTZ | Record creation timestamp    |

### 3. wifi_networks Table

Stores WiFi network information collected during scans:

| Column             | Type        | Description                           |
| ------------------ | ----------- | ------------------------------------- |
| id                 | BIGSERIAL   | Primary key                           |
| session_id         | TEXT        | Identifier for a scanning session     |
| location_id        | BIGINT      | Foreign key to location_scanned table |
| ssid               | TEXT        | WiFi network name                     |
| bssid              | TEXT        | WiFi access point MAC address         |
| signal_strength    | INTEGER     | Signal strength indicator             |
| frequency          | INTEGER     | WiFi frequency (MHz)                  |
| channel            | INTEGER     | WiFi channel number                   |
| capabilities       | TEXT        | Network capabilities/security         |
| scan_time          | TIMESTAMPTZ | When the network was scanned          |
| location_latitude  | FLOAT8      | Location latitude                     |
| location_longitude | FLOAT8      | Location longitude                    |
| location_accuracy  | FLOAT8      | Location accuracy (meters)            |
| created_at         | TIMESTAMPTZ | Record creation timestamp             |

### 4. rssi_timeseries Table

Stores time-series RSSI measurements at 0.5-second intervals:

| Column          | Type        | Description                        |
| --------------- | ----------- | ---------------------------------- |
| id              | BIGSERIAL   | Primary key                        |
| session_id      | TEXT        | Identifier for a scanning session  |
| device_id       | TEXT        | BLE device identifier              |
| rssi            | INTEGER     | Signal strength value (dBm)        |
| timestamp       | TIMESTAMPTZ | Exact timestamp of the measurement |
| sequence_number | INTEGER     | Sequential number for ordering     |
| latitude        | FLOAT8      | Measurement location latitude      |
| longitude       | FLOAT8      | Measurement location longitude     |
| accuracy        | FLOAT8      | Location accuracy (meters)         |
| created_at      | TIMESTAMPTZ | Record creation timestamp          |

### 5. wifi_rssi_timeseries Table

Stores time-series WiFi signal strength measurements at 0.5-second intervals:

| Column          | Type        | Description                        |
| --------------- | ----------- | ---------------------------------- |
| id              | BIGSERIAL   | Primary key                        |
| session_id      | TEXT        | Identifier for a scanning session  |
| ssid            | TEXT        | WiFi network name                  |
| bssid           | TEXT        | WiFi access point MAC address      |
| signal_strength | INTEGER     | Signal strength value (dBm)        |
| timestamp       | TIMESTAMPTZ | Exact timestamp of the measurement |
| sequence_number | INTEGER     | Sequential number for ordering     |
| latitude        | FLOAT8      | Measurement location latitude      |
| longitude       | FLOAT8      | Measurement location longitude     |
| accuracy        | FLOAT8      | Location accuracy (meters)         |
| created_at      | TIMESTAMPTZ | Record creation timestamp          |

## Database Views

### 1. scan_session_summary

Provides aggregated statistics for each scanning session:

```sql
CREATE VIEW scan_session_summary AS
SELECT
  session_id,
  location_name,
  COUNT(DISTINCT device_id) as device_count,
  MIN(rssi) as min_rssi,
  MAX(rssi) as max_rssi,
  AVG(rssi) as avg_rssi,
  MIN(location_latitude) as latitude,
  MIN(location_longitude) as longitude,
  MIN(location_accuracy) as accuracy,
  MIN(scan_time) as start_time,
  MAX(scan_duration) as duration,
  MIN(created_at) as created_at
FROM
  scanned_device
WHERE
  session_id IS NOT NULL
GROUP BY
  session_id, location_name
ORDER BY
  MIN(created_at) DESC;
```

### 2. device_analysis_view

Provides detailed information for each scanned device:

```sql
CREATE VIEW device_analysis_view AS
SELECT
  device_id,
  device_name,
  session_id,
  location_name,
  rssi,
  manufacturer_data,
  service_uuids,
  device_latitude,
  device_longitude,
  location_latitude,
  location_longitude,
  location_accuracy,
  scan_time,
  created_at
FROM
  scanned_device
ORDER BY
  created_at DESC;
```

### 3. session_data_view

Joins BLE and WiFi data collected in the same session:

```sql
CREATE VIEW session_data_view AS
SELECT
  s.session_id,
  s.location_name,
  s.device_id,
  s.device_name,
  s.rssi as ble_rssi,
  s.scan_time as ble_scan_time,
  w.ssid as wifi_ssid,
  w.signal_strength as wifi_signal_strength,
  w.channel as wifi_channel,
  w.scan_time as wifi_scan_time,
  s.location_latitude,
  s.location_longitude,
  s.location_accuracy,
  s.created_at
FROM
  scanned_device s
LEFT JOIN
  wifi_networks w ON s.session_id = w.session_id
ORDER BY
  s.created_at DESC;
```

### 4. rssi_timeseries_analysis

Provides statistical analysis of RSSI time-series data:

```sql
CREATE OR REPLACE VIEW rssi_timeseries_analysis AS
SELECT
  session_id,
  device_id,
  MIN(rssi) as min_rssi,
  MAX(rssi) as max_rssi,
  AVG(rssi) as avg_rssi,
  STDDEV(rssi) as rssi_stddev,
  MIN(timestamp) as start_time,
  MAX(timestamp) as end_time,
  COUNT(*) as measurement_count,
  MAX(timestamp) - MIN(timestamp) as duration
FROM
  rssi_timeseries
GROUP BY
  session_id, device_id
ORDER BY
  MIN(timestamp) DESC;
```

## Collected Data

The app collects the following types of data:

1. **BLE device data**:

   - Device identifiers
   - Signal strength (RSSI)
   - Manufacturer data
   - Service UUIDs
   - Timestamps

2. **WiFi network data**:

   - Network name (SSID)
   - Signal strength
   - Frequency/channel information
   - Timestamps

3. **Location data**:
   - GPS coordinates
   - Accuracy
   - Timestamps

### Continuous RSSI Recording

The app now supports continuous RSSI recording with the following capabilities:

1. **Time-series data collection**:

   - Records RSSI values at 0.5-second intervals
   - Tracks both BLE and WiFi signal strength over time
   - Maintains sequence numbers for accurate time-series analysis

2. **Data visualization**:

   - Displays RSSI values over time as line charts
   - Shows signal strength fluctuations for individual devices
   - Allows comparison of different devices in the same recording session

3. **Statistical analysis**:
   - Calculates min/max/average RSSI values
   - Computes standard deviation to measure signal stability
   - Records total measurement count and duration

## Helpful Queries

View all scanning sessions with counts:

```sql
SELECT * FROM scan_session_summary ORDER BY created_at DESC;
```

View all devices from a specific session:

```sql
SELECT * FROM scanned_device WHERE session_id = 'your_session_id';
```

View all WiFi networks from a specific session:

```sql
SELECT * FROM wifi_networks WHERE session_id = 'your_session_id';
```

View combined BLE and WiFi data by session:

```sql
SELECT * FROM session_data_view WHERE session_id = 'your_session_id';
```

Find sessions with the strongest BLE signals:

```sql
SELECT session_id, location_name, MAX(rssi) as max_rssi
FROM scanned_device
GROUP BY session_id, location_name
ORDER BY max_rssi DESC
LIMIT 10;
```

Find sessions with the strongest WiFi signals:

```sql
SELECT session_id, ssid, MAX(signal_strength) as max_strength
FROM wifi_networks
GROUP BY session_id, ssid
ORDER BY max_strength DESC
LIMIT 10;
```

Clear all data (use with caution):

```sql
DELETE FROM scanned_device;
DELETE FROM wifi_networks;
DELETE FROM location_scanned;
```

View RSSI time-series data for a specific device in a session:

```sql
SELECT * FROM rssi_timeseries
WHERE session_id = 'your_session_id' AND device_id = 'your_device_id'
ORDER BY sequence_number ASC;
```

Calculate signal stability (lower standard deviation = more stable signal):

```sql
SELECT
  device_id,
  COUNT(*) as measurements,
  AVG(rssi) as avg_rssi,
  STDDEV(rssi) as signal_stability
FROM rssi_timeseries
WHERE session_id = 'your_session_id'
GROUP BY device_id
ORDER BY signal_stability ASC;
```

Compare WiFi and BLE signals from the same timeframe:

```sql
SELECT
  r.timestamp,
  r.device_id as ble_device,
  r.rssi as ble_rssi,
  w.ssid as wifi_network,
  w.signal_strength as wifi_rssi
FROM rssi_timeseries r
JOIN wifi_rssi_timeseries w
  ON r.session_id = w.session_id
  AND r.sequence_number = w.sequence_number
WHERE r.session_id = 'your_session_id'
ORDER BY r.timestamp ASC;
```

## Troubleshooting

If data is not being saved properly:

1. Check that your Supabase project URL and API key are correctly set in `src/supabaseClient.js`
2. Verify that Row Level Security (RLS) is properly configured to allow inserts
3. Test the database connection directly using the Supabase dashboard
4. Check the application logs for specific error messages
5. On iOS, if experiencing networking issues, refer to the `IOS_TROUBLESHOOTING.md` file
