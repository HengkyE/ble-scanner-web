"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Spinner, Input, Button, Card, CardBody } from "@nextui-org/react";
import DashboardLayout from "@/components/DashboardLayout";
import supabase, { safeSupabaseOperation } from "@/lib/supabase";

// Dynamically import the Map component to avoid SSR issues with leaflet
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "400px",
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
}

interface Device {
  id: number;
  name: string;
  location_id: number;
  lat: number;
  lng: number;
  rssi: number;
  notes: string;
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

  // Fetch data from Supabase on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Apply filters when filter conditions change
  useEffect(() => {
    applyFilters();
  }, [selectedLocation, searchQuery, locations, devices]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Fetching data from Supabase...");

      // First let's check what tables are available
      const { data: tablesData, error: tablesError } = await safeSupabaseOperation(() =>
        supabase.from("_tables").select("*")
      );

      console.log("Available tables:", tablesData || "Error fetching tables");

      // Fetch locations
      console.log("Fetching location data...");
      const { data: locationData, error: locationError } = await safeSupabaseOperation(() =>
        supabase.from("location_scanned").select("*").order("created_at", { ascending: false })
      );

      // Log full API response
      console.log("Raw location data response:", locationData);
      console.log("Location error:", locationError);

      if (locationError) {
        console.error("Error fetching locations:", locationError);
        setError(`Error fetching locations: ${locationError.message}`);
        return;
      }

      // Fetch devices
      console.log("Fetching device data...");
      const { data: deviceData, error: deviceError } = await safeSupabaseOperation(() =>
        supabase.from("scanned_device").select("*").order("scan_time", { ascending: false })
      );

      console.log("Raw device data response:", deviceData);
      console.log("Device error:", deviceError);

      if (deviceError) {
        console.error("Error fetching devices:", deviceError);
        setError(`Error fetching devices: ${deviceError.message}`);
        return;
      }

      // Transform location data to match our interface
      console.log("Transforming data...");

      let transformedLocations: Location[] = [];

      if (locationData && locationData.length > 0) {
        // Check structure of first item to debug field names
        console.log("First location data item structure:", locationData[0]);

        transformedLocations = locationData
          .map((loc: any) => {
            // Try to handle different potential field name formats
            const lat = loc.latitude || loc.lat || loc.location_latitude;
            const lng = loc.longitude || loc.lng || loc.location_longitude;

            // Skip locations with invalid coordinates
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
              console.warn("Skipping location with invalid coordinates:", loc);
              return null;
            }

            const item = {
              id: loc.id,
              name: loc.location_name || loc.name || "Unknown Location",
              lat: Number(lat),
              lng: Number(lng),
              notes: loc.location_notes || loc.notes || "",
            };

            console.log("Transformed location:", item);
            return item;
          })
          .filter(Boolean) as Location[];
      }

      console.log("Final transformed locations:", transformedLocations);

      // Create lookup map for location names to IDs
      const locationNameToId = new Map<string, number>();
      transformedLocations.forEach((loc) => {
        locationNameToId.set(loc.name, loc.id);
      });
      console.log("Location name to ID map:", Object.fromEntries(locationNameToId));

      // Transform device data to match our interface
      let transformedDevices: Device[] = [];

      if (deviceData && deviceData.length > 0) {
        // Check structure of first item to debug field names
        console.log("First device data item structure:", deviceData[0]);

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
              console.log(`Mapped location name "${dev.location_name}" to ID ${locationId}`);
            }

            // Skip devices with invalid coordinates
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
              console.warn("Skipping device with invalid coordinates:", dev);
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
            };

            console.log("Transformed device:", item);
            return item;
          })
          .filter(Boolean) as Device[];
      }

      console.log("Final transformed devices:", transformedDevices);

      // Log device-to-location mappings for debugging
      const devicesByLocation = new Map<number, number>();
      transformedDevices.forEach((device) => {
        const locId = device.location_id;
        devicesByLocation.set(locId, (devicesByLocation.get(locId) || 0) + 1);
      });
      console.log("Devices by location:", Object.fromEntries(devicesByLocation));

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

    // Filter locations by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredLocs = filteredLocs.filter(
        (loc) => loc.name.toLowerCase().includes(query) || loc.notes.toLowerCase().includes(query)
      );
    }

    // Filter devices by selected location
    if (selectedLocation !== "all") {
      const locId = parseInt(selectedLocation);
      filteredDevs = filteredDevs.filter((dev) => dev.location_id === locId);

      // If a location is selected, only show that location
      filteredLocs = filteredLocs.filter((loc) => loc.id === locId);
    }

    // Log device counts per location for debugging
    const counts = filteredLocs.map((loc) => {
      const count = filteredDevs.filter((d) => d.location_id === loc.id).length;
      return { locationId: loc.id, locationName: loc.name, deviceCount: count };
    });
    console.log("Device counts per location:", counts);

    setFilteredLocations(filteredLocs);
    setFilteredDevices(filteredDevs);
  };

  const handleLocationSelect = (locationId: number) => {
    const location = locations.find((loc) => loc.id === locationId) || null;
    setSelectedLocationData(location);
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
      { id: 1, name: "San Francisco", lat: 37.7749, lng: -122.4194, notes: "Test location 1" },
      { id: 2, name: "New York", lat: 40.7128, lng: -74.006, notes: "Test location 2" },
    ];

    const sampleDevices: Device[] = [
      {
        id: 1,
        name: "Device 1",
        location_id: 1,
        lat: 37.7749,
        lng: -122.4194,
        rssi: -50,
        notes: "Test device 1",
      },
      {
        id: 2,
        name: "Device 2",
        location_id: 2,
        lat: 40.7128,
        lng: -74.006,
        rssi: -70,
        notes: "Test device 2",
      },
    ];

    setLocations(sampleLocations);
    setDevices(sampleDevices);
    setFilteredLocations(sampleLocations);
    setFilteredDevices(sampleDevices);
    console.log("Added sample data for testing");
  };

  return (
    <DashboardLayout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Device Map</h1>

        <div className="mb-4 flex flex-wrap gap-4">
          <Card className="w-full md:w-auto shadow-sm">
            <CardBody className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Location
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="all">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id.toString()}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Search"
                placeholder="Search by name or notes"
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="w-full md:w-64"
                isDisabled={isLoading}
              />

              <Button
                color="primary"
                onPress={() => {
                  setSelectedLocation("all");
                  setSearchQuery("");
                }}
                className="mt-auto"
                isDisabled={isLoading}
              >
                Reset Filters
              </Button>
            </CardBody>
          </Card>
        </div>

        {error && (
          <Card className="mb-4 shadow-sm bg-red-50">
            <CardBody>
              <h2 className="text-lg font-semibold text-red-600">Error</h2>
              <p className="text-sm text-red-500">{error}</p>
              <Button color="primary" onPress={addSampleData} className="mt-2">
                Use Sample Data Instead
              </Button>
            </CardBody>
          </Card>
        )}

        {locations.length === 0 && !isLoading && !error && (
          <Card className="mb-4 shadow-sm bg-yellow-50">
            <CardBody>
              <h2 className="text-lg font-semibold text-yellow-600">No Data Available</h2>
              <p className="text-sm text-yellow-500">
                No location data was found in the database. Use sample data for testing.
              </p>
              <Button color="primary" onPress={addSampleData} className="mt-2">
                Use Sample Data
              </Button>
            </CardBody>
          </Card>
        )}

        {selectedLocationData && (
          <Card className="mb-4 shadow-sm">
            <CardBody>
              <h2 className="text-lg font-semibold">{selectedLocationData.name}</h2>
              <p className="text-sm text-gray-600">{selectedLocationData.notes}</p>
              <p className="text-sm text-gray-500">
                {filteredDevices.filter((d) => d.location_id === selectedLocationData.id).length}{" "}
                devices at this location
              </p>
              <p className="text-sm text-gray-500">
                Coordinates: {selectedLocationData.lat}, {selectedLocationData.lng}
              </p>
            </CardBody>
          </Card>
        )}

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div style={{ height: "500px", width: "100%" }}>
            {isLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : (
              <MapComponent
                locations={filteredLocations}
                devices={filteredDevices}
                onLocationSelect={handleLocationSelect}
                onDeviceSelect={handleDeviceSelect}
              />
            )}
          </div>
          <p className="mt-4 text-sm text-gray-500">
            This map shows the locations of all registered devices. Click on a marker to see more
            details. {filteredLocations.length} locations and {filteredDevices.length} devices
            displayed.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
