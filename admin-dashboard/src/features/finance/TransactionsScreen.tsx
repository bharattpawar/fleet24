import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { transactionsApi, type RefundStatus } from '@/lib/api/transactions';
import type { PaymentStatus } from '@/types/orders';
import { OrderDetailDrawer } from '@/features/orders/components/OrderDetailDrawer';
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge';

const paymentStatuses: PaymentStatus[] = ['pending', 'captured', 'failed', 'refunded', 'partially_refunded'];
const refundStatuses: RefundStatus[] = ['pending', 'processed', 'failed'];
export const ist = (date: string | null) => date ? new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—';
export const money = (amount: string | number, currency: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(amount));
const paymentLink = (id: string) => `/finance/payments?record=${id}`;
const refundLink = (id: string) => `/finance/refunds?record=${id}`;

function RefundBadge({ status }: { status: RefundStatus }) {
  const color = { pending: 'bg-amber-100 text-amber-900', processed: 'bg-emerald-100 text-emerald-900', failed: 'bg-red-100 text-red-900' }[status];
  return <span className={`rounded-full px-2 py-1 text-xs capitalize ${color}`}>{status}</span>;
}

export function RecordDrawer({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={dialog} aria-label={title} onCancel={(event) => { event.preventDefault(); close(); }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-xl border-l border-[#E3E7EC] bg-white text-[#171A21] backdrop:bg-black/40">
      <header className="sticky top-0 flex items-center justify-between border-b border-[#E3E7EC] bg-white p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        <button className="admin-control" aria-label="Close details" onClick={close}><X size={18} /></button>
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </dialog>
  );
}

export function Fields({ fields }: { fields: [string, ReactNode][] }) {
  return <dl className="divide-y divide-[#E3E7EC]">{fields.map(([label, value]) => (
    <div key={label} className="grid grid-cols-2 gap-3 py-2 text-sm">
      <dt className="text-slate-600">{label}</dt><dd className="break-words">{value ?? '—'}</dd>
    </div>
  ))}</dl>;
}

function TransactionDetail({ mode, id, close, openOrder }: {
  mode: 'payments' | 'refunds'; id: string; close: () => void; openOrder: (id: string) => void;
}) {
  const payment = useQuery({ queryKey: ['finance', 'payment', id], queryFn: () => transactionsApi.payment(id), enabled: mode === 'payments' });
  const refund = useQuery({ queryKey: ['finance', 'refund', id], queryFn: () => transactionsApi.refund(id), enabled: mode === 'refunds' });
  const query = mode === 'payments' ? payment : refund;
  const p = payment.data;
  const r = refund.data;
  const record = query.data;
  return (
    <RecordDrawer title={mode === 'payments' ? 'Payment details' : 'Refund details'} close={close}>
      {query.isPending && <p role="status">Loading details…</p>}
      {query.isError && <p role="alert">Could not load this record. <button className="admin-control" onClick={() => query.refetch()}>Retry</button></p>}
      {record && (
        <div className="flex flex-wrap gap-2">
          <button className="admin-control" onClick={() => openOrder(record.orderId)}>Open order {record.orderNumber}</button>
          <Link className="admin-control inline-flex items-center" to={'/finance/ledger?orderId=' + record.orderId}>View order ledger</Link>
        </div>
      )}
      {mode === 'payments' && p && <>
        <Fields fields={[
          ['Payment amount', money(p.amount, p.currency)], ['Currency', p.currency],
          ['Status', <OrderStatusBadge type="payment" status={p.status} />], ['Paid at (IST)', ist(p.paidAt)],
          ['Created at (IST)', ist(p.createdAt)], ['Customer', p.customer || p.customerPhone],
          ['Restaurant', p.restaurant], ['Outlet', p.outlet], ['Provider', p.provider],
          ['Provider order reference', p.providerOrderId], ['Provider payment reference', p.providerPaymentId],
        ]} />
        <h3 className="font-bold">Related refunds</h3>
        {p.refunds.length === 0 && <p className="text-sm text-slate-600">No related refunds.</p>}
        {p.refunds.map((item) => (
          <Link key={item.id} to={refundLink(item.id)} className="admin-panel flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span>{money(item.amount, item.currency)} · {ist(item.createdAt)} IST</span><RefundBadge status={item.status} />
          </Link>
        ))}
      </>}
      {mode === 'refunds' && r && <>
        <Link className="admin-control inline-flex items-center" to={paymentLink(r.paymentId)}>Open payment</Link>
        <Fields fields={[
          ['Refund amount', money(r.amount, r.currency)], ['Status', <RefundBadge status={r.status} />],
          ['Reason', r.reason], ['Created at (IST)', ist(r.createdAt)], ['Last updated (IST)', ist(r.updatedAt)],
          ['Provider refund reference', r.providerRefundId], ['Needs review', r.isManualReviewRequired ? 'Yes' : 'No'],
          ['Attempts', r.attemptCount], ['Last attempt (IST)', ist(r.lastAttemptAt)],
          ['Next retry (IST)', ist(r.nextRetryAt)], ['Processing lease expires (IST)', ist(r.processingLeaseExpiresAt)],
          ['Last error code', r.lastErrorCode], ['Last error', r.lastErrorMessage],
        ]} />
      </>}
    </RecordDrawer>
  );
}

export function TransactionsScreen({ mode }: { mode: 'payments' | 'refunds' }) {
  const [params, setParams] = useSearchParams();
  const recordId = params.get('record');
  const orderId = params.get('order');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outletId, setOutletId] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [page, setPage] = useState(1);
  const payments = mode === 'payments';
  const invalidDates = Boolean(from && to && from > to);
  const filters = {
    page, search: search.trim() || undefined,
    from: from ? new Date(`${from}T00:00:00+05:30`).toISOString() : undefined,
    to: to ? new Date(Date.parse(`${to}T00:00:00+05:30`) + 86400000).toISOString() : undefined,
  };
  const paymentQuery = useQuery({
    queryKey: ['finance', 'payments', filters, status, outletId],
    queryFn: () => transactionsApi.payments({ ...filters, status: status as PaymentStatus || undefined, outletId: outletId || undefined }),
    enabled: payments && !invalidDates,
  });
  const refundQuery = useQuery({
    queryKey: ['finance', 'refunds', filters, status, needsReview],
    queryFn: () => transactionsApi.refunds({ ...filters, status: status as RefundStatus || undefined, needsReview: needsReview || undefined }),
    enabled: !payments && !invalidDates,
  });
  const outlets = useQuery({ queryKey: ['finance', 'outlets'], queryFn: transactionsApi.outlets, enabled: payments });
  const query = payments ? paymentQuery : refundQuery;
  const headings = payments
    ? ['Order', 'Customer', 'Restaurant / outlet', 'Payment amount', 'Currency', 'Status', 'Paid at (IST)', '']
    : ['Order', 'Refund amount', 'Status', 'Reason', 'Created at (IST)', 'Provider reference', 'Review', ''];

  const updateFilter = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="admin-panel p-4">
        <p className="mb-3 text-xs text-slate-600">Date filters use {payments ? 'payment' : 'refund'} creation time in IST.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold">Search
            <input className="admin-control" value={search} maxLength={120} onChange={updateFilter(setSearch)}
              placeholder={payments ? 'Order, customer or Razorpay reference' : 'Order or provider refund reference'} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">Status
            <select className="admin-control" value={status} onChange={updateFilter(setStatus)}>
              <option value="">All statuses</option>
              {(payments ? paymentStatuses : refundStatuses).map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">Created from
            <input type="date" className="admin-control" value={from} onChange={updateFilter(setFrom)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">Created through
            <input type="date" className="admin-control" value={to} onChange={updateFilter(setTo)} />
          </label>
          {payments ? (
            <label className="grid gap-1 text-xs font-semibold">Outlet
              <select className="admin-control max-w-56" value={outletId} onChange={updateFilter(setOutletId)}>
                <option value="">All outlets</option>
                {outlets.data?.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.restaurant} · {outlet.name}</option>)}
              </select>
            </label>
          ) : (
            <button className={needsReview ? 'admin-primary' : 'admin-control'} aria-pressed={needsReview} onClick={() => { setNeedsReview(!needsReview); setPage(1); }}>Needs review</button>
          )}
        </div>
        {outlets.isError && <p role="alert" className="mt-2 text-sm">Could not load outlets. <button className="admin-control" onClick={() => outlets.refetch()}>Retry outlets</button></p>}
      </div>
      {invalidDates ? <p className="admin-panel p-4" role="alert">The start date must be on or before the end date.</p>
        : query.isPending ? <p className="admin-panel p-4" role="status">Loading {mode}…</p>
        : query.isError ? <p className="admin-panel p-4" role="alert">Could not load {mode}. <button className="admin-control" onClick={() => query.refetch()}>Retry</button></p>
        : <div className="admin-panel">
          {query.data.data.length === 0 ? <p className="p-5 text-sm">No {mode} match these filters.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-[#E3E7EC] bg-[#F5F6F8]"><tr>{headings.map((heading) => <th key={heading} scope="col" className="px-3">{heading || <span className="sr-only">Details</span>}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#E3E7EC]">
                  {payments ? paymentQuery.data?.data.map((row) => (
                    <tr key={row.id} className="[&>td]:px-3">
                      <td>{row.orderNumber}</td><td>{row.customer || row.customerPhone}</td>
                      <td>{row.restaurant}<br /><span className="text-slate-600">{row.outlet}</span></td>
                      <td>{money(row.amount, row.currency)}</td><td>{row.currency}</td>
                      <td><OrderStatusBadge type="payment" status={row.status} /></td><td>{ist(row.paidAt)}</td>
                      <td><Link className="text-[#205641] underline" to={paymentLink(row.id)}>Details</Link></td>
                    </tr>
                  )) : refundQuery.data?.data.map((row) => (
                    <tr key={row.id} className="[&>td]:px-3">
                      <td>{row.orderNumber}</td><td>{money(row.amount, row.currency)}</td><td><RefundBadge status={row.status} /></td>
                      <td className="max-w-64 break-words">{row.reason}</td><td>{ist(row.createdAt)}</td>
                      <td className="break-all">{row.providerRefundId || '—'}</td><td>{row.isManualReviewRequired ? 'Needs review' : '—'}</td>
                      <td><Link className="text-[#205641] underline" to={refundLink(row.id)}>Details</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E3E7EC] p-3 text-sm">
            <span>{query.data.total} records · Page {page} of {Math.max(1, query.data.totalPages)}</span>
            <div className="flex gap-2">
              <button className="admin-control" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="admin-control" disabled={page >= query.data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </div>}
      {orderId ? <OrderDetailDrawer orderId={orderId} readOnly onClose={() => setParams(recordId ? { record: recordId } : {})} />
        : recordId && <TransactionDetail mode={mode} id={recordId} close={() => setParams({})}
          openOrder={(id) => setParams({ record: recordId, order: id })} />}
    </div>
  );
}
