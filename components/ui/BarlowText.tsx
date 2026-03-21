import { Text, type TextProps } from 'react-native';
import { barlowVariantStyles, type BarlowTextVariant } from '@/constants/typography';
import { colors } from '@/lib/theme';

export type BarlowTextProps = TextProps & {
  variant?: BarlowTextVariant;
  color?: string;
};

/**
 * Typography primitive — Barlow Condensed for display/label, Barlow for body.
 */
export function BarlowText({
  variant = 'body',
  color,
  style,
  ...rest
}: BarlowTextProps) {
  return (
    <Text
      style={[barlowVariantStyles[variant], { color: color ?? colors.text }, style]}
      {...rest}
    />
  );
}
