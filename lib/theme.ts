export const colors = {
  primary: '#00D4FF',
  primaryDark: '#009AB8',
  primaryLight: '#66E5FF',

  secondary: '#FF2D78',
  secondaryDark: '#C41F5A',
  secondaryLight: '#FF7AAB',

  accent: '#FFB800',
  accentDark: '#CC9200',
  accentLight: '#FFD566',

  success: '#00FF88',
  successDark: '#00C266',
  successLight: '#66FFB5',

  warning: '#FF8C00',
  warningDark: '#CC7000',
  warningLight: '#FFB84D',

  error: '#FF3B30',
  errorDark: '#CC2E25',
  errorLight: '#FF7870',

  bg: '#080C14',
  bgCard: '#0D1424',
  bgElevated: '#131D30',
  bgHighlight: '#1A2740',

  border: '#1E2E45',
  borderSubtle: '#142033',

  text: '#F0F4FF',
  textSecondary: '#8A9DC0',
  textMuted: '#4A5E7A',
  textInverse: '#080C14',
};

export const typography = {
  fontDisplay: 'Orbitron-Bold',
  fontDisplayMedium: 'Orbitron-Medium',
  fontBody: 'Inter-Regular',
  fontBodyMedium: 'Inter-Medium',
  fontBodyBold: 'Inter-Bold',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadows = {
  primary: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  secondary: {
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
};
