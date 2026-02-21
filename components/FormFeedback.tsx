import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface FormFeedbackProps {
  formQuality: number | null; // 0-100
  formIssues: string[];
  velocityWarning: string | null;
  enabled: boolean;
}

export function FormFeedback({ formQuality, formIssues, velocityWarning, enabled }: FormFeedbackProps) {
  // Determine quality level and colors
  const { qualityLevel, backgroundColor, textColor, gradientColors } = useMemo(() => {
    if (formQuality === null) {
      return {
        qualityLevel: 'Detecting...',
        backgroundColor: '#2A2A2A',
        textColor: '#999999',
        gradientColors: ['#1a1a1a', '#2A2A2A'],
      };
    }

    if (formQuality >= 90) {
      return {
        qualityLevel: 'Perfect Form',
        backgroundColor: '#00D4FF',
        textColor: '#000000',
        gradientColors: ['#00D4FF', '#00A8CC'],
      };
    }

    if (formQuality >= 75) {
      return {
        qualityLevel: 'Good Form',
        backgroundColor: '#FFB800',
        textColor: '#000000',
        gradientColors: ['#FFB800', '#FF8C00'],
      };
    }

    return {
      qualityLevel: 'Poor Form',
      backgroundColor: '#FF2D78',
      textColor: '#FFFFFF',
      gradientColors: ['#FF2D78', '#D91D5E'],
    };
  }, [formQuality]);

  const qualityPercentage = formQuality ?? 0;

  return (
    <View style={styles.container}>
      {/* Quality Meter */}
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.meterContainer}>
        <View style={styles.meterBackground}>
          {/* Progress fill */}
          <View
            style={[
              styles.meterFill,
              {
                width: `${qualityPercentage}%`,
                backgroundColor: backgroundColor,
              },
            ]}
          />
        </View>

        {/* Quality text and percentage */}
        <View style={styles.meterLabelContainer}>
          <Text style={[styles.qualityLabel, { color: textColor }]}>{qualityLevel}</Text>
          <Text style={[styles.qualityPercentage, { color: textColor }]}>
            {formQuality !== null ? `${Math.round(qualityPercentage)}%` : '—'}
          </Text>
        </View>
      </LinearGradient>

      {/* Issues/Tips Section */}
      {(formIssues.length > 0 || velocityWarning) && (
        <View style={styles.issuesContainer}>
          {velocityWarning && (
            <View style={styles.issueItem}>
              <Text style={styles.issueIcon}>⚠️</Text>
              <Text style={styles.issueText}>{velocityWarning}</Text>
            </View>
          )}

          {formIssues.slice(0, 2).map((issue, index) => (
            <View key={index} style={styles.issueItem}>
              <Text style={styles.issueIcon}>📌</Text>
              <Text style={styles.issueText}>{issue}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Status indicator */}
      {!enabled && (
        <View style={styles.disabledContainer}>
          <Text style={styles.disabledText}>Form detection disabled</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  meterContainer: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  meterBackground: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease-out',
  },
  meterLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  qualityPercentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  issuesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  issueIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  issueText: {
    color: '#FFFFFF',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  disabledContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  disabledText: {
    color: '#999999',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
