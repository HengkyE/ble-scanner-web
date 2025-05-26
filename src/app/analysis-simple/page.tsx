"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function SimpleAnalysisPage() {
  const [count, setCount] = useState(0);

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Simple Analysis Page</h1>
        <p className="mb-4">This is a simplified version of the analysis page for testing.</p>

        <div className="p-4 border rounded-md bg-white shadow-sm mb-6">
          <p className="mb-2">Counter: {count}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setCount(count + 1)}
          >
            Click me
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="p-4 border rounded-md bg-white shadow-sm">
              <h2 className="text-lg font-bold mb-2">Card {item}</h2>
              <p>Some sample content for testing.</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
