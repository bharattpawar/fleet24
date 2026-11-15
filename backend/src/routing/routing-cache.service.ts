import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouteRequest, RouteResult } from './routing.types';

interface CacheEntry {
  result: RouteResult;
  expiresAt: number;
  lastAccessedAt: number;
}

@Injectable()
export class RoutingCacheService {
  private readonly logger = new Logger(RoutingCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlightPromises = new Map<string, Promise<RouteResult>>();
  private accessCounter = 0;

  private readonly maxEntries: number;
  private readonly staticTtlMs: number;
  private readonly movingTtlMs: number;

  constructor(private readonly configService: ConfigService) {
    this.maxEntries = this.configService.get<number>('ROUTING_CACHE_MAX_ENTRIES', 2000);
    const ttlSeconds = this.configService.get<number>('ROUTING_CACHE_TTL_SECONDS', 3600);
    this.staticTtlMs = ttlSeconds * 1000;
    // Moving entities (riders in transit) use a strict 60-second TTL
    this.movingTtlMs = 60 * 1000;
  }

  /**
   * Generates a canonical, precision-preserving cache key.
   * Uses 6 decimal places (approx. 0.11m precision) to eliminate false boundary
   * eligibility decisions near critical thresholds (e.g. 3.0 km).
   */
  public generateRouteKey(req: RouteRequest): string {
    const origLat = req.origin.latitude.toFixed(6);
    const origLon = req.origin.longitude.toFixed(6);
    const destLat = req.destination.latitude.toFixed(6);
    const destLon = req.destination.longitude.toFixed(6);
    const mode = req.travelMode || 'DRIVE';
    const poly = req.includePolyline ? '1' : '0';
    const entityType = req.isMovingEntity ? 'mov' : 'sta';

    return `p2p:${entityType}:${origLat},${origLon}->${destLat},${destLon}:${mode}:${poly}`;
  }

  /**
   * Retrieves a valid, unexpired route from cache.
   */
  public get(key: string): RouteResult | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access counter for monotonic LRU tracking
    entry.lastAccessedAt = ++this.accessCounter;
    return {
      ...entry.result,
      cached: true,
    };
  }

  /**
   * Stores a successful route in the bounded cache.
   * Transient errors (TIMEOUT, ROUTING_UNAVAILABLE, ERROR) are NEVER cached.
   */
  public set(req: RouteRequest, result: RouteResult): void {
    // Safety guard: only cache successful routes with valid distance
    if (result.status !== 'OK' || result.distanceMeters === null) {
      return;
    }

    const key = this.generateRouteKey(req);
    const ttl = req.isMovingEntity ? this.movingTtlMs : this.staticTtlMs;
    const now = Date.now();

    // Enforce bounded LRU capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      result: { ...result, cached: true },
      expiresAt: now + ttl,
      lastAccessedAt: ++this.accessCounter,
    });
  }

  /**
   * Coalesces concurrent in-flight requests for identical lookups.
   * If an identical route query is already pending, returns the existing Promise.
   */
  public async coalesce(
    key: string,
    factory: () => Promise<RouteResult>,
  ): Promise<RouteResult> {
    const existingPromise = this.inFlightPromises.get(key);
    if (existingPromise) {
      this.logger.debug(`[Coalescing] Reusing in-flight request for key: ${key}`);
      return existingPromise;
    }

    const requestPromise = factory().finally(() => {
      this.inFlightPromises.delete(key);
    });

    this.inFlightPromises.set(key, requestPromise);
    return requestPromise;
  }

  /**
   * Evicts the least recently accessed entry.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clears all cache entries (useful for testing or cache invalidation).
   */
  public clear(): void {
    this.cache.clear();
    this.inFlightPromises.clear();
  }

  /**
   * Current number of entries in cache.
   */
  public get size(): number {
    return this.cache.size;
  }
}
