import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { transactionsApi } from '@/lib/api/transactions';
import { TransactionsScreen } from './TransactionsScreen';

vi.mock('@/lib/api/transactions', () => ({
  transactionsApi: { payments: vi.fn(), refunds: vi.fn(), payment: vi.fn(), refund: vi.fn(), outlets: vi.fn() },
}));

const payment = {
  id: 'p1', orderId: 'o1', orderNumber: 'FL-123', customer: 'Test customer', customerPhone: '',
  restaurant: 'Test restaurant', outlet: 'Test outlet', outletId: 'outlet1', amount: '90.00',
  currency: 'INR', status: 'captured' as const, paidAt: '2026-11-13T05:00:00Z', createdAt: '2026-11-13T04:00:00Z',
};
const refund = {
  id: 'r1', paymentId: 'p1', orderId: 'o1', orderNumber: 'FL-123', amount: '20.00', currency: 'INR',
  status: 'failed' as const, reason: 'Fixture refund', createdAt: payment.createdAt,
  providerRefundId: null, isManualReviewRequired: true,
};

function open(path: string) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/finance/payments" element={<TransactionsScreen key="payments" mode="payments" />} />
      <Route path="/finance/refunds" element={<TransactionsScreen key="refunds" mode="refunds" />} />
    </Routes></MemoryRouter>
  </QueryClientProvider>);
}

describe('Finance transaction screens', () => {
  it('shows separate attempts, pages and resets filters to page one', async () => {
    vi.mocked(transactionsApi.outlets).mockResolvedValue([]);
    vi.mocked(transactionsApi.payments).mockResolvedValue({
      data: [payment, { ...payment, id: 'p2', status: 'pending', paidAt: null }],
      page: 1, limit: 20, total: 21, totalPages: 2,
    });
    open('/finance/payments');
    expect(await screen.findAllByText('FL-123')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(transactionsApi.payments).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'captured' } });
    await waitFor(() => expect(transactionsApi.payments).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'captured' })));
  });

  it('opens a related refund directly by ID and supports review filtering', async () => {
    vi.mocked(transactionsApi.payment).mockResolvedValue({ ...payment, provider: 'razorpay', providerOrderId: null, providerPaymentId: null, refunds: [refund] });
    vi.mocked(transactionsApi.refunds).mockResolvedValue({ data: [refund], page: 1, limit: 20, total: 1, totalPages: 1 });
    vi.mocked(transactionsApi.refund).mockResolvedValue({
      ...refund, attemptCount: '5', lastAttemptAt: null, nextRetryAt: null,
      processingLeaseExpiresAt: null, lastErrorCode: 'MAX_RETRIES_EXCEEDED', lastErrorMessage: null, updatedAt: refund.createdAt,
    });
    open('/finance/payments?record=p1');
    fireEvent.click(await screen.findByRole('link', { name: /20.00/ }));
    expect(await screen.findByText('MAX_RETRIES_EXCEEDED')).toBeVisible();
    expect(transactionsApi.refund).toHaveBeenCalledWith('r1');
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Needs review' }));
    await waitFor(() => expect(transactionsApi.refunds).toHaveBeenLastCalledWith(expect.objectContaining({ needsReview: true, page: 1 })));
  });
});
