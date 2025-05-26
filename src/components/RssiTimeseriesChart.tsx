"use client";

import React, { useEffect, useState } from "react";
import { Spin, Empty, Typography } from "antd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";

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

  // Transform data for recharts
  const chartData = timeseriesData.map((item) => ({
    name: format(new Date(item.timestamp), "HH:mm:ss"),
    rssi: item.rssi,
    sequence: item.sequence_number,
    timestamp: item.timestamp,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
          <p className="text-sm font-medium">{format(new Date(data.timestamp), "HH:mm:ss.SSS")}</p>
          <p className="text-sm">RSSI: {data.rssi} dBm</p>
          <p className="text-sm">Sequence: {data.sequence}</p>
        </div>
      );
    }
    return null;
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

  const minRssi = Math.min(-100, ...timeseriesData.map((item) => item.rssi)) - 5;
  const maxRssi = Math.max(-30, ...timeseriesData.map((item) => item.rssi)) + 5;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" label={{ value: "Time", position: "insideBottom", offset: -5 }} />
          <YAxis
            domain={[minRssi, maxRssi]}
            label={{ value: "RSSI (dBm)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="rssi"
            name="Signal Strength (RSSI)"
            stroke="rgb(75, 192, 192)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-2 text-center">
        {timeseriesData.length} data points | Every 0.5 seconds
      </div>
    </div>
  );
};

export default RssiTimeseriesChart;
