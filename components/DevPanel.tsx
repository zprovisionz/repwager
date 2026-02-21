/**
 * Dev Panel Component
 *
 * Floating panel (bottom-right) with development controls
 * Only visible when __DEV__ is true
 * Features:
 * - Seed test users
 * - Create fake challenges
 * - Toggle auto-finish matches
 * - Toggle manual rep counting
 * - Reset user balance
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Modal } from 'react-native';
import { ChevronUp, Plus, Zap, RotateCcw, Users } from 'lucide-react-native';
import { devModeService } from '@/services/devMode.service';
import { useAuthStore } from '@/stores/authStore';
import { colors, spacing, radius } from '@/lib/theme';

interface DevPanelProps {
  visible?: boolean;
}

export function DevPanel({ visible = true }: DevPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoFinishEnabled, setAutoFinishEnabled] = useState(false);
  const [manualCountEnabled, setManualCountEnabled] = useState(false);
  const { session } = useAuthStore();

  if (!visible || !session) return null;

  const handleSeedData = async () => {
    setIsLoading(true);
    try {
      const ids = await devModeService.seedTestUsers();
      Alert.alert('Success', `Seeded ${ids.length} test users`);
    } catch (error) {
      Alert.alert('Error', 'Failed to seed test users');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    setIsLoading(true);
    try {
      const matchId = await devModeService.createFakeChallenge(
        session.user.id,
        'push_ups',
        5
      );
      if (matchId) {
        Alert.alert('Success', `Created challenge: ${matchId.slice(0, 8)}...`);
      } else {
        Alert.alert('Error', 'Failed to create challenge');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create challenge');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetBalance = async () => {
    Alert.alert(
      'Reset Balance',
      'Reset your balance to $100.00?',
      [
        { text: 'Cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            setIsLoading(true);
            try {
              await devModeService.resetBalance(session.user.id);
              Alert.alert('Success', 'Balance reset to $100.00');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset balance');
              console.error(error);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const toggleAutoFinish = () => {
    setAutoFinishEnabled(!autoFinishEnabled);
    Alert.alert(
      'Auto-Finish',
      autoFinishEnabled ? 'Disabled auto-finish' : 'Enabled auto-finish (fake reps)'
    );
  };

  const toggleManualCount = () => {
    setManualCountEnabled(!manualCountEnabled);
    Alert.alert(
      'Manual Count',
      manualCountEnabled ? 'Disabled manual counting' : 'Enabled manual rep counting'
    );
  };

  return (
    <>
      {/* Collapsed Button */}
      {!isExpanded && (
        <Pressable
          style={[styles.floatingButton, { bottom: 20, right: 20 }]}
          onPress={() => setIsExpanded(true)}
          disabled={isLoading}
        >
          <Zap size={20} color="white" />
        </Pressable>
      )}

      {/* Expanded Panel Modal */}
      <Modal visible={isExpanded} transparent animationType="fade">
        <Pressable
          style={styles.overlay}
          onPress={() => setIsExpanded(false)}
        >
          <Pressable
            style={[styles.panel, { bottom: 20, right: 20 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <Text style={styles.title}>⚡ Dev Tools</Text>
              <Pressable
                onPress={() => setIsExpanded(false)}
                style={styles.closeButton}
              >
                <ChevronUp size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              scrollEnabled
            >
              {/* Seed Button */}
              <DevButton
                icon={<Users size={16} color="white" />}
                label="Seed Test Users"
                description="Create 3 fake profiles"
                onPress={handleSeedData}
                loading={isLoading}
              />

              {/* Create Challenge Button */}
              <DevButton
                icon={<Plus size={16} color="white" />}
                label="Create Challenge"
                description="Auto-accept from test user"
                onPress={handleCreateChallenge}
                loading={isLoading}
              />

              {/* Toggle Auto-Finish */}
              <DevToggle
                label="Auto-Finish Matches"
                value={autoFinishEnabled}
                onToggle={toggleAutoFinish}
              />

              {/* Toggle Manual Count */}
              <DevToggle
                label="Manual Rep Count"
                value={manualCountEnabled}
                onToggle={toggleManualCount}
              />

              {/* Reset Balance */}
              <DevButton
                icon={<RotateCcw size={16} color="white" />}
                label="Reset Balance"
                description="Set to $100.00"
                onPress={handleResetBalance}
                loading={isLoading}
                variant="danger"
              />

              <Text style={styles.footer}>
                Dev mode enabled: {session.user.id.slice(0, 8)}...
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

interface DevButtonProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'danger';
}

function DevButton({
  icon,
  label,
  description,
  onPress,
  loading,
  variant = 'primary',
}: DevButtonProps) {
  return (
    <Pressable
      style={[
        styles.button,
        variant === 'danger' && styles.buttonDanger,
      ]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={styles.buttonContent}>
        {icon}
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.buttonLabel}>{label}</Text>
          {description && (
            <Text style={styles.buttonDescription}>{description}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

interface DevToggleProps {
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}

function DevToggle({ label, value, onToggle }: DevToggleProps) {
  return (
    <Pressable
      style={styles.toggleContainer}
      onPress={() => onToggle(!value)}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <View
        style={[
          styles.toggle,
          value && styles.toggleActive,
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            value && styles.toggleThumbActive,
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 999,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    position: 'absolute',
    width: 300,
    maxHeight: 500,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 12,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  buttonDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  footer: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.6,
  },
});
