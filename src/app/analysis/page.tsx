"use client";

import Link from "next/link";

export default function AnalysisPage() {
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">BLE Signal Analysis</h1>
          <nav className="mt-4">
            <ul className="flex space-x-4">
              <li>
                <Link href="/" className="text-blue-600 hover:underline">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/devices" className="text-blue-600 hover:underline">
                  Devices
                </Link>
              </li>
              <li>
                <Link href="/maps" className="text-blue-600 hover:underline">
                  Maps
                </Link>
              </li>
            </ul>
          </nav>
        </header>

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-blue-700 font-medium">Maintenance Mode</p>
            <p className="text-blue-600">
              The Analysis page is currently under maintenance. We're working to restore full
              functionality soon.
            </p>
          </div>

          <h2 className="text-xl font-bold mb-4">Available Analysis Features</h2>
          <p className="mb-6">
            The analysis features for signal strength and distance correlation have been temporarily
            simplified. We're working to restore the full functionality with charts and detailed
            analysis.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/analysis-simple"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              View Simplified Analysis
            </Link>
            <Link
              href="/analysis-basic"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              View Basic Analysis
            </Link>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">About BLE Analysis</h2>
          <p className="mb-3">
            This page normally provides tools to analyze Bluetooth Low Energy (BLE) signal strength
            data in relation to distance and other factors.
          </p>
          <p>
            When fully functional, you can use this page to analyze signal propagation patterns,
            calculate correlation between distance and signal strength, and visualize data through
            interactive charts.
          </p>
        </div>
      </div>
    </div>
  );
}
