"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Button,
  Checkbox,
  CheckboxGroup,
} from "@heroui/react";
import {
  Table,
  Typography,
  Spin,
  Empty,
  Tabs,
  Tooltip,
  Badge,
  Tag,
  Select,
  Space,
  Alert,
  Progress,
  Statistic,
  Modal,
  Button as AntButton,
} from "antd";
import {
  BarChartOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  ArrowsAltOutlined,
  WifiOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CompressOutlined,
} from "@ant-design/icons";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import { SortOrder } from "antd/es/table/interface";
import LineChartComponent from "@/components/LineChart";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface ScannedDevice {
  id: number;
  session_id: string;
  location_id?: number;
  location_name?: string;
  device_id: string;
  device_name?: string | null;
  rssi: number;
  manufacturer_data?: string | null;
  service_uuids?: string | null;
  scan_time?: string;
  timestamp: string; // for rssi_timeseries
  sequence_number?: number; // for rssi_timeseries
  created_at: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  location_latitude?: number | null;
  location_longitude?: number | null;
}

interface WifiNetwork {
  id: number;
  session_id: string;
  location_id?: number;
  ssid: string;
  bssid: string;
  signal_strength: number;
  frequency: number;
  channel: number;
  capabilities?: string;
  scan_time: string;
  location_latitude?: number;
  location_longitude?: number;
  location_accuracy?: number;
  created_at: string;
}

interface LocationInfo {
  id: number;
  location_name: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  notes?: string;
  scan_start_time: string;
  scan_duration_seconds: number;
  scan_count: number;
  created_at: string;
}

interface RssiTimeseries {
  id: number;
  session_id: string;
  device_id: string;
  rssi: number;
  timestamp: string;
  sequence_number: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  created_at: string;
}

interface WifiRssiTimeseries {
  id: number;
  session_id: string;
  ssid: string;
  bssid: string;
  signal_strength: number;
  timestamp: string;
  sequence_number: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  created_at: string;
}

interface LocationData {
  id: number;
  name: string;
  deviceCount: number;
  uniqueDeviceIds: Set<string>;
  uniqueBssids: Set<string>; // For WiFi networks
  devices: ScannedDevice[];
  wifiNetworks: WifiNetwork[]; // Add WiFi networks
  rssiTimeseries: RssiTimeseries[];
  wifiRssiTimeseries: WifiRssiTimeseries[];
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  averageRssi?: number;
  averageWifiRssi?: number;
  notes?: string;
  scanStartTime?: string;
  scanDuration?: number;
}

interface LocationDistance {
  location1: string;
  location2: string;
  distanceMeters: number;
  sharedDevices: number;
  sharedNetworks: number;
  sharedPercentage: number;
  bleRssiDifference: number;
  wifiRssiDifference: number;
}

// Additional interface for table data
interface DeviceDisplay {
  deviceId: string;
}

// Location option for enhanced dropdown
interface LocationOption {
  label: React.ReactNode;
  value: string;
  deviceCount: number;
  averageRssi: number;
  date: string;
  duration: string;
}

// RSSI Distribution component
const RssiDistributionChart = ({ sessionData }: { sessionData: LocationData }) => {
  // Group RSSI values into bins
  const binWidth = 5; // 5 dBm per bin
  const minRssi = -100;
  const maxRssi = -40;

  // Create bins
  const bins: { [key: string]: { range: string; count: number; color: string } } = {};
  for (let i = minRssi; i < maxRssi; i += binWidth) {
    const binKey = `${i} to ${i + binWidth}`;
    let color = "red";
    if (i > -70) color = "green";
    else if (i > -85) color = "orange";

    bins[binKey] = { range: binKey, count: 0, color };
  }

  // Count RSSI values in each bin
  sessionData.devices.forEach((device) => {
    const rssi = device.rssi;
    for (let i = minRssi; i < maxRssi; i += binWidth) {
      if (rssi >= i && rssi < i + binWidth) {
        const binKey = `${i} to ${i + binWidth}`;
        bins[binKey].count++;
        break;
      }
    }
  });

  // Convert to array for rendering
  const binsArray = Object.values(bins);

  return (
    <div className="py-4">
      <Text strong>RSSI Distribution</Text>
      <div className="flex items-end h-40 mt-2 border-b border-l">
        {binsArray.map((bin, index) => (
          <div
            key={index}
            className="flex flex-col items-center mx-1 mb-1"
            style={{ width: `${100 / binsArray.length}%` }}
          >
            <div className="text-xs text-center">{bin.count}</div>
            <div
              style={{
                height:
                  bin.count > 0
                    ? `${Math.min(100, (bin.count / sessionData.devices.length) * 500)}%`
                    : "1px",
                backgroundColor: bin.color,
                width: "80%",
              }}
              className="rounded-t"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <div>{minRssi} dBm</div>
        <div>Signal Strength</div>
        <div>{maxRssi} dBm</div>
      </div>
    </div>
  );
};

// WiFi RSSI Distribution component
const WifiRssiDistributionChart = ({ sessionData }: { sessionData: LocationData }) => {
  // Group RSSI values into bins
  const binWidth = 5; // 5 dBm per bin
  const minRssi = -90;
  const maxRssi = -30;

  // Create bins
  const bins: { [key: string]: { range: string; count: number; color: string } } = {};
  for (let i = minRssi; i < maxRssi; i += binWidth) {
    const binKey = `${i} to ${i + binWidth}`;
    let color = "red";
    if (i > -60) color = "green";
    else if (i > -75) color = "orange";

    bins[binKey] = { range: binKey, count: 0, color };
  }

  // Count RSSI values in each bin
  sessionData.wifiRssiTimeseries.forEach((network) => {
    const rssi = network.signal_strength;
    for (let i = minRssi; i < maxRssi; i += binWidth) {
      if (rssi >= i && rssi < i + binWidth) {
        const binKey = `${i} to ${i + binWidth}`;
        bins[binKey].count++;
        break;
      }
    }
  });

  // Convert to array for rendering
  const binsArray = Object.values(bins);

  return (
    <div className="py-4">
      <Text strong>WiFi Signal Strength Distribution</Text>
      <div className="flex items-end h-40 mt-2 border-b border-l">
        {binsArray.map((bin, index) => (
          <div
            key={index}
            className="flex flex-col items-center mx-1 mb-1"
            style={{ width: `${100 / binsArray.length}%` }}
          >
            <div className="text-xs text-center">{bin.count}</div>
            <div
              style={{
                height:
                  bin.count > 0
                    ? `${Math.min(100, (bin.count / sessionData.wifiRssiTimeseries.length) * 500)}%`
                    : "1px",
                backgroundColor: bin.color,
                width: "80%",
              }}
              className="rounded-t"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <div>{minRssi} dBm</div>
        <div>WiFi Signal Strength</div>
        <div>{maxRssi} dBm</div>
      </div>
    </div>
  );
};

// Session Analysis component for the enhanced comparison
const SessionAnalysis = ({
  sessionData,
  dataType = "both",
}: {
  sessionData: LocationData;
  dataType?: "ble" | "wifi" | "both";
}) => {
  if (!sessionData) return null;

  // Determine what data to show based on dataType
  const showBle = dataType === "ble" || dataType === "both";
  const showWifi = dataType === "wifi" || dataType === "both";

  // Calculate BLE signal quality metrics
  const bleSignalQuality = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  };

  if (showBle) {
    sessionData.devices.forEach((device) => {
      if (device.rssi > -70) bleSignalQuality.excellent++;
      else if (device.rssi > -80) bleSignalQuality.good++;
      else if (device.rssi > -90) bleSignalQuality.fair++;
      else bleSignalQuality.poor++;
    });
  }

  // Calculate WiFi signal quality metrics
  const wifiSignalQuality = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  };

  if (showWifi) {
    sessionData.wifiRssiTimeseries.forEach((network) => {
      if (network.signal_strength > -60) wifiSignalQuality.excellent++;
      else if (network.signal_strength > -70) wifiSignalQuality.good++;
      else if (network.signal_strength > -80) wifiSignalQuality.fair++;
      else wifiSignalQuality.poor++;
    });
  }

  // Calculate total percentage of each quality for BLE
  const bleTotalReadings = sessionData.devices.length;
  const bleQualityPercentages = {
    excellent:
      bleTotalReadings > 0 ? Math.round((bleSignalQuality.excellent / bleTotalReadings) * 100) : 0,
    good: bleTotalReadings > 0 ? Math.round((bleSignalQuality.good / bleTotalReadings) * 100) : 0,
    fair: bleTotalReadings > 0 ? Math.round((bleSignalQuality.fair / bleTotalReadings) * 100) : 0,
    poor: bleTotalReadings > 0 ? Math.round((bleSignalQuality.poor / bleTotalReadings) * 100) : 0,
  };

  // Calculate total percentage of each quality for WiFi
  const wifiTotalReadings = sessionData.wifiRssiTimeseries.length;
  const wifiQualityPercentages = {
    excellent:
      wifiTotalReadings > 0
        ? Math.round((wifiSignalQuality.excellent / wifiTotalReadings) * 100)
        : 0,
    good:
      wifiTotalReadings > 0 ? Math.round((wifiSignalQuality.good / wifiTotalReadings) * 100) : 0,
    fair:
      wifiTotalReadings > 0 ? Math.round((wifiSignalQuality.fair / wifiTotalReadings) * 100) : 0,
    poor:
      wifiTotalReadings > 0 ? Math.round((wifiSignalQuality.poor / wifiTotalReadings) * 100) : 0,
  };

  // Get time range from both BLE and WiFi data
  const bleTimestamps = sessionData.devices.map((d) => new Date(d.timestamp).getTime());
  const wifiTimestamps = sessionData.wifiRssiTimeseries.map((d) => new Date(d.timestamp).getTime());
  const allTimestamps = [...bleTimestamps, ...wifiTimestamps];

  const startTime = allTimestamps.length > 0 ? new Date(Math.min(...allTimestamps)) : null;
  const endTime = allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps)) : null;

  // Calculate duration
  let duration = "N/A";
  if (startTime && endTime) {
    const durationMs = endTime.getTime() - startTime.getTime();
    if (durationMs < 60000) {
      // less than a minute
      duration = `${Math.round(durationMs / 1000)}s`;
    } else if (durationMs < 3600000) {
      // less than an hour
      duration = `${Math.round(durationMs / 60000)}m`;
    } else {
      duration = `${Math.round(durationMs / 3600000)}h ${Math.round(
        (durationMs % 3600000) / 60000
      )}m`;
    }
  }

  return (
    <div className="session-analysis">
      <div className="mb-4">
        <Title level={5} className="mb-2">
          {sessionData.name} Analysis
        </Title>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {showBle && (
            <div className="p-3 border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center text-sm text-gray-500 mb-1">
                <DatabaseOutlined className="mr-1" /> BLE Devices
              </div>
              <div className="text-xl font-semibold">{sessionData.uniqueDeviceIds.size}</div>
              <div className="text-xs text-gray-500">{sessionData.devices.length} readings</div>
            </div>
          )}

          {showWifi && (
            <div className="p-3 border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center text-sm text-gray-500 mb-1">
                <WifiOutlined className="mr-1" /> WiFi Networks
              </div>
              <div className="text-xl font-semibold">{sessionData.uniqueBssids.size}</div>
              <div className="text-xs text-gray-500">
                {sessionData.wifiRssiTimeseries.length} readings
              </div>
            </div>
          )}

          <div className="p-3 border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center text-sm text-gray-500 mb-1">
              <LineChartOutlined className="mr-1" /> Signal
            </div>
            <div className="flex flex-col">
              {showBle && (
                <div className="text-sm">
                  BLE:{" "}
                  <span className="font-semibold">
                    {Math.round(sessionData.averageRssi ?? 0)} dBm
                  </span>
                </div>
              )}
              {showWifi && (
                <div className="text-sm">
                  WiFi:{" "}
                  <span className="font-semibold">
                    {Math.round(sessionData.averageWifiRssi ?? 0)} dBm
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center text-sm text-gray-500 mb-1">
              <ClockCircleOutlined className="mr-1" /> Duration
            </div>
            <div className="text-xl font-semibold">{duration}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showBle && (
          <>
            <Card className="shadow-sm hover:shadow-md transition-all duration-200">
              <CardHeader>
                <div className="flex items-center text-base font-medium">
                  <WifiOutlined className="mr-2" /> BLE Signal Quality
                </div>
              </CardHeader>
              <CardBody>
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <Text>Excellent (-70dBm or better)</Text>
                    <Text strong>{bleSignalQuality.excellent} readings</Text>
                  </div>
                  <Progress
                    percent={bleQualityPercentages.excellent}
                    size="small"
                    strokeColor="green"
                    showInfo={false}
                  />
                </div>
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <Text>Good (-80dBm to -70dBm)</Text>
                    <Text strong>{bleSignalQuality.good} readings</Text>
                  </div>
                  <Progress
                    percent={bleQualityPercentages.good}
                    size="small"
                    strokeColor="blue"
                    showInfo={false}
                  />
                </div>
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <Text>Fair (-90dBm to -80dBm)</Text>
                    <Text strong>{bleSignalQuality.fair} readings</Text>
                  </div>
                  <Progress
                    percent={bleQualityPercentages.fair}
                    size="small"
                    strokeColor="orange"
                    showInfo={false}
                  />
                </div>
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <Text>Poor (below -90dBm)</Text>
                    <Text strong>{bleSignalQuality.poor} readings</Text>
                  </div>
                  <Progress
                    percent={bleQualityPercentages.poor}
                    size="small"
                    strokeColor="red"
                    showInfo={false}
                  />
                </div>
              </CardBody>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-all duration-200">
              <CardHeader>
                <div className="flex items-center text-base font-medium">
                  <BarChartOutlined className="mr-2" /> BLE RSSI Distribution
                </div>
              </CardHeader>
              <CardBody>
                <RssiDistributionChart sessionData={sessionData} />
              </CardBody>
            </Card>
          </>
        )}

        {showWifi && (
          <>
            <Card className="shadow-sm hover:shadow-md transition-all duration-200">
              <CardHeader>
                <div className="flex items-center text-base font-medium">
                  <WifiOutlined className="mr-2" /> WiFi Signal Quality
                </div>
              </CardHeader>
              <CardBody>
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <Text>Excellent (-60dBm or better)</Text>
                    <Text strong>{wifiSignalQuality.excellent} readings</Text>
                  </div>
                  <Progress
                    percent={wifiQualityPercentages.excellent}
                    size="small"
                    strokeColor="green"
                    showInfo={false}
                  />
                </div>
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <Text>Good (-70dBm to -60dBm)</Text>
                    <Text strong>{wifiSignalQuality.good} readings</Text>
                  </div>
                  <Progress
                    percent={wifiQualityPercentages.good}
                    size="small"
                    strokeColor="blue"
                    showInfo={false}
                  />
                </div>
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <Text>Fair (-80dBm to -70dBm)</Text>
                    <Text strong>{wifiSignalQuality.fair} readings</Text>
                  </div>
                  <Progress
                    percent={wifiQualityPercentages.fair}
                    size="small"
                    strokeColor="orange"
                    showInfo={false}
                  />
                </div>
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <Text>Poor (below -80dBm)</Text>
                    <Text strong>{wifiSignalQuality.poor} readings</Text>
                  </div>
                  <Progress
                    percent={wifiQualityPercentages.poor}
                    size="small"
                    strokeColor="red"
                    showInfo={false}
                  />
                </div>
              </CardBody>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-all duration-200">
              <CardHeader>
                <div className="flex items-center text-base font-medium">
                  <BarChartOutlined className="mr-2" /> WiFi RSSI Distribution
                </div>
              </CardHeader>
              <CardBody>
                <WifiRssiDistributionChart sessionData={sessionData} />
              </CardBody>
            </Card>
          </>
        )}
      </div>

      {sessionData.latitude && sessionData.longitude && (
        <div className="mt-4 p-3 border rounded-md">
          <div className="flex items-center">
            <EnvironmentOutlined className="mr-2" />
            <Text strong>Location: </Text>
            <Text className="ml-2">
              {sessionData.latitude.toFixed(6)}, {sessionData.longitude.toFixed(6)}
              {sessionData.accuracy && ` (±${sessionData.accuracy}m)`}
            </Text>
          </div>
          {sessionData.notes && (
            <div className="mt-2 text-sm text-gray-600">
              <Text strong>Notes: </Text>
              <Text>{sessionData.notes}</Text>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ComparePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationsData, setLocationsData] = useState<Record<string, LocationData>>({});
  const [deviceData, setDeviceData] = useState<ScannedDevice[]>([]);
  const [compareMode, setCompareMode] = useState<"all" | "common" | "unique">("all");
  const [locationDistances, setLocationDistances] = useState<LocationDistance[]>([]);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"ascend" | "descend" | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [comparisonType, setComparisonType] = useState<"session" | "location">("session");
  const [physicalLocations, setPhysicalLocations] = useState<
    Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      accuracy: number;
      sessions: string[];
      readings: number;
      notes?: string;
    }>
  >([]);
  const [dataType, setDataType] = useState<"ble" | "wifi" | "both">("both");
  const [selectedDeviceDetails, setSelectedDeviceDetails] = useState<{
    deviceId: string;
    locations: Record<string, ScannedDevice>;
  } | null>(null);
  const [isDeviceModalVisible, setIsDeviceModalVisible] = useState(false);
  const [loadingDeviceData, setLoadingDeviceData] = useState(false);
  const [deviceTimeseriesData, setDeviceTimeseriesData] = useState<
    Record<string, RssiTimeseries[]>
  >({});

  useEffect(() => {
    if (comparisonType === "session") {
      fetchSessions();
    } else {
      fetchPhysicalLocations();
    }
  }, [comparisonType]);

  const fetchPhysicalLocations = async () => {
    setIsLoading(true);
    try {
      // First, check if we have predefined locations in the location_scanned table
      const { data: locationScannedData, error: locationScannedError } =
        await safeSupabaseOperation(() =>
          supabase.from("location_scanned").select("*").order("created_at", { ascending: false })
        );

      if (locationScannedError) {
        console.error("Error fetching scanned locations:", locationScannedError);
      }

      let predefinedLocations: Array<{
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        accuracy: number;
        notes?: string;
        sessions: string[];
        readings: number;
      }> = [];

      // If we have predefined locations, use them
      if (locationScannedData && locationScannedData.length > 0) {
        // Get all sessions that have location data
        const { data: sessionLocationData, error: sessionError } = await safeSupabaseOperation(() =>
          supabase
            .from("rssi_timeseries")
            .select("session_id, latitude, longitude")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
        );

        if (sessionError) {
          console.error("Error fetching session locations:", sessionError);
        }

        // Map sessions to predefined locations
        const sessionsMap = new Map<number, Set<string>>();
        const readingsCountMap = new Map<number, number>();

        if (sessionLocationData) {
          sessionLocationData.forEach((item: any) => {
            if (!item.latitude || !item.longitude || !item.session_id) return;

            for (const location of locationScannedData) {
              // Use the Haversine formula to check if this point is within the location
              const distance = calculateDistance(
                item.latitude,
                item.longitude,
                location.latitude,
                location.longitude
              );

              // If within 50 meters, consider it part of this location
              if (distance !== null && distance < (location.accuracy || 50)) {
                if (!sessionsMap.has(location.id)) {
                  sessionsMap.set(location.id, new Set<string>());
                  readingsCountMap.set(location.id, 0);
                }
                sessionsMap.get(location.id)?.add(item.session_id);
                readingsCountMap.set(location.id, (readingsCountMap.get(location.id) || 0) + 1);
                break;
              }
            }
          });
        }

        // Create predefined locations with session data
        predefinedLocations = locationScannedData.map(
          (location: {
            id: number;
            location_name?: string;
            latitude: number;
            longitude: number;
            accuracy?: number;
            notes?: string;
          }) => ({
            id: `loc_${location.id}`,
            name: location.location_name || `Location ${location.id}`,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy || 50,
            notes: location.notes,
            sessions: Array.from(sessionsMap.get(location.id) || []),
            readings: readingsCountMap.get(location.id) || 0,
          })
        );
      }

      // If we don't have enough predefined locations (at least 3), also do automatic clustering
      if (predefinedLocations.length < 3) {
        // Get all unique location coordinates from the data for automatic clustering
        const { data: locationData, error: locationError } = await safeSupabaseOperation(() =>
          supabase
            .from("rssi_timeseries")
            .select("latitude, longitude")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
        );

        if (locationError) {
          console.error("Error fetching coordinates:", locationError);
          return;
        }

        // Group by coordinates using a threshold distance (e.g., 20 meters)
        const DISTANCE_THRESHOLD = 20; // meters
        const locationGroups: Array<{
          latitude: number;
          longitude: number;
          readings: number;
          sessions: Set<string>;
        }> = [];

        locationData.forEach((point: any) => {
          if (!point.latitude || !point.longitude) return;

          // Check if this point is close to any existing group
          let foundGroup = false;
          for (const group of locationGroups) {
            const distance = calculateDistance(
              point.latitude,
              point.longitude,
              group.latitude,
              group.longitude
            );

            if (distance !== null && distance < DISTANCE_THRESHOLD) {
              // Add to existing group - update group center (weighted average)
              const totalReadings = group.readings + 1;
              group.latitude = (group.latitude * group.readings + point.latitude) / totalReadings;
              group.longitude =
                (group.longitude * group.readings + point.longitude) / totalReadings;
              group.readings++;
              foundGroup = true;
              break;
            }
          }

          // If no nearby group, create a new one
          if (!foundGroup) {
            locationGroups.push({
              latitude: point.latitude,
              longitude: point.longitude,
              readings: 1,
              sessions: new Set<string>(),
            });
          }
        });

        // Now get the sessions associated with each location group
        const { data: sessionLocationData, error: sessionLocationError } =
          await safeSupabaseOperation(() =>
            supabase
              .from("rssi_timeseries")
              .select("session_id, latitude, longitude")
              .not("latitude", "is", null)
              .not("longitude", "is", null)
          );

        if (sessionLocationError) {
          console.error("Error fetching session locations:", sessionLocationError);
          return;
        }

        // Associate sessions with location groups
        sessionLocationData.forEach((item: any) => {
          if (!item.latitude || !item.longitude || !item.session_id) return;

          for (const group of locationGroups) {
            const distance = calculateDistance(
              item.latitude,
              item.longitude,
              group.latitude,
              group.longitude
            );

            if (distance !== null && distance < DISTANCE_THRESHOLD) {
              group.sessions.add(item.session_id);
              break;
            }
          }
        });

        // Add automatically discovered locations
        const autoLocations = locationGroups.map((group, index) => ({
          id: `auto_${index}`,
          name: `Auto Location ${index + 1}`,
          latitude: group.latitude,
          longitude: group.longitude,
          accuracy: DISTANCE_THRESHOLD,
          sessions: Array.from(group.sessions),
          readings: group.readings,
        }));

        // Combine predefined and auto locations
        predefinedLocations = [...predefinedLocations, ...autoLocations];
      }

      setPhysicalLocations(predefinedLocations);

      // Create location options for dropdown
      const options = predefinedLocations.map((location) => {
        // Calculate average RSSI and other metrics later when selected
        return {
          label: (
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="font-medium">{location.name}</span>
                <span className="text-xs text-gray-500">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Tag color="blue">{location.sessions.length} sessions</Tag>
                <Tag color="green">{location.readings} readings</Tag>
                {location.notes && (
                  <Tooltip title={location.notes}>
                    <InfoCircleOutlined />
                  </Tooltip>
                )}
              </div>
            </div>
          ),
          value: location.id,
          deviceCount: 0, // Will be calculated when needed
          averageRssi: 0,
          date: "Multiple dates",
          duration: "N/A",
        };
      });

      setLocationOptions(options);
      setLocations(predefinedLocations.map((loc) => loc.id));

      // Auto-select first three locations if available or at least two
      if (predefinedLocations.length >= 3) {
        setSelectedLocations([
          predefinedLocations[0].id,
          predefinedLocations[1].id,
          predefinedLocations[2].id,
        ]);
      } else if (predefinedLocations.length >= 2) {
        setSelectedLocations([predefinedLocations[0].id, predefinedLocations[1].id]);
      }
    } catch (error) {
      console.error("Error fetching physical locations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      // Get distinct session IDs first to make sure we have a complete list
      const { data: sessionData, error: sessionError } = await safeSupabaseOperation(() =>
        supabase
          .from("rssi_timeseries")
          .select("session_id, created_at")
          .order("created_at", { ascending: false })
      );

      if (sessionError) {
        console.error("Error fetching sessions:", sessionError);
        return;
      }

      // Extract unique session IDs with their most recent timestamps
      const sessionMap = new Map<string, string>();
      sessionData.forEach((item: any) => {
        if (item.session_id && !sessionMap.has(item.session_id)) {
          sessionMap.set(item.session_id, item.created_at);
        }
      });

      // Sort sessions by created_at (newest first)
      const uniqueSessions = Array.from(sessionMap.keys()).sort((a, b) => {
        const dateA = new Date(sessionMap.get(a) || 0);
        const dateB = new Date(sessionMap.get(b) || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // Fetch all unique device IDs by session/location to get accurate counts
      const { data: deviceLocationData, error: deviceLocationError } = await safeSupabaseOperation(
        () =>
          supabase
            .from("rssi_timeseries")
            .select("session_id, device_id, latitude, longitude, rssi, created_at, timestamp")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .order("created_at", { ascending: false })
      );

      if (deviceLocationError) {
        console.error("Error fetching device locations:", deviceLocationError);
        return;
      }

      // Group data by session (treating session as location)
      const devicesBySession = new Map<string, Set<string>>();
      const sessionCoordinates = new Map<
        string,
        {
          lat: number | null;
          lng: number | null;
          rssiSum: number;
          rssiCount: number;
          timeRange: { start: string; end: string };
        }
      >();

      // Process session data
      deviceLocationData.forEach((item: any) => {
        if (item.session_id) {
          const sessionId = item.session_id;

          // Add device to session tracking
          if (!devicesBySession.has(sessionId)) {
            devicesBySession.set(sessionId, new Set());
          }
          if (item.device_id) {
            devicesBySession.get(sessionId)?.add(item.device_id);
          }

          // Track coordinates and RSSI for each session
          if (!sessionCoordinates.has(sessionId)) {
            sessionCoordinates.set(sessionId, {
              lat: item.latitude,
              lng: item.longitude,
              rssiSum: 0,
              rssiCount: 0,
              timeRange: {
                start: item.timestamp || item.created_at,
                end: item.timestamp || item.created_at,
              },
            });
          }

          // Update time range (find min and max)
          const timestamp = item.timestamp || item.created_at;
          const sessionInfo = sessionCoordinates.get(sessionId)!;
          if (new Date(timestamp) < new Date(sessionInfo.timeRange.start)) {
            sessionInfo.timeRange.start = timestamp;
          }
          if (new Date(timestamp) > new Date(sessionInfo.timeRange.end)) {
            sessionInfo.timeRange.end = timestamp;
          }

          if (item.rssi) {
            sessionInfo.rssiSum += item.rssi;
            sessionInfo.rssiCount++;
          }
        }
      });

      // Get RSSI data by session
      const { data: rssiData, error: rssiError } = await safeSupabaseOperation(() =>
        supabase
          .from("rssi_timeseries")
          .select("session_id, rssi, created_at")
          .order("created_at", { ascending: false })
      );

      if (rssiError) {
        console.error("Error fetching RSSI data:", rssiError);
        return;
      }

      // Process RSSI data
      rssiData.forEach((item: any) => {
        if (item.session_id && item.rssi) {
          const sessionId = item.session_id;

          if (!sessionCoordinates.has(sessionId)) {
            sessionCoordinates.set(sessionId, {
              lat: null,
              lng: null,
              rssiSum: 0,
              rssiCount: 0,
              timeRange: {
                start: item.created_at,
                end: item.created_at,
              },
            });
          }

          const sessionInfo = sessionCoordinates.get(sessionId)!;
          sessionInfo.rssiSum += item.rssi;
          sessionInfo.rssiCount++;
        }
      });

      // Pass all unique sessions from our filtered Map
      setLocations(uniqueSessions);

      // Create enhanced location options for the dropdown
      const options = uniqueSessions.map((sessionId) => {
        const info = sessionCoordinates.get(sessionId) || {
          rssiSum: 0,
          rssiCount: 0,
          timeRange: { start: "", end: "" },
        };

        // Get device count from our device counting map
        const deviceCount = devicesBySession.get(sessionId)?.size || 0;
        const averageRssi = info.rssiCount > 0 ? Math.round(info.rssiSum / info.rssiCount) : 0;

        // Get signal strength color
        let signalColor = "red";
        if (averageRssi > -70) signalColor = "green";
        else if (averageRssi > -90) signalColor = "orange";

        // Calculate session duration
        let duration = "N/A";
        try {
          if (info.timeRange && info.timeRange.start && info.timeRange.end) {
            const startTime = new Date(info.timeRange.start);
            const endTime = new Date(info.timeRange.end);
            const durationMs = endTime.getTime() - startTime.getTime();

            if (durationMs < 60000) {
              // less than a minute
              duration = `${Math.round(durationMs / 1000)}s`;
            } else if (durationMs < 3600000) {
              // less than an hour
              duration = `${Math.round(durationMs / 60000)}m`;
            } else {
              duration = `${Math.round(durationMs / 3600000)}h ${Math.round(
                (durationMs % 3600000) / 60000
              )}m`;
            }
          }
        } catch (e) {
          console.error("Error calculating duration:", e);
        }

        const sessionDate = info.timeRange.end
          ? new Date(info.timeRange.end).toLocaleDateString()
          : "Unknown";

        return {
          label: (
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="font-medium">Session: {sessionId.substring(0, 8)}...</span>
                <span className="text-xs text-gray-500">
                  {sessionDate} • {duration}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Tag color="blue">{deviceCount} devices</Tag>
                <Tag color={signalColor}>{averageRssi} dBm</Tag>
              </div>
            </div>
          ),
          value: sessionId,
          deviceCount,
          averageRssi,
          date: sessionDate,
          duration,
        };
      });

      setLocationOptions(options);

      // Auto-select first two sessions if available
      if (uniqueSessions.length >= 2) {
        setSelectedLocations([uniqueSessions[0], uniqueSessions[1]]);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (
    lat1: number | null | undefined,
    lon1: number | null | undefined,
    lat2: number | null | undefined,
    lon2: number | null | undefined
  ): number | null => {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return null;
    }

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance; // distance in meters
  };

  // Calculate location distances and shared devices
  const calculateLocationDistances = (locationsData: Record<string, LocationData>) => {
    const distances: LocationDistance[] = [];
    const locationNames = Object.keys(locationsData);

    // Calculate distance and shared devices for each location pair
    for (let i = 0; i < locationNames.length; i++) {
      for (let j = i + 1; j < locationNames.length; j++) {
        const loc1 = locationsData[locationNames[i]];
        const loc2 = locationsData[locationNames[j]];

        // Calculate distance
        const distance = calculateDistance(
          loc1.latitude,
          loc1.longitude,
          loc2.latitude,
          loc2.longitude
        );

        // Calculate shared BLE devices
        const devicesLoc1 = loc1.uniqueDeviceIds;
        const devicesLoc2 = loc2.uniqueDeviceIds;
        const sharedDevices = [...devicesLoc1].filter((d) => devicesLoc2.has(d)).length;

        // Calculate shared WiFi networks
        const networksLoc1 = loc1.uniqueBssids;
        const networksLoc2 = loc2.uniqueBssids;
        const sharedNetworks = [...networksLoc1].filter((n) => networksLoc2.has(n)).length;

        // Calculate percentage of shared devices (BLE and WiFi combined)
        const totalUniqueDevices = new Set([...devicesLoc1, ...devicesLoc2]).size;
        const totalUniqueNetworks = new Set([...networksLoc1, ...networksLoc2]).size;

        const sharedPercentage =
          (totalUniqueDevices > 0 ? (sharedDevices / totalUniqueDevices) * 100 : 0) +
          (totalUniqueNetworks > 0 ? (sharedNetworks / totalUniqueNetworks) * 100 : 0);

        // Average the percentages if both types exist
        const normalizedPercentage =
          totalUniqueDevices > 0 && totalUniqueNetworks > 0
            ? sharedPercentage / 2
            : sharedPercentage;

        // Calculate RSSI differences
        const bleRssiDifference = Math.abs((loc1.averageRssi || 0) - (loc2.averageRssi || 0));
        const wifiRssiDifference = Math.abs(
          (loc1.averageWifiRssi || 0) - (loc2.averageWifiRssi || 0)
        );

        // Add distance data
        distances.push({
          location1: loc1.name,
          location2: loc2.name,
          distanceMeters: distance || 0,
          sharedDevices,
          sharedNetworks,
          sharedPercentage: normalizedPercentage,
          bleRssiDifference,
          wifiRssiDifference,
        });
      }
    }

    return distances;
  };

  const handleCompare = async () => {
    if (selectedLocations.length < 2) {
      return;
    }

    setIsLoading(true);
    try {
      // Clear previous data
      setLocationsData({});
      setLocationDistances([]);

      // Fetch data for selected sessions or locations based on comparison type
      const locationsDataMap: Record<string, LocationData> = {};

      if (comparisonType === "session") {
        // Existing session-based comparison logic
        for (const sessionId of selectedLocations) {
          // Fetch BLE data from rssi_timeseries
          const { data: bleData, error: bleError } = await safeSupabaseOperation(() =>
            supabase
              .from("rssi_timeseries")
              .select("*")
              .eq("session_id", sessionId)
              .order("created_at", { ascending: false })
          );

          if (bleError) {
            console.error(`Error fetching BLE data for session ${sessionId}:`, bleError);
          }

          // Fetch WiFi data from wifi_rssi_timeseries
          const { data: wifiData, error: wifiError } = await safeSupabaseOperation(() =>
            supabase
              .from("wifi_rssi_timeseries")
              .select("*")
              .eq("session_id", sessionId)
              .order("created_at", { ascending: false })
          );

          if (wifiError) {
            console.error(`Error fetching WiFi data for session ${sessionId}:`, wifiError);
          }

          // Skip if no data
          if ((!bleData || bleData.length === 0) && (!wifiData || wifiData.length === 0)) {
            continue;
          }

          // Get unique BLE device IDs
          const uniqueDeviceIds = new Set<string>();
          let bleRssiSum = 0;
          let bleRssiCount = 0;

          if (bleData) {
            bleData.forEach((device: any) => {
              if (device.device_id) {
                uniqueDeviceIds.add(device.device_id);
              }

              if (device.rssi) {
                bleRssiSum += device.rssi;
                bleRssiCount++;
              }
            });
          }

          // Get unique WiFi BSSIDs
          const uniqueBssids = new Set<string>();
          let wifiRssiSum = 0;
          let wifiRssiCount = 0;

          if (wifiData) {
            wifiData.forEach((network: any) => {
              if (network.bssid) {
                uniqueBssids.add(network.bssid);
              }

              if (network.signal_strength) {
                wifiRssiSum += network.signal_strength;
                wifiRssiCount++;
              }
            });
          }

          // Calculate average RSSIs
          const averageBleRssi = bleRssiCount > 0 ? bleRssiSum / bleRssiCount : 0;
          const averageWifiRssi = wifiRssiCount > 0 ? wifiRssiSum / wifiRssiCount : 0;

          locationsDataMap[sessionId] = {
            id: 0,
            name: `Session: ${sessionId}`,
            deviceCount: uniqueDeviceIds.size,
            uniqueDeviceIds,
            uniqueBssids,
            devices: bleData || [],
            wifiNetworks: [],
            rssiTimeseries: bleData || [],
            wifiRssiTimeseries: wifiData || [],
            latitude: null,
            longitude: null,
            accuracy: null,
            averageRssi: averageBleRssi,
            averageWifiRssi: averageWifiRssi,
          };
        }
      } else {
        // Location-based comparison logic
        for (const locationId of selectedLocations) {
          // Find the physical location
          const physicalLocation = physicalLocations.find((loc) => loc.id === locationId);
          if (!physicalLocation) continue;

          // Get all sessions at this location
          const sessionIds = physicalLocation.sessions;
          if (sessionIds.length === 0) continue;

          // Fetch BLE data for all sessions at this location
          const { data: bleData, error: bleError } = await safeSupabaseOperation(() =>
            supabase
              .from("rssi_timeseries")
              .select("*")
              .in("session_id", sessionIds)
              .order("created_at", { ascending: false })
          );

          if (bleError) {
            console.error(`Error fetching BLE data for location ${locationId}:`, bleError);
          }

          // Fetch WiFi data for all sessions at this location
          const { data: wifiData, error: wifiError } = await safeSupabaseOperation(() =>
            supabase
              .from("wifi_rssi_timeseries")
              .select("*")
              .in("session_id", sessionIds)
              .order("created_at", { ascending: false })
          );

          if (wifiError) {
            console.error(`Error fetching WiFi data for location ${locationId}:`, wifiError);
          }

          // Skip if no data
          if ((!bleData || bleData.length === 0) && (!wifiData || wifiData.length === 0)) {
            continue;
          }

          // Get unique BLE device IDs
          const uniqueDeviceIds = new Set<string>();
          let bleRssiSum = 0;
          let bleRssiCount = 0;

          if (bleData) {
            bleData.forEach((device: any) => {
              if (device.device_id) {
                uniqueDeviceIds.add(device.device_id);
              }

              if (device.rssi) {
                bleRssiSum += device.rssi;
                bleRssiCount++;
              }
            });
          }

          // Get unique WiFi BSSIDs
          const uniqueBssids = new Set<string>();
          let wifiRssiSum = 0;
          let wifiRssiCount = 0;

          if (wifiData) {
            wifiData.forEach((network: any) => {
              if (network.bssid) {
                uniqueBssids.add(network.bssid);
              }

              if (network.signal_strength) {
                wifiRssiSum += network.signal_strength;
                wifiRssiCount++;
              }
            });
          }

          // Calculate average RSSIs
          const averageBleRssi = bleRssiCount > 0 ? bleRssiSum / bleRssiCount : 0;
          const averageWifiRssi = wifiRssiCount > 0 ? wifiRssiSum / wifiRssiCount : 0;

          locationsDataMap[locationId] = {
            id: 0,
            name: physicalLocation.name,
            deviceCount: uniqueDeviceIds.size,
            uniqueDeviceIds,
            uniqueBssids,
            devices: bleData || [],
            wifiNetworks: [],
            rssiTimeseries: bleData || [],
            wifiRssiTimeseries: wifiData || [],
            latitude: physicalLocation.latitude,
            longitude: physicalLocation.longitude,
            accuracy: physicalLocation.accuracy,
            averageRssi: averageBleRssi,
            averageWifiRssi: averageWifiRssi,
            notes: physicalLocation.notes,
          };
        }
      }

      setLocationsData(locationsDataMap);

      // Calculate distances between locations
      const distances = calculateLocationDistances(locationsDataMap);
      setLocationDistances(distances);

      // Combine all device data
      const allDevices = Object.values(locationsDataMap).flatMap(
        (locationData) => locationData.devices
      );
      setDeviceData(allDevices);
    } catch (error) {
      console.error("Error comparing locations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate common and unique device sets
  const deviceSets = useMemo(() => {
    if (Object.keys(locationsData).length < 2 || selectedLocations.length < 2) {
      return { common: new Set<string>(), uniqueByLocation: {} };
    }

    // Get all device IDs from each location
    const deviceIdsByLocation: Record<string, Set<string>> = {};
    Object.entries(locationsData).forEach(([locationName, data]) => {
      deviceIdsByLocation[locationName] = data.uniqueDeviceIds;
    });

    // Make sure the first selected location exists in our data
    if (!deviceIdsByLocation[selectedLocations[0]]) {
      return { common: new Set<string>(), uniqueByLocation: {} };
    }

    // Calculate common devices (intersection of all sets)
    let commonDevices: Set<string> = new Set([...deviceIdsByLocation[selectedLocations[0]]]);

    for (let i = 1; i < selectedLocations.length; i++) {
      // Skip if this location doesn't exist in our data
      if (!deviceIdsByLocation[selectedLocations[i]]) continue;

      const locationDevices = deviceIdsByLocation[selectedLocations[i]];
      commonDevices = new Set(
        [...commonDevices].filter((deviceId) => locationDevices.has(deviceId))
      );
    }

    // Calculate unique devices per location
    const uniqueByLocation: Record<string, Set<string>> = {};
    Object.entries(deviceIdsByLocation).forEach(([locationName, deviceIds]) => {
      const uniqueDevices = new Set<string>();
      deviceIds.forEach((deviceId) => {
        // A device is unique to this location if it's not in any other location
        const isUnique = Object.entries(deviceIdsByLocation)
          .filter(([otherLocation]) => otherLocation !== locationName)
          .every(([_, otherDeviceIds]) => !otherDeviceIds.has(deviceId));

        if (isUnique) {
          uniqueDevices.add(deviceId);
        }
      });
      uniqueByLocation[locationName] = uniqueDevices;
    });

    return { common: commonDevices, uniqueByLocation };
  }, [locationsData, selectedLocations]);

  // Get the devices to display based on the compare mode
  const devicesToDisplay = useMemo(() => {
    if (compareMode === "all") {
      return [
        ...new Set(Object.values(locationsData).flatMap((data) => [...data.uniqueDeviceIds])),
      ];
    } else if (compareMode === "common") {
      return [...deviceSets.common];
    } else if (compareMode === "unique") {
      return [
        ...new Set(
          Object.values(deviceSets.uniqueByLocation || {}).flatMap((devices) => [...devices])
        ),
      ];
    }
    return [];
  }, [compareMode, locationsData, deviceSets]);

  // Get device data for a location - modified to handle both session and location modes
  const getDeviceLatestData = (deviceId: string, locationId: string) => {
    if (!locationsData[locationId]) return null;

    const locationDevices = locationsData[locationId].devices;
    // Sort devices by timestamp to ensure we get the latest reading
    const deviceReadings = locationDevices
      .filter((device) => device.device_id === deviceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return deviceReadings.length > 0 ? deviceReadings[0] : null;
  };

  // Sort function for device data
  const handleSortData = (deviceId: string, sessionA: string, sessionB: string) => {
    if (!sortBy || sortBy !== sessionA) return 0;

    const deviceDataA = getDeviceLatestData(deviceId, sessionA);
    const deviceDataB = getDeviceLatestData(deviceId, sessionB);

    if (!deviceDataA && !deviceDataB) return 0;
    if (!deviceDataA) return sortOrder === "ascend" ? -1 : 1;
    if (!deviceDataB) return sortOrder === "ascend" ? 1 : -1;

    return sortOrder === "ascend"
      ? deviceDataA.rssi - deviceDataB.rssi
      : deviceDataB.rssi - deviceDataA.rssi;
  };

  // Filter location options based on date and search
  const filteredLocationOptions = useMemo(() => {
    let filtered = [...locationOptions];

    // Filter by date if specified
    if (dateFilter) {
      filtered = filtered.filter((option) => option.date === dateFilter);
    }

    // Filter by search query if provided
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (option) =>
          option.value.toLowerCase().includes(query) || option.date.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [locationOptions, dateFilter, searchQuery]);

  // Get unique dates from all sessions
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    locationOptions.forEach((option) => {
      if (option.date) {
        dates.add(option.date);
      }
    });
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [locationOptions]);

  // Add function to handle device row click
  const handleDeviceRowClick = async (deviceId: string) => {
    setLoadingDeviceData(true);

    // Build the device details object with data from all selected locations
    const deviceLocations: Record<string, ScannedDevice> = {};
    const timeseriesDataByLocation: Record<string, RssiTimeseries[]> = {};

    for (const locationId of selectedLocations) {
      if (!locationsData[locationId]) continue;

      // Get the latest device data for this location
      const deviceData = locationsData[locationId].devices.find((d) => d.device_id === deviceId);
      if (deviceData) {
        deviceLocations[locationId] = deviceData;
      }

      // Fetch time series data for this device and location
      try {
        const { data: timeseriesData, error } = await safeSupabaseOperation(() =>
          supabase
            .from("rssi_timeseries")
            .select("*")
            .eq("device_id", deviceId)
            .eq("session_id", locationId)
            .order("timestamp", { ascending: true })
        );

        if (!error && timeseriesData && timeseriesData.length > 0) {
          timeseriesDataByLocation[locationId] = timeseriesData;
        }
      } catch (err) {
        console.error(`Error fetching timeseries data for ${deviceId} in ${locationId}:`, err);
      }
    }

    setSelectedDeviceDetails({
      deviceId,
      locations: deviceLocations,
    });

    setDeviceTimeseriesData(timeseriesDataByLocation);
    setIsDeviceModalVisible(true);
    setLoadingDeviceData(false);
  };

  // Modify columns to make them clickable
  const columns = [
    {
      title: "Device ID",
      dataIndex: "deviceId",
      key: "deviceId",
      render: (deviceId: string) => (
        <span
          className="font-mono text-xs text-blue-600 cursor-pointer hover:underline"
          onClick={() => handleDeviceRowClick(deviceId)}
        >
          {deviceId}
        </span>
      ),
    },
    ...selectedLocations.map((sessionId) => ({
      title: () => (
        <div>
          <Text strong>{sessionId}</Text>
          {deviceSets.uniqueByLocation[sessionId] && (
            <Badge
              count={deviceSets.uniqueByLocation[sessionId].size}
              style={{ backgroundColor: "#52c41a", marginLeft: 8 }}
              overflowCount={999}
            />
          )}
        </div>
      ),
      key: sessionId,
      sorter: (a: { deviceId: string }, b: { deviceId: string }) => {
        const deviceA = getDeviceLatestData(a.deviceId, sessionId);
        const deviceB = getDeviceLatestData(b.deviceId, sessionId);

        if (!deviceA && !deviceB) return 0;
        if (!deviceA) return 1;
        if (!deviceB) return -1;

        return deviceA.rssi - deviceB.rssi;
      },
      sortDirections: ["ascend", "descend"] as SortOrder[],
      onHeaderCell: () => ({
        onClick: () => {
          if (sortBy === sessionId) {
            setSortOrder(sortOrder === "ascend" ? "descend" : "ascend");
          } else {
            setSortBy(sessionId);
            setSortOrder("ascend");
          }
        },
      }),
      render: (_: any, record: DeviceDisplay) => {
        const deviceData = getDeviceLatestData(record.deviceId, sessionId);
        if (!deviceData) {
          return (
            <Tag color="default" className="opacity-50">
              N/A
            </Tag>
          );
        }

        // Get signal color based on RSSI
        let color = "red";
        if (deviceData.rssi > -70) color = "green";
        else if (deviceData.rssi > -85) color = "orange";

        // Count data points for this device in this session
        const dataPointCount =
          locationsData[sessionId]?.devices.filter((d) => d.device_id === record.deviceId).length ||
          0;

        return (
          <Space direction="vertical" size="small" className="w-full">
            <Tag color={color}>{deviceData.rssi} dBm</Tag>
            <Text type="secondary" className="text-xs">
              {new Date(deviceData.timestamp).toLocaleString()}
            </Text>
            {dataPointCount > 1 && (
              <Tooltip title="Number of 0.5-second interval measurements">
                <Badge count={dataPointCount} overflowCount={999} size="small" />
              </Tooltip>
            )}
            {deviceData.sequence_number !== undefined && (
              <Tag color="blue" className="text-xs">
                Seq: {deviceData.sequence_number}
              </Tag>
            )}
          </Space>
        );
      },
    })),
  ];

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Compare Scan Results</h1>

      <div className="flex mb-6">
        <div className="flex items-center space-x-4">
          <Select
            value={comparisonType}
            onChange={setComparisonType}
            options={[
              { label: "Compare by Session", value: "session" },
              { label: "Compare by Location", value: "location" },
            ]}
            style={{ width: 180 }}
          />

          <Select
            value={dataType}
            onChange={setDataType}
            options={[
              { label: "BLE & WiFi", value: "both" },
              { label: "BLE Only", value: "ble" },
              { label: "WiFi Only", value: "wifi" },
            ]}
            style={{ width: 150 }}
          />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Comparison Settings</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Text>Compare by:</Text>
                <Select
                  value={comparisonType}
                  onChange={(value) => {
                    setComparisonType(value);
                    setSelectedLocations([]);
                    setLocationsData({});
                  }}
                  options={[
                    { label: "Session", value: "session" },
                    { label: "Physical Location", value: "location" },
                  ]}
                  style={{ width: 160 }}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Text>Data type:</Text>
                <Select
                  value={dataType}
                  onChange={setDataType}
                  options={[
                    { label: "Both BLE & WiFi", value: "both" },
                    { label: "BLE only", value: "ble" },
                    { label: "WiFi only", value: "wifi" },
                  ]}
                  style={{ width: 160 }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-2">
                <Text strong>
                  Select {comparisonType === "session" ? "Sessions" : "Locations"} (2-3)
                </Text>
              </div>

              {comparisonType === "session" && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <Select
                    placeholder="Filter by date"
                    style={{ width: 160 }}
                    allowClear
                    onChange={setDateFilter}
                    value={dateFilter}
                    options={availableDates.map((date) => ({ label: date, value: date }))}
                  />
                  <input
                    type="text"
                    placeholder="Search sessions..."
                    className="px-3 py-1 border border-gray-300 rounded-md"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              <Alert
                type="info"
                message={
                  <>
                    <p>
                      {comparisonType === "session"
                        ? `${filteredLocationOptions.length} sessions available.`
                        : `${locationOptions.length} physical locations available.`}
                      {locationOptions.length === 0 && " Please adjust your filters."}
                    </p>
                  </>
                }
                className="mb-2"
                showIcon
              />

              <Select
                mode="multiple"
                allowClear
                style={{ width: "100%" }}
                placeholder={`Select ${
                  comparisonType === "session" ? "session IDs" : "locations"
                } to compare`}
                value={selectedLocations}
                onChange={setSelectedLocations}
                options={comparisonType === "session" ? filteredLocationOptions : locationOptions}
                optionLabelProp="value"
                loading={isLoading}
                maxTagCount={3}
                disabled={isLoading}
                maxTagTextLength={12}
                className="mb-2"
                showSearch
                filterOption={false} // We're using our own filtering
                notFoundContent={
                  isLoading ? (
                    <Spin size="small" />
                  ) : (
                    `No ${comparisonType === "session" ? "sessions" : "locations"} found`
                  )
                }
              />

              <div className="flex flex-wrap mt-4 gap-2">
                {selectedLocations.map((location) => {
                  const option = locationOptions.find((opt) => opt.value === location);
                  return option ? (
                    <Tag
                      key={location}
                      color="blue"
                      closable
                      onClose={() => {
                        setSelectedLocations(selectedLocations.filter((l) => l !== location));
                      }}
                    >
                      <Tooltip title={location}>
                        {comparisonType === "session"
                          ? `${location.substring(0, 8)}... (${option.deviceCount})`
                          : option.label}
                      </Tooltip>
                    </Tag>
                  ) : null;
                })}
              </div>
            </div>

            <div>
              <div className="mb-2">
                <Text strong>Comparison Mode</Text>
              </div>
              <Select
                style={{ width: "100%" }}
                value={compareMode}
                onChange={setCompareMode}
                options={[
                  { label: "All Devices", value: "all" },
                  { label: "Common Devices Only", value: "common" },
                  { label: "Unique Devices Only", value: "unique" },
                ]}
                disabled={isLoading}
              />

              <div className="mt-8">
                <Text strong>
                  {comparisonType === "session" ? "Session" : "Location"} Information
                </Text>
                {selectedLocations.length > 0 ? (
                  <ul className="mt-2 text-sm">
                    {selectedLocations.map((location) => {
                      const option = locationOptions.find((opt) => opt.value === location);
                      if (!option) return null;

                      return comparisonType === "session" ? (
                        <li key={location} className="mb-2 p-2 border border-gray-200 rounded-md">
                          <div>
                            <strong>ID:</strong> {location}
                          </div>
                          <div>
                            <strong>Date:</strong> {option.date}
                          </div>
                          <div>
                            <strong>Duration:</strong> {option.duration}
                          </div>
                          <div>
                            <strong>Devices:</strong> {option.deviceCount}
                          </div>
                        </li>
                      ) : (
                        <li key={location} className="mb-2 p-2 border border-gray-200 rounded-md">
                          <div>
                            <strong>Name:</strong> {location}
                          </div>
                          {physicalLocations.find((loc) => loc.id === location) && (
                            <>
                              <div>
                                <strong>Coordinates:</strong>{" "}
                                {physicalLocations
                                  .find((loc) => loc.id === location)
                                  ?.latitude.toFixed(6)}
                                ,
                                {physicalLocations
                                  .find((loc) => loc.id === location)
                                  ?.longitude.toFixed(6)}
                              </div>
                              <div>
                                <strong>Sessions:</strong>{" "}
                                {
                                  physicalLocations.find((loc) => loc.id === location)?.sessions
                                    .length
                                }
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="text-gray-500 mt-2">
                    No {comparisonType === "session" ? "sessions" : "locations"} selected
                  </div>
                )}
              </div>

              <div className="mt-4 text-right">
                <Button
                  color="primary"
                  onPress={handleCompare}
                  disabled={selectedLocations.length < 2 || isLoading}
                  isLoading={isLoading}
                  startContent={
                    <div className="flex items-center">
                      <WifiOutlined style={{ marginRight: "4px" }} />
                    </div>
                  }
                >
                  Compare {comparisonType === "session" ? "Sessions" : "Locations"}
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <Spin size="large" className="mb-4" />
            <Text className="mt-3">Loading location data...</Text>
          </div>
        </div>
      ) : Object.keys(locationsData).length > 0 ? (
        <div className="mt-8">
          <Card className="mb-6">
            <CardHeader>
              <Title level={4} className="m-0">
                Comparison Results
              </Title>
            </CardHeader>
            <CardBody>
              <Alert
                type="info"
                message="RSSI Timeseries Data"
                description={
                  <div>
                    <p>
                      The data now shows BLE signal strength readings recorded every 0.5 seconds.
                      Each device may have multiple readings per session.
                    </p>
                    <ul className="list-disc ml-6 mt-2">
                      <li>
                        The badge <Badge count={5} size="small" /> shows how many readings are
                        available for each device
                      </li>
                      <li>
                        The <Tag color="blue">Seq: 1</Tag> tag shows the sequence number of the
                        reading
                      </li>
                      <li>
                        For multi-sequence data, the most recent reading is displayed by default
                      </li>
                    </ul>
                  </div>
                }
                className="mb-4"
                showIcon
              />

              <Tabs defaultActiveKey="devices">
                <TabPane
                  tab={
                    <span>
                      <InfoCircleOutlined /> Devices{" "}
                      <Badge
                        count={devicesToDisplay.length}
                        style={{ backgroundColor: "#1677ff" }}
                        overflowCount={999}
                      />
                    </span>
                  }
                  key="devices"
                >
                  {devicesToDisplay.length > 0 ? (
                    <Table
                      dataSource={devicesToDisplay.map((deviceId) => ({ deviceId }))}
                      columns={columns}
                      rowKey="deviceId"
                      pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50", "100"],
                      }}
                      scroll={{ x: "max-content" }}
                      size="middle"
                      bordered
                      onRow={(record) => ({
                        onClick: () => handleDeviceRowClick(record.deviceId),
                        style: { cursor: "pointer" },
                      })}
                    />
                  ) : (
                    <Empty description="No devices match the selected criteria" />
                  )}
                </TabPane>
                <TabPane
                  tab={
                    <span>
                      <BarChartOutlined /> Sessions{" "}
                      <Badge
                        count={selectedLocations.length}
                        style={{ backgroundColor: "#52c41a" }}
                      />
                    </span>
                  }
                  key="locations"
                >
                  {selectedLocations.map((locationId) => {
                    const locationData = locationsData[locationId];
                    if (!locationData) return null;

                    return (
                      <div key={locationId} className="mb-6">
                        <SessionAnalysis sessionData={locationData} dataType={dataType} />
                        <div className="my-8 text-center">
                          <h4 className="text-base font-medium text-gray-700 my-3">
                            Location Data
                          </h4>
                          <hr className="border-t border-gray-200" />
                        </div>
                      </div>
                    );
                  })}

                  {locationDistances.length > 0 && (
                    <div>
                      <Title level={4}>Session Comparison</Title>
                      <Table
                        dataSource={locationDistances}
                        columns={[
                          {
                            title: "Sessions",
                            key: "locations",
                            render: (_, record) => (
                              <Space>
                                <Tag color="blue">{record.location1.replace("Session: ", "")}</Tag>
                                <ArrowsAltOutlined />
                                <Tag color="green">{record.location2.replace("Session: ", "")}</Tag>
                              </Space>
                            ),
                          },
                          {
                            title: "Distance",
                            dataIndex: "distanceMeters",
                            key: "distance",
                            render: (distance) =>
                              distance ? `${(distance / 1000).toFixed(2)} km` : "Unknown",
                          },
                          {
                            title: "Shared Devices",
                            key: "shared",
                            render: (_, record) => (
                              <div>
                                <div>BLE: {record.sharedDevices}</div>
                                <div>WiFi: {record.sharedNetworks}</div>
                              </div>
                            ),
                          },
                          {
                            title: "Overlap %",
                            dataIndex: "sharedPercentage",
                            key: "overlap",
                            render: (percentage) => (
                              <div className="w-full">
                                <Progress
                                  percent={Math.round(percentage)}
                                  size="small"
                                  format={(percent) => `${percent}%`}
                                />
                              </div>
                            ),
                          },
                          {
                            title: "Signal Diff",
                            key: "rssiDiff",
                            render: (_, record) => (
                              <div>
                                <Tag
                                  color={
                                    record.bleRssiDifference < 5
                                      ? "green"
                                      : record.bleRssiDifference < 10
                                      ? "orange"
                                      : "red"
                                  }
                                >
                                  BLE: {record.bleRssiDifference.toFixed(1)} dBm
                                </Tag>
                                <div className="mt-1">
                                  <Tag
                                    color={
                                      record.wifiRssiDifference < 5
                                        ? "green"
                                        : record.wifiRssiDifference < 10
                                        ? "orange"
                                        : "red"
                                    }
                                  >
                                    WiFi: {record.wifiRssiDifference.toFixed(1)} dBm
                                  </Tag>
                                </div>
                              </div>
                            ),
                          },
                        ]}
                        pagination={false}
                        size="small"
                      />
                    </div>
                  )}
                </TabPane>
              </Tabs>
            </CardBody>
          </Card>
        </div>
      ) : (
        <Empty
          className="my-16"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Select 2-3 sessions and click 'Compare Sessions' to see analysis results"
        />
      )}

      {/* Device Details Modal */}
      <Modal
        title={
          <div>
            <h3 className="text-lg font-semibold">Device Details</h3>
            <p className="text-xs font-mono mt-1">{selectedDeviceDetails?.deviceId}</p>
          </div>
        }
        open={isDeviceModalVisible}
        onCancel={() => setIsDeviceModalVisible(false)}
        width={800}
        footer={[
          <AntButton key="close" onClick={() => setIsDeviceModalVisible(false)}>
            Close
          </AntButton>,
        ]}
      >
        {loadingDeviceData ? (
          <div className="flex items-center justify-center h-[300px]">
            <Spin size="large" tip="Loading device data..." />
          </div>
        ) : selectedDeviceDetails ? (
          <div>
            <div className="mb-4">
              <Tabs defaultActiveKey="comparison">
                <TabPane
                  tab={
                    <span>
                      <CompressOutlined /> Compare Across Locations
                    </span>
                  }
                  key="comparison"
                >
                  <Table
                    dataSource={Object.entries(selectedDeviceDetails.locations).map(
                      ([locationId, device]) => ({
                        key: locationId,
                        locationId,
                        locationName: locationsData[locationId]?.name || locationId,
                        rssi: device.rssi,
                        timestamp: device.timestamp,
                        readingsCount: deviceTimeseriesData[locationId]?.length || 0,
                      })
                    )}
                    columns={[
                      {
                        title: "Location",
                        dataIndex: "locationName",
                        key: "locationName",
                        render: (text) => <Tag color="blue">{text}</Tag>,
                      },
                      {
                        title: "RSSI",
                        dataIndex: "rssi",
                        key: "rssi",
                        render: (rssi: number) => {
                          let color = "red";
                          if (rssi > -70) color = "green";
                          else if (rssi > -90) color = "orange";
                          return <Tag color={color}>{rssi} dBm</Tag>;
                        },
                        sorter: (a: any, b: any) => a.rssi - b.rssi,
                      },
                      {
                        title: "Last Detected",
                        dataIndex: "timestamp",
                        key: "timestamp",
                        render: (text: string) => {
                          try {
                            const date = new Date(text);
                            return date.toLocaleString();
                          } catch (e) {
                            return text;
                          }
                        },
                      },
                      {
                        title: "Readings",
                        dataIndex: "readingsCount",
                        key: "readingsCount",
                        render: (count: number) => (
                          <Badge
                            count={count}
                            overflowCount={999}
                            style={{ backgroundColor: count > 0 ? "#1677ff" : "#d9d9d9" }}
                          />
                        ),
                      },
                    ]}
                    pagination={false}
                    size="small"
                  />
                </TabPane>
                <TabPane
                  tab={
                    <span>
                      <LineChartOutlined /> Signal Trends
                    </span>
                  }
                  key="timeseries"
                >
                  <div>
                    {Object.keys(deviceTimeseriesData).length > 0 ? (
                      <div>
                        {Object.entries(deviceTimeseriesData).map(
                          ([locationId, data]) =>
                            data.length > 0 && (
                              <div key={locationId} className="mb-6">
                                <div className="text-sm font-medium mb-2">
                                  {locationsData[locationId]?.name || locationId}
                                </div>
                                <LineChartComponent
                                  title={`RSSI Time Series (${data.length} readings)`}
                                  data={{
                                    labels: data.map((item) => {
                                      const date = new Date(item.timestamp);
                                      return `${String(date.getHours()).padStart(2, "0")}:${String(
                                        date.getMinutes()
                                      ).padStart(2, "0")}:${String(date.getSeconds()).padStart(
                                        2,
                                        "0"
                                      )}`;
                                    }),
                                    datasets: [
                                      {
                                        label: "RSSI (dBm)",
                                        data: data.map((item) => item.rssi),
                                        borderColor: "rgb(75, 192, 192)",
                                        backgroundColor: "rgba(75, 192, 192, 0.5)",
                                      },
                                    ],
                                  }}
                                  height={200}
                                />
                              </div>
                            )
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[300px]">
                        <Empty description="No time series data available for this device in these locations" />
                      </div>
                    )}
                  </div>
                </TabPane>
              </Tabs>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px]">
            <Empty description="No device details available" />
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
