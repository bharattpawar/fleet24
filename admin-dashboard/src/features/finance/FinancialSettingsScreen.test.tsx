import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financialSettingsApi, type SettingsPayload } from '@/lib/api/financialSettings';
import { FinancialSettingsScreen } from './FinancialSettingsScreen';

vi.mock('@/lib/api/financialSettings', () => ({
  financialSettingsApi: { active: vi.fn(), history: vi.fn(), save: vi.fn(), preview: vi.fn(), publish: vi.fn() },
}));
const settings: SettingsPayload = {
  customerDeliveryFee: { freeOrderThresholdCount: 1, baseDeliveryFeeAfterFree: 20 },
  restaurantMonthlyCreditBlock: { monthlyDeliveriesQuota: 10, additionalPerDeliveryFee: 10, billingPeriodMonths: 1 },
  restaurantCommission: { commissionPercentage: 10, commissionBasis: 'item_total' },
  riderEarnings: { calculationStrategy: 'fixed_per_delivery', baseEarning: 30 },
  incentives: {},
  deliveryServiceability: { maxRoadDistanceMeters: 10000 },
};
const draft = { id: 'draft-2', versionNumber: 2, status: 'draft' as const, settingsPayload: settings, changeReason: 'Fixture', effectiveFrom: null };
function open() {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <FinancialSettingsScreen />
  </QueryClientProvider>);
}

describe('Financial settings', () => {
  it('validates, previews independently, saves, and confirms a scheduled publish', async () => {
    vi.mocked(financialSettingsApi.active).mockResolvedValue({ versionId: 'active', versionNumber: 1, settings, effectiveFrom: null });
    vi.mocked(financialSettingsApi.history).mockResolvedValue({ items: [{ ...draft, status: 'scheduled', effectiveFrom: '2099-01-01T12:00:00Z' }], pagination: { totalPages: 1 } });
    vi.mocked(financialSettingsApi.preview).mockResolvedValue({
      notice: 'Fixture simulation',
      riderCalculation: { finalEarning: 30, baseFare: 30, distanceEarning: 0, incentives: 0, waitingTimeEarning: 0 },
      restaurantCalculation: { totalCommission: 50, commissionBasisAmount: 500, commissionAmount: 50, fixedCommission: 0 },
      customerCalculation: { deliveryFee: 25, reason: 'Standard fee', isFreeDelivery: false },
    });
    vi.mocked(financialSettingsApi.save).mockResolvedValue(draft);
    vi.mocked(financialSettingsApi.publish).mockRejectedValueOnce(new Error('Publish failed')).mockResolvedValueOnce({ ...draft, status: 'scheduled' });
    open();
    expect(await screen.findByText('scheduled')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'New draft' }));
    fireEvent.change(screen.getByLabelText('Base delivery fee (\u20b9)'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByText('Minimum 0.')).toBeVisible();
    expect(financialSettingsApi.save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Base delivery fee/), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run preview' }));
    expect(await screen.findByText('Fixture simulation')).toBeVisible();
    expect(financialSettingsApi.save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Change reason/), { target: { value: 'Fixture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.click(await screen.findByLabelText('Schedule activation'));
    fireEvent.change(screen.getByLabelText(/Effective time/), { target: { value: '2099-01-01T17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review publish' }));
    expect(screen.getByText(/Confirm publish · Version 2/)).toBeVisible();
    expect(financialSettingsApi.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Publish failed');
    expect(screen.getByLabelText(/Base delivery fee/)).toHaveValue('25');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));
    await waitFor(() => expect(financialSettingsApi.publish).toHaveBeenLastCalledWith('draft-2', '2099-01-01T12:00:00.000Z'));
    expect(await screen.findByText('Version scheduled.')).toBeVisible();
  });

  it('shows a permission failure and disables new drafts when active settings cannot be read', async () => {
    vi.mocked(financialSettingsApi.active).mockRejectedValue({ response: { data: { message: 'Forbidden' } } });
    vi.mocked(financialSettingsApi.history).mockResolvedValue({ items: [], pagination: { totalPages: 1 } });
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.getByRole('button', { name: 'New draft' })).toBeDisabled();
  });
});
