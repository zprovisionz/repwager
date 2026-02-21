import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '@/lib/theme';
import type { FormQualityMarker } from '@/types/theatre';

interface RepTimelineProps {
  markers: FormQualityMarker[];
  durationMs: number;
  currentMs: number;
  onRepTap: (marker: FormQualityMarker) => void;
}

function qualityColor(quality: number): string {
  if (quality >= 90) return colors.success;  // #00FF88 green
  if (quality >= 75) return colors.accent;   // #FFB800 yellow
  return colors.secondary;                   // #FF2D78 red
}

export default function RepTimeline({
  markers,
  durationMs,
  currentMs,
  onRepTap,
}: RepTimelineProps) {
  const [width, setWidth] = useState(300);
  const [tappedRep, setTappedRep] = useState<number | null>(null);

  if (!markers.length || !durationMs) return null;

  const height = 44;
  const trackY = height / 2;
  const dotRadius = 7;
  const playheadX = (currentMs / durationMs) * width;

  const handleRepTap = (marker: FormQualityMarker) => {
    setTappedRep(marker.repNumber);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRepTap(marker);
    setTimeout(() => setTappedRep(null), 800);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>REP MARKERS</Text>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={styles.svgWrap}
      >
        <Svg width={width} height={height}>
          {/* Track line */}
          <Rect x={0} y={trackY - 1} width={width} height={2} fill="rgba(255,255,255,0.1)" rx={1} />

          {/* Playhead */}
          <Line
            x1={playheadX}
            y1={4}
            x2={playheadX}
            y2={height - 4}
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Rep dots (rendered behind the playhead via order) */}
          {markers.map((m) => {
            const x = (m.timestamp / durationMs) * width;
            const dotColor = qualityColor(m.quality);
            const isActive = tappedRep === m.repNumber;
            return (
              <Circle
                key={m.repNumber}
                cx={x}
                cy={trackY}
                r={isActive ? dotRadius + 2 : dotRadius}
                fill={dotColor}
                stroke={isActive ? '#fff' : 'transparent'}
                strokeWidth={isActive ? 1.5 : 0}
                opacity={isActive ? 1 : 0.85}
              />
            );
          })}
        </Svg>

        {/* Invisible touch targets for each dot */}
        {markers.map((m) => {
          const x = (m.timestamp / durationMs) * width;
          const hitSize = 28;
          return (
            <TouchableOpacity
              key={m.repNumber}
              onPress={() => handleRepTap(m)}
              style={[
                styles.dotHit,
                {
                  left: x - hitSize / 2,
                  top: trackY - hitSize / 2,
                  width: hitSize,
                  height: hitSize,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Tooltip */}
      {tappedRep !== null && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>Rep {tappedRep}</Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Excellent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>Good</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
          <Text style={styles.legendText}>Poor</Text>
        </View>
        <Text style={styles.legendCount}>{markers.length} reps</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  svgWrap: {
    width: '100%',
    position: 'relative',
    height: 44,
  },
  dotHit: {
    position: 'absolute',
  },
  tooltip: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tooltipText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 11,
    color: colors.bg,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  legendCount: {
    flex: 1,
    textAlign: 'right',
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
