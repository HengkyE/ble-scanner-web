"use client";

import Link from "next/link";

export default function HomeBackup() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>
        BLE Scanner Analytics
      </h1>
      <p style={{ marginBottom: "2rem" }}>
        Welcome to the BLE Scanner. Please use one of the links below to access the application.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <NavCard title="Analysis Basic" href="/analysis-basic" />
        <NavCard title="Analysis Simple" href="/analysis-simple" />
        <NavCard title="Analysis" href="/analysis" />
        <NavCard title="Maps" href="/maps" />
        <NavCard title="Devices" href="/devices" />
      </div>

      <div
        style={{
          backgroundColor: "#f9fafb",
          padding: "1rem",
          borderRadius: "0.5rem",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
          Temporary Notice
        </h2>
        <p>
          Some parts of the application are currently undergoing maintenance. The basic analysis
          pages are functioning properly.
        </p>
      </div>
    </div>
  );
}

function NavCard({ title, href }: { title: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          backgroundColor: "white",
          padding: "1.5rem",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          border: "1px solid #e5e7eb",
          color: "#4b5563",
          textAlign: "center",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
          e.currentTarget.style.borderColor = "#0c66a4";
          e.currentTarget.style.color = "#0c66a4";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
          e.currentTarget.style.borderColor = "#e5e7eb";
          e.currentTarget.style.color = "#4b5563";
        }}
      >
        <span style={{ fontWeight: "500", fontSize: "1.1rem" }}>{title}</span>
      </div>
    </Link>
  );
}
