import { Spinner } from "@heroui/react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Loading() {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Spinner size="lg" color="primary" />
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Loading Crowd Analysis</h3>
          <p className="text-gray-600">Fetching BLE device data and processing crowd metrics...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
