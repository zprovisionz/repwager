import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search, UserPlus } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { searchProfiles } from '@/services/match.service';
import type { ProfileSearchResult } from '@/types/database';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProfileSearchResult[]>([]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!session?.user?.id || query.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await searchProfiles(query, session.user.id);
        setResults(data);
      } catch {
        showToast({ type: 'error', title: 'Search failed' });
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, session?.user?.id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Direct Challenge</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchCard}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by @username or display name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />}

      {!loading && query.trim().length < 2 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Find your opponent</Text>
          <Text style={styles.emptySubtitle}>Type at least 2 characters to search profiles.</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/challenge/create',
                params: { opponent: item.username },
              })
            }
          >
            <View style={styles.userMeta}>
              <Text style={styles.name}>{item.display_name ?? item.username}</Text>
              <Text style={styles.handle}>@{item.username}</Text>
            </View>
            <View style={styles.actionPill}>
              <UserPlus size={14} color={colors.primary} />
              <Text style={styles.actionText}>Challenge</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && query.trim().length >= 2 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No matches found</Text>
              <Text style={styles.emptySubtitle}>Try a different username.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  title: { fontFamily: typography.fontDisplay, fontSize: 16, color: colors.text, letterSpacing: 1 },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: { flex: 1, color: colors.text, fontFamily: typography.fontBody, fontSize: 14 },
  list: { paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 },
  row: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userMeta: { gap: 2 },
  name: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text },
  handle: { fontFamily: typography.fontBody, fontSize: 12, color: colors.textMuted },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,212,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  actionText: { fontFamily: typography.fontBodyBold, fontSize: 12, color: colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  emptyTitle: { fontFamily: typography.fontBodyBold, fontSize: 16, color: colors.text },
  emptySubtitle: { fontFamily: typography.fontBody, fontSize: 13, color: colors.textMuted },
});
