import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function ProfileSetup() {
  const [profile, setProfile] = useState({ name: "", age: "", gender: "", goal: "" });

  const handleSave = async () => {
    if (!profile.name || !profile.age || !profile.goal) {
      Alert.alert("Missing Info", "Please complete all fields");
      return;
    }
    await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
    router.replace("/(tabs)/home");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Complete Your Profile</Text>
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={profile.name}
        onChangeText={(t) => setProfile({ ...profile, name: t })}
      />
      <TextInput
        style={styles.input}
        placeholder="Age"
        keyboardType="numeric"
        value={profile.age}
        onChangeText={(t) => setProfile({ ...profile, age: t })}
      />
      <TextInput
        style={styles.input}
        placeholder="Gender"
        value={profile.gender}
        onChangeText={(t) => setProfile({ ...profile, gender: t })}
      />
      <TextInput
        style={styles.input}
        placeholder="Sleep or Wellness Goal"
        value={profile.goal}
        onChangeText={(t) => setProfile({ ...profile, goal: t })}
      />

      <TouchableOpacity style={styles.btn} onPress={handleSave}>
        <Text style={styles.btnText}>Save & Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 25 },
  header: { fontSize: 22, fontWeight: "700", color: "#000", marginBottom: 20 },
  input: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, marginBottom: 12 },
  btn: { backgroundColor: "#1976D2", borderRadius: 10, padding: 14, width: "100%", marginTop: 10 },
  btnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
