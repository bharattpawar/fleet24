/**
 * Provider-agnostic routing types and domain contracts for Fleet24.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type TravelMode = 'DRIVE' | 'TWO_WHEELER' | 'BICYCLE' | 'WALK';

export type RouteStatus =
  | 'OK'
  | 'ZERO_RESULTS'
  | 'OUT_OF_BOUNDS'
  | 'ROUTING_UNAVAILABLE'
  | 'TIMEOUT'
  | 'ERROR';

export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  travelMode?: TravelMode;
  includePolyline?: boolean;
  /**
   * Set to true when one or both endpoints represent a moving entity (e.g. rider GPS)
   * to apply shorter dynamic caching rather than static address caching.
   */
  isMovingEntity?: boolean;
}

export interface RouteResult {
  distanceMeters: number | null;
  durationSeconds: number | null;
  polyline?: string;
  provider: string;
  status: RouteStatus;
  calculatedAt: Date;
  cached: boolean;
  errorMessage?: string;
}

export interface MatrixWaypoint {
  id: string;
  location: Coordinates;
}

export interface MatrixRequest {
  origins: MatrixWaypoint[];
  destinations: MatrixWaypoint[];
  travelMode?: TravelMode;
}

export type MatrixElementStatus =
  | 'OK'
  | 'ZERO_RESULTS'
  | 'NOT_FOUND'
  | 'ROUTING_UNAVAILABLE'
  | 'TIMEOUT'
  | 'ERROR';

export interface MatrixElementResult {
  originId: string;
  destinationId: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  status: MatrixElementStatus;
  condition?: string;
  errorMessage?: string;
}

export interface MatrixResult {
  elements: MatrixElementResult[];
  provider: string;
  calculatedAt: Date;
}

export interface BatchRouteItem {
  id: string;
  origin: Coordinates;
  destination: Coordinates;
  travelMode?: TravelMode;
}
