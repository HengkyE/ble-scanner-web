"use client";

import { useEffect } from "react";
import { Button } from "@heroui/react";
import { Alert } from "antd";
import DashboardLayout from "@/components/DashboardLayout";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Crowd Analysis Error:", error);
  }, [error]);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto mt-8">
        <Alert
          message="Error Loading Crowd Analysis"
          description={
            <div className="space-y-4">
              <p>There was an error loading the crowd analysis data. This could be due to:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Database connection issues</li>
                <li>Invalid data format</li>
                <li>Network connectivity problems</li>
                <li>Insufficient permissions</li>
              </ul>
              <div className="mt-4">
                <Button color="primary" onClick={reset}>
                  Try Again
                </Button>
              </div>
            </div>
          }
          type="error"
          showIcon
        />
      </div>
    </DashboardLayout>
  );
}
