import { useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { disbursementsApi, type Payout, type Settlement } from '@/lib/api/disbursements';
import { Fields, RecordDrawer, ist, money } from './TransactionsScreen';

const settlementStatuses = ['pending', 'approved', 'processing', 'settled', 'failed'];
const payoutStatuses = ['requested', 'approved', 'rejected', 'processing', 'processed', 'failed'];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const istStart = (day: string) => Date.parse(`${day}T00:00:00+05:30`);

function TransferReference({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  return <span className="break-all">
    {value}
    {value.startsWith('sbx_xfer_') && <span className="ml-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">Sandbox transfer</span>}
  </span>;
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E3E7EC] p-3 text-sm">
    <span>Page {page} of {totalPages}</span>
    <div className="flex gap-2">
      <button className="admin-control" disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</button>
      <button className="admin-control" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  </div>;
}

function RiderEarnings({ riderId }: { riderId: string }) {
  const [page, setPage] = useState(1);
  const balance = useQuery({ queryKey: ['finance', 'balance', riderId], queryFn: () => disbursementsApi.balance(riderId) });
  const earnings = useQuery({ queryKey: ['finance', 'earnings', riderId, page], queryFn: () => disbursementsApi.earnings(riderId, page) });
  const current = balance.data;
  return <section className="space-y-3 border-t border-[#E3E7EC] pt-4">
    <h3 className="font-bold">Current rider balance</h3>
    {balance.isPending && <p role="status">Loading balance…</p>}
    {balance.isError && <p role="alert">Could not load balance. <button className="admin-control" onClick={() => balance.refetch()}>Retry</button></p>}
    {current && <Fields fields={[
      ['Available balance', money(current.availableBalance, current.currency)],
      ['Total earned', money(current.totalEarned, current.currency)],
      ['Total withdrawn', money(current.totalWithdrawn, current.currency)],
      ['Reserved for pending payouts', money(current.reservedPending, current.currency)],
    ]} />}
    <h3 className="font-bold">Rider earnings history</h3>
    <p className="text-sm text-slate-600">These are the rider’s earnings across deliveries and incentives.</p>
    {earnings.isPending && <p role="status">Loading earnings…</p>}
    {earnings.isError && <p role="alert">Could not load earnings. <button className="admin-control" onClick={() => earnings.refetch()}>Retry</button></p>}
    {earnings.data && <>
      {earnings.data.items.length === 0 && <p>No earnings on this page.</p>}
      <ul className="divide-y divide-[#E3E7EC]">
        {earnings.data.items.map((item) => <li key={item.id} className="py-2 text-sm">
          <strong>{money(item.amount, item.currency)}</strong> · {item.entryType.replaceAll('_', ' ')} · {ist(item.createdAt)} IST
          {item.orderId && <div className="break-all text-slate-600">Order {item.orderId}</div>}
        </li>)}
      </ul>
      <Pagination page={page} totalPages={earnings.data.pagination.totalPages} onChange={setPage} />
    </>}
  </section>;
}

function SettlementDetails({ record, close }: { record: Settlement; close: () => void }) {
  return <RecordDrawer title="Restaurant settlement" close={close}>
    <Link className="admin-control inline-flex items-center" to={`/restaurants?record=${record.restaurantId}`}>Open restaurant</Link>
    <Fields fields={[
      ['Restaurant', record.restaurantName], ['Status', <span className="capitalize">{record.status}</span>],
      ['Period start (IST)', ist(record.periodStart)], ['Period end (IST)', ist(record.periodEnd)],
      ['Gross amount', money(record.grossOrderAmount, record.currency)], ['Tax recorded', money(record.taxAmount, record.currency)],
      ['Commission', money(record.commissionAmount, record.currency)], ['Refund deductions', money(record.refundDeductions, record.currency)],
      ['Net payable', money(record.netPayableAmount, record.currency)], ['Settlement reference', record.settlementReference],
      ['Transfer reference', <TransferReference value={record.providerTransferId} />],
      ['Created (IST)', ist(record.createdAt)], ['Approved (IST)', ist(record.approvedAt)],
      ['Settled (IST)', ist(record.settledAt)], ['Last updated (IST)', ist(record.updatedAt)], ['Failure reason', record.failureReason],
    ]} />
  </RecordDrawer>;
}

function PayoutDetails({ record, close }: { record: Payout; close: () => void }) {
  return <RecordDrawer title="Rider payout" close={close}>
    <Link className="admin-control inline-flex items-center" to={`/riders?record=${record.riderId}`}>Open rider profile</Link>
    <Fields fields={[
      ['Rider', record.riderName || record.riderId], ['Status', <span className="capitalize">{record.status}</span>],
      ['Amount', money(record.amount, record.currency)], ['Currency', record.currency],
      ['Transfer reference', <TransferReference value={record.providerTransferId} />],
      ['Requested (IST)', ist(record.requestedAt)], ['Approved (IST)', ist(record.approvedAt)],
      ['Rejected (IST)', ist(record.rejectedAt)], ['Processed (IST)', ist(record.processedAt)],
      ['Created (IST)', ist(record.createdAt)], ['Last updated (IST)', ist(record.updatedAt)],
      ['Rejection reason', record.rejectionReason], ['Failure reason', record.failureReason],
    ]} />
    <RiderEarnings key={record.riderId} riderId={record.riderId} />
  </RecordDrawer>;
}

export function DisbursementsScreen({ mode }: { mode: 'settlements' | 'payouts' }) {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Settlement | Payout | null>(null);
  const settlements = mode === 'settlements';
  const invalidEntity = Boolean(entity.trim() && !uuid.test(entity.trim()));
  const invalidDates = Boolean(from && to && from > to);
  const enabled = !invalidEntity && !invalidDates;
  const filters = {
    page, status: status || undefined,
    from: from ? new Date(istStart(from)).toISOString() : undefined,
    to: to ? new Date(istStart(to) + 86399999).toISOString() : undefined,
  };
  const settlementQuery = useQuery({ queryKey: ['finance', 'settlements', filters, entity.trim()],
    queryFn: () => disbursementsApi.settlements({ ...filters, restaurantId: entity.trim() || undefined }), enabled: enabled && settlements });
  const payoutQuery = useQuery({ queryKey: ['finance', 'payouts', filters, entity.trim()],
    queryFn: () => disbursementsApi.payouts({ ...filters, riderId: entity.trim() || undefined }), enabled: enabled && !settlements });
  const query = settlements ? settlementQuery : payoutQuery;
  const change = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value);
    setPage(1);
  };
  const headings = settlements
    ? ['Restaurant', 'Period (IST)', 'Gross', 'Commission', 'Refund deductions', 'Net payable', 'Status', 'Details']
    : ['Rider', 'Payout amount', 'Currency', 'Status', 'Requested (IST)', 'Transfer reference', 'Details'];

  return <div className="mx-auto max-w-7xl space-y-4">
    <div className="admin-panel p-4">
      <p className="mb-3 text-xs text-slate-600">Date filters use {settlements ? 'settlement' : 'payout record'} creation time in IST.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">{settlements ? 'Restaurant ID' : 'Rider ID'}
          <input className="admin-control" value={entity} onChange={change(setEntity)} />
        </label>
        <label className="grid gap-1 text-sm">Status
          <select className="admin-control" value={status} onChange={change(setStatus)}>
            <option value="">All statuses</option>
            {(settlements ? settlementStatuses : payoutStatuses).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Created from<input type="date" className="admin-control" value={from} onChange={change(setFrom)} /></label>
        <label className="grid gap-1 text-sm">Created through<input type="date" className="admin-control" value={to} onChange={change(setTo)} /></label>
      </div>
    </div>
    {!enabled ? <p role="alert">{invalidEntity ? 'Enter a valid ID.' : 'The start date must be on or before the end date.'}</p>
      : query.isPending ? <p className="admin-panel p-4" role="status">Loading {mode}…</p>
      : query.isError ? <p className="admin-panel p-4" role="alert">Could not load {mode}. <button className="admin-control" onClick={() => query.refetch()}>Retry</button></p>
      : <div className="admin-panel">
        {query.data.items.length === 0 ? <p className="p-4">No {mode} match these filters.</p>
          : <div className="overflow-x-auto"><table className="w-full text-left">
            <thead className="border-b border-[#E3E7EC] bg-[#F5F6F8]"><tr>{headings.map((heading) => <th key={heading} scope="col" className="px-3">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#E3E7EC]">{query.data.items.map((row) => <tr key={row.id} className="[&>td]:px-3">
              {'restaurantId' in row ? <>
                <td>{row.restaurantName}</td><td>{ist(row.periodStart)}<br />{ist(row.periodEnd)}</td>
                <td>{money(row.grossOrderAmount, row.currency)}</td><td>{money(row.commissionAmount, row.currency)}</td>
                <td>{money(row.refundDeductions, row.currency)}</td><td>{money(row.netPayableAmount, row.currency)}</td>
                <td className="capitalize">{row.status}</td>
              </> : <>
                <td>{row.riderName || row.riderId}</td><td>{money(row.amount, row.currency)}</td><td>{row.currency}</td>
                <td className="capitalize">{row.status}</td><td>{ist(row.requestedAt)}</td>
                <td><TransferReference value={row.providerTransferId} /></td>
              </>}
              <td><button className="text-[#205641] underline" onClick={() => setSelected(row)}>View details</button></td>
            </tr>)}</tbody>
          </table></div>}
        <Pagination page={page} totalPages={query.data.pagination.totalPages} onChange={setPage} />
      </div>}
    {selected && ('restaurantId' in selected
      ? <SettlementDetails record={selected} close={() => setSelected(null)} />
      : <PayoutDetails record={selected} close={() => setSelected(null)} />)}
  </div>;
}
