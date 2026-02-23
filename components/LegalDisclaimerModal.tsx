import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
} from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';

interface LegalDisclaimerModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline?: () => void;
}

export default function LegalDisclaimerModal({
  visible,
  onAccept,
  onDecline,
}: LegalDisclaimerModalProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleAccept = () => {
    if (ageConfirmed && termsAccepted) {
      onAccept();
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <AlertCircle size={24} color={colors.error} />
            <Text style={styles.headerTitle}>Important Legal Notices</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Age Verification */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Age Verification</Text>
            <Text style={styles.sectionText}>
              You must be at least 18 years old to use RepWager and participate in
              wagers. Users under 18 can use practice mode without wagers.
            </Text>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setAgeConfirmed(!ageConfirmed)}
            >
              <View
                style={[
                  styles.checkboxBox,
                  ageConfirmed && styles.checkboxBoxChecked,
                ]}
              >
                {ageConfirmed && <CheckCircle2 size={18} color={colors.success} />}
              </View>
              <Text style={styles.checkboxLabel}>I confirm I am 18 years or older</Text>
            </TouchableOpacity>
          </View>

          {/* Health & Safety Disclaimer */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health & Safety</Text>
            <Text style={styles.sectionText}>
              RepWager is a fitness tracking app for exercise competitions. Always:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Consult a doctor before starting new exercises</Text>
              <Text style={styles.bullet}>• Warm up properly before competitions</Text>
              <Text style={styles.bullet}>• Stop immediately if you experience pain</Text>
              <Text style={styles.bullet}>• Use proper form to avoid injury</Text>
            </View>
            <Text style={styles.disclaimerWarning}>
              RepWager is NOT responsible for injuries sustained during exercises.
            </Text>
          </View>

          {/* Wager Disclaimer */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wagers & Virtual Currency</Text>
            <Text style={styles.sectionText}>
              RepWager uses virtual currency for competition wagers. Key points:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>
                • Virtual currency has no real-world cash value
              </Text>
              <Text style={styles.bullet}>
                • You cannot cash out or sell virtual currency
              </Text>
              <Text style={styles.bullet}>
                • Losing wagers results in virtual currency loss only
              </Text>
              <Text style={styles.bullet}>
                • Play responsibly and within your limits
              </Text>
            </View>
          </View>

          {/* Camera & Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Camera & Data Privacy</Text>
            <Text style={styles.sectionText}>
              RepWager uses your device camera to:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Detect your pose and count reps</Text>
              <Text style={styles.bullet}>• Analyze form quality in real-time</Text>
            </View>
            <Text style={styles.sectionText}>
              Camera data is{' '}
              <Text style={{ fontWeight: '600' }}>processed locally on your device</Text> and
              is NOT stored or uploaded to our servers.
            </Text>
          </View>

          {/* Terms Checkbox */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setTermsAccepted(!termsAccepted)}
            >
              <View
                style={[
                  styles.checkboxBox,
                  termsAccepted && styles.checkboxBoxChecked,
                ]}
              >
                {termsAccepted && <CheckCircle2 size={18} color={colors.success} />}
              </View>
              <Text style={styles.checkboxLabel}>
                I have read and accept all legal notices
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.lg }} />
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          {onDecline && (
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={onDecline}
              disabled={!ageConfirmed || !termsAccepted}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.acceptBtn,
              (!ageConfirmed || !termsAccepted) && styles.acceptBtnDisabled,
            ]}
            onPress={handleAccept}
            disabled={!ageConfirmed || !termsAccepted}
          >
            <Text style={styles.acceptBtnText}>I Agree & Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.xl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  sectionText: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  bulletList: {
    marginBottom: spacing.md,
    paddingLeft: spacing.md,
  },
  bullet: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  disclaimerWarning: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.error,
    backgroundColor: 'rgba(255,59,48,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkboxLabel: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  declineBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  acceptBtnDisabled: {
    opacity: 0.5,
  },
  acceptBtnText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
});
