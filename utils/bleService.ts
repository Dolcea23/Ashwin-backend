import { Buffer } from "buffer";
import { EventEmitter } from "expo-modules-core";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, Characteristic, Device } from "react-native-ble-plx";

export const bleManager = new BleManager();
export const AshwinEmitter = new EventEmitter();

// 🧩 Replace these with your real UUIDs from ESP32 sketch
export const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
export const CHARACTERISTIC_UUID = "abcdef01-1234-5678-1234-56789abcdef0";

/** 🔐 Request Bluetooth permissions (handles both Android + iOS) */
export async function requestBluetoothPermissions() {
  if (Platform.OS === "android") {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    console.log("📱 Android BLE Permissions:", granted);
  } else if (Platform.OS === "ios") {
    console.log("📱 iOS BLE permissions handled automatically");
  }
}

/** 🧭 Manual BLE scanner for debugging nearby devices */
export async function debugScanBLE() {
  await requestBluetoothPermissions();
  console.log("🔍 Starting BLE scan (debug mode)…");

  bleManager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      console.error("❌ BLE Scan Error:", error);
      return;
    }
    if (device && device.name) {
      console.log(`📡 Found device: ${device.name} (${device.id})`);
    }
  });

  // Stop scan after 10 seconds
  setTimeout(() => {
    bleManager.stopDeviceScan();
    console.log("🛑 Scan finished.");
  }, 10000);
}

/** 🔗 Connect and begin streaming Ashwin BLE data */
export async function connectToDevice(onData: (data: any) => void) {
  await requestBluetoothPermissions();
  console.log("🔍 Scanning for Ashwin devices…");

  return new Promise<void>((resolve, reject) => {
    bleManager.startDeviceScan(null, null, async (error, device: Device | null) => {
      if (error) {
        console.error("❌ Scan error:", error);
        reject(error);
        return;
      }

      // ✅ Accept any of these names (edit if your ESP32 advertises differently)
      if (
  device?.name?.includes("AshwinSensor") || // your real ESP32 name
  device?.name?.includes("Ashwin") ||
  device?.name?.includes("E3K") ||
  device?.name?.includes("ESP32") ||
  device?.name?.includes("Health")
)
 {
        console.log(`✅ Found device: ${device.name}`);
        bleManager.stopDeviceScan();

        try {
          const connected = await device.connect();
          console.log("🔗 Connected → discovering services…");
          await connected.discoverAllServicesAndCharacteristics();

          connected.monitorCharacteristicForService(
            SERVICE_UUID,
            CHARACTERISTIC_UUID,
            (error, characteristic: Characteristic | null) => {
              if (error) {
                console.error("❌ Monitor error:", error);
                return;
              }

              if (characteristic?.value) {
                try {
                  const decoded = Buffer.from(characteristic.value, "base64").toString("utf8");
                  const data = JSON.parse(decoded);

                  // ✅ Emit data to any listening components
                  onData(data);
                  AshwinEmitter.emit("newData", data);

                  console.log("📡 Live BLE data:", data);
                } catch {
                  console.log("⚠️ Non-JSON BLE data received (raw payload).");
                }
              }
            }
          );

          console.log("📶 Monitoring Ashwin data stream…");
          resolve();
        } catch (e) {
          console.error("❌ Connection failed:", e);
          reject(e);
        }
      }
    });

    // ⏰ Stop scan after 15 seconds if nothing found
    setTimeout(() => {
      bleManager.stopDeviceScan();
      reject(new Error("⏰ Timeout: No Ashwin device found"));
    }, 15000);
  });
}

/** 🔌 Disconnect from any connected devices */
export async function disconnectDevice() {
  try {
    const connected = await bleManager.connectedDevices([SERVICE_UUID]);
    for (const d of connected) {
      await d.cancelConnection();
    }
    console.log("🔌 Disconnected successfully.");
  } catch (err) {
    console.error("⚠️ Disconnect error:", err);
  }
}
