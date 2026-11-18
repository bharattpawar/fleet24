import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { zoneAtLocation, type ServiceZone } from '../utils/serviceZones';

let request: Promise<ServiceZone[]> | undefined;

export function loadServiceZones() {
  request ??= apiRequest<ServiceZone[]>('/public/service-zones').catch((error) => {
    request = undefined;
    throw error;
  });
  return request;
}

export function useRiderServiceArea(position: { latitude: number; longitude: number } | null) {
  const [zones, setZones] = useState<ServiceZone[]>([]);

  useEffect(() => {
    let active = true;
    void loadServiceZones().then((result) => {
      if (active) setZones(result);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  return zoneAtLocation(zones, position) ?? 'Fleet24 Delivery Partner';
}
