(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const auth = { isAuthenticated: false };
jest.mock('./AuthContext', () => ({ useAuth: () => auth }));
jest.mock('../api/mockData', () => ({ USE_MOCK_DATA: false }));
const store: Record<string, string> = {};
jest.mock('../api/storage', () => ({
  preferenceStorage: {
    get: jest.fn(async (k: string) => store[k] ?? null),
    set: jest.fn(async (k: string, v: string | null) => {
      if (v === null) delete store[k];
      else store[k] = v;
    }),
  },
}));
const zones = [
  { id: 'kp2', name: 'Knowledge Park II', centerLatitude: 28.4594, centerLongitude: 77.4934, radiusMeters: 3000 },
  { id: 'kp3', name: 'Knowledge Park III', centerLatitude: 28.4716, centerLongitude: 77.4838, radiusMeters: 3000 },
];
const addresses = [
  { id: 'a1', label: 'Work', addressLine1: 'Block A', city: 'Greater Noida', postalCode: '201310', latitude: '28.47', longitude: '77.48', isDefault: false },
  { id: 'a2', label: 'Home', addressLine1: 'Flat 402', city: 'Greater Noida', postalCode: '201310', latitude: '28.46', longitude: '77.49', isDefault: true },
];
jest.mock('../api/client', () => ({
  apiRequest: jest.fn(async (path: string) => (path === '/public/service-zones' ? zones : addresses)),
}));

import { DeliveryLocationProvider, useDeliveryLocation } from './DeliveryLocationContext';

function capture() {
  const seen: { current: ReturnType<typeof useDeliveryLocation> | null } = { current: null };
  const Probe = () => {
    seen.current = useDeliveryLocation();
    return null;
  };
  return { seen, Probe };
}

async function mount() {
  const { seen, Probe } = capture();
  await act(async () => {
    TestRenderer.create(
      <DeliveryLocationProvider>
        <Probe />
      </DeliveryLocationProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return seen;
}

describe('DeliveryLocationContext', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it('signed out: browses the first service area, never a hard-coded address', async () => {
    auth.isAuthenticated = false;
    const seen = await mount();
    expect(seen.current!.location).toMatchObject({ kind: 'zone', title: 'Knowledge Park II', latitude: '28.4594' });
    expect(seen.current!.addresses).toEqual([]);
  });

  it('signed in: uses the default saved address, then remembers the chosen one', async () => {
    auth.isAuthenticated = true;
    let seen = await mount();
    expect(seen.current!.location).toMatchObject({ kind: 'address', title: 'Home' });

    await act(async () => {
      seen.current!.selectAddress(addresses[0] as any);
    });
    expect(seen.current!.location).toMatchObject({ kind: 'address', title: 'Work' });

    seen = await mount();
    expect(seen.current!.location).toMatchObject({ kind: 'address', title: 'Work' });
  });
});
