"use client";

import React from "react";
import { Card, Divider, Spin } from "antd";
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

interface LineChartProps {
  title: string;
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
      yAxisID?: string;
    }[];
  };
  height?: number;
  options?: any;
}

export default function LineChartComponent({
  title,
  data,
  height = 300,
  options = {},
}: LineChartProps) {
  // Transform Chart.js data format to recharts format
  const transformedData = data.labels.map((label, index) => {
    const dataPoint: any = { name: label };
    data.datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index];
    });
    return dataPoint;
  });

  return (
    <Card
      title={<h3 className="text-lg font-semibold">{title}</h3>}
      className="hover:shadow-md transition-all duration-200"
    >
      <Divider className="my-1" />
      <div style={{ height: `${height}px` }} className="p-2">
        {data.datasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Spin size="large" />
            <span className="text-gray-500">Loading chart...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={transformedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {data.datasets.map((dataset, index) => (
                <Line
                  key={dataset.label}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={dataset.borderColor}
                  fill={dataset.backgroundColor}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
