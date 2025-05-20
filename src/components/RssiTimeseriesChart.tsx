import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Spin, Empty, Typography } from "antd";
import "chartjs-adapter-date-fns";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const { Text } = Typography;

interface RssiTimeseriesData {
  id: number;
  device_id: string;
  rssi: number;
  timestamp: string;
  sequence_number: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

interface RssiTimeseriesChartProps {
  deviceId: string;
  sessionId?: string;
  timeRange?: number; // in minutes
}

const RssiTimeseriesChart: React.FC<RssiTimeseriesChartProps> = ({
  deviceId,
  sessionId,
  timeRange = 10, // Default to 10 minutes
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<RssiTimeseriesData[]>([]);

  useEffect(() => {
    const fetchTimeseriesData = async () => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("rssi_timeseries")
          .select("*")
          .eq("device_id", deviceId)
          .order("timestamp", { ascending: true });

        if (sessionId) {
          query = query.eq("session_id", sessionId);
        }

        // Limit by time range - if needed, calculate cutoff date
        if (timeRange) {
          const cutoffDate = new Date();
          cutoffDate.setMinutes(cutoffDate.getMinutes() - timeRange);
          query = query.gte("timestamp", cutoffDate.toISOString());
        }

        const { data, error } = await safeSupabaseOperation(() => query);

        if (error) {
          console.error("Error fetching RSSI timeseries data:", error);
          setError(`Error fetching data: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          setTimeseriesData([]);
          return;
        }

        setTimeseriesData(data as RssiTimeseriesData[]);
      } catch (err) {
        console.error("Error in fetchTimeseriesData:", err);
        setError(`An unexpected error occurred: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    if (deviceId) {
      fetchTimeseriesData();
    }
  }, [deviceId, sessionId, timeRange]);

  const chartData = {
    datasets: [
      {
        label: "Signal Strength (RSSI)",
        data: timeseriesData.map((item) => ({
          x: new Date(item.timestamp),
          y: item.rssi,
        })),
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 3,
        pointHoverRadius: 7,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "time" as const,
        time: {
          unit: "second" as const,
          tooltipFormat: "HH:mm:ss.SSS",
          displayFormats: {
            second: "HH:mm:ss",
          },
        },
        title: {
          display: true,
          text: "Time",
        },
      },
      y: {
        title: {
          display: true,
          text: "RSSI (dBm)",
        },
        min: Math.min(-100, ...timeseriesData.map((item) => item.rssi)) - 5,
        max: Math.max(-30, ...timeseriesData.map((item) => item.rssi)) + 5,
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            const item = timeseriesData[context.dataIndex];
            const seqNum = item ? `Seq: ${item.sequence_number}` : "";
            return [`RSSI: ${value} dBm`, seqNum];
          },
        },
      },
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `RSSI Values for Device: ${deviceId}`,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Spin size="large" tip="Loading RSSI data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px]">
        <Text type="danger">{error}</Text>
      </div>
    );
  }

  if (!timeseriesData.length) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Empty
          description={
            <span>
              No RSSI time series data available for this device
              {sessionId ? ` in session ${sessionId}` : ""}
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <Line options={chartOptions} data={chartData} />
      <div className="text-xs text-gray-500 mt-2 text-center">
        {timeseriesData.length} data points | Every 0.5 seconds
      </div>
    </div>
  );
};

export default RssiTimeseriesChart;
