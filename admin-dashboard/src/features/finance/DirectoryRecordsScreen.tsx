import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { directoryApi, type LedgerEntry, type CustomerFilters } from '@/lib/api/directory';
import { OrderDetailDrawer } from '@/features/orders/components/OrderDetailDrawer';
import { Fields, RecordDrawer, ist, money } from './TransactionsScreen';

const entryTypes = ['order_payment', 'rider_delivery_earning', 'rider_incentive', 'rider_payout', 'rider_payout_reversal',
  'restaurant_order_credit', 'restaurant_commission_debit', 'restaurant_settlement', 'restaurant_settlement_reversal',
  'customer_refund_debit', 'manual_adjustment'];
const label = (value: string) => value.replaceAll('_', ' ');
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const istStart = (date: string) => new Date(`${date}T00:00:00+05:30`);
const linkStyle = 'text-[#205641] underline break-all';

function DirectoryTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-left">
    <thead className="border-b border-[#E3E7EC] bg-[#F5F6F8]"><tr>{headings.map((heading) =>
      <th key={heading} scope="col" className="px-3">{heading}</th>)}</tr></thead>
    <tbody className="divide-y divide-[#E3E7EC]">{children}</tbody>
  </table></div>;
}

function CustomerDrawer({ id, close }: { id: string; close: () => void }) {
  const query = useQuery({ queryKey: ['admin', 'customer', id], queryFn: () => directoryApi.customer(id) });
  const detail = query.data;
  return <RecordDrawer title="Customer profile" close={close}>
    {query.isPending && <p role="status">Loading profile…</p>}
    {query.isError && <p role="alert">Could not load profile. <button className="admin-control" onClick={() => query.refetch()}>Retry</button></p>}
    {detail && <>
      <Fields fields={[
        ['Name', detail.customer.fullName], ['Phone', detail.customer.phone], ['Email', detail.customer.email],
        ['Account status', detail.customer.accountStatus], ['Registered (IST)', ist(detail.customer.createdAt)],
        ['Blocked at (IST)', ist(detail.customer.blockedAt)], ['Block reason', detail.customer.blockedReason],
        ['Orders', detail.orderSummary.totalOrders], ['Delivered', detail.orderSummary.completedOrders],
        ['Cancelled', detail.orderSummary.cancelledOrders],
        ['Delivered order total', money(detail.orderSummary.totalSpentAmount, 'INR')],
      ]} />
      <Link className="admin-primary" to={`/orders?customerId=${id}`}>View all orders</Link>
    </>}
  </RecordDrawer>;
}

export function DirectoryRecordsScreen({ mode }: { mode: 'customers' | 'ledger' }) {
  const customers = mode === 'customers';
  const [params, setParams] = useSearchParams();
  const scopedOrder = params.get('orderId') ?? '';
  return <DirectoryList key={scopedOrder} customers={customers} scopedOrder={scopedOrder} params={params} setParams={setParams} />;
}

function DirectoryList({ customers, scopedOrder, params, setParams }: {
  customers: boolean; scopedOrder: string; params: URLSearchParams; setParams: ReturnType<typeof useSearchParams>[1];
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('created_at:desc');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [entryType, setEntryType] = useState('');
  const [orderId, setOrderId] = useState(scopedOrder);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const invalidDates = Boolean(from && to && from > to);
  const invalidOrder = !customers && Boolean(orderId.trim() && !uuid.test(orderId.trim()));
  const dates = {
    from: from ? istStart(from).toISOString() : undefined,
    to: to ? new Date(istStart(to).getTime() + 86400000 - (customers ? 0 : 1)).toISOString() : undefined,
  };
  const customerFilters: CustomerFilters = {
    page, ...dates, search: search.trim() || undefined, status: (status || undefined) as CustomerFilters['status'],
    sortBy: sort.startsWith('order_count') ? 'order_count' : 'created_at',
    sortOrder: sort.endsWith(':asc') ? 'asc' : 'desc',
  };
  const ledgerFilters = { page, ...dates, orderId: orderId.trim() || undefined,
    entityType: entityType || undefined, entityId: entityId.trim() || undefined, entryType: entryType || undefined };
  const customerQuery = useQuery({ queryKey: ['admin', 'customers', customerFilters], queryFn: () => directoryApi.customers(customerFilters), enabled: customers && !invalidDates });
  const ledgerQuery = useQuery({ queryKey: ['admin', 'ledger', ledgerFilters], queryFn: () => directoryApi.ledger(ledgerFilters), enabled: !customers && !invalidDates && !invalidOrder });
  const query = customers ? customerQuery : ledgerQuery;
  const pagination = customers ? customerQuery.data : ledgerQuery.data?.pagination;
  const selected = params.get('record');
  const orderDrawer = params.get('order');
  const entry = ledgerQuery.data?.items.find((row) => row.id === selected);

  function changeParam(key: string, value?: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }
  const change = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value);
    setPage(1);
  };
  const input = (name: string, value: string, setter: (value: string) => void, type = 'text') =>
    <label className="grid gap-1 text-sm">{name}<input className="admin-control" type={type} value={value} onChange={change(setter)} /></label>;
  const select = (name: string, value: string, setter: (value: string) => void, options: [string, string][]) =>
    <label className="grid gap-1 text-sm">{name}<select className="admin-control" value={value} onChange={change(setter)}>
      {options.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
    </select></label>;

  return <div className="mx-auto max-w-7xl space-y-4">
    <div className="admin-panel p-4">
      <p className="mb-3 text-xs text-slate-600">Date filters use {customers ? 'registration time' : 'ledger entry creation time'} in IST.</p>
      <div className="flex flex-wrap items-end gap-3">
        {customers ? <>
          {input('Search name, phone or email', search, setSearch)}
          {select('Account status', status, setStatus, [['', 'All statuses'], ['active', 'Active'], ['blocked', 'Blocked']])}
          {select('Sort', sort, setSort, [['created_at:desc', 'Newest registered'], ['created_at:asc', 'Oldest registered'], ['order_count:desc', 'Most orders'], ['order_count:asc', 'Fewest orders']])}
        </> : <>
          {select('Entity type', entityType, setEntityType, [['', 'All entities'], ...['rider', 'restaurant', 'platform', 'customer'].map((value): [string, string] => [value, label(value)])])}
          {input('Entity ID', entityId, setEntityId)}
          {input('Order ID', orderId, setOrderId)}
          {select('Entry type', entryType, setEntryType, [['', 'All entries'], ...entryTypes.map((value): [string, string] => [value, label(value)])])}
        </>}
        {input('From', from, setFrom, 'date')}{input('Through', to, setTo, 'date')}
      </div>
    </div>
    {invalidDates || invalidOrder ? <p role="alert">{invalidOrder ? 'Enter a valid order UUID.' : 'The start date must be on or before the end date.'}</p>
      : query.isPending ? <p className="admin-panel p-4" role="status">Loading…</p>
      : query.isError ? <p className="admin-panel p-4" role="alert">Could not load records. <button className="admin-control" onClick={() => query.refetch()}>Retry</button></p>
      : <div className="admin-panel">
        {!pagination?.total || (customers ? !customerQuery.data?.data.length : !ledgerQuery.data?.items.length) ? (
          <p className="p-5">{customers ? 'No customers match these filters.' : orderId ? 'No ledger entries match this order and the selected filters.' : 'No ledger entries match these filters.'}</p>
        ) : customers ? (
          <DirectoryTable headings={['Customer', 'Contact', 'Status', 'Registered (IST)', 'Orders', 'Delivered order total', 'Details']}>
            {customerQuery.data?.data.map((row) => <tr key={row.id} className="[&>td]:px-3">
              <td>{row.fullName || 'Unnamed customer'}</td><td>{row.phone || '—'}<br />{row.email}</td>
              <td className="capitalize">{row.accountStatus}</td><td>{ist(row.createdAt)}</td>
              <td>{row.totalOrders}</td><td>{money(row.totalSpentAmount, 'INR')}</td>
              <td><button className={linkStyle} onClick={() => changeParam('record', row.id)}>View profile</button></td>
            </tr>)}
          </DirectoryTable>
        ) : (
          <DirectoryTable headings={['Created (IST)', 'Entry type', 'Entity', 'Order', 'Direction', 'Amount', 'Currency', 'Reference', 'Details']}>
            {ledgerQuery.data?.items.map((row) => <tr key={row.id} className="[&>td]:px-3">
              <td>{ist(row.createdAt)}</td><td>{label(row.entryType)}</td><td>{row.entityType}<br /><span className="break-all">{row.entityId}</span></td>
              <td>{row.orderId ? <button className={linkStyle} onClick={() => changeParam('order', row.orderId!)}>{row.orderId}</button> : '—'}</td>
              <td className="capitalize">{row.direction}</td><td>{money(row.amount, row.currency)}</td><td>{row.currency}</td>
              <td className="break-all">{row.transactionReference || row.sourceReference || '—'}</td>
              <td><button className={linkStyle} onClick={() => changeParam('record', row.id)}>View entry</button></td>
            </tr>)}
          </DirectoryTable>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-[#E3E7EC] p-3 text-sm">
          <span>{pagination?.total ?? 0} records · Page {page} of {Math.max(1, pagination?.totalPages ?? 1)}</span>
          <div className="flex gap-2">
            <button className="admin-control" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="admin-control" disabled={page >= (pagination?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>}
    {orderDrawer ? <OrderDetailDrawer orderId={orderDrawer} readOnly onClose={() => changeParam('order')} />
      : customers && selected ? <CustomerDrawer key={selected} id={selected} close={() => changeParam('record')} />
      : entry && <LedgerDrawer entry={entry} close={() => changeParam('record')} openOrder={(id) => changeParam('order', id)} />}
  </div>;
}

function LedgerDrawer({ entry, close, openOrder }: { entry: LedgerEntry; close: () => void; openOrder: (id: string) => void }) {
  return <RecordDrawer title="Ledger entry" close={close}>
    <Fields fields={[
      ['Entry ID', entry.id], ['Created (IST)', ist(entry.createdAt)], ['Entry type', label(entry.entryType)],
      ['Entity', `${entry.entityType} · ${entry.entityId}`], ['Direction', entry.direction], ['Amount', money(entry.amount, entry.currency)],
      ['Currency', entry.currency], ['Transaction reference', entry.transactionReference], ['Source reference', entry.sourceReference],
    ]} />
    <div className="flex flex-wrap gap-3">
      {entry.orderId && <button className="admin-control" onClick={() => openOrder(entry.orderId!)}>Open order</button>}
      {entry.paymentId && <Link className="admin-control" to={`/finance/payments?record=${entry.paymentId}`}>Open payment</Link>}
      {entry.refundId && <Link className="admin-control" to={`/finance/refunds?record=${entry.refundId}`}>Open refund</Link>}
    </div>
  </RecordDrawer>;
}
