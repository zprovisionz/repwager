import { View, StyleSheet } from 'react-native';
import type { MatchMode } from '@/types/database';
import { colors, radius, spacing } from '@/lib/theme';
import { BarlowText } from './BarlowText';

export type MatchTypeBadgeProps = {
  mode: MatchMode;
};

/**
 * CASUAL / WAGER pill from `match_mode` (falls back to wager_amount === 0 → casual if needed at call site).
 */
export function MatchTypeBadge({ mode }: MatchTypeBadgeProps) {
  const isWager = mode === 'wager';
  const bg = isWager ? colors.accent + '22' : colors.primary + '18';
  const border = isWager ? colors.accent : colors.primary;
  const fg = isWager ? colors.accent : colors.primary;

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <BarlowText variant="label" style={[styles.text, { color: fg }]}>
        {isWager ? 'WAGER' : 'CASUAL'}
      </BarlowText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  text: {
    fontSize: 10,
    letterSpacing: 1,
  },
});
