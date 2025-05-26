"use client";

import { useState, useEffect } from "react";
import { Spin, Card, Button } from "antd";
import { formatDistanceToNow } from "date-fns";
import { RightOutlined } from "@ant-design/icons";
import Link from "next/link";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import LineChartComponent from "@/components/LineChart";

interface ScannedDevice {
  id: number;
  session_id: string;
  location_id: number;
  location_name: string;
  device_id: string;
  device_name: string | null;
  rssi: number;
  scan_time: string;
  created_at: string;
}

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    deviceCount: 0,
    scanCount: 0,
    locationCount: 0,
    lastUpdate: "",
  });
  const [rssiByLocationData, setRssiByLocationData] = useState({
    labels: [] as string[],
    datasets: [] as {
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
    }[],
  });
  const [rssiOverTimeData, setRssiOverTimeData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: "Signal Strength (dBm)",
        data: [] as number[],
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ],
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
          supabase
            .from("scanned_device")
            .select("*")
            .order("scan_time", { ascending: false })
            .limit(1000)
        );

        if (deviceError) {
          throw new Error(deviceError.message);
        }

        if (!deviceData) {
          throw new Error("No data received");
        }

        // Process stats
        const uniqueDeviceIds = new Set(deviceData.map((d: any) => d.device_id));
        const uniqueLocations = new Set(
          deviceData.map((d: any) => d.location_name).filter(Boolean)
        );
        const lastUpdateTime = deviceData[0]?.scan_time || new Date().toISOString();

        setStats({
          deviceCount: uniqueDeviceIds.size,
          scanCount: deviceData.length,
          locationCount: uniqueLocations.size,
          lastUpdate: formatDistanceToNow(new Date(lastUpdateTime), {
            addSuffix: true,
          }),
        });

        // Process chart data for RSSI by location
        if (deviceData && deviceData.length > 0) {
          // Get average RSSI by location
          const locationMap = new Map();

          deviceData.forEach((device: any) => {
            if (!device.location_name) return;

            if (!locationMap.has(device.location_name)) {
              locationMap.set(device.location_name, {
                rssiSum: Math.abs(device.rssi),
                count: 1,
              });
            } else {
              const locationStats = locationMap.get(device.location_name);
              locationStats.rssiSum += Math.abs(device.rssi);
              locationStats.count += 1;
              locationMap.set(device.location_name, locationStats);
            }
          });

          // Convert to chart data format
          const locations = Array.from(locationMap.keys());
          const avgRssiValues = locations.map((location) => {
            const stats = locationMap.get(location);
            return stats.rssiSum / stats.count;
          });

          setRssiByLocationData({
            labels: locations,
            datasets: [
              {
                label: "Average Signal Strength (dBm)",
                data: avgRssiValues,
                borderColor: "rgb(53, 162, 235)",
                backgroundColor: "rgba(53, 162, 235, 0.5)",
              },
            ],
          });

          // Process RSSI over time
          const recentScans = [...deviceData]
            .sort((a, b) => new Date(b.scan_time).getTime() - new Date(a.scan_time).getTime())
            .slice(0, 20)
            .reverse();

          const timeLabels = recentScans.map((device: any) => {
            const date = new Date(device.scan_time);
            return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(
              date.getMinutes()
            ).padStart(2, "0")}`;
          });

          const rssiValues = recentScans.map((device: any) => Math.abs(device.rssi));

          setRssiOverTimeData({
            labels: timeLabels,
            datasets: [
              {
                label: "Signal Strength (dBm)",
                data: rssiValues,
                borderColor: "rgb(255, 99, 132)",
                backgroundColor: "rgba(255, 99, 132, 0.5)",
              },
            ],
          });
        }
      } catch (error) {
        console.error("Error in fetchDashboardData:", error);
        setError(error instanceof Error ? error.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} type="primary">
            Retry
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Dashboard</h1>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Devices"
              value={stats.deviceCount}
              description="Unique BLE devices detected"
            />
            <StatCard
              title="Device Scans"
              value={stats.scanCount}
              description="Total BLE device scans recorded"
            />
            <StatCard
              title="Locations"
              value={stats.locationCount}
              description="Number of scan locations"
            />
            <StatCard
              title="Last Update"
              value={stats.lastUpdate}
              description="Time since most recent scan"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="col-span-1">
              <LineChartComponent
                title="Average Signal Strength by Location"
                data={rssiByLocationData}
              />
            </div>
            <div className="col-span-1">
              <LineChartComponent title="Signal Strength Over Time" data={rssiOverTimeData} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card className="hover:shadow-md transition-all duration-200">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">BLE Device Analysis</h3>
              <p className="text-gray-600 mb-4">
                View detailed information about BLE devices and analyze signal strength patterns.
              </p>
              <Link href="/devices">
                <Button type="primary" icon={<RightOutlined />}>
                  View Device Analysis
                </Button>
              </Link>
            </Card>
            <Card className="hover:shadow-md transition-all duration-200">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Location Maps</h3>
              <p className="text-gray-600 mb-4">
                View BLE devices and scanning locations on an interactive map.
              </p>
              <Link href="/maps">
                <Button type="primary" icon={<RightOutlined />}>
                  View Location Maps
                </Button>
              </Link>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card className="hover:shadow-md transition-all duration-200">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Compare Locations</h3>
              <p className="text-gray-600 mb-4">
                Compare BLE device detection across multiple scanning locations and analyze device
                overlap patterns.
              </p>
              <Link href="/compare">
                <Button type="primary" icon={<RightOutlined />}>
                  Compare Scan Results
                </Button>
              </Link>
            </Card>
            <Card className="hover:shadow-md transition-all duration-200">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Water Level Monitoring</h3>
              <p className="text-gray-600 mb-4">
                Track and analyze water level measurements collected through BLE sensor technology.
              </p>
              <Link href="/water-levels">
                <Button type="primary" icon={<RightOutlined />}>
                  View Water Levels
                </Button>
              </Link>
            </Card>
          </div>

          <Card className="mt-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">About This Dashboard</h3>
            <p className="text-gray-600">
              This dashboard provides analytics for the BLE Scanner system. It displays key metrics
              collected from Bluetooth Low Energy (BLE) devices across various locations to help
              analyze signal strength patterns.
            </p>
            <p className="text-gray-600 mt-2">
              Use the navigation menu to explore detailed data about devices, signal measurements,
              location mapping, and comparative analysis.
            </p>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
