import { apiRequest } from './client';
import type { ServiceZone } from '../utils/serviceZones';

let request: Promise<ServiceZone[]> | undefined;

export function loadServiceZones() {
  request ??= apiRequest<ServiceZone[]>('/public/service-zones').catch((error) => {
    request = undefined;
    throw error;
  });
  return request;
}
