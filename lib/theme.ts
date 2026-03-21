/**
 * Back-compat shim — canonical tokens live in `@/constants/*`.
 * Existing imports (`colors`, `typography`, `spacing`, `radius`, `shadows`) keep working.
 */
export { legacyColors as colors } from '@/constants/theme';
export { spacing, radius } from '@/constants/theme';
export { shadows } from '@/constants/shadows';
export { typographyRoles as typography } from '@/constants/typography';
