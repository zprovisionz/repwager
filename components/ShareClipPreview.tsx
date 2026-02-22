import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { Copy, Share2, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '@/lib/theme';
import Button from '@/components/ui/Button';

interface ShareClipPreviewProps {
  matchId: string;
  exerciseType: string;
  opponentName: string;
  myReps: number;
  opponentReps: number;
  onClose?: () => void;
}

export default function ShareClipPreview({
  matchId,
  exerciseType,
  opponentName,
  myReps,
  opponentReps,
  onClose,
}: ShareClipPreviewProps) {
  const [selectedClip, setSelectedClip] = useState<'best' | 'full' | 'highlight'>('best');
  const [clipCopied, setClipCopied] = useState(false);

  // In future, these would be actual video URLs
  const clipUrl = `https://repwager.app/replay/${matchId}?clip=${selectedClip}&masked=true`;
  const shareText = `Just reviewed my ${exerciseType} match on RepWager! 💪 ${myReps} reps vs ${opponentName}'s ${opponentReps}. Check out my form: ${clipUrl}`;

  const clipOptions = [
    {
      id: 'best' as const,
      label: 'Best Rep',
      description: 'Your highest-quality rep (masked)',
      duration: '~3 sec',
    },
    {
      id: 'full' as const,
      label: 'Full Match',
      description: 'Complete match replay (masked)',
      duration: `${Math.ceil((myReps || 1) * 2)} sec`,
    },
    {
      id: 'highlight' as const,
      label: 'Highlights',
      description: 'Best 3 reps montage (masked)',
      duration: '~8 sec',
    },
  ];

  const handleCopyLink = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // In a real implementation, would use native copy functionality
    setClipCopied(true);
    setTimeout(() => setClipCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({
        message: shareText,
        title: 'Share RepWager Clip',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Share Anonymized Clip</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🎭</Text>
          <View>
            <Text style={styles.privacyTitle}>Fully Anonymized</Text>
            <Text style={styles.privacyBody}>
              Clips mask all identifiable features—only movement silhouettes and reps shown.
            </Text>
          </View>
        </View>

        {/* Clip type selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT CLIP TYPE</Text>
          {clipOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.clipOption,
                selectedClip === option.id && styles.clipOptionActive,
              ]}
              onPress={() => {
                setSelectedClip(option.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.clipOptionLeft}>
                <View
                  style={[
                    styles.radio,
                    selectedClip === option.id && styles.radioActive,
                  ]}
                >
                  {selectedClip === option.id && (
                    <View style={styles.radioDot} />
                  )}
                </View>
                <View>
                  <Text style={styles.clipLabel}>{option.label}</Text>
                  <Text style={styles.clipDesc}>{option.description}</Text>
                </View>
              </View>
              <Text style={styles.clipDuration}>{option.duration}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Copy link section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COPY SHAREABLE LINK</Text>
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={2}>
              {clipUrl}
            </Text>
            <TouchableOpacity
              onPress={handleCopyLink}
              style={styles.copyBtn}
            >
              {clipCopied ? (
                <Check size={18} color={colors.success} />
              ) : (
                <Copy size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
          {clipCopied && (
            <Text style={styles.copiedText}>✓ Link copied to clipboard</Text>
          )}
        </View>

        {/* Share options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SHARE</Text>
          <TouchableOpacity
            style={styles.shareOption}
            onPress={handleNativeShare}
          >
            <Share2 size={18} color={colors.primary} />
            <Text style={styles.shareOptionText}>Share to Messages, Social, etc.</Text>
          </TouchableOpacity>
        </View>

        {/* Feature note */}
        <View style={styles.featureNote}>
          <Text style={styles.featureNoteText}>
            💡 In future updates, you'll be able to download and edit clips directly.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Done"
          variant="ghost"
          size="md"
          onPress={onClose || (() => {})}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 16,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  privacyNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,212,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  privacyIcon: {
    fontSize: 24,
  },
  privacyTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  privacyBody: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  clipOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  clipOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  clipOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    alignSelf: 'center',
    marginTop: 3,
  },
  clipLabel: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.text,
  },
  clipDesc: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  clipDuration: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  linkText: {
    flex: 1,
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.primary,
    paddingRight: spacing.xs,
  },
  copyBtn: {
    padding: spacing.xs,
  },
  copiedText: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.success,
    marginTop: 2,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '12',
  },
  shareOptionText: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.primary,
  },
  featureNote: {
    backgroundColor: 'rgba(255,184,0,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  featureNoteText: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
