export interface AddressLike {
  addressLine1?: string | null;
  addressLine2?: string | null;
  street?: string | null;
  landmark?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

/** Second line under the house/flat line: area, landmark, city, PIN — whatever the customer gave. */
export function addressDetail(address?: AddressLike | null): string | null {
  if (!address) return null;
  const parts = [
    address.addressLine2,
    address.landmark ? `Near ${address.landmark}` : null,
    [address.city, address.postalCode].filter(Boolean).join(' '),
  ]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** First line: house / flat / building. */
export function addressTitle(address?: AddressLike | null, fallback = 'Customer address'): string {
  return (address?.addressLine1 || address?.street || '').trim() || fallback;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** A usable map point, or null when missing, 0,0 or out of range (never a made-up location). */
export function toCoordinate(latitude: unknown, longitude: unknown): Coordinate | null {
  if (latitude === null || latitude === undefined || latitude === '') return null;
  if (longitude === null || longitude === undefined || longitude === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** Builds the maps link: exact pin when known, otherwise a text search for the address. */
export function directionsUrl(
  platform: 'ios' | 'android' | 'web' | string,
  target: { point: Coordinate | null; label: string; searchText?: string | null },
): string | null {
  const label = encodeURIComponent(target.label);
  if (target.point) {
    const { latitude: lat, longitude: lng } = target.point;
    if (platform === 'ios') return `maps:0,0?q=${label}@${lat},${lng}`;
    if (platform === 'android') return `geo:0,0?q=${lat},${lng}(${label})`;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const text = (target.searchText || '').trim();
  if (!text) return null;
  const q = encodeURIComponent(text);
  if (platform === 'ios') return `maps:0,0?q=${q}`;
  if (platform === 'android') return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
