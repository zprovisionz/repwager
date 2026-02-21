import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { getPracticeStats, getUserPracticeSessions, getPersonalRecords } from '@/services/practice.service';
import { Dumbbell, TrendingUp, Zap, Target } from 'lucide-react-native';
import type { PracticeSession, PracticeStats } from '@/services/practice.service';

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
}

function StatCard({ icon, label, value, unit }: StatCard) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statValue}>
          <Text style={styles.statNumber}>{value}</Text>
          {unit && <Text style={styles.statUnit}>{unit}</Text>}
        </View>
      </View>
    </View>
  );
}

function SessionRow({ item }: { item: PracticeSession }) {
  const date = new Date(item.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const exerciseLabel = item.exercise_type === 'push_ups' ? 'Push-Ups' : 'Squats';

  return (
    <View style={styles.sessionRow}>
      <View style={styles.sessionIcon}>
        <Text style={styles.exerciseEmoji}>
          {item.exercise_type === 'push_ups' ? '💪' : '🦵'}
        </Text>
      </View>
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionExercise}>{exerciseLabel}</Text>
        <Text style={styles.sessionDate}>{date}</Text>
      </View>
      <View style={styles.sessionStats}>
        <Text style={styles.sessionReps}>{item.reps}</Text>
        <Text style={styles.sessionLabel}>reps</Text>
      </View>
    </View>
  );
}

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const [stats, setStats] = useState<PracticeStats | null>(null);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [prs, setPrs] = useState({ push_ups: 0, squats: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    if (!session?.user?.id) return;
    try {
      setIsLoading(true);
      const [statsData, sessionsData, prsData] = await Promise.all([
        getPracticeStats(session.user.id),
        getUserPracticeSessions(session.user.id, 20),
        getPersonalRecords(session.user.id),
      ]);
      setStats(statsData);
      setSessions(sessionsData);
      setPrs(prsData);
    } catch (error) {
      console.error('Failed to load practice data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [session?.user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Dumbbell size={22} color={colors.primary} />
        <Text style={styles.headerTitle}>PRACTICE</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        scrollEnabled
      >
        {/* Overview Section */}
        {stats && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsGrid}>
                <StatCard
                  icon={<TrendingUp size={16} color={colors.success} />}
                  label="Total Sessions"
                  value={stats.total_sessions}
                />
                <StatCard
                  icon={<Zap size={16} color={colors.accent} />}
                  label="Total Reps"
                  value={stats.total_reps.toLocaleString()}
                />
              </View>
              <View style={styles.statsGrid}>
                <StatCard
                  icon={<Target size={16} color={colors.primary} />}
                  label="Best Session"
                  value={stats.best_reps}
                />
                <StatCard
                  icon={<Zap size={16} color={colors.secondary} />}
                  label="Avg Reps/Session"
                  value={stats.avg_reps_per_session}
                />
              </View>
            </View>

            {/* Personal Records */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Records</Text>
              <View style={styles.prGrid}>
                <View style={styles.prCard}>
                  <Text style={styles.prEmoji}>💪</Text>
                  <Text style={styles.prLabel}>Push-Ups</Text>
                  <Text style={styles.prValue}>{prs.push_ups}</Text>
                </View>
                <View style={styles.prCard}>
                  <Text style={styles.prEmoji}>🦵</Text>
                  <Text style={styles.prLabel}>Squats</Text>
                  <Text style={styles.prValue}>{prs.squats}</Text>
                </View>
              </View>
            </View>

            {/* Exercise Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exercise Stats</Text>
              <View style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>💪 Push-Ups</Text>
                  <Text style={styles.exerciseCount}>{stats.push_ups_sessions} sessions</Text>
                </View>
                <View style={styles.exerciseStats}>
                  <View style={styles.exerciseStat}>
                    <Text style={styles.exerciseStatLabel}>Total</Text>
                    <Text style={styles.exerciseStatValue}>{stats.push_ups_total_reps}</Text>
                  </View>
                  <View style={styles.exerciseStat}>
                    <Text style={styles.exerciseStatLabel}>Best</Text>
                    <Text style={styles.exerciseStatValue}>{stats.push_ups_best}</Text>
                  </View>
                  <View style={styles.exerciseStat}>
                    <Text style={styles.exerciseStatLabel}>Avg</Text>
                    <Text style={styles.exerciseStatValue}>
                      {stats.push_ups_sessions > 0
                        ? Math.round(stats.push_ups_total_reps / stats.push_ups_sessions)
                        : 0}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>🦵 Squats</Text>
                  <Text style={styles.exerciseCount}>{stats.squats_sessions} sessions</Text>
                </View>
                <View style={styles.exerciseStats}>
                  <View style={styles.exerciseStat}>
                    <Text style={styles.exerciseStatLabel}>Total</Text>
                    <Text style={styles.exerciseStatValue}>{stats.squats_total_reps}</Text>
                  </View>
                  <View style={styles.exerciseStat}>
                    <Text style={styles.exerciseStatLabel}>Best</Text>
                    <Text style={styles.exerciseStatValue}>{stats.squats_best}</Text>
                  </View>
                  <View style={styles.exerciseStat}>
                    <Text style={styles.exerciseStatLabel}>Avg</Text>
                    <Text style={styles.exerciseStatValue}>
                      {stats.squats_sessions > 0
                        ? Math.round(stats.squats_total_reps / stats.squats_sessions)
                        : 0}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Recent Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {sessions.length > 0 ? (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <SessionRow item={item} />}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.empty}>
              <Dumbbell size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No practice sessions yet. Start training!</Text>
            </View>
          )}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 3,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  statNumber: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.text,
  },
  statUnit: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
  },
  prGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  prCard: {
    flex: 1,
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  prEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  prLabel: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  prValue: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.primary,
  },
  exerciseCard: {
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  exerciseName: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  exerciseCount: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  exerciseStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  exerciseStat: {
    alignItems: 'center',
  },
  exerciseStatLabel: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  exerciseStatValue: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.primary,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bgHighlight,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseEmoji: {
    fontSize: 20,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionExercise: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  sessionDate: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  sessionStats: {
    alignItems: 'flex-end',
  },
  sessionReps: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.primary,
  },
  sessionLabel: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textMuted,
  },
});
