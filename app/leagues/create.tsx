import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { createLeague } from '@/services/league.service';
import { ChevronLeft, Users, Coins } from 'lucide-react-native';
import Button from '@/components/ui/Button';

const FOCUS_OPTIONS = [
  { value: 'mixed', label: 'Mixed (All exercises)' },
  { value: 'push_ups', label: 'Push-Ups Only' },
  { value: 'squats', label: 'Squats Only' },
];

const PRIVACY_OPTIONS = [
  { value: 'public', label: 'Public — Anyone can join' },
  { value: 'private', label: 'Private — Invite only' },
];

export default function CreateLeagueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [focus, setFocus] = useState<'mixed' | 'push_ups' | 'squats'>('mixed');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!session?.user) return;
    if (!name.trim()) {
      showToast({ type: 'warning', title: 'League name required' });
      return;
    }
    setCreating(true);
    try {
      const league = await createLeague(session.user.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        focus,
        privacy,
      });
      showToast({ type: 'success', title: 'League created!', message: league.name });
      router.replace({ pathname: '/leagues/[id]', params: { id: league.id } });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Could not create league', message: e.message });
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Create League</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.feeCard}>
          <Coins size={20} color={colors.accent} />
          <View>
            <Text style={styles.feeTitle}>Creation Fee: 100 RC</Text>
            <Text style={styles.feeSub}>Deducted from your RepCoins balance</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>League Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Morning Grinders"
            placeholderTextColor={colors.textMuted}
            maxLength={50}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this league about?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Exercise Focus</Text>
          <View style={styles.optionGroup}>
            {FOCUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.option, focus === opt.value && styles.optionActive]}
                onPress={() => setFocus(opt.value as any)}
              >
                <Text style={[styles.optionText, focus === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Privacy</Text>
          <View style={styles.optionGroup}>
            {PRIVACY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.option, privacy === opt.value && styles.optionActive]}
                onPress={() => setPrivacy(opt.value as any)}
              >
                <Text style={[styles.optionText, privacy === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button
          label={creating ? 'Creating...' : 'Create League — 100 RC'}
          onPress={handleCreate}
          loading={creating}
          disabled={!name.trim()}
          variant="primary"
          size="lg"
        />

        <View style={styles.infoCard}>
          <Users size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>
            As admin you can auto-pair members into matches, run weekly seasons,
            and advance to the playoff bracket.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 1,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 80,
  },
  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,184,0,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
  },
  feeTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.accent,
  },
  feeSub: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  field: { gap: spacing.xs },
  label: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontFamily: typography.fontBody,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionGroup: { gap: spacing.xs },
  option: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,212,255,0.06)',
  },
  optionText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  optionTextActive: { color: colors.primary },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
