"use client";

import Link from "next/link";

export default function EmergencyPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <div
        style={{
          backgroundColor: "#fef2f2",
          borderRadius: "0.5rem",
          padding: "1rem",
          marginBottom: "2rem",
          border: "1px solid #fee2e2",
        }}
      >
        <h2 style={{ color: "#dc2626", fontWeight: "bold", marginBottom: "0.5rem" }}>
          Emergency Mode
        </h2>
        <p style={{ color: "#b91c1c", marginBottom: "0.5rem" }}>
          The main application is currently experiencing technical difficulties. This is a minimal
          emergency page to allow you to access the BLE Scanner data.
        </p>
      </div>

      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>
        BLE Scanner Emergency Access
      </h1>

      <nav style={{ marginBottom: "2rem" }}>
        <ul
          style={{
            display: "flex",
            gap: "1rem",
            listStyle: "none",
            padding: 0,
            flexWrap: "wrap",
          }}
        >
          <li>
            <Link
              href="/analysis-basic"
              style={{
                color: "white",
                backgroundColor: "#2563eb",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Basic Analysis
            </Link>
          </li>
          <li>
            <Link
              href="/analysis-simple"
              style={{
                color: "white",
                backgroundColor: "#2563eb",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Simple Analysis
            </Link>
          </li>
          <li>
            <Link
              href="/"
              style={{
                color: "#4b5563",
                backgroundColor: "#e5e7eb",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Try Dashboard
            </Link>
          </li>
        </ul>
      </nav>

      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
          Instructions
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          While we work on resolving the issues with the main application, you can:
        </p>
        <ul style={{ paddingLeft: "1.5rem", marginBottom: "1rem" }}>
          <li style={{ marginBottom: "0.5rem" }}>
            Use the Basic Analysis page to view simple data
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            Access the Simple Analysis page for a different view
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            Try the main Dashboard (may not work currently)
          </li>
        </ul>
        <p>
          We apologize for the inconvenience and are working to restore full functionality as soon
          as possible.
        </p>
      </div>
    </div>
  );
}
