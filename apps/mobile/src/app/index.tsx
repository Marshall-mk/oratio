import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Veritas</Text>
      <Text style={styles.subtitle}>Your communication gym.</Text>
      <Text style={styles.meta}>M0 scaffold — auth & onboarding land in M1.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 40, fontWeight: '700' },
  subtitle: { fontSize: 18, opacity: 0.7 },
  meta: { fontSize: 13, opacity: 0.4, marginTop: 16 },
});
