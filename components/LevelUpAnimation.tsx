/**
 * Level Up Animation Component
 *
 * Displays a celebratory animation when user levels up
 * Features:
 * - Confetti/particle effects
 * - Level number animation
 * - XP progress bar
 * - Automatic dismiss after 3 seconds
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Modal, Dimensions } from 'react-native';
import { Zap, Star } from 'lucide-react-native';
import { colors, radius } from '@/lib/theme';
import { getLevelInfo } from '@/lib/levelSystem';
import type { Level } from '@/lib/levelSystem';

const { width, height } = Dimensions.get('window');

interface Particle {
  id: number;
  left: number;
  color: string;
}

interface LevelUpAnimationProps {
  visible: boolean;
  level: Level;
  previousLevel: Level;
  xp: number;
  onDismiss?: () => void;
}

/**
 * Individual confetti particle that falls from top
 */
function ConfettiParticle({ particle }: { particle: Particle }) {
  const fallAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.random() * 100;
    const duration = 1800 + Math.random() * 400;

    setTimeout(() => {
      Animated.parallel([
        // Fall animation
        Animated.timing(fallAnim, {
          toValue: height,
          duration,
          useNativeDriver: true,
        }),
        // Rotation animation
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          })
        ),
        // Sway animation
        Animated.sequence([
          Animated.timing(swayAnim, { toValue: 1, duration: duration / 2, useNativeDriver: true }),
          Animated.timing(swayAnim, { toValue: -1, duration: duration / 2, useNativeDriver: true }),
        ]),
      ]).start();
    }, delay);
  }, [fallAnim, rotateAnim, swayAnim]);

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: particle.left,
          transform: [
            { translateY: fallAnim },
            {
              translateX: swayAnim.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-20, 0, 20],
              }),
            },
            {
              rotate: rotateAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
          opacity: fallAnim.interpolate({
            inputRange: [0, height * 0.8, height],
            outputRange: [1, 1, 0],
          }),
        },
      ]}
    >
      <View style={[styles.particleInner, { backgroundColor: particle.color }]} />
    </Animated.View>
  );
}

export function LevelUpAnimation({
  visible,
  level,
  previousLevel,
  xp,
  onDismiss,
}: LevelUpAnimationProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const levelInfo = getLevelInfo(level);

  // Generate confetti particles
  const generateParticles = () => {
    const colors_list = [colors.primary, colors.accent, colors.secondary, colors.success];
    const newParticles: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: particleIdRef.current++,
      left: Math.random() * width,
      color: colors_list[Math.floor(Math.random() * colors_list.length)],
    }));
    setParticles(newParticles);
  };

  useEffect(() => {
    if (!visible) {
      scaleAnim.setValue(0);
      setParticles([]);
      return;
    }

    // Generate confetti when modal appears
    generateParticles();

    // Animate in
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      Animated.delay(2200),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      scaleAnim.setValue(0);
      opacityAnim.setValue(1);
      setParticles([]);
      onDismiss?.();
    });
  }, [visible, scaleAnim, opacityAnim, onDismiss]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      pointerEvents="none"
    >
      <View style={styles.container}>
        {/* Confetti particles */}
        {particles.map((particle) => (
          <ConfettiParticle key={particle.id} particle={particle} />
        ))}
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Glow effect */}
          <View style={[styles.glow, { backgroundColor: levelInfo.color }]} />

          {/* Main card */}
          <View style={styles.card}>
            {/* Top badges */}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, styles.badgeLeft]}>
                <Zap size={16} color={colors.primary} />
                <Text style={styles.badgeText}>LEVEL UP</Text>
              </View>
              <View style={[styles.badge, styles.badgeRight]}>
                <Text style={styles.badgeText}>+50 XP</Text>
                <Star size={16} color={colors.accent} />
              </View>
            </View>

            {/* Level display */}
            <View style={styles.levelSection}>
              <Text style={styles.levelLabel}>LEVEL</Text>
              <View style={styles.levelNumbers}>
                <Text style={styles.levelNumber}>{previousLevel}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={[styles.levelNumber, { color: levelInfo.color }]}>
                  {level}
                </Text>
              </View>
            </View>

            {/* Title and description */}
            <View style={styles.infoSection}>
              <Text style={styles.title}>{levelInfo.title}</Text>
              <Text style={styles.description}>{levelInfo.description}</Text>
            </View>

            {/* Progress indicator */}
            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>Total XP: {xp.toLocaleString()}</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: levelInfo.color, width: '100%' },
                  ]}
                />
              </View>
            </View>

            {/* Bottom accent */}
            <View
              style={[styles.accent, { backgroundColor: levelInfo.color }]}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  content: {
    width: 320,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 400,
    borderRadius: 160,
    opacity: 0.15,
    top: -40,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 28,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  badge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeLeft: {
    justifyContent: 'flex-start',
  },
  badgeRight: {
    justifyContent: 'flex-end',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 0.5,
  },
  levelSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  levelNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  levelNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 56,
  },
  arrow: {
    fontSize: 32,
    color: colors.textSecondary,
  },
  infoSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  progressSection: {
    marginTop: 16,
  },
  progressLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.bgHighlight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  accent: {
    height: 3,
    marginTop: 16,
    marginHorizontal: -28,
    marginBottom: -28,
  },
  particle: {
    position: 'absolute',
    top: -20,
    width: 12,
    height: 12,
  },
  particleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
