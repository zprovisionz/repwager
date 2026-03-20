import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius } from '@/lib/theme';

const CARDS = [
  'Async matches: submit within the window.',
  'AI rep counting validates your form.',
  'RepCoins are virtual in-app currency.',
  'Win streaks and ladder rank drive progression.',
];

export default function TutorialScreen() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const isLast = idx === CARDS.length - 1;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>How RepWager works</Text>
      <View style={styles.card}><Text style={styles.cardText}>{CARDS[idx]}</Text></View>
      <TouchableOpacity style={styles.button} onPress={() => (isLast ? router.replace('/(tabs)') : setIdx(idx + 1))}>
        <Text style={styles.buttonText}>{isLast ? 'Finish' : 'Next'}</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center', gap: spacing.lg },
  title: { fontFamily: typography.fontDisplay, color: colors.text, fontSize: 24 },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg, minHeight: 140, justifyContent: 'center' },
  cardText: { fontFamily: typography.fontBody, color: colors.text, fontSize: 16, lineHeight: 24 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { fontFamily: typography.fontBodyBold, color: '#00131A' },
});
