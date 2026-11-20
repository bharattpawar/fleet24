/**
 * Home screen palette (navy header, orange accent), tuned against the reference layout.
 * Re-skin Home by changing these values; Home components hardcode no colours.
 */
export const home = {
  headerTop: '#0D163F',
  headerMid: '#10194F',
  headerBottom: '#17266A',
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.72)',
  card: '#1A2869',
  cardBorder: 'rgba(255,255,255,0.16)',
  cta: '#FFD23F',
  onCta: '#1B1E3D',
  accent: '#F36C35',
  accentSoft: '#FFF1EA',
  badge: '#2F5BFF',
  sheet: '#FFFFFF',
  page: '#FFFFFF',
  pill: '#F0F0F5',
  ink: '#202124',
  muted: '#777B83',
  hairline: '#E9E9EB',
  veg: '#0F8A3C',
  heart: '#E5294F',
  radius: 16,
  gutter: 12,
} as const;

/** Bottom shade that keeps white offer text readable on any food photo. */
export const photoShade = 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)';
export const headerGradient = `radial-gradient(120% 60% at 50% 0%, #22337E 0%, ${home.headerMid} 45%, ${home.headerTop} 100%)`;
