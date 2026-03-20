import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius } from '@/lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  glowColor?: string;
}

export default function Card({ children, style, elevated, glowColor }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        glowColor ? { borderColor: glowColor, shadowColor: glowColor, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.bgElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
