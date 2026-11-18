import { useEffect, useId, useRef, useState } from 'react';
import { serviceZonesApi, type PlaceSuggestion, type ResolvedPlace } from '@/lib/api/serviceZones';

export function OutletPlaceSearch({ onSelect }: { onSelect: (place: ResolvedPlace) => void }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const token = useRef<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2 || pending) return;
    let active = true;
    const timer = setTimeout(() => {
      token.current ??= crypto.randomUUID();
      void serviceZonesApi.searchPlaces(query.trim(), token.current).then((result) => {
        if (active) setSuggestions(result);
      }).catch(() => {
        if (active) setError('Could not search for addresses.');
      });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, pending]);

  async function select(place: PlaceSuggestion) {
    if (!token.current || pending) return;
    setPending(true);
    setError('');
    try {
      onSelect(await serviceZonesApi.placeDetails(place.placeId, token.current));
      setQuery('');
      setSuggestions([]);
      token.current = null;
    } catch {
      setError('Could not look up that address.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-semibold text-slate-600 mb-1">Find address</label>
      <input id={id} className="w-full rounded-lg border p-2.5" value={query} disabled={pending}
        onChange={(event) => { setQuery(event.target.value); setSuggestions([]); setError(''); }} />
      {error && <p role="alert">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="max-h-32 overflow-y-auto border rounded-lg">
          {suggestions.map((place) => (
            <li key={place.placeId}>
              <button type="button" className="w-full text-left p-2" disabled={pending} onClick={() => void select(place)}>
                {place.primaryText} {place.secondaryText}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function hasOutletCoordinates(latitude: string, longitude: string): boolean {
  return latitude.trim() !== '' && longitude.trim() !== ''
    && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
}
