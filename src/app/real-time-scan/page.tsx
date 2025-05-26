"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Space,
  Button,
  Typography,
  Table,
  Tag,
  Tabs,
  Statistic,
  Row,
  Col,
  Alert,
  Progress,
  Select,
  Tooltip,
} from "antd";
import { WifiOutlined, LineChartOutlined } from "@ant-design/icons";
import { BsBluetooth } from "react-icons/bs";
import DashboardLayout from "@/components/DashboardLayout";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import { startLiveCollection, stopLiveCollection } from "@/lib/rssiCollector";
import dynamic from "next/dynamic";

const { Title, Text } = Typography;

// Dynamically import charts to avoid SSR issues
const RssiTimeseriesChart = dynamic(() => import("@/components/RssiTimeseriesChart"), {
  ssr: false,
});

interface LiveScanState {
  isScanning: boolean;
  sessionId: string | null;
  bleDevices: any[];
  wifiNetworks: any[];
  error: string | null;
  scanDuration: number;
  selectedTimeWindow: number;
  signalQualityStats: {
    ble: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
    wifi: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  };
}

const TIME_WINDOWS = [
  { label: "Last 30 seconds", value: 30 },
  { label: "Last 1 minute", value: 60 },
  { label: "Last 5 minutes", value: 300 },
];

export default function RealTimeScanPage() {
  const [state, setState] = useState<LiveScanState>({
    isScanning: false,
    sessionId: null,
    bleDevices: [],
    wifiNetworks: [],
    error: null,
    scanDuration: 0,
    selectedTimeWindow: 30,
    signalQualityStats: {
      ble: { excellent: 0, good: 0, fair: 0, poor: 0 },
      wifi: { excellent: 0, good: 0, fair: 0, poor: 0 },
    },
  });

  // Update scan duration and cleanup on unmount
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (state.isScanning) {
      interval = setInterval(() => {
        setState((prev) => ({ ...prev, scanDuration: prev.scanDuration + 1 }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (state.isScanning) {
        stopLiveCollection();
      }
    };
  }, [state.isScanning]);

  // Update signal quality stats
  useEffect(() => {
    const updateSignalStats = () => {
      const bleStats = {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      };

      const wifiStats = {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      };

      state.bleDevices.forEach((device) => {
        if (device.rssi > -70) bleStats.excellent++;
        else if (device.rssi > -80) bleStats.good++;
        else if (device.rssi > -90) bleStats.fair++;
        else bleStats.poor++;
      });

      state.wifiNetworks.forEach((network) => {
        if (network.signal_strength > -50) wifiStats.excellent++;
        else if (network.signal_strength > -70) wifiStats.good++;
        else if (network.signal_strength > -80) wifiStats.fair++;
        else wifiStats.poor++;
      });

      setState((prev) => ({
        ...prev,
        signalQualityStats: {
          ble: bleStats,
          wifi: wifiStats,
        },
      }));
    };

    updateSignalStats();
  }, [state.bleDevices, state.wifiNetworks]);

  const startScan = async () => {
    try {
      const sessionId = `realtime_${Date.now()}`;
      await startLiveCollection(sessionId);
      setState((prev) => ({
        ...prev,
        isScanning: true,
        sessionId,
        error: null,
        scanDuration: 0,
        bleDevices: [],
        wifiNetworks: [],
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: "Failed to start scanning. Please try again.",
      }));
    }
  };

  const stopScan = () => {
    console.log("Stopping scan...");
    stopLiveCollection();
    setState((prev) => ({
      ...prev,
      isScanning: false,
    }));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderSignalQualitySection = (type: "ble" | "wifi") => {
    const stats = state.signalQualityStats[type];
    const total = Object.values(stats).reduce((a, b) => a + b, 0);

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Text>Excellent</Text>
          <Progress
            percent={total ? Math.round((stats.excellent / total) * 100) : 0}
            strokeColor="green"
            size="small"
          />
        </div>
        <div className="flex justify-between items-center">
          <Text>Good</Text>
          <Progress
            percent={total ? Math.round((stats.good / total) * 100) : 0}
            strokeColor="blue"
            size="small"
          />
        </div>
        <div className="flex justify-between items-center">
          <Text>Fair</Text>
          <Progress
            percent={total ? Math.round((stats.fair / total) * 100) : 0}
            strokeColor="orange"
            size="small"
          />
        </div>
        <div className="flex justify-between items-center">
          <Text>Poor</Text>
          <Progress
            percent={total ? Math.round((stats.poor / total) * 100) : 0}
            strokeColor="red"
            size="small"
          />
        </div>
      </div>
    );
  };

  const bleColumns = [
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
      title: "RSSI",
      dataIndex: "rssi",
      key: "rssi",
      render: (value: number) => {
        const color = value > -70 ? "green" : value > -90 ? "orange" : "red";
        return <Tag color={color}>{value} dBm</Tag>;
      },
    },
    {
      title: "Last Updated",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (text: string) => new Date(text).toLocaleTimeString(),
    },
  ];

  const wifiColumns = [
    {
      title: "SSID",
      dataIndex: "ssid",
      key: "ssid",
    },
    {
      title: "BSSID",
      dataIndex: "bssid",
      key: "bssid",
      render: (text: string) => (
        <Typography.Text copyable style={{ fontSize: "14px" }}>
          {text}
        </Typography.Text>
      ),
    },
    {
      title: "Signal Strength",
      dataIndex: "signal_strength",
      key: "signal_strength",
      render: (value: number) => {
        const color = value > -50 ? "green" : value > -70 ? "orange" : "red";
        return <Tag color={color}>{value} dBm</Tag>;
      },
    },
    {
      title: "Last Updated",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (text: string) => new Date(text).toLocaleTimeString(),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Title level={2}>Real-Time Signal Scanner</Title>
          <Text className="text-gray-600">
            Advanced real-time signal strength monitoring and analysis for BLE devices and WiFi
            networks
          </Text>
        </div>

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card>
              <Space direction="vertical" style={{ width: "100%" }} size="large">
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic
                      title="BLE Devices"
                      value={state.bleDevices.length}
                      prefix={<BsBluetooth />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="WiFi Networks"
                      value={state.wifiNetworks.length}
                      prefix={<WifiOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Scan Duration"
                      value={formatDuration(state.scanDuration)}
                      prefix={<LineChartOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <div>
                      <div className="mb-2">Time Window</div>
                      <Select
                        value={state.selectedTimeWindow}
                        onChange={(value) =>
                          setState((prev) => ({ ...prev, selectedTimeWindow: value }))
                        }
                        style={{ width: "100%" }}
                        disabled={state.isScanning}
                        options={TIME_WINDOWS}
                      />
                    </div>
                  </Col>
                </Row>

                <Button
                  type={state.isScanning ? "default" : "primary"}
                  icon={<LineChartOutlined />}
                  onClick={state.isScanning ? stopScan : startScan}
                  loading={state.isScanning}
                  size="large"
                  style={{ width: "200px" }}
                >
                  {state.isScanning ? "Stop Scanning" : "Start Scanning"}
                </Button>

                {state.error && (
                  <Alert
                    message="Error"
                    description={state.error}
                    type="error"
                    closable
                    onClose={() => setState((prev) => ({ ...prev, error: null }))}
                  />
                )}

                <Tabs
                  defaultActiveKey="1"
                  items={[
                    {
                      key: "1",
                      label: (
                        <span>
                          <BsBluetooth />
                          BLE Devices
                        </span>
                      ),
                      children: (
                        <div className="space-y-4">
                          <Alert
                            message="BLE Scanning Information"
                            description={
                              <>
                                <p>
                                  Click "Start Scanning" to begin scanning for BLE devices. Each
                                  time a device is discovered, you will need to give permission to
                                  access it.
                                </p>
                                <p>
                                  The scan will continue to collect data from discovered devices.
                                  Previously discovered devices will remain in the list until you
                                  stop scanning.
                                </p>
                              </>
                            }
                            type="info"
                            showIcon
                            className="mb-4"
                          />
                          {state.sessionId && state.bleDevices.length > 0 && (
                            <div style={{ height: "300px" }}>
                              <RssiTimeseriesChart
                                deviceId={state.bleDevices[0].device_id}
                                sessionId={state.sessionId}
                                timeRange={5}
                              />
                            </div>
                          )}
                          <Table
                            columns={bleColumns}
                            dataSource={state.bleDevices}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: true }}
                          />
                        </div>
                      ),
                    },
                    {
                      key: "2",
                      label: (
                        <span>
                          <WifiOutlined />
                          WiFi Networks
                        </span>
                      ),
                      children: (
                        <div>
                          <Alert
                            message="WiFi Scanning Not Available"
                            description="WiFi scanning is not available in web browsers due to security restrictions. This feature requires a native application or system-level access."
                            type="info"
                            showIcon
                            className="mb-4"
                          />
                          <Table
                            columns={wifiColumns}
                            dataSource={state.wifiNetworks}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: true }}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </DashboardLayout>
  );
}
