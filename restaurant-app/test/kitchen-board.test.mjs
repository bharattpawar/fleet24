import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOARD_COLUMNS, LIVE_STATUSES, groupForBoard, liveOrderCount } from '../src/utils/kitchenBoard.ts';

test('every live kitchen status sits in exactly one board column', () => {
  for (const status of LIVE_STATUSES) {
    const columns = BOARD_COLUMNS.filter(c => c.statuses.includes(status));
    assert.equal(columns.length, 1, status);
  }
});

test('board groups orders by column and leaves finished orders out', () => {
  const orders = [
    { id: 1, status: 'placed' }, { id: 2, status: 'confirmed' }, { id: 3, status: 'preparing' },
    { id: 4, status: 'ready_for_pickup' }, { id: 5, status: 'delivered' }, { id: 6, status: 'rejected' },
  ];
  const board = groupForBoard(orders);
  assert.deepEqual(board.placed.map(o => o.id), [1]);
  assert.deepEqual(board.preparing.map(o => o.id), [2, 3]);
  assert.deepEqual(board.ready_for_pickup.map(o => o.id), [4]);
  assert.equal(liveOrderCount(orders), 4);
});

test('partner palette matches the customer app brand colours', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const hex = (src, key) => src.match(new RegExp(`\\n\\s*${key}: '(#[0-9A-Fa-f]{6})'`))?.[1];
  const customer = read('../../customer-app/src/theme/tokens.ts');
  const restaurant = read('../src/theme/tokens.ts');
  for (const key of ['primary', 'background', 'surfaceGreen', 'border', 'textPrimary']) {
    assert.equal(hex(restaurant, key), hex(customer, key), key);
  }
});

test('screens use the shared DM Sans styles helper instead of raw StyleSheet.create', () => {
  const files = ['RestaurantOrdersScreen', 'RestaurantMenuScreen', 'RestaurantOutletsScreen', 'RestaurantProfileScreen', 'RestaurantLoginScreen'];
  for (const name of files) {
    const src = readFileSync(new URL(`../src/screens/${name}.tsx`, import.meta.url), 'utf8');
    assert.ok(src.includes('appStyles('), name);
    assert.ok(!src.includes('StyleSheet.create('), name);
  }
});
