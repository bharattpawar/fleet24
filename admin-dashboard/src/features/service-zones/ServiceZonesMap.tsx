import { useEffect, useRef, useState } from 'react';
import type { ServiceZone } from '@/lib/api/serviceZones';

declare global {
  interface Window {
    google?: any;
    __fleet24AdminMaps?: Promise<any>;
  }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function loadMaps(key: string): Promise<any> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!window.__fleet24AdminMaps) {
    window.__fleet24AdminMaps = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      script.async = true;
      script.onload = () => (window.google?.maps ? resolve(window.google.maps) : reject(new Error('Maps failed to load')));
      script.onerror = () => reject(new Error('Maps failed to load'));
      document.head.appendChild(script);
    });
  }
  return window.__fleet24AdminMaps;
}

interface Props {
  zones: ServiceZone[];
  /** The zone being drafted in the form, drawn on top in a different colour. */
  draft?: { latitude: number; longitude: number; radiusMeters: number } | null;
  onPickCenter?: (latitude: number, longitude: number) => void;
}

/** Google map showing every service circle; clicking sets the draft centre. Hidden without a browser key. */
export function ServiceZonesMap({ zones, draft, onPickCenter }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const shapes = useRef<any[]>([]);
  const pick = useRef(onPickCenter);
  pick.current = onPickCenter;
  const [failed, setFailed] = useState(!MAPS_KEY);
  const [browserCenter, setBrowserCenter] = useState<{ lat: number; lng: number } | null>(null);
  const first = zones[0];
  const latitude = first?.centerLatitude ?? draft?.latitude ?? browserCenter?.lat;
  const longitude = first?.centerLongitude ?? draft?.longitude ?? browserCenter?.lng;
  const hasZones = zones.length > 0;

  useEffect(() => {
    if (hasZones || !MAPS_KEY || !navigator.geolocation) return;
    let active = true;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (active) setBrowserCenter({ lat: coords.latitude, lng: coords.longitude });
    }, () => {}, { timeout: 8000 });
    return () => { active = false; };
  }, [hasZones]);

  useEffect(() => {
    if (!MAPS_KEY || latitude === undefined || longitude === undefined || map.current) return;
    let cancelled = false;
    loadMaps(MAPS_KEY)
      .then((maps) => {
        if (cancelled || !host.current) return;
        map.current = new maps.Map(host.current, {
          center: { lat: latitude, lng: longitude },
          zoom: 12,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
        });
        map.current.addListener('click', (e: any) => pick.current?.(e.latLng.lat(), e.latLng.lng()));
        draw(maps);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  useEffect(() => {
    if (window.google?.maps && map.current) draw(window.google.maps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, draft]);

  function draw(maps: any) {
    shapes.current.forEach((s) => s.setMap(null));
    shapes.current = [];
    const bounds = new maps.LatLngBounds();
    for (const z of zones) {
      const circle = new maps.Circle({
        map: map.current,
        center: { lat: z.centerLatitude, lng: z.centerLongitude },
        radius: z.radiusMeters,
        strokeColor: z.isActive ? '#24533F' : '#9CA3AF',
        strokeWeight: 2,
        fillColor: z.isActive ? '#24533F' : '#9CA3AF',
        fillOpacity: z.isActive ? 0.12 : 0.05,
        clickable: false,
      });
      shapes.current.push(circle);
      bounds.union(circle.getBounds());
    }
    if (draft) {
      const circle = new maps.Circle({
        map: map.current,
        center: { lat: draft.latitude, lng: draft.longitude },
        radius: draft.radiusMeters,
        strokeColor: '#B4532A',
        strokeWeight: 2,
        fillColor: '#E98755',
        fillOpacity: 0.15,
        clickable: false,
      });
      shapes.current.push(circle);
      bounds.union(circle.getBounds());
    }
    if (!bounds.isEmpty()) map.current.fitBounds(bounds, 40);
  }

  if (failed) {
    return (
      <p className="text-sm" style={{ color: 'var(--admin-muted)' }}>
        Map preview needs <code>VITE_GOOGLE_MAPS_API_KEY</code>. Zones still work without it.
      </p>
    );
  }
  if (latitude === undefined || longitude === undefined) {
    return <p className="text-sm">No service areas to display. Search for a place to add an area.</p>;
  }
  return <div ref={host} aria-label="Map of delivery service areas" style={{ height: 360, borderRadius: 12, overflow: 'hidden' }} />;
}
