// Fleet24 Design Tokens: "Premium Neighbourhood Food Delivery"
// Inspired by editorial, image-rich coffee & food experience ("Brew & Bliss" reference)
export const colors = {
  background: '#F7F6F0',      // Warm cream/ivory background
  surface: '#FFFFFF',         // Cards, sheets, inputs
  surfaceElevated: '#FFFFFF', // Elevated cards
  surfaceMuted: '#EFEFE8',    // Very soft neutral container
  surfaceGreen: '#EAF2EC',    // Soft pale forest green pill/badge background
  primary: '#28543F',         // Signature deep forest green
  primaryDark: '#193B2C',     // Dark forest green for active/pressed states
  primaryPressed: '#193B2C',  // Deep forest green for press state
  accent: '#D99058',          // Warm terracotta / promotional accent
  accentLight: '#F5EEE6',     // Muted warm status background
  textPrimary: '#202923',     // Rich dark charcoal heading/body text
  textSecondary: '#747B74',   // Refined slate secondary text
  textMuted: '#9BA39D',       // Light secondary
  border: '#E7E5DB',          // Subtle divider/outline
  borderLight: '#F0EFE8',
  foodAccent: '#D99058',      // Warm terracotta / food badge
  success: '#28543F',         // Forest green success
  warning: '#D99058',         // Amber/terracotta pending
  error: '#C74740',           // Crimson error / cancellation
  veg: '#28543F',             // Veg indicator green
  nonVeg: '#C74740',          // Non-veg indicator red
  cardShadow: 'rgba(32, 41, 35, 0.05)',
  cardShadowMedium: 'rgba(32, 41, 35, 0.08)',
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
