import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { preferenceStorage } from '../api/storage';
import { USE_MOCK_DATA } from '../api/mockData';
import { useAuth } from './AuthContext';
import type { Address } from '../components/AddressSelectionModal';

export interface ServiceZone {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
}

export type DeliveryLocation =
  | { kind: 'address'; address: Address; latitude: string; longitude: string; title: string; subtitle: string }
  | { kind: 'zone'; zone: ServiceZone; latitude: string; longitude: string; title: string; subtitle: string };

interface DeliveryLocationValue {
  addresses: Address[];
  zones: ServiceZone[];
  /** What Home browses and Cart delivers to: a saved address, or a service area when signed out. */
  location: DeliveryLocation | null;
  selectedAddress: Address | null;
  isLoading: boolean;
  selectAddress: (address: Address) => void;
  selectZone: (zone: ServiceZone) => void;
  addAddress: (address: Omit<Address, 'id'>) => Promise<Address>;
  updateAddress: (id: string, changes: Partial<Omit<Address, 'id'>>) => Promise<Address>;
  refresh: () => Promise<void>;
}

const SELECTED_KEY = 'fleet24_selected_address_id';
const DeliveryLocationContext = createContext<DeliveryLocationValue | null>(null);

function describeAddress(a: Address): DeliveryLocation {
  return {
    kind: 'address',
    address: a,
    latitude: a.latitude,
    longitude: a.longitude,
    title: a.label || 'Saved address',
    subtitle: [a.addressLine1, a.addressLine2].filter(Boolean).join(', '),
  };
}

function describeZone(z: ServiceZone): DeliveryLocation {
  return {
    kind: 'zone',
    zone: z,
    latitude: String(z.centerLatitude),
    longitude: String(z.centerLongitude),
    title: z.name,
    subtitle: 'Delivery service area',
  };
}

export function DeliveryLocationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [zones, setZones] = useState<ServiceZone[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const zoneRequest = useRef<Promise<ServiceZone[]> | null>(null);
  const loadZones = useCallback(async () => {
    if (USE_MOCK_DATA) return;
    try {
      zoneRequest.current ??= apiRequest<ServiceZone[]>('/public/service-zones');
      setZones(await zoneRequest.current);
    } catch {
      zoneRequest.current = null;
      setZones([]);
    }
  }, []);

  const loadAddresses = useCallback(async () => {
    if (!isAuthenticated || USE_MOCK_DATA) {
      setAddresses([]);
      return;
    }
    try {
      const list = await apiRequest<Address[]>('/users/addresses');
      setAddresses(list || []);
      const stored = await preferenceStorage.get(SELECTED_KEY);
      const pick = list.find((a) => a.id === stored) || list.find((a) => a.isDefault) || list[0];
      setSelectedId(pick ? pick.id : null);
    } catch {
      setAddresses([]);
    }
  }, [isAuthenticated]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadZones(), loadAddresses()]);
    setIsLoading(false);
  }, [loadZones, loadAddresses]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const selectAddress = useCallback((address: Address) => {
    setSelectedId(address.id);
    void preferenceStorage.set(SELECTED_KEY, address.id);
  }, []);

  const selectZone = useCallback((zone: ServiceZone) => {
    setZoneId(zone.id);
  }, []);

  const addAddress = useCallback(async (address: Omit<Address, 'id'>) => {
    const created = await apiRequest<Address>('/users/addresses', { method: 'POST', body: JSON.stringify(address) });
    setAddresses((prev) => [created, ...prev]);
    selectAddress(created);
    return created;
  }, [selectAddress]);

  const updateAddress = useCallback(async (id: string, changes: Partial<Omit<Address, 'id'>>) => {
    const updated = await apiRequest<Address>(`/users/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
    selectAddress(updated);
    return updated;
  }, [selectAddress]);

  const selectedAddress = useMemo(
    () => (isAuthenticated ? addresses.find((a) => a.id === selectedId) || null : null),
    [addresses, selectedId, isAuthenticated],
  );

  const location = useMemo<DeliveryLocation | null>(() => {
    if (selectedAddress) return describeAddress(selectedAddress);
    const zone = zones.find((z) => z.id === zoneId) || zones[0];
    return zone ? describeZone(zone) : null;
  }, [selectedAddress, zones, zoneId]);

  const value = useMemo(
    () => ({ addresses, zones, location, selectedAddress, isLoading, selectAddress, selectZone, addAddress, updateAddress, refresh }),
    [addresses, zones, location, selectedAddress, isLoading, selectAddress, selectZone, addAddress, updateAddress, refresh],
  );

  return <DeliveryLocationContext.Provider value={value}>{children}</DeliveryLocationContext.Provider>;
}

export function useDeliveryLocation() {
  const ctx = useContext(DeliveryLocationContext);
  if (!ctx) throw new Error('useDeliveryLocation must be used inside DeliveryLocationProvider');
  return ctx;
}

export function formatServiceAreas(zones: ServiceZone[]): string {
  const names = [...new Set(zones.map((zone) => zone.name.trim()).filter(Boolean))];
  if (!names.length) return 'our delivery area';
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

export function useServiceAreas(): string {
  const delivery = useContext(DeliveryLocationContext);
  return formatServiceAreas(delivery?.zones ?? []);
}
