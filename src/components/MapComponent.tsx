"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

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
  device_id?: string;
  scan_time?: string;
  timestamp?: string; // For rssi_timeseries
  sequence_number?: number; // For rssi_timeseries
}

interface MapComponentProps {
  locations: Location[];
  devices: Device[];
  onDeviceSelect: (deviceId: number) => void;
  onLocationSelect: (locationId: number) => void;
  showHeatmap?: boolean;
}

export default function MapComponent({
  locations,
  devices,
  onDeviceSelect,
  onLocationSelect,
  showHeatmap = false,
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<any>(null);
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
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([0, 0], 2);

        // Add zoom control to the top-right
        L.control.zoom({ position: "topright" }).addTo(mapRef.current);

        // Add attribution control to the bottom-right
        L.control
          .attribution({
            position: "bottomright",
            prefix: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          })
          .addTo(mapRef.current);

        // Add tile layer - using a more modern style
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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

    // Remove previous heatmap if it exists
    if (heatmapLayerRef.current && mapRef.current.hasLayer(heatmapLayerRef.current)) {
      mapRef.current.removeLayer(heatmapLayerRef.current);
    }

    // Create bounds for auto-zooming
    const bounds = new L.LatLngBounds([]);
    const hasMarkers = locations.length > 0 || devices.length > 0;

    // Debug info
    console.log("MapComponent rendering with:", {
      locations: locations.length,
      devices: devices.length,
      showHeatmap,
    });

    // Add location markers
    const deviceCountsByLocation = new Map<number, number>();
    const devicesByIdMap = new Map<string, Device[]>();

    // Group devices by device_id for timeseries data
    devices.forEach((device) => {
      // Count by location
      if (device.location_id) {
        const count = deviceCountsByLocation.get(device.location_id) || 0;
        deviceCountsByLocation.set(device.location_id, count + 1);
      }

      // Group by device ID
      if (device.device_id) {
        if (!devicesByIdMap.has(device.device_id)) {
          devicesByIdMap.set(device.device_id, []);
        }
        devicesByIdMap.get(device.device_id)!.push(device);
      }
    });

    // Create heatmap data if needed
    if (showHeatmap && devices.length > 0) {
      const heatData: Array<[number, number, number]> = devices.map((device) => {
        // Normalize RSSI values between -100 and -30
        // Higher RSSI (closer to 0) = more intensity
        const intensity = 1 - Math.min(1, Math.max(0, (Math.abs(device.rssi) - 30) / 70));
        return [device.lat, device.lng, intensity * 0.8]; // Scale down intensity a bit
      });

      // Create the heatmap layer - using the explicit typing
      heatmapLayerRef.current = L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.4: "blue", 0.6: "lime", 0.8: "yellow", 1.0: "red" },
      }).addTo(mapRef.current);
    } else {
      // Process devices by ID to show the latest position for each device with a trail of previous positions
      devicesByIdMap.forEach((deviceGroup, deviceId) => {
        // Sort by timestamp if available, or creation date
        const sortedDevices = deviceGroup.sort((a, b) => {
          const aTime = a.timestamp || a.scan_time || "";
          const bTime = b.timestamp || b.scan_time || "";
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

        // The most recent device position
        const latestDevice = sortedDevices[0];

        // For the latest position, add a larger, more visible marker
        // Calculate color based on RSSI (-30 to -100 dBm typical range)
        let color = "#ff0000"; // Default red

        if (latestDevice.rssi > -65) {
          color = "#4ade80"; // Green for strong signal
        } else if (latestDevice.rssi > -80) {
          color = "#fbbf24"; // Yellow/orange for medium signal
        }

        // Calculate opacity based on RSSI
        const opacity = Math.max(0.6, Math.min(0.95, 1 - (Math.abs(latestDevice.rssi) - 30) / 70));

        const deviceIcon = L.divIcon({
          className: "custom-device-marker",
          html: `<div style="
            background-color: ${color};
            opacity: ${opacity};
            border: 2px solid white;
            border-radius: 50%;
            width: 14px;
            height: 14px;
            box-shadow: 0 0 5px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([latestDevice.lat, latestDevice.lng], {
          icon: deviceIcon,
          title: latestDevice.name,
        }).addTo(markersRef.current!);

        // Add location name to tooltip if available
        const location = latestDevice.location_id
          ? locations.find((l) => l.id === latestDevice.location_id)?.name
          : "";
        const deviceIdText = latestDevice.device_id ? `ID: ${latestDevice.device_id}` : "";
        const timeText = latestDevice.timestamp || latestDevice.scan_time || "";
        const formattedTime = timeText ? new Date(timeText).toLocaleTimeString() : "";

        const tooltipText = `
          <div>
            <strong>${latestDevice.name}</strong><br/>
            ${deviceIdText ? `${deviceIdText}<br/>` : ""}
            Signal: <strong>${latestDevice.rssi} dBm</strong>
            ${location ? `<br/>Location: ${location}` : ""}
            ${formattedTime ? `<br/>Time: ${formattedTime}` : ""}
            ${latestDevice.sequence_number ? `<br/>Sequence: ${latestDevice.sequence_number}` : ""}
          </div>`;

        marker.bindTooltip(tooltipText, { offset: [0, -7] });
        marker.on("click", () => onDeviceSelect(latestDevice.id));

        bounds.extend([latestDevice.lat, latestDevice.lng]);

        // Add smaller markers for historical positions (but only if we're showing timeseries data)
        if (sortedDevices.length > 1 && sortedDevices[0].timestamp) {
          // Take only the 10 most recent historical positions to avoid cluttering the map
          const historyPoints = sortedDevices.slice(1, 11);

          // Create a polyline for the device path
          const pathPoints = [
            [latestDevice.lat, latestDevice.lng],
            ...historyPoints.map((d) => [d.lat, d.lng]),
          ];

          L.polyline(pathPoints as [number, number][], {
            color: color,
            weight: 2,
            opacity: 0.5,
            dashArray: "5, 5",
          }).addTo(markersRef.current!);

          // Add small dots for historical positions
          historyPoints.forEach((historyDevice, index) => {
            // Make markers progressively smaller and more transparent the older they are
            const sizeScale = Math.max(0.4, 1 - index / historyPoints.length);
            const opacityScale = Math.max(0.3, 1 - index / historyPoints.length);

            const historyIcon = L.divIcon({
              className: "history-device-marker",
              html: `<div style="
                background-color: ${color};
                opacity: ${opacityScale * opacity};
                border: 1px solid white;
                border-radius: 50%;
                width: ${8 * sizeScale}px;
                height: ${8 * sizeScale}px;
              "></div>`,
              iconSize: [8, 8],
              iconAnchor: [4, 4],
            });

            const historyMarker = L.marker([historyDevice.lat, historyDevice.lng], {
              icon: historyIcon,
              interactive: false, // Disable interactions with historical markers
            }).addTo(markersRef.current!);

            bounds.extend([historyDevice.lat, historyDevice.lng]);
          });
        }
      });
    }

    // Always show location markers regardless of heatmap setting
    locations.forEach((location) => {
      // Count devices at this location
      const deviceCount = deviceCountsByLocation.get(location.id) || 0;

      const locationIcon = L.divIcon({
        className: "custom-location-marker",
        html: `<div style="
          background-color: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          width: ${Math.max(24, Math.min(44, 24 + deviceCount * 2))}px;
          height: ${Math.max(24, Math.min(44, 24 + deviceCount * 2))}px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 11px;
          box-shadow: 0 0 10px rgba(0,0,0,0.4);
        ">${deviceCount}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([location.lat, location.lng], {
        icon: locationIcon,
        title: location.name,
        zIndexOffset: 1000, // Make location markers appear above device markers
      }).addTo(markersRef.current!);

      marker.bindTooltip(
        `
        <div>
          <strong>${location.name}</strong><br/>
          ${deviceCount} record${deviceCount !== 1 ? "s" : ""}
        </div>
      `,
        { offset: [0, -12] }
      );

      marker.on("click", () => onLocationSelect(location.id));

      bounds.extend([location.lat, location.lng]);
    });

    // Fit map to markers if we have any
    if (hasMarkers && bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [locations, devices, onDeviceSelect, onLocationSelect, showHeatmap]);

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
