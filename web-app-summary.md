# BLE Scanner Web Application

## Overview

This web application serves as a dashboard for Bluetooth Low Energy (BLE) device scanning and analysis. It provides visualization, analysis, and management of BLE device data and associated water level measurements, leveraging theoretical principles of signal propagation and environmental sensing.

## Pages and Functionality

### Devices Page

- **Functionality**: Displays a comprehensive list of scanned BLE devices with filtering options
- **Features**:
  - Tabular view of all detected devices with signal strength indicators
  - Signal strength analysis over time for selected devices
  - Location-based filtering and search capabilities
  - Device statistics dashboard
- **Theory**: Signal strength degradation over distance (RSSI measurements in dBm)

### Analysis Page

- **Functionality**: Advanced signal analysis for BLE devices
- **Features**:
  - Correlation analysis between distance and signal strength
  - Dual-axis visualization comparing distance and RSSI values
  - Statistical analysis of signal propagation characteristics
- **Theory**: Pearson correlation coefficient for signal/distance relationships, environmental signal propagation characteristics

### Maps Page

- **Functionality**: Geospatial visualization of scanned devices and locations
- **Features**:
  - Interactive map showing device locations and scanning locations
  - Color-coded markers indicating signal strength
  - Size-coded markers representing device density
  - Location and device filtering capabilities
- **Theory**: Geospatial distribution and heat mapping of signal propagation

### Compare Page

- **Functionality**: Comparative analysis of BLE devices detected across multiple locations
- **Features**:
  - Side-by-side comparison of 2-3 scanning locations
  - Identification of common and unique devices across locations
  - Detailed device signal information for each location
  - Statistical insights about device distribution patterns
- **Theory**: Signal propagation variations and device detection overlap in different environments

### Water Levels Page

- **Functionality**: Water level measurement tracking and visualization
- **Features**:
  - Time-series data visualization for water levels at different locations
  - Statistical summary of water level measurements
  - Correlation with BLE device scanning capabilities
- **Theory**: Environmental monitoring using BLE technology, sensor data collection and analysis

## Technical Implementation

- Built with Next.js, React, and TypeScript
- Leverages Leaflet for mapping visualization
- Uses Chart.js for data visualization
- Real-time data stored in Supabase backend
- Responsive UI using Tailwind CSS, HeroUI, and Ant Design components

## Theoretical Foundation

The application is built on several key theoretical principles:

1. **Signal Propagation**: BLE signal strength (RSSI) decreases with distance following an inverse square law, with environmental factors causing variations
2. **Correlation Analysis**: Statistical methods to measure relationships between physical distance and signal characteristics
3. **Geospatial Visualization**: Representing signal strength and device density in geographical context
4. **Environmental Sensing**: Integration of water level measurements with BLE technology for comprehensive environmental monitoring
5. **Comparative Analysis**: Identifying patterns in device detection across different physical environments

## 5. Compare Page (`/compare`)

**Purpose**: Comparative analysis between 2-3 locations showing unique device IDs and detailed data tables.

**Key Features**:

- **Location Selection**: Choose 2-3 scanning locations for comparison
- **Device Comparison Modes**:
  - All devices across locations
  - Common devices (found in all selected locations)
  - Unique devices (found only in specific locations)
- **Location Distance Analysis**:
  - Physical distance calculation between location pairs using Haversine formula
  - Device overlap percentages with visual progress bars
  - Shared device count statistics
- **Multi-Device Comparative Chart View**:
  - Interactive chart showing multiple devices' signal strength over time on the same plot
  - Device selection interface with checkboxes (up to 10 devices)
  - Color-coded lines for easy device identification
  - Time range filtering (5 minutes to all data)
  - Signal degradation analysis table with min/max/average RSSI values
- **Detailed Data Tables**:
  - Sortable columns by device ID and signal strength
  - Red X icon for "Not detected" entries
  - Device data comparison across selected locations
  - Click-to-expand device details with time series charts
- **Statistical Analysis**: Device overlap calculations and unique device identification
