import { Test, TestingModule } from '@nestjs/testing';
import { RoutingService } from '../routing.service';
import { RoutingCacheService } from '../routing-cache.service';
import { ROUTING_PROVIDER_TOKEN, IRoutingProvider } from '../providers/routing-provider.interface';
import { RouteRequest, RouteResult } from '../routing.types';

describe('RoutingService', () => {
  let routingService: RoutingService;
  let mockProvider: jest.Mocked<IRoutingProvider>;
  let cacheService: RoutingCacheService;

  beforeEach(async () => {
    mockProvider = {
      providerName: 'google',
      computeRoute: jest.fn(),
      computeRouteMatrix: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        {
          provide: ROUTING_PROVIDER_TOKEN,
          useValue: mockProvider,
        },
        {
          provide: RoutingCacheService,
          useValue: {
            generateRouteKey: jest.fn().mockReturnValue('test-route-key'),
            get: jest.fn(),
            set: jest.fn(),
            coalesce: jest.fn((key, factory) => factory()),
          },
        },
      ],
    }).compile();

    routingService = module.get<RoutingService>(RoutingService);
    cacheService = module.get<RoutingCacheService>(RoutingCacheService);
  });

  describe('isAvailable', () => {
    it('returns true when provider is configured', () => {
      mockProvider.isConfigured.mockReturnValueOnce(true);
      expect(routingService.isAvailable()).toBe(true);
    });

    it('returns false when provider is not configured', () => {
      mockProvider.isConfigured.mockReturnValueOnce(false);
      expect(routingService.isAvailable()).toBe(false);
    });
  });

  describe('getRoute', () => {
    const sampleReq: RouteRequest = {
      origin: { latitude: 28.4744, longitude: 77.504 },
      destination: { latitude: 28.4682, longitude: 77.5112 },
    };

    it('returns cached result immediately on cache hit without calling provider', async () => {
      const cachedResult: RouteResult = {
        distanceMeters: 2400,
        durationSeconds: 320,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: true,
      };

      (cacheService.get as jest.Mock).mockReturnValueOnce(cachedResult);

      const result = await routingService.getRoute(sampleReq);

      expect(result).toBe(cachedResult);
      expect(result.cached).toBe(true);
      expect(mockProvider.computeRoute).not.toHaveBeenCalled();
    });

    it('calls provider on cache miss and stores successful result in cache', async () => {
      (cacheService.get as jest.Mock).mockReturnValueOnce(null);

      const freshResult: RouteResult = {
        distanceMeters: 2800,
        durationSeconds: 390,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      };

      mockProvider.computeRoute.mockResolvedValueOnce(freshResult);

      const result = await routingService.getRoute(sampleReq);

      expect(mockProvider.computeRoute).toHaveBeenCalledWith(sampleReq);
      expect(cacheService.set).toHaveBeenCalledWith(sampleReq, freshResult);
      expect(result.distanceMeters).toBe(2800);
    });

    it('does not store failed results in cache', async () => {
      (cacheService.get as jest.Mock).mockReturnValueOnce(null);

      const failedResult: RouteResult = {
        distanceMeters: null,
        durationSeconds: null,
        provider: 'google',
        status: 'ROUTING_UNAVAILABLE',
        calculatedAt: new Date(),
        cached: false,
        errorMessage: 'Quota exceeded',
      };

      mockProvider.computeRoute.mockResolvedValueOnce(failedResult);

      const result = await routingService.getRoute(sampleReq);

      expect(result.status).toBe('ROUTING_UNAVAILABLE');
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('Stage 1 Straight-Line Pruning (Haversine lower bound)', () => {
    it('computes spherical distance accurately for coarse pruning', () => {
      // Coordinates approx 2.0 km apart in Greater Noida
      const p1 = { latitude: 28.4744, longitude: 77.504 };
      const p2 = { latitude: 28.4682, longitude: 77.5112 };

      const distanceKm = routingService.getStraightLineDistanceKm(p1, p2);

      expect(distanceKm).toBeGreaterThan(0.9);
      expect(distanceKm).toBeLessThan(1.5);
    });
  });

  describe('getBatchRoutes (Bounded, Chunked Matrix with Cache Reuse)', () => {
    const customerLocation = { latitude: 28.4682, longitude: 77.5112 };
    const batchItems = [
      { id: 'outlet-1', origin: { latitude: 28.4744, longitude: 77.504 }, destination: customerLocation },
      { id: 'outlet-2', origin: { latitude: 28.4600, longitude: 77.520 }, destination: customerLocation },
      { id: 'outlet-3', origin: { latitude: 28.4500, longitude: 77.530 }, destination: customerLocation },
    ];

    it('reuses cached items and only queries matrix for uncached candidates', async () => {
      // outlet-1 is already in cache
      const cachedResult: RouteResult = {
        distanceMeters: 1500,
        durationSeconds: 200,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: true,
      };

      (cacheService.get as jest.Mock)
        .mockReturnValueOnce(cachedResult) // outlet-1 hits cache
        .mockReturnValueOnce(null)          // outlet-2 miss
        .mockReturnValueOnce(null);         // outlet-3 miss

      mockProvider.computeRouteMatrix.mockResolvedValueOnce({
        elements: [
          { originId: 'outlet-2', destinationId: 'destination', distanceMeters: 2200, durationSeconds: 280, status: 'OK' },
          { originId: 'outlet-3', destinationId: 'destination', distanceMeters: 2900, durationSeconds: 350, status: 'OK' },
        ],
        provider: 'google',
        calculatedAt: new Date(),
      });

      const results = await routingService.getBatchRoutes(batchItems);

      expect(results.size).toBe(3);
      expect(results.get('outlet-1')?.distanceMeters).toBe(1500);
      expect(results.get('outlet-1')?.cached).toBe(true);
      expect(results.get('outlet-2')?.distanceMeters).toBe(2200);
      expect(results.get('outlet-3')?.distanceMeters).toBe(2900);

      // Verify only 2 uncached origins were sent to matrix!
      expect(mockProvider.computeRouteMatrix).toHaveBeenCalledWith(
        expect.objectContaining({
          origins: [
            { id: 'outlet-2', location: batchItems[1].origin },
            { id: 'outlet-3', location: batchItems[2].origin },
          ],
        }),
      );

      // Verify cacheService.set was called for fresh successful elements
      expect(cacheService.set).toHaveBeenCalledTimes(2);
    });

    it('chunks matrix requests when uncached candidates exceed maxChunkSize', async () => {
      (cacheService.get as jest.Mock).mockReturnValue(null); // All 3 miss cache

      mockProvider.computeRouteMatrix
        .mockResolvedValueOnce({
          elements: [
            { originId: 'outlet-1', destinationId: 'destination', distanceMeters: 1400, durationSeconds: 180, status: 'OK' },
            { originId: 'outlet-2', destinationId: 'destination', distanceMeters: 2100, durationSeconds: 260, status: 'OK' },
          ],
          provider: 'google',
          calculatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          elements: [
            { originId: 'outlet-3', destinationId: 'destination', distanceMeters: 2800, durationSeconds: 340, status: 'OK' },
          ],
          provider: 'google',
          calculatedAt: new Date(),
        });

      // Max chunk size = 2 (so 3 items must split into 2 matrix calls: 2 + 1)
      const results = await routingService.getBatchRoutes(batchItems, { maxChunkSize: 2 });

      expect(mockProvider.computeRouteMatrix).toHaveBeenCalledTimes(2);
      expect(results.size).toBe(3);
      expect(results.get('outlet-1')?.distanceMeters).toBe(1400);
      expect(results.get('outlet-3')?.distanceMeters).toBe(2800);
    });

    it('handles partial matrix element failures gracefully', async () => {
      (cacheService.get as jest.Mock).mockReturnValue(null);

      mockProvider.computeRouteMatrix.mockResolvedValueOnce({
        elements: [
          { originId: 'outlet-1', destinationId: 'destination', distanceMeters: 1400, durationSeconds: 180, status: 'OK' },
          { originId: 'outlet-2', destinationId: 'destination', distanceMeters: null, durationSeconds: null, status: 'ZERO_RESULTS' },
        ],
        provider: 'google',
        calculatedAt: new Date(),
      });

      const results = await routingService.getBatchRoutes([batchItems[0], batchItems[1]]);

      expect(results.get('outlet-1')?.status).toBe('OK');
      expect(results.get('outlet-1')?.distanceMeters).toBe(1400);
      expect(results.get('outlet-2')?.status).toBe('ZERO_RESULTS');
      expect(results.get('outlet-2')?.distanceMeters).toBeNull();
    });
  });
});
