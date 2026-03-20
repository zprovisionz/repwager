import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import {
  getLeague,
  getLeagueMembers,
  getLeagueChat,
  sendChatMessage,
  subscribeToLeagueChat,
  joinLeague,
  getLeagueMatches,
  getLeagueStandings,
} from '@/services/league.service';
import type { League, LeagueMember, ChatMessage, LeagueMatch } from '@/services/league.service';
import Avatar from '@/components/Avatar';
import {
  ChevronLeft, Users, MessageCircle, Trophy, Calendar, Send, Plus,
} from 'lucide-react-native';
import { useRouter as useExpoRouter } from 'expo-router';

type Tab = 'standings' | 'schedule' | 'chat';

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<Tab>('standings');
  const [joining, setJoining] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatListRef = useRef<FlatList>(null);

  const isMember = members.some((m) => m.user_id === session?.user?.id);
  const isAdmin = league?.admin_id === session?.user?.id;

  async function load() {
    if (!id) return;
    try {
      const [l, m, mt, ch] = await Promise.all([
        getLeague(id),
        getLeagueMembers(id),
        getLeagueMatches(id),
        getLeagueChat(id),
      ]);
      setLeague(l);
      setMembers(m);
      setMatches(mt);
      setMessages(ch);
    } catch {}
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const sub = subscribeToLeagueChat(id, (msg) => {
      setMessages((prev) => [...prev, msg]);
      chatListRef.current?.scrollToEnd({ animated: true });
    });
    return () => { sub.unsubscribe(); };
  }, [id]);

  async function handleJoin() {
    if (!session?.user || !id) return;
    setJoining(true);
    try {
      await joinLeague(session.user.id, id);
      await load();
      showToast({ type: 'success', title: 'Joined league!' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Could not join', message: e.message });
    } finally {
      setJoining(false);
    }
  }

  async function handleSendChat() {
    if (!chatInput.trim() || !session?.user || !id) return;
    setSendingChat(true);
    try {
      const msg = await sendChatMessage(id, session.user.id, chatInput.trim());
      setMessages((prev) => [...prev, msg]);
      setChatInput('');
      chatListRef.current?.scrollToEnd({ animated: true });
    } catch {
    } finally {
      setSendingChat(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.bottom}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{league?.name ?? '...'}</Text>
            <Text style={styles.subtitle}>{members.length} members</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              style={styles.bracketBtn}
              onPress={() =>
                router.push({ pathname: '/leagues/bracket', params: { id: id! } })
              }
            >
              <Trophy size={16} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>

        {!isMember && (
          <TouchableOpacity
            style={[styles.joinBar, joining && { opacity: 0.6 }]}
            onPress={handleJoin}
            disabled={joining}
          >
            <Plus size={16} color={colors.bg} />
            <Text style={styles.joinBarText}>{joining ? 'Joining...' : 'Join this League'}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.tabRow}>
          {(['standings', 'schedule', 'chat'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              {t === 'standings' && <Trophy size={13} color={tab === t ? colors.bg : colors.textMuted} />}
              {t === 'schedule' && <Calendar size={13} color={tab === t ? colors.bg : colors.textMuted} />}
              {t === 'chat' && <MessageCircle size={13} color={tab === t ? colors.bg : colors.textMuted} />}
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'standings' && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {members.length === 0 ? (
              <View style={styles.empty}>
                <Users size={40} color={colors.textMuted} strokeWidth={1} />
                <Text style={styles.emptyText}>No members yet</Text>
              </View>
            ) : (
              members.map((member, i) => (
                <View
                  key={member.id}
                  style={[styles.memberRow, i === 0 && styles.memberRowFirst]}
                >
                  <Text style={styles.memberRank}>#{i + 1}</Text>
                  {member.profiles && (
                    <Avatar
                      gender={(member.profiles.avatar_gender as any) ?? 'male'}
                      head={member.profiles.avatar_head}
                      torso={member.profiles.avatar_torso}
                      legs={member.profiles.avatar_legs}
                      size={36}
                    />
                  )}
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.profiles?.display_name ?? '---'}
                    </Text>
                    <Text style={styles.memberHandle}>
                      @{member.profiles?.username ?? '---'}
                    </Text>
                  </View>
                  <View style={styles.memberStats}>
                    <Text style={styles.memberElo}>{member.league_elo}</Text>
                    <Text style={styles.memberRecord}>
                      {member.wins}W-{member.losses}L
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {tab === 'schedule' && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {matches.length === 0 ? (
              <View style={styles.empty}>
                <Calendar size={40} color={colors.textMuted} strokeWidth={1} />
                <Text style={styles.emptyText}>No matches scheduled yet</Text>
                {isAdmin && (
                  <Text style={styles.emptySubText}>
                    Use auto-pair to schedule matches for all members.
                  </Text>
                )}
              </View>
            ) : (
              matches.map((m) => {
                const p1 = members.find((mb) => mb.user_id === m.player1_id);
                const p2 = members.find((mb) => mb.user_id === m.player2_id);
                return (
                  <View key={m.id} style={styles.matchRow}>
                    <View style={styles.matchPlayers}>
                      <Text style={styles.matchPlayer}>
                        {p1?.profiles?.display_name ?? '???'}
                      </Text>
                      <Text style={styles.matchVs}>vs</Text>
                      <Text style={styles.matchPlayer}>
                        {p2?.profiles?.display_name ?? '???'}
                      </Text>
                    </View>
                    <View style={styles.matchMeta}>
                      {m.round && (
                        <Text style={styles.matchRound}>{m.round}</Text>
                      )}
                      <Text style={[styles.matchStatus, m.status === 'completed' && styles.matchStatusDone]}>
                        {m.status.toUpperCase()}
                      </Text>
                    </View>
                    {m.scheduled_at && (
                      <Text style={styles.matchDate}>
                        {new Date(m.scheduled_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {tab === 'chat' && (
          <View style={styles.chatContainer}>
            <FlatList
              ref={chatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.chatScroll}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <MessageCircle size={40} color={colors.textMuted} strokeWidth={1} />
                  <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isMe = item.user_id === session?.user?.id;
                return (
                  <View style={[styles.chatMsg, isMe && styles.chatMsgMe]}>
                    {!isMe && (
                      <Text style={styles.chatSender}>
                        {item.profiles?.display_name ?? 'Unknown'}
                      </Text>
                    )}
                    <View style={[styles.chatBubble, isMe && styles.chatBubbleMe]}>
                      <Text style={[styles.chatText, isMe && styles.chatTextMe]}>
                        {item.message}
                      </Text>
                    </View>
                    <Text style={styles.chatTime}>
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                );
              }}
            />

            {isMember ? (
              <View style={[styles.chatInputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <TextInput
                  style={styles.chatInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Message..."
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="send"
                  onSubmitEditing={handleSendChat}
                />
                <TouchableOpacity
                  style={[styles.chatSendBtn, (!chatInput.trim() || sendingChat) && { opacity: 0.5 }]}
                  onPress={handleSendChat}
                  disabled={!chatInput.trim() || sendingChat}
                >
                  <Send size={18} color={colors.bg} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.chatJoinPrompt}>
                <Text style={styles.chatJoinText}>Join the league to chat</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  bracketBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,184,0,0.1)',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
  },
  joinBarText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.bg,
  },
  tabRow: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tabTextActive: { color: colors.bg },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: 80,
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: typography.fontBody,
    fontSize: 15,
    color: colors.textMuted,
  },
  emptySubText: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberRowFirst: {
    borderColor: colors.accent + '66',
    backgroundColor: 'rgba(255,184,0,0.04)',
  },
  memberRank: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    color: colors.textMuted,
    width: 28,
    textAlign: 'center',
  },
  memberInfo: { flex: 1 },
  memberName: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  memberHandle: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  memberStats: { alignItems: 'flex-end', gap: 2 },
  memberElo: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.primary,
  },
  memberRecord: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  matchRow: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  matchPlayers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  matchPlayer: {
    flex: 1,
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  matchVs: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 11,
    color: colors.textMuted,
  },
  matchMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  matchRound: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  matchStatus: {
    fontFamily: typography.fontBodyBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  matchStatusDone: { color: colors.success },
  matchDate: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  chatContainer: { flex: 1 },
  chatScroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chatMsg: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    gap: 2,
  },
  chatMsgMe: { alignSelf: 'flex-end' },
  chatSender: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  chatBubble: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderBottomLeftRadius: 4,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatBubbleMe: {
    backgroundColor: colors.primary + '1A',
    borderColor: colors.primary + '44',
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: 4,
  },
  chatText: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.text,
  },
  chatTextMe: { color: colors.text },
  chatTime: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
    alignSelf: 'flex-end',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: typography.fontBody,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatJoinPrompt: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  chatJoinText: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
  },
});
