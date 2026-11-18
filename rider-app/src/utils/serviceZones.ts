export interface ServiceZone {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
}

interface Point {
  latitude: number;
  longitude: number;
}

export function zoneAtLocation(zones: ServiceZone[], point: Point | null): string | undefined {
  if (!point) return undefined;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  let nearestDistance = Infinity;
  let nearestName: string | undefined;

  for (const zone of zones) {
    const a = Math.sin(radians(zone.centerLatitude - point.latitude) / 2) ** 2
      + Math.cos(radians(point.latitude)) * Math.cos(radians(zone.centerLatitude))
      * Math.sin(radians(zone.centerLongitude - point.longitude) / 2) ** 2;
    const distance = 12_742_000 * Math.asin(Math.sqrt(Math.min(1, a)));
    if (distance <= zone.radiusMeters && distance < nearestDistance) {
      nearestDistance = distance;
      nearestName = zone.name;
    }
  }
  return nearestName;
}

export function firstZoneCenter(zones: ServiceZone[]): Point | null {
  const first = zones[0];
  if (!first) return null;
  return { latitude: first.centerLatitude, longitude: first.centerLongitude };
}
