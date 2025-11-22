import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>☕ Welcome to Café Bohios</Text>
      <Text style={styles.subtitle}>Your culture. Your coffee. Your moment.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f0e1' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#4b2e05' },
  subtitle: { fontSize: 16, marginTop: 8, color: '#6b4e16' },
});

