import "./globals.css";

export default function RootLayoutBackup({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>{children}</body>
    </html>
  );
}
