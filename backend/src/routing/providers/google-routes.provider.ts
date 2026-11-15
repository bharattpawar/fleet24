import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Coordinates,
  MatrixElementResult,
  MatrixRequest,
  MatrixResult,
  RouteRequest,
  RouteResult,
} from '../routing.types';
import { IRoutingProvider } from './routing-provider.interface';

@Injectable()
export class GoogleRoutesProvider implements IRoutingProvider {
  public readonly providerName = 'google';
  private readonly logger = new Logger(GoogleRoutesProvider.name);

  private readonly apiKey: string | null;
  private readonly timeoutMs: number;

  private static readonly COMPUTE_ROUTES_URL =
    'https://routes.googleapis.com/directions/v2:computeRoutes';
  private static readonly COMPUTE_ROUTE_MATRIX_URL =
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_ROUTES_API_KEY')?.trim() || null;
    this.timeoutMs = this.configService.get<number>('ROUTING_TIMEOUT_MS', 3000);

    if (!this.apiKey) {
      this.logger.warn(
        '[GoogleRoutesProvider] GOOGLE_ROUTES_API_KEY is not configured. Real road routing is inactive.',
      );
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  /**
   * Computes point-to-point road route via Google Routes v2.
   */
  public async computeRoute(req: RouteRequest): Promise<RouteResult> {
    const now = new Date();

    if (!this.isConfigured()) {
      return {
        distanceMeters: null,
        durationSeconds: null,
        provider: this.providerName,
        status: 'ROUTING_UNAVAILABLE',
        calculatedAt: now,
        cached: false,
        errorMessage: 'Google Routes API key is not configured in backend environment.',
      };
    }

    // 1. Numeric coordinate validation
    if (!this.isValidCoordinate(req.origin) || !this.isValidCoordinate(req.destination)) {
      return {
        distanceMeters: null,
        durationSeconds: null,
        provider: this.providerName,
        status: 'OUT_OF_BOUNDS',
        calculatedAt: now,
        cached: false,
        errorMessage: 'Invalid or out-of-bounds geographic coordinates provided.',
      };
    }

    // 2. Prepare field mask for Basic tier billing
    let fieldMask = 'routes.distanceMeters,routes.duration';
    if (req.includePolyline) {
      fieldMask += ',routes.polyline.encodedPolyline';
    }

    const payload = {
      origin: {
        location: {
          latLng: {
            latitude: req.origin.latitude,
            longitude: req.origin.longitude,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: req.destination.latitude,
            longitude: req.destination.longitude,
          },
        },
      },
      travelMode: req.travelMode || 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      computeAlternativeRoutes: false,
    };

    try {
      const response = await this.executeFetch(
        GoogleRoutesProvider.COMPUTE_ROUTES_URL,
        payload,
        fieldMask,
      );

      if (!response.ok) {
        return this.handleHttpError(response.status, now);
      }

      const data = (await response.json()) as any;

      if (!data.routes || data.routes.length === 0) {
        return {
          distanceMeters: null,
          durationSeconds: null,
          provider: this.providerName,
          status: 'ZERO_RESULTS',
          calculatedAt: now,
          cached: false,
          errorMessage: 'No road route found between the specified coordinates.',
        };
      }

      const route = data.routes[0];
      const distanceMeters =
        typeof route.distanceMeters === 'number'
          ? route.distanceMeters
          : parseInt(route.distanceMeters || '0', 10);

      const durationSeconds = this.parseDurationSeconds(route.duration);

      return {
        distanceMeters,
        durationSeconds,
        polyline: route.polyline?.encodedPolyline,
        provider: this.providerName,
        status: 'OK',
        calculatedAt: now,
        cached: false,
      };
    } catch (err: any) {
      return this.handleNetworkOrTimeoutError(err, now);
    }
  }

  /**
   * Computes an N x M route matrix via Google Routes v2.
   * Matches returned elements strictly by originIndex and destinationIndex.
   */
  public async computeRouteMatrix(req: MatrixRequest): Promise<MatrixResult> {
    const now = new Date();

    // Initialize full grid of expected matrix elements
    const elementsMap = new Map<string, MatrixElementResult>();
    for (let oIdx = 0; oIdx < req.origins.length; oIdx++) {
      for (let dIdx = 0; dIdx < req.destinations.length; dIdx++) {
        const key = `${oIdx}:${dIdx}`;
        elementsMap.set(key, {
          originId: req.origins[oIdx].id,
          destinationId: req.destinations[dIdx].id,
          distanceMeters: null,
          durationSeconds: null,
          status: 'NOT_FOUND',
          condition: 'MISSING_FROM_RESPONSE',
        });
      }
    }

    if (!this.isConfigured()) {
      return {
        elements: Array.from(elementsMap.values()).map((el) => ({
          ...el,
          status: 'ROUTING_UNAVAILABLE',
          errorMessage: 'Google Routes API key is not configured in backend environment.',
        })),
        provider: this.providerName,
        calculatedAt: now,
      };
    }

    // Coordinate validation
    const invalidOrigin = req.origins.find((o) => !this.isValidCoordinate(o.location));
    const invalidDest = req.destinations.find((d) => !this.isValidCoordinate(d.location));
    if (invalidOrigin || invalidDest) {
      return {
        elements: Array.from(elementsMap.values()).map((el) => ({
          ...el,
          status: 'ERROR',
          errorMessage: 'Invalid coordinates found in origin or destination list.',
        })),
        provider: this.providerName,
        calculatedAt: now,
      };
    }

    const payload = {
      origins: req.origins.map((o) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: o.location.latitude,
              longitude: o.location.longitude,
            },
          },
        },
      })),
      destinations: req.destinations.map((d) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: d.location.latitude,
              longitude: d.location.longitude,
            },
          },
        },
      })),
      travelMode: req.travelMode || 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
    };

    const fieldMask = 'originIndex,destinationIndex,status,distanceMeters,duration,condition';

    try {
      const response = await this.executeFetch(
        GoogleRoutesProvider.COMPUTE_ROUTE_MATRIX_URL,
        payload,
        fieldMask,
      );

      if (!response.ok) {
        const errResult = this.handleHttpError(response.status, now);
        return {
          elements: Array.from(elementsMap.values()).map((el) => ({
            ...el,
            status: errResult.status as any,
            errorMessage: errResult.errorMessage,
          })),
          provider: this.providerName,
          calculatedAt: now,
        };
      }

      const rawItems = (await response.json()) as any[];

      if (Array.isArray(rawItems)) {
        for (const item of rawItems) {
          const oIdx = item.originIndex ?? 0;
          const dIdx = item.destinationIndex ?? 0;
          const key = `${oIdx}:${dIdx}`;

          const existing = elementsMap.get(key);
          if (!existing) continue;

          // Check explicit error status on element
          if (item.status && item.status.code && item.status.code !== 0) {
            existing.status = 'ERROR';
            existing.errorMessage = item.status.message || 'Element routing failed';
            existing.condition = item.condition;
            continue;
          }

          if (item.condition === 'ROUTE_NOT_FOUND') {
            existing.status = 'ZERO_RESULTS';
            existing.distanceMeters = null;
            existing.durationSeconds = null;
            existing.condition = item.condition;
            continue;
          }

          const dist =
            typeof item.distanceMeters === 'number'
              ? item.distanceMeters
              : item.distanceMeters
              ? parseInt(item.distanceMeters, 10)
              : null;

          const dur = this.parseDurationSeconds(item.duration);

          if (dist !== null) {
            existing.status = 'OK';
            existing.distanceMeters = dist;
            existing.durationSeconds = dur;
            existing.condition = item.condition || 'ROUTE_EXISTS';
          } else {
            existing.status = 'ERROR';
            existing.errorMessage = 'Missing distance in provider response';
            existing.condition = item.condition;
          }
        }
      }

      return {
        elements: Array.from(elementsMap.values()),
        provider: this.providerName,
        calculatedAt: now,
      };
    } catch (err: any) {
      const errResult = this.handleNetworkOrTimeoutError(err, now);
      return {
        elements: Array.from(elementsMap.values()).map((el) => ({
          ...el,
          status: errResult.status as any,
          errorMessage: errResult.errorMessage,
        })),
        provider: this.providerName,
        calculatedAt: now,
      };
    }
  }

  /**
   * Internal fetch executor with timeout and strict API key header isolation.
   */
  private async executeFetch(
    url: string,
    payload: Record<string, unknown>,
    fieldMask: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey!,
      'X-Goog-FieldMask': fieldMask,
    };

    // Native AbortSignal timeout
    const signal = AbortSignal.timeout(this.timeoutMs);

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  }

  private isValidCoordinate(c?: Coordinates): boolean {
    if (!c) return false;
    return (
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude) &&
      c.latitude >= -90 &&
      c.latitude <= 90 &&
      c.longitude >= -180 &&
      c.longitude <= 180
    );
  }

  private parseDurationSeconds(durationStr?: string): number | null {
    if (!durationStr || typeof durationStr !== 'string') return null;
    const match = durationStr.match(/^(\d+(?:\.\d+)?)s?$/);
    return match ? Math.round(parseFloat(match[1])) : null;
  }

  private handleHttpError(status: number, calculatedAt: Date): RouteResult {
    if (status === 401 || status === 403) {
      this.logger.error(
        '[GoogleRoutesProvider] Authorization failure (HTTP 401/403). Check API key permissions.',
      );
      return {
        distanceMeters: null,
        durationSeconds: null,
        provider: this.providerName,
        status: 'ROUTING_UNAVAILABLE',
        calculatedAt,
        cached: false,
        errorMessage: 'Google Routes authorization failed (HTTP 401/403).',
      };
    }

    if (status === 429) {
      this.logger.warn('[GoogleRoutesProvider] Rate limit / quota exceeded (HTTP 429).');
      return {
        distanceMeters: null,
        durationSeconds: null,
        provider: this.providerName,
        status: 'ROUTING_UNAVAILABLE',
        calculatedAt,
        cached: false,
        errorMessage: 'Google Routes quota or rate limit exceeded (HTTP 429).',
      };
    }

    this.logger.error(`[GoogleRoutesProvider] Provider returned HTTP error status ${status}.`);
    return {
      distanceMeters: null,
      durationSeconds: null,
      provider: this.providerName,
      status: 'ROUTING_UNAVAILABLE',
      calculatedAt,
      cached: false,
      errorMessage: `Google Routes service returned HTTP error status ${status}.`,
    };
  }

  private handleNetworkOrTimeoutError(err: any, calculatedAt: Date): RouteResult {
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      err?.message?.includes('timeout') ||
      err?.message?.includes('aborted');

    if (isTimeout) {
      this.logger.warn(`[GoogleRoutesProvider] Request timed out after ${this.timeoutMs}ms.`);
      return {
        distanceMeters: null,
        durationSeconds: null,
        provider: this.providerName,
        status: 'TIMEOUT',
        calculatedAt,
        cached: false,
        errorMessage: `Routing request timed out after ${this.timeoutMs}ms.`,
      };
    }

    this.logger.error(`[GoogleRoutesProvider] Network error: ${err?.message || err}`);
    return {
      distanceMeters: null,
      durationSeconds: null,
      provider: this.providerName,
      status: 'ROUTING_UNAVAILABLE',
      calculatedAt,
      cached: false,
      errorMessage: `Routing network error: ${err?.message || 'Connection failed'}`,
    };
  }
}
