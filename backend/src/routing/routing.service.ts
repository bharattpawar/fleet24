import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RouteRequest,
  RouteResult,
  MatrixRequest,
  MatrixResult,
  BatchRouteItem,
  MatrixElementResult,
} from './routing.types';
import { IRoutingProvider, ROUTING_PROVIDER_TOKEN } from './providers/routing-provider.interface';
import { RoutingCacheService } from './routing-cache.service';
import { calculateDistanceKm } from '../common/utils/geo';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @Inject(ROUTING_PROVIDER_TOKEN)
    private readonly provider: IRoutingProvider,
    private readonly cacheService: RoutingCacheService,
  ) {}

  /**
   * Whether the primary routing provider is configured and available.
   */
  public isAvailable(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Computes a point-to-point road route with conservative caching and request coalescing.
   */
  public async getRoute(request: RouteRequest): Promise<RouteResult> {
    const cacheKey = this.cacheService.generateRouteKey(request);

    // 1. Check cache first
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Coalesce in-flight requests to eliminate duplicate Google calls for identical lookups
    return this.cacheService.coalesce(cacheKey, async () => {
      const result = await this.provider.computeRoute(request);

      // Only cache successful routes
      if (result.status === 'OK') {
        this.cacheService.set(request, result);
      }

      return result;
    });
  }

  /**
   * Computes an N x M road distance and duration matrix.
   */
  public async getRouteMatrix(request: MatrixRequest): Promise<MatrixResult> {
    return this.provider.computeRouteMatrix(request);
  }

  /**
   * Bounded, chunked batch road distance resolution for multi-candidate queries (e.g. discovery).
   * 1. Checks individual point-to-point cache entries first.
   * 2. Chunks uncached candidate origins into bounded Matrix requests (default max 25 per request).
   * 3. Stores successful matrix results into the LRU cache.
   * 4. Returns Map<string, RouteResult> keyed by candidate item ID.
   */
  public async getBatchRoutes(
    items: BatchRouteItem[],
    options?: { maxChunkSize?: number },
  ): Promise<Map<string, RouteResult>> {
    const results = new Map<string, RouteResult>();
    if (!items || items.length === 0) {
      return results;
    }

    const uncachedItems: BatchRouteItem[] = [];

    // Step 1: Check cache for each item
    for (const item of items) {
      const req: RouteRequest = {
        origin: item.origin,
        destination: item.destination,
        travelMode: item.travelMode || 'DRIVE',
      };
      const cacheKey = this.cacheService.generateRouteKey(req);
      const cached = this.cacheService.get(cacheKey);
      if (cached) {
        results.set(item.id, cached);
      } else {
        uncachedItems.push(item);
      }
    }

    if (uncachedItems.length === 0 || !this.isAvailable()) {
      return results;
    }

    const chunkSize = options?.maxChunkSize || 25;

    // Step 2: Group and chunk uncached items into bounded matrix requests
    for (let i = 0; i < uncachedItems.length; i += chunkSize) {
      const chunk = uncachedItems.slice(i, i + chunkSize);

      const matrixReq: MatrixRequest = {
        origins: chunk.map((item) => ({
          id: item.id,
          location: item.origin,
        })),
        destinations: [
          {
            id: 'destination',
            location: chunk[0].destination,
          },
        ],
        travelMode: chunk[0].travelMode || 'DRIVE',
      };

      try {
        const matrixResult = await this.provider.computeRouteMatrix(matrixReq);
        const elementMap = new Map<string, MatrixElementResult>();
        for (const el of matrixResult.elements) {
          elementMap.set(el.originId, el);
        }

        for (const item of chunk) {
          const el = elementMap.get(item.id);
          const routeReq: RouteRequest = {
            origin: item.origin,
            destination: item.destination,
            travelMode: item.travelMode || 'DRIVE',
          };

          if (el && el.status === 'OK' && el.distanceMeters !== null) {
            const routeResult: RouteResult = {
              distanceMeters: el.distanceMeters,
              durationSeconds: el.durationSeconds,
              provider: matrixResult.provider,
              status: 'OK',
              calculatedAt: matrixResult.calculatedAt,
              cached: false,
            };
            this.cacheService.set(routeReq, routeResult);
            results.set(item.id, routeResult);
          } else {
            const failedStatus = el?.status || 'ROUTING_UNAVAILABLE';
            results.set(item.id, {
              distanceMeters: null,
              durationSeconds: null,
              provider: matrixResult.provider,
              status: failedStatus as any,
              calculatedAt: matrixResult.calculatedAt,
              cached: false,
              errorMessage: el?.errorMessage || 'Route matrix computation failed for this element',
            });
          }
        }
      } catch (err: unknown) {
        this.logger.error(
          `Chunked route matrix failed for ${chunk.length} items: ${err instanceof Error ? err.message : String(err)}`,
        );
        for (const item of chunk) {
          results.set(item.id, {
            distanceMeters: null,
            durationSeconds: null,
            provider: 'google',
            status: 'ERROR',
            calculatedAt: new Date(),
            cached: false,
            errorMessage: err instanceof Error ? err.message : 'Matrix chunk error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Fast Stage 1 Straight-Line Haversine lower bound check.
   * Useful for eliminating candidates whose straight-line distance already
   * exceeds the maximum road threshold (since straight-line is a mathematical lower bound).
   */
  public getStraightLineDistanceKm(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): number {
    return calculateDistanceKm(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    );
  }
}
