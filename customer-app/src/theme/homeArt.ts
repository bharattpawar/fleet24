/**
 * Built-in Home illustrations (original artwork drawn in tools/home-art, rendered to WebP).
 * Admin content refers to them as `asset:<key>`; they are also the fallback whenever an
 * uploaded photo is missing or fails to load. Keep keys in sync with backend/src/restaurants/home-art.ts.
 */
export const HOME_ART = {
  'beverages': require('../../assets/home/beverages.webp'),
  'biryani': require('../../assets/home/biryani.webp'),
  'breads': require('../../assets/home/breads.webp'),
  'brownies': require('../../assets/home/brownies.webp'),
  'burger': require('../../assets/home/burger.webp'),
  'chocolate-cake': require('../../assets/home/chocolate-cake.webp'),
  'chocolate-pastry': require('../../assets/home/chocolate-pastry.webp'),
  'cookie': require('../../assets/home/cookie.webp'),
  'cream-pastry': require('../../assets/home/cream-pastry.webp'),
  'desserts': require('../../assets/home/desserts.webp'),
  'fried-chicken': require('../../assets/home/fried-chicken.webp'),
  'main-course': require('../../assets/home/main-course.webp'),
  'paneer': require('../../assets/home/paneer.webp'),
  'pizza': require('../../assets/home/pizza.webp'),
  'promo-bolt': require('../../assets/home/promo-bolt.webp'),
  'promo-feast': require('../../assets/home/promo-feast.webp'),
  'promo-flash': require('../../assets/home/promo-flash.webp'),
  'promo-percent': require('../../assets/home/promo-percent.webp'),
  'rolls': require('../../assets/home/rolls.webp'),
  'shortcut-fast': require('../../assets/home/shortcut-fast.webp'),
  'shortcut-favourites': require('../../assets/home/shortcut-favourites.webp'),
  'shortcut-food': require('../../assets/home/shortcut-food.webp'),
  'shortcut-offers': require('../../assets/home/shortcut-offers.webp'),
  'shortcut-orders': require('../../assets/home/shortcut-orders.webp'),
  'shortcut-veg': require('../../assets/home/shortcut-veg.webp'),
  'starters': require('../../assets/home/starters.webp'),
  'thali': require('../../assets/home/thali.webp'),
  'vanilla-cake': require('../../assets/home/vanilla-cake.webp'),
} as const;

export type HomeArtKey = keyof typeof HOME_ART;
