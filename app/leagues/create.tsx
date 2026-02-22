/*
  League Creation Screen

  Complete form for creating a new competitive league with:
  - League name & photo
  - Focus type (casual/fitness/competitive)
  - Privacy settings (public/private)
  - Member limits & entry fees
*/

import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { createLeague } from '@/services/leagueTournament.service';
import { uploadLeaguePhoto } from '@/lib/storage';
import { useAuth } from '@/store/auth';
import { Shield, Users, Trophy, Image as ImageIcon } from 'lucide-react-native';

type FocusType = 'casual' | 'fitness' | 'competitive';
type Privacy = 'public' | 'private';

const FOCUS_TYPES: { id: FocusType; label: string; desc: string }[] = [
  { id: 'casual', label: '🏃 Casual', desc: 'XP only, no wagers' },
  { id: 'fitness', label: '💪 Fitness', desc: 'Mixed practice & light wagers' },
  { id: 'competitive', label: '🏆 Competitive', desc: 'Full wagers & ranked points' },
];

export default function CreateLeagueScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [focusType, setFocusType] = useState<FocusType>('competitive');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [maxMembers, setMaxMembers] = useState('32');
  const [entryFee, setEntryFee] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      setError('Failed to pick photo');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('League name is required');
      return;
    }

    if (name.length < 3 || name.length > 40) {
      setError('League name must be 3-40 characters');
      return;
    }

    if (!user) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload photo if selected
      let photoUrl: string | undefined;
      if (photoUri) {
        photoUrl = await uploadLeaguePhoto(user.id, photoUri);
      }

      const league = await createLeague(user.id, {
        name: name.trim(),
        photo_url: photoUrl,
        focus_type: focusType,
        privacy,
        max_members: parseInt(maxMembers, 10),
        entry_fee: parseFloat(entryFee) || 0,
      });

      if (league) {
        router.push(`/leagues/${league.id}`);
      } else {
        setError('Failed to create league');
      }
    } catch (err) {
      setError('Error creating league');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Create League</Text>
        <Text style={styles.subtitle}>Build your competitive fitness community</Text>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Photo Upload */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>League Photo</Text>
        <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
          {photoUri ? (
            <View style={styles.photoPreview}>
              <Text style={styles.photoPreviewText}>📸 Photo Selected</Text>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <ImageIcon size={40} color={colors.primary} />
              <Text style={styles.photoPlaceholderText}>Tap to upload photo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* League Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>League Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Elite Push-Up Kings"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
          maxLength={40}
          editable={!loading}
        />
        <Text style={styles.charCount}>{name.length}/40</Text>
      </View>

      {/* Focus Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>League Focus</Text>
        <View style={styles.focusTypeGrid}>
          {FOCUS_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.focusTypeCard,
                focusType === type.id && styles.focusTypeCardActive,
              ]}
              onPress={() => setFocusType(type.id)}
              disabled={loading}
            >
              <Text style={styles.focusTypeLabel}>{type.label}</Text>
              <Text style={styles.focusTypeDesc}>{type.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <View style={styles.privacyHeader}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <Shield size={20} color={colors.primary} />
        </View>

        <TouchableOpacity
          style={[styles.privacyOption, privacy === 'public' && styles.privacyOptionActive]}
          onPress={() => setPrivacy('public')}
          disabled={loading}
        >
          <View style={styles.privacyRadio}>
            {privacy === 'public' && <View style={styles.privacyRadioInner} />}
          </View>
          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>Public</Text>
            <Text style={styles.privacyDesc}>Anyone can join</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.privacyOption, privacy === 'private' && styles.privacyOptionActive]}
          onPress={() => setPrivacy('private')}
          disabled={loading}
        >
          <View style={styles.privacyRadio}>
            {privacy === 'private' && <View style={styles.privacyRadioInner} />}
          </View>
          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>Private</Text>
            <Text style={styles.privacyDesc}>Invite code required</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Max Members */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Max Members</Text>
        <View style={styles.numberInputGroup}>
          <TouchableOpacity
            style={styles.numberInputButton}
            onPress={() => {
              const num = Math.max(8, parseInt(maxMembers, 10) - 1);
              setMaxMembers(num.toString());
            }}
            disabled={loading}
          >
            <Text style={styles.numberInputButtonText}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.numberInput}
            value={maxMembers}
            onChangeText={(val) => {
              const num = parseInt(val, 10);
              if (!isNaN(num) && num >= 8 && num <= 64) {
                setMaxMembers(num.toString());
              }
            }}
            editable={!loading}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={styles.numberInputButton}
            onPress={() => {
              const num = Math.min(64, parseInt(maxMembers, 10) + 1);
              setMaxMembers(num.toString());
            }}
            disabled={loading}
          >
            <Text style={styles.numberInputButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>8–64 members</Text>
      </View>

      {/* Entry Fee */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Entry Fee (Optional)</Text>
        <View style={styles.currencyInput}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.currencyInputField}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            value={entryFee}
            onChangeText={(val) => {
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0 && num <= 1000) {
                setEntryFee(num.toString());
              } else if (val === '') {
                setEntryFee('');
              }
            }}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>
        <Text style={styles.helperText}>Fake $ per member — optional</Text>
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createButton, loading && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <>
            <Trophy size={20} color={colors.textInverse} />
            <Text style={styles.createButtonText}>Create League</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: '#FF4444',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: typography.fontBodyMedium,
    color: '#FFF',
    fontSize: 14,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  photoBox: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  photoPreview: {
    alignItems: 'center',
  },
  photoPreviewText: {
    fontFamily: typography.fontBodyMedium,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontFamily: typography.fontBodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontSize: 14,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  focusTypeGrid: {
    gap: spacing.sm,
  },
  focusTypeCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  focusTypeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.bgElevated,
  },
  focusTypeLabel: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  focusTypeDesc: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  privacyOptionActive: {
    borderColor: colors.primary,
  },
  privacyRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  privacyDesc: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  numberInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  numberInputButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInputButtonText: {
    fontFamily: typography.fontDisplay,
    fontSize: 24,
    color: colors.textInverse,
    fontWeight: '600',
  },
  numberInput: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  helperText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  currencyInputField: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.text,
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
});
