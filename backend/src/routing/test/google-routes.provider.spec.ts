import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleRoutesProvider } from '../providers/google-routes.provider';

describe('GoogleRoutesProvider', () => {
  let provider: GoogleRoutesProvider;
  let configService: ConfigService;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const createProvider = async (apiKey: string | null = 'test-mock-api-key', timeoutMs = 3000) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleRoutesProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'GOOGLE_ROUTES_API_KEY') return apiKey;
              if (key === 'ROUTING_TIMEOUT_MS') return timeoutMs;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    return module.get<GoogleRoutesProvider>(GoogleRoutesProvider);
  };

  describe('Configuration & Initialization', () => {
    it('reports isConfigured() = false when API key is missing', async () => {
      provider = await createProvider(null);
      expect(provider.isConfigured()).toBe(false);

      const result = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });

      expect(result.status).toBe('ROUTING_UNAVAILABLE');
      expect(result.distanceMeters).toBeNull();
      expect(result.errorMessage).toContain('not configured');
    });

    it('reports isConfigured() = true when API key is present', async () => {
      provider = await createProvider('valid-api-key');
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('computeRoute (Point-to-Point)', () => {
    beforeEach(async () => {
      provider = await createProvider('mock-key');
    });

    it('validates coordinate boundaries and rejects invalid coordinates', async () => {
      const invalidLat = await provider.computeRoute({
        origin: { latitude: 95.0, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });
      expect(invalidLat.status).toBe('OUT_OF_BOUNDS');
      expect(invalidLat.distanceMeters).toBeNull();

      const invalidLon = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 200.0 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });
      expect(invalidLon.status).toBe('OUT_OF_BOUNDS');

      const nanCoord = await provider.computeRoute({
        origin: { latitude: NaN, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });
      expect(nanCoord.status).toBe('OUT_OF_BOUNDS');
    });

    it('successfully computes road distance and duration from Google Routes', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              distanceMeters: 2840,
              duration: '420s',
            },
          ],
        }),
      });

      const result = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });

      expect(result.status).toBe('OK');
      expect(result.distanceMeters).toBe(2840);
      expect(result.durationSeconds).toBe(420);
      expect(result.provider).toBe('google');
      expect(result.cached).toBe(false);

      // Verify header isolation (API key in X-Goog-Api-Key header, not in URL)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Goog-Api-Key': 'mock-key',
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
          }),
        }),
      );
    });

    it('includes polyline in field mask when requested', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              distanceMeters: 1500,
              duration: '210s',
              polyline: {
                encodedPolyline: 'a~l~Fjk~uOn@...',
              },
            },
          ],
        }),
      });

      const result = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
        includePolyline: true,
      });

      expect(result.status).toBe('OK');
      expect(result.polyline).toBe('a~l~Fjk~uOn@...');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
          }),
        }),
      );
    });

    it('returns ZERO_RESULTS and null distance when no route exists (never 0m)', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [],
        }),
      });

      const result = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });

      expect(result.status).toBe('ZERO_RESULTS');
      expect(result.distanceMeters).toBeNull();
      expect(result.durationSeconds).toBeNull();
    });

    it('handles HTTP 401/403 authorization failures safely without leaking keys', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'API key not valid' } }),
      });

      const result = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });

      expect(result.status).toBe('ROUTING_UNAVAILABLE');
      expect(result.distanceMeters).toBeNull();
      expect(result.errorMessage).toContain('401/403');
      expect(result.errorMessage).not.toContain('mock-key');
    });

    it('handles HTTP 429 quota exhaustion', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Quota exceeded' } }),
      });

      const result = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });

      expect(result.status).toBe('ROUTING_UNAVAILABLE');
      expect(result.errorMessage).toContain('429');
    });

    it('handles HTTP 5xx server errors', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'Service unavailable' } }),
      });

      const result = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });

      expect(result.status).toBe('ROUTING_UNAVAILABLE');
      expect(result.errorMessage).toContain('503');
    });

    it('handles request timeouts correctly with status TIMEOUT', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';
      global.fetch = jest.fn().mockRejectedValueOnce(timeoutError);

      const result = await provider.computeRoute({
        origin: { latitude: 28.4744, longitude: 77.504 },
        destination: { latitude: 28.4682, longitude: 77.5112 },
      });

      expect(result.status).toBe('TIMEOUT');
      expect(result.distanceMeters).toBeNull();
      expect(result.errorMessage).toContain('timed out');
    });
  });

  describe('computeRouteMatrix', () => {
    beforeEach(async () => {
      provider = await createProvider('mock-key');
    });

    it('correctly maps matrix elements by originIndex and destinationIndex, regardless of response order', async () => {
      // Mock 2 origins x 2 destinations returned in reverse/arbitrary order
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            originIndex: 1,
            destinationIndex: 0,
            distanceMeters: 4500,
            duration: '600s',
            condition: 'ROUTE_EXISTS',
          },
          {
            originIndex: 0,
            destinationIndex: 1,
            distanceMeters: 3100,
            duration: '450s',
            condition: 'ROUTE_EXISTS',
          },
          {
            originIndex: 0,
            destinationIndex: 0,
            distanceMeters: 1200,
            duration: '180s',
            condition: 'ROUTE_EXISTS',
          },
          {
            originIndex: 1,
            destinationIndex: 1,
            condition: 'ROUTE_NOT_FOUND',
          },
        ],
      });

      const matrixReq = {
        origins: [
          { id: 'rider-1', location: { latitude: 28.47, longitude: 77.5 } },
          { id: 'rider-2', location: { latitude: 28.48, longitude: 77.51 } },
        ],
        destinations: [
          { id: 'outlet-A', location: { latitude: 28.46, longitude: 77.49 } },
          { id: 'outlet-B', location: { latitude: 28.49, longitude: 77.52 } },
        ],
      };

      const result = await provider.computeRouteMatrix(matrixReq);

      expect(result.elements).toHaveLength(4);

      // (0,0): rider-1 to outlet-A
      const r1A = result.elements.find((e) => e.originId === 'rider-1' && e.destinationId === 'outlet-A');
      expect(r1A).toBeDefined();
      expect(r1A?.status).toBe('OK');
      expect(r1A?.distanceMeters).toBe(1200);
      expect(r1A?.durationSeconds).toBe(180);

      // (0,1): rider-1 to outlet-B
      const r1B = result.elements.find((e) => e.originId === 'rider-1' && e.destinationId === 'outlet-B');
      expect(r1B?.status).toBe('OK');
      expect(r1B?.distanceMeters).toBe(3100);

      // (1,0): rider-2 to outlet-A
      const r2A = result.elements.find((e) => e.originId === 'rider-2' && e.destinationId === 'outlet-A');
      expect(r2A?.status).toBe('OK');
      expect(r2A?.distanceMeters).toBe(4500);

      // (1,1): rider-2 to outlet-B (ROUTE_NOT_FOUND)
      const r2B = result.elements.find((e) => e.originId === 'rider-2' && e.destinationId === 'outlet-B');
      expect(r2B?.status).toBe('ZERO_RESULTS');
      expect(r2B?.distanceMeters).toBeNull();
    });

    it('accounts for missing matrix elements by marking them NOT_FOUND without throwing', async () => {
      // 2x1 matrix where Google omits the second origin element completely
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            originIndex: 0,
            destinationIndex: 0,
            distanceMeters: 2000,
            duration: '300s',
            condition: 'ROUTE_EXISTS',
          },
        ],
      });

      const matrixReq = {
        origins: [
          { id: 'rider-1', location: { latitude: 28.47, longitude: 77.5 } },
          { id: 'rider-2', location: { latitude: 28.48, longitude: 77.51 } },
        ],
        destinations: [{ id: 'outlet-A', location: { latitude: 28.46, longitude: 77.49 } }],
      };

      const result = await provider.computeRouteMatrix(matrixReq);

      expect(result.elements).toHaveLength(2);
      const r1 = result.elements.find((e) => e.originId === 'rider-1');
      const r2 = result.elements.find((e) => e.originId === 'rider-2');

      expect(r1?.status).toBe('OK');
      expect(r1?.distanceMeters).toBe(2000);

      expect(r2?.status).toBe('NOT_FOUND');
      expect(r2?.distanceMeters).toBeNull();
    });
  });
});
