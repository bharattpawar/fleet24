import { apiRequest } from './client';
import type { ApplicationStatus } from '../utils/restaurantOnboarding';

export interface MyApplication {
  status: ApplicationStatus;
  restaurantId?: string;
  restaurantName?: string;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  /** Previously submitted details, for editing after a rejection. The bank account number comes back masked. */
  application?: {
    restaurantName: string;
    cuisines: string[];
    ownerName: string;
    ownerEmail: string | null;
    contactPhone: string;
    outletAddress: string;
    latitude: number | null;
    longitude: number | null;
    fssaiNumber: string;
    fssaiExpiry: string | null;
    panNumber: string;
    gstin: string | null;
    bankAccountHolder: string;
    bankAccountNumberMasked: string;
    bankIfsc: string;
  } | null;
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

export const onboardingApi = {
  getMyApplication: () => apiRequest<MyApplication>('/restaurant-onboarding/me'),

  submitApplication: (payload: Record<string, unknown>) =>
    apiRequest<{ status: ApplicationStatus; restaurantId: string }>('/restaurant-onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  searchPlaces: (input: string, sessionToken: string) =>
    apiRequest<PlaceSuggestion[]>(
      `/geo/autocomplete?input=${encodeURIComponent(input)}&sessionToken=${encodeURIComponent(sessionToken)}`,
    ),

  placeDetails: (placeId: string, sessionToken: string) =>
    apiRequest<ResolvedPlace>(
      `/geo/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
    ),
};
