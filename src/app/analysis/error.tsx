"use client";

import Link from "next/link";

export default function Error() {
  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Something went wrong</h1>
      <p style={{ marginBottom: "1.5rem" }}>
        We're sorry, but there was a problem loading the Analysis page.
      </p>
      <Link
        href="/"
        style={{
          color: "blue",
          textDecoration: "underline",
        }}
      >
        Return to dashboard
      </Link>
    </div>
  );
}
