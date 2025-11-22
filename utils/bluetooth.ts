import { BleManager } from "react-native-ble-plx";

const manager = new BleManager();

export async function connectToAshwinDevice(onData: (data: any) => void) {
  console.log("🔍 Scanning for AshwinSensor...");
  manager.startDeviceScan(null, null, async (error, device) => {
    if (error) {
      console.error("Scan error:", error);
      return;
    }
    if (device?.name === "AshwinSensor") {
      manager.stopDeviceScan();
      console.log("✅ Found:", device.name);

      try {
        const connected = await device.connect();
        await connected.discoverAllServicesAndCharacteristics();
        const services = await connected.services();

        for (const service of services) {
          const chars = await service.characteristics();
          for (const c of chars) {
            if (c.isNotifiable) {
              c.monitor((err, characteristic) => {
                if (err) return console.error("Monitor error:", err);
                const value = characteristic?.value;
                if (!value) return;
                try {
                  const decoded = Buffer.from(value, "base64").toString("utf8");
                  const parsed = JSON.parse(decoded);
                  onData(parsed);
                } catch (e) {
                  console.warn("Decode fail:", e);
                }
              });
            }
          }
        }
      } catch (err) {
        console.error("❌ BLE connection failed:", err);
      }
    }
  });
}
