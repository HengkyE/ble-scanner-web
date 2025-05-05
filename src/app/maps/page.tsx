"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Spinner,
  Input,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Tooltip,
  Select,
  SelectItem,
} from "@heroui/react";
import {
  Tabs,
  Slider,
  Radio,
  Space,
  Tag,
  Typography,
  Statistic,
  Empty,
  Badge,
  Switch,
  Alert,
  Collapse,
  List,
  Avatar,
} from "antd";
import {
  MapIcon,
  MapPinIcon,
  AdjustmentsHorizontalIcon,
  SignalIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import DashboardLayout from "@/components/DashboardLayout";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import SignalStrengthHistogram from "@/components/SignalStrengthHistogram";

const { Title, Text } = Typography;
const { Panel } = Collapse;

// Dynamically import the Map component to avoid SSR issues with leaflet
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "500px",
        background: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Spinner size="lg" />
    </div>
  ),
});

interface Location {
  id: number;
  name: string;
  lat: number;
  lng: number;
  notes: string;
  createdAt?: string;
  deviceCount?: number;
  averageRssi?: number;
}

interface Device {
  id: number;
  name: string;
  location_id: number;
  lat: number;
  lng: number;
  rssi: number;
  notes: string;
  device_id?: string;
  scan_time?: string;
}

interface LocationAnalysis {
  id: number;
  name: string;
  deviceCount: number;
  averageRssi: number;
  minRssi: number;
  maxRssi: number;
  uniqueDevices: number;
}

export default function MapsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [selectedLocationData, setSelectedLocationData] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("map");
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [rssiRange, setRssiRange] = useState<[number, number]>([-100, -30]);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<string>("all");
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Get the analysis data for locations
  const locationAnalysis = useMemo(() => {
    const analysisMap = new Map<number, LocationAnalysis>();

    locations.forEach((location) => {
      const locationDevices = devices.filter((d) => d.location_id === location.id);
      const deviceRssi = locationDevices.map((d) => d.rssi);
      const uniqueDeviceIds = new Set(locationDevices.map((d) => d.device_id || d.name));

      analysisMap.set(location.id, {
        id: location.id,
        name: location.name,
        deviceCount: locationDevices.length,
        averageRssi:
          deviceRssi.length > 0
            ? Math.round(deviceRssi.reduce((a, b) => a + b, 0) / deviceRssi.length)
            : 0,
        minRssi: deviceRssi.length > 0 ? Math.min(...deviceRssi) : 0,
        maxRssi: deviceRssi.length > 0 ? Math.max(...deviceRssi) : 0,
        uniqueDevices: uniqueDeviceIds.size,
      });
    });

    return Array.from(analysisMap.values());
  }, [locations, devices]);

  // Fetch data from Supabase on component mount
  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  // Apply filters when filter conditions change
  useEffect(() => {
    applyFilters();
  }, [selectedLocation, searchQuery, locations, devices, rssiRange, selectedTimeFrame]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch locations
      const { data: locationData, error: locationError } = await safeSupabaseOperation(() =>
        supabase.from("location_scanned").select("*").order("created_at", { ascending: false })
      );

      if (locationError) {
        console.error("Error fetching locations:", locationError);
        setError(`Error fetching locations: ${locationError.message}`);
        return;
      }

      // Fetch devices
      const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
        supabase.from("scanned_device").select("*").order("scan_time", { ascending: false })
      );

      if (deviceError) {
        console.error("Error fetching devices:", deviceError);
        setError(`Error fetching devices: ${deviceError.message}`);
        return;
      }

      // Transform location data to match our interface
      let transformedLocations: Location[] = [];

      if (locationData && locationData.length > 0) {
        transformedLocations = locationData
          .map((loc: any) => {
            // Try to handle different potential field name formats
            const lat = loc.latitude || loc.lat || loc.location_latitude;
            const lng = loc.longitude || loc.lng || loc.location_longitude;

            // Skip locations with invalid coordinates
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
              return null;
            }

            const item = {
              id: loc.id,
              name: loc.location_name || loc.name || "Unknown Location",
              lat: Number(lat),
              lng: Number(lng),
              notes: loc.location_notes || loc.notes || "",
              createdAt: loc.created_at || loc.timestamp,
            };

            return item;
          })
          .filter(Boolean) as Location[];
      }

      // Create lookup map for location names to IDs
      const locationNameToId = new Map<string, number>();
      transformedLocations.forEach((loc) => {
        locationNameToId.set(loc.name, loc.id);
      });

      // Transform device data to match our interface
      let transformedDevices: Device[] = [];

      if (deviceData && deviceData.length > 0) {
        transformedDevices = deviceData
          .map((dev: any) => {
            // Try to handle different potential field name formats
            const lat = dev.device_latitude || dev.lat || dev.latitude;
            const lng = dev.device_longitude || dev.lng || dev.longitude;

            // Try to get location_id - it might be direct, or we might need to look it up by name
            let locationId = dev.location_id || 0;

            // If we have a location_name but no location_id, try to find the ID from our location map
            if (
              (!locationId || locationId === 0) &&
              dev.location_name &&
              locationNameToId.has(dev.location_name)
            ) {
              locationId = locationNameToId.get(dev.location_name) || 0;
            }

            // Skip devices with invalid coordinates
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
              return null;
            }

            const item = {
              id: dev.id,
              name: dev.device_name || dev.name || dev.device_id || "Unknown Device",
              location_id: locationId,
              lat: Number(lat),
              lng: Number(lng),
              rssi: dev.rssi || -100,
              notes: dev.location_notes || dev.notes || "",
              device_id: dev.device_id,
              scan_time: dev.scan_time,
            };

            return item;
          })
          .filter(Boolean) as Device[];
      }

      // Calculate device counts and average RSSI for each location
      const locationStats = new Map<
        number,
        { count: number; rssiSum: number; rssiCount: number }
      >();

      transformedDevices.forEach((device) => {
        const locId = device.location_id;
        if (!locationStats.has(locId)) {
          locationStats.set(locId, { count: 0, rssiSum: 0, rssiCount: 0 });
        }

        const stats = locationStats.get(locId)!;
        stats.count++;
        stats.rssiSum += device.rssi;
        stats.rssiCount++;
      });

      // Enhance locations with stats
      transformedLocations = transformedLocations.map((loc) => ({
        ...loc,
        deviceCount: locationStats.get(loc.id)?.count || 0,
        averageRssi: locationStats.get(loc.id)?.rssiCount
          ? Math.round(locationStats.get(loc.id)!.rssiSum / locationStats.get(loc.id)!.rssiCount)
          : undefined,
      }));

      setLocations(transformedLocations);
      setDevices(transformedDevices);
      setFilteredLocations(transformedLocations);
      setFilteredDevices(transformedDevices);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(`Error fetching data: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filteredLocs = [...locations];
    let filteredDevs = [...devices];

    // Filter by signal strength
    if (rssiRange && rssiRange.length === 2) {
      filteredDevs = filteredDevs.filter(
        (dev) => dev.rssi >= rssiRange[0] && dev.rssi <= rssiRange[1]
      );
    }

    // Filter by time frame
    if (selectedTimeFrame !== "all" && selectedTimeFrame !== "") {
      const now = new Date();
      let cutoffDate = new Date();

      switch (selectedTimeFrame) {
        case "day":
          cutoffDate.setDate(now.getDate() - 1);
          break;
        case "week":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "month":
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
      }

      filteredDevs = filteredDevs.filter((dev) => {
        if (!dev.scan_time) return true;
        return new Date(dev.scan_time) >= cutoffDate;
      });
    }

    // Filter locations by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredLocs = filteredLocs.filter(
        (loc) => loc.name.toLowerCase().includes(query) || loc.notes.toLowerCase().includes(query)
      );

      // Also filter devices by name or ID
      filteredDevs = filteredDevs.filter(
        (dev) =>
          dev.name.toLowerCase().includes(query) ||
          (dev.device_id && dev.device_id.toLowerCase().includes(query))
      );
    }

    // Filter devices by selected location
    if (selectedLocation !== "all") {
      const locId = parseInt(selectedLocation);
      filteredDevs = filteredDevs.filter((dev) => dev.location_id === locId);

      // If a location is selected, only show that location
      filteredLocs = filteredLocs.filter((loc) => loc.id === locId);
    }

    // Update with filtered data
    setFilteredLocations(filteredLocs);
    setFilteredDevices(filteredDevs);
  };

  const handleLocationSelect = (locationId: number) => {
    const location = locations.find((loc) => loc.id === locationId) || null;
    setSelectedLocationData(location);
    setSelectedLocation(locationId.toString());
  };

  const handleDeviceSelect = (deviceId: number) => {
    setSelectedDevice(deviceId);
    const device = devices.find((dev) => dev.id === deviceId);
    if (device) {
      const locationId = device.location_id;
      setSelectedLocation(locationId.toString());
    }
  };

  // Add sample data for testing if no data is available
  const addSampleData = () => {
    const sampleLocations: Location[] = [
      {
        id: 1,
        name: "San Francisco",
        lat: 37.7749,
        lng: -122.4194,
        notes: "Test location 1",
        deviceCount: 15,
        averageRssi: -75,
      },
      {
        id: 2,
        name: "New York",
        lat: 40.7128,
        lng: -74.006,
        notes: "Test location 2",
        deviceCount: 8,
        averageRssi: -82,
      },
      {
        id: 3,
        name: "Chicago",
        lat: 41.8781,
        lng: -87.6298,
        notes: "Test location 3",
        deviceCount: 12,
        averageRssi: -68,
      },
    ];

    const sampleDevices: Device[] = [];

    // Generate sample devices around each location
    sampleLocations.forEach((location) => {
      // Generate random devices around this location
      const deviceCount = location.deviceCount || 10;
      for (let i = 0; i < deviceCount; i++) {
        // Random position around the location (within ~500m)
        const latOffset = (Math.random() - 0.5) * 0.01;
        const lngOffset = (Math.random() - 0.5) * 0.01;

        // Random RSSI based on distance from center
        const distance = Math.sqrt(latOffset * latOffset + lngOffset * lngOffset);
        const rssi = Math.round(-60 - distance * 3000);

        sampleDevices.push({
          id: sampleDevices.length + 1,
          name: `Device ${sampleDevices.length + 1}`,
          device_id: `D${sampleDevices.length + 1}`,
          location_id: location.id,
          lat: location.lat + latOffset,
          lng: location.lng + lngOffset,
          rssi,
          notes: `Sample device at ${location.name}`,
        });
      }
    });

    setLocations(sampleLocations);
    setDevices(sampleDevices);
    setFilteredLocations(sampleLocations);
    setFilteredDevices(sampleDevices);
  };

  // Fix for the Select component by providing key-value format
  const locationOptions = useMemo(() => {
    return [
      { key: "all", value: "all", label: "All Locations" },
      ...locations.map((location) => ({
        key: location.id.toString(),
        value: location.id.toString(),
        label: `${location.name} ${location.deviceCount ? `(${location.deviceCount})` : ""}`,
      })),
    ];
  }, [locations]);

  // Time frame options
  const timeFrameOptions = [
    { label: "All Time", value: "all" },
    { label: "Last 24h", value: "day" },
    { label: "Last Week", value: "week" },
    { label: "Last Month", value: "month" },
  ];

  // Get signal strength color
  const getRssiColor = (rssi: number) => {
    if (rssi > -70) return "#4ade80"; // green
    if (rssi > -85) return "#fbbf24"; // yellow
    return "#ef4444"; // red
  };

  // Calculate average and metrics for selected devices
  const selectedLocationMetrics = useMemo(() => {
    if (!selectedLocationData) return null;

    const locationDevices = filteredDevices.filter(
      (d) => d.location_id === selectedLocationData.id
    );
    const rssiValues = locationDevices.map((d) => d.rssi);
    const uniqueDeviceIds = new Set(locationDevices.map((d) => d.device_id || d.name));

    return {
      deviceCount: locationDevices.length,
      averageRssi:
        rssiValues.length > 0
          ? Math.round(rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length)
          : null,
      minRssi: rssiValues.length > 0 ? Math.min(...rssiValues) : null,
      maxRssi: rssiValues.length > 0 ? Math.max(...rssiValues) : null,
      uniqueDevices: uniqueDeviceIds.size,
    };
  }, [selectedLocationData, filteredDevices]);

  const getTopDevices = () => {
    // Group devices by device_id or name, taking the maximum RSSI for each
    const deviceGroups = new Map<string, Device>();

    filteredDevices.forEach((device) => {
      const key = device.device_id || device.name;
      if (!deviceGroups.has(key) || deviceGroups.get(key)!.rssi < device.rssi) {
        deviceGroups.set(key, device);
      }
    });

    // Sort devices by RSSI and return top 5
    return Array.from(deviceGroups.values())
      .sort((a, b) => b.rssi - a.rssi)
      .slice(0, 5);
  };

  return (
    <DashboardLayout>
      <div className="p-4 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <MapIcon className="h-6 w-6 mr-2 text-primary" />
              BLE Device Map
            </h1>
            <p className="text-gray-500 mt-1">
              Visualize and analyze BLE device locations and signal strength across your environment
            </p>
          </div>
          <div className="mt-3 md:mt-0 flex items-center gap-2 self-end">
            <Button
              color="primary"
              size="sm"
              variant="light"
              onPress={() => setRefreshKey((prev) => prev + 1)}
              startContent={<ArrowPathIcon className="h-3 w-3" />}
              isLoading={isLoading}
              className="min-w-0 text-xs h-7 px-3"
              aria-label="Refresh data"
            >
              {isLoading ? "" : "Refresh"}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="w-full flex justify-center my-8">
            <div className="flex flex-col items-center">
              <Spinner size="lg" color="primary" className="mb-3" />
              <p className="text-primary text-center">Loading BLE device data and locations...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="relative">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              className="mb-6"
              style={{ position: "relative", zIndex: 0 }}
              tabBarStyle={{
                background: "white",
                marginBottom: "16px",
                borderBottom: "1px solid #f0f0f0",
                paddingBottom: "8px",
              }}
              items={[
                {
                  key: "map",
                  label: (
                    <span className="flex items-center">
                      <MapIcon className="h-4 w-4 mr-1" /> Map View
                    </span>
                  ),
                  children: (
                    <div className="mt-2">
                      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-4">
                        <div className="xl:col-span-3">
                          <Card className="overflow-hidden shadow-sm border-none">
                            <CardHeader className="flex justify-between items-center bg-primary-50 py-3 px-4">
                              <h2 className="text-lg font-semibold flex items-center">
                                <MapPinIcon className="h-5 w-5 mr-2 text-primary" />
                                Device Map
                                {filteredLocations.length > 0 && (
                                  <Badge
                                    count={filteredDevices.length}
                                    color="#1677ff"
                                    style={{ marginLeft: "8px" }}
                                    overflowCount={999}
                                  />
                                )}
                              </h2>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 mr-1 text-sm text-gray-600">
                                  <span>Markers</span>
                                  <Switch
                                    checked={showHeatmap}
                                    onChange={setShowHeatmap}
                                    size="small"
                                  />
                                  <span>Heatmap</span>
                                </div>
                              </div>
                            </CardHeader>
                            <CardBody className="p-0">
                              <div style={{ height: "650px", width: "100%" }}>
                                <MapComponent
                                  locations={filteredLocations}
                                  devices={filteredDevices}
                                  onLocationSelect={handleLocationSelect}
                                  onDeviceSelect={handleDeviceSelect}
                                  showHeatmap={showHeatmap}
                                />
                              </div>
                            </CardBody>
                          </Card>
                        </div>

                        <div className="xl:col-span-1">
                          <Card className="shadow-sm border-none mb-4">
                            <CardHeader className="py-3 px-4 bg-primary-50">
                              <h2 className="text-lg font-semibold flex items-center">
                                <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2 text-primary" />
                                Filters
                              </h2>
                            </CardHeader>
                            <CardBody className="py-4 space-y-5">
                              {isLoading ? (
                                <div className="flex flex-col items-center py-8">
                                  <Spinner color="primary" size="md" className="mb-4" />
                                  <p className="text-sm text-gray-600">Loading filter options...</p>
                                </div>
                              ) : (
                                <>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                      Location
                                    </label>
                                    <div className="relative">
                                      <select
                                        value={selectedLocation}
                                        onChange={(e) => setSelectedLocation(e.target.value)}
                                        className="w-full h-10 pl-3 pr-10 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                                      >
                                        <option value="all">All Locations</option>
                                        {locations.map((location) => (
                                          <option key={location.id} value={location.id.toString()}>
                                            {location.name}{" "}
                                            {location.deviceCount
                                              ? `(${location.deviceCount})`
                                              : ""}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <svg
                                          className="w-4 h-4 text-gray-400"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                      Search
                                    </label>
                                    <Input
                                      placeholder="Search devices or locations"
                                      value={searchQuery}
                                      onValueChange={setSearchQuery}
                                      startContent={
                                        <SearchIcon className="h-4 w-4 text-gray-500" />
                                      }
                                      classNames={{
                                        inputWrapper: "h-10",
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                      Signal Strength (RSSI)
                                    </label>
                                    <div className="px-1">
                                      <Slider
                                        range
                                        min={-120}
                                        max={-30}
                                        value={rssiRange}
                                        onChange={(value) =>
                                          setRssiRange(value as [number, number])
                                        }
                                        marks={{
                                          "-120": { label: "-120", style: { color: "#ef4444" } },
                                          "-90": { label: "-90", style: { color: "#fbbf24" } },
                                          "-60": { label: "-60", style: { color: "#4ade80" } },
                                          "-30": { label: "-30", style: { color: "#4ade80" } },
                                        }}
                                        tooltip={{
                                          formatter: (value) => `${value} dBm`,
                                          placement: "top",
                                        }}
                                        className="mb-6"
                                      />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                                      <div className="flex items-center">
                                        <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
                                        <span>Weak</span>
                                      </div>
                                      <div className="flex items-center">
                                        <div className="w-3 h-3 rounded-full bg-amber-400 mr-1"></div>
                                        <span>Medium</span>
                                      </div>
                                      <div className="flex items-center">
                                        <div className="w-3 h-3 rounded-full bg-green-400 mr-1"></div>
                                        <span>Strong</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Time Frame
                                    </label>
                                    <Radio.Group
                                      options={timeFrameOptions}
                                      onChange={(e) => setSelectedTimeFrame(e.target.value)}
                                      value={selectedTimeFrame}
                                      optionType="button"
                                      buttonStyle="solid"
                                      className="w-full"
                                      size="middle"
                                    />
                                  </div>

                                  <div className="pt-2">
                                    <Button
                                      fullWidth
                                      color="default"
                                      variant="flat"
                                      onPress={() => {
                                        setSelectedLocation("all");
                                        setSearchQuery("");
                                        setRssiRange([-100, -30]);
                                        setSelectedTimeFrame("all");
                                      }}
                                      startContent={
                                        <AdjustmentsHorizontalIcon className="h-4 w-4" />
                                      }
                                    >
                                      Reset Filters
                                    </Button>
                                  </div>
                                </>
                              )}
                            </CardBody>
                          </Card>

                          {selectedLocationData && !isLoading && (
                            <Card className="shadow-sm border-none">
                              <CardHeader className="flex justify-between items-center py-3 px-4 bg-primary-50">
                                <h2 className="text-lg font-semibold">
                                  {selectedLocationData.name}
                                </h2>
                                <Badge
                                  count={selectedLocationMetrics?.deviceCount || 0}
                                  showZero
                                  style={{ backgroundColor: "#1677ff" }}
                                />
                              </CardHeader>
                              <CardBody>
                                {selectedLocationMetrics && (
                                  <div className="space-y-3">
                                    <p className="text-sm text-gray-600">
                                      {selectedLocationData.notes ||
                                        "No additional notes available."}
                                    </p>

                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                      <Statistic
                                        title={<span className="text-gray-600">Average RSSI</span>}
                                        value={selectedLocationMetrics.averageRssi || "N/A"}
                                        suffix="dBm"
                                        valueStyle={{
                                          color: selectedLocationMetrics.averageRssi
                                            ? getRssiColor(selectedLocationMetrics.averageRssi)
                                            : undefined,
                                          fontSize: "1.25rem",
                                        }}
                                      />
                                      <Statistic
                                        title={
                                          <span className="text-gray-600">Unique Devices</span>
                                        }
                                        value={selectedLocationMetrics.uniqueDevices}
                                        valueStyle={{ fontSize: "1.25rem" }}
                                      />
                                    </div>

                                    <div className="text-xs text-gray-500 pt-2">
                                      {selectedLocationMetrics.minRssi !== null && (
                                        <div className="mb-1">
                                          <span className="font-medium">Signal range:</span>{" "}
                                          {selectedLocationMetrics.minRssi} to{" "}
                                          {selectedLocationMetrics.maxRssi} dBm
                                        </div>
                                      )}
                                      <div>
                                        <span className="font-medium">Coordinates:</span>{" "}
                                        {selectedLocationData.lat.toFixed(6)},{" "}
                                        {selectedLocationData.lng.toFixed(6)}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </CardBody>
                            </Card>
                          )}
                        </div>
                      </div>

                      {!isLoading && filteredDevices.length > 0 && (
                        <Card className="shadow-sm border-none mt-4 mb-4">
                          <CardHeader className="bg-primary-50 py-3 px-4">
                            <h2 className="text-lg font-semibold flex items-center">
                              <SignalIcon className="h-5 w-5 mr-2 text-primary" />
                              Strongest Devices
                            </h2>
                          </CardHeader>
                          <CardBody>
                            <List
                              dataSource={getTopDevices()}
                              renderItem={(device) => (
                                <List.Item
                                  key={device.id}
                                  className="cursor-pointer hover:bg-gray-50 transition-colors rounded-md"
                                  onClick={() => handleDeviceSelect(device.id)}
                                >
                                  <List.Item.Meta
                                    avatar={
                                      <Avatar
                                        style={{
                                          backgroundColor: getRssiColor(device.rssi),
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        {device.rssi}
                                      </Avatar>
                                    }
                                    title={
                                      <div className="flex justify-between items-center">
                                        <span>{device.name}</span>
                                        <Tag color={getRssiColor(device.rssi)}>
                                          {device.rssi} dBm
                                        </Tag>
                                      </div>
                                    }
                                    description={
                                      <div className="text-xs">
                                        {device.device_id && <span>ID: {device.device_id} | </span>}
                                        {locations.find((l) => l.id === device.location_id)?.name ||
                                          "Unknown location"}
                                      </div>
                                    }
                                  />
                                </List.Item>
                              )}
                            />
                          </CardBody>
                        </Card>
                      )}

                      {!isLoading && filteredLocations.length > 0 && (
                        <Card className="shadow-sm border-none mt-4">
                          <CardHeader className="bg-primary-50 py-3 px-4">
                            <h2 className="text-lg font-semibold flex items-center">
                              <MapPinIcon className="h-5 w-5 mr-2 text-primary" />
                              Device Distribution
                            </h2>
                          </CardHeader>
                          <CardBody>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              {filteredLocations.slice(0, 8).map((location) => {
                                const locationDevices = filteredDevices.filter(
                                  (d) => d.location_id === location.id
                                );
                                const deviceCount = locationDevices.length;
                                const avgRssi =
                                  deviceCount > 0
                                    ? Math.round(
                                        locationDevices.reduce((sum, d) => sum + d.rssi, 0) /
                                          deviceCount
                                      )
                                    : 0;

                                return (
                                  <Card
                                    key={location.id}
                                    className="shadow-sm border border-gray-100 hover:border-primary-300 transition-all cursor-pointer"
                                    isPressable
                                    onClick={() => handleLocationSelect(location.id)}
                                  >
                                    <CardBody className="p-3">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <h3
                                            className="text-sm font-semibold truncate max-w-[150px]"
                                            title={location.name}
                                          >
                                            {location.name}
                                          </h3>
                                          <p className="text-xs text-gray-500 mt-1">
                                            {deviceCount} device{deviceCount !== 1 ? "s" : ""}
                                          </p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                          <div
                                            className="flex items-center justify-center rounded-full w-10 h-10 text-white text-sm font-medium"
                                            style={{
                                              backgroundColor: avgRssi
                                                ? getRssiColor(avgRssi)
                                                : "#9ca3af",
                                              opacity: 0.85,
                                            }}
                                          >
                                            {avgRssi ? avgRssi : "N/A"}
                                          </div>
                                          <span className="text-[10px] text-gray-500 mt-1">
                                            avg dBm
                                          </span>
                                        </div>
                                      </div>

                                      {deviceCount > 0 && (
                                        <div className="mt-2">
                                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full"
                                              style={{
                                                width: `${Math.min(
                                                  100,
                                                  (deviceCount /
                                                    Math.max(
                                                      ...filteredLocations.map(
                                                        (l) =>
                                                          filteredDevices.filter(
                                                            (d) => d.location_id === l.id
                                                          ).length
                                                      ),
                                                      1
                                                    )) *
                                                    100
                                                )}%`,
                                                backgroundColor: getRssiColor(avgRssi),
                                                opacity: 0.8,
                                              }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </CardBody>
                                  </Card>
                                );
                              })}

                              {filteredLocations.length > 8 && (
                                <Card className="shadow-sm border border-gray-100 flex items-center justify-center">
                                  <CardBody className="p-3 text-center">
                                    <Button
                                      color="primary"
                                      variant="light"
                                      onPress={() => setActiveTab("analysis")}
                                      className="min-w-0"
                                    >
                                      +{filteredLocations.length - 8} more locations
                                    </Button>
                                  </CardBody>
                                </Card>
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      )}
                    </div>
                  ),
                },
                {
                  key: "analysis",
                  label: (
                    <span className="flex items-center">
                      <SignalIcon className="h-4 w-4 mr-1" /> Signal Analysis
                    </span>
                  ),
                  children: (
                    <div className="mt-2">
                      <Card className="shadow-sm border-none mb-6">
                        <CardHeader className="bg-primary-50 py-3 px-4">
                          <h2 className="text-lg font-semibold flex items-center">
                            <SignalIcon className="h-5 w-5 mr-2 text-primary" />
                            Signal Strength Distribution
                          </h2>
                        </CardHeader>
                        <CardBody>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="col-span-1 md:col-span-2">
                              <div className="h-[300px] relative border border-gray-100 rounded-lg p-4 pt-8 pb-12">
                                <div className="absolute top-2 left-4 text-sm font-medium text-gray-700">
                                  Signal Strength Distribution
                                </div>
                                <div className="h-full ml-8 mr-2 mb-4 relative">
                                  <SignalStrengthHistogram
                                    data={filteredDevices.map((device) => device.rssi)}
                                  />
                                  <div className="absolute left-0 bottom-0 h-full flex flex-col justify-between pb-6 text-xs text-gray-500">
                                    <div>Common</div>
                                    <div>Rare</div>
                                  </div>
                                </div>
                                <div className="text-center text-xs text-gray-500">
                                  Signal Strength (dBm)
                                </div>
                              </div>
                              <div className="text-center mt-3">
                                <p className="text-sm text-gray-600">
                                  Signal strength distribution across {filteredDevices.length}{" "}
                                  devices
                                </p>
                              </div>
                            </div>
                            <div className="col-span-1 flex flex-col justify-center space-y-2">
                              <Card className="shadow-sm bg-gray-50">
                                <CardBody className="p-4">
                                  <Statistic
                                    title={<span className="text-gray-600">Total Devices</span>}
                                    value={devices.length}
                                    valueStyle={{ fontSize: "1.5rem" }}
                                  />
                                </CardBody>
                              </Card>

                              <Card className="shadow-sm bg-gray-50">
                                <CardBody className="p-4">
                                  <Statistic
                                    title={<span className="text-gray-600">Average Signal</span>}
                                    value={
                                      devices.length > 0
                                        ? Math.round(
                                            devices.reduce((sum, device) => sum + device.rssi, 0) /
                                              devices.length
                                          )
                                        : "N/A"
                                    }
                                    suffix="dBm"
                                    valueStyle={{
                                      fontSize: "1.5rem",
                                      color:
                                        devices.length > 0
                                          ? getRssiColor(
                                              Math.round(
                                                devices.reduce(
                                                  (sum, device) => sum + device.rssi,
                                                  0
                                                ) / devices.length
                                              )
                                            )
                                          : undefined,
                                    }}
                                  />
                                </CardBody>
                              </Card>

                              <Card className="shadow-sm bg-gray-50">
                                <CardBody className="p-4">
                                  <Statistic
                                    title={<span className="text-gray-600">Range</span>}
                                    value={
                                      devices.length > 0
                                        ? `${Math.min(...devices.map((d) => d.rssi))} to ${Math.max(
                                            ...devices.map((d) => d.rssi)
                                          )}`
                                        : "N/A"
                                    }
                                    suffix="dBm"
                                    valueStyle={{ fontSize: "1.5rem" }}
                                  />
                                </CardBody>
                              </Card>
                            </div>
                          </div>
                        </CardBody>
                      </Card>

                      <Card className="shadow-sm border-none">
                        <CardHeader className="bg-primary-50 py-3 px-4">
                          <h2 className="text-lg font-semibold flex items-center">
                            <MapPinIcon className="h-5 w-5 mr-2 text-primary" />
                            Location Signal Strength Analysis
                          </h2>
                        </CardHeader>
                        <CardBody>
                          {locationAnalysis.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {locationAnalysis.map((location) => (
                                <Card
                                  key={location.id}
                                  className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
                                  onClick={() => handleLocationSelect(location.id)}
                                >
                                  <CardBody>
                                    <div className="flex justify-between items-start mb-2">
                                      <Title level={5} className="m-0">
                                        {location.name}
                                      </Title>
                                      <Tag color={getRssiColor(location.averageRssi)}>
                                        {location.averageRssi} dBm
                                      </Tag>
                                    </div>

                                    <div className="flex justify-between text-gray-500 text-sm mb-3">
                                      <span>{location.deviceCount} device entries</span>
                                      <span>{location.uniqueDevices} unique</span>
                                    </div>

                                    <div>
                                      <Text type="secondary" className="text-xs">
                                        Signal Strength Range
                                      </Text>
                                      <div className="h-2 w-full bg-gray-100 rounded-full mt-1 mb-1 relative">
                                        <div
                                          className="absolute inset-y-0 rounded-full"
                                          style={{
                                            left: `${
                                              Math.abs((location.minRssi + 30) / (-120 + 30)) * 100
                                            }%`,
                                            right: `${
                                              100 -
                                              Math.abs((location.maxRssi + 30) / (-120 + 30)) * 100
                                            }%`,
                                            background:
                                              "linear-gradient(to right, #ef4444, #fbbf24, #4ade80)",
                                          }}
                                        ></div>
                                      </div>
                                      <div className="flex justify-between text-xs text-gray-400">
                                        <span>{location.minRssi} dBm</span>
                                        <span>{location.maxRssi} dBm</span>
                                      </div>
                                    </div>
                                  </CardBody>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <Empty description="No location data available for analysis" />
                          )}
                        </CardBody>
                      </Card>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {error && (
          <Alert
            type="error"
            message="Error Loading Data"
            description={error}
            action={
              <Button color="primary" onPress={addSampleData}>
                Use Sample Data
              </Button>
            }
            className="mb-4"
          />
        )}

        {locations.length === 0 && !isLoading && !error && (
          <div className="text-center py-12">
            <Empty
              description={
                <div>
                  <p className="text-lg mb-2">No Location Data Available</p>
                  <p className="text-gray-500 mb-4">No location data was found in the database.</p>
                  <Button color="primary" onPress={addSampleData}>
                    Use Sample Data
                  </Button>
                </div>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Just a simple search icon component
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}
