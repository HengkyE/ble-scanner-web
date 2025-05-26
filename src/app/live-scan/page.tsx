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
}

export default function LiveScanPage() {
  const [state, setState] = useState<LiveScanState>({
    isScanning: false,
    sessionId: null,
    bleDevices: [],
    wifiNetworks: [],
    error: null,
  });

  const startScan = async () => {
    try {
      const sessionId = await startLiveCollection("live-scan");
      setState((prev) => ({ ...prev, isScanning: true, sessionId: sessionId }));
    } catch (error) {
      setState((prev) => ({ ...prev, error: "Failed to start scanning" }));
    }
  };

  const stopScan = async () => {
    try {
      await stopLiveCollection();
      setState((prev) => ({ ...prev, isScanning: false }));
    } catch (error) {
      setState((prev) => ({ ...prev, error: "Failed to stop scanning" }));
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (state.isScanning && state.sessionId) {
      interval = setInterval(async () => {
        try {
          const { data: bleData } = await supabase
            .from("rssi_timeseries")
            .select("*")
            .eq("session_id", state.sessionId)
            .order("timestamp", { ascending: false })
            .limit(50);

          const { data: wifiData } = await supabase
            .from("wifi_timeseries")
            .select("*")
            .eq("session_id", state.sessionId)
            .order("timestamp", { ascending: false })
            .limit(50);

          setState((prev) => ({
            ...prev,
            bleDevices: bleData || [],
            wifiNetworks: wifiData || [],
          }));
        } catch (error) {
          console.error("Error fetching scan data:", error);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.isScanning, state.sessionId]);

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
      <div className="p-4">
        <Card>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Title level={4}>Live Signal Scanner</Title>
            <Text>
              Scan for BLE devices and WiFi networks in real-time. The data will be automatically
              saved to the database.
            </Text>

            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="BLE Devices"
                  value={state.bleDevices.length}
                  prefix={<BsBluetooth />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="WiFi Networks"
                  value={state.wifiNetworks.length}
                  prefix={<WifiOutlined />}
                />
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
                      <BsBluetooth className="mr-1" />
                      BLE Devices
                    </span>
                  ),
                  children: (
                    <div className="space-y-4">
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
                      <WifiOutlined className="mr-1" />
                      WiFi Networks
                    </span>
                  ),
                  children: (
                    <Table
                      columns={wifiColumns}
                      dataSource={state.wifiNetworks}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: true }}
                    />
                  ),
                },
              ]}
            />
          </Space>
        </Card>
      </div>
    </DashboardLayout>
  );
}
