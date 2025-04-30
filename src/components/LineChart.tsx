"use client";

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card, Divider } from "antd";
import { useTheme } from "next-themes";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const textColor = isDark ? "#e5e7eb" : "#4B5563";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "#F3F4F6";
  const tooltipBackgroundColor = isDark ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const tooltipTextColor = isDark ? "#e5e7eb" : "#111827";

  const defaultOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          font: {
            family: "Inter",
            size: 12,
          },
          color: textColor,
          padding: 20,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: tooltipBackgroundColor,
        titleColor: tooltipTextColor,
        bodyColor: textColor,
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        bodyFont: {
          family: "Inter",
        },
        titleFont: {
          family: "Inter",
          weight: "bold",
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: gridColor,
        },
        ticks: {
          color: textColor,
          padding: 8,
        },
        border: {
          dash: [4, 4],
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: textColor,
          padding: 8,
        },
      },
    },
    elements: {
      point: {
        radius: 3,
        hoverRadius: 5,
      },
      line: {
        tension: 0.3,
        borderWidth: 2,
      },
    },
  };

  const chartOptions = { ...defaultOptions, ...options };

  return (
    <Card
      title={<h3 className="text-lg font-semibold">{title}</h3>}
      className="hover:shadow-md transition-all duration-200"
    >
      <Divider className="my-1" />
      <div style={{ height: `${height}px` }} className="p-2">
        <Line data={data} options={chartOptions} />
      </div>
    </Card>
  );
}
