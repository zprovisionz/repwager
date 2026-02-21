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

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Modal } from 'react-native';
import { Zap, Star } from 'lucide-react-native';
import { colors, radius } from '@/lib/theme';
import { getLevelInfo } from '@/lib/levelSystem';
import type { Level } from '@/lib/levelSystem';

interface LevelUpAnimationProps {
  visible: boolean;
  level: Level;
  previousLevel: Level;
  xp: number;
  onDismiss?: () => void;
}

export function LevelUpAnimation({
  visible,
  level,
  previousLevel,
  xp,
  onDismiss,
}: LevelUpAnimationProps) {
  const scaleAnim = new Animated.Value(0);
  const opacityAnim = new Animated.Value(1);
  const levelInfo = getLevelInfo(level);

  useEffect(() => {
    if (!visible) {
      scaleAnim.setValue(0);
      return;
    }

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
});
