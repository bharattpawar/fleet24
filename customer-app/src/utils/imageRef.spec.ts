/* eslint-disable @typescript-eslint/no-require-imports */
// Node helpers for the asset-sync check (the app's tsconfig has no Node types).
declare const __dirname: string;
const fs: { readFileSync(file: string, encoding: string): string; readdirSync(dir: string): string[] } = require('fs');
const path: { join(...parts: string[]): string } = require('path');

jest.mock('../api/client', () => ({ API_BASE_URL: 'https://api.fleet24.test/api/v1' }));
jest.mock('../theme/homeArt', () => ({ HOME_ART: { biryani: 101, 'promo-percent': 102 } }));

import { fallbackArt, resolveImage } from './imageRef';

describe('image references', () => {
  it('resolves uploaded media, built-in art and URLs; rejects anything else', () => {
    expect(resolveImage('media:3f2b6c1e-8d4a-4f6b-9c2d-1a2b3c4d5e6f')).toEqual({ uri: 'https://api.fleet24.test/api/v1/public/media/3f2b6c1e-8d4a-4f6b-9c2d-1a2b3c4d5e6f' });
    expect(resolveImage('asset:biryani')).toBe(101);
    expect(resolveImage('asset:unknown')).toBeNull();
    expect(resolveImage('https://cdn.test/a.jpg')).toEqual({ uri: 'https://cdn.test/a.jpg' });
    expect(resolveImage('javascript:alert(1)')).toBeNull();
    expect(resolveImage(null)).toBeNull();
  });

  it('picks a fitting illustration from names, with a neutral default', () => {
    expect(fallbackArt('Hyderabadi Biryani')).toBe('biryani');
    expect(fallbackArt(undefined, 'Kathi Roll Corner')).toBe('rolls');
    expect(fallbackArt('Hot Beverages, Tiffins')).toBe('beverages');
    expect(fallbackArt('Something else')).toBe('thali');
  });

  it('ships every illustration the backend allows admin to pick', () => {
    const backend = fs.readFileSync(path.join(__dirname, '../../../backend/src/restaurants/home-art.ts'), 'utf8');
    const keys = [...backend.slice(backend.indexOf('HOME_ART_KEYS'), backend.indexOf('] as const')).matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
    const files = fs.readdirSync(path.join(__dirname, '../../assets/home')).map(f => f.replace('.webp', '')).sort();
    expect(keys.length).toBeGreaterThan(20);
    expect([...keys].sort()).toEqual(files);
    const admin = fs.readdirSync(path.join(__dirname, '../../../admin-dashboard/public/home-art')).map(f => f.replace('.webp', '')).sort();
    expect(admin).toEqual(files);
  });
});
