"use client";

import { useState } from "react";
import Link from "next/link";

export default function BasicAnalysisPage() {
  const [count, setCount] = useState(0);

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "960px",
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>
          Basic Analysis Page
        </h1>
        <nav>
          <ul style={{ display: "flex", gap: "1rem" }}>
            <li>
              <Link href="/" style={{ color: "blue", textDecoration: "underline" }}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/devices" style={{ color: "blue", textDecoration: "underline" }}>
                Devices
              </Link>
            </li>
            <li>
              <Link href="/maps" style={{ color: "blue", textDecoration: "underline" }}>
                Maps
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #ddd",
            borderRadius: "0.5rem",
            backgroundColor: "white",
            marginBottom: "2rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
            Simple Interactive Component
          </h2>
          <p style={{ marginBottom: "1rem" }}>Counter: {count}</p>
          <button
            onClick={() => setCount(count + 1)}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Increment
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "1rem",
          }}
        >
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              style={{
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "0.5rem",
                backgroundColor: "white",
              }}
            >
              <h3 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
                Card {item}
              </h3>
              <p>Example content that doesn't depend on any external components.</p>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ marginTop: "3rem", textAlign: "center", color: "#666" }}>
        <p>BLE Scanner Web Application — Basic Analysis View</p>
      </footer>
    </div>
  );
}
