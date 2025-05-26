"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Typography,
  Spin,
  Select,
  Card,
  Table,
  Tabs,
  Alert,
  DatePicker,
  Space,
  Button,
  Tooltip,
  Statistic,
  Divider,
  Badge,
  Tag,
  Row,
  Col,
} from "antd";
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import { format, parseISO, differenceInSeconds, differenceInMinutes } from "date-fns";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import LineChartComponent from "@/components/LineChart";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

interface LocationData {
  id: number;
  location_name: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  notes: string | null;
  scan_start_time: string;
  scan_duration_seconds: number;
  scan_count: number;
  created_at: string;
}

interface DevicePresenceData {
  device_id: string;
  device_name: string | null;
  first_seen: string;
  last_seen: string;
  total_appearances: number;
  rssi_min: number;
  rssi_max: number;
  rssi_avg: number;
  presence_duration: number; // in seconds
}

interface CrowdSnapshot {
  timestamp: string;
  total_devices: number;
  new_devices: number;
  departed_devices: number;
  average_rssi: number;
}

interface RssiDistribution {
  rssiRange: string;
  count: number;
  minRssi: number;
  maxRssi: number;
}

interface DeviceSignalOverTime {
  deviceId: string;
  deviceName: string | null;
  timePoints: string[];
  rssiValues: number[];
  color: string;
  sequenceNumbers: number[];
}

interface RssiTimeSeriesData {
  device_id: string;
  timestamp: string;
  rssi: number;
  sequence_number: number;
}

export default function CrowdAnalysisPage() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<[string, string] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [devicePresence, setDevicePresence] = useState<DevicePresenceData[]>([]);
  const [crowdSnapshots, setCrowdSnapshots] = useState<CrowdSnapshot[]>([]);
  const [locationDetails, setLocationDetails] = useState<LocationData | null>(null);
  const [rssiDistribution, setRssiDistribution] = useState<RssiDistribution[]>([]);
  const [deviceSignals, setDeviceSignals] = useState<DeviceSignalOverTime[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetchLocationDetails();
      fetchDevicePresence();
    }
  }, [selectedLocation, timeRange]);

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await safeSupabaseOperation(() =>
        supabase.from("location_scanned").select("*").order("created_at", { ascending: false })
      );

      if (error) {
        console.error("Error fetching locations:", error);
        setError(`Error fetching locations: ${error.message}`);
        return;
      }

      setLocations(data);
      if (data.length > 0) {
        setSelectedLocation(data[0].id);
      }
    } catch (err) {
      console.error("Error in fetchLocations:", err);
      setError("An unexpected error occurred while fetching locations");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocationDetails = async () => {
    if (!selectedLocation) return;

    try {
      const { data, error } = await safeSupabaseOperation(() =>
        supabase.from("location_scanned").select("*").eq("id", selectedLocation).single()
      );

      if (error) {
        console.error("Error fetching location details:", error);
        return;
      }

      setLocationDetails(data);
    } catch (err) {
      console.error("Error in fetchLocationDetails:", err);
    }
  };

  const fetchDevicePresence = async () => {
    if (!selectedLocation) return;

    setIsLoading(true);
    try {
      // First fetch the regular device data
      let query = supabase.from("scanned_device").select("*");

      if (locationDetails) {
        query = query.or(
          `location_id.eq.${selectedLocation},location_name.eq.${locationDetails.location_name}`
        );
      } else {
        query = query.eq("location_id", selectedLocation);
      }

      // Apply time range filter if selected
      if (timeRange) {
        query = query.gte("scan_time", timeRange[0]).lte("scan_time", timeRange[1]);
      }

      const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() => query);

      // Fetch RSSI time series data
      const { data: rssiTimeSeriesData, error: rssiError } = await safeSupabaseOperation(() =>
        supabase
          .from("rssi_timeseries")
          .select("*")
          .in("device_id", deviceData?.map((d: any) => d.device_id) || [])
          .order("timestamp", { ascending: true })
      );

      if (deviceError) {
        console.error("Error fetching device data:", deviceError);
        setError(`Error fetching device data: ${deviceError.message}`);
        return;
      }

      if (rssiError) {
        console.error("Error fetching RSSI time series:", rssiError);
        setError(`Error fetching RSSI data: ${rssiError.message}`);
        return;
      }

      console.log("Device data retrieved:", deviceData?.length || 0, "records");
      console.log("RSSI time series retrieved:", rssiTimeSeriesData?.length || 0, "records");

      if (!deviceData || deviceData.length === 0) {
        // Try a broader search by just using the location name
        if (locationDetails) {
          const { data: alternativeData, error: alternativeError } = await safeSupabaseOperation(
            () =>
              supabase
                .from("scanned_device")
                .select("*")
                .ilike("location_name", `%${locationDetails.location_name}%`)
                .order("scan_time", { ascending: true })
          );

          if (!alternativeError && alternativeData && alternativeData.length > 0) {
            console.log(
              "Found data using location name search:",
              alternativeData.length,
              "records"
            );
            processDeviceData(alternativeData, rssiTimeSeriesData);
            return;
          }
        }

        setDevicePresence([]);
        setCrowdSnapshots([]);
        setError("No device data found for this location and time range");
        setIsLoading(false);
        return;
      }

      processDeviceData(deviceData, rssiTimeSeriesData);
    } catch (err) {
      console.error("Error in fetchDevicePresence:", err);
      setError("An unexpected error occurred while fetching device presence data");
    } finally {
      setIsLoading(false);
    }
  };

  const processDeviceData = (data: any[], rssiTimeSeriesData: RssiTimeSeriesData[] = []) => {
    // Add debug logging
    console.log("Total scan records:", data.length);

    // Process device presence data
    const deviceMap = new Map<string, any>();

    data.forEach((record: any) => {
      const deviceId = record.device_id;
      if (!deviceMap.has(deviceId)) {
        deviceMap.set(deviceId, {
          device_id: deviceId,
          device_name: record.device_name,
          first_seen: record.scan_time,
          last_seen: record.scan_time,
          rssi_values: [record.rssi],
          appearances: [record.scan_time],
        });
      } else {
        const device = deviceMap.get(deviceId);
        device.last_seen = record.scan_time;
        device.rssi_values.push(record.rssi);
        device.appearances.push(record.scan_time);
      }
    });

    // Add debug logging
    console.log("Unique devices:", deviceMap.size);

    // Calculate statistics for each device
    const presenceData: DevicePresenceData[] = Array.from(deviceMap.values()).map((device) => {
      const rssiSum = device.rssi_values.reduce((sum: number, val: number) => sum + val, 0);
      const firstSeen = parseISO(device.first_seen);
      const lastSeen = parseISO(device.last_seen);

      return {
        device_id: device.device_id,
        device_name: device.device_name,
        first_seen: device.first_seen,
        last_seen: device.last_seen,
        total_appearances: device.appearances.length,
        rssi_min: Math.min(...device.rssi_values),
        rssi_max: Math.max(...device.rssi_values),
        rssi_avg: rssiSum / device.rssi_values.length,
        presence_duration: differenceInSeconds(lastSeen, firstSeen),
      };
    });

    setDevicePresence(presenceData);

    // Generate RSSI distribution data
    const rssiValues = data.map((record) => record.rssi);
    const minRssi = Math.min(...rssiValues);
    const maxRssi = Math.max(...rssiValues);

    // Create RSSI ranges (bins) for distribution
    const rangeBins = 10;
    const rangeSize = (maxRssi - minRssi) / rangeBins;
    const rssiRanges: RssiDistribution[] = [];

    for (let i = 0; i < rangeBins; i++) {
      const rangeMin = minRssi + i * rangeSize;
      const rangeMax = rangeMin + rangeSize;

      rssiRanges.push({
        rssiRange: `${Math.round(rangeMin)} to ${Math.round(rangeMax)}`,
        count: 0,
        minRssi: rangeMin,
        maxRssi: rangeMax,
      });
    }

    // Count devices in each RSSI range
    data.forEach((record) => {
      const rssi = record.rssi;
      for (const range of rssiRanges) {
        if (rssi >= range.minRssi && rssi < range.maxRssi) {
          range.count++;
          break;
        }
      }
    });

    setRssiDistribution(rssiRanges);

    // Generate crowd snapshots by time
    // Group data into 1-second intervals (changed from 30-second intervals)
    const timeGroups = new Map<string, any>();
    const seenDevices = new Set<string>();
    let previousSnapshot: any = null;

    // Sort data by scan_time to ensure chronological processing
    const sortedData = [...data].sort(
      (a, b) => new Date(a.scan_time).getTime() - new Date(b.scan_time).getTime()
    );

    sortedData.forEach((record: any) => {
      const time = new Date(record.scan_time);
      // Round to nearest second for the snapshot (changed from 30 seconds)
      const snapshotTime = new Date(Math.floor(time.getTime() / 1000) * 1000);
      const timeKey = snapshotTime.toISOString();

      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, {
          timestamp: timeKey,
          devices: new Set<string>(),
          rssi_values: [],
          new_devices: new Set<string>(),
          departed_devices: new Set<string>(),
        });
      }

      const group = timeGroups.get(timeKey);
      group.devices.add(record.device_id);
      group.rssi_values.push(record.rssi);

      // Check if this is a new device in this location scan
      if (!seenDevices.has(record.device_id)) {
        seenDevices.add(record.device_id);
        group.new_devices.add(record.device_id);
      }
    });

    // Calculate departed devices by comparing consecutive snapshots
    const timeKeys = Array.from(timeGroups.keys()).sort();

    for (let i = 1; i < timeKeys.length; i++) {
      const currentGroup = timeGroups.get(timeKeys[i]);
      const previousGroup = timeGroups.get(timeKeys[i - 1]);

      // Devices in previous snapshot but not in current
      previousGroup.devices.forEach((deviceId: string) => {
        if (!currentGroup.devices.has(deviceId)) {
          currentGroup.departed_devices.add(deviceId);
        }
      });
    }

    // Convert to final format
    const snapshots: CrowdSnapshot[] = timeKeys.map((key) => {
      const group = timeGroups.get(key);
      const rssiSum = group.rssi_values.reduce((sum: number, val: number) => sum + val, 0);

      return {
        timestamp: group.timestamp,
        total_devices: group.devices.size,
        new_devices: group.new_devices.size,
        departed_devices: group.departed_devices.size,
        average_rssi: group.rssi_values.length > 0 ? rssiSum / group.rssi_values.length : 0,
      };
    });

    setCrowdSnapshots(snapshots);

    // Process signal strength over time for each device
    const deviceSignalMap = new Map<
      string,
      { times: string[]; rssi: number[]; name: string | null; sequence: number[] }
    >();

    // First, process the regular scan data
    data.forEach((record) => {
      const deviceId = record.device_id;
      if (!deviceSignalMap.has(deviceId)) {
        deviceSignalMap.set(deviceId, {
          times: [record.scan_time],
          rssi: [record.rssi],
          name: record.device_name || null,
          sequence: [0], // Base sequence for regular scans
        });
      } else {
        const device = deviceSignalMap.get(deviceId)!;
        device.times.push(record.scan_time);
        device.rssi.push(record.rssi);
        device.sequence.push(0);
      }
    });

    // Then, incorporate the time series data
    rssiTimeSeriesData.forEach((record) => {
      const deviceId = record.device_id;
      if (!deviceSignalMap.has(deviceId)) {
        deviceSignalMap.set(deviceId, {
          times: [record.timestamp],
          rssi: [record.rssi],
          name: null,
          sequence: [record.sequence_number],
        });
      } else {
        const device = deviceSignalMap.get(deviceId)!;
        device.times.push(record.timestamp);
        device.rssi.push(record.rssi);
        device.sequence.push(record.sequence_number);
      }
    });

    // Generate random colors for each device
    const colors = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
      "#8AC656",
      "#F27173",
      "#5D9CEC",
      "#FFC870",
      "#48CFAD",
      "#AC92EC",
      "#EC87C0",
      "#4FC1E9",
      "#A0D468",
    ];

    // Convert to array and sort by data points
    const signalOverTime: DeviceSignalOverTime[] = Array.from(deviceSignalMap.entries())
      .map(([deviceId, data], index) => {
        // Sort data points by timestamp
        const sortedIndices = data.times
          .map((_, i) => i)
          .sort((a, b) => new Date(data.times[a]).getTime() - new Date(data.times[b]).getTime());

        return {
          deviceId,
          deviceName: data.name,
          timePoints: sortedIndices.map((i) => data.times[i]),
          rssiValues: sortedIndices.map((i) => data.rssi[i]),
          sequenceNumbers: sortedIndices.map((i) => data.sequence[i]),
          color: colors[index % colors.length],
        };
      })
      .sort((a, b) => b.timePoints.length - a.timePoints.length)
      .slice(0, 15); // Limit to 15 devices with most data points

    setDeviceSignals(signalOverTime);
    setSelectedDevices(signalOverTime.slice(0, 5).map((d) => d.deviceId));
  };

  const devicePresenceColumns = [
    {
      title: "Device ID",
      dataIndex: "device_id",
      key: "device_id",
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text.substring(0, 8)}...</span>
        </Tooltip>
      ),
    },
    {
      title: "Device Name",
      dataIndex: "device_name",
      key: "device_name",
      render: (text: string | null) => text || "Unknown",
    },
    {
      title: "First Seen",
      dataIndex: "first_seen",
      key: "first_seen",
      render: (text: string) => format(new Date(text), "yyyy-MM-dd HH:mm:ss"),
    },
    {
      title: "Last Seen",
      dataIndex: "last_seen",
      key: "last_seen",
      render: (text: string) => format(new Date(text), "yyyy-MM-dd HH:mm:ss"),
    },
    {
      title: "Duration",
      dataIndex: "presence_duration",
      key: "presence_duration",
      render: (seconds: number) => `${Math.round(seconds)} sec`,
    },
    {
      title: "Appearances",
      dataIndex: "total_appearances",
      key: "total_appearances",
    },
    {
      title: "Avg RSSI",
      dataIndex: "rssi_avg",
      key: "rssi_avg",
      render: (value: number) => value.toFixed(1),
    },
  ];

  const crowdAnalysisColumns = [
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (text: string) => format(new Date(text), "HH:mm:ss.SSS"),
    },
    {
      title: "Total Devices",
      dataIndex: "total_devices",
      key: "total_devices",
      render: (value: number) => (
        <Badge count={value} showZero color="#108ee9" overflowCount={9999} />
      ),
    },
    {
      title: "New Devices",
      dataIndex: "new_devices",
      key: "new_devices",
      render: (value: number) => (
        <Badge count={value} showZero color="#52c41a" overflowCount={9999} />
      ),
    },
    {
      title: "Departed",
      dataIndex: "departed_devices",
      key: "departed_devices",
      render: (value: number) => (
        <Badge count={value} showZero color="#f5222d" overflowCount={9999} />
      ),
    },
    {
      title: "Avg RSSI",
      dataIndex: "average_rssi",
      key: "average_rssi",
      render: (value: number) => value.toFixed(1),
    },
  ];

  const chartData = useMemo(() => {
    if (!crowdSnapshots.length) return null;

    return {
      labels: crowdSnapshots.map((snapshot) =>
        format(new Date(snapshot.timestamp), "HH:mm:ss.SSS")
      ),
      datasets: [
        {
          label: "Total Devices",
          data: crowdSnapshots.map((snapshot) => snapshot.total_devices),
          borderColor: "#1890ff",
          backgroundColor: "rgba(24, 144, 255, 0.2)",
          yAxisID: "y",
        },
        {
          label: "New Devices",
          data: crowdSnapshots.map((snapshot) => snapshot.new_devices),
          borderColor: "#52c41a",
          backgroundColor: "rgba(82, 196, 26, 0.2)",
          yAxisID: "y",
        },
        {
          label: "Departed Devices",
          data: crowdSnapshots.map((snapshot) => snapshot.departed_devices),
          borderColor: "#f5222d",
          backgroundColor: "rgba(245, 34, 45, 0.2)",
          yAxisID: "y",
        },
        {
          label: "Avg RSSI (dBm)",
          data: crowdSnapshots.map((snapshot) => snapshot.average_rssi),
          borderColor: "#722ed1",
          backgroundColor: "rgba(114, 46, 209, 0.2)",
          yAxisID: "y1",
          type: "line",
          pointStyle: "rectRot",
          pointRadius: 5,
          pointBorderColor: "#722ed1",
        },
      ],
    };
  }, [crowdSnapshots]);

  const rssiDistributionChartData = useMemo(() => {
    if (!rssiDistribution.length) return null;

    return {
      labels: rssiDistribution.map((item) => item.rssiRange),
      datasets: [
        {
          label: "Device Count",
          data: rssiDistribution.map((item) => item.count),
          backgroundColor: "rgba(53, 162, 235, 0.5)",
          borderColor: "rgb(53, 162, 235)",
          borderWidth: 1,
        },
      ],
    };
  }, [rssiDistribution]);

  const rssiOverTimeOptions = {
    responsive: true,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    stacked: false,
    scales: {
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: true,
          text: "Device Count",
        },
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        reverse: true,
        grid: {
          drawOnChartArea: false,
        },
        title: {
          display: true,
          text: "RSSI (dBm)",
        },
      },
    },
  };

  const rssiDistributionOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "RSSI Distribution Across Devices",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Device Count",
        },
      },
      x: {
        title: {
          display: true,
          text: "RSSI Range (dBm)",
        },
      },
    },
  };

  const deviceSignalChartData = useMemo(() => {
    if (!deviceSignals.length || !selectedDevices.length) return null;

    const filteredDevices = deviceSignals.filter((d) => selectedDevices.includes(d.deviceId));

    // Get all unique timestamps across all selected devices and sort them
    const timestamps = filteredDevices
      .flatMap((d) => d.timePoints)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return {
      labels: timestamps.map((_, index) => index.toString()), // Convert to string to satisfy type
      datasets: filteredDevices.map((device) => {
        // Create data points that map to the indices of the timestamps
        const data = timestamps.map((timestamp) => {
          const index = device.timePoints.findIndex((time) => time === timestamp);
          return index >= 0 ? device.rssiValues[index] : NaN;
        });

        return {
          label: device.deviceName || device.deviceId.substring(0, 8),
          data: data,
          borderColor: device.color,
          backgroundColor: `${device.color}33`,
          tension: 0.3,
          yAxisID: "y",
        };
      }),
    };
  }, [deviceSignals, selectedDevices]);

  const handleDeviceSelection = (deviceId: string) => {
    setSelectedDevices((prev) => {
      if (prev.includes(deviceId)) {
        return prev.filter((id) => id !== deviceId);
      } else {
        return [...prev, deviceId];
      }
    });
  };

  const deviceSignalOptions = {
    responsive: true,
    scales: {
      x: {
        type: "linear" as const,
        title: {
          display: true,
          text: "Time (0.5s intervals)",
        },
        ticks: {
          callback: function (value: any) {
            if (deviceSignals.length && selectedDevices.length) {
              const allTimes = deviceSignals.flatMap((d) => d.timePoints);
              const sortedTimes = [...new Set(allTimes)].sort(
                (a, b) => new Date(a).getTime() - new Date(b).getTime()
              );

              const index = Math.round(value);
              if (index >= 0 && index < sortedTimes.length) {
                return format(new Date(sortedTimes[index]), "HH:mm:ss.SSS");
              }
            }
            return value;
          },
        },
      },
      y: {
        reverse: true,
        title: {
          display: true,
          text: "RSSI (dBm)",
        },
        min: -100,
        max: -20,
      },
    },
    plugins: {
      title: {
        display: true,
        text: "High Resolution Device Signal Strength Over Time (0.5s intervals)",
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            if (deviceSignals.length && selectedDevices.length && context.length > 0) {
              const allTimes = deviceSignals.flatMap((d) => d.timePoints);
              const sortedTimes = [...new Set(allTimes)].sort(
                (a, b) => new Date(a).getTime() - new Date(b).getTime()
              );

              const index = Math.round(context[0].parsed.x);
              if (index >= 0 && index < sortedTimes.length) {
                return format(new Date(sortedTimes[index]), "yyyy-MM-dd HH:mm:ss.SSS");
              }
            }
            return "";
          },
          label: (context: any) => {
            const dataset = context.dataset;
            const index = context.dataIndex;
            const device = deviceSignals.find((d) => d.deviceId === dataset.deviceId);
            const sequence = device?.sequenceNumbers[index];
            return `${dataset.label}: ${context.parsed.y} dBm (Sequence: ${sequence})`;
          },
        },
      },
    },
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (!devicePresence.length || !crowdSnapshots.length) return null;

    const maxDevices = Math.max(...crowdSnapshots.map((s) => s.total_devices));
    const totalUniqueDevices = devicePresence.length;
    const avgStayDuration =
      devicePresence.reduce((sum, device) => sum + device.presence_duration, 0) /
      totalUniqueDevices;
    const totalEntries = crowdSnapshots.reduce((sum, snapshot) => sum + snapshot.new_devices, 0);
    const totalDepartures = crowdSnapshots.reduce(
      (sum, snapshot) => sum + snapshot.departed_devices,
      0
    );

    return {
      maxDevices,
      totalUniqueDevices,
      avgStayDuration, // in seconds now, no longer converting to minutes
      totalEntries,
      totalDepartures,
    };
  }, [devicePresence, crowdSnapshots]);

  return (
    <DashboardLayout>
      <Title level={2}>Crowd Analysis</Title>
      <Text type="secondary" className="block mb-6">
        Analyze crowd data based on BLE device presence at specific locations
      </Text>

      <Card className="mb-6">
        <Space direction="vertical" size="large" style={{ width: "100%" }} className="mb-4">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={8}>
              <Text strong>Select Location:</Text>
              <Select
                className="w-full mt-2"
                placeholder="Select a location"
                loading={isLoading}
                value={selectedLocation}
                onChange={setSelectedLocation}
                options={locations.map((location) => ({
                  label: `${location.location_name} (${format(
                    new Date(location.created_at),
                    "yyyy-MM-dd"
                  )})`,
                  value: location.id,
                }))}
              />
            </Col>
            <Col xs={24} md={12}>
              <Text strong>Time Range:</Text>
              <RangePicker
                className="w-full mt-2"
                showTime
                onChange={(dates) => {
                  if (dates) {
                    setTimeRange([dates[0]!.toISOString(), dates[1]!.toISOString()]);
                  } else {
                    setTimeRange(null);
                  }
                }}
              />
            </Col>
            <Col xs={24} md={4}>
              <Button
                type="primary"
                icon={<LineChartOutlined />}
                onClick={fetchDevicePresence}
                className="w-full mt-2"
              >
                Analyze
              </Button>
            </Col>
          </Row>

          {locationDetails && (
            <div className="mt-6">
              <Divider>Location Details</Divider>
              <Row gutter={[24, 24]} align="middle">
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title={<span className="text-base">Location</span>}
                    value={locationDetails.location_name}
                    prefix={<EnvironmentOutlined />}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title={<span className="text-base">Scan Time</span>}
                    value={format(new Date(locationDetails.scan_start_time), "yyyy-MM-dd HH:mm:ss")}
                    prefix={<ClockCircleOutlined />}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title={<span className="text-base">Duration</span>}
                    value={`${locationDetails.scan_duration_seconds} seconds`}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Statistic
                      title={<span className="text-base">Total Scan Records</span>}
                      value={locationDetails.scan_count}
                      prefix={<TeamOutlined />}
                    />
                    <Button
                      type="primary"
                      icon={<LineChartOutlined />}
                      onClick={() => router.push(`/location-analysis/${selectedLocation}`)}
                      className="w-full"
                    >
                      View Detailed Analysis
                    </Button>
                  </Space>
                </Col>
              </Row>
            </div>
          )}

          {error && <Alert message={error} type="error" showIcon className="mt-4" />}
        </Space>
      </Card>

      {isLoading ? (
        <div className="flex justify-center my-12">
          <Spin size="large" tip="Loading analysis data..." />
        </div>
      ) : (
        <>
          {stats && (
            <Row gutter={[16, 16]} className="mb-6">
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-base">Unique BLE Devices</span>}
                    value={stats.totalUniqueDevices}
                    prefix={<TeamOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-base">Peak Concurrent Devices</span>}
                    value={stats.maxDevices}
                    prefix={<InfoCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-base">Avg Stay Duration</span>}
                    value={`${Math.round(stats.avgStayDuration)} sec`}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-base">Total Entries</span>}
                    value={stats.totalEntries}
                    prefix={<UserAddOutlined />}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card className="h-full">
                  <Statistic
                    title={<span className="text-base">Total Departures</span>}
                    value={stats.totalDepartures}
                    prefix={<UserDeleteOutlined />}
                    valueStyle={{ color: "#f5222d" }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <Card className="mb-6">
            <Tabs
              defaultActiveKey="1"
              items={[
                {
                  key: "1",
                  label: "Crowd Timeline",
                  children: (
                    <>
                      <Row gutter={[16, 16]}>
                        <Col span={24}>
                          {chartData && (
                            <LineChartComponent
                              title="Crowd Density and Signal Strength Over Time"
                              data={chartData}
                              height={400}
                              options={rssiOverTimeOptions}
                            />
                          )}
                        </Col>
                        <Col span={24}>
                          {rssiDistributionChartData && (
                            <LineChartComponent
                              title="RSSI Distribution"
                              data={rssiDistributionChartData}
                              height={300}
                              options={rssiDistributionOptions}
                            />
                          )}
                        </Col>
                      </Row>

                      <div className="mt-6">
                        <Title level={4}>Crowd Timeline Analysis</Title>
                        <Table
                          dataSource={crowdSnapshots}
                          columns={crowdAnalysisColumns}
                          rowKey="timestamp"
                          pagination={{ pageSize: 10 }}
                          scroll={{ x: true }}
                        />
                      </div>
                    </>
                  ),
                },
                {
                  key: "2",
                  label: "Device Presence",
                  children: (
                    <>
                      <Title level={4}>Device Presence Details</Title>
                      <Text type="secondary">
                        This table shows all unique devices detected at the selected location and
                        their time of presence.
                      </Text>
                      <Table
                        dataSource={devicePresence}
                        columns={devicePresenceColumns}
                        rowKey="device_id"
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: true }}
                      />
                    </>
                  ),
                },
                {
                  key: "3",
                  label: "RSSI Analysis",
                  children: (
                    <Row gutter={[16, 16]} className="mt-6">
                      <Col span={24}>
                        <Card>
                          <Title level={4}>RSSI Distribution Analysis</Title>
                          <Text type="secondary">
                            This analysis shows how many devices were detected at each signal
                            strength range. Lower (more negative) RSSI values typically indicate
                            devices that are farther away.
                          </Text>

                          <Table
                            dataSource={rssiDistribution}
                            columns={[
                              {
                                title: "RSSI Range (dBm)",
                                dataIndex: "rssiRange",
                                key: "rssiRange",
                              },
                              {
                                title: "Device Count",
                                dataIndex: "count",
                                key: "count",
                                render: (value: number) => (
                                  <Badge
                                    count={value}
                                    showZero
                                    color="#108ee9"
                                    overflowCount={9999}
                                  />
                                ),
                              },
                              {
                                title: "Signal Strength",
                                key: "signalStrength",
                                render: (_, record: RssiDistribution) => {
                                  const avgRssi = (record.minRssi + record.maxRssi) / 2;
                                  let color = "red";
                                  let text = "Weak";

                                  if (avgRssi > -70) {
                                    color = "success";
                                    text = "Strong";
                                  } else if (avgRssi > -85) {
                                    color = "warning";
                                    text = "Moderate";
                                  }

                                  return <Tag color={color}>{text}</Tag>;
                                },
                              },
                            ]}
                            rowKey="rssiRange"
                            pagination={false}
                          />
                        </Card>
                      </Col>
                    </Row>
                  ),
                },
                {
                  key: "4",
                  label: "Signal Degradation",
                  children: (
                    <Row gutter={[16, 16]} className="mt-4">
                      <Col span={24}>
                        <Card>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <div>
                              <Title level={4}>Device Signal Strength Over Time</Title>
                              <Text type="secondary" className="mb-4 block">
                                This chart shows how signal strength changes over time for
                                individual devices. Sudden drops in signal strength may indicate
                                device movement or obstacles.
                              </Text>
                            </div>

                            <div className="mb-4">
                              <Text strong>Select Devices to Display:</Text>
                              <div className="mt-2">
                                {deviceSignals.map((device) => (
                                  <Tag
                                    key={device.deviceId}
                                    color={
                                      selectedDevices.includes(device.deviceId)
                                        ? device.color
                                        : "default"
                                    }
                                    style={{
                                      cursor: "pointer",
                                      margin: "4px",
                                      opacity: selectedDevices.includes(device.deviceId) ? 1 : 0.6,
                                    }}
                                    onClick={() => handleDeviceSelection(device.deviceId)}
                                  >
                                    {device.deviceName || device.deviceId.substring(0, 8)}
                                  </Tag>
                                ))}
                              </div>
                            </div>

                            {deviceSignalChartData ? (
                              <LineChartComponent
                                title=""
                                data={deviceSignalChartData}
                                height={400}
                                options={deviceSignalOptions}
                              />
                            ) : (
                              <Alert
                                message="No device signal data available"
                                description="Select a location with more device readings to see signal strength over time."
                                type="info"
                                showIcon
                              />
                            )}
                          </Space>
                        </Card>
                      </Col>

                      <Col span={24}>
                        <Card>
                          <Title level={4}>Signal Degradation Analysis</Title>
                          <Text type="secondary" className="mb-4 block">
                            This table shows how signal strength changes for each device over the
                            monitoring period. A negative change indicates signal degradation.
                          </Text>

                          <Table
                            dataSource={deviceSignals.map((device) => {
                              const firstRssi = device.rssiValues[0];
                              const lastRssi = device.rssiValues[device.rssiValues.length - 1];
                              const averageRssi =
                                device.rssiValues.reduce((sum, val) => sum + val, 0) /
                                device.rssiValues.length;
                              const minRssi = Math.min(...device.rssiValues);
                              const maxRssi = Math.max(...device.rssiValues);
                              const change = lastRssi - firstRssi;
                              const percentChange = (change / Math.abs(firstRssi)) * 100;

                              return {
                                deviceId: device.deviceId,
                                deviceName: device.deviceName,
                                readings: device.timePoints.length,
                                firstRssi,
                                lastRssi,
                                averageRssi,
                                minRssi,
                                maxRssi,
                                change,
                                percentChange,
                              };
                            })}
                            columns={[
                              {
                                title: "Device",
                                dataIndex: "deviceName",
                                key: "deviceName",
                                render: (text, record: any) =>
                                  text || record.deviceId.substring(0, 8),
                              },
                              {
                                title: "Readings",
                                dataIndex: "readings",
                                key: "readings",
                                sorter: (a: any, b: any) => a.readings - b.readings,
                              },
                              {
                                title: "Initial RSSI",
                                dataIndex: "firstRssi",
                                key: "firstRssi",
                                render: (value: number) => value.toFixed(1),
                              },
                              {
                                title: "Final RSSI",
                                dataIndex: "lastRssi",
                                key: "lastRssi",
                                render: (value: number) => value.toFixed(1),
                              },
                              {
                                title: "Signal Change",
                                dataIndex: "change",
                                key: "change",
                                render: (value: number) => {
                                  let color = "green";
                                  if (value < 0) color = "red";
                                  else if (value === 0) color = "orange";

                                  return <Tag color={color}>{value.toFixed(1)} dBm</Tag>;
                                },
                                sorter: (a: any, b: any) => a.change - b.change,
                              },
                              {
                                title: "Min RSSI",
                                dataIndex: "minRssi",
                                key: "minRssi",
                                render: (value: number) => value.toFixed(1),
                              },
                              {
                                title: "Max RSSI",
                                dataIndex: "maxRssi",
                                key: "maxRssi",
                                render: (value: number) => value.toFixed(1),
                              },
                            ]}
                            rowKey="deviceId"
                            pagination={{ pageSize: 10 }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
