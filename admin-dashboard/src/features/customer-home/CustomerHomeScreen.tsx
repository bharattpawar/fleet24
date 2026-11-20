import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api/client';

type TargetType = 'category' | 'restaurant' | 'outlet' | 'dish';
type Kind = 'search_hints' | 'banner' | 'tiles' | 'rail' | 'category' | 'row';
type RailFilter = 'all' | 'offers' | 'fast';
type Target = { type: TargetType; id: string; title?: string; subtitle?: string; image?: string };
type Section = {
  kind: Kind;
  title: string;
  image?: string;
  cta?: string;
  eyebrow?: string;
  subtitle?: string;
  hidden?: boolean;
  tabs?: { label: string; filter: RailFilter }[];
  hints?: string[];
  targets: Target[];
};
type Catalog = Record<TargetType, { id: string; name: string }[]>;

const KIND_LABEL: Record<Kind, string> = {
  search_hints: 'Search hints',
  banner: 'Hero banner',
  tiles: 'Offer tiles',
  rail: 'Restaurant rail toggle',
  category: 'Cuisine circle',
  row: 'Curated row',
};
const KIND_HELP: Record<Kind, string> = {
  search_hints: 'Rotating texts in the search bar, e.g. “biryani”. One per Home.',
  banner: 'Big campaign card at the top: small line, headline, offer line, photo and button.',
  tiles: 'Row of small offer cards. Each tile has its own photo, title and sub-line.',
  rail: 'Toggle over nearby restaurants. Offers = outlets with an offer title; Fastest = shortest delivery time.',
  category: 'One round cuisine photo. Tapping it filters Home by that menu category.',
  row: 'Hand-picked outlets or dishes in a horizontal row.',
};
const RAIL_FILTERS: { value: RailFilter; label: string }[] = [
  { value: 'all', label: 'All nearby' },
  { value: 'offers', label: 'With offers' },
  { value: 'fast', label: 'Fastest delivery' },
];

function blankSection(kind: Kind): Section {
  switch (kind) {
    case 'search_hints': return { kind, title: 'Search hints', hints: [''], targets: [] };
    case 'rail': return { kind, title: '', tabs: [{ label: 'Near & Fast', filter: 'fast' }, { label: 'Offers', filter: 'offers' }], targets: [] };
    case 'tiles': return { kind, title: '', targets: [{ type: 'outlet', id: '', title: '', image: '' }] };
    case 'category': return { kind, title: '', targets: [{ type: 'category', id: '' }] };
    default: return { kind, title: '', targets: [{ type: 'outlet', id: '' }] };
  }
}

function move<T>(items: T[], index: number, offset: number) {
  const result = [...items];
  const [item] = result.splice(index, 1);
  result.splice(index + offset, 0, item);
  return result;
}

const field = 'admin-control w-full';

export function CustomerHomeScreen() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [sections, setSections] = useState<Section[]>([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    apiClient.get<{ draft: Section[]; catalog: Catalog }>('/admin/customer-home')
      .then(({ data }) => { setCatalog(data.catalog); setSections(data.draft); })
      .catch(() => setError('Could not load Customer Home. Refresh to retry.'));
  }, []);

  function update(index: number, change: Partial<Section>) {
    setSections(items => items.map((item, i) => i === index ? { ...item, ...change } : item));
  }

  async function save(publish: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiClient.put('/admin/customer-home', { sections, publish });
      setNotice(publish ? 'Customer Home published. Customers see it on their next refresh.' : 'Draft saved.');
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(typeof message === 'string' ? message : 'Could not save Customer Home.');
    } finally {
      setBusy(false);
    }
  }

  const name = (target: Target) => catalog?.[target.type].find(item => item.id === target.id)?.name ?? 'Choose a destination';
  const hasHints = sections.some(section => section.kind === 'search_hints');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <p className="text-sm">
        Everything on the customer app Home comes from here: banners, offer tiles, cuisine photos, rails and search texts.
        Per-restaurant discount text and cover photos are set on each outlet (Restaurants → outlet → Home offer).
      </p>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!catalog ? !error && <p>Loading Customer Home…</p> : (
        <>
          <div className="flex flex-wrap gap-2">
            <button className="admin-control" onClick={() => setPreview(!preview)}>{preview ? 'Edit draft' : 'Preview draft'}</button>
            <button className="admin-control" disabled={busy} onClick={() => void save(false)}>Save draft</button>
            <button className="admin-primary" disabled={busy} onClick={() => void save(true)}>Publish</button>
          </div>
          {preview ? (
            <div className="space-y-4">
              <p className="text-sm">Draft preview. Delivery location and live availability decide which cards each customer sees.</p>
              {sections.filter(section => !section.hidden).map((section, i) => (
                <article key={i} className="admin-panel overflow-hidden">
                  {section.image && <img className="h-32 w-full object-cover" src={section.image} alt="" />}
                  <div className="space-y-1 p-4">
                    <p className="text-xs uppercase">{KIND_LABEL[section.kind]}{section.eyebrow ? ` · ${section.eyebrow}` : ''}</p>
                    <h2 className="font-semibold">{section.title}</h2>
                    {section.subtitle && <p>{section.subtitle}</p>}
                    {section.cta && <p className="font-medium">{section.cta} →</p>}
                    {section.hints && <p className="text-sm">{section.hints.map(hint => `Search for “${hint}”`).join(' · ')}</p>}
                    {section.tabs && <p className="text-sm">{section.tabs.map(tab => tab.label).join(' | ')}</p>}
                    {section.kind === 'tiles' ? (
                      <div className="flex gap-2 overflow-x-auto">
                        {section.targets.map((tile, j) => (
                          <div key={j} className="w-32 shrink-0 rounded border">
                            {tile.image && <img className="h-20 w-full object-cover" src={tile.image} alt="" />}
                            <p className="px-2 text-sm font-semibold">{tile.title}</p>
                            <p className="px-2 pb-2 text-xs">{tile.subtitle}</p>
                          </div>
                        ))}
                      </div>
                    ) : section.targets.length > 0 && <p className="text-sm">{section.targets.map(name).join(' · ')}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <fieldset disabled={busy} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KIND_LABEL) as Kind[]).map(kind => (
                  <button
                    key={kind}
                    className="admin-control"
                    disabled={kind === 'search_hints' && hasHints}
                    onClick={() => setSections([...sections, blankSection(kind)])}
                  >Add {KIND_LABEL[kind].toLowerCase()}</button>
                ))}
              </div>
              {sections.map((section, i) => (
                <article key={i} className="admin-panel space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="mr-auto">{KIND_LABEL[section.kind]}</strong>
                    <label><input type="checkbox" checked={Boolean(section.hidden)} onChange={e => update(i, { hidden: e.target.checked })} /> Hidden</label>
                    <button className="admin-control" disabled={i === 0} onClick={() => setSections(move(sections, i, -1))}>Move up</button>
                    <button className="admin-control" disabled={i === sections.length - 1} onClick={() => setSections(move(sections, i, 1))}>Move down</button>
                    <button className="admin-control" onClick={() => setSections(sections.filter((_, index) => index !== i))}>Remove</button>
                  </div>
                  <p className="text-sm">{KIND_HELP[section.kind]}</p>
                  <label className="block">{section.kind === 'search_hints' ? 'Internal name' : 'Title'}
                    <input className={field} maxLength={100} value={section.title} onChange={e => update(i, { title: e.target.value })} />
                  </label>

                  {section.kind === 'banner' && <>
                    <label className="block">Small line above title (optional) <input className={field} maxLength={30} placeholder="WEEKEND SPECIAL" value={section.eyebrow ?? ''} onChange={e => update(i, { eyebrow: e.target.value })} /></label>
                    <label className="block">Offer line (optional) <input className={field} maxLength={80} placeholder="Flat ₹150 OFF on your favourites" value={section.subtitle ?? ''} onChange={e => update(i, { subtitle: e.target.value })} /></label>
                    <label className="block">Button label <input className={field} maxLength={40} placeholder="Order now" value={section.cta ?? ''} onChange={e => update(i, { cta: e.target.value })} /></label>
                  </>}
                  {(section.kind === 'banner' || section.kind === 'category') && (
                    <label className="block">Photo URL <input type="url" className={field} value={section.image ?? ''} onChange={e => update(i, { image: e.target.value })} /></label>
                  )}

                  {section.kind === 'search_hints' && (
                    <div className="space-y-2">
                      {(section.hints ?? []).map((hint, j) => (
                        <div key={j} className="flex gap-2">
                          <input aria-label={`Search hint ${j + 1}`} className={field} maxLength={40} placeholder="biryani" value={hint} onChange={e => update(i, { hints: section.hints!.map((h, k) => k === j ? e.target.value : h) })} />
                          <button className="admin-control" disabled={(section.hints ?? []).length === 1} onClick={() => update(i, { hints: section.hints!.filter((_, k) => k !== j) })}>Remove</button>
                        </div>
                      ))}
                      <button className="admin-control" disabled={(section.hints ?? []).length >= 10} onClick={() => update(i, { hints: [...(section.hints ?? []), ''] })}>Add hint</button>
                    </div>
                  )}

                  {section.kind === 'rail' && (
                    <div className="space-y-2">
                      {(section.tabs ?? []).map((tab, j) => (
                        <div key={j} className="flex flex-wrap gap-2">
                          <input aria-label={`Tab ${j + 1} label`} className="admin-control" maxLength={30} value={tab.label} onChange={e => update(i, { tabs: section.tabs!.map((t, k) => k === j ? { ...t, label: e.target.value } : t) })} />
                          <select aria-label={`Tab ${j + 1} shows`} className="admin-control" value={tab.filter} onChange={e => update(i, { tabs: section.tabs!.map((t, k) => k === j ? { ...t, filter: e.target.value as RailFilter } : t) })}>
                            {RAIL_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                          <button className="admin-control" disabled={(section.tabs ?? []).length === 1} onClick={() => update(i, { tabs: section.tabs!.filter((_, k) => k !== j) })}>Remove tab</button>
                        </div>
                      ))}
                      <button className="admin-control" disabled={(section.tabs ?? []).length >= 3} onClick={() => update(i, { tabs: [...(section.tabs ?? []), { label: '', filter: 'all' }] })}>Add tab</button>
                    </div>
                  )}

                  {section.targets.map((target, j) => {
                    const types: TargetType[] = section.kind === 'category' ? ['category'] : section.kind === 'row' ? ['outlet', 'dish'] : ['category', 'restaurant', 'outlet', 'dish'];
                    const multi = section.kind === 'row' || section.kind === 'tiles';
                    const max = section.kind === 'tiles' ? 8 : 20;
                    function change(next: Partial<Target>) {
                      update(i, { targets: section.targets.map((value, index) => index === j ? { ...value, ...next } : value) });
                    }
                    return (
                      <div key={j} className={section.kind === 'tiles' ? 'space-y-2 rounded border p-3' : 'flex flex-wrap gap-2'}>
                        {section.kind === 'tiles' && <>
                          <strong className="block text-sm">Tile {j + 1}</strong>
                          <label className="block">Tile title <input className={field} maxLength={40} placeholder="Flat 50% OFF" value={target.title ?? ''} onChange={e => change({ title: e.target.value })} /></label>
                          <label className="block">Tile sub-line (optional) <input className={field} maxLength={40} placeholder="On top biryanis" value={target.subtitle ?? ''} onChange={e => change({ subtitle: e.target.value })} /></label>
                          <label className="block">Tile photo URL <input type="url" className={field} value={target.image ?? ''} onChange={e => change({ image: e.target.value })} /></label>
                        </>}
                        <div className="flex flex-wrap gap-2">
                          <select aria-label="Destination type" className="admin-control" value={target.type} onChange={e => change({ type: e.target.value as TargetType, id: '' })}>
                            {types.map(type => <option key={type}>{type}</option>)}
                          </select>
                          <select aria-label="Destination" className="admin-control min-w-0 max-w-full" value={target.id} onChange={e => change({ id: e.target.value })}>
                            <option value="">Choose destination</option>
                            {catalog[target.type].map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                          {multi && <>
                            <button className="admin-control" disabled={!j} onClick={() => update(i, { targets: move(section.targets, j, -1) })}>Left</button>
                            <button className="admin-control" disabled={j === section.targets.length - 1} onClick={() => update(i, { targets: move(section.targets, j, 1) })}>Right</button>
                            <button className="admin-control" disabled={section.targets.length === 1} onClick={() => update(i, { targets: section.targets.filter((_, index) => index !== j) })}>Remove</button>
                          </>}
                        </div>
                        {j === section.targets.length - 1 && multi && (
                          <button
                            className="admin-control"
                            disabled={section.targets.length >= max}
                            onClick={() => update(i, { targets: [...section.targets, section.kind === 'tiles' ? { type: 'outlet', id: '', title: '', image: '' } : { type: 'outlet', id: '' }] })}
                          >{section.kind === 'tiles' ? 'Add tile' : 'Add card'}</button>
                        )}
                      </div>
                    );
                  })}
                </article>
              ))}
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}
