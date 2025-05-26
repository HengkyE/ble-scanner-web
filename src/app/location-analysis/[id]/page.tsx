"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Typography,
  Spin,
  Card,
  Table,
  Tabs,
  Alert,
  Space,
  Button,
  Tooltip,
  Statistic,
  Divider,
  Badge,
  Tag,
  Row,
  Col,
  Descriptions,
} from "antd";
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { format, parseISO } from "date-fns";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import LineChartComponent from "@/components/LineChart";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

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
  presence_duration: number;
}

interface RssiTimeSeriesData {
  device_id: string;
  timestamp: string;
  rssi: number;
  sequence_number: number;
}

interface DeviceSignalOverTime {
  deviceId: string;
  deviceName: string | null;
  timePoints: string[];
  rssiValues: number[];
  color: string;
  sequenceNumbers: number[];
}

export default function LocationAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [locationDetails, setLocationDetails] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [devicePresence, setDevicePresence] = useState<DevicePresenceData[]>([]);
  const [deviceSignals, setDeviceSignals] = useState<DeviceSignalOverTime[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [rssiTimeSeriesData, setRssiTimeSeriesData] = useState<RssiTimeSeriesData[]>([]);

  useEffect(() => {
    fetchLocationDetails();
  }, [locationId]);

  const fetchLocationDetails = async () => {
    setIsLoading(true);
    try {
      // Fetch location details
      const { data: locationData, error: locationError } = await safeSupabaseOperation(() =>
        supabase.from("location_scanned").select("*").eq("id", locationId).single()
      );

      if (locationError) {
        console.error("Error fetching location:", locationError);
        setError(`Error fetching location: ${locationError.message}`);
        return;
      }

      setLocationDetails(locationData);

      // Calculate the end time of the scan
      const scanStartTime = new Date(locationData.scan_start_time);
      const scanEndTime = new Date(
        scanStartTime.getTime() + locationData.scan_duration_seconds * 1000
      );

      // Fetch device data within the scan period
      const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
        supabase
          .from("scanned_device")
          .select("*")
          .or(`location_id.eq.${locationId},location_name.eq.${locationData.location_name}`)
          .gte("scan_time", locationData.scan_start_time)
          .lt("scan_time", scanEndTime.toISOString())
          .order("scan_time", { ascending: true })
      );

      if (deviceError) {
        console.error("Error fetching devices:", deviceError);
        setError(`Error fetching devices: ${deviceError.message}`);
        return;
      }

      // Fetch RSSI time series data within the scan period
      const { data: timeSeriesData, error: rssiError } = await safeSupabaseOperation(() =>
        supabase
          .from("rssi_timeseries")
          .select("*")
          .in("device_id", deviceData?.map((d: any) => d.device_id) || [])
          .gte("timestamp", locationData.scan_start_time)
          .lt("timestamp", scanEndTime.toISOString())
          .order("timestamp", { ascending: true })
      );

      if (rssiError) {
        console.error("Error fetching RSSI time series:", rssiError);
        setError(`Error fetching RSSI data: ${rssiError.message}`);
        return;
      }

      setRssiTimeSeriesData(timeSeriesData || []);
      processDeviceData(deviceData || [], timeSeriesData || []);
    } catch (err) {
      console.error("Error in fetchLocationDetails:", err);
      setError("An unexpected error occurred while fetching location data");
    } finally {
      setIsLoading(false);
    }
  };

  const processDeviceData = (data: any[], rssiTimeSeriesData: RssiTimeSeriesData[] = []) => {
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

    // Process RSSI time series data
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
          sequence: [0],
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

    // Generate colors for devices
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
      .slice(0, 15);

    setDeviceSignals(signalOverTime);
    setSelectedDevices(signalOverTime.slice(0, 5).map((d) => d.deviceId));

    // Calculate device presence statistics
    const presenceData: DevicePresenceData[] = Array.from(deviceMap.values()).map((device) => {
      const rssiSum = device.rssi_values.reduce((sum: number, val: number) => sum + val, 0);
      return {
        device_id: device.device_id,
        device_name: device.device_name,
        first_seen: device.first_seen,
        last_seen: device.last_seen,
        total_appearances: device.appearances.length,
        rssi_min: Math.min(...device.rssi_values),
        rssi_max: Math.max(...device.rssi_values),
        rssi_avg: rssiSum / device.rssi_values.length,
        presence_duration:
          (new Date(device.last_seen).getTime() - new Date(device.first_seen).getTime()) / 1000,
      };
    });

    setDevicePresence(presenceData);
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
      render: (text: string) => format(new Date(text), "yyyy-MM-dd HH:mm:ss.SSS"),
    },
    {
      title: "Last Seen",
      dataIndex: "last_seen",
      key: "last_seen",
      render: (text: string) => format(new Date(text), "yyyy-MM-dd HH:mm:ss.SSS"),
    },
    {
      title: "Duration (sec)",
      dataIndex: "presence_duration",
      key: "presence_duration",
      render: (seconds: number) => Math.round(seconds),
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

  const handleDeviceSelection = (deviceId: string) => {
    setSelectedDevices((prev) => {
      if (prev.includes(deviceId)) {
        return prev.filter((id) => id !== deviceId);
      } else {
        return [...prev, deviceId];
      }
    });
  };

  const deviceSignalChartData = useMemo(() => {
    if (!deviceSignals.length || !selectedDevices.length) return null;

    const filteredDevices = deviceSignals.filter((d) => selectedDevices.includes(d.deviceId));
    const timestamps = filteredDevices
      .flatMap((d) => d.timePoints)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return {
      labels: timestamps.map((_, index) => index.toString()),
      datasets: filteredDevices.map((device) => {
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

  const deviceSignalOptions = {
    responsive: true,
    scales: {
      x: {
        type: "linear" as const,
        title: {
          display: true,
          text: "Time (seconds from scan start)",
        },
        ticks: {
          callback: function (value: any) {
            if (deviceSignals.length && selectedDevices.length && locationDetails) {
              const scanStartTime = new Date(locationDetails.scan_start_time).getTime();
              const allTimes = deviceSignals.flatMap((d) => d.timePoints);
              const sortedTimes = [...new Set(allTimes)].sort(
                (a, b) => new Date(a).getTime() - new Date(b).getTime()
              );

              const index = Math.round(value);
              if (index >= 0 && index < sortedTimes.length) {
                // Show seconds from start
                const timeFromStart =
                  (new Date(sortedTimes[index]).getTime() - scanStartTime) / 1000;
                return `${timeFromStart.toFixed(1)}s`;
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
        text: "High Resolution RSSI Time Series (0.5s intervals)",
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            if (
              deviceSignals.length &&
              selectedDevices.length &&
              context.length > 0 &&
              locationDetails
            ) {
              const scanStartTime = new Date(locationDetails.scan_start_time).getTime();
              const allTimes = deviceSignals.flatMap((d) => d.timePoints);
              const sortedTimes = [...new Set(allTimes)].sort(
                (a, b) => new Date(a).getTime() - new Date(b).getTime()
              );

              const index = Math.round(context[0].parsed.x);
              if (index >= 0 && index < sortedTimes.length) {
                const timestamp = new Date(sortedTimes[index]);
                const timeFromStart = (timestamp.getTime() - scanStartTime) / 1000;
                return `Time: ${timeFromStart.toFixed(1)}s\n${format(timestamp, "HH:mm:ss.SSS")}`;
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

  const timeSeriesColumns = [
    {
      title: "Device",
      dataIndex: "device_id",
      key: "device_id",
      render: (text: string) => {
        const device = deviceSignals.find((d) => d.deviceId === text);
        return (
          <Tag color={device?.color || "default"}>{device?.deviceName || text.substring(0, 8)}</Tag>
        );
      },
    },
    {
      title: "Time from Start (s)",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (text: string) => {
        if (locationDetails) {
          const scanStartTime = new Date(locationDetails.scan_start_time).getTime();
          const timeFromStart = (new Date(text).getTime() - scanStartTime) / 1000;
          return timeFromStart.toFixed(1);
        }
        return "";
      },
    },
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      key: "absolute_time",
      render: (text: string) => format(new Date(text), "HH:mm:ss.SSS"),
    },
    {
      title: "RSSI (dBm)",
      dataIndex: "rssi",
      key: "rssi",
      render: (value: number) => (
        <Tag color={value > -70 ? "success" : value > -85 ? "warning" : "error"}>{value}</Tag>
      ),
    },
    {
      title: "Sequence",
      dataIndex: "sequence_number",
      key: "sequence_number",
    },
  ];

  return (
    <DashboardLayout>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/crowd-analysis")}>
              Back to Crowd Analysis
            </Button>
          </Col>
        </Row>

        {isLoading ? (
          <div className="flex justify-center my-12">
            <Spin size="large" tip="Loading location data..." />
          </div>
        ) : error ? (
          <Alert message={error} type="error" showIcon />
        ) : locationDetails ? (
          <>
            <Card>
              <Title level={2}>{locationDetails.location_name} Analysis</Title>
              <Descriptions bordered>
                <Descriptions.Item label="Location" span={3}>
                  <Space>
                    <EnvironmentOutlined />
                    {locationDetails.location_name}
                    <Tag color="blue">
                      {locationDetails.latitude.toFixed(6)}, {locationDetails.longitude.toFixed(6)}
                    </Tag>
                    <Tag color="green">Accuracy: {locationDetails.accuracy}m</Tag>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Scan Time">
                  {format(new Date(locationDetails.scan_start_time), "yyyy-MM-dd HH:mm:ss")}
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  {locationDetails.scan_duration_seconds} seconds
                </Descriptions.Item>
                <Descriptions.Item label="Total Scans">
                  {locationDetails.scan_count}
                </Descriptions.Item>
                {locationDetails.notes && (
                  <Descriptions.Item label="Notes" span={3}>
                    {locationDetails.notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <Card>
              <Tabs defaultActiveKey="overview">
                <Tabs.TabPane tab="Overview" key="overview">
                  <Space direction="vertical" style={{ width: "100%" }} size="large">
                    <Card title="Signal Strength Analysis">
                      <Space direction="vertical" style={{ width: "100%" }} size="large">
                        <div>
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
                            title="Device Signal Strength Overview"
                            data={deviceSignalChartData}
                            options={deviceSignalOptions}
                            height={400}
                          />
                        ) : (
                          <Alert
                            message="No signal data available"
                            description="No device signal data is available for this location."
                            type="info"
                            showIcon
                          />
                        )}
                      </Space>
                    </Card>

                    <Card title="Device Presence Details">
                      <Table
                        dataSource={devicePresence}
                        columns={devicePresenceColumns}
                        rowKey="device_id"
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: true }}
                      />
                    </Card>
                  </Space>
                </Tabs.TabPane>

                <Tabs.TabPane tab="Time Series Analysis" key="timeseries">
                  <Space direction="vertical" style={{ width: "100%" }} size="large">
                    <Card>
                      <Row gutter={[16, 16]}>
                        <Col span={24}>
                          <Alert
                            message="High Resolution RSSI Data"
                            description={`This view shows detailed RSSI readings taken every 0.5 seconds during the ${locationDetails.scan_duration_seconds} second scan period.`}
                            type="info"
                            showIcon
                          />
                        </Col>
                        <Col span={24}>
                          <Row justify="space-between" align="middle" gutter={[16, 16]}>
                            <Col>
                              <Statistic
                                title="Total Time Series Records"
                                value={rssiTimeSeriesData.length}
                                prefix={<LineChartOutlined />}
                              />
                            </Col>
                            <Col>
                              <Statistic
                                title="Scan Period"
                                value={`${locationDetails.scan_duration_seconds} seconds`}
                                prefix={<ClockCircleOutlined />}
                              />
                            </Col>
                            <Col>
                              <Statistic
                                title="Unique Devices"
                                value={new Set(rssiTimeSeriesData.map((d) => d.device_id)).size}
                                prefix={<TeamOutlined />}
                              />
                            </Col>
                          </Row>
                        </Col>
                      </Row>
                    </Card>

                    <Card title="Device Selection">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>Select Devices for Time Series Analysis:</Text>
                        <div className="mt-2">
                          {deviceSignals.map((device) => (
                            <Tag
                              key={device.deviceId}
                              color={
                                selectedDevices.includes(device.deviceId) ? device.color : "default"
                              }
                              style={{
                                cursor: "pointer",
                                margin: "4px",
                                opacity: selectedDevices.includes(device.deviceId) ? 1 : 0.6,
                              }}
                              onClick={() => handleDeviceSelection(device.deviceId)}
                            >
                              {device.deviceName || device.deviceId.substring(0, 8)}
                              <sup className="ml-1">
                                {
                                  rssiTimeSeriesData.filter((d) => d.device_id === device.deviceId)
                                    .length
                                }{" "}
                                readings
                              </sup>
                            </Tag>
                          ))}
                        </div>
                      </Space>
                    </Card>

                    <Card title="High Resolution Signal Strength Analysis">
                      {deviceSignalChartData ? (
                        <LineChartComponent
                          title="High Resolution RSSI Time Series (0.5s intervals)"
                          data={deviceSignalChartData}
                          options={{
                            ...deviceSignalOptions,
                            plugins: {
                              ...deviceSignalOptions.plugins,
                              title: {
                                display: true,
                                text: "High Resolution RSSI Time Series (0.5s intervals)",
                              },
                            },
                          }}
                          height={500}
                        />
                      ) : (
                        <Alert
                          message="No time series data available"
                          description="No high-resolution RSSI data is available for this scan period."
                          type="info"
                          showIcon
                        />
                      )}
                    </Card>

                    <Card title="Time Series Data Table">
                      <Table
                        dataSource={rssiTimeSeriesData}
                        columns={timeSeriesColumns}
                        rowKey={(record) =>
                          `${record.device_id}-${record.timestamp}-${record.sequence_number}`
                        }
                        pagination={{ pageSize: 50 }}
                        scroll={{ x: true }}
                      />
                    </Card>
                  </Space>
                </Tabs.TabPane>
              </Tabs>
            </Card>
          </>
        ) : (
          <Alert
            message="Location not found"
            description="The requested location could not be found."
            type="error"
            showIcon
          />
        )}
      </Space>
    </DashboardLayout>
  );
}
