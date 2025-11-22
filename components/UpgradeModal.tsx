import React from "react";
import {
    Linking,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ visible, onClose }: Props) {
  const handleUpgrade = () => {
    // Future Stripe/Apple Pay integration — for now just placeholder
    Linking.openURL("https://ashwinwellness.com/upgrade");
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.header}>🌟 Unlock Full Wellness Access</Text>
          <Text style={styles.text}>
            Continue your journey with full access to Live Index, Ashwin AI
            insights, and detailed reflection tracking.
          </Text>

          <View style={styles.planBox}>
            <Text style={styles.planTitle}>Monthly Plan</Text>
            <Text style={styles.price}>$9.99 / month</Text>
          </View>

          <View style={styles.planBox}>
            <Text style={styles.planTitle}>Yearly Plan</Text>
            <Text style={styles.price}>$100 / year</Text>
            <Text style={styles.savings}>Save 17%</Text>
          </View>

          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
            <Text style={styles.upgradeText}>Upgrade Now</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Maybe Later</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>© 2025 Ashwin Wellness</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "85%",
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0D47A1",
    marginBottom: 10,
    textAlign: "center",
  },
  text: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  planBox: {
    backgroundColor: "#E3F2FD",
    width: "100%",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  planTitle: { fontWeight: "600", color: "#0D47A1" },
  price: { fontSize: 16, fontWeight: "700", color: "#0D47A1" },
  savings: { color: "#2E7D32", fontSize: 12, marginTop: 3 },
  upgradeBtn: {
    backgroundColor: "#1877F2",
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 20,
  },
  upgradeText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
  cancel: {
    color: "#555",
    fontSize: 13,
    marginTop: 15,
    textDecorationLine: "underline",
  },
  footer: {
    fontSize: 11,
    color: "#777",
    marginTop: 25,
    textAlign: "center",
  },
});
