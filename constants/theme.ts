/**
 * Canonical design tokens — nested palette (source of truth).
 * Legacy flat `colors` is derived for existing `@/lib/theme` imports.
 */
export const Colors = {
  bg: {
    base: '#0A0A0C',
    card: '#111115',
    elevated: '#17171D',
  },
  accent: {
    cyan: '#00C4D4',
    cyanDim: 'rgba(0,196,212,0.1)',
    amber: '#F0A030',
    amberDim: 'rgba(240,160,48,0.11)',
    green: '#1DB87A',
    greenDim: 'rgba(29,184,122,0.1)',
    red: '#E24B4A',
    redDim: 'rgba(226,75,74,0.1)',
    purple: '#8B7FE8',
    purpleDim: 'rgba(139,127,232,0.1)',
    fire: '#D85A30',
    pink: '#FF2D78',
    pinkDim: 'rgba(255,45,120,0.12)',
  },
  text: {
    primary: '#EEEEF0',
    secondary: '#7A7A85',
    muted: '#4A4A55',
  },
  border: {
    subtle: 'rgba(255,255,255,0.07)',
    mid: 'rgba(255,255,255,0.13)',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const legacyColors = {
  primary: Colors.accent.cyan,
  primaryDark: '#0094A3',
  primaryLight: '#33D6E8',
  secondary: Colors.accent.pink,
  secondaryDark: '#C41F5A',
  secondaryLight: '#FF7AAB',
  accent: Colors.accent.amber,
  accentDark: '#C88226',
  accentLight: '#F5C06A',
  success: Colors.accent.green,
  successDark: '#159065',
  successLight: '#4DD4A0',
  warning: '#FF8C00',
  warningDark: '#CC7000',
  warningLight: '#FFB84D',
  error: Colors.accent.red,
  errorDark: '#B83C3B',
  errorLight: '#E8706F',
  bg: Colors.bg.base,
  bgCard: Colors.bg.card,
  bgElevated: Colors.bg.elevated,
  bgHighlight: '#1E1E26',
  border: '#2A2A32',
  borderSubtle: Colors.border.subtle,
  text: Colors.text.primary,
  textSecondary: Colors.text.secondary,
  textMuted: Colors.text.muted,
  textInverse: Colors.bg.base,
};

export type LegacyColors = typeof legacyColors;
