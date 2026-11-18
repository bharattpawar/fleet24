import { apiRequest } from './client';

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  area: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

/** One token per picker session groups autocomplete + details into a single Places billing session. */
export function newPlacesSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i += 1) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export function searchPlaces(input: string, sessionToken: string, near?: { latitude: number; longitude: number }) {
  const params = new URLSearchParams({ input, sessionToken });
  if (near) {
    params.set('latitude', String(near.latitude));
    params.set('longitude', String(near.longitude));
  }
  return apiRequest<PlaceSuggestion[]>(`/geo/autocomplete?${params.toString()}`);
}

export function getPlaceLocation(placeId: string, sessionToken: string) {
  return apiRequest<ResolvedLocation>(
    `/geo/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
  );
}

export function reverseGeocode(latitude: number, longitude: number) {
  return apiRequest<ResolvedLocation>(`/geo/reverse?latitude=${latitude}&longitude=${longitude}`);
}

/** True when at least one outlet delivers to this point (uses the public discovery radius check). */
export async function isServiceable(latitude: number, longitude: number): Promise<boolean> {
  const outlets = await apiRequest<unknown[]>(
    `/public/outlets?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}`,
  );
  return Array.isArray(outlets) && outlets.length > 0;
}
