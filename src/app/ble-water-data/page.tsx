"use client";

import { useState, useEffect } from "react";
import {
  Table,
  Input,
  Space,
  Spin,
  Card,
  Button,
  Select,
  DatePicker,
  Drawer,
  Descriptions,
  Tag,
  Typography,
} from "antd";
import { SearchOutlined, ReloadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { format } from "date-fns";
import type { TableProps } from "antd";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import { BleDevice, WaterLevelMeasurement } from "@/types";
import DashboardLayout from "@/components/DashboardLayout";

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

interface BleDataWithMeasurement extends BleDevice {
  water_level_cm?: number | null;
  location_name?: string | null;
  measurement_timestamp?: string;
  water_level_measurement?: WaterLevelMeasurement;
}

export default function BleWaterDataPage() {
  const [data, setData] = useState<BleDataWithMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [sortField, setSortField] = useState<string>("timestamp");
  const [sortOrder, setSortOrder] = useState<string>("descend");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BleDataWithMeasurement | null>(null);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      // Query BLE data with water level measurement join
      const {
        data: bleData,
        error: bleError,
        count,
      } = await safeSupabaseOperation(() =>
        supabase
          .from("ble_data")
          .select(
            `
            *,
            water_level_measurements:water_level_measurement_id (
              id,
              water_level_cm,
              location_name,
              latitude,
              longitude,
              rssi_wifi,
              timestamp,
              notes,
              measurement_type,
              created_at
            )
          `,
            { count: "exact" }
          )
          .order(sortField, { ascending: sortOrder === "ascend" })
          .range(
            (pagination.current - 1) * pagination.pageSize,
            pagination.current * pagination.pageSize - 1
          )
      );

      if (bleError) {
        console.error("Error fetching data:", bleError);
        return;
      }

      // Transform data to include water level information
      const transformedData = bleData.map((item: any) => ({
        ...item,
        water_level_cm: item.water_level_measurements?.water_level_cm,
        location_name: item.water_level_measurements?.location_name,
        measurement_timestamp: item.water_level_measurements?.timestamp,
        water_level_measurement: item.water_level_measurements,
      }));

      setData(transformedData);
      setPagination({
        ...pagination,
        total: count || 0,
      });
    } catch (error) {
      console.error("Error in fetchData:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize, sortField, sortOrder]);

  const handleTableChange: TableProps<BleDataWithMeasurement>["onChange"] = (
    paginationParams,
    filters,
    sorter
  ) => {
    setPagination({
      current: paginationParams.current || 1,
      pageSize: paginationParams.pageSize || 10,
      total: pagination.total,
    });

    if (Array.isArray(sorter)) {
      const sorterObj = sorter[0];
      setSortField(sorterObj.field as string);
      setSortOrder(sorterObj.order || "descend");
    } else if (sorter.field) {
      setSortField(sorter.field as string);
      setSortOrder(sorter.order || "descend");
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPagination({ ...pagination, current: 1 });

    // Implement client-side search since we've already loaded the data
    if (value) {
      const filteredData = data.filter(
        (item) =>
          item.device_id.toLowerCase().includes(value.toLowerCase()) ||
          (item.device_name && item.device_name.toLowerCase().includes(value.toLowerCase())) ||
          (item.location_name && item.location_name.toLowerCase().includes(value.toLowerCase()))
      );
      setData(filteredData);
    } else {
      fetchData();
    }
  };

  const handleRowClick = (record: BleDataWithMeasurement) => {
    setSelectedRecord(record);
    setDrawerVisible(true);
  };

  const columns = [
    {
      title: "Device ID",
      dataIndex: "device_id",
      key: "device_id",
      sorter: true,
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: "Device Name",
      dataIndex: "device_name",
      key: "device_name",
      sorter: true,
      render: (text: string | null) => text || "-",
    },
    {
      title: "RSSI",
      dataIndex: "rssi",
      key: "rssi",
      sorter: true,
      render: (rssi: number) => (
        <span
          className={rssi > -70 ? "text-green-600" : rssi > -90 ? "text-amber-600" : "text-red-600"}
        >
          {rssi} dBm
        </span>
      ),
    },
    {
      title: "Water Level",
      dataIndex: "water_level_cm",
      key: "water_level_cm",
      sorter: true,
      render: (level: number | null) => (level ? `${level} cm` : "-"),
    },
    {
      title: "Location",
      dataIndex: "location_name",
      key: "location_name",
      sorter: true,
      render: (text: string | null) => text || "-",
    },
    {
      title: "BLE Timestamp",
      dataIndex: "timestamp",
      key: "timestamp",
      sorter: true,
      render: (text: string) => format(new Date(text), "MMM d, yyyy HH:mm:ss"),
    },
    {
      title: "Measurement Timestamp",
      dataIndex: "measurement_timestamp",
      key: "measurement_timestamp",
      sorter: true,
      render: (text: string) => (text ? format(new Date(text), "MMM d, yyyy HH:mm:ss") : "-"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: BleDataWithMeasurement) => (
        <Button
          type="text"
          icon={<InfoCircleOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick(record);
          }}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 text-gray-900">BLE Water Level Data</h1>
        <p className="text-gray-600">
          View BLE device data associated with water level measurements
        </p>
      </div>

      <Card className="mb-6">
        <Space className="mb-4 w-full justify-between flex-wrap">
          <Space>
            <Search
              placeholder="Search devices"
              allowClear
              onSearch={handleSearch}
              style={{ width: 250 }}
            />
          </Space>
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => fetchData()}>
            Refresh
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => `Total ${total} items`,
          }}
          loading={loading}
          onChange={handleTableChange}
          scroll={{ x: "max-content" }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
          })}
        />
      </Card>

      <Drawer
        title={
          <div>
            <Title level={4}>Device Details</Title>
            <Text type="secondary">{selectedRecord?.device_name || selectedRecord?.device_id}</Text>
          </div>
        }
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={500}
      >
        {selectedRecord && (
          <div>
            <Descriptions title="BLE Device Information" bordered column={1}>
              <Descriptions.Item label="Device ID">{selectedRecord.device_id}</Descriptions.Item>
              <Descriptions.Item label="Device Name">
                {selectedRecord.device_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="RSSI">
                <Tag
                  color={
                    selectedRecord.rssi > -70
                      ? "green"
                      : selectedRecord.rssi > -90
                      ? "orange"
                      : "red"
                  }
                >
                  {selectedRecord.rssi} dBm
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Timestamp">
                {format(new Date(selectedRecord.timestamp), "MMM d, yyyy HH:mm:ss")}
              </Descriptions.Item>
              {selectedRecord.tx_power_level && (
                <Descriptions.Item label="TX Power Level">
                  {selectedRecord.tx_power_level} dBm
                </Descriptions.Item>
              )}
              {selectedRecord.manufacturer_data && (
                <Descriptions.Item label="Manufacturer Data">
                  {selectedRecord.manufacturer_data}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedRecord.water_level_measurement && (
              <Descriptions title="Water Level Measurement" bordered column={1} className="mt-6">
                <Descriptions.Item label="Water Level">
                  {selectedRecord.water_level_cm ? (
                    <Tag color="blue">{selectedRecord.water_level_cm} cm</Tag>
                  ) : (
                    "-"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Location Name">
                  {selectedRecord.location_name || "-"}
                </Descriptions.Item>
                {selectedRecord.water_level_measurement.latitude &&
                  selectedRecord.water_level_measurement.longitude && (
                    <Descriptions.Item label="Coordinates">
                      {`${selectedRecord.water_level_measurement.latitude}, ${selectedRecord.water_level_measurement.longitude}`}
                    </Descriptions.Item>
                  )}
                <Descriptions.Item label="Measurement Time">
                  {selectedRecord.measurement_timestamp
                    ? format(new Date(selectedRecord.measurement_timestamp), "MMM d, yyyy HH:mm:ss")
                    : "-"}
                </Descriptions.Item>
                {selectedRecord.water_level_measurement.measurement_type && (
                  <Descriptions.Item label="Measurement Type">
                    {selectedRecord.water_level_measurement.measurement_type}
                  </Descriptions.Item>
                )}
                {selectedRecord.water_level_measurement.notes && (
                  <Descriptions.Item label="Notes">
                    {selectedRecord.water_level_measurement.notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}
          </div>
        )}
      </Drawer>
    </DashboardLayout>
  );
}
