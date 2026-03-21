import type { TextStyle } from 'react-native';

/** Loaded font family names — must match useFonts() in app/_layout.tsx */
export const fontFamilies = {
  barlowCondensedBlack: 'BarlowCondensed_900Black',
  barlowCondensedBold: 'BarlowCondensed_700Bold',
  barlowCondensedSemiBold: 'BarlowCondensed_600SemiBold',
  barlowRegular: 'Barlow_400Regular',
  barlowMedium: 'Barlow_500Medium',
  barlowBold: 'Barlow_700Bold',
} as const;

/** Default typography roles — Barlow for display, Barlow for UI body */
export const typographyRoles = {
  fontDisplay: fontFamilies.barlowCondensedBold,
  fontDisplayMedium: fontFamilies.barlowCondensedSemiBold,
  fontBody: fontFamilies.barlowRegular,
  fontBodyMedium: fontFamilies.barlowMedium,
  fontBodyBold: fontFamilies.barlowBold,
  /** Primary CTAs — Barlow Condensed 900, ALL CAPS in components */
  fontButton: fontFamilies.barlowCondensedBlack,
} as const;

export type BarlowTextVariant = 'display' | 'displayMedium' | 'body' | 'bodyMedium' | 'bodyBold' | 'label';

export const barlowVariantStyles: Record<BarlowTextVariant, TextStyle> = {
  display: {
    fontFamily: fontFamilies.barlowCondensedBold,
    fontSize: 28,
    letterSpacing: 0.5,
  },
  displayMedium: {
    fontFamily: fontFamilies.barlowCondensedSemiBold,
    fontSize: 20,
    letterSpacing: 0.4,
  },
  body: {
    fontFamily: fontFamilies.barlowRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: fontFamilies.barlowMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyBold: {
    fontFamily: fontFamilies.barlowBold,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    fontFamily: fontFamilies.barlowCondensedSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
};
