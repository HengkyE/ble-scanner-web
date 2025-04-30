"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Divider, Button } from "@nextui-org/react";
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
        />
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
    </DashboardLayout>
  );
}
