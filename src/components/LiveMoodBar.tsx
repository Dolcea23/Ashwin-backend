cat > src/components/LiveMoodBar.tsx <<'EOF'
import React, { useEffect, useState } from "react";
import { Animated, Text } from "react-native";
import { calculateAshwinIndex } from "../api/AshwinIndex";
import { generateSensorData } from "../sensors/sensorMap";

export default function LiveMoodBar() {
  const [mood, setMood] = useState(0);
  const colorAnim = new Animated.Value(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const data = generateSensorData();
      const score = calculateAshwinIndex(data);
      setMood(score);

      Animated.timing(colorAnim, {
        toValue: score,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const bgColor = colorAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["#6b7280", "#22c55e"], // gray → green
  });

  return (
    <Animated.View
      style={{
        backgroundColor: bgColor,
        borderRadius: 20,
        padding: 16,
        alignItems: "center",
        marginTop: 40,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}>
        Brain Activity: {mood.toFixed(2)}
      </Text>
    </Animated.View>
  );
}
EOF
