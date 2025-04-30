"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

interface MapComponentProps {
  locations: Location[];
  devices: Device[];
  onDeviceSelect: (deviceId: number) => void;
  onLocationSelect: (locationId: number) => void;
}

export default function MapComponent({
  locations,
  devices,
  onDeviceSelect,
  onLocationSelect,
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    // Fix for Leaflet's icon issue in Next.js
    const fixLeafletIcon = () => {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      });
    };

    // Initialize the map
    const initializeMap = () => {
      if (mapContainerRef.current && !mapRef.current) {
        fixLeafletIcon();

        // Initialize map
        mapRef.current = L.map(mapContainerRef.current).setView([0, 0], 2);

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);

        // Create layer group for markers
        markersRef.current = L.layerGroup().addTo(mapRef.current);
      }
    };

    initializeMap();

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    // Create bounds for auto-zooming
    const bounds = new L.LatLngBounds([]);
    const hasMarkers = locations.length > 0 || devices.length > 0;

    // Debug info
    console.log("MapComponent rendering with:", {
      locations: locations.length,
      devices: devices.length,
    });

    // Add location markers
    const deviceCountsByLocation = new Map<number, number>();

    // Count devices at each location
    devices.forEach((device) => {
      if (device.location_id) {
        const count = deviceCountsByLocation.get(device.location_id) || 0;
        deviceCountsByLocation.set(device.location_id, count + 1);
      }
    });

    console.log("Device counts by location:", Object.fromEntries(deviceCountsByLocation));

    // For debugging - collect info about devices with no location
    const devicesWithNoLocation = devices.filter(
      (d) => !d.location_id || d.location_id === 0
    ).length;
    const debugInfo = [
      `Locations: ${locations.length}`,
      `Devices: ${devices.length}`,
      `Devices with no location: ${devicesWithNoLocation}`,
      `Device counts by location: ${JSON.stringify(Object.fromEntries(deviceCountsByLocation))}`,
    ].join("\n");
    setDebug(debugInfo);

    locations.forEach((location) => {
      // Count devices at this location
      const deviceCount = deviceCountsByLocation.get(location.id) || 0;

      console.log(`Location ${location.id} (${location.name}) has ${deviceCount} devices`);

      const locationIcon = L.divIcon({
        className: "custom-location-marker",
        html: `<div style="
          background-color: rgba(0, 0, 255, 0.6);
          border: 2px solid white;
          border-radius: 50%;
          width: ${Math.max(20, Math.min(40, 20 + deviceCount * 3))}px;
          height: ${Math.max(20, Math.min(40, 20 + deviceCount * 3))}px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 10px;
        ">${deviceCount}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([location.lat, location.lng], {
        icon: locationIcon,
        title: location.name,
      }).addTo(markersRef.current!);

      marker.bindTooltip(`${location.name} (${deviceCount} devices)`);
      marker.on("click", () => onLocationSelect(location.id));

      bounds.extend([location.lat, location.lng]);
    });

    // Add device markers
    devices.forEach((device) => {
      // Calculate opacity based on RSSI (-30 to -100 dBm typical range)
      // Higher RSSI (closer to 0) = darker marker (more opacity)
      const rssiAbs = Math.abs(device.rssi);
      const opacity = Math.max(0.3, Math.min(0.9, 1 - (rssiAbs - 30) / 70));

      const deviceIcon = L.divIcon({
        className: "custom-device-marker",
        html: `<div style="
          background-color: rgba(255, 0, 0, ${opacity});
          border: 2px solid white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([device.lat, device.lng], {
        icon: deviceIcon,
        title: device.name,
      }).addTo(markersRef.current!);

      // Add location name to tooltip if available
      const location = device.location_id
        ? locations.find((l) => l.id === device.location_id)?.name
        : "";
      const tooltipText = location
        ? `${device.name} (${device.rssi} dBm, at ${location})`
        : `${device.name} (${device.rssi} dBm)`;

      marker.bindTooltip(tooltipText);
      marker.on("click", () => onDeviceSelect(device.id));

      bounds.extend([device.lat, device.lng]);
    });

    // Fit map to markers if we have any
    if (hasMarkers && bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [locations, devices, onDeviceSelect, onLocationSelect]);

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
      {debug && (
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
            background: "rgba(255,255,255,0.8)",
            padding: "5px",
            borderRadius: "5px",
            fontSize: "12px",
            maxWidth: "300px",
            zIndex: 1000,
          }}
        >
          <pre>{debug}</pre>
        </div>
      )}
    </div>
  );
}
