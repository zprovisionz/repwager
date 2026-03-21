import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { BarlowText } from './BarlowText';

export type EloRelation = 'higher' | 'lower' | 'even';

function relationFromElos(myElo: number, theirElo: number): EloRelation {
  const d = myElo - theirElo;
  if (d > 0) return 'higher';
  if (d < 0) return 'lower';
  return 'even';
}

export type ELODiffBadgeProps = {
  myElo: number;
  theirElo: number;
};

const CONFIG: Record<
  EloRelation,
  { label: string; fg: string; bg: string; border: string }
> = {
  higher: {
    label: 'ELO vs them: higher',
    fg: colors.success,
    bg: colors.success + '18',
    border: colors.success + '55',
  },
  lower: {
    label: 'ELO vs them: lower',
    fg: colors.secondary,
    bg: colors.secondary + '14',
    border: colors.secondary + '44',
  },
  even: {
    label: 'ELO even',
    fg: colors.textSecondary,
    bg: colors.bgElevated,
    border: colors.border,
  },
};

export function ELODiffBadge({ myElo, theirElo }: ELODiffBadgeProps) {
  const rel = relationFromElos(myElo, theirElo);
  const c = CONFIG[rel];

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <BarlowText variant="label" style={[styles.text, { color: c.fg }]}>
        {c.label}
      </BarlowText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 9,
    letterSpacing: 0.8,
  },
});
