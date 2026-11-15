import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { ordersApi } from '@/lib/api/orders';

vi.mock('@/lib/api/orders', () => ({
  ordersApi: {
    listOrders: vi.fn(),
    getOrderDetails: vi.fn(),
    cancelOrder: vi.fn(),
    retryDispatch: vi.fn(),
  },
}));

describe('OrderDetailDrawer', () => {
  let queryClient: QueryClient;
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = (orderId: string = 'ord-123') =>
    render(
      <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <OrderDetailDrawer orderId={orderId} onClose={mockClose} />
      </QueryClientProvider>
      </MemoryRouter>
    );

  it('renders order detail drawer and customer/restaurant information', async () => {
    const mockOrder = {
      id: 'ord-123',
      orderNumber: 'ORD-20261031-8888',
      status: 'ready_for_pickup' as const,
      totalPayable: 520,
      itemSubtotal: 450,
      deliveryCharge: 40,
      packagingCharge: 0,
      taxes: 22.5,
      discountAmount: 0,
      deliveryAddress: {
        street: '45 Lake View Residency',
        landmark: 'Near Water Tank',
        city: 'Bengaluru',
      },
      deliveryInstructions: 'Call upon arrival',
      cancellationReason: null,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      customer: {
        id: 'cust-1',
        fullName: 'Jane Smith',
        phone: '+919876543211',
        email: 'jane@example.com',
      },
      restaurant: {
        id: 'rest-1',
        name: 'Grand Hospitality',
        slug: 'grand-hospitality',
        outletId: 'out-1',
        outletName: 'Grand Biryani',
        address: '123 Market Rd, Bengaluru',
        outletPhone: '+918023456789',
      },
      items: [
        {
          id: 'item-1',
          name: 'Chicken Dum Biryani',
          quantity: 2,
          price: 225,
          totalPrice: 450,
        },
      ],
      payment: {
        id: 'pay-1',
        status: 'captured' as const,
        amount: 520,
        currency: 'INR',
        provider: 'razorpay',
        providerPaymentId: 'pay_test123',
        providerOrderId: 'order_test123',
        paidAt: '2026-10-31T12:00:00Z',
        refunds: [],
      },
      delivery: {
        id: 'del-1',
        status: 'unassigned' as const,
        pickupLatitude: '12.9716',
        pickupLongitude: '77.5946',
        dropLatitude: '12.9816',
        dropLongitude: '77.6046',
        distanceKm: 2.5,
        rider: null,
        timeline: [],
      },
    };

    vi.mocked(ordersApi.getOrderDetails).mockResolvedValueOnce({
      ...mockOrder,
      payment: {
        ...mockOrder.payment,
        refunds: ['pending', 'processed', 'failed'].map((status) => ({
          id: status, status, amount: 12, reason: 'Fixture refund',
          createdAt: '2026-10-31T12:30:00Z',
          providerRefundId: status === 'processed' ? 'rfnd_fixture' : null,
          isManualReviewRequired: status === 'failed',
        })),
      },
      timeline: [
        { id: 'payment', eventType: 'payment_captured', description: 'Gateway capture confirmed', timestamp: '2026-10-31T12:00:00Z' },
        { id: 'order', eventType: 'order_confirmed', description: 'Kitchen accepted order', timestamp: '2026-10-31T12:10:00Z' },
      ],
    });

    renderComponent('ord-123');

    const orderNumber = await screen.findByText(/ORD-20261031-8888/);
    expect(orderNumber).toBeDefined();
    expect(screen.getByText('Jane Smith')).toBeDefined();
    expect(screen.getByText('Captured amount')).toBeVisible();
    expect(screen.getByText('Order total')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View ledger entries' })).toHaveAttribute('href', '/finance/ledger?orderId=ord-123');
    expect(screen.getByText('31/10/2026, 5:30:00 pm')).toBeVisible();
    expect(screen.getByText('Gateway capture confirmed')).toBeVisible();
    expect(screen.getByText('Kitchen accepted order')).toBeVisible();
    expect(screen.getByText('Refunds')).toBeVisible();
    for (const status of ['pending', 'processed', 'failed']) {
      expect(screen.getByText(new RegExp('12.00.*' + status))).toBeVisible();
    }
    expect(screen.getByText(/rfnd_fixture/)).toBeVisible();
    expect(screen.getByText('Manual review required')).toBeVisible();
    expect(screen.getByText('pay_test123')).toBeVisible();
    expect(screen.getByText('order_test123')).toBeVisible();
    expect(screen.getByText('123 Market Rd, Bengaluru')).toBeVisible();
    expect(screen.getByText('Grand Biryani')).toBeDefined();
    expect(screen.getByText('Chicken Dum Biryani')).toBeDefined();
  });

  it('triggers admin order cancellation modal and submits cancellation with refund', async () => {
    const mockOrder = {
      id: 'ord-123',
      orderNumber: 'ORD-20261031-8888',
      status: 'preparing' as const,
      totalPayable: 520,
      itemSubtotal: 450,
      deliveryCharge: 40,
      packagingCharge: 0,
      taxes: 22.5,
      discountAmount: 0,
      deliveryAddress: { street: '45 Lake View' },
      deliveryInstructions: null,
      cancellationReason: null,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      customer: { id: 'cust-1', fullName: 'Jane Smith', phone: '+919876543211', email: null },
      restaurant: {
        id: 'rest-1',
        name: 'Grand Hospitality',
        slug: 'grand',
        outletId: 'out-1',
        outletName: 'Grand Biryani',
        address: 'Market Rd',
        outletPhone: '+918023456789',
      },
      items: [],
      payment: { id: 'p-1', status: 'pending' as const, amount: 520, currency: 'INR', provider: 'razorpay', providerPaymentId: null, providerOrderId: null, paidAt: null, refunds: [] },
      delivery: null,
    };

    vi.mocked(ordersApi.getOrderDetails).mockResolvedValue(mockOrder);
    vi.mocked(ordersApi.cancelOrder).mockResolvedValueOnce({
      id: 'ord-123',
      status: 'cancelled',
      message: 'Order cancelled successfully',
      refund: { id: 'rf-1', amount: 520 },
    });

    renderComponent('ord-123');

    expect(await screen.findByText('Payment amount')).toBeVisible();
    expect(screen.queryByText('Captured amount')).toBeNull();
    const cancelButton = await screen.findByText('Administrative Cancel & Refund');
    fireEvent.click(cancelButton);

    // Modal opens
    expect(screen.getByText('Cancel Order & Release Fleet')).toBeDefined();

    const reasonInput = screen.getByPlaceholderText('Reason (e.g. restaurant unable to prepare, customer address unreachable)...');
    fireEvent.change(reasonInput, { target: { value: 'Customer requested cancellation due to delay' } });

    const confirmButton = screen.getByText('Confirm Cancellation');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(ordersApi.cancelOrder).toHaveBeenCalledWith('ord-123', {
        reason: 'Customer requested cancellation due to delay',
      });
    });
  });

  it('triggers retry dispatch when eligible', async () => {
    const mockOrder = {
      id: 'ord-123',
      orderNumber: 'ORD-20261031-8888',
      status: 'ready_for_pickup' as const,
      totalPayable: 520,
      itemSubtotal: 450,
      deliveryCharge: 40,
      packagingCharge: 0,
      taxes: 22.5,
      discountAmount: 0,
      deliveryAddress: { street: '45 Lake View' },
      deliveryInstructions: null,
      cancellationReason: null,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      customer: { id: 'cust-1', fullName: 'Jane Smith', phone: '+919876543211', email: null },
      restaurant: {
        id: 'rest-1',
        name: 'Grand Hospitality',
        slug: 'grand',
        outletId: 'out-1',
        outletName: 'Grand Biryani',
        address: 'Market Rd',
        outletPhone: '+918023456789',
      },
      items: [],
      payment: null,
      delivery: {
        id: 'del-1',
        status: 'unassigned' as const,
        pickupLatitude: '12.9716',
        pickupLongitude: '77.5946',
        dropLatitude: '12.9816',
        dropLongitude: '77.6046',
        distanceKm: 2.5,
        rider: null,
        timeline: [],
      },
    };

    vi.mocked(ordersApi.getOrderDetails).mockResolvedValue(mockOrder);
    vi.mocked(ordersApi.retryDispatch).mockResolvedValueOnce({
      assigned: false,
      message: 'Dispatch offer re-broadcast successfully',
    });

    renderComponent('ord-123');

    expect(await screen.findByText('No payment record')).toBeVisible();
    const retryButton = await screen.findByText('Retry Dispatch Matching');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(ordersApi.retryDispatch).toHaveBeenCalledWith('ord-123');
    });
  });
});
