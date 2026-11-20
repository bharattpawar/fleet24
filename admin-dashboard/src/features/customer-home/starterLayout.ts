import { artFor } from '@/components/media/homeArt';

type TargetType = 'category' | 'restaurant' | 'outlet' | 'dish';
type Catalog = Record<TargetType, { id: string; name: string }[]>;

/**
 * A complete Home draft in the reference layout, using built-in illustrations and the real
 * catalogue for destinations. Offer wording is a placeholder for admin to edit before publishing;
 * nothing here goes live until Publish.
 */
export function starterLayout(catalog: Catalog) {
  const categories = catalog.category.slice(0, 8);
  const outlets = catalog.outlet;
  const firstTarget = categories[0]
    ? { type: 'category' as const, id: categories[0].id }
    : outlets[0] ? { type: 'outlet' as const, id: outlets[0].id } : null;
  const sections: Array<Record<string, unknown>> = [
    {
      kind: 'shortcuts',
      title: 'Services',
      targets: [],
      shortcuts: [
        { title: 'FOOD', image: 'asset:shortcut-food', action: 'food', alt: 'Burger' },
        { title: 'OFFERS', image: 'asset:shortcut-offers', action: 'offers', alt: 'Discount tag' },
        { title: 'FAST', image: 'asset:shortcut-fast', action: 'fast', badge: 'QUICK', alt: 'Lightning bolt' },
        { title: 'REORDER', image: 'asset:shortcut-orders', action: 'orders', alt: 'Shopping bag with a tick' },
      ],
    },
    {
      kind: 'search_hints',
      title: 'Search hints',
      targets: [],
      hints: ['Biryani', 'Pizza', 'Paneer', 'Rolls', 'Cake'].filter(Boolean),
    },
  ];
  if (firstTarget) {
    sections.push({
      kind: 'banner',
      title: 'Foodie Weekend',
      subtitle: 'Edit this offer line before publishing',
      cta: 'ORDER NOW',
      image: 'asset:brownies',
      imageLeft: 'asset:biryani',
      imageAlt: 'Biryani and chocolate brownies',
      targets: [firstTarget],
    });
  }
  const tileTargets = [...categories.slice(0, 2).map(c => ({ type: 'category' as const, id: c.id, name: c.name })),
    ...outlets.slice(0, 2).map(o => ({ type: 'outlet' as const, id: o.id, name: o.name }))].slice(0, 4);
  const tileArt = ['asset:promo-feast', 'asset:promo-flash', 'asset:promo-percent', 'asset:promo-bolt'];
  if (tileTargets.length) {
    sections.push({
      kind: 'tiles',
      title: '',
      targets: tileTargets.map((target, i) => ({
        type: target.type,
        id: target.id,
        title: target.name.slice(0, 40),
        subtitle: 'Edit offer text',
        image: tileArt[i % tileArt.length],
      })),
    });
  }
  sections.push({
    kind: 'rail',
    title: '',
    targets: [],
    tabs: [
      { label: 'OFFERS FOR YOU', filter: 'offers' },
      { label: 'FASTEST DELIVERY', filter: 'fast' },
    ],
  });
  for (const category of categories.slice(0, 8)) {
    sections.push({
      kind: 'category',
      title: category.name.slice(0, 100),
      image: `asset:${artFor(category.name)}`,
      imageAlt: category.name,
      targets: [{ type: 'category', id: category.id }],
    });
  }
  return sections;
}
