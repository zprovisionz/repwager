import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { signOut } from '@/services/auth.service';
import { getUserBadges } from '@/services/badge.service';
import { getTransactions } from '@/services/profile.service';
import { AVATAR_CLOTHING } from '@/lib/config';
import Avatar from '@/components/Avatar';
import { updateProfile } from '@/services/profile.service';
import { useFreeze, checkStreakStatus } from '@/services/streak.service';
import {
  Trophy, Zap, Flame, Star, LogOut,
  Target, Award, Snowflake
} from 'lucide-react-native';
import type { Badge, UserBadge, Transaction } from '@/types/database';

const RARITY_COLOR = { common: colors.textMuted, rare: colors.primary, epic: colors.secondary, legendary: colors.accent };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { show: showToast } = useToastStore();
  const [badges, setBadges] = useState<(UserBadge & { badge: Badge })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<'stats' | 'badges' | 'wallet' | 'avatar'>('stats');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedHead, setSelectedHead] = useState(profile?.avatar_head ?? 'head_default');
  const [selectedTorso, setSelectedTorso] = useState(profile?.avatar_torso ?? 'torso_default');
  const [selectedLegs, setSelectedLegs] = useState(profile?.avatar_legs ?? 'legs_default');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [usingFreeze, setUsingFreeze] = useState(false);

  async function load() {
    if (!session?.user) return;
    try {
      const [b, t] = await Promise.all([
        getUserBadges(session.user.id),
        getTransactions(session.user.id),
      ]);
      setBadges(b);
      setTransactions(t);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshProfile(), load()]);
    setRefreshing(false);
  }

  async function handleSaveAvatar() {
    if (!session?.user) return;
    setSavingAvatar(true);
    try {
      await updateProfile(session.user.id, {
        avatar_head: selectedHead,
        avatar_torso: selectedTorso,
        avatar_legs: selectedLegs,
      });
      await refreshProfile();
      showToast({ type: 'success', title: 'Avatar updated!' });
    } catch {
      showToast({ type: 'error', title: 'Could not save avatar' });
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch {}
  }

  async function handleUseFreeze() {
    if (!session?.user) return;
    setUsingFreeze(true);
    try {
      await useFreeze(session.user.id);
      await refreshProfile();
      showToast({ type: 'success', title: 'Streak Frozen!', message: 'Your streak is protected for 24 hours.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Could not use freeze', message: e.message });
    } finally {
      setUsingFreeze(false);
    }
  }

  const winRate = (profile?.wins ?? 0) + (profile?.losses ?? 0) > 0
    ? Math.round(((profile?.wins ?? 0) / ((profile?.wins ?? 0) + (profile?.losses ?? 0))) * 100)
    : 0;

  const streakStatus = profile
    ? checkStreakStatus({
        current_streak: profile.current_streak,
        last_active_date: profile.last_active_date,
        streak_frozen_until: (profile as any).streak_frozen_until,
      })
    : null;
  const freezeCount: number = (profile as any)?.freeze_count ?? 0;

  const gender = profile?.avatar_gender ?? 'male';
  const clothing = AVATAR_CLOTHING[gender];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <Avatar
          gender={gender}
          head={selectedHead}
          torso={selectedTorso}
          legs={selectedLegs}
          size={100}
        />
        <Text style={styles.displayName}>{profile?.display_name}</Text>
        <Text style={styles.username}>@{profile?.username}</Text>
        <View style={styles.xpRow}>
          <Star size={14} color={colors.accent} />
          <Text style={styles.xp}>{(profile?.total_xp ?? 0).toLocaleString()} XP</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(['stats', 'badges', 'wallet', 'avatar'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'stats' && (
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            {[
              { icon: <Trophy size={18} color={colors.accent} />, label: 'Wins', value: profile?.wins ?? 0 },
              { icon: <Target size={18} color={colors.error} />, label: 'Losses', value: profile?.losses ?? 0 },
              { icon: <Zap size={18} color={colors.primary} />, label: 'Total Reps', value: (profile?.total_reps ?? 0).toLocaleString() },
              { icon: <Flame size={18} color={colors.secondary} />, label: 'Win Rate', value: `${winRate}%` },
              {
                icon: (
                  <Flame
                    size={18}
                    color={streakStatus?.isFrozen ? '#4FC3F7' : colors.warning}
                  />
                ),
                label: 'Streak',
                value: profile?.current_streak ?? 0,
              },
              { icon: <Star size={18} color={colors.accent} />, label: 'Best Streak', value: profile?.longest_streak ?? 0 },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                {s.icon}
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.freezeCard, streakStatus?.isFrozen && styles.freezeCardActive]}>
            <View style={styles.freezeLeft}>
              <Snowflake size={20} color={streakStatus?.isFrozen ? '#4FC3F7' : colors.textMuted} />
              <View>
                <Text style={styles.freezeTitle}>Streak Freezes</Text>
                <Text style={styles.freezeBody}>
                  {streakStatus?.isFrozen
                    ? `Frozen until ${streakStatus.frozenUntil?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : freezeCount > 0
                    ? `${freezeCount}/3 available · Protects streak 24h`
                    : 'Earn by completing 5 casual matches'}
                </Text>
              </View>
            </View>
            {!streakStatus?.isFrozen && freezeCount > 0 && (
              <TouchableOpacity
                style={[styles.freezeBtn, usingFreeze && { opacity: 0.6 }]}
                onPress={handleUseFreeze}
                disabled={usingFreeze}
              >
                <Text style={styles.freezeBtnText}>
                  {usingFreeze ? '...' : `Use (${freezeCount})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {tab === 'badges' && (
        <View style={styles.section}>
          {badges.length === 0 ? (
            <View style={styles.empty}>
              <Award size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No badges yet. Keep competing!</Text>
            </View>
          ) : (
            <View style={styles.badgesGrid}>
              {badges.map((ub) => (
                <View key={ub.id} style={[styles.badgeCard, { borderColor: RARITY_COLOR[ub.badge.rarity] }]}>
                  <Award size={28} color={RARITY_COLOR[ub.badge.rarity]} />
                  <Text style={styles.badgeName}>{ub.badge.name}</Text>
                  <Text style={styles.badgeDesc}>{ub.badge.description}</Text>
                  <Text style={[styles.badgeRarity, { color: RARITY_COLOR[ub.badge.rarity] }]}>{ub.badge.rarity.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {tab === 'wallet' && (
        <View style={styles.section}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceBig}>{(profile as any)?.repcoins ?? 100}</Text>
            <Text style={styles.balanceSub}>RepCoins</Text>
          </View>
          <Text style={styles.rcDisclaimer}>
            RepCoins are virtual in-app currency with no cash value and cannot be exchanged for real money.
          </Text>
          <Text style={styles.sectionTitle}>TRANSACTION HISTORY</Text>
          {transactions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No transactions yet.</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.txType}>{tx.type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.txDesc}>{tx.description}</Text>
                  <Text style={styles.txTime}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.txAmount, tx.amount >= 0 ? styles.txPos : styles.txNeg]}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {tab === 'avatar' && (
        <View style={styles.section}>
          <View style={styles.avatarPreview}>
            <Avatar gender={gender} head={selectedHead} torso={selectedTorso} legs={selectedLegs} size={120} />
          </View>

          {(['head', 'torso', 'legs'] as const).map((slot) => (
            <View key={slot} style={styles.clothingSection}>
              <Text style={styles.clothingLabel}>{slot.toUpperCase()}</Text>
              <View style={styles.clothingRow}>
                {clothing[slot].map((item) => {
                  const isLocked = (profile?.total_xp ?? 0) < item.unlockXp;
                  const isSelected = (slot === 'head' ? selectedHead : slot === 'torso' ? selectedTorso : selectedLegs) === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.clothingOption, isSelected && styles.clothingSelected, isLocked && styles.clothingLocked]}
                      onPress={() => {
                        if (isLocked) { showToast({ type: 'warning', title: 'Locked', message: `Reach ${item.unlockXp} XP to unlock` }); return; }
                        if (slot === 'head') setSelectedHead(item.id);
                        if (slot === 'torso') setSelectedTorso(item.id);
                        if (slot === 'legs') setSelectedLegs(item.id);
                      }}
                    >
                      <Text style={[styles.clothingName, isSelected && styles.clothingNameSelected, isLocked && styles.clothingNameLocked]}>
                        {item.label}
                      </Text>
                      {isLocked && <Text style={styles.lockLabel}>{item.unlockXp} XP</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity style={[styles.saveBtn, savingAvatar && styles.saveBtnLoading]} onPress={handleSaveAvatar} disabled={savingAvatar}>
            <Text style={styles.saveBtnText}>{savingAvatar ? 'Saving...' : 'Save Avatar'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <LogOut size={18} color={colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  displayName: { fontFamily: typography.fontDisplay, fontSize: 22, color: colors.text, letterSpacing: 0.5, marginTop: spacing.sm },
  username: { fontFamily: typography.fontBody, fontSize: 14, color: colors.textSecondary },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  xp: { fontFamily: typography.fontBodyMedium, fontSize: 14, color: colors.accent },
  tabRow: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: spacing.sm - 2, alignItems: 'center', borderRadius: radius.md },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { fontFamily: typography.fontBodyMedium, fontSize: 12, color: colors.textSecondary },
  tabBtnTextActive: { color: colors.textInverse },
  section: { paddingHorizontal: spacing.md },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '30%',
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontFamily: typography.fontDisplay, fontSize: 20, color: colors.text },
  statLabel: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { fontFamily: typography.fontBody, fontSize: 15, color: colors.textMuted },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeCard: {
    width: '46%',
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
  },
  badgeName: { fontFamily: typography.fontBodyBold, fontSize: 13, color: colors.text, textAlign: 'center' },
  badgeDesc: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  badgeRarity: { fontFamily: typography.fontBodyMedium, fontSize: 10, letterSpacing: 1 },
  balanceCard: {
    backgroundColor: 'rgba(255,184,0,0.08)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  balanceBig: { fontFamily: typography.fontDisplay, fontSize: 40, color: colors.accent },
  balanceSub: { fontFamily: typography.fontBody, fontSize: 13, color: colors.textMuted },
  sectionTitle: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  rcDisclaimer: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  txLeft: { flex: 1, gap: 2 },
  txType: { fontFamily: typography.fontBodyMedium, fontSize: 13, color: colors.text, textTransform: 'capitalize' },
  txDesc: { fontFamily: typography.fontBody, fontSize: 12, color: colors.textSecondary },
  txTime: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textMuted },
  txAmount: { fontFamily: typography.fontDisplayMedium, fontSize: 16 },
  txPos: { color: colors.success },
  txNeg: { color: colors.error },
  avatarPreview: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clothingSection: { marginBottom: spacing.md },
  clothingLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  clothingRow: { flexDirection: 'row', gap: spacing.sm },
  clothingOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 3,
  },
  clothingSelected: { borderColor: colors.primary, backgroundColor: 'rgba(0,212,255,0.08)' },
  clothingLocked: { opacity: 0.45 },
  clothingName: { fontFamily: typography.fontBodyMedium, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  clothingNameSelected: { color: colors.primary },
  clothingNameLocked: { color: colors.textMuted },
  lockLabel: { fontFamily: typography.fontBody, fontSize: 10, color: colors.textMuted },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  saveBtnLoading: { opacity: 0.6 },
  saveBtnText: { fontFamily: typography.fontBodyBold, fontSize: 15, color: colors.textInverse },
  freezeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  freezeCardActive: {
    borderColor: '#4FC3F7',
    backgroundColor: 'rgba(79,195,247,0.06)',
  },
  freezeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  freezeTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.text,
  },
  freezeBody: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  freezeBtn: {
    backgroundColor: 'rgba(79,195,247,0.15)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#4FC3F7',
  },
  freezeBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: '#4FC3F7',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    margin: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.error + '44',
    backgroundColor: 'rgba(255,59,48,0.06)',
  },
  signOutText: { fontFamily: typography.fontBodyBold, fontSize: 15, color: colors.error },
});
