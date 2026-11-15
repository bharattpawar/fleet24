import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RoutingCacheService } from '../routing-cache.service';
import { RouteRequest, RouteResult } from '../routing.types';

describe('RoutingCacheService', () => {
  let cacheService: RoutingCacheService;

  const createService = async (maxEntries = 3, ttlSeconds = 10) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingCacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'ROUTING_CACHE_MAX_ENTRIES') return maxEntries;
              if (key === 'ROUTING_CACHE_TTL_SECONDS') return ttlSeconds;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    return module.get<RoutingCacheService>(RoutingCacheService);
  };

  beforeEach(async () => {
    cacheService = await createService(3, 10);
  });

  describe('Key Generation & Precision Safety', () => {
    it('preserves 6 decimal places to prevent false boundary eligibility near 3km', () => {
      const reqA: RouteRequest = {
        origin: { latitude: 28.474411, longitude: 77.504011 },
        destination: { latitude: 28.468200, longitude: 77.511200 },
      };

      const reqB: RouteRequest = {
        origin: { latitude: 28.474415, longitude: 77.504011 }, // Differs at 6th decimal place (~0.4m)
        destination: { latitude: 28.468200, longitude: 77.511200 },
      };

      const keyA = cacheService.generateRouteKey(reqA);
      const keyB = cacheService.generateRouteKey(reqB);

      expect(keyA).not.toEqual(keyB);
      expect(keyA).toContain('28.474411');
      expect(keyB).toContain('28.474415');
    });

    it('differentiates moving entities vs static address routes in cache keys', () => {
      const reqStatic: RouteRequest = {
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
        isMovingEntity: false,
      };

      const reqMoving: RouteRequest = {
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
        isMovingEntity: true,
      };

      expect(cacheService.generateRouteKey(reqStatic)).toContain(':sta:');
      expect(cacheService.generateRouteKey(reqMoving)).toContain(':mov:');
    });
  });

  describe('Caching & Expiry', () => {
    it('stores and retrieves successful routes with cached: true flag', () => {
      const req: RouteRequest = {
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      };

      const mockResult: RouteResult = {
        distanceMeters: 2500,
        durationSeconds: 360,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      };

      const key = cacheService.generateRouteKey(req);
      expect(cacheService.get(key)).toBeNull();

      cacheService.set(req, mockResult);

      const cached = cacheService.get(key);
      expect(cached).not.toBeNull();
      expect(cached?.distanceMeters).toBe(2500);
      expect(cached?.cached).toBe(true);
    });

    it('never stores transient failure results (negative caching prevention)', () => {
      const req: RouteRequest = {
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      };

      const timeoutResult: RouteResult = {
        distanceMeters: null,
        durationSeconds: null,
        provider: 'google',
        status: 'TIMEOUT',
        calculatedAt: new Date(),
        cached: false,
      };

      const key = cacheService.generateRouteKey(req);
      cacheService.set(req, timeoutResult);

      expect(cacheService.get(key)).toBeNull();
      expect(cacheService.size).toBe(0);
    });

    it('expires entries after TTL', () => {
      jest.useFakeTimers();

      const req: RouteRequest = {
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
        isMovingEntity: true, // 60s TTL
      };

      const mockResult: RouteResult = {
        distanceMeters: 1800,
        durationSeconds: 240,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      };

      const key = cacheService.generateRouteKey(req);
      cacheService.set(req, mockResult);

      expect(cacheService.get(key)).not.toBeNull();

      // Advance clock by 61 seconds
      jest.advanceTimersByTime(61 * 1000);

      expect(cacheService.get(key)).toBeNull();

      jest.useRealTimers();
    });

    it('evicts least recently accessed entries when reaching max capacity limit', async () => {
      // Service created with maxEntries = 3
      const req1: RouteRequest = { origin: { latitude: 28.1, longitude: 77.1 }, destination: { latitude: 28.2, longitude: 77.2 } };
      const req2: RouteRequest = { origin: { latitude: 28.2, longitude: 77.2 }, destination: { latitude: 28.3, longitude: 77.3 } };
      const req3: RouteRequest = { origin: { latitude: 28.3, longitude: 77.3 }, destination: { latitude: 28.4, longitude: 77.4 } };
      const req4: RouteRequest = { origin: { latitude: 28.4, longitude: 77.4 }, destination: { latitude: 28.5, longitude: 77.5 } };

      const okResult = (m: number): RouteResult => ({
        distanceMeters: m,
        durationSeconds: 100,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      const k1 = cacheService.generateRouteKey(req1);
      const k2 = cacheService.generateRouteKey(req2);
      const k3 = cacheService.generateRouteKey(req3);
      const k4 = cacheService.generateRouteKey(req4);

      cacheService.set(req1, okResult(1000));
      cacheService.set(req2, okResult(2000));
      cacheService.set(req3, okResult(3000));

      expect(cacheService.size).toBe(3);

      // Access req1 and req3 to update their lastAccessedAt
      cacheService.get(k1);
      cacheService.get(k3);

      // Now insert req4 -> should evict req2 (oldest access)
      cacheService.set(req4, okResult(4000));

      expect(cacheService.size).toBe(3);
      expect(cacheService.get(k1)).not.toBeNull();
      expect(cacheService.get(k3)).not.toBeNull();
      expect(cacheService.get(k4)).not.toBeNull();
      expect(cacheService.get(k2)).toBeNull(); // Evicted!
    });
  });

  describe('Request Coalescing (Simultaneous Lookup Deduplication)', () => {
    it('coalesces concurrent requests for identical keys into a single promise', async () => {
      let factoryInvocations = 0;

      const mockFactory = jest.fn(async (): Promise<RouteResult> => {
        factoryInvocations++;
        // Simulate async network latency
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          distanceMeters: 2900,
          durationSeconds: 380,
          provider: 'google',
          status: 'OK',
          calculatedAt: new Date(),
          cached: false,
        };
      });

      const key = 'test-coalesce-key';

      // Launch 5 concurrent calls simultaneously
      const results = await Promise.all([
        cacheService.coalesce(key, mockFactory),
        cacheService.coalesce(key, mockFactory),
        cacheService.coalesce(key, mockFactory),
        cacheService.coalesce(key, mockFactory),
        cacheService.coalesce(key, mockFactory),
      ]);

      expect(factoryInvocations).toBe(1);
      expect(results).toHaveLength(5);
      results.forEach((r) => {
        expect(r.distanceMeters).toBe(2900);
      });
    });
  });
});
