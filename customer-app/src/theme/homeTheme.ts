/**
 * Home screen palette. One colour per job, as in the reference layout:
 * deep brand for the header/hero, lime for the main call-to-action, white sheet for content.
 * Change these values to re-skin Home; nothing in Home hardcodes a colour elsewhere.
 */
export const home = {
  headerTop: '#173F2F',      // brandDeep
  headerBottom: '#24533F',   // brand
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.78)',
  cta: '#D9F078',            // lime
  onCta: '#173F2F',
  sheet: '#FFFFFF',
  ink: '#1B1E1C',
  muted: '#686B78',
  hairline: '#E9E9EB',
  chip: '#F1F1F3',
  tileBg: '#F4F8E6',
  accent: '#24533F',
  radius: 18,
  gutter: 16,
} as const;

/** Bottom shade that keeps white offer text readable on any food photo. */
export const photoShade = 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.82) 100%)';
