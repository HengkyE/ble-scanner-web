import supabase, { safeSupabaseOperation } from "./supabase";

interface RssiReading {
  device_id: string;
  session_id: string;
  rssi: number;
  timestamp: string;
  sequence_number: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

interface ScannedDevice {
  device_id: string;
  rssi: number;
  device_latitude: number | null;
  device_longitude: number | null;
  device_accuracy: number | null;
}

let collectionInterval: NodeJS.Timeout | null = null;
let sequenceNumber = 0;

export const startRssiCollection = async (sessionId: string) => {
  if (collectionInterval) {
    console.log("RSSI collection already running");
    return;
  }

  console.log("Starting RSSI collection for session:", sessionId);

  // Function to collect RSSI readings
  const collectRssi = async () => {
    try {
      // Get all devices from the current session
      const { data: devices, error: deviceError } = await safeSupabaseOperation(() =>
        supabase
          .from("scanned_device")
          .select("device_id, rssi, device_latitude, device_longitude, device_accuracy")
          .eq("session_id", sessionId)
      );

      if (deviceError) {
        console.error("Error fetching devices for RSSI collection:", deviceError);
        return;
      }

      if (!devices || devices.length === 0) {
        console.log("No devices found in session:", sessionId);
        return;
      }

      // Prepare RSSI readings for all devices
      const readings: RssiReading[] = devices.map((device: ScannedDevice) => ({
        device_id: device.device_id,
        session_id: sessionId,
        rssi: device.rssi,
        timestamp: new Date().toISOString(),
        sequence_number: ++sequenceNumber,
        latitude: device.device_latitude || undefined,
        longitude: device.device_longitude || undefined,
        accuracy: device.device_accuracy || undefined,
      }));

      // Insert readings into rssi_timeseries table
      const { error: insertError } = await safeSupabaseOperation(() =>
        supabase.from("rssi_timeseries").insert(readings)
      );

      if (insertError) {
        console.error("Error inserting RSSI readings:", insertError);
        return;
      }

      console.log(`Recorded ${readings.length} RSSI readings`);
    } catch (error) {
      console.error("Error in RSSI collection:", error);
    }
  };

  // Start collecting RSSI readings every 500ms
  collectionInterval = setInterval(collectRssi, 500);
};

export const stopRssiCollection = () => {
  if (collectionInterval) {
    clearInterval(collectionInterval);
    collectionInterval = null;
    console.log("Stopped RSSI collection");
  }
};
