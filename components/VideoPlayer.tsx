import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';

interface VideoPlayerProps {
  uri: string | null;
  maskingEnabled?: boolean;
  maskColor?: string;
  onTimeUpdate?: (ms: number) => void;
  seekToMs?: number | null; // Set to a timestamp to trigger an external seek
}

const SPEEDS = [0.5, 1, 1.5, 2];
const FRAME_MS = 33; // ~30fps

export default function VideoPlayer({
  uri,
  maskingEnabled = false,
  maskColor = 'rgba(0, 212, 255, 0.35)',
  onTimeUpdate,
  seekToMs,
}: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1); // 1x default
  const [scrubberWidth, setScrubberWidth] = useState(1);

  const currentSpeed = SPEEDS[speedIndex];

  // External seek trigger
  useEffect(() => {
    if (seekToMs != null) {
      seekTo(seekToMs);
    }
  }, [seekToMs]);

  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      setIsPlaying(status.isPlaying);
      setPositionMs(status.positionMillis);
      if (status.durationMillis) setDurationMs(status.durationMillis);
      onTimeUpdate?.(status.positionMillis);
    },
    [onTimeUpdate]
  );

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const seekTo = async (ms: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(ms, durationMs));
    await videoRef.current.setPositionAsync(clamped);
    setPositionMs(clamped);
    onTimeUpdate?.(clamped);
  };

  const stepFrame = async (direction: 1 | -1) => {
    await seekTo(positionMs + direction * FRAME_MS);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cycleSpeed = async () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    await videoRef.current?.setRateAsync(SPEEDS[next], true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Scrubber pan responder
  const scrubberPan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / scrubberWidth));
      seekTo(ratio * durationMs);
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / scrubberWidth));
      seekTo(ratio * durationMs);
    },
  });

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  if (!uri) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>No video available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video + overlay */}
      <TouchableOpacity activeOpacity={1} onPress={togglePlayPause} style={styles.videoWrap}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          shouldPlay={false}
          isLooping={false}
        />
        {/* Privacy masking overlay */}
        {maskingEnabled && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: maskColor }]} pointerEvents="none" />
        )}
        {/* Play/pause center icon */}
        {!isPlaying && (
          <View style={styles.playIconWrap} pointerEvents="none">
            <Play size={40} color="#fff" fill="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Scrubber */}
      <View
        style={styles.scrubberRow}
        onLayout={(e: LayoutChangeEvent) => setScrubberWidth(e.nativeEvent.layout.width)}
        {...scrubberPan.panHandlers}
      >
        <View style={styles.scrubberTrack}>
          <View style={[styles.scrubberFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.scrubberThumb, { left: `${progress * 100}%` as any }]} />
        </View>
      </View>

      {/* Controls row */}
      <View style={styles.controlsRow}>
        {/* Frame back */}
        <TouchableOpacity onPress={() => stepFrame(-1)} style={styles.iconBtn}>
          <SkipBack size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
          {isPlaying
            ? <Pause size={22} color={colors.bg} fill={colors.bg} />
            : <Play size={22} color={colors.bg} fill={colors.bg} />}
        </TouchableOpacity>

        {/* Frame forward */}
        <TouchableOpacity onPress={() => stepFrame(1)} style={styles.iconBtn}>
          <SkipForward size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Time */}
        <Text style={styles.time}>{formatTime(positionMs)} / {formatTime(durationMs)}</Text>

        {/* Speed */}
        <TouchableOpacity onPress={cycleSpeed} style={styles.speedBtn}>
          <Text style={styles.speedText}>{currentSpeed}×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Expose seekTo as an imperative handle so RepTimeline can seek
export { VideoPlayer };

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  videoWrap: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  playIconWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  placeholder: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textMuted,
  },
  scrubberRow: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: '#000',
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    position: 'relative',
  },
  scrubberFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    marginLeft: -7,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#000',
    gap: spacing.sm,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  time: {
    flex: 1,
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  speedBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speedText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
