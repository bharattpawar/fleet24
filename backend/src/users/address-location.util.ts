/**
 * Before the map/search location picker, the customer app saved every new address with this
 * fixed point (Sector Alpha 1, Greater Noida). Addresses still at this point have no real
 * location and must be re-pinned before they can be used for delivery.
 */
export const LEGACY_PLACEHOLDER_LOCATION = { latitude: 28.4855, longitude: 77.5135 } as const;

const EPSILON = 1e-6;

export function isLegacyPlaceholderLocation(latitude: unknown, longitude: unknown): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat - LEGACY_PLACEHOLDER_LOCATION.latitude) < EPSILON &&
    Math.abs(lng - LEGACY_PLACEHOLDER_LOCATION.longitude) < EPSILON
  );
}

/** True when the pair is a real, usable coordinate (in range, not 0,0, not the legacy placeholder). */
export function isUsableLocation(latitude: unknown, longitude: unknown): boolean {
  if (latitude === null || latitude === undefined || latitude === '') return false;
  if (longitude === null || longitude === undefined || longitude === '') return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return !isLegacyPlaceholderLocation(lat, lng);
}

/** Adds `needsLocationConfirmation` so clients can ask the customer to re-pin legacy addresses. */
export function withLocationStatus<T extends { latitude: unknown; longitude: unknown }>(
  address: T,
): T & { needsLocationConfirmation: boolean } {
  return { ...address, needsLocationConfirmation: !isUsableLocation(address.latitude, address.longitude) };
}
