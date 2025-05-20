import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BLE Scanner Analytics",
  description: "Analytics platform for BLE Scanner Water Level Monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily: inter.style.fontFamily,
          backgroundColor: "#f5f5f5",
        }}
      >
        <Providers>
          <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
