import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromotionsScreen } from './PromotionsScreen';
import { promotionsApi } from '@/lib/api/promotions';
import { describeOffer, promotionStatus } from './promotionText';

vi.mock('@/lib/api/promotions', () => ({
  promotionsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

const save50 = {
  id: 'p1', code: 'SAVE50', description: '₹50 off', discountType: 'fixed_amount' as const, discountValue: '50.00',
  minOrderAmount: '199.00', maxDiscountAmount: null, usageLimitPerUser: 1, totalUsageLimit: 100, timesUsed: 3,
  validFrom: '2026-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z', isActive: true,
};

describe('PromotionsScreen', () => {
  beforeEach(() => {
    vi.mocked(promotionsApi.list).mockResolvedValue([save50]);
    vi.mocked(promotionsApi.create).mockResolvedValue(save50);
    vi.mocked(promotionsApi.update).mockResolvedValue(save50);
  });

  it('lists coupons with offer, usage and status', async () => {
    render(<PromotionsScreen />);
    expect(await screen.findByText('SAVE50')).toBeTruthy();
    expect(screen.getByText('₹50 off · min order ₹199')).toBeTruthy();
    expect(screen.getByText('3 / 100')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('creates a percentage coupon with a cap', async () => {
    render(<PromotionsScreen />);
    await screen.findByText('SAVE50');
    fireEvent.click(screen.getByRole('button', { name: 'Add coupon' }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'party20' } });
    fireEvent.change(screen.getByLabelText('Discount type'), { target: { value: 'percentage' } });
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Maximum discount (₹, empty = no cap)'), { target: { value: '100' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add coupon' })[1]);
    await waitFor(() => expect(promotionsApi.create).toHaveBeenCalled());
    expect(vi.mocked(promotionsApi.create).mock.calls[0][0]).toMatchObject({
      code: 'party20', discountType: 'percentage', discountValue: 20, maxDiscountAmount: 100, usageLimitPerUser: 1, totalUsageLimit: null,
    });
  });

  it('blocks a percentage above 100 before saving', async () => {
    render(<PromotionsScreen />);
    await screen.findByText('SAVE50');
    fireEvent.click(screen.getByRole('button', { name: 'Add coupon' }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'TOO_MUCH' } });
    fireEvent.change(screen.getByLabelText('Discount type'), { target: { value: 'percentage' } });
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '150' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add coupon' })[1]);
    expect(await screen.findByText('A percentage cannot be more than 100.')).toBeTruthy();
    expect(promotionsApi.create).not.toHaveBeenCalled();
  });

  it('pauses a coupon', async () => {
    render(<PromotionsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pause SAVE50' }));
    await waitFor(() => expect(promotionsApi.update).toHaveBeenCalledWith('p1', { isActive: false }));
  });
});

describe('promotion text', () => {
  it('describes offers and status', () => {
    expect(describeOffer({ discountType: 'percentage', discountValue: '20.00', maxDiscountAmount: '100.00', minOrderAmount: '0.00' })).toBe('20% off up to ₹100');
    expect(promotionStatus({ ...save50, validUntil: '2020-01-01T00:00:00Z' })).toBe('Expired');
    expect(promotionStatus({ ...save50, timesUsed: 100 })).toBe('Used up');
    expect(promotionStatus({ ...save50, isActive: false })).toBe('Paused');
  });
});
