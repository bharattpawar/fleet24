import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { disbursementsApi } from '@/lib/api/disbursements';
import { DisbursementsScreen } from './DisbursementsScreen';

vi.mock('@/lib/api/disbursements', () => ({
  disbursementsApi: { settlements: vi.fn(), payouts: vi.fn(), balance: vi.fn(), earnings: vi.fn() },
}));

const id = '12345678-1234-4234-8234-123456789012';
const date = '2026-11-13T00:00:00Z';
const common = { id, currency: 'INR', createdAt: date, updatedAt: date, approvedAt: null, failureReason: null };
const pagination = { page: 1, total: 21, totalPages: 2 };

function open(mode: 'settlements' | 'payouts') {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  render(<QueryClientProvider client={new QueryClient()}>
    <MemoryRouter><DisbursementsScreen mode={mode} /></MemoryRouter>
  </QueryClientProvider>);
}

describe('Read-only disbursements', () => {
  it('filters settlements, preserves pagination around details, and handles missing transfer references', async () => {
    vi.mocked(disbursementsApi.settlements).mockResolvedValue({ pagination, items: [{
      ...common, restaurantId: id, restaurantName: 'Fixture Kitchen', status: 'pending',
      periodStart: date, periodEnd: date, grossOrderAmount: '100', commissionAmount: '10',
      refundDeductions: '5', taxAmount: '3', netPayableAmount: '85', providerTransferId: null,
      settlementReference: 'SETTLE_FIXTURE', settledAt: null,
    }] });
    open('settlements');
    fireEvent.change(screen.getByLabelText('Restaurant ID'), { target: { value: id } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
    fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-11-13' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(disbursementsApi.settlements).toHaveBeenLastCalledWith(expect.objectContaining({
      restaurantId: id, status: 'pending', page: 2, from: '2026-11-12T18:30:00.000Z',
    })));
    fireEvent.click(await screen.findByRole('button', { name: 'View details' }));
    const drawer = within(screen.getByRole('dialog'));
    expect(drawer.getByRole('link', { name: 'Open restaurant' })).toHaveAttribute('href', '/restaurants?record=' + id);
    expect(drawer.getByText('Transfer reference').nextElementSibling).toHaveTextContent('—');
    fireEvent.click(drawer.getByRole('button', { name: 'Close details' }));
    expect(screen.getByText('Page 2 of 2')).toBeVisible();
    expect(screen.getByLabelText('Status')).toHaveValue('pending');
  });

  it('labels sandbox transfers and loads rider balance and earnings separately', async () => {
    vi.mocked(disbursementsApi.payouts).mockResolvedValue({ pagination, items: [{
      ...common, riderId: id, riderName: 'Fixture Rider', amount: '200', status: 'processed',
      requestedAt: date, processedAt: date, rejectedAt: null, rejectionReason: null, providerTransferId: 'sbx_xfer_fixture',
    }] });
    vi.mocked(disbursementsApi.balance).mockResolvedValue({ currency: 'INR', availableBalance: '100', totalEarned: '300', totalWithdrawn: '200', reservedPending: '0' });
    vi.mocked(disbursementsApi.earnings).mockResolvedValue({ pagination, items: [] });
    open('payouts');
    fireEvent.click(await screen.findByRole('button', { name: 'View details' }));
    const drawer = within(screen.getByRole('dialog'));
    expect(drawer.getByText('Sandbox transfer')).toBeVisible();
    expect(drawer.getByRole('link', { name: 'Open rider profile' })).toHaveAttribute('href', '/riders?record=' + id);
    expect(await drawer.findByText('Available balance')).toBeVisible();
    expect(await drawer.findByText('No earnings on this page.')).toBeVisible();
    expect(disbursementsApi.earnings).toHaveBeenCalledWith(id, 1);
  });
});
