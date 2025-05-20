import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  TimeScale,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Spin, Empty, Typography } from "antd";
import "chartjs-adapter-date-fns";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, TimeScale);

const { Text } = Typography;

interface RssiTimeseriesData {
  id: number;
  device_id: string;
  rssi: number;
  timestamp: string;
  sequence_number: number;
  session_id: string;
}

interface InlineRssiChartProps {
  deviceId: string;
  sessionId: string;
  timeRange?: number; // in minutes
  height?: number;
}

const InlineRssiChart: React.FC<InlineRssiChartProps> = ({
  deviceId,
  sessionId,
  timeRange = 5,
  height = 60,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<RssiTimeseriesData[]>([]);

  useEffect(() => {
    const fetchTimeseriesData = async () => {
      if (!deviceId || !sessionId) {
        console.warn("Missing required props:", { deviceId, sessionId });
        setError("Missing device ID or session ID");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cutoffDate = new Date();
        cutoffDate.setMinutes(cutoffDate.getMinutes() - timeRange);

        console.log("Fetching RSSI data for:", {
          deviceId,
          sessionId,
          timeRange,
          cutoffDate: cutoffDate.toISOString(),
        });

        // First, verify the device exists in scanned_device table
        const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
          supabase
            .from("scanned_device")
            .select("device_id")
            .eq("device_id", deviceId)
            .eq("session_id", sessionId)
            .single()
        );

        if (deviceError) {
          console.error("Error verifying device:", deviceError);
          setError(`Device not found in session: ${deviceError.message}`);
          setLoading(false);
          return;
        }

        // Then fetch the RSSI timeseries data
        const { data, error } = await safeSupabaseOperation(() =>
          supabase
            .from("rssi_timeseries")
            .select("*")
            .eq("device_id", deviceId)
            .eq("session_id", sessionId)
            .gte("timestamp", cutoffDate.toISOString())
            .order("timestamp", { ascending: true })
        );

        if (error) {
          console.error("Error fetching RSSI data:", error);
          setError(`Error fetching data: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.log("No RSSI data found for device:", {
            deviceId,
            sessionId,
            timeRange,
          });
          setTimeseriesData([]);
          return;
        }

        console.log("Successfully fetched RSSI data:", {
          count: data.length,
          firstPoint: {
            timestamp: new Date(data[0].timestamp).toLocaleString(),
            rssi: data[0].rssi,
          },
          lastPoint: {
            timestamp: new Date(data[data.length - 1].timestamp).toLocaleString(),
            rssi: data[data.length - 1].rssi,
          },
        });

        setTimeseriesData(data);
      } catch (err) {
        const error = err as Error;
        console.error("Unexpected error in fetchTimeseriesData:", error);
        setError(`An unexpected error occurred: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeseriesData();

    // Set up real-time subscription
    console.log("Setting up real-time subscription for:", { deviceId, sessionId });

    const subscription = supabase
      .channel(`rssi_changes_${deviceId}_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rssi_timeseries",
          filter: `device_id=eq.${deviceId} AND session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("Received real-time update:", payload);
          setTimeseriesData((current) => {
            const newData = [...current, payload.new as RssiTimeseriesData];
            // Keep only the last 5 minutes of data
            const cutoffTime = new Date();
            cutoffTime.setMinutes(cutoffTime.getMinutes() - timeRange);
            const filteredData = newData
              .filter((item) => new Date(item.timestamp) > cutoffTime)
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            console.log("Updated timeseries data:", {
              previousCount: current.length,
              newCount: filteredData.length,
              cutoffTime: cutoffTime.toLocaleString(),
            });

            return filteredData;
          });
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up subscription for:", { deviceId, sessionId });
      subscription.unsubscribe();
    };
  }, [deviceId, sessionId, timeRange]);

  const chartData = {
    datasets: [
      {
        data: timeseriesData.map((item) => ({
          x: new Date(item.timestamp),
          y: item.rssi,
        })),
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderWidth: 1.5,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
    scales: {
      x: {
        type: "time" as const,
        display: false,
        time: {
          unit: "second" as const,
        },
      },
      y: {
        display: false,
        min:
          timeseriesData.length > 0
            ? Math.min(-100, ...timeseriesData.map((item) => item.rssi)) - 2
            : -100,
        max:
          timeseriesData.length > 0
            ? Math.max(-30, ...timeseriesData.map((item) => item.rssi)) + 2
            : -30,
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            const date = new Date(context.parsed.x);
            return [`RSSI: ${value} dBm`, `Time: ${date.toLocaleTimeString()}`];
          },
        },
      },
      legend: {
        display: false,
      },
    },
  };

  if (loading) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="small" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Text type="danger" style={{ fontSize: "12px" }}>
          {error}
        </Text>
      </div>
    );
  }

  if (!timeseriesData.length) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No RSSI data"
          style={{ fontSize: "12px", margin: 0 }}
        />
      </div>
    );
  }

  return (
    <div style={{ height, width: "100%", minWidth: "150px", cursor: "pointer" }}>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default InlineRssiChart;
