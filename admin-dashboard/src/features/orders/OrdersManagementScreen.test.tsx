import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrdersManagementScreen } from './OrdersManagementScreen';
import { ordersApi } from '@/lib/api/orders';

vi.mock('@/lib/api/orders', () => ({
  ordersApi: {
    listOrders: vi.fn(),
    getOrderDetails: vi.fn(),
    cancelOrder: vi.fn(),
    retryDispatch: vi.fn(),
  },
}));

describe('OrdersManagementScreen', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <OrdersManagementScreen />
      </QueryClientProvider>
    );

  it('renders order management header, status tabs, and search bar', () => {
    vi.mocked(ordersApi.listOrders).mockResolvedValueOnce({
      page: 1,
      limit: 15,
      total: 0,
      totalPages: 1,
      data: [],
    });

    renderComponent();

    expect(screen.getByText('Global Order Management')).toBeDefined();
    expect(screen.getByText('All Orders')).toBeDefined();
    expect(screen.getByText('In Kitchen')).toBeDefined();
    expect(screen.getByText('Ready for Pickup')).toBeDefined();
    expect(screen.getByText('Out for Delivery')).toBeDefined();
    expect(screen.getByText('Delivered')).toBeDefined();
    expect(screen.getByText('Cancelled')).toBeDefined();
    expect(screen.getByPlaceholderText('Search order #, customer, outlet...')).toBeDefined();
  });

  it('renders order list when orders are returned by backend', async () => {
    const mockOrders = [
      {
        id: 'ord-123-uuid',
        orderNumber: 'ORD-20261031-0001',
        orderStatus: 'preparing' as const,
        totalPayable: 450,
        itemSubtotal: 400,
        deliveryCharge: 30,
        taxes: 20,
        itemCount: 2,
        createdAt: new Date().toISOString(),
        customer: { id: 'c-1', fullName: 'John Doe', phone: '+919876543210' },
        restaurant: { id: 'r-1', name: 'Spice Brands', outletId: 'o-1', outletName: 'Spice Garden' },
        payment: { id: 'p-1', status: 'captured' as const, amount: 450, paymentMethod: 'upi', refundedAmount: 0 },
        delivery: {
          id: 'del-1',
          status: 'unassigned' as const,
          riderId: null,
          riderName: null,
          riderPhone: null,
        },
      },
    ];

    vi.mocked(ordersApi.listOrders).mockResolvedValueOnce({
      page: 1,
      limit: 15,
      total: 1,
      totalPages: 1,
      data: mockOrders,
    });

    renderComponent();

    const orderNumberEl = await screen.findByText('#ORD-20261031-0001');
    expect(orderNumberEl).toBeDefined();
    expect(screen.getByText('Spice Garden')).toBeDefined();
    expect(screen.getByText('John Doe')).toBeDefined();
  });

  it('filters by status when tab clicked', async () => {
    vi.mocked(ordersApi.listOrders).mockResolvedValue({
      page: 1,
      limit: 15,
      total: 0,
      totalPages: 1,
      data: [],
    });

    renderComponent();

    const readyTab = screen.getByText('Ready for Pickup');
    fireEvent.click(readyTab);

    expect(ordersApi.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        orderStatus: 'ready_for_pickup',
      })
    );
  });
});
