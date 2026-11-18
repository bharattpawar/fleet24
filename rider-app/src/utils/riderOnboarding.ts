/** Rider sign-up: which screen to show, and the registration form rules (mirrors the backend). */

export type RiderVehicleType = 'bicycle' | 'motorcycle' | 'scooter' | 'ev' | 'other';

export const VEHICLE_OPTIONS: Array<{ value: RiderVehicleType; label: string }> = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'ev', label: 'Electric' },
  { value: 'bicycle', label: 'Cycle' },
  { value: 'other', label: 'Other' },
];

export type RiderGate = 'login' | 'register' | 'pending' | 'rejected' | 'app';

export interface RiderGateInput {
  isAuthenticated: boolean;
  isMockSession: boolean;
  needsRegistration: boolean;
  isEditingApplication: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | null;
}

/** Signed out -> login. No rider profile (or re-applying) -> form. Not yet approved -> waiting screen. */
export function riderGate(input: RiderGateInput): RiderGate {
  if (!input.isAuthenticated) return 'login';
  if (input.isMockSession) return 'app';
  if (input.needsRegistration || input.isEditingApplication) return 'register';
  if (input.verificationStatus === 'rejected') return 'rejected';
  if (input.verificationStatus === 'approved') return 'app';
  return 'pending';
}

export interface RiderRegistrationForm {
  fullName: string;
  vehicleType: RiderVehicleType;
  vehicleNumber: string;
  licenseNumber: string;
}

export type RiderFormErrors = Partial<Record<keyof RiderRegistrationForm, string>>;

/** Vehicle number and licence are needed for motor vehicles, optional for a cycle. */
export function needsVehicleDocuments(vehicleType: RiderVehicleType): boolean {
  return vehicleType !== 'bicycle';
}

export function validateRiderForm(form: RiderRegistrationForm): RiderFormErrors {
  const errors: RiderFormErrors = {};
  const name = form.fullName.trim();
  if (name.length < 2) errors.fullName = 'Enter your full name.';
  else if (name.length > 100) errors.fullName = 'Name is too long.';

  if (needsVehicleDocuments(form.vehicleType)) {
    const plate = normalizeId(form.vehicleNumber);
    if (!plate) errors.vehicleNumber = 'Enter your vehicle number.';
    else if (plate.length < 6 || plate.length > 13) errors.vehicleNumber = 'Enter a valid vehicle number, like UP16AB1234.';

    const licence = normalizeId(form.licenseNumber);
    if (!licence) errors.licenseNumber = 'Enter your driving licence number.';
    else if (licence.length < 8 || licence.length > 20) errors.licenseNumber = 'Enter a valid driving licence number.';
  }
  return errors;
}

/** Uppercase, no spaces: "up 16 ab 1234" -> "UP16AB1234". Keeps hyphens people type in licences. */
export function normalizeId(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** The body for POST /riders/profile; optional fields are left out when empty. */
export function toRiderProfilePayload(form: RiderRegistrationForm) {
  const vehicleNumber = normalizeId(form.vehicleNumber);
  const licenseNumber = normalizeId(form.licenseNumber);
  return {
    fullName: form.fullName.trim(),
    vehicleType: form.vehicleType,
    ...(vehicleNumber ? { vehicleNumber } : {}),
    ...(licenseNumber ? { licenseNumber } : {}),
  };
}
