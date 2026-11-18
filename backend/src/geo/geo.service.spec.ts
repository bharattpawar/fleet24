import 'reflect-metadata';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { GeoService } from './geo.service';

describe('GeoService', () => {
  const config = (values: Record<string, string | undefined>) => ({ get: jest.fn((k: string) => values[k]) }) as any;
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const mockFetch = (status: number, body: unknown) => {
    const fn = jest.fn().mockResolvedValue({ ok: status < 400, status, text: async () => JSON.stringify(body) });
    global.fetch = fn as any;
    return fn;
  };

  it('refuses when no Google key is configured', async () => {
    const service = new GeoService(config({}));
    await expect(service.autocomplete({ input: 'sharda' })).rejects.toThrow(ServiceUnavailableException);
  });

  it('uses GOOGLE_ROUTES_API_KEY as a fallback and keeps the key server-side', async () => {
    const fetchFn = mockFetch(200, {
      suggestions: [{ placePrediction: { placeId: 'ChIJabc123xyz', structuredFormat: { mainText: { text: 'Sharda University' }, secondaryText: { text: 'Knowledge Park III, Greater Noida' } } } }],
    });
    const service = new GeoService(config({ GOOGLE_ROUTES_API_KEY: 'server-key' }));
    const out = await service.autocomplete({ input: 'sharda', latitude: 28.47, longitude: 77.48 });

    expect(out).toEqual([{ placeId: 'ChIJabc123xyz', primaryText: 'Sharda University', secondaryText: 'Knowledge Park III, Greater Noida' }]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(init.headers['X-Goog-Api-Key']).toBe('server-key');
    expect(JSON.parse(init.body)).toMatchObject({ includedRegionCodes: ['in'], locationBias: { circle: { center: { latitude: 28.47, longitude: 77.48 } } } });
  });

  it('normalises place details into address parts', async () => {
    mockFetch(200, {
      formattedAddress: 'Plot 32, Knowledge Park III, Greater Noida, Uttar Pradesh 201310, India',
      location: { latitude: 28.4731234567, longitude: 77.4831234567 },
      addressComponents: [
        { longText: 'Knowledge Park III', types: ['sublocality_level_1', 'sublocality'] },
        { longText: 'Greater Noida', types: ['locality'] },
        { longText: 'Uttar Pradesh', types: ['administrative_area_level_1'] },
        { longText: '201310', types: ['postal_code'] },
      ],
    });
    const service = new GeoService(config({ GOOGLE_MAPS_API_KEY: 'k' }));
    await expect(service.placeDetails('ChIJabc123xyz')).resolves.toEqual({
      latitude: 28.4731235,
      longitude: 77.4831235,
      formattedAddress: 'Plot 32, Knowledge Park III, Greater Noida, Uttar Pradesh 201310, India',
      area: 'Knowledge Park III',
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
      postalCode: '201310',
    });
  });

  it('reverse geocoding keeps the exact pinned point', async () => {
    mockFetch(200, { status: 'OK', results: [{ formatted_address: 'Alpha 2, Greater Noida', address_components: [{ long_name: 'Greater Noida', types: ['locality'] }] }] });
    const service = new GeoService(config({ GOOGLE_MAPS_API_KEY: 'k' }));
    const out = await service.reverseGeocode(28.471, 77.512);
    expect(out.latitude).toBe(28.471);
    expect(out.longitude).toBe(77.512);
    expect(out.city).toBe('Greater Noida');
  });

  it('maps Google errors to a gateway error without leaking details', async () => {
    mockFetch(403, { error: { message: 'API key not valid' } });
    const service = new GeoService(config({ GOOGLE_MAPS_API_KEY: 'k' }));
    await expect(service.autocomplete({ input: 'alpha' })).rejects.toThrow(BadGatewayException);
  });
});
