/** Built-in illustrations (public/home-art). Keep in sync with backend/src/restaurants/home-art.ts. */
export const HOME_ART = [
  { key: 'biryani', label: 'Biryani' },
  { key: 'thali', label: 'Thali' },
  { key: 'main-course', label: 'Main course' },
  { key: 'paneer', label: 'Paneer' },
  { key: 'breads', label: 'Breads' },
  { key: 'starters', label: 'Starters' },
  { key: 'rolls', label: 'Rolls' },
  { key: 'beverages', label: 'Beverages' },
  { key: 'pizza', label: 'Pizza' },
  { key: 'burger', label: 'Burger & fries' },
  { key: 'fried-chicken', label: 'Fried chicken' },
  { key: 'cookie', label: 'Cookies' },
  { key: 'brownies', label: 'Brownies' },
  { key: 'vanilla-cake', label: 'Vanilla cake' },
  { key: 'chocolate-cake', label: 'Chocolate cake' },
  { key: 'cream-pastry', label: 'Cream pastry' },
  { key: 'chocolate-pastry', label: 'Chocolate pastry' },
  { key: 'desserts', label: 'Desserts' },
  { key: 'promo-percent', label: 'Percent badge' },
  { key: 'promo-bolt', label: 'Lightning' },
  { key: 'promo-feast', label: 'Feast flame' },
  { key: 'promo-flash', label: 'Flash timer' },
  { key: 'shortcut-food', label: 'Food (burger)' },
  { key: 'shortcut-offers', label: 'Offers tag' },
  { key: 'shortcut-fast', label: 'Fast (bolt)' },
  { key: 'shortcut-orders', label: 'Orders bag' },
  { key: 'shortcut-favourites', label: 'Favourites heart' },
  { key: 'shortcut-veg', label: 'Veg mark' },
] as const;

export type HomeArtKey = (typeof HOME_ART)[number]['key'];

const HINTS: Array<[RegExp, HomeArtKey]> = [
  [/biryani|pulao/i, 'biryani'], [/thali|combo/i, 'thali'], [/paneer/i, 'paneer'],
  [/bread|naan|roti|paratha|kulcha/i, 'breads'], [/starter|tikka|kebab|snack/i, 'starters'],
  [/roll|wrap|kathi/i, 'rolls'], [/beverage|drink|shake|coffee|tea|chai|juice/i, 'beverages'],
  [/pizza/i, 'pizza'], [/burger/i, 'burger'], [/chicken/i, 'fried-chicken'], [/cookie/i, 'cookie'],
  [/brownie/i, 'brownies'], [/cake|bakery/i, 'chocolate-cake'], [/pastry/i, 'cream-pastry'],
  [/dessert|sweet/i, 'desserts'], [/main|curry|gravy|dal/i, 'main-course'],
];

export function artFor(name: string): HomeArtKey {
  return HINTS.find(([pattern]) => pattern.test(name))?.[1] ?? 'thali';
}
