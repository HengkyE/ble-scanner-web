import React, { useEffect, useState } from "react";
import {
  Modal,
  Spin,
  Tabs,
  Typography,
  Empty,
  Statistic,
  Card,
  Tag,
  Descriptions,
  Button,
  Select,
} from "antd";
import {
  SignalFilled,
  EnvironmentOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import RssiTimeseriesChart from "./RssiTimeseriesChart";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface Device {
  id: number;
  device_id: string;
  name?: string;
  rssi: number;
  lat?: number;
  lng?: number;
  location_id?: number;
  timestamp?: string;
  session_id?: string;
}

interface DeviceDetailModalProps {
  deviceId?: string;
  visible: boolean;
  onClose: () => void;
  sessionId?: string;
}

const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  deviceId,
  visible,
  onClose,
  sessionId,
}) => {
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<Device | null>(null);
  const [deviceSessions, setDeviceSessions] = useState<string[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | undefined>(sessionId);
  const [timeRange, setTimeRange] = useState<number>(10); // Default 10 minutes

  useEffect(() => {
    const fetchDeviceDetails = async () => {
      if (!deviceId || !visible) return;

      setLoading(true);
      try {
        // Fetch the most recent signal for this device to get basic info
        const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
          supabase
            .from("rssi_timeseries")
            .select("*")
            .eq("device_id", deviceId)
            .order("timestamp", { ascending: false })
            .limit(1)
        );

        if (deviceError || !deviceData || deviceData.length === 0) {
          console.error("Error fetching device info:", deviceError);
          return;
        }

        // Extract device details from most recent reading
        const latestReading = deviceData[0];
        setDeviceInfo({
          id: latestReading.id,
          device_id: latestReading.device_id,
          name: latestReading.device_id,
          rssi: latestReading.rssi,
          lat: latestReading.latitude,
          lng: latestReading.longitude,
          timestamp: latestReading.timestamp,
          session_id: latestReading.session_id,
        });

        // Set the initial session if not provided
        if (!sessionId) {
          setSelectedSession(latestReading.session_id);
        }

        // Fetch all sessions this device appears in
        const { data: sessionData, error: sessionError } = await safeSupabaseOperation(() =>
          supabase
            .from("rssi_timeseries")
            .select("session_id")
            .eq("device_id", deviceId)
            .order("timestamp", { ascending: false })
        );

        if (!sessionError && sessionData && sessionData.length > 0) {
          const uniqueSessions = [
            ...new Set(sessionData.map((item: any) => item.session_id)),
          ] as string[];
          setDeviceSessions(uniqueSessions);
        }
      } catch (error) {
        console.error("Error fetching device details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeviceDetails();
  }, [deviceId, visible, sessionId]);

  // Handle session change
  const handleSessionChange = (value: string) => {
    setSelectedSession(value);
  };

  // Handle time range change
  const handleTimeRangeChange = (value: number) => {
    setTimeRange(value);
  };

  // Calculate signal strength category
  const getSignalCategory = (rssi: number) => {
    if (rssi > -70) return { text: "Strong", color: "success" };
    if (rssi > -85) return { text: "Medium", color: "warning" };
    return { text: "Weak", color: "error" };
  };

  const renderDeviceDetails = () => {
    if (!deviceInfo) return <Empty description="No device information available" />;

    const signalCategory = getSignalCategory(deviceInfo.rssi);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Card className="flex-1">
            <Statistic
              title="Signal Strength"
              value={deviceInfo.rssi}
              suffix="dBm"
              valueStyle={{
                color:
                  signalCategory.color === "success"
                    ? "#3f8600"
                    : signalCategory.color === "warning"
                    ? "#d48806"
                    : "#cf1322",
              }}
              prefix={<SignalFilled />}
            />
            <Tag color={signalCategory.color} className="mt-2">
              {signalCategory.text}
            </Tag>
          </Card>

          {deviceInfo.lat && deviceInfo.lng && (
            <Card className="flex-1">
              <Statistic
                title="Location"
                value={`${deviceInfo.lat.toFixed(6)}, ${deviceInfo.lng.toFixed(6)}`}
                valueStyle={{ fontSize: "16px" }}
                prefix={<EnvironmentOutlined />}
              />
            </Card>
          )}
        </div>

        <Descriptions title="Device Information" bordered size="small" className="mt-4">
          <Descriptions.Item label="Device ID" span={3}>
            {deviceInfo.device_id}
          </Descriptions.Item>
          <Descriptions.Item label="Session" span={3}>
            {deviceInfo.session_id || "Unknown"}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated" span={3}>
            {deviceInfo.timestamp ? new Date(deviceInfo.timestamp).toLocaleString() : "Unknown"}
          </Descriptions.Item>
        </Descriptions>
      </div>
    );
  };

  const renderSignalChart = () => {
    if (!deviceId) return <Empty description="No device selected" />;

    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
          <div className="flex-1">
            <div className="text-sm font-medium mb-1">Session:</div>
            <Select
              style={{ width: "100%" }}
              value={selectedSession}
              onChange={handleSessionChange}
              options={deviceSessions.map((session) => ({
                label: session,
                value: session,
              }))}
              placeholder="Select session"
            />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium mb-1">Time Range:</div>
            <Select
              style={{ width: "100%" }}
              value={timeRange}
              onChange={handleTimeRangeChange}
              options={[
                { label: "Last minute", value: 1 },
                { label: "Last 5 minutes", value: 5 },
                { label: "Last 10 minutes", value: 10 },
                { label: "Last 30 minutes", value: 30 },
                { label: "Last hour", value: 60 },
                { label: "All data", value: 0 },
              ]}
            />
          </div>
        </div>

        <RssiTimeseriesChart
          deviceId={deviceId}
          sessionId={selectedSession}
          timeRange={timeRange || 0}
        />

        <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700 mt-2">
          <InfoCircleOutlined className="mr-2" />
          The chart shows RSSI values recorded every 0.5 seconds. Lower values (more negative)
          indicate weaker signals.
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <HistoryOutlined className="mr-2 text-blue-500" />
          <span>Device RSSI Time Series</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Spin size="large" tip="Loading device data..." />
        </div>
      ) : (
        <Tabs defaultActiveKey="chart">
          <TabPane
            tab={
              <span>
                <SignalFilled className="mr-1" />
                Signal Strength Chart
              </span>
            }
            key="chart"
          >
            {renderSignalChart()}
          </TabPane>
          <TabPane
            tab={
              <span>
                <InfoCircleOutlined className="mr-1" />
                Device Details
              </span>
            }
            key="details"
          >
            {renderDeviceDetails()}
          </TabPane>
        </Tabs>
      )}
    </Modal>
  );
};

export default DeviceDetailModal;
