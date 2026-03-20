import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';
import type { RepEvent } from '@/types/database';

interface RepTimelineProps {
  repEvents: RepEvent[];
  durationMs: number;
  currentPositionMs: number;
  onSeek: (positionMs: number) => void;
  label?: string;
  tintColor?: string;
}

interface TooltipInfo {
  event: RepEvent;
  x: number;
}

export default function RepTimeline({
  repEvents,
  durationMs,
  currentPositionMs,
  onSeek,
  label,
  tintColor = colors.primary,
}: RepTimelineProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const safeWidth = trackWidth > 0 ? trackWidth : 1;
  const progress = durationMs > 0 ? Math.min(currentPositionMs / durationMs, 1) : 0;

  const xToMs = useCallback(
    (x: number) => {
      const clamped = Math.max(0, Math.min(x, safeWidth));
      return Math.round((clamped / safeWidth) * durationMs);
    },
    [safeWidth, durationMs]
  );

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      onSeek(xToMs(evt.nativeEvent.locationX));
    },
    onPanResponderMove: (evt) => {
      onSeek(xToMs(evt.nativeEvent.locationX));
    },
    onPanResponderRelease: () => setTooltip(null),
  });

  function handleLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  function handleTickPress(event: RepEvent, tickX: number) {
    onSeek(event.timestamp);
    setTooltip({ event, x: tickX });
    setTimeout(() => setTooltip(null), 2500);
  }

  const thumbX = progress * safeWidth;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.trackWrapper} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={[styles.track, { backgroundColor: colors.border }]} />
        <View style={[styles.progress, { width: `${progress * 100}%`, backgroundColor: tintColor }]} />

        {trackWidth > 0 &&
          repEvents.map((evt, i) => {
            const tickX = durationMs > 0 ? (evt.timestamp / durationMs) * trackWidth : 0;
            const tickColor = evt.valid ? colors.success : colors.error;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.tick,
                  {
                    left: tickX - 2,
                    backgroundColor: tickColor,
                    height: evt.valid ? 14 : 10,
                    marginTop: evt.valid ? -3 : 0,
                  },
                ]}
                onPress={() => handleTickPress(evt, tickX)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              />
            );
          })}

        <View
          style={[
            styles.thumb,
            { left: thumbX - 7, backgroundColor: tintColor },
          ]}
          pointerEvents="none"
        />
      </View>

      {tooltip && trackWidth > 0 && (
        <View
          style={[
            styles.tooltip,
            { left: Math.max(0, Math.min(tooltip.x - 60, trackWidth - 130)) },
          ]}
        >
          <Text style={styles.tooltipRep}>Rep #{tooltip.event.rep}</Text>
          <Text style={styles.tooltipAngle}>
            Elbow: {Math.round(tooltip.event.elbowAngle)}&deg;
          </Text>
          <Text style={styles.tooltipAngle}>
            Shoulder: {Math.round(tooltip.event.shoulderAngle)}&deg;
          </Text>
          {tooltip.event.formNote && (
            <Text style={styles.tooltipNote}>{tooltip.event.formNote}</Text>
          )}
          <View
            style={[
              styles.tooltipBadge,
              {
                backgroundColor: tooltip.event.valid
                  ? colors.success + '22'
                  : colors.error + '22',
                borderColor: tooltip.event.valid ? colors.success : colors.error,
              },
            ]}
          >
            <Text
              style={[
                styles.tooltipBadgeText,
                { color: tooltip.event.valid ? colors.success : colors.error },
              ]}
            >
              {tooltip.event.valid ? 'VALID' : 'INVALID'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatMs(currentPositionMs)}</Text>
        <Text style={styles.repCount}>
          {repEvents.filter((e) => e.valid).length}/{repEvents.length} valid
        </Text>
        <Text style={styles.timeText}>{formatMs(durationMs)}</Text>
      </View>
    </View>
  );
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  trackWrapper: {
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
  },
  progress: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  tick: {
    position: 'absolute',
    width: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    top: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  tooltip: {
    position: 'absolute',
    top: 22,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 130,
    gap: 2,
    zIndex: 10,
  },
  tooltipRep: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: colors.text,
  },
  tooltipAngle: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textSecondary,
  },
  tooltipNote: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  tooltipBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  tooltipBadgeText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  timeText: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
  },
  repCount: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
