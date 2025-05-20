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
} from "antd";
import { SearchOutlined, ReloadOutlined, BarChartOutlined } from "@ant-design/icons";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import LineChartComponent from "@/components/LineChart";
import { format } from "date-fns";

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
      // Fetch all scanned devices
      const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
        supabase
          .from("scanned_device")
          .select("*")
          .order("scan_time", { ascending: false })
          .limit(1000)
      );

      if (deviceError) {
        console.error("Error fetching devices:", deviceError);
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
      render: (text: string) => <span className="font-mono text-xs">{text}</span>,
    },
    {
      title: "Device Name",
      dataIndex: "device_name",
      key: "device_name",
      render: (text: string | null) => text || <span className="text-gray-400">Unnamed</span>,
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
      render: (rssi: number) => {
        // Define color based on signal strength
        let color = "red";
        if (rssi > -70) color = "green";
        else if (rssi > -90) color = "orange";

        return <Tag color={color}>{rssi} dBm</Tag>;
      },
      sorter: (a: ScannedDevice, b: ScannedDevice) => a.rssi - b.rssi,
    },
    {
      title: "Scan Time",
      dataIndex: "scan_time",
      key: "scan_time",
      render: (text: string) => formatTimestamp(text),
      sorter: (a: ScannedDevice, b: ScannedDevice) =>
        new Date(a.scan_time).getTime() - new Date(b.scan_time).getTime(),
    },
  ];

  const handleTableChange = (pagination: any) => {
    setTableParams({
      pagination,
    });
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">BLE Devices Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="bg-white shadow-sm border border-gray-100">
          <CardHeader className="pb-2">
            <h3 className="text-lg font-semibold text-gray-900">Device Signal Analysis</h3>
          </CardHeader>
          <Divider className="opacity-50" />
          <CardBody>
            <Form layout="vertical" className="space-y-4">
              <Form.Item label="Location" className="mb-0">
                <AntSelect
                  placeholder="Select a location (Optional)"
                  value={selectedLocation || undefined}
                  onChange={handleLocationChange}
                  disabled={isLoading}
                  allowClear
                  showSearch
                  style={{ width: "100%" }}
                  optionFilterProp="children"
                  className="rounded-md"
                >
                  {locations.map((location) => (
                    <AntSelect.Option key={location} value={location}>
                      {location}
                    </AntSelect.Option>
                  ))}
                </AntSelect>
              </Form.Item>

              <Form.Item
                label="BLE Device"
                className="mb-2"
                tooltip="Select a Bluetooth Low Energy device to analyze"
              >
                <AntSelect
                  placeholder="Select a device"
                  value={selectedDevice || undefined}
                  onChange={handleDeviceChange}
                  disabled={isLoading || devices.length === 0}
                  showSearch
                  style={{ width: "100%" }}
                  optionFilterProp="children"
                  className="rounded-md"
                  notFoundContent={isLoading ? "Loading..." : "No devices found"}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider className="my-2" />
                      <Typography.Text className="px-3 py-2 text-xs text-gray-500 block">
                        {devices.length} devices available
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
                  onClick={analyzeDeviceSignal}
                  disabled={isLoading || !selectedDevice}
                  loading={isLoading}
                  icon={<BarChartOutlined />}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Analyze Signal Strength
                </AntButton>

                <Tooltip title="Refresh device data">
                  <AntButton
                    icon={<ReloadOutlined />}
                    onClick={fetchDeviceData}
                    disabled={isLoading}
                  />
                </Tooltip>
              </Space>
            </Form>
          </CardBody>
        </Card>

        <Card className="bg-white shadow-sm border border-gray-100">
          <CardHeader className="pb-2">
            <h3 className="text-lg font-semibold text-gray-900">Device Statistics</h3>
          </CardHeader>
          <Divider className="opacity-50" />
          <CardBody>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="text-sm font-semibold text-gray-600">Total Devices</div>
                <div className="text-2xl font-bold mt-1 text-gray-900">{devices.length}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="text-sm font-semibold text-gray-600">Total Scans</div>
                <div className="text-2xl font-bold mt-1 text-gray-900">{allDevices.length}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="text-sm font-semibold text-gray-600">Locations</div>
                <div className="text-2xl font-bold mt-1 text-gray-900">{locations.length}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="text-sm font-semibold text-gray-600">Last Scan</div>
                <div className="text-lg font-bold mt-1 text-gray-900">
                  {allDevices.length > 0
                    ? formatTimestamp(allDevices[0].scan_time).split(",")[0]
                    : "N/A"}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {signalChartData.labels.length > 0 && (
        <div className="mb-6">
          <LineChartComponent
            title={`Signal Strength Over Time - ${selectedDevice}${
              selectedLocation ? ` at ${selectedLocation}` : ""
            }`}
            data={signalChartData}
            height={400}
          />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <Space direction="vertical" style={{ width: "100%", maxWidth: "400px" }}>
          <Typography.Text strong>Find Devices</Typography.Text>
          <Space.Compact style={{ width: "100%" }}>
            <AntInput
              placeholder="Search device ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              prefix={<SearchOutlined className="text-gray-400" />}
            />
            <AntButton type="primary" onClick={filterDevices}>
              Search
            </AntButton>
          </Space.Compact>
        </Space>

        <Radio.Group
          value={tableParams.pagination.pageSize}
          onChange={(e) =>
            setTableParams({
              ...tableParams,
              pagination: {
                ...tableParams.pagination,
                pageSize: e.target.value,
              },
            })
          }
        >
          <Radio.Button value={10}>10</Radio.Button>
          <Radio.Button value={20}>20</Radio.Button>
          <Radio.Button value={50}>50</Radio.Button>
        </Radio.Group>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
        <Table
          columns={columns}
          dataSource={filteredDevices.map((device) => ({ ...device, key: device.id }))}
          loading={isLoading}
          pagination={{
            ...tableParams.pagination,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} devices`,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          onChange={handleTableChange}
          scroll={{ x: 800 }}
          size="middle"
          onRow={(record) => ({
            onClick: () => handleDeviceRowClick(record),
            style: { cursor: "pointer" },
          })}
        />
        <div className="p-3 text-sm text-gray-500 border-t">
          <Tooltip title="Click on any device row to view detailed RSSI time series data">
            <span>Click on any device to view detailed signal data over time</span>
          </Tooltip>
        </div>
      </div>

      <Card className="bg-white shadow-sm border border-gray-100">
        <CardBody>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">About BLE Signal Strength</h3>
          <p className="text-gray-600">
            Bluetooth Low Energy (BLE) signal strength is measured in dBm (decibels relative to a
            milliwatt). The values are typically negative, with closer to zero meaning stronger
            signal strength. For example, -50 dBm is stronger than -80 dBm.
          </p>
          <p className="text-gray-600 mt-2">
            Factors affecting signal strength include distance between devices, physical obstacles,
            device orientation, and environmental interference. The relationship between distance
            and signal strength typically follows an inverse square law but can be unpredictable in
            real-world environments.
          </p>
        </CardBody>
      </Card>

      {/* Device Details Modal */}
      <Modal
        title={
          <div>
            <h3 className="text-lg font-semibold">
              Device Details
              {selectedDeviceDetails?.device_name && (
                <span className="ml-2 text-gray-500">({selectedDeviceDetails.device_name})</span>
              )}
            </h3>
            <p className="text-xs font-mono mt-1">{selectedDeviceDetails?.device_id}</p>
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
        {selectedDeviceDetails && (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Typography.Text strong>Location</Typography.Text>
                <div>
                  <Tag color="blue">{selectedDeviceDetails.location_name}</Tag>
                </div>
              </div>
              <div>
                <Typography.Text strong>Session ID</Typography.Text>
                <div>
                  <Tag color="purple">{selectedDeviceDetails.session_id}</Tag>
                </div>
              </div>
              <div>
                <Typography.Text strong>RSSI</Typography.Text>
                <div>
                  <Tag
                    color={
                      selectedDeviceDetails.rssi > -70
                        ? "green"
                        : selectedDeviceDetails.rssi > -90
                        ? "orange"
                        : "red"
                    }
                  >
                    {selectedDeviceDetails.rssi} dBm
                  </Tag>
                </div>
              </div>
              <div>
                <Typography.Text strong>Scan Time</Typography.Text>
                <div>{formatTimestamp(selectedDeviceDetails.scan_time)}</div>
              </div>
              {selectedDeviceDetails.manufacturer_data && (
                <div className="col-span-2">
                  <Typography.Text strong>Manufacturer Data</Typography.Text>
                  <div className="font-mono text-xs overflow-auto max-h-20 p-2 bg-gray-50 rounded">
                    {selectedDeviceDetails.manufacturer_data}
                  </div>
                </div>
              )}
              {selectedDeviceDetails.service_uuids && (
                <div className="col-span-2">
                  <Typography.Text strong>Service UUIDs</Typography.Text>
                  <div className="font-mono text-xs overflow-auto max-h-20 p-2 bg-gray-50 rounded">
                    {selectedDeviceDetails.service_uuids}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4 text-center">
              <h4 className="text-base font-medium text-gray-700 my-3">Time Series Data</h4>
              <hr className="border-t border-gray-200" />
            </div>

            {loadingTimeseries ? (
              <div className="flex items-center justify-center h-[300px]">
                <Spin size="large" tip="Loading RSSI time series data..." />
              </div>
            ) : timeseriesError ? (
              <div className="flex flex-col items-center justify-center h-[300px]">
                <Typography.Text type="danger">{timeseriesError}</Typography.Text>
              </div>
            ) : timeseriesData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="text-center">
                  <Typography.Text type="secondary">
                    No time series data available for this device in this session.
                  </Typography.Text>
                  <div className="mt-2">
                    <Typography.Text type="secondary" className="text-xs">
                      Time series data is only available for recent scans that were configured to
                      collect detailed RSSI measurements.
                    </Typography.Text>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <LineChartComponent
                  title={`RSSI Time Series for ${selectedDeviceDetails.device_id}`}
                  data={signalChartData}
                  height={300}
                />
                <div className="text-xs text-gray-500 mt-2 text-center">
                  {timeseriesData.length} data points from session{" "}
                  {selectedDeviceDetails.session_id}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
