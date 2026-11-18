import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { promotionsApi, type DiscountType, type Promotion, type PromotionInput } from '@/lib/api/promotions';
import { describeOffer, promotionStatus, toLocalInput } from './promotionText';

interface FormState {
  id?: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  usageLimitPerUser: string;
  totalUsageLimit: string;
  validFrom: string;
  validUntil: string;
}

function emptyForm(): FormState {
  const now = new Date();
  return {
    code: '',
    description: '',
    discountType: 'fixed_amount',
    discountValue: '',
    minOrderAmount: '0',
    maxDiscountAmount: '',
    usageLimitPerUser: '1',
    totalUsageLimit: '',
    validFrom: toLocalInput(now),
    validUntil: toLocalInput(new Date(now.getTime() + 30 * 86400000)),
  };
}

function errorMessage(err: unknown, fallback: string) {
  const message = isAxiosError(err) ? err.response?.data?.message : undefined;
  if (Array.isArray(message)) return message.join('. ');
  return typeof message === 'string' ? message : fallback;
}

const optionalNumber = (value: string) => (value.trim() ? Number(value) : null);

/** Admin page for coupon codes customers enter in the cart. The platform pays for these discounts. */
export function PromotionsScreen() {
  const [items, setItems] = useState<Promotion[]>();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () =>
    promotionsApi.list().then(setItems).catch((err) => setError(errorMessage(err, 'Could not load coupons. Refresh to retry.')));

  useEffect(() => {
    void load();
  }, []);

  function openForm(p?: Promotion) {
    setError('');
    setNotice('');
    setForm(p ? {
      id: p.id,
      code: p.code,
      description: p.description ?? '',
      discountType: p.discountType,
      discountValue: String(Number(p.discountValue)),
      minOrderAmount: String(Number(p.minOrderAmount)),
      maxDiscountAmount: p.maxDiscountAmount ? String(Number(p.maxDiscountAmount)) : '',
      usageLimitPerUser: String(p.usageLimitPerUser),
      totalUsageLimit: p.totalUsageLimit != null ? String(p.totalUsageLimit) : '',
      validFrom: toLocalInput(new Date(p.validFrom)),
      validUntil: toLocalInput(new Date(p.validUntil)),
    } : emptyForm());
  }

  function validate(f: FormState): string {
    if (!f.id && !/^[A-Za-z0-9_-]{3,30}$/.test(f.code.trim())) return 'Code must be 3-30 letters, numbers, - or _.';
    const value = Number(f.discountValue);
    if (!(value > 0)) return 'Enter the discount amount.';
    if (f.discountType === 'percentage' && value > 100) return 'A percentage cannot be more than 100.';
    if (!(Number(f.minOrderAmount) >= 0)) return 'Minimum order must be 0 or more.';
    if (f.maxDiscountAmount.trim() && !(Number(f.maxDiscountAmount) > 0)) return 'Maximum discount must be more than 0.';
    if (!Number.isInteger(Number(f.usageLimitPerUser)) || Number(f.usageLimitPerUser) < 1) return 'Uses per customer must be 1 or more.';
    if (f.totalUsageLimit.trim() && (!Number.isInteger(Number(f.totalUsageLimit)) || Number(f.totalUsageLimit) < 1)) {
      return 'Total uses must be a whole number, or empty for no limit.';
    }
    if (!f.validFrom || !f.validUntil || new Date(f.validUntil) <= new Date(f.validFrom)) return 'Valid until must be after valid from.';
    return '';
  }

  async function save() {
    if (!form) return;
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    const input: PromotionInput = {
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount || 0),
      maxDiscountAmount: form.discountType === 'percentage' ? optionalNumber(form.maxDiscountAmount) : null,
      usageLimitPerUser: Number(form.usageLimitPerUser),
      totalUsageLimit: optionalNumber(form.totalUsageLimit),
      validFrom: new Date(form.validFrom).toISOString(),
      validUntil: new Date(form.validUntil).toISOString(),
    };
    setBusy(true);
    setError('');
    try {
      if (form.id) await promotionsApi.update(form.id, input);
      else await promotionsApi.create({ ...input, code: form.code.trim() });
      setNotice(form.id ? `Updated ${form.code}.` : `Added ${form.code.trim().toUpperCase()}. Customers can use it now.`);
      setForm(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the coupon.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: Promotion) {
    setBusy(true);
    setError('');
    try {
      await promotionsApi.update(p.id, { isActive: !p.isActive });
      setNotice(`${p.code} is now ${p.isActive ? 'paused' : 'live'}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not change the coupon.'));
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, key: keyof FormState, props: Record<string, unknown> = {}) => form && (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <input className="w-full rounded-lg border px-3" value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-sm" style={{ color: 'var(--admin-muted)' }}>
            Codes customers enter in the cart. Fleet24 pays these discounts; restaurants are settled on the full food amount.
            Restaurants set their own dish discounts in the restaurant app.
          </p>
        </div>
        <button className="admin-primary" onClick={() => openForm()} disabled={busy}>Add coupon</button>
      </div>

      {error && <p role="alert" className="text-red-800">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {form && (
        <section className="admin-panel space-y-3 p-4" aria-label={form.id ? 'Edit coupon' : 'Add coupon'}>
          <h2 className="text-lg font-bold">{form.id ? `Edit ${form.code}` : 'New coupon'}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {!form.id && field('Code', 'code', { placeholder: 'e.g. WELCOME50', autoCapitalize: 'characters' })}
            <div className={form.id ? 'sm:col-span-3' : 'sm:col-span-2'}>{field('Description shown to customers', 'description', { placeholder: 'e.g. ₹50 off your first order' })}</div>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Discount type</span>
              <select className="admin-control w-full" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}>
                <option value="fixed_amount">Flat ₹ off</option>
                <option value="percentage">% off</option>
              </select>
            </label>
            {field(form.discountType === 'percentage' ? 'Discount (%)' : 'Discount (₹)', 'discountValue', { inputMode: 'decimal' })}
            {form.discountType === 'percentage'
              ? field('Maximum discount (₹, empty = no cap)', 'maxDiscountAmount', { inputMode: 'decimal' })
              : <div />}
            {field('Minimum food total (₹)', 'minOrderAmount', { inputMode: 'decimal' })}
            {field('Uses per customer', 'usageLimitPerUser', { inputMode: 'numeric' })}
            {field('Total uses (empty = no limit)', 'totalUsageLimit', { inputMode: 'numeric' })}
            {field('Valid from', 'validFrom', { type: 'datetime-local' })}
            {field('Valid until', 'validUntil', { type: 'datetime-local' })}
          </div>
          <div className="flex gap-2">
            <button className="admin-primary" onClick={() => void save()} disabled={busy}>{form.id ? 'Save changes' : 'Add coupon'}</button>
            <button className="admin-control" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
          </div>
        </section>
      )}

      <section className="admin-panel overflow-x-auto p-3">
        {!items ? (
          !error && <p>Loading coupons…</p>
        ) : items.length === 0 ? (
          <p>No coupons yet. Add one to give customers a discount.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr><th>Code</th><th>Offer</th><th>Valid</th><th>Used</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="font-semibold">{p.code}{p.description && <div className="text-sm font-normal" style={{ color: 'var(--admin-muted)' }}>{p.description}</div>}</td>
                  <td>{describeOffer(p)}</td>
                  <td className="text-sm">{new Date(p.validFrom).toLocaleDateString('en-IN')} – {new Date(p.validUntil).toLocaleDateString('en-IN')}</td>
                  <td>{p.timesUsed}{p.totalUsageLimit != null ? ` / ${p.totalUsageLimit}` : ''}</td>
                  <td>{promotionStatus(p)}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <button className="admin-control" onClick={() => openForm(p)} disabled={busy}>Edit</button>
                    <button className="admin-control" onClick={() => void toggle(p)} disabled={busy} aria-label={`${p.isActive ? 'Pause' : 'Resume'} ${p.code}`}>
                      {p.isActive ? 'Pause' : 'Resume'}
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
