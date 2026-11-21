/**
 * Built-in food photographs and promotional artwork shipped inside the customer app (customer-app/assets/home/<key>.webp)
 * and the admin dashboard (public/home-art/<key>.webp). Content refers to them as `asset:<key>`;
 * they are the default until admin uploads a replacement (`media:<id>`).
 */
export const HOME_ART_KEYS = [
  // dishes
  'biryani', 'thali', 'main-course', 'paneer', 'breads', 'starters', 'rolls', 'beverages',
  'pizza', 'burger', 'fried-chicken', 'cookie', 'brownies', 'vanilla-cake', 'chocolate-cake',
  'cream-pastry', 'chocolate-pastry', 'desserts',
  // offer graphics
  'promo-percent', 'promo-bolt', 'promo-feast', 'promo-flash',
  // service shortcuts
  'shortcut-food', 'shortcut-offers', 'shortcut-fast', 'shortcut-orders', 'shortcut-favourites', 'shortcut-veg',
  'shortcut-instant', 'shortcut-dineout', 'shortcut-scenes',
  'tile-biryani', 'tile-main-course', 'tile-rolls', 'tile-beverages',
] as const;

export type HomeArtKey = (typeof HOME_ART_KEYS)[number];

const MEDIA_REF = /^media:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An image reference admin may store: uploaded media, a built-in image, or an http(s) URL. */
export function isImageRef(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (MEDIA_REF.test(value)) return true;
  if (value.startsWith('asset:')) return (HOME_ART_KEYS as readonly string[]).includes(value.slice(6));
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
