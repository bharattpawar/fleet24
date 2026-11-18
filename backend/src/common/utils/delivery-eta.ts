/**
 * Customer-facing delivery time: prep + pickup handling plus the outlet-to-customer travel time,
 * never less than the platform minimum. Values come from admin delivery settings.
 */
export const DEFAULT_MIN_DELIVERY_MINUTES = 15;
export const DEFAULT_HANDLING_MINUTES = 10;
/** Used only when no road route is available: average two-wheeler speed and road/straight-line ratio. */
const FALLBACK_SPEED_KMPH = 20;
const ROAD_FACTOR = 1.3;
/** Shown as a range: e.g. 15–20 min. */
const RANGE_SPREAD_MINUTES = 5;

export interface DeliveryEtaSettings {
  minDeliveryMinutes?: number;
  handlingMinutes?: number;
}

export interface DeliveryEta {
  minMinutes: number;
  maxMinutes: number;
  /** 'route' when based on a road route, 'estimate' when based on straight-line distance. */
  source: 'route' | 'estimate';
}

export function estimateDeliveryEta(input: {
  travelSeconds?: number | null;
  straightLineMeters?: number | null;
  settings?: DeliveryEtaSettings | null;
}): DeliveryEta | null {
  const minimum = positiveOr(input.settings?.minDeliveryMinutes, DEFAULT_MIN_DELIVERY_MINUTES);
  const handling = positiveOr(input.settings?.handlingMinutes, DEFAULT_HANDLING_MINUTES, true);

  let travelMinutes: number | null = null;
  let source: DeliveryEta['source'] = 'route';
  if (typeof input.travelSeconds === 'number' && Number.isFinite(input.travelSeconds) && input.travelSeconds >= 0) {
    travelMinutes = Math.ceil(input.travelSeconds / 60);
  } else if (
    typeof input.straightLineMeters === 'number' &&
    Number.isFinite(input.straightLineMeters) &&
    input.straightLineMeters >= 0
  ) {
    const roadKm = (input.straightLineMeters / 1000) * ROAD_FACTOR;
    travelMinutes = Math.ceil((roadKm / FALLBACK_SPEED_KMPH) * 60);
    source = 'estimate';
  }
  if (travelMinutes === null) return null;

  const minMinutes = Math.max(minimum, handling + travelMinutes);
  return { minMinutes, maxMinutes: minMinutes + RANGE_SPREAD_MINUTES, source };
}

function positiveOr(value: unknown, fallback: number, allowZero = false): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return allowZero ? (n >= 0 ? n : fallback) : n > 0 ? n : fallback;
}
