import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { colors, spacing } from '@/lib/theme';
import { BarlowText } from './BarlowText';

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export type CountdownTimerProps = {
  deadlineIso: string | null | undefined;
  urgentBelowSeconds?: number;
  visible?: boolean;
};

export function CountdownTimer({
  deadlineIso,
  urgentBelowSeconds = 1800,
  visible = true,
}: CountdownTimerProps) {
  const [text, setText] = useState<string | null>(() => {
    if (!deadlineIso) return null;
    const sec = Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000);
    return formatTimeRemaining(sec);
  });

  useEffect(() => {
    if (!deadlineIso || !visible) return;
    const tick = () => {
      const sec = Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000);
      setText(formatTimeRemaining(sec));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineIso, visible]);

  if (!visible || !deadlineIso || text === null) return null;

  const secLeft = Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000);
  const urgent = secLeft < urgentBelowSeconds && secLeft > 0;

  const suffix = text === 'Expired' ? '' : ' remaining';

  return (
    <View style={styles.row}>
      <Clock size={11} color={urgent ? colors.secondary : colors.textMuted} />
      <BarlowText
        variant="body"
        style={[styles.timerText, urgent && { color: colors.secondary }]}
      >
        {text}
        {suffix}
      </BarlowText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
