import { apiClient } from './client';

export interface ServiceZone {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceZoneInput {
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  isActive?: boolean;
}

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export interface ResolvedPlace {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export const serviceZonesApi = {
  list: async () => (await apiClient.get<ServiceZone[]>('/admin/service-zones')).data,
  create: async (input: ServiceZoneInput) => (await apiClient.post<ServiceZone>('/admin/service-zones', input)).data,
  update: async (id: string, input: Partial<ServiceZoneInput>) =>
    (await apiClient.patch<ServiceZone>(`/admin/service-zones/${id}`, input)).data,
  searchPlaces: async (input: string, sessionToken: string) =>
    (await apiClient.get<PlaceSuggestion[]>('/geo/autocomplete', { params: { input, sessionToken } })).data,
  placeDetails: async (placeId: string, sessionToken: string) =>
    (await apiClient.get<ResolvedPlace>(`/geo/places/${encodeURIComponent(placeId)}`, { params: { sessionToken } })).data,
};
