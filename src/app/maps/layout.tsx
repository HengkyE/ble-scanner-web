import DashboardLayout from "@/components/DashboardLayout";

export default function MapsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Inject Leaflet CSS to ensure it's available */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      {children}
    </>
  );
}
