import type { ImageSourcePropType } from 'react-native';
import { API_BASE_URL } from '../api/client';
import { HOME_ART, HomeArtKey } from '../theme/homeArt';

/**
 * Turns an admin image reference into something <Image> can show.
 *   media:<id>   uploaded by admin → served by the API (immutable URL, safe to cache)
 *   asset:<key>  built-in image bundled with the app
 *   http(s)://…  any other image URL
 * Returns null when there is nothing usable.
 */
export function resolveImage(ref: string | null | undefined): ImageSourcePropType | null {
  if (!ref) return null;
  if (ref.startsWith('media:')) return { uri: `${API_BASE_URL}/public/media/${ref.slice(6)}` };
  if (ref.startsWith('asset:')) {
    const key = ref.slice(6) as HomeArtKey;
    return HOME_ART[key] ?? null;
  }
  if (/^https?:\/\//i.test(ref)) return { uri: ref };
  return null;
}

const DISH_HINTS: Array<[RegExp, HomeArtKey]> = [
  [/biryani|pulao/i, 'biryani'],
  [/thali|combo|meal/i, 'thali'],
  [/paneer/i, 'paneer'],
  [/bread|naan|roti|paratha|kulcha/i, 'breads'],
  [/starter|tikka|kebab|snack|chaat|tandoor/i, 'starters'],
  [/roll|wrap|kathi|frank/i, 'rolls'],
  [/beverage|drink|shake|coffee|tea|chai|juice|lassi/i, 'beverages'],
  [/pizza/i, 'pizza'],
  [/burger/i, 'burger'],
  [/chicken|fried/i, 'fried-chicken'],
  [/cookie|biscuit/i, 'cookie'],
  [/brownie/i, 'brownies'],
  [/cake|bakery/i, 'chocolate-cake'],
  [/pastry/i, 'cream-pastry'],
  [/dessert|sweet|mithai|ice cream/i, 'desserts'],
  [/main|curry|gravy|north indian|dal/i, 'main-course'],
];

/** A fitting built-in image for a restaurant/dish/category name, used only as a fallback. */
export function fallbackArt(...names: Array<string | null | undefined>): HomeArtKey {
  for (const name of names) {
    if (!name) continue;
    const hit = DISH_HINTS.find(([pattern]) => pattern.test(name));
    if (hit) return hit[1];
  }
  return 'thali';
}
