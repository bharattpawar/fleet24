// Fleet24 Design Tokens: "Premium Clean Fleet24 Brand System"
export const colors = {
  background: '#F7F6F0',      // Warm Ivory / Cream background
  surface: '#FFFFFF',         // Cards, sheets, inputs
  surfaceElevated: '#FFFFFF', // Elevated cards
  surfaceMuted: '#EFEFE8',    // Very soft neutral container
  surfaceGreen: '#EAF2EC',    // Soft pale forest green pill/badge background
  surfaceLime: '#F3FCD0',     // Soft lime tint for highlights
  primary: '#24533F',         // Signature Forest Green
  primaryDark: '#193B2C',     // Dark forest green for active/pressed states
  primaryPressed: '#132C21',  // Deep forest green for press state
  citrusLime: '#D9F078',      // Fleet24 Citrus Lime
  limeAccent: '#D9F078',      // Fleet24 Lime accent
  accent: '#E98755',          // Warm Terracotta / food accent
  accentLight: '#FDF3EC',     // Soft terracotta tint
  charcoal: '#17211B',        // Signature Charcoal
  textPrimary: '#17211B',     // Signature Charcoal text
  textSecondary: '#6B7280',   // Refined slate secondary text
  textMuted: '#9CA3AF',       // Light secondary
  border: '#E8E6DD',          // Subtle divider/outline
  borderLight: '#F2F1EA',
  foodAccent: '#E98755',      // Warm terracotta / food badge
  success: '#24533F',         // Forest green success
  warning: '#E98755',         // Terracotta / amber pending
  error: '#DC2626',           // Crimson error / cancellation
  veg: '#24533F',             // Veg indicator forest green
  nonVeg: '#DC2626',          // Non-veg indicator red
  dockDark: '#17211B',        // Floating dark navigation dock
  cardShadow: 'rgba(23, 33, 27, 0.05)',
  cardShadowMedium: 'rgba(23, 33, 27, 0.08)',
};

export const typography = {
  screenTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bodySecondary: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  priceLarge: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: colors.textPrimary,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
  full: 9999,
};

export const exploreColors = {
  background: '#FAF5EF',
  surface: '#FFFCFA',
  green: '#064B33',
  ink: '#102019',
  secondary: '#535D67',
  border: '#DDD7CF',
  tint: '#E2EFDF',
};
