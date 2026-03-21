import {
  View,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { colors, radius, spacing } from '@/lib/theme';

export type ChallengeCardPlacement = 'top' | 'left';

export type ChallengeCardProps = {
  /** Accent line color (cyan = casual, amber = wager, etc.) */
  accentColor: string;
  /** `top` = 2px top bar (spec); `left` = 3px left rail (legacy) */
  placement?: ChallengeCardPlacement;
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  urgent?: boolean;
};

/**
 * Feed card with colored accent — top rail (default, per design spec) or left rail.
 */
export function ChallengeCard({
  accentColor,
  placement = 'top',
  children,
  onPress,
  style,
  urgent,
}: ChallengeCardProps) {
  const accentStyle =
    placement === 'top'
      ? {
          borderTopWidth: 2,
          borderTopColor: accentColor,
          borderLeftWidth: 1,
          borderLeftColor: colors.border,
        }
      : {
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
        };

  const body = (
    <View
      style={[
        styles.card,
        accentStyle,
        urgent && styles.cardUrgent,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {body}
      </TouchableOpacity>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardUrgent: {
    backgroundColor: colors.secondary + '0A',
  },
});
