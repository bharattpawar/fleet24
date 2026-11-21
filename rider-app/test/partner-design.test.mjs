import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const hex = (src, key) => src.match(new RegExp(`\\n\\s*${key}: '(#[0-9A-Fa-f]{6})'`))?.[1];

test('rider palette matches the customer app brand colours', () => {
  const customer = read('../../customer-app/src/theme/tokens.ts');
  const rider = read('../src/theme/tokens.ts');
  for (const key of ['primary', 'background', 'surfaceGreen', 'border', 'textPrimary']) {
    assert.equal(hex(rider, key), hex(customer, key), key);
  }
  assert.equal(hex(rider, 'limeAccent'), hex(customer, 'citrusLime'));
});

test('rider screens use the shared DM Sans styles helper', () => {
  for (const file of readdirSync(new URL('../src/screens/', import.meta.url))) {
    const src = read(`../src/screens/${file}`);
    assert.ok(!src.includes('StyleSheet.create('), file);
  }
});

test('operational screens use vector icons, not emoji', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of ['RiderHomeScreen.tsx', 'RiderEarningsScreen.tsx', 'RiderAccountScreen.tsx']) {
    assert.ok(!emoji.test(read(`../src/screens/${file}`)), file);
  }
});

test('availability control is one large switch with clear on/off copy', () => {
  const src = read('../src/components/AvailabilityControl.tsx');
  assert.match(src, /accessibilityRole="switch"/);
  assert.match(src, /checked: isOnline/);
  assert.match(src, /minHeight: 56/);
  assert.match(src, /Go online/);
  assert.match(src, /Go offline/);
});
