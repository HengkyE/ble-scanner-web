"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Divider, Button } from "@heroui/react";
import {
  Table,
  Space,
  Tag,
  Select as AntSelect,
  Input as AntInput,
  Button as AntButton,
  Radio,
  Tooltip,
  Typography,
  Form,
  Modal,
  Spin,
  Tabs,
} from "antd";
import { SearchOutlined, ReloadOutlined, BarChartOutlined } from "@ant-design/icons";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import RssiTimeseriesChart from "@/components/RssiTimeseriesChart";
import InlineRssiChart from "@/components/InlineRssiChart";
import { format } from "date-fns";
import { startRssiCollection, stopRssiCollection } from "@/lib/rssiCollector";

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

interface RssiTimeseriesData {
  id: number;
  device_id: string;
  rssi: number;
  timestamp: string;
  session_id: string;
  sequence_number: number;
}

export default function DevicesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [allDevices, setAllDevices] = useState<ScannedDevice[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<ScannedDevice[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tableParams, setTableParams] = useState({
    pagination: {
      current: 1,
      pageSize: 10,
      total: 0,
    },
  });

  const [signalChartData, setSignalChartData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: "Signal Strength (dBm)",
        data: [] as number[],
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ],
  });

  // New state for device modal and time series data
  const [isDeviceModalVisible, setIsDeviceModalVisible] = useState(false);
  const [selectedDeviceDetails, setSelectedDeviceDetails] = useState<ScannedDevice | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<RssiTimeseriesData[]>([]);
  const [loadingTimeseries, setLoadingTimeseries] = useState(false);
  const [timeseriesError, setTimeseriesError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeviceData();

    // Cleanup function
    return () => {
      stopRssiCollection();
    };
  }, []);

  useEffect(() => {
    if (selectedLocation || searchQuery) {
      filterDevices();
    } else {
      setFilteredDevices(allDevices);
      setTableParams({
        ...tableParams,
        pagination: {
          ...tableParams.pagination,
          total: allDevices.length,
        },
      });
    }
  }, [selectedLocation, searchQuery, allDevices]);

  const fetchDeviceData = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching device data...");

      // First get unique sessions
      const { data: sessionData, error: sessionError } = await safeSupabaseOperation(() =>
        supabase
          .from("scanned_device")
          .select("session_id")
          .order("scan_time", { ascending: false })
          .limit(1)
      );

      if (sessionError) {
        console.error("Error fetching latest session:", sessionError);
        return;
      }

      const latestSessionId = sessionData?.[0]?.session_id;
      console.log("Latest session ID:", latestSessionId);

      if (latestSessionId) {
        // Start RSSI collection for the latest session
        await startRssiCollection(latestSessionId);
      }

      // Fetch all scanned devices for the latest session
      const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
        supabase
          .from("scanned_device")
          .select("*")
          .eq("session_id", latestSessionId)
          .order("scan_time", { ascending: false })
          .limit(1000)
      );

      if (deviceError) {
        console.error("Error fetching devices:", deviceError);
        return;
      }

      console.log("Fetched device data:", {
        sessionId: latestSessionId,
        deviceCount: deviceData?.length || 0,
        firstDevice: deviceData?.[0]
          ? {
              id: deviceData[0].id,
              deviceId: deviceData[0].device_id,
              sessionId: deviceData[0].session_id,
              location: deviceData[0].location_name,
              scanTime: deviceData[0].scan_time,
            }
          : null,
      });

      if (!deviceData || deviceData.length === 0) {
        console.log("No devices found in the latest session");
        setAllDevices([]);
        setFilteredDevices([]);
        return;
      }

      setAllDevices(deviceData);
      setFilteredDevices(deviceData);
      setTableParams({
        ...tableParams,
        pagination: {
          ...tableParams.pagination,
          total: deviceData.length,
        },
      });

      // Extract unique locations
      const uniqueLocations = [
        ...new Set(deviceData.map((device: ScannedDevice) => device.location_name).filter(Boolean)),
      ] as string[];
      setLocations(uniqueLocations);

      // Extract unique device IDs
      const uniqueDeviceIds = [
        ...new Set(deviceData.map((device: ScannedDevice) => device.device_id).filter(Boolean)),
      ] as string[];
      setDevices(uniqueDeviceIds);

      console.log("Processed device data:", {
        uniqueLocations,
        uniqueDeviceIds,
        totalDevices: deviceData.length,
      });

      // Set defaults if available
      if (uniqueLocations.length > 0) {
        setSelectedLocation(uniqueLocations[0]);
      }
      if (uniqueDeviceIds.length > 0) {
        setSelectedDevice(uniqueDeviceIds[0]);
      }
    } catch (error) {
      console.error("Error in fetchDeviceData:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterDevices = () => {
    let filtered = [...allDevices];

    if (selectedLocation) {
      filtered = filtered.filter((device) => device.location_name === selectedLocation);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (device) =>
          (device.device_id && device.device_id.toLowerCase().includes(query)) ||
          (device.device_name && device.device_name.toLowerCase().includes(query)) ||
          (device.manufacturer_data && device.manufacturer_data.toLowerCase().includes(query))
      );
    }

    setFilteredDevices(filtered);
    setTableParams({
      ...tableParams,
      pagination: {
        ...tableParams.pagination,
        current: 1,
        total: filtered.length,
      },
    });
  };

  const handleLocationChange = (location: string) => {
    setSelectedLocation(location);
  };

  const handleDeviceChange = (device: string) => {
    setSelectedDevice(device);
  };

  const analyzeDeviceSignal = () => {
    if (!selectedDevice) return;

    setIsLoading(true);

    try {
      // Filter by selected device and location if provided
      let filtered = allDevices.filter((device) => device.device_id === selectedDevice);

      if (selectedLocation) {
        filtered = filtered.filter((device) => device.location_name === selectedLocation);
      }

      // Sort by scan time ascending
      filtered.sort((a, b) => new Date(a.scan_time).getTime() - new Date(b.scan_time).getTime());

      // Prepare chart data
      const timestamps = filtered.map((device) => {
        const date = new Date(device.scan_time);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(
          date.getMinutes()
        ).padStart(2, "0")}`;
      });

      const rssiValues = filtered.map((device) => Math.abs(device.rssi));

      setSignalChartData({
        labels: timestamps,
        datasets: [
          {
            label: "Signal Strength (dBm)",
            data: rssiValues,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.5)",
          },
        ],
      });
    } catch (error) {
      console.error("Error in analyzeDeviceSignal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // New function to handle device row click
  const handleDeviceRowClick = async (device: ScannedDevice) => {
    setSelectedDeviceDetails(device);
    setIsDeviceModalVisible(true);
    await fetchTimeseriesData(device.device_id, device.session_id);
  };

  // Fetch time series data for a specific device and session
  const fetchTimeseriesData = async (deviceId: string, sessionId: string) => {
    setLoadingTimeseries(true);
    setTimeseriesError(null);

    try {
      const { data, error } = await safeSupabaseOperation(() =>
        supabase
          .from("rssi_timeseries")
          .select("*")
          .eq("device_id", deviceId)
          .eq("session_id", sessionId)
          .order("timestamp", { ascending: true })
      );

      if (error) {
        console.error("Error fetching RSSI timeseries data:", error);
        setTimeseriesError(`Error fetching data: ${error.message}`);
        return;
      }

      setTimeseriesData(data as RssiTimeseriesData[]);

      // Create chart data from time series
      if (data && data.length > 0) {
        const timestamps = data.map((item: RssiTimeseriesData) => {
          const date = new Date(item.timestamp);
          return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
            2,
            "0"
          )}:${String(date.getSeconds()).padStart(2, "0")}`;
        });

        const rssiValues = data.map((item: RssiTimeseriesData) => item.rssi);

        setSignalChartData({
          labels: timestamps,
          datasets: [
            {
              label: "Signal Strength (dBm)",
              data: rssiValues,
              borderColor: "rgb(75, 192, 192)",
              backgroundColor: "rgba(75, 192, 192, 0.5)",
            },
          ],
        });
      }
    } catch (err) {
      console.error("Error in fetchTimeseriesData:", err);
      setTimeseriesError(`An unexpected error occurred: ${(err as Error).message}`);
    } finally {
      setLoadingTimeseries(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "MMM dd, yyyy HH:mm:ss");
    } catch (error) {
      return timestamp;
    }
  };

  // Ant Design table columns
  const columns = [
    {
      title: "Device ID",
      dataIndex: "device_id",
      key: "device_id",
      render: (text: string) => (
        <Typography.Text copyable style={{ fontSize: "14px" }}>
          {text}
        </Typography.Text>
      ),
    },
    {
      title: "Device Name",
      dataIndex: "device_name",
      key: "device_name",
      render: (text: string | null) => text || "Unknown",
    },
    {
      title: "Location",
      dataIndex: "location_name",
      key: "location_name",
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "RSSI",
      dataIndex: "rssi",
      key: "rssi",
      render: (value: number) => {
        const color = value > -70 ? "green" : value > -90 ? "orange" : "red";
        return <Tag color={color}>{value} dBm</Tag>;
      },
    },
    {
      title: "RSSI Over Time",
      key: "rssi_chart",
      width: 200,
      render: (_: any, record: ScannedDevice) => {
        console.log("Rendering RSSI chart for device:", {
          deviceId: record.device_id,
          sessionId: record.session_id,
          location: record.location_name,
          scanTime: record.scan_time,
        });

        return <InlineRssiChart deviceId={record.device_id} sessionId={record.session_id} />;
      },
    },
    {
      title: "Scan Time",
      dataIndex: "scan_time",
      key: "scan_time",
      render: (text: string) => format(new Date(text), "MMM d, yyyy HH:mm:ss"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: ScannedDevice) => (
        <Space>
          <AntButton
            type="primary"
            icon={<BarChartOutlined />}
            onClick={() => handleDeviceRowClick(record)}
          >
            Analyze
          </AntButton>
        </Space>
      ),
    },
  ];

  const handleTableChange = (pagination: any) => {
    setTableParams({
      pagination,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">BLE Devices Analysis</h1>
          <div className="text-gray-600">
            Analyze BLE device signal patterns and characteristics
          </div>
        </div>

        <Card title="Device Signal Analysis" className="mb-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="mb-2">Location</div>
                <AntSelect
                  style={{ width: "100%" }}
                  value={selectedLocation}
                  onChange={handleLocationChange}
                  allowClear
                  placeholder="Select location"
                >
                  {locations.map((loc) => (
                    <AntSelect.Option key={loc} value={loc}>
                      {loc}
                    </AntSelect.Option>
                  ))}
                </AntSelect>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="mb-2">BLE Device</div>
                <AntSelect
                  style={{ width: "100%" }}
                  value={selectedDevice}
                  onChange={handleDeviceChange}
                  allowClear
                  placeholder="Select device"
                  showSearch
                  optionFilterProp="children"
                >
                  {devices.map((dev) => (
                    <AntSelect.Option key={dev} value={dev}>
                      {dev}
                    </AntSelect.Option>
                  ))}
                </AntSelect>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="mb-2">Find Devices</div>
                <AntInput
                  placeholder="Search device ID or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  suffix={<SearchOutlined style={{ color: "#999" }} />}
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="bg-white rounded-lg shadow">
          <Table
            columns={columns}
            dataSource={filteredDevices}
            rowKey="id"
            pagination={tableParams.pagination}
            onChange={handleTableChange}
            loading={isLoading}
            scroll={{ x: true }}
          />
        </div>

        <Modal
          title={`Device Analysis: ${selectedDeviceDetails?.device_id || ""}`}
          open={isDeviceModalVisible}
          onCancel={() => setIsDeviceModalVisible(false)}
          width={800}
          footer={null}
        >
          {selectedDeviceDetails && (
            <div className="space-y-6">
              <Tabs>
                <Tabs.TabPane tab="Signal Strength Analysis" key="1">
                  <div className="h-[400px]">
                    <RssiTimeseriesChart
                      deviceId={selectedDeviceDetails.device_id}
                      sessionId={selectedDeviceDetails.session_id}
                      timeRange={30}
                    />
                  </div>
                </Tabs.TabPane>
                <Tabs.TabPane tab="Device Details" key="2">
                  <div className="space-y-4">
                    <div>
                      <div className="font-semibold">Device Information</div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <div className="text-gray-500">Device ID</div>
                          <div>{selectedDeviceDetails.device_id}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Device Name</div>
                          <div>{selectedDeviceDetails.device_name || "Unknown"}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Location</div>
                          <div>{selectedDeviceDetails.location_name}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Latest RSSI</div>
                          <div>{selectedDeviceDetails.rssi} dBm</div>
                        </div>
                      </div>
                    </div>
                    {selectedDeviceDetails.manufacturer_data && (
                      <div>
                        <div className="font-semibold">Manufacturer Data</div>
                        <div className="mt-2 font-mono text-sm bg-gray-50 p-2 rounded">
                          {selectedDeviceDetails.manufacturer_data}
                        </div>
                      </div>
                    )}
                    {selectedDeviceDetails.service_uuids && (
                      <div>
                        <div className="font-semibold">Service UUIDs</div>
                        <div className="mt-2">
                          {JSON.parse(selectedDeviceDetails.service_uuids).map(
                            (uuid: string, index: number) => (
                              <Tag key={index}>{uuid}</Tag>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Tabs.TabPane>
              </Tabs>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
