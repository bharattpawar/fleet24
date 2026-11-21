import type { OutletSummary } from '../components/RestaurantCard';

/** Section shapes returned by GET /public/customer-home. Everything here is edited by admin. */
export type RailFilter = 'all' | 'offers' | 'fast' | 'offers100' | 'fast10';

export interface FeedDish {
  id: string;
  name: string;
  imageUrl: string | null;
  isVeg?: boolean;
  effectivePrice: string;
  finalPrice?: string;
}

export interface FeedCard {
  outlet: OutletSummary;
  dish?: FeedDish;
}

export interface FeedTarget {
  type: 'category' | 'restaurant' | 'outlet' | 'dish';
  id: string;
  title?: string;
  subtitle?: string;
  image?: string;
  alt?: string;
  /** Category name, for category tiles. */
  name?: string;
  cards?: FeedCard[];
}

export type ShortcutAction = 'food' | 'offers' | 'fast' | 'veg' | 'favourites' | 'orders' | 'profile' | 'instant' | 'dineout' | 'scenes';
export type ComingSoonFeature = 'instant' | 'dineout' | 'scenes';

export interface FeedShortcut {
  title: string;
  image: string;
  alt?: string;
  badge?: string;
  action: ShortcutAction;
}

/** Older published Home content used food/fast/favourites for these service labels. */
export function comingSoonFeature(shortcut: Pick<FeedShortcut, 'title' | 'action'>): ComingSoonFeature | null {
  if (shortcut.action === 'instant' || shortcut.action === 'dineout' || shortcut.action === 'scenes') return shortcut.action;
  const title = shortcut.title.toLowerCase().replace(/[^a-z]/g, '');
  if (title === 'instant' || title === 'instamart') return 'instant';
  if (title === 'dineout') return 'dineout';
  if (title === 'scenes') return 'scenes';
  return null;
}

export interface VegFacts {
  hasVeg: boolean;
  pureVeg: boolean;
}

export interface FeedSection {
  kind: 'banner' | 'tiles' | 'category' | 'row' | 'rail' | 'search_hints' | 'shortcuts';
  title: string;
  image?: string;
  imageLeft?: string;
  imageAlt?: string;
  shortcuts?: FeedShortcut[];
  cta?: string;
  eyebrow?: string;
  subtitle?: string;
  tabs?: { label: string; filter: RailFilter }[];
  hints?: string[];
  categoryName?: string;
  targets: FeedTarget[];
  cards: FeedCard[];
}

/** Used only when admin has not published search hints yet. */
export const DEFAULT_SEARCH_HINT = 'dishes & kitchens';

export function searchHints(sections: FeedSection[]): string[] {
  const hints = sections.find(section => section.kind === 'search_hints')?.hints?.filter(hint => hint.trim()) ?? [];
  return hints.length ? hints : [DEFAULT_SEARCH_HINT];
}

/**
 * Restaurants for one rail tab.
 * - offers: only outlets admin gave a discount line, open ones first.
 * - fast:   open outlets, quickest ETA first (outlets without an ETA last).
 * - all:    open outlets first, nearest first.
 */
export function railOutlets(outlets: OutletSummary[], filter: RailFilter, limit = 10): OutletSummary[] {
  const open = (o: OutletSummary) => (o.isAcceptingOrders ? 0 : 1);
  const eta = (o: OutletSummary) => o.deliveryEta?.minMinutes ?? Number.POSITIVE_INFINITY;
  const distance = (o: OutletSummary) => o.distanceKm ?? Number.POSITIVE_INFINITY;
  let list: OutletSummary[];
  switch (filter) {
    case 'offers100':
      list = outlets.filter(o => {
        const fixed = o.offerTitle?.match(/(?:₹|Rs\.?)[ ]*(\d+(?:\.\d+)?)[ ]*OFF/i);
        return fixed && Number(fixed[1]) >= 100;
      }).sort((a, b) => open(a) - open(b) || distance(a) - distance(b));
      break;
    case 'fast10':
      list = outlets.filter(o => o.isAcceptingOrders && o.deliveryEta && o.deliveryEta.maxMinutes <= 10)
        .sort((a, b) => eta(a) - eta(b));
      break;
    case 'offers':
      list = outlets.filter(o => o.offerTitle?.trim()).sort((a, b) => open(a) - open(b) || distance(a) - distance(b));
      break;
    case 'fast':
      // Without a delivery location there are no ETAs yet: show nearest open kitchens instead of an empty rail.
      list = outlets.filter(o => o.isAcceptingOrders).sort((a, b) => eta(a) - eta(b) || distance(a) - distance(b));
      break;
    default:
      list = [...outlets].sort((a, b) => open(a) - open(b) || distance(a) - distance(b));
  }
  return list.slice(0, limit);
}

/** Card photo: admin's cover photo, else the restaurant logo. */
export const outletPhoto = (outlet: OutletSummary) => outlet.coverImageUrl || outlet.logoUrl;

/** What tapping a banner or tile does. */
export type FeedAction =
  | { type: 'outlet'; outlet: OutletSummary; dishId?: string }
  | { type: 'outlets'; outletIds: string[]; label: string }
  | { type: 'none' };

export function targetAction(target: FeedTarget | undefined, cards: FeedCard[], label: string): FeedAction {
  if (!target || !cards.length) return { type: 'none' };
  if (target.type === 'category') {
    return { type: 'outlets', outletIds: [...new Set(cards.map(card => card.outlet.id))], label: target.name ?? label };
  }
  return { type: 'outlet', outlet: cards[0].outlet, dishId: cards[0].dish?.id };
}

/** Shown until admin publishes a shortcut row: only destinations the app really has. */
export const DEFAULT_SHORTCUTS: FeedShortcut[] = [
  { title: 'FOOD', image: 'asset:shortcut-food', action: 'food', alt: 'Burger' },
  { title: 'INSTANT', image: 'asset:shortcut-instant', action: 'instant', alt: 'Fresh groceries in a bag' },
  { title: 'DINEOUT', image: 'asset:shortcut-dineout', action: 'dineout', alt: 'Restaurant serving cloche' },
  { title: 'SCENES', image: 'asset:shortcut-scenes', action: 'scenes', alt: 'Live stage microphone' },
];

/** Shown until admin publishes a restaurant toggle. */
export const DEFAULT_RAIL_TABS: { label: string; filter: RailFilter }[] = [
  { label: 'MIN Rs. 100 OFF', filter: 'offers100' },
  { label: '10 MINS DELIVERY', filter: 'fast10' },
];

/** Restaurants allowed in veg mode: those that can sell at least one veg dish. */
export function vegOutlets(outlets: OutletSummary[], vegByOutlet: Record<string, VegFacts>): OutletSummary[] {
  return outlets.filter(outlet => vegByOutlet[outlet.id]?.hasVeg);
}

/** One short cuisine line for a card: declared cuisines, else menu categories. */
export function cuisineLine(outletId: string, cuisinesByOutlet: Record<string, string[]>, categoriesByOutlet: Record<string, string[]>): string {
  const list = cuisinesByOutlet[outletId]?.length ? cuisinesByOutlet[outletId] : categoriesByOutlet[outletId] ?? [];
  return [...new Set(list)].slice(0, 3).join(', ');
}
