import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const isRegistered = await AsyncStorage.getItem("isRegistered");
        const isLoggedOut = await AsyncStorage.getItem("isLoggedOut");
        const onboardingComplete = await AsyncStorage.getItem("onboardingComplete");

        console.log("🚀 App start:", { isLoggedOut, isRegistered, onboardingComplete });

        // ✅ FIX: delay to allow Reanimated to mount properly
        setTimeout(() => {
          if (!isRegistered) {
            router.replace("/(onboarding)/welcome");
          } else if (isLoggedOut === "true") {
            router.replace("/(auth)/signin");
          } else if (!onboardingComplete || onboardingComplete === "false") {
            router.replace("/(onboarding)/questionnaire");
          } else {
            router.replace("/(tabs)/home");
          }
        }, 10); // 10ms prevents the animation crash
      } catch (error) {
        console.error("Startup redirect error:", error);
        router.replace("/(auth)/signin");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0D47A1" />
      </View>
    );
  }

  return null;
}
