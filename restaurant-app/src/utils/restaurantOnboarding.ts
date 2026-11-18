/** Restaurant self-registration: form rules (mirroring the backend), cuisine options and screen gate. */

export type ApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'suspended';
export type RestaurantGate = 'login' | 'register' | 'pending' | 'rejected' | 'suspended' | 'app';

export const CUISINE_OPTIONS = [
  'North Indian',
  'South Indian',
  'Chinese',
  'Biryani',
  'Fast Food',
  'Street Food',
  'Pizza',
  'Rolls & Wraps',
  'Thali',
  'Bakery & Desserts',
  'Beverages',
  'Healthy',
] as const;

export const MAX_CUISINES = 6;

export interface RestaurantGateInput {
  isAuthenticated: boolean;
  applicationStatus: ApplicationStatus | null;
  isEditingApplication: boolean;
}

/** Signed out -> login; no restaurant -> form; under review / rejected / suspended -> status screen. */
export function restaurantGate(input: RestaurantGateInput): RestaurantGate {
  if (!input.isAuthenticated) return 'login';
  if (input.applicationStatus === 'none' || input.isEditingApplication) return 'register';
  if (input.applicationStatus === 'pending') return 'pending';
  if (input.applicationStatus === 'rejected') return 'rejected';
  if (input.applicationStatus === 'suspended') return 'suspended';
  return 'app';
}

export interface RestaurantRegistrationForm {
  restaurantName: string;
  cuisines: string[];
  ownerName: string;
  ownerEmail: string;
  contactPhone: string;
  outletAddress: string;
  latitude: number | null;
  longitude: number | null;
  fssaiNumber: string;
  fssaiExpiry: string;
  panNumber: string;
  gstin: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankAccountNumberConfirm: string;
  bankIfsc: string;
}

export type RestaurantFormErrors = Partial<Record<keyof RestaurantRegistrationForm, string>>;

export const emptyRestaurantForm = (): RestaurantRegistrationForm => ({
  restaurantName: '',
  cuisines: [],
  ownerName: '',
  ownerEmail: '',
  contactPhone: '',
  outletAddress: '',
  latitude: null,
  longitude: null,
  fssaiNumber: '',
  fssaiExpiry: '',
  panNumber: '',
  gstin: '',
  bankAccountHolder: '',
  bankAccountNumber: '',
  bankAccountNumberConfirm: '',
  bankIfsc: '',
});

const noSpaces = (v: string) => v.replace(/\s+/g, '');
const upper = (v: string) => noSpaces(v).toUpperCase();

/** Same checks the server runs, so people see mistakes before submitting. */
export function validateRestaurantForm(form: RestaurantRegistrationForm, today = new Date()): RestaurantFormErrors {
  const e: RestaurantFormErrors = {};
  const name = form.restaurantName.trim();
  if (name.length < 2) e.restaurantName = 'Enter your restaurant name.';
  else if (name.length > 100) e.restaurantName = 'Restaurant name is too long.';

  if (form.cuisines.length === 0) e.cuisines = 'Pick at least one cuisine.';
  else if (form.cuisines.length > MAX_CUISINES) e.cuisines = `Pick up to ${MAX_CUISINES} cuisines.`;

  if (form.ownerName.trim().length < 2) e.ownerName = "Enter the owner's full name.";
  if (form.ownerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail.trim())) {
    e.ownerEmail = 'Enter a valid email address.';
  }
  if (!/^(\+91)?[6-9]\d{9}$/.test(noSpaces(form.contactPhone))) {
    e.contactPhone = 'Enter a valid 10-digit mobile number.';
  }

  if (form.latitude === null || form.longitude === null || !form.outletAddress.trim()) {
    e.outletAddress = 'Search and pick your outlet address.';
  }

  if (!/^\d{14}$/.test(noSpaces(form.fssaiNumber))) e.fssaiNumber = 'FSSAI licence number must be 14 digits.';
  if (form.fssaiExpiry.trim()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.fssaiExpiry.trim());
    const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    if (!date || Number.isNaN(date.getTime()) || date.getMonth() !== Number(m![2]) - 1) {
      e.fssaiExpiry = 'Use the format YYYY-MM-DD.';
    } else if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      e.fssaiExpiry = 'This FSSAI licence has expired. Renew it before applying.';
    }
  }

  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(upper(form.panNumber))) e.panNumber = 'Enter a valid PAN, like ABCDE1234F.';
  if (form.gstin.trim() && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(upper(form.gstin))) {
    e.gstin = 'Enter a valid 15-character GSTIN, or leave it empty.';
  }

  if (form.bankAccountHolder.trim().length < 2) e.bankAccountHolder = 'Enter the account holder name.';
  const account = noSpaces(form.bankAccountNumber);
  if (!/^\d{9,18}$/.test(account)) e.bankAccountNumber = 'Account number must be 9 to 18 digits.';
  else if (account !== noSpaces(form.bankAccountNumberConfirm)) e.bankAccountNumberConfirm = 'Account numbers do not match.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(upper(form.bankIfsc))) e.bankIfsc = 'Enter a valid IFSC, like HDFC0001234.';

  return e;
}

/** Body for POST /restaurant-onboarding. Only call after validateRestaurantForm passes. */
export function toApplicationPayload(form: RestaurantRegistrationForm) {
  const gstin = upper(form.gstin);
  const email = form.ownerEmail.trim();
  const expiry = form.fssaiExpiry.trim();
  return {
    restaurantName: form.restaurantName.trim(),
    cuisines: form.cuisines,
    ownerName: form.ownerName.trim(),
    ...(email ? { ownerEmail: email } : {}),
    contactPhone: noSpaces(form.contactPhone),
    outletAddress: form.outletAddress.trim(),
    latitude: form.latitude as number,
    longitude: form.longitude as number,
    fssaiNumber: noSpaces(form.fssaiNumber),
    ...(expiry ? { fssaiExpiry: expiry } : {}),
    panNumber: upper(form.panNumber),
    ...(gstin ? { gstin } : {}),
    bankAccountHolder: form.bankAccountHolder.trim(),
    bankAccountNumber: noSpaces(form.bankAccountNumber),
    bankIfsc: upper(form.bankIfsc),
  };
}

export function toggleCuisine(selected: string[], cuisine: string): string[] {
  if (selected.includes(cuisine)) return selected.filter((c) => c !== cuisine);
  if (selected.length >= MAX_CUISINES) return selected;
  return [...selected, cuisine];
}
