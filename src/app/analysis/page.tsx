"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Divider } from "@nextui-org/react";
import {
  Space,
  Select as AntSelect,
  Button as AntButton,
  Tooltip,
  Typography,
  Form,
  Spin,
  Statistic,
  Alert,
  Badge,
  Flex,
  Tag,
} from "antd";
import {
  BarChartOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import LineChartComponent from "@/components/LineChart";

interface ScannedDevice {
  id: number;
  session_id: string;
  location_id: number;
  location_name: string;
  device_id: string;
  device_name: string | null;
  rssi: number;
  manufacturer_data: string | null;
  service_uuids: string | null;
  device_latitude: number | null;
  device_longitude: number | null;
  device_accuracy: number | null;
  location_latitude: number | null;
  location_longitude: number | null;
  location_accuracy: number | null;
  location_notes: string | null;
  scan_time: string;
  scan_duration: number | null;
  rf_power_level: number | null;
  created_at: string;
}

export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [correlationData, setCorrelationData] = useState<{
    distanceValues: number[];
    rssiValues: number[];
    correlation: number | null;
    timestamps: string[];
  }>({
    distanceValues: [],
    rssiValues: [],
    correlation: null,
    timestamps: [],
  });

  const [combinedChartData, setCombinedChartData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: "Distance (m)",
        data: [] as number[],
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.5)",
        yAxisID: "y",
      },
      {
        label: "Signal Strength (dBm)",
        data: [] as number[],
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        yAxisID: "y1",
      },
    ],
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Fetch locations
        const { data: locationData, error: locationError } = await safeSupabaseOperation(() =>
          supabase.from("scanned_device").select("location_name").not("location_name", "is", null)
        );

        if (locationError) {
          console.error("Error fetching locations:", locationError);
          return;
        }

        // Get unique locations
        const uniqueLocationsRaw = [
          ...new Set(
            locationData.map((item: any) => item.location_name).filter((name: any) => Boolean(name))
          ),
        ];

        // Ensure we have a string array
        const uniqueLocations: string[] = uniqueLocationsRaw.map((loc) => String(loc));

        setLocations(uniqueLocations);

        // Fetch all scanned devices
        const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
          supabase
            .from("scanned_device")
            .select("*")
            .order("scan_time", { ascending: false })
            .limit(500)
        );

        if (deviceError) {
          console.error("Error fetching devices:", deviceError);
          return;
        }

        setScannedDevices(deviceData);

        // Set default location if available
        if (uniqueLocations.length > 0) {
          const firstLocation = String(uniqueLocations[0]);
          setSelectedLocation(firstLocation);

          // Get devices for this location
          await fetchDevicesForLocation(firstLocation);
        }
      } catch (error) {
        console.error("Error in fetchInitialData:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const fetchDevicesForLocation = async (location: string) => {
    try {
      const { data, error } = await safeSupabaseOperation(() =>
        supabase
          .from("scanned_device")
          .select("*")
          .eq("location_name", location)
          .order("scan_time", { ascending: false })
      );

      if (error) {
        console.error(`Error fetching data for location ${location}:`, error);
        return [];
      }

      // Extract unique device IDs
      const deviceIds = new Set<string>();

      data.forEach((device: ScannedDevice) => {
        if (device.device_id) {
          deviceIds.add(String(device.device_id));
        }
      });

      const uniqueDeviceIds = Array.from(deviceIds);
      setDevices(uniqueDeviceIds);

      // Set first device as selected if available
      if (uniqueDeviceIds.length > 0) {
        setSelectedDevice(uniqueDeviceIds[0]);
      }

      return uniqueDeviceIds;
    } catch (error) {
      console.error("Error in fetchDevicesForLocation:", error);
      return [];
    }
  };

  const handleLocationChange = async (location: string) => {
    setSelectedLocation(location);
    const deviceIds = await fetchDevicesForLocation(location);

    if (deviceIds.length > 0) {
      setSelectedDevice(deviceIds[0]);
    } else {
      setSelectedDevice("");
    }
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (
    lat1: number | null,
    lon1: number | null,
    lat2: number | null,
    lon2: number | null
  ): number | null => {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
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

  const analyzeCorrelation = async () => {
    if (!selectedLocation || !selectedDevice) return;

    setIsLoading(true);

    try {
      // Get scanned devices for the selected location and device
      const locationDevices = scannedDevices.filter(
        (d) =>
          d.location_name === selectedLocation &&
          d.device_id === selectedDevice &&
          d.location_latitude !== null &&
          d.location_longitude !== null &&
          d.device_latitude !== null &&
          d.device_longitude !== null
      );

      // Calculate distances and prepare data points
      const dataPoints = locationDevices
        .map((device) => {
          const distance = calculateDistance(
            device.device_latitude,
            device.device_longitude,
            device.location_latitude,
            device.location_longitude
          );

          return {
            timestamp: device.scan_time,
            distance: distance || 0,
            rssi: Math.abs(device.rssi),
          };
        })
        .filter((point) => point.distance > 0);

      // Sort by timestamp
      dataPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Extract arrays for correlation calculation
      const distanceValues = dataPoints.map((p) => p.distance);
      const rssiValues = dataPoints.map((p) => p.rssi);
      const timestamps = dataPoints.map((p) => {
        const date = new Date(p.timestamp);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
      });

      // Calculate Pearson correlation coefficient
      const correlation = calculateCorrelation(distanceValues, rssiValues);

      setCorrelationData({
        distanceValues,
        rssiValues,
        correlation,
        timestamps,
      });

      // Update chart data
      setCombinedChartData({
        labels: timestamps,
        datasets: [
          {
            label: "Distance (m)",
            data: distanceValues,
            borderColor: "rgb(53, 162, 235)",
            backgroundColor: "rgba(53, 162, 235, 0.5)",
            yAxisID: "y",
          },
          {
            label: "Signal Strength (dBm)",
            data: rssiValues,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.5)",
            yAxisID: "y1",
          },
        ],
      });
    } catch (error) {
      console.error("Error in analyzeCorrelation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (x: number[], y: number[]): number | null => {
    if (x.length !== y.length || x.length === 0) return null;

    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / x.length;
    const yMean = y.reduce((sum, val) => sum + val, 0) / y.length;

    // Calculate covariance and standard deviations
    let covariance = 0;
    let xStdDev = 0;
    let yStdDev = 0;

    for (let i = 0; i < x.length; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      covariance += xDiff * yDiff;
      xStdDev += xDiff * xDiff;
      yStdDev += yDiff * yDiff;
    }

    if (xStdDev === 0 || yStdDev === 0) return null;

    return covariance / (Math.sqrt(xStdDev) * Math.sqrt(yStdDev));
  };

  // Format correlation value for display
  const formatCorrelation = (value: number | null): string => {
    if (value === null) return "Not enough data";

    const rounded = Math.round(value * 100) / 100;
    let strength = "";
    const absValue = Math.abs(rounded);

    if (absValue >= 0.8) strength = "Very Strong";
    else if (absValue >= 0.6) strength = "Strong";
    else if (absValue >= 0.4) strength = "Moderate";
    else if (absValue >= 0.2) strength = "Weak";
    else strength = "Very Weak/None";

    return `${rounded} (${strength})`;
  };

  // Get correlation color
  const getCorrelationColor = (value: number | null): string => {
    if (value === null) return "default";

    const absValue = Math.abs(value);

    if (absValue >= 0.8) return value < 0 ? "success" : "error";
    if (absValue >= 0.6) return value < 0 ? "success" : "warning";
    if (absValue >= 0.4) return value < 0 ? "processing" : "warning";
    if (absValue >= 0.2) return "warning";
    return "default";
  };

  // Get the chart options for dual Y-axis
  const dualAxisOptions = {
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
          text: "Distance (m)",
        },
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        grid: {
          drawOnChartArea: false,
        },
        title: {
          display: true,
          text: "Signal Strength (dBm)",
        },
      },
    },
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">BLE Signal Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="bg-white shadow-sm border border-gray-100">
          <CardHeader className="pb-2">
            <h3 className="text-lg font-semibold text-gray-900">Analysis Parameters</h3>
          </CardHeader>
          <Divider className="opacity-50" />
          <CardBody>
            <Form layout="vertical" className="space-y-4">
              <Form.Item
                label="Location"
                tooltip="The location where BLE data was collected"
                className="mb-0"
              >
                <AntSelect
                  placeholder="Select a location"
                  value={selectedLocation || undefined}
                  onChange={handleLocationChange}
                  disabled={isLoading}
                  loading={isLoading}
                  showSearch
                  style={{ width: "100%" }}
                  optionFilterProp="children"
                  className="rounded-md"
                  notFoundContent={isLoading ? <Spin size="small" /> : "No locations found"}
                >
                  {locations.map((location) => (
                    <AntSelect.Option key={location} value={location}>
                      <Space>
                        <span>{location}</span>
                        <Badge
                          count={scannedDevices.filter((d) => d.location_name === location).length}
                          overflowCount={99}
                          size="small"
                        />
                      </Space>
                    </AntSelect.Option>
                  ))}
                </AntSelect>
              </Form.Item>

              <Form.Item
                label="BLE Device"
                tooltip="Select a Bluetooth Low Energy device to analyze correlation with distance"
                className="mb-2"
              >
                <AntSelect
                  placeholder="Select a device"
                  value={selectedDevice || undefined}
                  onChange={setSelectedDevice}
                  disabled={isLoading || !selectedLocation || devices.length === 0}
                  loading={isLoading}
                  showSearch
                  style={{ width: "100%" }}
                  optionFilterProp="children"
                  className="rounded-md"
                  notFoundContent={isLoading ? <Spin size="small" /> : "No devices found"}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider className="my-2" />
                      <Typography.Text className="px-3 py-2 text-xs text-gray-500 block">
                        {devices.length} devices available at {selectedLocation}
                      </Typography.Text>
                    </>
                  )}
                >
                  {devices.map((device) => (
                    <AntSelect.Option key={device} value={device}>
                      <Tooltip title={device} placement="left">
                        <span className="block truncate">{device}</span>
                      </Tooltip>
                    </AntSelect.Option>
                  ))}
                </AntSelect>
              </Form.Item>

              <Space>
                <AntButton
                  type="primary"
                  onClick={analyzeCorrelation}
                  disabled={isLoading || !selectedLocation || !selectedDevice}
                  loading={isLoading}
                  icon={<BarChartOutlined />}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Analyze Correlation
                </AntButton>

                <Tooltip title="Refresh locations and devices">
                  <AntButton
                    icon={<ReloadOutlined />}
                    onClick={() => fetchDevicesForLocation(selectedLocation)}
                    disabled={isLoading || !selectedLocation}
                  />
                </Tooltip>
              </Space>
            </Form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Flex align="center" justify="space-between">
              <h3 className="text-lg font-semibold">Correlation Results</h3>
              <Tooltip title="The Pearson correlation coefficient measures the linear relationship between distance and signal strength">
                <InfoCircleOutlined className="text-gray-400" />
              </Tooltip>
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Spin size="large" tip="Analyzing correlation..." />
              </div>
            ) : correlationData.correlation !== null ? (
              <div className="space-y-4">
                <Statistic
                  title={
                    <Space>
                      <span>Pearson Correlation Coefficient</span>
                      <Tooltip title="Values range from -1 (perfect negative correlation) to +1 (perfect positive correlation)">
                        <InfoCircleOutlined className="text-gray-400" />
                      </Tooltip>
                    </Space>
                  }
                  value={
                    correlationData.correlation
                      ? Math.round(correlationData.correlation * 100) / 100
                      : "N/A"
                  }
                  precision={2}
                  prefix={<LinkOutlined />}
                  suffix={
                    <Tag color={getCorrelationColor(correlationData.correlation)}>
                      {correlationData.correlation && Math.abs(correlationData.correlation) >= 0.8
                        ? "Very Strong"
                        : correlationData.correlation &&
                          Math.abs(correlationData.correlation) >= 0.6
                        ? "Strong"
                        : correlationData.correlation &&
                          Math.abs(correlationData.correlation) >= 0.4
                        ? "Moderate"
                        : correlationData.correlation &&
                          Math.abs(correlationData.correlation) >= 0.2
                        ? "Weak"
                        : "Very Weak"}
                    </Tag>
                  }
                />

                <Alert
                  type={
                    correlationData.correlation && correlationData.correlation < -0.4
                      ? "success"
                      : correlationData.correlation && correlationData.correlation > 0.4
                      ? "warning"
                      : "info"
                  }
                  message="Interpretation"
                  description={
                    correlationData.correlation && correlationData.correlation < -0.4
                      ? "Strong negative correlation: As distance increases, signal strength decreases (expected behavior for BLE)."
                      : correlationData.correlation && correlationData.correlation > 0.4
                      ? "Positive correlation: As distance increases, signal strength increases (unusual for BLE, may indicate interference)."
                      : "No significant correlation detected between distance and signal strength. This may indicate environmental factors affecting signal propagation."
                  }
                />

                <Flex align="center" justify="space-between">
                  <Statistic
                    title="Data Points"
                    value={correlationData.distanceValues.length}
                    suffix="measurements"
                  />
                  <Statistic
                    title="Distance Range"
                    value={
                      correlationData.distanceValues.length
                        ? `${Math.min(...correlationData.distanceValues).toFixed(1)} - ${Math.max(
                            ...correlationData.distanceValues
                          ).toFixed(1)}`
                        : "N/A"
                    }
                    suffix="m"
                  />
                </Flex>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 space-y-2">
                <Typography.Text type="secondary">
                  Select a location and device, then analyze to see correlation results.
                </Typography.Text>
                <Typography.Text type="secondary" className="text-xs">
                  Results require location data for both the scanner and BLE device.
                </Typography.Text>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {correlationData.correlation !== null && (
        <div className="mb-6">
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardBody>
              <LineChartComponent
                title="Distance vs. Signal Strength Comparison"
                data={combinedChartData}
                height={400}
                options={dualAxisOptions}
              />
            </CardBody>
          </Card>
        </div>
      )}

      <Card className="bg-white shadow-sm border border-gray-100">
        <CardBody>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">About This Analysis</h3>
          <p className="text-gray-600">
            This analysis tool examines the relationship between distance and BLE signal strength. A
            strong negative correlation is expected for BLE devices, as signal strength typically
            decreases with distance.
          </p>
          <p className="text-gray-600 mt-2">
            The Pearson correlation coefficient measures the linear relationship between variables,
            with values ranging from -1 (perfect negative correlation) to +1 (perfect positive
            correlation). A value near 0 indicates no linear relationship.
          </p>
        </CardBody>
      </Card>
    </DashboardLayout>
  );
}
