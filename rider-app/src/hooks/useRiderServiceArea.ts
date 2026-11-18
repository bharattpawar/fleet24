import { useEffect, useState } from 'react';
import { loadServiceZones } from '../api/serviceZones';
import { zoneAtLocation, type ServiceZone } from '../utils/serviceZones';

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
