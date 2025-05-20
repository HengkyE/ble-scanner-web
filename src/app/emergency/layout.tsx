export default function EmergencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#f9fafb",
        }}
      >
        {children}
      </body>
    </html>
  );
}
