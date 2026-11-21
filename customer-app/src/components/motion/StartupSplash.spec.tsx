import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StartupSplash } from './StartupSplash';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockReduced = false;
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  Animated: {
    View: 'AnimatedView', Value: class { interpolate() { return 0; } setValue() {} }, multiply: () => 1,
    // Deliberately withhold callbacks, as can happen if the app backgrounds during startup.
    timing: () => ({ start: jest.fn(), stop: jest.fn() }),
    parallel: () => ({ start: jest.fn(), stop: jest.fn() }),
    sequence: () => ({ start: jest.fn(), stop: jest.fn() }), delay: () => ({}),
  },
}));
jest.mock('../../theme/motion', () => ({ motion: { native: false, easing: { out: 0, in: 0, standard: 0 } }, useReducedMotion: () => mockReduced }));
jest.mock('../brand/BrandArt', () => ({ Wordmark: 'Wordmark', brand: { green: '#24533F' } }));
jest.mock('./RidingScene', () => ({ RidingScene: 'RidingScene' }));
let renderer: TestRenderer.ReactTestRenderer;
function render(ready: boolean) { act(() => { renderer = TestRenderer.create(<StartupSplash ready={ready} />); }); }
function tick(ms: number) { act(() => jest.advanceTimersByTime(ms)); }
const splash = () => renderer.root.findByProps({ accessibilityLabel: 'Fleet24 is loading' });
beforeEach(() => { jest.useFakeTimers(); mockReduced = false; });
afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); });
describe('3D startup lifecycle', () => {
  it('allows a full riding cycle before leaving a ready app', () => {
    render(true); tick(1699); expect(splash().props.pointerEvents).toBe('auto');
    tick(1); expect(splash().props.pointerEvents).toBe('none');
    tick(800); expect(renderer.toJSON()).toBeNull();
  });
  it('always releases a stalled app even if animation callbacks never fire', () => {
    render(false); tick(3999); expect(splash().props.pointerEvents).toBe('auto');
    tick(1); expect(splash().props.pointerEvents).toBe('none');
    tick(800); expect(renderer.toJSON()).toBeNull();
  });
  it('skips the forced cycling time for reduced motion', () => {
    mockReduced = true; render(true);
    expect(renderer.root.findByType('RidingScene' as any).props.reduced).toBe(true);
    tick(140); expect(splash().props.pointerEvents).toBe('none');
    tick(800); expect(renderer.toJSON()).toBeNull();
  });
  it('cleans up its startup timers when unmounted early', () => {
    render(false); act(() => renderer.unmount());
    expect(jest.getTimerCount()).toBe(0);
  });
});
