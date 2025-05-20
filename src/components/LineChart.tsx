"use client";

import React, { useEffect, useState } from "react";
import { Card, Divider, Spin } from "antd";

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
  const [isClient, setIsClient] = useState(false);
  const [ChartComponent, setChartComponent] = useState<any>(null);

  useEffect(() => {
    // Only load Chart.js in the browser
    const loadChart = async () => {
      try {
        if (typeof window !== "undefined") {
          // Dynamically import Chart.js components
          const {
            Chart,
            CategoryScale,
            LinearScale,
            PointElement,
            LineElement,
            Title,
            Tooltip,
            Legend,
          } = await import("chart.js");
          const { Line } = await import("react-chartjs-2");

          // Register Chart.js components
          Chart.register(
            CategoryScale,
            LinearScale,
            PointElement,
            LineElement,
            Title,
            Tooltip,
            Legend
          );

          // Set the Line component
          setChartComponent(() => Line);
          setIsClient(true);
        }
      } catch (error) {
        console.error("Failed to load Chart.js:", error);
      }
    };

    loadChart();
  }, []);

  // Default chart options
  const defaultOptions = {
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
          color: "#4B5563",
          padding: 20,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        titleColor: "#111827",
        bodyColor: "#4B5563",
        borderColor: "#E5E7EB",
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
          color: "#F3F4F6",
        },
        ticks: {
          color: "#4B5563",
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
          color: "#4B5563",
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
        {!isClient || !ChartComponent ? (
          <div className="flex items-center justify-center h-full">
            <Spin tip="Loading chart..." />
          </div>
        ) : (
          <ChartComponent data={data} options={chartOptions} />
        )}
      </div>
    </Card>
  );
}
