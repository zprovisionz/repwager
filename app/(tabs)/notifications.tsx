import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { getNotifications, markAsRead, markAllAsRead } from '@/services/notification.service';
import type { Notification } from '@/types/database';
import { Bell, Swords, Trophy, Award, AlertTriangle, CheckCheck } from 'lucide-react-native';

const NOTIF_ICON: Record<string, React.ReactNode> = {
  match_challenge: <Swords size={18} color={'#00D4FF'} />,
  match_accepted: <Swords size={18} color={'#00FF88'} />,
  match_completed: <Trophy size={18} color={'#FFB800'} />,
  badge_earned: <Award size={18} color={'#FFB800'} />,
  dispute_filed: <AlertTriangle size={18} color={'#FF8C00'} />,
  dispute_resolved: <AlertTriangle size={18} color={'#00FF88'} />,
};

function NotifItem({ notif, onPress }: { notif: Notification; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.notifRow, !notif.read && styles.notifUnread]}>
        <View style={styles.iconWrap}>{NOTIF_ICON[notif.type] ?? <Bell size={18} color={colors.textMuted} />}</View>
        <View style={styles.notifText}>
          <Text style={styles.notifTitle}>{notif.title}</Text>
          <Text style={styles.notifBody}>{notif.body}</Text>
          <Text style={styles.notifTime}>{new Date(notif.created_at).toLocaleString()}</Text>
        </View>
        {!notif.read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!session?.user) return;
    try {
      const data = await getNotifications(session.user.id);
      setNotifications(data);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  async function handleMarkAll() {
    if (!session?.user) return;
    await markAllAsRead(session.user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleNotifPress(notif: Notification) {
    if (!notif.read) {
      await markAsRead(notif.id);
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    }
    const data = notif.data as any;
    if (data?.match_id) {
      router.push({ pathname: '/theatre/[id]', params: { id: data.match_id } });
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Bell size={20} color={colors.text} />
          <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll} style={styles.markAllBtn}>
            <CheckCheck size={16} color={colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotifItem notif={item} onPress={() => handleNotifPress(item)} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontFamily: typography.fontDisplay, fontSize: 16, color: colors.text, letterSpacing: 3 },
  badge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontFamily: typography.fontBodyBold, fontSize: 11, color: colors.text },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  markAllText: { fontFamily: typography.fontBodyMedium, fontSize: 13, color: colors.primary },
  list: { paddingVertical: spacing.xs, paddingBottom: 80 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  notifUnread: { backgroundColor: 'rgba(0,212,255,0.04)' },
  iconWrap: { marginTop: 2, width: 24, alignItems: 'center' },
  notifText: { flex: 1, gap: 3 },
  notifTitle: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text },
  notifBody: { fontFamily: typography.fontBody, fontSize: 13, color: colors.textSecondary },
  notifTime: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textMuted, marginTop: 3 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyText: { fontFamily: typography.fontBody, fontSize: 15, color: colors.textMuted },
});
