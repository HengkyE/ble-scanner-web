"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardBody, CardHeader, Button, Spinner, Input, Chip, Divider } from "@heroui/react";
import {
  Tabs,
  Typography,
  DatePicker,
  Slider,
  Switch,
  Space,
  Tag,
  Statistic,
  Row,
  Col,
  Alert,
  Empty,
  Progress,
  Select,
} from "antd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import {
  ClockIcon,
  SignalIcon,
  DevicePhoneMobileIcon,
  MapPinIcon,
  ChartBarIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import DashboardLayout from "@/components/DashboardLayout";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import MultiDeviceComparativeChart from "@/components/MultiDeviceComparativeChart";
import SignalStrengthHistogram from "@/components/SignalStrengthHistogram";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface CrowdAnalysisData {
  timestamp: string;
  totalDevices: number;
  newDevices: number;
  departedDevices: number;
  avgRssi: number;
  deviceCount: number;
  uniqueDeviceIds: string[];
  rssiValues: number[];
  location?: string;
  sessionId?: string;
}

interface DeviceTimelineData {
  deviceId: string;
  deviceName?: string;
  firstSeen: string;
  lastSeen: string;
  duration: number;
  avgRssi: number;
  maxRssi: number;
  minRssi: number;
  measurementCount: number;
  signalStability: number;
}

interface LocationCrowdData {
  locationName: string;
  deviceCount: number;
  avgRssi: number;
  peakTime: string;
  peakDeviceCount: number;
  totalMeasurements: number;
}

export default function CrowdAnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [crowdData, setCrowdData] = useState<CrowdAnalysisData[]>([]);
  const [deviceTimelineData, setDeviceTimelineData] = useState<DeviceTimelineData[]>([]);
  const [locationCrowdData, setLocationCrowdData] = useState<LocationCrowdData[]>([]);
  const [rssiDistributionData, setRssiDistributionData] = useState<number[]>([]);

  // Filter states
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<[string, string] | null>(null);
  const [rssiThreshold, setRssiThreshold] = useState<number>(-90);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  // Available options
  const [locations, setLocations] = useState<string[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [devices, setDevices] = useState<string[]>([]);

  // Fetch data
  useEffect(() => {
    fetchCrowdAnalysisData();
  }, [selectedLocation, selectedSession, timeRange, rssiThreshold]);

  const fetchCrowdAnalysisData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch RSSI timeseries data for crowd analysis
      let query = supabase
        .from("rssi_timeseries")
        .select(
          `
          *,
          scanned_device!inner(
            device_name,
            location_name,
            session_id
          )
        `
        )
        .order("timestamp", { ascending: true });

      // Apply filters
      if (selectedLocation !== "all") {
        query = query.eq("scanned_device.location_name", selectedLocation);
      }
      if (selectedSession !== "all") {
        query = query.eq("scanned_device.session_id", selectedSession);
      }
      if (rssiThreshold) {
        query = query.gte("rssi", rssiThreshold);
      }

      const { data: timeseriesData, error: timeseriesError } = await query;

      if (timeseriesError) {
        throw timeseriesError;
      }

      // Process crowd analysis data
      if (timeseriesData) {
        processCrowdData(timeseriesData);
        processDeviceTimelineData(timeseriesData);
        processLocationCrowdData(timeseriesData);
        processRssiDistribution(timeseriesData);
      }

      // Fetch available options
      await fetchFilterOptions();
    } catch (err) {
      console.error("Error fetching crowd analysis data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      // Fetch locations
      const { data: locationData } = await supabase
        .from("scanned_device")
        .select("location_name")
        .not("location_name", "is", null);

      if (locationData) {
        const uniqueLocations = [...new Set(locationData.map((d: any) => d.location_name))];
        setLocations(uniqueLocations as string[]);
      }

      // Fetch sessions
      const { data: sessionData } = await supabase
        .from("scanned_device")
        .select("session_id")
        .not("session_id", "is", null);

      if (sessionData) {
        const uniqueSessions = [...new Set(sessionData.map((d: any) => d.session_id))];
        setSessions(uniqueSessions as string[]);
      }

      // Fetch devices
      const { data: deviceData } = await supabase
        .from("scanned_device")
        .select("device_id, device_name")
        .not("device_id", "is", null);

      if (deviceData) {
        const uniqueDevices = [...new Set(deviceData.map((d: any) => d.device_id))];
        setDevices(uniqueDevices as string[]);
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  const processCrowdData = (data: any[]) => {
    // Group data by time intervals (e.g., every 30 seconds)
    const timeInterval = 30000; // 30 seconds in milliseconds
    const groupedData = new Map<number, any[]>();

    data.forEach((record) => {
      const timestamp = new Date(record.timestamp).getTime();
      const intervalKey = Math.floor(timestamp / timeInterval) * timeInterval;

      if (!groupedData.has(intervalKey)) {
        groupedData.set(intervalKey, []);
      }
      groupedData.get(intervalKey)!.push(record);
    });

    // Process each time interval
    const crowdAnalysis: CrowdAnalysisData[] = [];
    let previousDeviceIds = new Set<string>();

    Array.from(groupedData.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([intervalKey, records]) => {
        const currentDeviceIds = new Set(records.map((r) => r.device_id));
        const rssiValues = records.map((r) => r.rssi);

        const newDevices = [...currentDeviceIds].filter((id) => !previousDeviceIds.has(id));
        const departedDevices = [...previousDeviceIds].filter((id) => !currentDeviceIds.has(id));

        crowdAnalysis.push({
          timestamp: new Date(intervalKey).toISOString(),
          totalDevices: currentDeviceIds.size,
          newDevices: newDevices.length,
          departedDevices: departedDevices.length,
          avgRssi: rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length,
          deviceCount: records.length,
          uniqueDeviceIds: [...currentDeviceIds],
          rssiValues,
          location: records[0]?.scanned_device?.location_name,
          sessionId: records[0]?.scanned_device?.session_id,
        });

        previousDeviceIds = currentDeviceIds;
      });

    setCrowdData(crowdAnalysis);
  };

  const processDeviceTimelineData = (data: any[]) => {
    const deviceMap = new Map<string, any[]>();

    // Group by device
    data.forEach((record) => {
      const deviceId = record.device_id;
      if (!deviceMap.has(deviceId)) {
        deviceMap.set(deviceId, []);
      }
      deviceMap.get(deviceId)!.push(record);
    });

    // Process each device
    const timelineData: DeviceTimelineData[] = [];
    deviceMap.forEach((records, deviceId) => {
      const timestamps = records.map((r) => new Date(r.timestamp).getTime());
      const rssiValues = records.map((r) => r.rssi);

      const firstSeen = new Date(Math.min(...timestamps));
      const lastSeen = new Date(Math.max(...timestamps));
      const duration = lastSeen.getTime() - firstSeen.getTime();

      const avgRssi = rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length;
      const maxRssi = Math.max(...rssiValues);
      const minRssi = Math.min(...rssiValues);

      // Calculate signal stability (lower standard deviation = more stable)
      const variance =
        rssiValues.reduce((acc, val) => acc + Math.pow(val - avgRssi, 2), 0) / rssiValues.length;
      const signalStability = Math.sqrt(variance);

      timelineData.push({
        deviceId,
        deviceName: records[0]?.scanned_device?.device_name || deviceId,
        firstSeen: firstSeen.toISOString(),
        lastSeen: lastSeen.toISOString(),
        duration,
        avgRssi,
        maxRssi,
        minRssi,
        measurementCount: records.length,
        signalStability,
      });
    });

    // Sort by duration (longest presence first)
    timelineData.sort((a, b) => b.duration - a.duration);
    setDeviceTimelineData(timelineData);
  };

  const processLocationCrowdData = (data: any[]) => {
    const locationMap = new Map<string, any[]>();

    // Group by location
    data.forEach((record) => {
      const location = record.scanned_device?.location_name || "Unknown";
      if (!locationMap.has(location)) {
        locationMap.set(location, []);
      }
      locationMap.get(location)!.push(record);
    });

    // Process each location
    const locationData: LocationCrowdData[] = [];
    locationMap.forEach((records, locationName) => {
      const deviceIds = new Set(records.map((r) => r.device_id));
      const rssiValues = records.map((r) => r.rssi);
      const avgRssi = rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length;

      // Find peak time (time with most devices)
      const timeGroups = new Map<string, Set<string>>();
      records.forEach((record) => {
        const hour = new Date(record.timestamp).getHours();
        const timeKey = `${hour}:00`;
        if (!timeGroups.has(timeKey)) {
          timeGroups.set(timeKey, new Set());
        }
        timeGroups.get(timeKey)!.add(record.device_id);
      });

      let peakTime = "N/A";
      let peakDeviceCount = 0;
      timeGroups.forEach((devices, time) => {
        if (devices.size > peakDeviceCount) {
          peakDeviceCount = devices.size;
          peakTime = time;
        }
      });

      locationData.push({
        locationName,
        deviceCount: deviceIds.size,
        avgRssi,
        peakTime,
        peakDeviceCount,
        totalMeasurements: records.length,
      });
    });

    setLocationCrowdData(locationData);
  };

  const processRssiDistribution = (data: any[]) => {
    const rssiValues = data.map((record) => record.rssi);
    setRssiDistributionData(rssiValues);
  };

  // Chart data preparation
  const crowdTimelineChartData = useMemo(() => {
    return crowdData.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      totalDevices: item.totalDevices,
      newDevices: item.newDevices,
      departedDevices: item.departedDevices,
      avgRssi: Math.abs(item.avgRssi),
    }));
  }, [crowdData]);

  const devicePresenceChartData = useMemo(() => {
    return deviceTimelineData.slice(0, 10).map((device) => ({
      deviceName:
        device.deviceName && device.deviceName.length > 15
          ? device.deviceName.substring(0, 15) + "..."
          : device.deviceName || device.deviceId,
      duration: Math.round(device.duration / 60000), // Convert to minutes
      avgRssi: Math.abs(device.avgRssi),
      measurementCount: device.measurementCount,
    }));
  }, [deviceTimelineData]);

  // Get signal strength color
  const getRssiColor = (rssi: number) => {
    if (rssi > -70) return "#4ade80"; // green
    if (rssi > -85) return "#fbbf24"; // yellow
    return "#ef4444"; // red
  };

  const formatDuration = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <Alert message="Error Loading Data" description={error} type="error" showIcon />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2 text-gray-900">Crowd Analysis</h1>
          <p className="text-gray-600">
            Analyze BLE device density, movement patterns, and crowd dynamics over time
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5" />
              <span className="font-semibold">Analysis Filters</span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <Select
                  style={{ width: "100%" }}
                  placeholder="Select location"
                  value={selectedLocation}
                  onChange={(value: string) => setSelectedLocation(value)}
                >
                  <Option value="all">All Locations</Option>
                  {locations.map((location) => (
                    <Option key={location} value={location}>
                      {location}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Session</label>
                <Select
                  style={{ width: "100%" }}
                  placeholder="Select session"
                  value={selectedSession}
                  onChange={(value: string) => setSelectedSession(value)}
                >
                  <Option value="all">All Sessions</Option>
                  {sessions.map((session) => (
                    <Option key={session} value={session}>
                      {session}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  RSSI Threshold: {rssiThreshold} dBm
                </label>
                <Slider
                  min={-100}
                  max={-30}
                  value={rssiThreshold}
                  onChange={(value) => setRssiThreshold(value as number)}
                  marks={{
                    [-100]: "-100",
                    [-85]: "-85",
                    [-70]: "-70",
                    [-30]: "-30",
                  }}
                />
              </div>

              <div className="flex items-center gap-4">
                <Switch checked={showHeatmap} onChange={setShowHeatmap} />
                <span className="text-sm">Heatmap View</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Summary Statistics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <CardBody className="text-center">
                <UsersIcon className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <Statistic
                  title="Total Unique Devices"
                  value={deviceTimelineData.length}
                  valueStyle={{ color: "#1890ff" }}
                />
              </CardBody>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <CardBody className="text-center">
                <MapPinIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <Statistic
                  title="Locations Analyzed"
                  value={locationCrowdData.length}
                  valueStyle={{ color: "#52c41a" }}
                />
              </CardBody>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <CardBody className="text-center">
                <SignalIcon className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                <Statistic
                  title="Avg Signal Strength"
                  value={Math.round(
                    crowdData.reduce((acc, item) => acc + Math.abs(item.avgRssi), 0) /
                      (crowdData.length || 1)
                  )}
                  suffix="dBm"
                  valueStyle={{ color: "#fa8c16" }}
                />
              </CardBody>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <CardBody className="text-center">
                <ClockIcon className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <Statistic
                  title="Peak Crowd Size"
                  value={Math.max(...crowdData.map((item) => item.totalDevices), 0)}
                  valueStyle={{ color: "#722ed1" }}
                />
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Main Analysis Tabs */}
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Crowd Timeline" key="timeline">
            <div className="space-y-6">
              {/* Multi-Device Comparative Chart */}
              <Card>
                <CardHeader>
                  <Title level={4}>Multi-Device Comparative Chart View</Title>
                  <Text type="secondary">
                    Device signal strength changes over time (0.5-second intervals)
                  </Text>
                </CardHeader>
                <CardBody>
                  {crowdData.length > 0 ? (
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={crowdTimelineChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis yAxisId="devices" orientation="left" />
                          <YAxis yAxisId="rssi" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Line
                            yAxisId="devices"
                            type="monotone"
                            dataKey="totalDevices"
                            stroke="#8884d8"
                            strokeWidth={2}
                            name="Total Devices"
                          />
                          <Line
                            yAxisId="devices"
                            type="monotone"
                            dataKey="newDevices"
                            stroke="#82ca9d"
                            strokeWidth={2}
                            name="New Devices"
                          />
                          <Line
                            yAxisId="devices"
                            type="monotone"
                            dataKey="departedDevices"
                            stroke="#ffc658"
                            strokeWidth={2}
                            name="Departed Devices"
                          />
                          <Line
                            yAxisId="rssi"
                            type="monotone"
                            dataKey="avgRssi"
                            stroke="#ff7300"
                            strokeWidth={2}
                            name="Avg RSSI (dBm)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty description="No crowd timeline data available" />
                  )}
                </CardBody>
              </Card>

              {/* RSSI Count Chart with Timeline Panel */}
              <Card>
                <CardHeader>
                  <Title level={4}>RSSI Count Chart with Timeline Panel</Title>
                  <Text type="secondary">Crowd density and signal strength over time</Text>
                </CardHeader>
                <CardBody>
                  {crowdData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={crowdTimelineChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="totalDevices"
                              stackId="1"
                              stroke="#8884d8"
                              fill="#8884d8"
                              fillOpacity={0.6}
                              name="Total Devices"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* RSSI Distribution */}
                      <div className="h-48">
                        <Title level={5}>RSSI Distribution</Title>
                        <SignalStrengthHistogram data={rssiDistributionData} />
                      </div>
                    </div>
                  ) : (
                    <Empty description="No RSSI timeline data available" />
                  )}
                </CardBody>
              </Card>
            </div>
          </TabPane>

          <TabPane tab="Device Analysis" key="devices">
            <div className="space-y-6">
              {/* Device Presence Duration */}
              <Card>
                <CardHeader>
                  <Title level={4}>Device Presence Analysis</Title>
                  <Text type="secondary">
                    Top devices by presence duration and signal characteristics
                  </Text>
                </CardHeader>
                <CardBody>
                  {devicePresenceChartData.length > 0 ? (
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={devicePresenceChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="deviceName" />
                          <YAxis yAxisId="duration" orientation="left" />
                          <YAxis yAxisId="rssi" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Bar
                            yAxisId="duration"
                            dataKey="duration"
                            fill="#8884d8"
                            name="Duration (minutes)"
                          />
                          <Line
                            yAxisId="rssi"
                            type="monotone"
                            dataKey="avgRssi"
                            stroke="#ff7300"
                            strokeWidth={2}
                            name="Avg RSSI (dBm)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty description="No device presence data available" />
                  )}
                </CardBody>
              </Card>

              {/* Device Timeline Table */}
              <Card>
                <CardHeader>
                  <Title level={4}>Device Timeline Details</Title>
                </CardHeader>
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Device</th>
                          <th className="text-left p-2">First Seen</th>
                          <th className="text-left p-2">Last Seen</th>
                          <th className="text-left p-2">Duration</th>
                          <th className="text-left p-2">Avg RSSI</th>
                          <th className="text-left p-2">Signal Range</th>
                          <th className="text-left p-2">Measurements</th>
                          <th className="text-left p-2">Stability</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviceTimelineData.slice(0, 20).map((device, index) => (
                          <tr key={device.deviceId} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <div>
                                <div className="font-medium">{device.deviceName}</div>
                                <div className="text-xs text-gray-500">{device.deviceId}</div>
                              </div>
                            </td>
                            <td className="p-2 text-sm">
                              {new Date(device.firstSeen).toLocaleTimeString()}
                            </td>
                            <td className="p-2 text-sm">
                              {new Date(device.lastSeen).toLocaleTimeString()}
                            </td>
                            <td className="p-2">
                              <Chip size="sm" color="primary">
                                {formatDuration(device.duration)}
                              </Chip>
                            </td>
                            <td className="p-2">
                              <span style={{ color: getRssiColor(device.avgRssi) }}>
                                {Math.round(device.avgRssi)} dBm
                              </span>
                            </td>
                            <td className="p-2 text-sm">
                              {Math.round(device.minRssi)} to {Math.round(device.maxRssi)} dBm
                            </td>
                            <td className="p-2 text-sm">{device.measurementCount}</td>
                            <td className="p-2">
                              <Progress
                                percent={Math.max(0, 100 - device.signalStability * 10)}
                                size="small"
                                showInfo={false}
                                strokeColor={
                                  device.signalStability < 5
                                    ? "#52c41a"
                                    : device.signalStability < 10
                                    ? "#faad14"
                                    : "#f5222d"
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          </TabPane>

          <TabPane tab="Location Analysis" key="locations">
            <div className="space-y-6">
              {/* Location Crowd Summary */}
              <Row gutter={[16, 16]}>
                {locationCrowdData.map((location, index) => (
                  <Col xs={24} sm={12} md={8} key={index}>
                    <Card>
                      <CardHeader>
                        <Title level={5}>{location.locationName}</Title>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <Text>Unique Devices:</Text>
                            <Text strong>{location.deviceCount}</Text>
                          </div>
                          <div className="flex justify-between">
                            <Text>Avg Signal:</Text>
                            <Text strong style={{ color: getRssiColor(location.avgRssi) }}>
                              {Math.round(location.avgRssi)} dBm
                            </Text>
                          </div>
                          <div className="flex justify-between">
                            <Text>Peak Time:</Text>
                            <Text strong>{location.peakTime}</Text>
                          </div>
                          <div className="flex justify-between">
                            <Text>Peak Devices:</Text>
                            <Text strong>{location.peakDeviceCount}</Text>
                          </div>
                          <div className="flex justify-between">
                            <Text>Total Readings:</Text>
                            <Text strong>{location.totalMeasurements}</Text>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </TabPane>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
