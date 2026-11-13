import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OutletManagementTable } from './OutletManagementTable';
import type { RestaurantOutlet } from '@/types/restaurants';

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('OutletManagementTable', () => {
  const mockOutlets: RestaurantOutlet[] = [
    {
      id: 'outlet-1',
      restaurantId: 'rest-1',
      name: 'Indiranagar Flagship Kitchen',
      phone: '+919876543210',
      address: '100 Feet Rd, Indiranagar, Bengaluru',
      latitude: '12.9716',
      longitude: '77.5946',
      deliveryRadiusKm: '4.50',
      isAcceptingOrders: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'outlet-2',
      restaurantId: 'rest-1',
      name: 'Koramangala Cloud Kitchen',
      phone: '+919876543211',
      address: '5th Block, Koramangala, Bengaluru',
      latitude: '12.9352',
      longitude: '77.6245',
      deliveryRadiusKm: '3.00',
      isAcceptingOrders: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('renders all outlet details and distinguishes active vs accepting orders', () => {
    renderWithClient(
      <OutletManagementTable
        restaurantId="rest-1"
        isRestaurantSuspended={false}
        outlets={mockOutlets}
      />
    );

    expect(screen.getByText('Indiranagar Flagship Kitchen')).toBeDefined();
    expect(screen.getByText('Koramangala Cloud Kitchen')).toBeDefined();
    expect(screen.getByText('ACCEPTING')).toBeDefined();
    expect(screen.getByText('PAUSED')).toBeDefined();
    expect(screen.getByText('4.50 km')).toBeDefined();
    expect(screen.getByText('3.00 km')).toBeDefined();
  });

  it('opens override modal when Override button is clicked', () => {
    renderWithClient(
      <OutletManagementTable
        restaurantId="rest-1"
        isRestaurantSuspended={false}
        outlets={mockOutlets}
      />
    );

    const overrideButtons = screen.getAllByText('Override');
    fireEvent.click(overrideButtons[0]);

    expect(screen.getByText('Super Admin Operational Override')).toBeDefined();
    expect(screen.getByText('Apply Live Override')).toBeDefined();
  });

  it('displays clear suspension banner when parent restaurant is suspended', () => {
    renderWithClient(
      <OutletManagementTable
        restaurantId="rest-1"
        isRestaurantSuspended={true}
        outlets={mockOutlets}
      />
    );

    expect(screen.getByText(/Parent Restaurant Brand is Suspended/i)).toBeDefined();
  });
});
