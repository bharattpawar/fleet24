import type { OutletSummary } from '../components/RestaurantCard';

/** Section shapes returned by GET /public/customer-home. Everything here is edited by admin. */
export type RailFilter = 'all' | 'offers' | 'fast';

export interface FeedDish {
  id: string;
  name: string;
  imageUrl: string | null;
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
  /** Category name, for category tiles. */
  name?: string;
  cards?: FeedCard[];
}

export interface FeedSection {
  kind: 'banner' | 'tiles' | 'category' | 'row' | 'rail' | 'search_hints';
  title: string;
  image?: string;
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
