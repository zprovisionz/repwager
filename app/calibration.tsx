import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, typography } from '@/lib/theme';

const STEPS = [
  'Hold top push-up position',
  'Do 3 clean reps at your normal depth',
  'Tap complete to save your calibration',
];

export default function CalibrationScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleComplete() {
    setSaving(true);
    await AsyncStorage.setItem('repwager:calibration_offset', '0');
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calibration</Text>
      <Text style={styles.subtitle}>This helps rep validation match your body mechanics.</Text>
      <View style={styles.card}>
        {STEPS.map((step, index) => (
          <Text key={step} style={styles.step}>{`${index + 1}. ${step}`}</Text>
        ))}
      </View>
      <TouchableOpacity style={styles.button} onPress={handleComplete} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Calibration Complete'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center', gap: spacing.lg },
  title: { fontFamily: typography.fontDisplay, fontSize: 24, color: colors.text },
  subtitle: { fontFamily: typography.fontBody, fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderColor: colors.border, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  step: { fontFamily: typography.fontBodyMedium, fontSize: 14, color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { fontFamily: typography.fontBodyBold, fontSize: 14, color: '#00131A' },
});
