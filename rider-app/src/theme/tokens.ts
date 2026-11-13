// Fleet24 Rider Design Tokens: "Premium Map-First Logistics UI"
export const colors = {
  // Brand Backgrounds
  background: '#F7F6F0',       // Warm Ivory / Cream
  backgroundDark: '#121915',   // Deep Charcoal for map/overlay backdrop
  surface: '#FFFFFF',          // Cards, sheets, modals
  surfaceElevated: '#FFFFFF',  // Floating bottom sheets
  surfaceMuted: '#EFEFE8',     // Muted dividers / badges
  surfaceGreen: '#EAF2EC',     // Soft Sage for highlights/badges
  surfaceDark: '#193B2C',      // Deep Pine header & high-contrast cards

  // Primary Brand
  primary: '#28543F',          // Forest Green (Primary action buttons)
  primaryDark: '#193B2C',      // Deep Pine (Headers & pressed states)
  primaryPressed: '#142E23',   // Deepest Pine for active press
  primaryLight: '#EAF2EC',     // Soft Sage

  // Accents & Indicators
  accent: '#D99058',           // Warm Terracotta (attention, timers, pickup)
  accentLight: '#FBF3EC',      // Soft Terracotta container
  accentDark: '#B36B34',       // Deep Terracotta

  // Status & Telemetry
  online: '#2E8540',           // Bright Emerald Green (Active / Online)
  onlineGlow: 'rgba(46, 133, 64, 0.25)',
  offline: '#8A928C',          // Slate Gray (Offline)
  offlineLight: '#E8EAE8',     // Muted Offline background
  busy: '#D99058',             // In-flight active delivery

  // Alerts
  success: '#28543F',
  successLight: '#EBF4EE',
  warning: '#D99058',
  warningLight: '#FDF7F2',
  error: '#C74740',            // Crimson Red for rejections & cancellations
  errorLight: '#FDF2F1',

  // Typography
  textPrimary: '#202923',      // Dark Charcoal
  textSecondary: '#667067',    // Refined Muted Gray
  textMuted: '#9BA39D',        // Light Secondary
  textWhite: '#FFFFFF',        // High contrast on dark surfaces
  textOnline: '#1F6131',

  // Dividers & Borders
  border: '#E5E4DC',
  borderLight: '#F0EFE8',
  borderDark: '#2C3A31',

  // Shadows
  cardShadow: 'rgba(32, 41, 35, 0.08)',
  cardShadowMedium: 'rgba(32, 41, 35, 0.14)',
  sheetShadow: 'rgba(25, 59, 44, 0.18)',
};

export const typography = {
  headerTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.textPrimary,
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
  metricLarge: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  metricMedium: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  button: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
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
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  full: 9999,
};

