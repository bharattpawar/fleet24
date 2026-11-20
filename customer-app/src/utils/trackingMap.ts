/** Pure helpers for the customer's live tracking map (no React Native imports, so they test in node). */

export interface MapPoint {
  latitude: number;
  longitude: number;
}

/** Accepts numbers or numeric strings (DB numerics); returns null for missing, invalid or 0,0 points. */
export function toMapPoint(latitude: unknown, longitude: unknown): MapPoint | null {
  if (latitude === null || latitude === undefined || latitude === '') return null;
  if (longitude === null || longitude === undefined || longitude === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { latitude: lat, longitude: lng };
}

const AFTER_PICKUP = new Set(['picked_up', 'arrived_customer', 'completed']);

/** True once the rider has the food: the map then centres on rider and drop-off, not the restaurant. */
export function isAfterPickup(deliveryStatus: string | undefined | null): boolean {
  return AFTER_PICKUP.has((deliveryStatus || '').toLowerCase());
}

export interface TrackingMapPoints {
  restaurant: MapPoint | null;
  dropoff: MapPoint | null;
  rider: MapPoint | null;
}

/**
 * The points the map should keep in view. Before pickup: rider, restaurant and drop-off.
 * After pickup: rider and drop-off only, so the view stays close to the customer.
 */
export function pointsToFit(points: TrackingMapPoints, deliveryStatus: string | undefined | null): MapPoint[] {
  const out: MapPoint[] = [];
  if (points.rider) out.push(points.rider);
  if (points.dropoff) out.push(points.dropoff);
  if (points.restaurant && (!isAfterPickup(deliveryStatus) || out.length === 0)) out.push(points.restaurant);
  return out;
}

export interface MapRegion extends MapPoint {
  latitudeDelta: number;
  longitudeDelta: number;
}

const MIN_DELTA = 0.008; // ~900 m: never zoom in closer than a few streets
const PADDING = 1.6;

/** A region that shows every point with some margin. Null when there are no points. */
export function regionForPoints(points: MapPoint[]): MapRegion | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * PADDING, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * PADDING, MIN_DELTA),
  };
}

/** Text for the pill over the map. */
export function trackingStatusLabel(hasRider: boolean, isStale: boolean): string {
  if (!hasRider) return 'Waiting for rider location';
  return isStale ? 'Rider GPS updating…' : 'Live rider location';
}
