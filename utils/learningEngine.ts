import { getRecentData } from "./sensorData";

export function calculateTrends() {
  const points = getRecentData(100);
  if (points.length < 10) return { trend: "N/A", direction: 0 };
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const diff = last - first;
  return {
    trend: diff > 0 ? "Rising" : diff < 0 ? "Falling" : "Stable",
    direction: diff
  };
}
