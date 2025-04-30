import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Metadata } from "next";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
      <body className={`${inter.className} antialiased bg-background min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
