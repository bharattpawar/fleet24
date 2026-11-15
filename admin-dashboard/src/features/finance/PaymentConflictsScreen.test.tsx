import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PaymentConflictsScreen } from './PaymentConflictsScreen';
import { ordersApi } from '@/lib/api/orders';

vi.mock('@/lib/api/orders', () => ({
  ordersApi: {
    listPaymentConflicts: vi.fn(),
    getPaymentConflictDetails: vi.fn(),
    approveConflictRefund: vi.fn(),
  },
}));

describe('PaymentConflictsScreen', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PaymentConflictsScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('renders metric cards, search bar, and empty state when no conflicts exist', async () => {
    vi.mocked(ordersApi.listPaymentConflicts).mockResolvedValue({
      page: 1,
      limit: 15,
      total: 0,
      totalPages: 1,
      data: [],
    });

    renderComponent();

    expect(screen.getByText('Payment Conflict Queue')).toBeInTheDocument();
    expect(screen.getByText('Total Records')).toBeInTheDocument();
    expect(screen.getAllByText('Pending Review').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/Search order/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No payment conflicts in this view')).toBeInTheDocument();
    });
  });

  it('renders conflict records and opens drawer with refund approval action', async () => {
    vi.mocked(ordersApi.listPaymentConflicts).mockResolvedValue({
      page: 1,
      limit: 15,
      total: 1,
      totalPages: 1,
      data: [
        {
          orderId: 'ord-conf-1',
          orderNumber: 'FL-20261115-CONF1',
          status: 'payment_conflict',
          authoritativeStatus: 'pending_review',
          totalPayable: 450.0,
          currency: 'INR',
          customer: { id: 'c1', name: 'John Doe', phone: '+919876543210' },
          restaurant: { name: 'Burger Hub', outletName: 'Main St' },
          payment: {
            id: 'pay-1',
            provider: 'razorpay',
            providerPaymentId: 'pay_rzp_12345',
            providerOrderId: 'order_rzp_12345',
            amount: 450.0,
            status: 'captured',
            paidAt: '2026-11-15T06:00:00Z',
          },
          conflictDetails: {
            conflictType: 'duplicate_active_fulfillment',
            detectedAt: '2026-11-15T06:00:00Z',
            conflictingActiveOrder: {
              id: 'ord-act-1',
              orderNumber: 'FL-ACTIVE-1',
              status: 'preparing',
            },
          },
          refund: null,
          createdAt: '2026-11-15T06:00:00Z',
          updatedAt: '2026-11-15T06:00:00Z',
        },
      ],
    });

    vi.mocked(ordersApi.getPaymentConflictDetails).mockResolvedValue({
      orderId: 'ord-conf-1',
      orderNumber: 'FL-20261115-CONF1',
      status: 'payment_conflict',
      authoritativeStatus: 'pending_review',
      totalPayable: 450.0,
      currency: 'INR',
      customer: { id: 'c1', name: 'John Doe', phone: '+919876543210' },
      restaurant: { name: 'Burger Hub', outletName: 'Main St' },
      payment: {
        id: 'pay-1',
        provider: 'razorpay',
        providerPaymentId: 'pay_rzp_12345',
        providerOrderId: 'order_rzp_12345',
        amount: 450.0,
        status: 'captured',
        paidAt: '2026-11-15T06:00:00Z',
      },
      conflictDetails: {
        conflictType: 'duplicate_active_fulfillment',
        detectedAt: '2026-11-15T06:00:00Z',
        conflictingActiveOrder: {
          id: 'ord-act-1',
          orderNumber: 'FL-ACTIVE-1',
          status: 'preparing',
        },
      },
      refund: null,
      auditEvents: [
        {
          id: 'aud-1',
          action: 'payment_conflict_detected',
          performedByUserId: 'c1',
          details: { reason: 'Duplicate fulfillment' },
          createdAt: '2026-11-15T06:00:00Z',
        },
      ],
      statusHistory: [],
      createdAt: '2026-11-15T06:00:00Z',
      updatedAt: '2026-11-15T06:00:00Z',
    });

    renderComponent();

    // Verify row rendered
    expect(await screen.findByText(/FL-20261115-CONF1/)).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Burger Hub')).toBeInTheDocument();
    expect(screen.getByText('pending review')).toBeInTheDocument();

    // Open drawer by clicking the row Review button (exact match to avoid matching the "Pending Review" tab button)
    const reviewBtn = screen.getByRole('button', { name: /^Review$/i });
    fireEvent.click(reviewBtn);

    // Verify drawer details
    expect(await screen.findByText('Conflict Review & Resolution')).toBeInTheDocument();
    expect(await screen.findByText('Dual Active Fulfillment Order Detected')).toBeInTheDocument();
    expect(screen.getByText('Captured Payment Evidence')).toBeInTheDocument();
    expect(screen.getByText('Dual Active Fulfillment Order Detected')).toBeInTheDocument();
    expect(screen.getByText('Captured Payment Evidence')).toBeInTheDocument();

    // Action button exists
    const approveBtn = screen.getByRole('button', { name: /Approve Full Refund/i });
    expect(approveBtn).toBeInTheDocument();

    // Click Approve button to reveal confirmation box
    fireEvent.click(approveBtn);
    expect(screen.getByText(/Confirm Full Refund Execution/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Execute Full Refund/i })).toBeInTheDocument();
  });
});
