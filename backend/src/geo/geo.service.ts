import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  /** Neighbourhood / sector / society line, e.g. "Knowledge Park III". */
  area: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

interface AddressComponent {
  text: string;
  types: string[];
}

/**
 * Server-side proxy for Google Places (New) autocomplete / details and the Geocoding API.
 * Keeps the API key on the server and normalises results for the customer address picker.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private static readonly TIMEOUT_MS = 6000;

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string {
    const key =
      this.configService.get<string>('GOOGLE_MAPS_API_KEY')?.trim() ||
      this.configService.get<string>('GOOGLE_ROUTES_API_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException('Location search is not configured on the server.');
    }
    return key;
  }

  async autocomplete(params: {
    input: string;
    sessionToken?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<PlaceSuggestion[]> {
    const body: Record<string, unknown> = {
      input: params.input,
      includedRegionCodes: ['in'],
      languageCode: 'en',
    };
    if (params.sessionToken) body.sessionToken = params.sessionToken;
    if (params.latitude !== undefined && params.longitude !== undefined) {
      body.locationBias = {
        circle: { center: { latitude: params.latitude, longitude: params.longitude }, radius: 20000 },
      };
    }

    const data = await this.request<any>('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.getApiKey() },
      body: JSON.stringify(body),
    });

    return (data?.suggestions || [])
      .map((s: any) => s.placePrediction)
      .filter((p: any) => p?.placeId)
      .slice(0, 8)
      .map((p: any) => ({
        placeId: p.placeId,
        primaryText: p.structuredFormat?.mainText?.text || p.text?.text || '',
        secondaryText: p.structuredFormat?.secondaryText?.text || '',
      }));
  }

  async placeDetails(placeId: string, sessionToken?: string): Promise<ResolvedLocation> {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken);
    url.searchParams.set('languageCode', 'en');

    const data = await this.request<any>(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': this.getApiKey(),
        'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
      },
    });

    const lat = data?.location?.latitude;
    const lng = data?.location?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new NotFoundException('That place has no location. Please pick another result.');
    }
    const components: AddressComponent[] = (data.addressComponents || []).map((c: any) => ({
      text: c.longText || c.shortText || '',
      types: c.types || [],
    }));
    return this.normalise(lat, lng, data.formattedAddress || '', components);
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<ResolvedLocation> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('language', 'en');
    url.searchParams.set('key', this.getApiKey());

    const data = await this.request<any>(url.toString(), { method: 'GET' });
    if (data?.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.logger.warn(`Geocoding API status ${data.status}: ${data.error_message || ''}`);
      throw new BadGatewayException('Could not look up this location right now.');
    }
    const best = (data?.results || [])[0];
    if (!best) {
      // Still a valid pin: return the coordinates without a street address.
      return this.normalise(latitude, longitude, '', []);
    }
    const components: AddressComponent[] = (best.address_components || []).map((c: any) => ({
      text: c.long_name || c.short_name || '',
      types: c.types || [],
    }));
    // Keep the exact pinned point, not Google's snapped result.
    return this.normalise(latitude, longitude, best.formatted_address || '', components);
  }

  private normalise(
    latitude: number,
    longitude: number,
    formattedAddress: string,
    components: AddressComponent[],
  ): ResolvedLocation {
    const pick = (...types: string[]) => {
      for (const type of types) {
        const hit = components.find((c) => c.types.includes(type));
        if (hit?.text) return hit.text;
      }
      return null;
    };
    return {
      latitude: Number(latitude.toFixed(7)),
      longitude: Number(longitude.toFixed(7)),
      formattedAddress,
      area: pick('sublocality_level_1', 'sublocality', 'neighborhood', 'premise', 'route'),
      city: pick('locality', 'administrative_area_level_3', 'administrative_area_level_2'),
      state: pick('administrative_area_level_1'),
      postalCode: pick('postal_code'),
    };
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GeoService.TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (!res.ok) {
        const message = json?.error?.message || `HTTP ${res.status}`;
        this.logger.warn(`Google location request failed (${res.status}): ${message}`);
        if (res.status === 400) throw new BadRequestException('Invalid location request.');
        if (res.status === 404) throw new NotFoundException('Location not found.');
        throw new BadGatewayException('Location service is unavailable. Please try again.');
      }
      return json as T;
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException || err instanceof BadGatewayException) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Google location request error: ${reason}`);
      throw new BadGatewayException('Location service is unavailable. Please try again.');
    } finally {
      clearTimeout(timer);
    }
  }
}
