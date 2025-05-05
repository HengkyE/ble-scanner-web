"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Button,
  Checkbox,
  CheckboxGroup,
} from "@heroui/react";
import {
  Table,
  Typography,
  Spin,
  Empty,
  Tabs,
  Tooltip,
  Badge,
  Tag,
  Select,
  Space,
  Alert,
  Progress,
  Statistic,
} from "antd";
import {
  BarChartOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  ArrowsAltOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import { SortOrder } from "antd/es/table/interface";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface ScannedDevice {
  id: number;
  session_id: string;
  location_id: number;
  location_name: string;
  device_id: string;
  device_name: string | null;
  rssi: number;
  manufacturer_data: string | null;
  service_uuids: string | null;
  scan_time: string;
  created_at: string;
  location_latitude?: number | null;
  location_longitude?: number | null;
}

interface LocationData {
  id: number;
  name: string;
  deviceCount: number;
  uniqueDeviceIds: Set<string>;
  devices: ScannedDevice[];
  latitude?: number | null;
  longitude?: number | null;
  averageRssi?: number;
}

interface LocationDistance {
  location1: string;
  location2: string;
  distanceMeters: number;
  sharedDevices: number;
  sharedPercentage: number;
}

// Additional interface for table data
interface DeviceDisplay {
  deviceId: string;
}

// Location option for enhanced dropdown
interface LocationOption {
  label: React.ReactNode;
  value: string;
  deviceCount: number;
  averageRssi: number;
}

export default function ComparePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationsData, setLocationsData] = useState<Record<string, LocationData>>({});
  const [deviceData, setDeviceData] = useState<ScannedDevice[]>([]);
  const [compareMode, setCompareMode] = useState<"all" | "common" | "unique">("all");
  const [locationDistances, setLocationDistances] = useState<LocationDistance[]>([]);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"ascend" | "descend" | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      // Fetch all unique device IDs by location to get accurate counts
      const { data: deviceCountData, error: deviceCountError } = await safeSupabaseOperation(() =>
        supabase
          .from("scanned_device")
          .select("location_name, device_id")
          .not("location_name", "is", null)
      );

      if (deviceCountError) {
        console.error("Error fetching device counts:", deviceCountError);
        return;
      }

      // Create map for counting unique devices per location
      const devicesByLocation = new Map<string, Set<string>>();

      deviceCountData.forEach((item: any) => {
        if (item.location_name && item.device_id) {
          if (!devicesByLocation.has(item.location_name)) {
            devicesByLocation.set(item.location_name, new Set());
          }
          devicesByLocation.get(item.location_name)?.add(item.device_id);
        }
      });

      // Fetch location data with RSSI info
      const { data: locationData, error: locationError } = await safeSupabaseOperation(() =>
        supabase
          .from("scanned_device")
          .select("location_name, location_latitude, location_longitude, rssi")
          .not("location_name", "is", null)
      );

      if (locationError) {
        console.error("Error fetching locations:", locationError);
        return;
      }

      // Create a map to store location coordinates and aggregate data
      const locationMap = new Map<
        string,
        {
          lat: number | null;
          lng: number | null;
          rssiSum: number;
          rssiCount: number;
        }
      >();

      // Process location data
      locationData.forEach((item: any) => {
        if (item.location_name) {
          const locationName = item.location_name;

          if (!locationMap.has(locationName)) {
            locationMap.set(locationName, {
              lat: item.location_latitude,
              lng: item.location_longitude,
              rssiSum: 0,
              rssiCount: 0,
            });
          }

          const locationInfo = locationMap.get(locationName)!;

          if (item.rssi) {
            locationInfo.rssiSum += item.rssi;
            locationInfo.rssiCount++;
          }
        }
      });

      // Get unique locations
      const uniqueLocations = Array.from(locationMap.keys());
      setLocations(uniqueLocations);

      // Create enhanced location options for the dropdown
      const options = uniqueLocations.map((locationName) => {
        const info = locationMap.get(locationName)!;
        // Get device count from our device counting map
        const deviceCount = devicesByLocation.get(locationName)?.size || 0;
        const averageRssi = info.rssiCount > 0 ? Math.round(info.rssiSum / info.rssiCount) : 0;

        // Get signal strength color
        let signalColor = "red";
        if (averageRssi > -70) signalColor = "green";
        else if (averageRssi > -90) signalColor = "orange";

        return {
          label: (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <span className="font-medium">{locationName}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Tag color="blue">{deviceCount} devices</Tag>
                <Tag color={signalColor}>{averageRssi} dBm</Tag>
              </div>
            </div>
          ),
          value: locationName,
          deviceCount,
          averageRssi,
        };
      });

      setLocationOptions(options);

      // Auto-select first two locations if available
      if (uniqueLocations.length >= 2) {
        setSelectedLocations([uniqueLocations[0], uniqueLocations[1]]);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (
    lat1: number | null | undefined,
    lon1: number | null | undefined,
    lat2: number | null | undefined,
    lon2: number | null | undefined
  ): number | null => {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return null;
    }

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance; // distance in meters
  };

  // Calculate location distances and shared devices
  const calculateLocationDistances = (locationsData: Record<string, LocationData>) => {
    const distances: LocationDistance[] = [];
    const locationNames = Object.keys(locationsData);

    // Calculate distance and shared devices for each location pair
    for (let i = 0; i < locationNames.length; i++) {
      for (let j = i + 1; j < locationNames.length; j++) {
        const loc1 = locationsData[locationNames[i]];
        const loc2 = locationsData[locationNames[j]];

        // Calculate distance
        const distance = calculateDistance(
          loc1.latitude,
          loc1.longitude,
          loc2.latitude,
          loc2.longitude
        );

        // Calculate shared devices
        const devicesLoc1 = loc1.uniqueDeviceIds;
        const devicesLoc2 = loc2.uniqueDeviceIds;

        const sharedDevices = [...devicesLoc1].filter((d) => devicesLoc2.has(d)).length;

        // Calculate percentage of shared devices
        const totalUniqueDevices = new Set([...devicesLoc1, ...devicesLoc2]).size;
        const sharedPercentage =
          totalUniqueDevices > 0 ? (sharedDevices / totalUniqueDevices) * 100 : 0;

        // Add distance data
        distances.push({
          location1: loc1.name,
          location2: loc2.name,
          distanceMeters: distance || 0,
          sharedDevices,
          sharedPercentage,
        });
      }
    }

    return distances;
  };

  const handleCompare = async () => {
    if (selectedLocations.length < 2) {
      return;
    }

    setIsLoading(true);
    try {
      // Clear previous data
      setLocationsData({});
      setLocationDistances([]);

      // Fetch data for selected locations
      const locationsDataMap: Record<string, LocationData> = {};

      for (const locationName of selectedLocations) {
        const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
          supabase
            .from("scanned_device")
            .select("*")
            .eq("location_name", locationName)
            .order("scan_time", { ascending: false })
        );

        if (deviceError) {
          console.error(`Error fetching data for location ${locationName}:`, deviceError);
          continue;
        }

        // Get unique device IDs at this location
        const uniqueDeviceIds = new Set<string>();
        let rssiSum = 0;
        let rssiCount = 0;

        deviceData.forEach((device: ScannedDevice) => {
          if (device.device_id) {
            uniqueDeviceIds.add(device.device_id);
          }

          if (device.rssi) {
            rssiSum += device.rssi;
            rssiCount++;
          }
        });

        // Calculate average RSSI
        const averageRssi = rssiCount > 0 ? rssiSum / rssiCount : 0;

        // Extract latitude and longitude for this location from first device with coordinates
        let latitude = null;
        let longitude = null;
        for (const device of deviceData) {
          if (device.location_latitude && device.location_longitude) {
            latitude = device.location_latitude;
            longitude = device.location_longitude;
            break;
          }
        }

        locationsDataMap[locationName] = {
          id: deviceData.length > 0 ? deviceData[0].location_id : 0,
          name: locationName,
          deviceCount: uniqueDeviceIds.size,
          uniqueDeviceIds,
          devices: deviceData,
          latitude,
          longitude,
          averageRssi,
        };
      }

      setLocationsData(locationsDataMap);

      // Calculate distances between locations
      const distances = calculateLocationDistances(locationsDataMap);
      setLocationDistances(distances);

      // Combine all device data
      const allDevices = Object.values(locationsDataMap).flatMap(
        (locationData) => locationData.devices
      );
      setDeviceData(allDevices);
    } catch (error) {
      console.error("Error comparing locations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate common and unique device sets
  const deviceSets = useMemo(() => {
    if (Object.keys(locationsData).length < 2 || selectedLocations.length < 2) {
      return { common: new Set<string>(), uniqueByLocation: {} };
    }

    // Get all device IDs from each location
    const deviceIdsByLocation: Record<string, Set<string>> = {};
    Object.entries(locationsData).forEach(([locationName, data]) => {
      deviceIdsByLocation[locationName] = data.uniqueDeviceIds;
    });

    // Make sure the first selected location exists in our data
    if (!deviceIdsByLocation[selectedLocations[0]]) {
      return { common: new Set<string>(), uniqueByLocation: {} };
    }

    // Calculate common devices (intersection of all sets)
    let commonDevices: Set<string> = new Set([...deviceIdsByLocation[selectedLocations[0]]]);

    for (let i = 1; i < selectedLocations.length; i++) {
      // Skip if this location doesn't exist in our data
      if (!deviceIdsByLocation[selectedLocations[i]]) continue;

      const locationDevices = deviceIdsByLocation[selectedLocations[i]];
      commonDevices = new Set(
        [...commonDevices].filter((deviceId) => locationDevices.has(deviceId))
      );
    }

    // Calculate unique devices per location
    const uniqueByLocation: Record<string, Set<string>> = {};
    Object.entries(deviceIdsByLocation).forEach(([locationName, deviceIds]) => {
      const uniqueDevices = new Set<string>();
      deviceIds.forEach((deviceId) => {
        // A device is unique to this location if it's not in any other location
        const isUnique = Object.entries(deviceIdsByLocation)
          .filter(([otherLocation]) => otherLocation !== locationName)
          .every(([_, otherDeviceIds]) => !otherDeviceIds.has(deviceId));

        if (isUnique) {
          uniqueDevices.add(deviceId);
        }
      });
      uniqueByLocation[locationName] = uniqueDevices;
    });

    return { common: commonDevices, uniqueByLocation };
  }, [locationsData, selectedLocations]);

  // Get the devices to display based on the compare mode
  const devicesToDisplay = useMemo(() => {
    if (compareMode === "all") {
      return [
        ...new Set(Object.values(locationsData).flatMap((data) => [...data.uniqueDeviceIds])),
      ];
    } else if (compareMode === "common") {
      return [...deviceSets.common];
    } else if (compareMode === "unique") {
      return [
        ...new Set(
          Object.values(deviceSets.uniqueByLocation || {}).flatMap((devices) => [...devices])
        ),
      ];
    }
    return [];
  }, [compareMode, locationsData, deviceSets]);

  const getDeviceLatestData = (deviceId: string, locationName: string) => {
    if (!locationsData[locationName]) return null;

    const locationDevices = locationsData[locationName].devices;
    return locationDevices.find((device) => device.device_id === deviceId) || null;
  };

  // Sort function for device data
  const handleSortData = (deviceId: string, locationA: string, locationB: string) => {
    if (!sortBy || sortBy !== locationA) return 0;

    const deviceDataA = getDeviceLatestData(deviceId, locationA);
    const deviceDataB = getDeviceLatestData(deviceId, locationB);

    if (!deviceDataA && !deviceDataB) return 0;
    if (!deviceDataA) return sortOrder === "ascend" ? -1 : 1;
    if (!deviceDataB) return sortOrder === "ascend" ? 1 : -1;

    return sortOrder === "ascend"
      ? deviceDataA.rssi - deviceDataB.rssi
      : deviceDataB.rssi - deviceDataA.rssi;
  };

  // Define table columns
  const columns = [
    {
      title: "Device ID",
      key: "deviceId",
      dataIndex: "deviceId",
      render: (text: string) => {
        // Find device name from any location where this device appears
        let deviceName = "";
        for (const locationName of selectedLocations) {
          const device = getDeviceLatestData(text, locationName);
          if (device && device.device_name) {
            deviceName = device.device_name;
            break;
          }
        }

        return (
          <Space direction="vertical" size="small">
            <Tooltip title={text}>
              <Text className="font-mono" ellipsis style={{ maxWidth: 180 }}>
                {text}
              </Text>
            </Tooltip>
            {deviceName && (
              <Text type="secondary" italic className="text-xs">
                {deviceName}
              </Text>
            )}
          </Space>
        );
      },
      sorter: (a: { deviceId: string }, b: { deviceId: string }) =>
        a.deviceId.localeCompare(b.deviceId),
    },
    ...selectedLocations.map((locationName) => ({
      title: () => (
        <div>
          <Text strong>{locationName}</Text>
          {deviceSets.uniqueByLocation[locationName] && (
            <Badge
              count={deviceSets.uniqueByLocation[locationName].size}
              style={{ backgroundColor: "#52c41a", marginLeft: 8 }}
              overflowCount={999}
            />
          )}
        </div>
      ),
      key: locationName,
      sorter: (a: { deviceId: string }, b: { deviceId: string }) => {
        const deviceA = getDeviceLatestData(a.deviceId, locationName);
        const deviceB = getDeviceLatestData(b.deviceId, locationName);

        if (!deviceA && !deviceB) return 0;
        if (!deviceA) return 1;
        if (!deviceB) return -1;

        return deviceA.rssi - deviceB.rssi;
      },
      sortDirections: ["ascend", "descend"] as SortOrder[],
      onHeaderCell: () => ({
        onClick: () => {
          if (sortBy === locationName) {
            setSortOrder(sortOrder === "ascend" ? "descend" : "ascend");
          } else {
            setSortBy(locationName);
            setSortOrder("ascend");
          }
        },
      }),
      render: (_: any, record: DeviceDisplay) => {
        const deviceData = getDeviceLatestData(record.deviceId, locationName);
        if (!deviceData) {
          return (
            <Space>
              <CloseCircleOutlined style={{ color: "red" }} />
              <Text type="secondary">Not detected</Text>
            </Space>
          );
        }

        // Define color based on signal strength
        let color = "red";
        if (deviceData.rssi > -70) color = "green";
        else if (deviceData.rssi > -90) color = "orange";

        return (
          <Space direction="vertical" size="small">
            <Tag color={color}>{deviceData.rssi} dBm</Tag>
            <Text type="secondary" className="text-xs">
              {new Date(deviceData.scan_time).toLocaleString()}
            </Text>
          </Space>
        );
      },
    })),
  ];

  return (
    <DashboardLayout>
      <div className="p-4">
        <Title level={2}>Location Comparison</Title>
        <Text type="secondary">Compare BLE device data between different scanning locations</Text>

        <Card className="mt-6 mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <Title level={4} className="m-0">
                Comparison Settings
              </Title>
              <Button
                color="primary"
                variant="solid"
                onPress={handleCompare}
                isDisabled={selectedLocations.length < 2 || isLoading}
                isLoading={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all hover:scale-105"
                size="lg"
              >
                <WifiOutlined className="mr-2" /> Compare Locations
              </Button>
            </div>
          </CardHeader>

          <Divider className="my-2" />

          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Text strong className="block mb-2">
                  Select Locations (2-3)
                </Text>
                <Select
                  mode="multiple"
                  placeholder="Select 2-3 locations to compare"
                  style={{ width: "100%" }}
                  value={selectedLocations}
                  onChange={setSelectedLocations}
                  disabled={isLoading}
                  maxTagCount={3}
                  maxCount={3}
                  loading={isLoading}
                  options={locationOptions}
                  optionLabelProp="value"
                  listHeight={300}
                  dropdownStyle={{ minWidth: "400px" }}
                  popupMatchSelectWidth={false}
                />

                <Alert
                  className="mt-4"
                  type="info"
                  message={
                    <div>
                      <Text strong>How to use:</Text> Select 2-3 locations and click the{" "}
                      <Text mark>Compare Locations</Text> button to analyze the data
                    </div>
                  }
                  showIcon
                />
              </div>

              <div>
                <Text strong className="block mb-2">
                  Comparison Mode
                </Text>
                <Select
                  style={{ width: "100%" }}
                  value={compareMode}
                  onChange={setCompareMode}
                  disabled={isLoading || Object.keys(locationsData).length < 2}
                  options={[
                    { label: "All Devices", value: "all" },
                    { label: "Common Devices Only", value: "common" },
                    { label: "Unique Devices Only", value: "unique" },
                  ]}
                />

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-md">
                    <Text strong>Common Devices</Text>
                    <div className="text-xl font-bold">
                      {deviceSets.common ? deviceSets.common.size : 0}
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-md">
                    <Text strong>Total Unique Devices</Text>
                    <div className="text-xl font-bold">
                      {Object.values(deviceSets.uniqueByLocation || {}).reduce(
                        (sum, devices) => sum + devices.size,
                        0
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {isLoading ? (
          <div className="flex justify-center items-center py-12 flex-col">
            <Spin size="large" />
            <Text className="mt-3">Loading location data...</Text>
          </div>
        ) : Object.keys(locationsData).length >= 2 ? (
          <div>
            {locationDistances.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center">
                    <Title level={4} className="m-0">
                      <ArrowsAltOutlined className="mr-2" /> Location Distance Analysis
                    </Title>
                  </div>
                </CardHeader>
                <Divider />
                <CardBody className="pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {locationDistances.map((distance, index) => (
                      <Card key={index} className="shadow-sm">
                        <CardBody>
                          <div className="flex justify-between mb-2">
                            <Title level={5} className="m-0 text-base">
                              {distance.location1} ↔ {distance.location2}
                            </Title>
                            <Tag color="blue">
                              {distance.distanceMeters > 1000
                                ? `${(distance.distanceMeters / 1000).toFixed(2)} km`
                                : `${Math.round(distance.distanceMeters)} m`}
                            </Tag>
                          </div>

                          <div className="mb-4">
                            <div className="flex justify-between mb-1">
                              <Text>Shared Devices</Text>
                              <Text strong>{distance.sharedDevices}</Text>
                            </div>
                            <Progress
                              percent={Math.round(distance.sharedPercentage)}
                              size="small"
                              status={distance.sharedPercentage > 50 ? "success" : "active"}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <Statistic
                              title="Overlap %"
                              value={Math.round(distance.sharedPercentage)}
                              suffix="%"
                              valueStyle={{ fontSize: "1.2rem" }}
                            />
                            <Statistic
                              title="Signal Relation"
                              value={
                                distance.distanceMeters > 0
                                  ? Math.round(
                                      100 *
                                        (distance.sharedPercentage /
                                          Math.log10(distance.distanceMeters + 1))
                                    ) / 100
                                  : "N/A"
                              }
                              valueStyle={{ fontSize: "1.2rem" }}
                            />
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <Title level={4} className="m-0">
                    Comparison Results
                  </Title>
                  <Space>
                    <Badge count={devicesToDisplay.length} overflowCount={999}>
                      <Tag color="blue">Devices</Tag>
                    </Badge>
                    <Badge count={selectedLocations.length} overflowCount={5}>
                      <Tag color="purple">Locations</Tag>
                    </Badge>
                  </Space>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                {devicesToDisplay.length > 0 ? (
                  <Table
                    dataSource={devicesToDisplay.map((device) => ({ deviceId: device }))}
                    columns={columns}
                    rowKey="deviceId"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: true }}
                    onChange={(pagination, filters, sorter) => {
                      // Handle sorting from the table
                      if (Array.isArray(sorter)) {
                        // Handle multiple sorters if needed
                      } else if (sorter.columnKey) {
                        setSortBy(sorter.columnKey as string);
                        setSortOrder(sorter.order as "ascend" | "descend" | null);
                      }
                    }}
                  />
                ) : (
                  <Empty
                    description={`No ${compareMode} devices found between the selected locations`}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <Title level={4} className="m-0">
                  Analysis Insights
                </Title>
              </CardHeader>
              <Divider />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-md">
                    <Text strong>Common Device Ratio</Text>
                    <div className="text-xl font-bold">
                      {deviceSets.common && Object.keys(locationsData).length > 0
                        ? `${Math.round(
                            (deviceSets.common.size /
                              Math.max(
                                ...Object.values(locationsData).map((data) => data.deviceCount)
                              )) *
                              100
                          )}%`
                        : "N/A"}
                    </div>
                    <Text type="secondary">
                      Percentage of devices common across all selected locations
                    </Text>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-md">
                    <Text strong>Location with Most Unique Devices</Text>
                    <div className="text-xl font-bold">
                      {Object.entries(deviceSets.uniqueByLocation || {}).sort(
                        (a, b) => b[1].size - a[1].size
                      )[0]?.[0] || "N/A"}
                    </div>
                    <Text type="secondary">
                      The location with the highest number of devices not found elsewhere
                    </Text>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-md">
                    <Text strong>Average Distance</Text>
                    <div className="text-xl font-bold">
                      {locationDistances.length > 0
                        ? locationDistances.reduce((sum, d) => sum + d.distanceMeters, 0) /
                            locationDistances.length >
                          1000
                          ? `${(
                              locationDistances.reduce((sum, d) => sum + d.distanceMeters, 0) /
                              locationDistances.length /
                              1000
                            ).toFixed(2)} km`
                          : `${Math.round(
                              locationDistances.reduce((sum, d) => sum + d.distanceMeters, 0) /
                                locationDistances.length
                            )} m`
                        : "N/A"}
                    </div>
                    <Text type="secondary">Average distance between the compared locations</Text>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Select 2-3 locations and click 'Compare Locations' to see analysis results"
          />
        )}
      </div>
    </DashboardLayout>
  );
}
