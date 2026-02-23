/*
  League Detail Screen

  Shows:
  - League info & photo
  - Member roster with stats
  - Admin controls (promote, kick, schedule match)
  - League chat
  - Recent matches
*/

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import {
  getLeagueDetail,
  getLeagueMembers,
  getLeagueMatches,
  subscribeToLeagueChat,
  getLeagueChats,
  sendLeagueChat,
  type League,
  type LeagueMember,
  type LeagueChat,
  type LeagueMatch,
} from '@/services/leagueTournament.service';
import { useAuthStore } from '@/stores/authStore';
import { Trophy, Users, MessageCircle, Swords, Settings } from 'lucide-react-native';

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const user = session?.user;

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [chats, setChats] = useState<LeagueChat[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'chat' | 'matches'>('members');
  const [chatMessage, setChatMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const leagueId = typeof id === 'string' ? id : '';
  const isOwner = league?.owner_id === user?.id;
  const isAdmin = isOwner || members.find((m) => m.user_id === user?.id)?.role === 'admin';

  // Load league data
  useEffect(() => {
    loadLeagueData();
  }, [leagueId]);

  // Subscribe to chat
  useEffect(() => {
    if (!leagueId) return;

    const subscription = subscribeToLeagueChat(leagueId, (newChat) => {
      setChats((prev) => [...prev, newChat]);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [leagueId]);

  const loadLeagueData = async () => {
    try {
      setLoading(true);
      const [leagueData, membersData, chatsData, matchesData] = await Promise.all([
        getLeagueDetail(leagueId),
        getLeagueMembers(leagueId),
        getLeagueChats(leagueId),
        getLeagueMatches(leagueId),
      ]);

      if (leagueData) setLeague(leagueData);
      if (membersData) setMembers(membersData);
      if (chatsData) setChats(chatsData);
      if (matchesData) setMatches(matchesData);
    } catch (error) {
      console.error('Failed to load league data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim() || !user) return;

    setSendingChat(true);
    try {
      await sendLeagueChat(leagueId, user.id, chatMessage);
      setChatMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingChat(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!league) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>League not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {league.photo_url && (
          <Image source={{ uri: league.photo_url }} style={styles.leaguePhoto} />
        )}
        <View style={styles.headerContent}>
          <Text style={styles.leagueName}>{league.name}</Text>
          <View style={styles.leagueMeta}>
            <View style={styles.metaItem}>
              <Users size={16} color={colors.primary} />
              <Text style={styles.metaText}>
                {members.length}/{league.max_members}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Trophy size={16} color={colors.accent} />
              <Text style={styles.metaText}>{league.focus_type}</Text>
            </View>
          </View>
        </View>
        {isOwner && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push(`/leagues/${leagueId}/settings`)}
          >
            <Settings size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['members', 'chat', 'matches'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              isAdmin={isAdmin}
              leagueId={leagueId}
              onUpdate={loadLeagueData}
            />
          )}
          scrollEnabled={false}
          style={styles.membersList}
        />
      )}

      {activeTab === 'chat' && (
        <View style={styles.chatContainer}>
          <FlatList
            data={chats}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.chatBubble}>
                <Text style={styles.chatAuthor}>
                  {item.author?.display_name || 'Unknown'}
                </Text>
                <Text style={styles.chatMessage}>{item.message}</Text>
              </View>
            )}
            scrollEnabled={false}
          />

          {/* Typing indicator */}
          {typingUsers.size > 0 && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>
                {Array.from(typingUsers).slice(0, 2).join(', ')}{typingUsers.size > 2 ? ', +' + (typingUsers.size - 2) : ''} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </Text>
            </View>
          )}

          {user && (
            <View style={styles.chatInput}>
              <TextInput
                style={styles.chatInputField}
                placeholder="Send a message..."
                placeholderTextColor={colors.textSecondary}
                value={chatMessage}
                onChangeText={(text) => {
                  setChatMessage(text);
                  // Show typing indicator when user types
                  if (text.length > 0 && typingUsers.size === 0) {
                    setTypingUsers(new Set([user.id]));
                  } else if (text.length === 0) {
                    setTypingUsers(new Set());
                  }
                }}
                editable={!sendingChat}
              />
              <TouchableOpacity
                style={[styles.chatSendButton, sendingChat && styles.chatSendButtonDisabled]}
                onPress={() => {
                  setTypingUsers(new Set()); // Clear typing indicator
                  handleSendChat();
                }}
                disabled={sendingChat || !chatMessage.trim()}
              >
                <MessageCircle size={20} color={colors.textInverse} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {activeTab === 'matches' && (
        <View style={styles.matchesContainer}>
          {matches.length === 0 ? (
            <Text style={styles.emptyText}>No matches yet</Text>
          ) : (
            <FlatList
              data={matches}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MatchCard match={item} leagueId={leagueId} />
              )}
              scrollEnabled={false}
            />
          )}

          {isAdmin && (
            <TouchableOpacity
              style={styles.scheduleMatchButton}
              onPress={() => router.push(`/leagues/${leagueId}/matchmaking`)}
            >
              <Swords size={20} color={colors.textInverse} />
              <Text style={styles.scheduleMatchButtonText}>Schedule Match</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function MemberRow({
  member,
  isAdmin,
  leagueId,
  onUpdate,
}: {
  member: LeagueMember;
  isAdmin: boolean;
  leagueId: string;
  onUpdate: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberInfo}>
        <View style={styles.memberRank}>
          <Text style={styles.memberRankText}>{member.rank || '—'}</Text>
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>
            {member.profile?.display_name || 'Anonymous'}
          </Text>
          <View style={styles.memberStats}>
            <Text style={styles.memberStat}>{member.wins}W</Text>
            <Text style={styles.memberStat}>{member.losses}L</Text>
            <Text style={styles.memberStat}>{member.ties}T</Text>
          </View>
        </View>
      </View>

      <View style={styles.memberPoints}>
        <Text style={styles.memberPointsValue}>{member.points}</Text>
        <Text style={styles.memberPointsLabel}>pts</Text>
      </View>

      {isAdmin && (
        <TouchableOpacity
          style={styles.memberActionsButton}
          onPress={() => setShowActions(!showActions)}
        >
          <Text style={styles.memberActionsButtonText}>⋮</Text>
        </TouchableOpacity>
      )}

      {showActions && isAdmin && (
        <View style={styles.memberActionsMenu}>
          <TouchableOpacity style={styles.actionItem} onPress={() => setShowActions(false)}>
            <Text style={styles.actionItemText}>👮 Make Admin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionItem, styles.actionItemDanger]} onPress={() => setShowActions(false)}>
            <Text style={styles.actionItemTextDanger}>🗑️ Kick Member</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function MatchCard({ match, leagueId }: { match: LeagueMatch; leagueId: string }) {
  const statusColors = {
    pending: colors.accent,
    ongoing: colors.primary,
    completed: colors.accent,
    cancelled: colors.textSecondary,
  };

  return (
    <TouchableOpacity style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <Text style={styles.matchExercise}>{match.exercise_type}</Text>
        <View style={[styles.matchStatus, { backgroundColor: statusColors[match.status] }]}>
          <Text style={styles.matchStatusText}>{match.status}</Text>
        </View>
      </View>

      <View style={styles.matchScore}>
        <View style={styles.matchScoreTeam}>
          <Text style={styles.matchScoreValue}>{match.league_a_points}</Text>
          <Text style={styles.matchScoreLabel}>Pts</Text>
        </View>
        <Text style={styles.matchScoreSeparator}>vs</Text>
        <View style={styles.matchScoreTeam}>
          <Text style={styles.matchScoreValue}>{match.league_b_points}</Text>
          <Text style={styles.matchScoreLabel}>Pts</Text>
        </View>
      </View>

      <Text style={styles.matchWager}>${match.wager_amount.toFixed(2)} wager</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  errorText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    backgroundColor: colors.bgElevated,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leaguePhoto: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  leagueName: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  leagueMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  membersList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRankText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textInverse,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  memberStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  memberStat: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  memberPoints: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  memberPointsValue: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  memberPointsLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  memberActionsButton: {
    padding: spacing.sm,
  },
  memberActionsButtonText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  memberActionsMenu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    minWidth: 150,
    overflow: 'hidden',
  },
  actionItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionItemText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  actionItemDanger: {
    borderBottomWidth: 0,
  },
  actionItemTextDanger: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: '#FF4444',
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  chatBubble: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chatAuthor: {
    fontFamily: typography.fontDisplay,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  chatMessage: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  chatInput: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  chatInputField: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  chatSendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendButtonDisabled: {
    opacity: 0.5,
  },
  matchesContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  emptyText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  matchCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  matchExercise: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  matchStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  matchStatusText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textInverse,
  },
  matchScore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  matchScoreTeam: {
    alignItems: 'center',
  },
  matchScoreValue: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  matchScoreLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  matchScoreSeparator: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  matchWager: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scheduleMatchButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  scheduleMatchButtonText: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  typingIndicator: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  typingText: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

// Import TextInput from React Native at top
import { TextInput } from 'react-native';
