import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financialSettingsApi, type SettingsPayload, type SettingsVersion } from '@/lib/api/financialSettings';
import { Fields, RecordDrawer, ist, money } from './TransactionsScreen';
import { riderTables, sections, type SettingsField } from './settingsFields';

type Values = Record<string, string>;
const allFields = sections.flatMap((section) => section.fields.map((field) => ({
  ...field, key: section.key + '.' + field.key,
})));
const readValues = (payload: SettingsPayload): Values => Object.fromEntries(allFields.map(({ key, defaultValue }) => {
  const [group, name] = key.split('.');
  const value = (payload[group as keyof SettingsPayload] as Record<string, unknown> | undefined)?.[name] ?? defaultValue;
  return [key, value == null ? '' : String(value)];
}));
const display = (value: string) => value === 'true' ? 'Yes' : value === 'false' ? 'No' : value.replaceAll('_', ' ') || '—';
const errorText = (error: unknown) => {
  const message = (error as { response?: { data?: { message?: string | string[] } }; message?: string })?.response?.data?.message;
  return Array.isArray(message) ? message.join('. ') : message || (error as Error)?.message || 'Request failed.';
};

function validateNumber(field: SettingsField, value: string) {
  if (field.optional && !value.trim()) return '';
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number)) return 'Enter a number.';
  if (field.integer && !Number.isInteger(number)) return 'Enter a whole number.';
  if (number < (field.min ?? 0)) return `Minimum ${field.min ?? 0}.`;
  if (field.max != null && number > field.max) return `Maximum ${field.max}.`;
  return '';
}

function Field({ field, value, error, update }: { field: SettingsField; value: string; error?: string; update: (value: string) => void }) {
  const common = { className: 'admin-control', 'aria-invalid': Boolean(error) };
  return <label className="grid gap-1 text-sm">
    {field.label}
    {field.checkbox ? <input type="checkbox" checked={value === 'true'} onChange={(event) => update(String(event.target.checked))} />
      : field.options ? <select {...common} value={value} onChange={(event) => update(event.target.value)}>
        {field.options.map((option) => <option key={option} value={option}>{display(option)}</option>)}
      </select>
      : <input {...common} inputMode={field.integer ? 'numeric' : 'decimal'} value={value} onChange={(event) => update(event.target.value)} />}
    {error && <span className="text-red-800">{error}</span>}
  </label>;
}

function SettingsEditor({ baseline, initial, version, close }: {
  baseline: SettingsPayload; initial: SettingsPayload; version?: SettingsVersion; close: () => void;
}) {
  const client = useQueryClient();
  const [values, setValues] = useState(() => readValues(initial));
  const [tables, setTables] = useState<Record<string, Values[]>>(() => ({
    distanceSlabs: (initial.riderEarnings.distanceSlabs ?? []).map(({ upToKm, rate }) => ({ upToKm: String(upToKm), rate: String(rate) })),
    peakHours: (initial.riderEarnings.peakHours ?? []).map(({ startHour, endHour }) => ({ startHour: String(startHour), endHour: String(endHour) })),
  }));
  const [reason, setReason] = useState(version?.changeReason ?? '');
  const [saved, setSaved] = useState(version);
  const [dirty, setDirty] = useState(!version);
  const [errors, setErrors] = useState<Values>({});
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [effective, setEffective] = useState(() => version?.effectiveFrom
    ? new Date(Date.parse(version.effectiveFrom) + 19800000).toISOString().slice(0, 16) : '');
  const [sample, setSample] = useState<Values>({ distance: '5', itemTotal: '500', priorOrders: '3', waiting: '0', discount: '0' });
  const invalidate = () => client.invalidateQueries({ queryKey: ['finance', 'settings'] });
  const save = useMutation({ mutationFn: (settingsPayload: SettingsPayload) => financialSettingsApi.save(saved?.id, { settingsPayload, changeReason: reason.trim() }),
    onSuccess: (result) => { setSaved(result); setDirty(false); setNotice('Draft saved.'); void invalidate(); } });
  const preview = useMutation({ mutationFn: financialSettingsApi.preview });
  const publish = useMutation({ mutationFn: (when: string) => financialSettingsApi.publish(saved!.id, when),
    onSuccess: (result) => { setSaved(result); setConfirm(false); setNotice(result.status === 'scheduled' ? 'Version scheduled.' : 'Version published.'); void invalidate(); } });
  const pending = save.isPending || preview.isPending || publish.isPending;
  const editable = !saved || saved.status === 'draft';

  function parse(forSave: boolean) {
    const issues: Values = {};
    const result: Record<string, Record<string, unknown>> = {};
    for (const section of sections) {
      result[section.key] = {};
      for (const field of section.fields) {
        const key = section.key + '.' + field.key;
        const value = values[key];
        if (field.checkbox) result[section.key][field.key] = value === 'true';
        else if (field.options) result[section.key][field.key] = value;
        else {
          const issue = validateNumber(field, value);
          if (issue) issues[key] = issue;
          else if (value.trim()) result[section.key][field.key] = Number(value);
        }
      }
    }
    for (const table of riderTables) {
      result.riderEarnings[table.key] = tables[table.key].map((row, index) =>
        Object.fromEntries(table.fields.map((field) => {
          const value = row[field.key] ?? '';
          const issue = validateNumber(field, value);
          if (issue) issues[table.key + '.' + index + '.' + field.key] = issue;
          return [field.key, Number(value)];
        })));
    }
    if (forSave && !reason.trim()) issues.reason = 'Enter a reason for the change.';
    if (!forSave) {
      for (const [key, value] of Object.entries(sample)) {
        const issue = validateNumber({ key, label: key, integer: key === 'priorOrders' }, value);
        if (issue) issues[key] = issue;
      }
    }
    setErrors(issues);
    if (Object.keys(issues).length) return;
    return result as unknown as SettingsPayload;
  }

  const before = readValues(baseline);
  const changes: [string, ReactNode][] = allFields.filter(({ key }) => display(before[key]) !== display(values[key]))
    .map(({ label, key }) => [label, `${display(before[key])} → ${display(values[key])}`]);
  for (const table of riderTables) {
    const key = table.key as 'distanceSlabs' | 'peakHours';
    const prior = (baseline.riderEarnings[key] ?? []).map((row) => table.fields.map((field) => String((row as unknown as Values)[field.key])).join(' / '));
    const next = tables[key].map((row) => table.fields.map((field) => row[field.key]).join(' / '));
    if (prior.join(', ') !== next.join(', ')) changes.push([
      `${table.title} (${table.fields.map(({ label }) => label).join(' / ')})`,
      `${prior.join(', ') || '—'} → ${next.join(', ') || '—'}`,
    ]);
  }
  const scheduleTime = effective ? new Date(effective + ':00+05:30') : null;
  const validSchedule = !schedule || Boolean(scheduleTime && scheduleTime.getTime() > Date.now());
  const failure = save.error || preview.error || publish.error;

  return <RecordDrawer title={saved ? `Version ${saved.versionNumber} · ${saved.status}` : 'New settings draft'} close={close}>
    <fieldset disabled={!editable || pending || confirm} className="space-y-4">
      {sections.map((section) => <section className="admin-panel space-y-3 p-3" key={section.key}>
        <h3 className="font-semibold">{section.title}</h3>
        <div className="grid gap-3 sm:grid-cols-2">{section.fields.map((field) => {
          const key = section.key + '.' + field.key;
          return <Field key={key} field={field} value={values[key]} error={errors[key]}
            update={(value) => { setValues({ ...values, [key]: value }); setDirty(true); preview.reset(); }} />;
        })}</div>
        {section.key === 'riderEarnings' && riderTables.map((table) => <div className="space-y-2" key={table.key}>
          <h4 className="text-sm font-semibold">{table.title}</h4>
          {tables[table.key].map((row, index) => <div className="grid items-end gap-2 sm:grid-cols-3" key={index}>
            {table.fields.map((field) => <Field key={field.key} field={field} value={row[field.key] ?? ''} error={errors[table.key + '.' + index + '.' + field.key]}
              update={(value) => {
                setTables({ ...tables, [table.key]: tables[table.key].map((entry, i) => i === index ? { ...entry, [field.key]: value } : entry) });
                setDirty(true); preview.reset();
              }} />)}
            <button className="admin-control" onClick={() => { setTables({ ...tables, [table.key]: tables[table.key].filter((_, i) => i !== index) }); setDirty(true); preview.reset(); }}>Remove</button>
          </div>)}
          <button className="admin-control" onClick={() => { setTables({ ...tables, [table.key]: [...tables[table.key], {}] }); setDirty(true); preview.reset(); }}>Add {table.key === 'peakHours' ? 'peak slot' : 'slab'}</button>
        </div>)}
      </section>)}
      <label className="grid gap-1 text-sm">Change reason<textarea className="admin-control" maxLength={500} value={reason} aria-invalid={Boolean(errors.reason)}
        onChange={(event) => { setReason(event.target.value); setDirty(true); }} />
        {errors.reason && <span className="text-red-800">{errors.reason}</span>}
      </label>
      <button className="admin-primary" onClick={() => { const payload = parse(true); if (payload) save.mutate(payload); }}>
        {save.isPending ? 'Saving…' : 'Save draft'}
      </button>
      <section className="admin-panel space-y-3 p-3">
        <h3 className="font-semibold">Calculation preview</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries({ distance: 'Delivery distance (km)', itemTotal: 'Item total (₹)', priorOrders: 'Prior completed orders', waiting: 'Waiting time (minutes)', discount: 'Discount (₹)' }).map(([key, label]) =>
            <Field key={key} field={{ key, label }} value={sample[key]} error={errors[key]} update={(value) => { setSample({ ...sample, [key]: value }); preview.reset(); }} />)}
        </div>
        <button className="admin-control" onClick={() => {
          const payload = parse(false);
          if (payload) preview.mutate({ proposedSettings: payload,
            riderSample: { distanceKm: Number(sample.distance), waitingMinutes: Number(sample.waiting) },
            restaurantSample: { itemTotal: Number(sample.itemTotal), discountAmount: Number(sample.discount) },
            customerSample: { distanceKm: Number(sample.distance), customerPriorCompletedOrdersCount: Number(sample.priorOrders) } });
        }}>{preview.isPending ? 'Calculating…' : 'Run preview'}</button>
      </section>
    </fieldset>
    <section className="admin-panel p-3">
      <h3 className="font-semibold">Changes from active settings</h3>
      {changes.length ? <Fields fields={changes} /> : <p className="mt-2 text-sm text-slate-600">No settings values changed.</p>}
    </section>
    {preview.data && <section aria-label="Preview results" className="admin-panel p-3">
      <Fields fields={[
        ['Rider earning', money(preview.data.riderCalculation.finalEarning, 'INR')],
        ['Rider base fare', money(preview.data.riderCalculation.baseFare, 'INR')],
        ['Rider distance earnings', money(preview.data.riderCalculation.distanceEarning, 'INR')],
        ['Rider incentives', money(preview.data.riderCalculation.incentives, 'INR')],
        ['Rider waiting earnings', money(preview.data.riderCalculation.waitingTimeEarning, 'INR')],
        ['Restaurant commission', money(preview.data.restaurantCalculation.totalCommission, 'INR')],
        ['Commission basis amount', money(preview.data.restaurantCalculation.commissionBasisAmount, 'INR')],
        ['Fixed commission', money(preview.data.restaurantCalculation.fixedCommission, 'INR')],
        ['Customer delivery fee', money(preview.data.customerCalculation.deliveryFee, 'INR')],
        ['Fee calculation', preview.data.customerCalculation.reason],
      ]} />
      <p className="text-sm">{preview.data.notice}</p>
    </section>}
    {editable && saved && !dirty && <section className="admin-panel space-y-3 p-3">
      <h3 className="font-semibold">{confirm ? `Confirm publish · Version ${saved.versionNumber}` : 'Publish saved draft'}</h3>
      {!confirm ? <>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={schedule} onChange={(event) => setSchedule(event.target.checked)} />Schedule activation</label>
        {schedule && <label className="grid gap-1 text-sm">Effective time (IST)
          <input className="admin-control" type="datetime-local" value={effective} onChange={(event) => setEffective(event.target.value)} />
          {!validSchedule && <span className="text-red-800">Choose a future time.</span>}
        </label>}
        <button className="admin-primary" disabled={!validSchedule || pending} onClick={() => setConfirm(true)}>Review publish</button>
      </> : <>
        <p className="text-sm">{schedule && scheduleTime ? `Effective ${ist(scheduleTime.toISOString())} IST` : 'Effective immediately on confirmation'}</p>
        {changes.length > 0 && <Fields fields={changes} />}
        <div className="flex gap-2">
          <button className="admin-control" disabled={pending} onClick={() => setConfirm(false)}>Back</button>
          <button className="admin-primary" disabled={!validSchedule || pending} onClick={() => publish.mutate(schedule ? scheduleTime!.toISOString() : new Date().toISOString())}>
            {publish.isPending ? 'Publishing…' : 'Confirm publish'}
          </button>
        </div>
      </>}
    </section>}
    {notice && <p role="status">{notice}</p>}
    {failure && <p role="alert" className="text-red-800">{errorText(failure)}</p>}
  </RecordDrawer>;
}

export function FinancialSettingsScreen() {
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<'new' | SettingsVersion | null>(null);
  const active = useQuery({ queryKey: ['finance', 'settings', 'active'], queryFn: financialSettingsApi.active, refetchInterval: 60000 });
  const history = useQuery({ queryKey: ['finance', 'settings', 'history', page], queryFn: () => financialSettingsApi.history(page), refetchInterval: 60000 });
  const current = active.data;
  const values = current ? readValues(current.settings) : null;
  return <div className="mx-auto max-w-7xl space-y-4">
    <section className="admin-panel space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-bold">Active settings</h2>{current && <p className="text-sm">Version {current.versionNumber} · {current.effectiveFrom ? `Effective ${ist(current.effectiveFrom)} IST` : 'Default configuration'}</p>}</div>
        <button className="admin-primary" disabled={!current || active.isError} onClick={() => setEditor('new')}>New draft</button>
      </div>
      {active.isPending && <p role="status">Loading active settings…</p>}
      {active.isError && <p role="alert">{errorText(active.error)} <button className="admin-control" onClick={() => active.refetch()}>Retry</button></p>}
      {values && <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section) => <details className="rounded-lg border border-[#E3E7EC] p-3" key={section.key}>
          <summary className="cursor-pointer font-semibold">{section.title}</summary>
          <Fields fields={section.fields.map((field) => [field.label, display(values[section.key + '.' + field.key])])} />
          {section.key === 'riderEarnings' && current && riderTables.map((table) => {
            const entries = current.settings.riderEarnings[table.key as 'distanceSlabs' | 'peakHours'] ?? [];
            return <Fields key={table.key} fields={[[table.title, entries.map((entry) =>
              table.fields.map((field) => field.label + ' ' + (entry as unknown as Values)[field.key]).join(', ')).join(' · ') || '—']]} />;
          })}
        </details>)}
      </div>}
    </section>
    <section className="admin-panel p-5">
      <h2 className="font-bold">Version history</h2>
      {history.isPending && <p role="status">Loading history…</p>}
      {history.isError && <p role="alert">{errorText(history.error)} <button className="admin-control" onClick={() => history.refetch()}>Retry</button></p>}
      {history.data?.items.length === 0 && <p className="mt-2 text-sm">No saved versions.</p>}
      {history.data?.items.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3E7EC] py-3 text-sm">
        <span>Version {version.versionNumber} · <strong className="capitalize">{version.status}</strong></span>
        <span>{version.effectiveFrom ? `${ist(version.effectiveFrom)} IST` : 'Effective time unset'}</span>
        <span className="break-all">{version.changeReason}</span>
        {version.status === 'draft' && <button className="admin-control" disabled={!current || active.isError} onClick={() => setEditor(version)}>Edit draft</button>}
      </div>)}
      {history.data && <div className="mt-3 flex items-center gap-3 text-sm">
        <button className="admin-control" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {history.data.pagination.totalPages}</span>
        <button className="admin-control" disabled={page >= history.data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>}
    </section>
    {editor && current && <SettingsEditor baseline={current.settings} initial={editor === 'new' ? current.settings : editor.settingsPayload}
      version={editor === 'new' ? undefined : editor} close={() => setEditor(null)} />}
  </div>;
}
