// Fleet24 Restaurant Design Tokens: "Warm Sage & Kitchen Operations UI"
export const colors = {
  // Brand Backgrounds & Surfaces
  background: '#F7F8F6',       // Warm Ivory / Cream base
  backgroundDark: '#121915',   // Deep Charcoal base
  surface: '#FFFFFF',          // Cards, sheets, modals
  surfaceElevated: '#FFFFFF',  // Floating bottom sheets & dialogs
  surfaceMuted: '#F0F2EF',     // Muted dividers, subtle containers
  surfaceGreen: '#EAF3EC',     // Soft Sage for highlights/badges
  surfaceDark: '#193B2C',      // Deep Pine header & high-contrast cards
  surfaceDarkElevated: '#224B39',
  surfaceAmber: '#FFF9E6',     // Warning / Pending highlight
  surfaceWarning: '#FEF3C7',   // Alert banner

  // Primary Brand
  primary: '#064B33',          // Forest Green (Primary action buttons)
  primaryDark: '#193B2C',      // Deep Pine
  primaryPressed: '#142E23',   // Deepest Pine for active press
  primaryLight: '#E2EFDF',     // Soft Sage
  limeAccent: '#D9F078',       // Fleet24 Brand Lime accent

  // Accents & Indicators
  accent: '#E98755',           // Warm Terracotta / Orange
  accentLight: '#FDF3EC',      // Soft Terracotta container
  accentDark: '#B36B34',       // Deep Terracotta

  // Status & Kitchen States
  pending: '#D97706',          // Amber (New order pending acceptance)
  pendingLight: '#FEF3C7',
  pendingDark: '#92400E',
  confirmed: '#2563EB',        // Blue (Order accepted)
  confirmedLight: '#DBEAFE',
  confirmedDark: '#1E40AF',
  preparing: '#7C3AED',        // Purple (Cooking / In Kitchen)
  preparingLight: '#EDE9FE',
  preparingDark: '#5B21B6',
  ready: '#059669',            // Emerald Green (Food ready for pickup)
  readyLight: '#D1FAE5',
  readyDark: '#065F46',
  delivered: '#4B5563',        // Neutral Gray (Completed)
  deliveredLight: '#F3F4F6',
  deliveredDark: '#1F2937',
  rejected: '#DC2626',         // Red (Cancelled / Rejected)
  rejectedLight: '#FEE2E2',
  rejectedDark: '#991B1B',

  // Alert & Switch
  online: '#059669',           // Accepting orders
  onlineLight: '#D1FAE5',
  offline: '#9CA3AF',          // Paused / Not accepting orders
  offlineLight: '#F3F4F6',

  // Dietary indicators
  vegGreen: '#16A34A',
  vegGreenLight: '#DCFCE7',
  nonVegRed: '#DC2626',
  nonVegRedLight: '#FEE2E2',

  // Typography (WCAG AA compliant contrast)
  textPrimary: '#202622',      // Dark Forest Charcoal on Light surface (Contrast > 12:1)
  textSecondary: '#4B5563',    // Slate Neutral Secondary (Contrast > 5.5:1)
  textMuted: '#6B7280',        // Subtle / Disabled labels
  textWhite: '#FFFFFF',        // High contrast on dark surfaces
  textLime: '#D9F078',
  textAmber: '#92400E',
  textGreen: '#065F46',
  textRed: '#991B1B',

  // Dividers & Borders
  border: '#E3E7E2',
  borderLight: '#F3F4F6',
  borderMedium: '#D1D5DB',
  borderDark: '#2C3A31',

  // Shadows
  cardShadow: 'rgba(23, 33, 27, 0.06)',
  sheetShadow: 'rgba(25, 59, 44, 0.15)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

export const minTouchTarget = 44;

export const shadows = {
  card: {
    shadowColor: '#17211B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#17211B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  kpi: {
    shadowColor: '#17211B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  modal: {
    shadowColor: '#17211B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const typography = {
  screenTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  captionBold: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.textSecondary,
  },
  badge: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.4,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600' as const,
  },
};
