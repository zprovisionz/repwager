import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

// Restricted geo regions (US states where wagering is prohibited)
const RESTRICTED_REGIONS = ['AR', 'CT', 'DE', 'LA', 'SD'];

// Simplified date picker using three selects for cross-platform compatibility
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = range(CURRENT_YEAR - 100, CURRENT_YEAR - 1).reverse();
const DAYS = range(1, 31);

export default function AgeGateScreen() {
  const router = useRouter();
  const { session, refreshProfile } = useAuthStore();
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [geoRegion, setGeoRegion] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Show native picker on iOS/Android using select elements on web
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  function validateAndContinue() {
    setError('');

    if (!month || !day || !year) {
      setError('Please select your full date of birth.');
      return;
    }

    const dob = new Date(year, month - 1, day);
    const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (age < 18) {
      setError('You must be 18 years or older to use RepWager.');
      return;
    }

    const upperRegion = geoRegion.trim().toUpperCase();
    if (upperRegion && RESTRICTED_REGIONS.includes(upperRegion)) {
      setError(
        `RepWager wager matches are not available in ${upperRegion} due to state regulations. You can still use the app in casual mode.`
      );
    }

    handleSave(dob.toISOString().split('T')[0], upperRegion || null);
  }

  async function handleSave(dobStr: string, region: string | null) {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      await (supabase.from('profiles') as any)
        .update({ dob: dobStr, geo_region: region })
        .eq('id', session.user.id);
      await refreshProfile();
      router.replace('/onboarding/fitness-disclaimer');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Age Verification</Text>
      <Text style={styles.subtitle}>
        RepWager is for adults 18+. Enter your date of birth to continue.
      </Text>

      <Text style={styles.fieldLabel}>Date of Birth</Text>
      <View style={styles.dateRow}>
        {/* Month */}
        <View style={styles.dateField}>
          <Text style={styles.dateFieldLabel}>Month</Text>
          <ScrollPicker
            selected={month}
            options={MONTHS.map((m, i) => ({ label: m, value: i + 1 }))}
            placeholder="—"
            onSelect={setMonth}
          />
        </View>
        {/* Day */}
        <View style={styles.dateField}>
          <Text style={styles.dateFieldLabel}>Day</Text>
          <ScrollPicker
            selected={day}
            options={DAYS.map((d) => ({ label: String(d), value: d }))}
            placeholder="—"
            onSelect={setDay}
          />
        </View>
        {/* Year */}
        <View style={[styles.dateField, { flex: 1.4 }]}>
          <Text style={styles.dateFieldLabel}>Year</Text>
          <ScrollPicker
            selected={year}
            options={YEARS.map((y) => ({ label: String(y), value: y }))}
            placeholder="——"
            onSelect={setYear}
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>State (optional, for compliance check)</Text>
      <View style={styles.regionRow}>
        {REGIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.regionPill,
              geoRegion === r && styles.regionPillActive,
              RESTRICTED_REGIONS.includes(r) && styles.regionPillRestricted,
              geoRegion === r && RESTRICTED_REGIONS.includes(r) && styles.regionPillRestrictedActive,
            ]}
            onPress={() => setGeoRegion(geoRegion === r ? '' : r)}
          >
            <Text
              style={[
                styles.regionPillText,
                geoRegion === r && styles.regionPillTextActive,
                RESTRICTED_REGIONS.includes(r) && styles.regionPillTextRestricted,
              ]}
            >
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {geoRegion && RESTRICTED_REGIONS.includes(geoRegion) && (
        <Text style={styles.restrictedNote}>
          Wager matches restricted in {geoRegion}. Casual mode available.
        </Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, saving && { opacity: 0.7 }]}
        onPress={validateAndContinue}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Continue'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Simple inline scroll-picker using list of touchable pills
function ScrollPicker({
  selected,
  options,
  placeholder,
  onSelect,
}: {
  selected: number | null;
  options: { label: string; value: number }[];
  placeholder: string;
  onSelect: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = selected != null
    ? options.find((o) => o.value === selected)?.label ?? placeholder
    : placeholder;

  return (
    <View>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setOpen(!open)}>
        <Text style={[styles.pickerBtnText, selected == null && { color: colors.textMuted }]}>
          {selectedLabel}
        </Text>
        <Text style={styles.pickerChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.pickerDropdown}>
          {options.slice(0, 50).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.pickerOption, opt.value === selected && styles.pickerOptionSelected]}
              onPress={() => { onSelect(opt.value); setOpen(false); }}
            >
              <Text style={[styles.pickerOptionText, opt.value === selected && styles.pickerOptionTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          {options.length > 50 && (
            <Text style={styles.pickerMoreText}>Scroll up for more years...</Text>
          )}
        </View>
      )}
    </View>
  );
}

const REGIONS = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 26,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dateField: { flex: 1 },
  dateFieldLabel: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  pickerBtnText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  pickerChevron: { color: colors.textMuted, fontSize: 10 },
  pickerDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    maxHeight: 200,
    overflow: 'scroll' as any,
  },
  pickerOption: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  pickerOptionSelected: { backgroundColor: colors.primary + '22' },
  pickerOptionText: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.text,
  },
  pickerOptionTextSelected: { color: colors.primary, fontFamily: typography.fontBodyBold },
  pickerMoreText: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  regionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  regionPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  regionPillActive: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary,
  },
  regionPillRestricted: { borderColor: colors.secondary + '60' },
  regionPillRestrictedActive: {
    backgroundColor: colors.secondary + '22',
    borderColor: colors.secondary,
  },
  regionPillText: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textSecondary,
  },
  regionPillTextActive: { color: colors.primary },
  regionPillTextRestricted: { color: colors.secondary },
  restrictedNote: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.secondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  error: {
    color: colors.secondary,
    fontFamily: typography.fontBody,
    fontSize: 13,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: { fontFamily: typography.fontBodyBold, color: '#00131A', fontSize: 15 },
});
