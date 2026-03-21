import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { colors, spacing, radius } from '@/lib/theme';
import { BarlowText } from './BarlowText';

export type StatStripItem = {
  label: string;
  value: string | number;
  adornment?: ReactNode;
  /** Per-cell semantic color (e.g. RC amber, ELO cyan, streak fire) */
  valueColor?: string;
};

export type StatStripProps = {
  items: StatStripItem[];
};

export function StatStrip({ items }: StatStripProps) {
  const four = items.slice(0, 4);

  return (
    <View style={styles.row}>
      {four.map((item, i) => (
        <View key={`${item.label}-${i}`} style={styles.cell}>
          {item.adornment}
          <BarlowText
            variant="displayMedium"
            style={[styles.value, item.valueColor ? { color: item.valueColor } : null]}
            numberOfLines={1}
          >
            {item.value}
          </BarlowText>
          <BarlowText variant="body" style={styles.label} numberOfLines={1}>
            {item.label}
          </BarlowText>
          {i < 3 ? <View style={styles.divider} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    position: 'relative',
    paddingHorizontal: 2,
  },
  value: {
    fontSize: 14,
    color: colors.text,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
  },
  divider: {
    position: 'absolute',
    right: 0,
    top: '15%',
    bottom: '15%',
    width: 1,
    backgroundColor: colors.border,
  },
});
