import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { serviceZonesApi } from '@/lib/api/serviceZones';
import type { PlaceSuggestion, ServiceZone } from '@/lib/api/serviceZones';
import { ServiceZonesMap } from './ServiceZonesMap';

interface FormState {
  id?: string;
  name: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
}

const EMPTY: FormState = { name: '', latitude: '', longitude: '', radiusKm: '3' };

function errorMessage(err: unknown, fallback: string) {
  const message = isAxiosError(err) ? err.response?.data?.message : undefined;
  if (Array.isArray(message)) return message.join('. ');
  return typeof message === 'string' ? message : fallback;
}

function newToken() {
  return Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
}

/** Admin page to add, edit and switch off delivery service areas (circles). */
export function ServiceZonesScreen() {
  const [zones, setZones] = useState<ServiceZone[]>();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [token, setToken] = useState(newToken);

  const load = () =>
    serviceZonesApi
      .list()
      .then(setZones)
      .catch((err) => setError(errorMessage(err, 'Could not load service areas. Refresh to retry.')));

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!form || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      serviceZonesApi.searchPlaces(query.trim(), token).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query, form, token]);

  const draft = useMemo(() => {
    if (!form) return null;
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const km = Number(form.radiusKm);
    if (!form.latitude || !form.longitude || !Number.isFinite(lat) || !Number.isFinite(lng) || !(km > 0)) return null;
    return { latitude: lat, longitude: lng, radiusMeters: km * 1000 };
  }, [form]);

  function openForm(zone?: ServiceZone) {
    setError('');
    setNotice('');
    setQuery('');
    setSuggestions([]);
    setToken(newToken());
    setForm(
      zone
        ? {
            id: zone.id,
            name: zone.name,
            latitude: String(zone.centerLatitude),
            longitude: String(zone.centerLongitude),
            radiusKm: String(zone.radiusMeters / 1000),
          }
        : EMPTY,
    );
  }

  async function pickPlace(s: PlaceSuggestion) {
    try {
      const place = await serviceZonesApi.placeDetails(s.placeId, token);
      setForm((f) =>
        f && { ...f, name: f.name || s.primaryText, latitude: place.latitude.toFixed(7), longitude: place.longitude.toFixed(7) },
      );
      setQuery('');
      setSuggestions([]);
      setToken(newToken());
    } catch (err) {
      setError(errorMessage(err, 'Could not look up that place.'));
    }
  }

  async function save() {
    if (!form) return;
    const input = {
      name: form.name.trim(),
      centerLatitude: Number(form.latitude),
      centerLongitude: Number(form.longitude),
      radiusKm: Number(form.radiusKm),
    };
    if (!input.name || !draft) {
      setError('Enter a name, a centre (search or click the map) and a radius.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (form.id) await serviceZonesApi.update(form.id, input);
      else await serviceZonesApi.create(input);
      setNotice(form.id ? `Updated ${input.name}.` : `Added ${input.name}. Deliveries are now open there.`);
      setForm(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the service area.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(zone: ServiceZone) {
    setBusy(true);
    setError('');
    try {
      await serviceZonesApi.update(zone.id, { isActive: !zone.isActive });
      setNotice(`${zone.name} is now ${zone.isActive ? 'paused' : 'live'}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not change the service area.'));
    } finally {
      setBusy(false);
    }
  }

  const activeCount = zones?.filter((z) => z.isActive).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Service areas</h1>
          <p className="text-sm" style={{ color: 'var(--admin-muted)' }}>
            Customers can order, restaurants can operate and riders can go online only inside a live area.
          </p>
        </div>
        <button className="admin-primary" onClick={() => openForm()} disabled={busy}>Add service area</button>
      </div>

      {error && <p role="alert" className="text-red-800">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {zones && zones.length === 0 && (
        <p role="status" className="admin-panel p-3">
          No service areas yet, so delivery is open everywhere. Add one to start limiting where Fleet24 delivers.
        </p>
      )}
      {zones && zones.length > 0 && activeCount === 0 && (
        <p role="alert" className="admin-panel p-3 text-red-800">Every service area is paused. No one can order right now.</p>
      )}

      <section className="admin-panel p-3">
        <ServiceZonesMap
          zones={zones ?? []}
          draft={draft}
          onPickCenter={form ? (lat, lng) => setForm((f) => f && { ...f, latitude: lat.toFixed(7), longitude: lng.toFixed(7) }) : undefined}
        />
      </section>

      {form && (
        <section className="admin-panel space-y-3 p-4" aria-label={form.id ? 'Edit service area' : 'Add service area'}>
          <h2 className="text-lg font-bold">{form.id ? 'Edit service area' : 'New service area'}</h2>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Find the centre</span>
            <input
              className="w-full rounded-lg border px-3"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a sector, campus or landmark — or click the map"
            />
          </label>
          {suggestions.length > 0 && (
            <ul className="divide-y rounded-lg border" role="listbox" aria-label="Places">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button type="button" role="option" aria-selected={false} className="w-full px-3 py-2 text-left" onClick={() => void pickPlace(s)}>
                    <strong>{s.primaryText}</strong> <span style={{ color: 'var(--admin-muted)' }}>{s.secondaryText}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-sm font-semibold">Name</span>
              <input className="w-full rounded-lg border px-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Knowledge Park III" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Centre latitude</span>
              <input className="w-full rounded-lg border px-3" inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Centre longitude</span>
              <input className="w-full rounded-lg border px-3" inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Radius (km)</span>
              <input className="w-full rounded-lg border px-3" inputMode="decimal" value={form.radiusKm} onChange={(e) => setForm({ ...form, radiusKm: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button className="admin-primary" onClick={() => void save()} disabled={busy}>{form.id ? 'Save changes' : 'Add area'}</button>
            <button className="admin-control" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
          </div>
        </section>
      )}

      <section className="admin-panel overflow-x-auto p-3">
        {!zones ? (
          !error && <p>Loading service areas…</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr><th>Name</th><th>Centre</th><th>Radius</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-t">
                  <td className="font-semibold">{z.name}</td>
                  <td>{z.centerLatitude.toFixed(5)}, {z.centerLongitude.toFixed(5)}</td>
                  <td>{(z.radiusMeters / 1000).toFixed(1)} km</td>
                  <td>{z.isActive ? 'Live' : 'Paused'}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <button className="admin-control" onClick={() => openForm(z)} disabled={busy}>Edit</button>
                    <button className="admin-control" onClick={() => void toggle(z)} disabled={busy} aria-label={`${z.isActive ? 'Pause' : 'Resume'} ${z.name}`}>
                      {z.isActive ? 'Pause' : 'Resume'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
