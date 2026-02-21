import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useEffect, useRef } from 'react';
import { useToastStore, type Toast } from '@/stores/toastStore';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, XCircle, AlertTriangle, Info, Award, X } from 'lucide-react-native';

function ToastItem({ toast }: { toast: Toast }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const { dismiss } = useToastStore();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
    ]).start();
  }, []);

  const icons = {
    success: <CheckCircle size={20} color={colors.success} />,
    error: <XCircle size={20} color={colors.error} />,
    warning: <AlertTriangle size={20} color={colors.warning} />,
    info: <Info size={20} color={colors.primary} />,
    badge: <Award size={20} color={colors.accent} />,
  };

  const borderColors = {
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.primary,
    badge: colors.accent,
  };

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }], borderLeftColor: borderColors[toast.type] }]}>
      <View style={styles.iconWrap}>{icons[toast.type]}</View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{toast.title}</Text>
        {toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => dismiss(toast.id)} hitSlop={8}>
        <X size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ToastContainer() {
  const { toasts } = useToastStore();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  iconWrap: { width: 24, alignItems: 'center' },
  textWrap: { flex: 1 },
  title: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  message: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
