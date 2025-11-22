// utils/healthAlertEngine.ts

export type HealthStatus = {
  alert?: string;
  level: "normal" | "warning" | "critical";
};

export function evaluateHealth(
  heartRate: number,
  temperature: number,
  calmness?: number
): HealthStatus {
  // Default
  let status: HealthStatus = { level: "normal" };

  // Heart-rate checks
  if (heartRate < 45)
    status = { alert: "Heart rate too low", level: "critical" };
  else if (heartRate > 110)
    status = { alert: "Heart rate too high", level: "critical" };
  else if (heartRate > 95)
    status = { alert: "Elevated heart rate", level: "warning" };

  // Temperature checks
  if (temperature > 100.5)
    status = { alert: "Possible fever detected", level: "critical" };

  // Calmness / EEG pattern (simulated)
  if (calmness && calmness < 0.4 && status.level === "normal")
    status = { alert: "Stress pattern detected", level: "warning" };

  return status;
}
