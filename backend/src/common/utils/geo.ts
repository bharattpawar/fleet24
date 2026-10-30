/**
 * Geographic calculation utilities for distance and delivery radius validation.
 */

export interface Coordinates {
  latitude: number | string | null | undefined;
  longitude: number | string | null | undefined;
}

const EARTH_RADIUS_KM = 6371.0088; // Mean radius of Earth in kilometers (IUGG standard)
const EPSILON = 1e-9; // Floating point precision tolerance

/**
 * Validates whether the given value is a finite number within the specified geographic range.
 */
function isValidGeoCoordinate(val: unknown, min: number, max: number): val is number {
  if (val === null || val === undefined || val === '') return false;
  const num = typeof val === 'number' ? val : Number(val);
  return !isNaN(num) && isFinite(num) && num >= min && num <= max;
}

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates great-circle distance between two geographic coordinates using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 (degrees: -90 to +90)
 * @param lon1 Longitude of point 1 (degrees: -180 to +180)
 * @param lat2 Latitude of point 2 (degrees: -90 to +90)
 * @param lon2 Longitude of point 2 (degrees: -180 to +180)
 * @returns Distance in kilometers
 * @throws Error if any coordinate is invalid, out of range, or missing
 */
export function calculateDistanceKm(
  lat1: number | string | null | undefined,
  lon1: number | string | null | undefined,
  lat2: number | string | null | undefined,
  lon2: number | string | null | undefined,
): number {
  if (
    !isValidGeoCoordinate(lat1, -90, 90) ||
    !isValidGeoCoordinate(lat2, -90, 90)
  ) {
    throw new Error(
      `Invalid latitude value: lat1='${lat1}', lat2='${lat2}'. Must be between -90 and 90.`,
    );
  }

  if (
    !isValidGeoCoordinate(lon1, -180, 180) ||
    !isValidGeoCoordinate(lon2, -180, 180)
  ) {
    throw new Error(
      `Invalid longitude value: lon1='${lon1}', lon2='${lon2}'. Must be between -180 and 180.`,
    );
  }

  const p1Lat = typeof lat1 === 'number' ? lat1 : parseFloat(lat1);
  const p1Lon = typeof lon1 === 'number' ? lon1 : parseFloat(lon1);
  const p2Lat = typeof lat2 === 'number' ? lat2 : parseFloat(lat2);
  const p2Lon = typeof lon2 === 'number' ? lon2 : parseFloat(lon2);

  // Exact same point check
  if (Math.abs(p1Lat - p2Lat) < EPSILON && Math.abs(p1Lon - p2Lon) < EPSILON) {
    return 0;
  }

  const dLat = toRadians(p2Lat - p1Lat);
  const dLon = toRadians(p2Lon - p1Lon);

  const radLat1 = toRadians(p1Lat);
  const radLat2 = toRadians(p2Lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  // Handle potential floating-point overflow where a > 1 due to rounding
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));

  return EARTH_RADIUS_KM * c;
}

/**
 * Checks whether a delivery destination is within the outlet's configured radius.
 * Applies a tiny numerical tolerance (1e-6) so addresses exactly on the boundary are allowed.
 *
 * @param outletCoords Authoritative coordinates of the outlet
 * @param destinationCoords Authoritative coordinates of the customer address
 * @param configuredRadiusKm The configured delivery radius in km
 * @returns { isEligible: boolean, distanceKm: number }
 */
export function isWithinDeliveryRadius(
  outletCoords: Coordinates,
  destinationCoords: Coordinates,
  configuredRadiusKm: number | string | null | undefined,
): { isEligible: boolean; distanceKm: number } {
  if (
    configuredRadiusKm === null ||
    configuredRadiusKm === undefined ||
    configuredRadiusKm === ''
  ) {
    throw new Error('Configured delivery radius is missing or null.');
  }

  const radius =
    typeof configuredRadiusKm === 'number'
      ? configuredRadiusKm
      : parseFloat(configuredRadiusKm);

  if (isNaN(radius) || !isFinite(radius) || radius <= 0) {
    throw new Error(`Invalid configured delivery radius: '${configuredRadiusKm}'.`);
  }

  const distanceKm = calculateDistanceKm(
    outletCoords.latitude,
    outletCoords.longitude,
    destinationCoords.latitude,
    destinationCoords.longitude,
  );

  // Eligible if distance <= radius + boundary epsilon tolerance
  const isEligible = distanceKm <= radius + 1e-6;

  return { isEligible, distanceKm };
}

export interface DistanceResult {
  distanceMeters: number;
  distanceKm: number;
  isWithin3Km: boolean;
}

/**
 * Calculates distance between two points (e.g., rider and restaurant/outlet)
 * and determines if it satisfies Fleet24's strict 3 KM (3,000 meters) proximity threshold.
 *
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns { distanceMeters, distanceKm, isWithin3Km }
 */
export function calculateRiderProximity(
  lat1: number | string | null | undefined,
  lon1: number | string | null | undefined,
  lat2: number | string | null | undefined,
  lon2: number | string | null | undefined,
): DistanceResult {
  const distanceKm = calculateDistanceKm(lat1, lon1, lat2, lon2);
  const distanceMeters = distanceKm * 1000;

  // Fleet24 Rule: strictly <= 3000 meters (with standard float epsilon 1e-6)
  const isWithin3Km = distanceMeters <= 3000 + 1e-6;

  return {
    distanceMeters,
    distanceKm,
    isWithin3Km,
  };
}


