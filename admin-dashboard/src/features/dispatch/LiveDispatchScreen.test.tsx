import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LiveDispatchScreen } from './LiveDispatchScreen';
import { dispatchApi } from '@/lib/api/dispatch';

vi.mock('@/lib/api/dispatch', () => ({
  dispatchApi: {
    getActiveDeliveries: vi.fn(),
    retryDispatch: vi.fn(),
    assignRider: vi.fn(),
  },
}));

vi.mock('@/lib/api/riders', () => ({
  ridersApi: { listRiders: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }) },
}));

describe('LiveDispatchScreen', () => {
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
        <LiveDispatchScreen />
      </QueryClientProvider>
    );

  it('renders Live Dispatch screen header and telemetry indicators', async () => {
    vi.mocked(dispatchApi.getActiveDeliveries).mockResolvedValueOnce({
      total: 0,
      data: [],
    });

    renderComponent();

    expect(screen.getByText('Live Dispatch & Delivery Telemetry')).toBeDefined();
    expect(screen.getByText(/Live Telemetry Polling Active/)).toBeDefined();

    const emptyMsg = await screen.findByText('Zero In-Flight Deliveries');
    expect(emptyMsg).toBeDefined();
  });

  it('renders active delivery cards and triggers manual rider assignment modal', async () => {
    const mockDelivery = {
      id: 'del-888',
      orderId: 'ord-888',
      orderNumber: 'ORD-20261031-7777',
      orderStatus: 'ready_for_pickup',
      deliveryStatus: 'unassigned' as const,
      createdAt: new Date().toISOString(),
      assignedAt: null,
      pickedUpAt: null,
      restaurant: {
        name: 'Burger Craft',
        outletName: 'Burger Craft Indiranagar',
        address: 'MG Road, Bengaluru',
      },
      rider: null,
      location: null,
      customerLocation: {
        latitude: 12.98,
        longitude: 77.6,
        address: '10 Richmond Town, Bengaluru',
      },
      restaurantLocation: {
        latitude: 12.9716,
        longitude: 77.5946,
      },
    };

    vi.mocked(dispatchApi.getActiveDeliveries).mockResolvedValue({
      total: 21,
      totalPages: 2,
      data: [mockDelivery],
    });

    vi.mocked(dispatchApi.assignRider).mockResolvedValueOnce({
      deliveryId: 'del-888',
      riderId: 'rider-uuid-456',
      status: 'assigned',
      message: 'Rider assigned successfully',
    });

    renderComponent();

    const orderCard = await screen.findByText('#ORD-20261031-7777');
    expect(orderCard).toBeDefined();
    expect(screen.getByText('Burger Craft')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }));
    await waitFor(() => expect(dispatchApi.getActiveDeliveries).toHaveBeenLastCalledWith({ page: 1, status: 'unassigned' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(dispatchApi.getActiveDeliveries).toHaveBeenLastCalledWith({ page: 2, status: 'unassigned' }));
    const requestsBeforeAssignment = vi.mocked(dispatchApi.getActiveDeliveries).mock.calls.length;

    // Select delivery card to open telemetry details pane
    fireEvent.click(await screen.findByText('#ORD-20261031-7777'));

    // Open Manual Rider Override modal
    const assignButton = await screen.findByText('Manual Rider Override');
    fireEvent.click(assignButton);

    expect(screen.getByRole('heading', { name: 'Assign rider' })).toBeDefined();

    const riderInput = screen.getByPlaceholderText('Enter rider UUID...');
    fireEvent.change(riderInput, { target: { value: 'rider-uuid-456' } });

    const confirmButton = screen.getByText('Confirm Assignment');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(dispatchApi.assignRider).toHaveBeenCalledWith('ord-888', 'rider-uuid-456');
      expect(vi.mocked(dispatchApi.getActiveDeliveries).mock.calls.length).toBeGreaterThan(requestsBeforeAssignment);
      expect(dispatchApi.getActiveDeliveries).toHaveBeenLastCalledWith({ page: 2, status: 'unassigned' });
    });
  });

  it('triggers retry dispatch from live dispatch screen', async () => {
    const mockDelivery = {
      id: 'del-999',
      orderId: 'ord-999',
      orderNumber: 'ORD-20261031-9999',
      orderStatus: 'ready_for_pickup',
      deliveryStatus: 'unassigned' as const,
      createdAt: new Date().toISOString(),
      assignedAt: null,
      pickedUpAt: null,
      restaurant: {
        name: 'Pizza Express',
        outletName: 'Pizza Express Indiranagar',
        address: 'Indiranagar',
      },
      rider: null,
      location: null,
      customerLocation: null,
      restaurantLocation: null,
    };

    vi.mocked(dispatchApi.getActiveDeliveries).mockResolvedValue({
      total: 1,
      data: [mockDelivery],
    });

    vi.mocked(dispatchApi.retryDispatch).mockResolvedValueOnce({
      assigned: false,
      message: 'Dispatch retry initiated',
    });

    renderComponent();

    // Delivery card has Retry button in queue card
    const retryButton = await screen.findByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(dispatchApi.retryDispatch).toHaveBeenCalledWith('ord-999');
    });
  });
});
