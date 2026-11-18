import { cuisineCategories } from './homeCategories';

it('counts each category once per outlet and sorts the most common first', () => {
  expect(cuisineCategories({ a: ['Sides', 'Mains', 'Sides'], b: [' sides ', 'Snacks'] }))
    .toEqual([
      { id: 'category:sides', name: 'Sides', count: 2 },
      { id: 'category:mains', name: 'Mains', count: 1 },
      { id: 'category:snacks', name: 'Snacks', count: 1 },
    ]);
});

it('keeps distinct category names with shared words', () => {
  expect(cuisineCategories({ a: ['Rice', 'Fried Rice'] }).map(category => category.id))
    .toEqual(['category:fried rice', 'category:rice']);
});
