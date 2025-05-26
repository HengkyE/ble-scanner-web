"use client";

import React from "react";
import Script from "next/script";

export default function MapsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Inject Leaflet CSS to ensure it's available */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />

      {/* Add Leaflet heat map script - load from CDN */}
      <Script
        src="https://unpkg.com/leaflet.heat/dist/leaflet-heat.js"
        strategy="afterInteractive"
      />

      {/* Add some global styles for Leaflet to ensure proper display */}
      <style jsx global>{`
        .leaflet-container {
          height: 100%;
          width: 100%;
          z-index: 1;
        }
        .leaflet-control-container .leaflet-control {
          z-index: 400 !important;
        }
        .leaflet-tooltip {
          z-index: 500 !important;
        }
        /* Fix for div markers */
        .custom-device-marker div,
        .custom-location-marker div,
        .custom-device-marker-history div {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
      {children}
    </>
  );
}
