import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api/client';

type TargetType = 'category' | 'restaurant' | 'outlet' | 'dish';
type Target = { type: TargetType; id: string };
type Section = { kind: 'banner' | 'category' | 'row'; title: string; image?: string; cta?: string; hidden?: boolean; targets: Target[] };
type Catalog = Record<TargetType, { id: string; name: string }[]>;

function move<T>(items: T[], index: number, offset: number) {
  const result = [...items];
  const [item] = result.splice(index, 1);
  result.splice(index + offset, 0, item);
  return result;
}

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
      setNotice(publish ? 'Customer Home published.' : 'Draft saved.');
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(typeof message === 'string' ? message : 'Could not save Customer Home.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
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
              <p className="text-sm">Draft preview. Delivery location and live availability determine which cards customers see.</p>
              {sections.filter(section => !section.hidden).map((section, i) => (
                <article key={i} className="admin-panel overflow-hidden">
                  {section.image && <img className="h-32 w-full object-cover" src={section.image} alt="" />}
                  <div className="p-4">
                    <h2 className="font-semibold">{section.title}</h2>
                    {section.cta && <p>{section.cta}</p>}
                    <p className="text-sm">{section.targets.map(target => catalog[target.type].find(item => item.id === target.id)?.name ?? 'Choose a destination').join(' · ')}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <fieldset disabled={busy} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(['banner', 'category', 'row'] as const).map(kind => (
                  <button key={kind} className="admin-control" onClick={() => setSections([...sections, { kind, title: '', targets: [{ type: kind === 'category' ? 'category' : 'outlet', id: '' }] }])}>Add {kind}</button>
                ))}
              </div>
              {sections.map((section, i) => (
                <article key={i} className="admin-panel space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="mr-auto capitalize">{section.kind}</strong>
                    <label><input type="checkbox" checked={Boolean(section.hidden)} onChange={e => update(i, { hidden: e.target.checked })} /> Hidden</label>
                    <button className="admin-control" disabled={i === 0} onClick={() => setSections(move(sections, i, -1))}>Move up</button>
                    <button className="admin-control" disabled={i === sections.length - 1} onClick={() => setSections(move(sections, i, 1))}>Move down</button>
                    <button className="admin-control" onClick={() => setSections(sections.filter((_, index) => index !== i))}>Remove</button>
                  </div>
                  <label className="block">Title <input className="admin-control w-full" maxLength={100} value={section.title} onChange={e => update(i, { title: e.target.value })} /></label>
                  {section.kind !== 'row' && <label className="block">Image URL <input type="url" className="admin-control w-full" value={section.image ?? ''} onChange={e => update(i, { image: e.target.value })} /></label>}
                  {section.kind === 'banner' && <label className="block">CTA label <input className="admin-control w-full" maxLength={40} value={section.cta ?? ''} onChange={e => update(i, { cta: e.target.value })} /></label>}
                  {section.targets.map((target, j) => {
                    const types: TargetType[] = section.kind === 'category' ? ['category'] : section.kind === 'row' ? ['outlet', 'dish'] : ['category', 'restaurant', 'outlet', 'dish'];
                    function change(next: Target) {
                      update(i, { targets: section.targets.map((value, index) => index === j ? next : value) });
                    }
                    return (
                      <div key={j} className="flex flex-wrap gap-2">
                        <select aria-label="Destination type" className="admin-control" value={target.type} onChange={e => change({ type: e.target.value as TargetType, id: '' })}>
                          {types.map(type => <option key={type}>{type}</option>)}
                        </select>
                        <select aria-label="Destination" className="admin-control min-w-0 max-w-full" value={target.id} onChange={e => change({ ...target, id: e.target.value })}>
                          <option value="">Choose destination</option>
                          {catalog[target.type].map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        {section.kind === 'row' && <>
                          <button className="admin-control" disabled={!j} onClick={() => update(i, { targets: move(section.targets, j, -1) })}>Card up</button>
                          <button className="admin-control" disabled={j === section.targets.length - 1} onClick={() => update(i, { targets: move(section.targets, j, 1) })}>Card down</button>
                          <button className="admin-control" disabled={section.targets.length === 1} onClick={() => update(i, { targets: section.targets.filter((_, index) => index !== j) })}>Remove card</button>
                        </>}
                      </div>
                    );
                  })}
                  {section.kind === 'row' && <button className="admin-control" disabled={section.targets.length >= 20} onClick={() => update(i, { targets: [...section.targets, { type: 'outlet', id: '' }] })}>Add card</button>}
                </article>
              ))}
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}
