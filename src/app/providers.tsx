"use client";

import { ConfigProvider, theme } from "antd";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a simple placeholder while client-side rendering is loading
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0c66a4",
          borderRadius: 8,
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      {children}
    </ConfigProvider>
  );
}
