import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Colors } from '@/constants/theme';

/** Primary CTA semantic: casual=cyan, wager=amber, league=purple (per DESIGN_SPEC) */
export type ButtonTone = 'casual' | 'wager' | 'league';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  /** Only affects primary/outline label + border accents */
  tone?: ButtonTone;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

function toneFg(tone: ButtonTone): string {
  switch (tone) {
    case 'wager':
      return Colors.accent.amber;
    case 'league':
      return Colors.accent.purple;
    default:
      return colors.primary;
  }
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'casual',
  size = 'md',
  loading,
  disabled,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const c = toneFg(tone);
  const primaryBg = tone === 'casual' ? colors.primary : tone === 'wager' ? colors.accent : Colors.accent.purple;
  const spinnerColor =
    variant === 'outline' || variant === 'ghost' ? c : colors.textInverse;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        variant === 'primary' && { backgroundColor: primaryBg },
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && [styles.outline, { borderColor: c }],
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        styles[`size_${size}`],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.label_primary,
            variant === 'secondary' && styles.label_secondary,
            variant === 'outline' && [styles.label_outline, { color: c }],
            variant === 'ghost' && styles.label_ghost,
            variant === 'danger' && styles.label_danger,
            styles[`labelSize_${size}`],
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
  },
  disabled: {
    opacity: 0.45,
  },
  size_sm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: 36 },
  size_md: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, minHeight: 48 },
  size_lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minHeight: 56 },
  label: {
    fontFamily: typography.fontButton,
    textTransform: 'uppercase',
  },
  label_primary: { color: colors.textInverse },
  label_secondary: { color: colors.text },
  label_outline: { color: colors.primary },
  label_ghost: { color: colors.textSecondary },
  label_danger: { color: colors.text },
  /** ~0.1em letter-spacing at given font size */
  labelSize_sm: { fontSize: 13, letterSpacing: 1.3 },
  labelSize_md: { fontSize: 15, letterSpacing: 1.5 },
  labelSize_lg: { fontSize: 17, letterSpacing: 1.7 },
} as any);
