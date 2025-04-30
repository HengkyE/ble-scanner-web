export interface BleDevice {
  id: string;
  device_id: string;
  device_name: string | null;
  rssi: number;
  timestamp: string;
  raw_data?: any;
  wifi_networks?: WiFiNetwork[];
  location?: Location;
  manufacturer_data?: string;
  service_uuids?: string[];
  tx_power_level?: number;
  created_at: string;
  water_level_measurement_id?: number;
}

export interface WiFiNetwork {
  SSID: string;
  BSSID: string;
  signalStrength: number;
  frequency: number;
  channel?: number;
  capabilities?: string;
  signalToNoiseRatio?: number;
  lastSeenTimestamp?: number;
  approximateDistance?: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp?: number;
}

export interface WaterLevelMeasurement {
  id: number;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  rssi_ble: BleDevice[] | null;
  rssi_wifi: WiFiNetwork[] | null;
  water_level_cm: number | null;
  timestamp: string;
  notes: string | null;
  measurement_type: string | null;
  created_at: string;
  analysis_metadata?: any;
}

export interface DeviceAnalysisData {
  id: number;
  device_id: string;
  device_name: string | null;
  rssi: number;
  manufacturer_data: string | null;
  service_uuids: string[] | null;
  tx_power_level: number | null;
  location: Location | null;
  timestamp: string;
  signal_history: { timestamp: string; rssi: number }[] | null;
  device_metadata: any;
  analysis_notes: string | null;
  analysis_type: string | null;
  created_at: string;
}
