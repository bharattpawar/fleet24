import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { directoryApi } from '@/lib/api/directory';
import { DirectoryRecordsScreen } from './DirectoryRecordsScreen';

vi.mock('@/lib/api/directory', () => ({
  directoryApi: { customers: vi.fn(), customer: vi.fn(), ledger: vi.fn() },
}));

const orderId = '01234567-0123-4123-8123-012345678901';
const customer = { id: 'c1', fullName: 'Test Customer', phone: null, email: null, accountStatus: 'active' as const,
  blockedAt: null, blockedReason: null, createdAt: '2026-11-13T00:00:00Z' };
const summary = { totalOrders: 25, completedOrders: 20, totalSpentAmount: 2500 };
const pagination = { page: 1, limit: 20, total: 25, totalPages: 2 };

function open(mode: 'customers' | 'ledger', path: string) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  render(<QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={[path]}><DirectoryRecordsScreen mode={mode} /></MemoryRouter>
  </QueryClientProvider>);
}

describe('Customers and ledger', () => {
  it('pages customer search, resets filters, and links the full order history', async () => {
    vi.mocked(directoryApi.customers).mockResolvedValue({ ...pagination, data: [{ ...customer, ...summary }] });
    vi.mocked(directoryApi.customer).mockResolvedValue({ customer, orderSummary: { ...summary, cancelledOrders: 0 } });
    open('customers', '/customers');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(directoryApi.customers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.change(screen.getByLabelText('Search name, phone or email'), { target: { value: 'Test' } });
    await waitFor(() => expect(directoryApi.customers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'Test' })));
    fireEvent.click(await screen.findByRole('button', { name: 'View profile' }));
    expect(await screen.findByRole('link', { name: 'View all orders' })).toHaveAttribute('href', '/orders?customerId=c1');
    expect(within(screen.getByRole('dialog')).getByText('Delivered order total')).toBeVisible();
  });

  it('preserves order and entity filters when closing ledger details and omits unverified links', async () => {
    vi.mocked(directoryApi.ledger).mockResolvedValue({ pagination, items: [{
      id: 'l1', orderId, createdAt: customer.createdAt, entityType: 'rider', entityId: 'r1',
      entryType: 'rider_delivery_earning', direction: 'credit', amount: '20', currency: 'INR',
      transactionReference: 'ref1', sourceReference: 'opaque-ref', paymentId: null, refundId: null,
    }] });
    open('ledger', '/finance/ledger?orderId=' + orderId);
    fireEvent.change(screen.getByLabelText('Entity type'), { target: { value: 'rider' } });
    await waitFor(() => expect(directoryApi.ledger).toHaveBeenLastCalledWith(expect.objectContaining({ orderId, entityType: 'rider' })));
    fireEvent.click(await screen.findByRole('button', { name: 'View entry' }));
    expect(screen.getByText('opaque-ref')).toBeVisible();
    expect(screen.queryByRole('link', { name: /Open (payment|refund)/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(screen.getByLabelText('Entity type')).toHaveValue('rider');
    expect(screen.getByLabelText('Order ID')).toHaveValue(orderId);
  });
});
