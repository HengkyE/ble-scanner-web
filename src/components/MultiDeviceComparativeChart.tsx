"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, Select, Checkbox, Alert, Spin, Empty, Button, Space, Tag } from "antd";
import { LineChartOutlined, ReloadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import LineChartComponent from "./LineChart";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";

const { Option } = Select;

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

interface LocationData {
  id: number;
  name: string;
  deviceCount: number;
  uniqueDeviceIds: Set<string>;
  devices: any[];
  rssiTimeseries: RssiTimeseries[];
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  averageRssi?: number;
  notes?: string;
  scanStartTime?: string;
  scanDuration?: number;
}

interface MultiDeviceComparativeChartProps {
  selectedLocations: string[];
  locationsData: Record<string, LocationData>;
  devicesToDisplay: string[];
}

// Generate distinct colors for different devices
const generateDeviceColors = (deviceCount: number) => {
  const colors = [
    "rgb(255, 99, 132)", // Red
    "rgb(54, 162, 235)", // Blue
    "rgb(255, 205, 86)", // Yellow
    "rgb(75, 192, 192)", // Teal
    "rgb(153, 102, 255)", // Purple
    "rgb(255, 159, 64)", // Orange
    "rgb(199, 199, 199)", // Grey
    "rgb(83, 102, 147)", // Dark Blue
    "rgb(255, 99, 255)", // Pink
    "rgb(99, 255, 132)", // Green
  ];

  const result = [];
  for (let i = 0; i < deviceCount; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
};

const MultiDeviceComparativeChart: React.FC<MultiDeviceComparativeChartProps> = ({
  selectedLocations,
  locationsData,
  devicesToDisplay,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [timeseriesData, setTimeseriesData] = useState<Record<string, RssiTimeseries[]>>({});
  const [timeRange, setTimeRange] = useState<number>(30); // minutes

  // Initialize with first location and first few devices
  useEffect(() => {
    if (selectedLocations.length > 0 && !selectedLocation) {
      setSelectedLocation(selectedLocations[0]);
    }
    if (devicesToDisplay.length > 0 && selectedDevices.length === 0) {
      setSelectedDevices(devicesToDisplay.slice(0, 5)); // Start with first 5 devices
    }
  }, [selectedLocations, devicesToDisplay, selectedLocation, selectedDevices.length]);

  // Fetch timeseries data for selected devices and location
  const fetchTimeseriesData = async () => {
    if (!selectedLocation || selectedDevices.length === 0) return;

    setLoading(true);
    const newTimeseriesData: Record<string, RssiTimeseries[]> = {};

    try {
      for (const deviceId of selectedDevices) {
        const { data, error } = await safeSupabaseOperation(() =>
          supabase
            .from("rssi_timeseries")
            .select("*")
            .eq("device_id", deviceId)
            .eq("session_id", selectedLocation)
            .order("timestamp", { ascending: true })
        );

        if (!error && data) {
          // Filter by time range if specified
          let filteredData = data;
          if (timeRange > 0) {
            const cutoffTime = new Date(Date.now() - timeRange * 60 * 1000);
            filteredData = data.filter(
              (item: RssiTimeseries) => new Date(item.timestamp) >= cutoffTime
            );
          }
          newTimeseriesData[deviceId] = filteredData;
        }
      }

      setTimeseriesData(newTimeseriesData);
    } catch (error) {
      console.error("Error fetching timeseries data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeseriesData();
  }, [selectedLocation, selectedDevices, timeRange]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (Object.keys(timeseriesData).length === 0) {
      return { labels: [], datasets: [] };
    }

    // Get all unique timestamps and sort them
    const allTimestamps = new Set<string>();
    Object.values(timeseriesData).forEach((deviceData) => {
      deviceData.forEach((item: RssiTimeseries) => allTimestamps.add(item.timestamp));
    });

    const sortedTimestamps = Array.from(allTimestamps).sort();

    // Create labels from timestamps
    const labels = sortedTimestamps.map((timestamp) => {
      const date = new Date(timestamp);
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
        2,
        "0"
      )}:${String(date.getSeconds()).padStart(2, "0")}`;
    });

    // Generate colors for devices
    const deviceColors = generateDeviceColors(selectedDevices.length);

    // Create datasets for each device
    const datasets = selectedDevices.map((deviceId, index) => {
      const deviceData = timeseriesData[deviceId] || [];

      // Create data array with RSSI values at corresponding timestamps, filtering out null values
      const data = sortedTimestamps.map((timestamp) => {
        const dataPoint = deviceData.find((item) => item.timestamp === timestamp);
        return dataPoint ? dataPoint.rssi : -100; // Use -100 as default for missing data points
      });

      return {
        label: `${deviceId.substring(0, 8)}...`,
        data,
        borderColor: deviceColors[index],
        backgroundColor: deviceColors[index].replace("rgb", "rgba").replace(")", ", 0.1)"),
      };
    });

    return { labels, datasets };
  }, [timeseriesData, selectedDevices]);

  const handleDeviceSelectionChange = (checkedValues: string[]) => {
    setSelectedDevices(checkedValues.slice(0, 10)); // Limit to 10 devices for readability
  };

  const handleLocationChange = (location: string) => {
    setSelectedLocation(location);
    setTimeseriesData({}); // Clear existing data
  };

  const handleTimeRangeChange = (range: number) => {
    setTimeRange(range);
  };

  const availableDevices = useMemo(() => {
    if (!selectedLocation || !locationsData[selectedLocation]) return [];
    return Array.from(locationsData[selectedLocation].uniqueDeviceIds);
  }, [selectedLocation, locationsData]);

  const totalDataPoints = useMemo(() => {
    return Object.values(timeseriesData).reduce(
      (total, deviceData) => total + deviceData.length,
      0
    );
  }, [timeseriesData]);

  return (
    <div className="space-y-6">
      <Alert
        type="info"
        message="Multi-Device Comparative Chart View"
        description="This chart shows signal strength changes over time for multiple devices. Select devices to display and compare their signal patterns in the same session."
        showIcon
        icon={<InfoCircleOutlined />}
      />

      <Card title="Device Signal Strength Over Time" className="w-full">
        <div className="mb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Session:</label>
              <Select
                style={{ width: "100%" }}
                value={selectedLocation}
                onChange={handleLocationChange}
                placeholder="Select a session"
              >
                {selectedLocations.map((locationId) => (
                  <Option key={locationId} value={locationId}>
                    {locationsData[locationId]?.name || locationId}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Time Range:</label>
              <Select style={{ width: "100%" }} value={timeRange} onChange={handleTimeRangeChange}>
                <Option value={5}>Last 5 minutes</Option>
                <Option value={10}>Last 10 minutes</Option>
                <Option value={30}>Last 30 minutes</Option>
                <Option value={60}>Last hour</Option>
                <Option value={0}>All data</Option>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={fetchTimeseriesData}
                loading={loading}
              >
                Refresh Data
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Select Devices to Display (max 10):
            </label>
            <div className="max-h-32 overflow-y-auto border rounded p-2">
              <Checkbox.Group
                value={selectedDevices}
                onChange={handleDeviceSelectionChange}
                className="w-full"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {availableDevices.map((deviceId) => (
                    <Checkbox key={deviceId} value={deviceId} className="truncate">
                      <span className="text-xs font-mono" title={deviceId}>
                        {deviceId.substring(0, 12)}...
                      </span>
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedDevices.map((deviceId, index) => {
              const deviceColors = generateDeviceColors(selectedDevices.length);
              return (
                <Tag
                  key={deviceId}
                  color="blue"
                  style={{ borderColor: deviceColors[index] }}
                  className="text-xs"
                >
                  {deviceId.substring(0, 8)}...
                </Tag>
              );
            })}
          </div>

          {totalDataPoints > 0 && (
            <div className="text-sm text-gray-600">
              <InfoCircleOutlined className="mr-1" />
              Displaying {totalDataPoints} data points across {selectedDevices.length} devices
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" tip="Loading device signal data..." />
          </div>
        ) : selectedDevices.length === 0 ? (
          <Empty description="Please select devices to display" />
        ) : chartData.datasets.length === 0 ? (
          <Empty description="No signal data available for selected devices" />
        ) : (
          <div className="h-96">
            <LineChartComponent
              title={`High Resolution Device Signal Strength (0.5s intervals)`}
              data={chartData}
              height={350}
            />
          </div>
        )}
      </Card>

      <Card title="Signal Degradation Analysis" size="small">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Device</th>
                <th className="text-left p-2">Readings</th>
                <th className="text-left p-2">Min RSSI</th>
                <th className="text-left p-2">Max RSSI</th>
                <th className="text-left p-2">Avg RSSI</th>
                <th className="text-left p-2">Signal Change</th>
              </tr>
            </thead>
            <tbody>
              {selectedDevices.map((deviceId) => {
                const deviceData = timeseriesData[deviceId] || [];
                if (deviceData.length === 0) return null;

                const rssiValues = deviceData.map((item) => item.rssi);
                const minRssi = Math.min(...rssiValues);
                const maxRssi = Math.max(...rssiValues);
                const avgRssi = rssiValues.reduce((sum, val) => sum + val, 0) / rssiValues.length;
                const signalChange = maxRssi - minRssi;

                return (
                  <tr key={deviceId} className="border-b">
                    <td className="p-2 font-mono text-xs">{deviceId.substring(0, 12)}...</td>
                    <td className="p-2">{deviceData.length}</td>
                    <td className="p-2">
                      <Tag color={minRssi > -70 ? "green" : minRssi > -90 ? "orange" : "red"}>
                        {minRssi.toFixed(1)} dBm
                      </Tag>
                    </td>
                    <td className="p-2">
                      <Tag color={maxRssi > -70 ? "green" : maxRssi > -90 ? "orange" : "red"}>
                        {maxRssi.toFixed(1)} dBm
                      </Tag>
                    </td>
                    <td className="p-2">{avgRssi.toFixed(1)} dBm</td>
                    <td className="p-2">
                      <Tag
                        color={signalChange < 5 ? "green" : signalChange < 15 ? "orange" : "red"}
                      >
                        {signalChange.toFixed(1)} dBm
                      </Tag>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default MultiDeviceComparativeChart;
