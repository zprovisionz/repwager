import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { purchaseStreakFreeze, purchaseCosmetic } from '@/services/shop.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { Snowflake, Zap, ShoppingBag } from 'lucide-react-native';

const SHOP_ITEMS = [
  {
    id: 'freeze_pack_1',
    name: 'Streak Freeze',
    description: 'Protects your streak for 24h when you miss a day.',
    cost: 50,
    icon: <Snowflake size={28} color="#4FC3F7" />,
    type: 'streak_freeze' as const,
  },
  {
    id: 'cosmetic_neon_1',
    name: 'Neon Accent Pack',
    description: 'Exclusive neon cyan glow on your avatar silhouette.',
    cost: 75,
    icon: <Zap size={28} color={colors.primary} />,
    type: 'cosmetic' as const,
  },
  {
    id: 'cosmetic_hot_pink',
    name: 'Hot Pink Skin',
    description: 'Hot pink silhouette in Theatre matches. RC exclusive.',
    cost: 100,
    icon: <Zap size={28} color={colors.secondary} />,
    type: 'cosmetic' as const,
  },
];

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { show: showToast } = useToastStore();
  const [buying, setBuying] = useState<string | null>(null);

  const repcoins: number = (profile as any)?.repcoins ?? 100;

  async function handleBuy(item: (typeof SHOP_ITEMS)[0]) {
    if (!session?.user?.id) return;
    if (repcoins < item.cost) {
      showToast({ type: 'error', title: 'Insufficient RepCoins', message: `Need ${item.cost} RC` });
      return;
    }
    setBuying(item.id);
    try {
      if (item.type === 'streak_freeze') {
        await purchaseStreakFreeze(session.user.id);
      } else {
        await purchaseCosmetic(session.user.id, item.id);
      }
      await refreshProfile();
      showToast({ type: 'success', title: 'Purchased!', message: `${item.name} added to your account.` });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Purchase failed', message: e.message });
    } finally {
      setBuying(null);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: insets.top + spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <ShoppingBag size={22} color={colors.accent} />
        <Text style={styles.title}>RepCoins Shop</Text>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Your balance:</Text>
        <Text style={styles.balanceValue}>{repcoins} RC</Text>
      </View>

      {SHOP_ITEMS.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardIcon}>{item.icon}</View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </View>
          <TouchableOpacity
            style={[styles.buyBtn, repcoins < item.cost && styles.buyBtnDisabled]}
            onPress={() => handleBuy(item)}
            disabled={!!buying || repcoins < item.cost}
          >
            <Text style={styles.buyBtnText}>
              {buying === item.id ? '...' : `${item.cost} RC`}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.disclaimer}>
        RepCoins are virtual in-app currency with no cash value and cannot be exchanged for real money.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: typography.fontDisplay, fontSize: 22, color: colors.text },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  balanceLabel: { fontFamily: typography.fontBody, fontSize: 14, color: colors.textSecondary },
  balanceValue: { fontFamily: typography.fontDisplayMedium, fontSize: 16, color: colors.accent },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text },
  cardDesc: { fontFamily: typography.fontBody, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  buyBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  buyBtnDisabled: { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border },
  buyBtnText: { fontFamily: typography.fontDisplayMedium, fontSize: 13, color: '#00131A' },
  disclaimer: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
