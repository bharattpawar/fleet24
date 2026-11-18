export interface DeliveryEta {
  minMinutes: number;
  maxMinutes: number;
  source?: 'route' | 'estimate';
}

/** "15–20 min", or null when the server gave no estimate (never a made-up time). */
export function formatEta(eta?: DeliveryEta | null): string | null {
  if (!eta || !Number.isFinite(eta.minMinutes) || !Number.isFinite(eta.maxMinutes)) return null;
  return `${Math.round(eta.minMinutes)}–${Math.round(eta.maxMinutes)} min`;
}
