/**
 * Home uses the same forest green as the Browse Restaurants button.
 * Shared tokens keep the customer screens and Home palette in sync.
 */
import { colors } from './tokens';

export const home = {
  headerTop: colors.primary,
  headerMid: colors.primary,
  headerBottom: '#397658',
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.72)',
  card: '#1B422F',
  cardBorder: 'rgba(255,255,255,0.16)',
  cta: colors.citrusLime,
  onCta: colors.primaryDark,
  accent: colors.primary,
  accentSoft: colors.surfaceGreen,
  badge: '#3F7453',
  sheet: '#FFFFFF',
  page: '#FFFFFF',
  pill: colors.surfaceMuted,
  ink: colors.textPrimary,
  muted: colors.textSecondary,
  hairline: colors.border,
  veg: '#0F8A3C',
  heart: '#E5294F',
  radius: 16,
  gutter: 8,
} as const;

/** Bottom shade that keeps white offer text readable on any food photo. */
export const photoShade = 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)';

export const headerGradient = 'linear-gradient(155deg, #193B2C 0%, #24533F 48%, #397658 100%)';
