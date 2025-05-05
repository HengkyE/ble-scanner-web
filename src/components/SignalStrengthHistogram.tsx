import React from "react";

interface SignalStrengthHistogramProps {
  data: number[]; // Array of RSSI values
}

const SignalStrengthHistogram: React.FC<SignalStrengthHistogramProps> = ({ data }) => {
  // Group values by RSSI ranges (every 5 dBm)
  const rssiRanges: Record<string, number> = {};
  const step = 5;

  // Initialize ranges from -100 to -35
  for (let i = -100; i <= -35; i += step) {
    rssiRanges[i] = 0;
  }

  // Count values in each range
  data.forEach((rssi) => {
    // Round RSSI to nearest range
    const range = Math.floor(rssi / step) * step;
    const key = Math.max(-100, Math.min(-35, range));
    rssiRanges[key] = (rssiRanges[key] || 0) + 1;
  });

  // Find max count for scaling
  const maxCount = Math.max(...Object.values(rssiRanges), 1);

  // Get color based on RSSI
  const getRssiColor = (rssi: number) => {
    if (rssi > -70) return "#4ade80"; // Green for strong signal
    if (rssi > -85) return "#fbbf24"; // Yellow/orange for medium signal
    return "#ef4444"; // Red for weak signal
  };

  return (
    <div className="h-full w-full flex items-end justify-between gap-1">
      {Object.entries(rssiRanges).map(([rangeStr, count]) => {
        const range = parseInt(rangeStr);

        // Calculate height percentage (minimum 5% for visibility even with 0 count)
        const heightPercent = count === 0 ? 5 : Math.max(10, (count / maxCount) * 100);

        return (
          <div key={range} className="flex flex-col items-center flex-1">
            <div
              className="w-full rounded-t-md transition-all duration-500 ease-in-out"
              style={{
                height: `${heightPercent}%`,
                backgroundColor: getRssiColor(range),
                opacity: count > 0 ? 0.8 : 0.2,
                minHeight: "8px",
                border: count > 0 ? "1px solid rgba(255,255,255,0.4)" : "none",
              }}
            ></div>
            <div className="text-xs text-gray-500 mt-1 transform rotate-45 origin-left whitespace-nowrap">
              {range} dBm
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SignalStrengthHistogram;
