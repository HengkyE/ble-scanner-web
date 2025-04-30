"use client";

import { ConfigProvider, theme } from "antd";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <NextThemesProvider attribute="class" defaultTheme="light">
      {mounted && (
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: "#0c66a4", // matches the primary color in CSS
              borderRadius: 8,
            },
            algorithm: theme.defaultAlgorithm,
          }}
        >
          {children}
        </ConfigProvider>
      )}
    </NextThemesProvider>
  );
}
