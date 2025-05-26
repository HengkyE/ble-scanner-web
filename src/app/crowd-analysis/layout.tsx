import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crowd Analysis - BLE Scanner",
  description: "Analyze BLE device density, movement patterns, and crowd dynamics over time",
};

export default function CrowdAnalysisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
