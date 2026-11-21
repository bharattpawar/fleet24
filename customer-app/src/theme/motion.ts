import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';

/** Shared timings: tap feedback 120–180 ms, sheets and screen transitions 180–280 ms. */
export const motion = {
  duration: {
    pressIn: 90,
    pressOut: 160,
    pulse: 160,
    swap: 160,
    screen: 220,
    tab: 160,
    sheetIn: 260,
    sheetOut: 200,
    bar: 220,
  },
  easing: {
    out: Easing.out(Easing.cubic),
    in: Easing.in(Easing.cubic),
    standard: Easing.inOut(Easing.quad),
  },
  pressScale: 0.98,
  /** The web renderer has no native animation driver. */
  native: Platform.OS !== 'web',
} as const;

let reduceMotion = false;
const listeners = new Set<(value: boolean) => void>();
let subscribed = false;

function subscribe() {
  if (subscribed) return;
  subscribed = true;
  AccessibilityInfo.isReduceMotionEnabled?.()
    .then((value) => {
      reduceMotion = Boolean(value);
      listeners.forEach((listener) => listener(reduceMotion));
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value: boolean) => {
    reduceMotion = Boolean(value);
    listeners.forEach((listener) => listener(reduceMotion));
  });
}

/** True when the OS or browser asks for reduced motion. */
export function useReducedMotion(): boolean {
  const [value, setValue] = useState(reduceMotion);
  useEffect(() => {
    subscribe();
    listeners.add(setValue);
    const refresh = setTimeout(() => setValue(reduceMotion), 0);
    return () => {
      clearTimeout(refresh);
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
