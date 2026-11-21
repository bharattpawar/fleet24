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
        { title: 'INSTANT', image: 'asset:shortcut-instant', action: 'instant', alt: 'Fresh groceries in a bag' },
        { title: 'DINEOUT', image: 'asset:shortcut-dineout', action: 'dineout', alt: 'Restaurant serving cloche' },
        { title: 'SCENES', image: 'asset:shortcut-scenes', action: 'scenes', alt: 'Live stage microphone' },
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
      subtitle: 'Fresh picks from your local kitchens',
      cta: 'ORDER NOW',
      image: 'asset:brownies',
      imageLeft: 'asset:biryani',
      imageAlt: 'Biryani and chocolate brownies',
      targets: [firstTarget],
    });
  }
  const tileTargets = [...categories.slice(0, 2).map(c => ({ type: 'category' as const, id: c.id, name: c.name })),
    ...outlets.slice(0, 2).map(o => ({ type: 'outlet' as const, id: o.id, name: o.name }))].slice(0, 4);
  if (tileTargets.length) {
    sections.push({
      kind: 'tiles',
      title: '',
      targets: tileTargets.map(target => ({
        type: target.type,
        id: target.id,
        title: target.name.slice(0, 40),
        subtitle: 'Edit offer text',
        image: `asset:${artFor(target.name)}`,
      })),
    });
  }
  sections.push({
    kind: 'rail',
    title: '',
    targets: [],
    tabs: [
      { label: 'MIN Rs. 100 OFF', filter: 'offers100' },
      { label: '10 MINS DELIVERY', filter: 'fast10' },
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
