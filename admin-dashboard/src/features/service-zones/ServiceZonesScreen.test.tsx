import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServiceZonesScreen } from './ServiceZonesScreen';
import { serviceZonesApi } from '@/lib/api/serviceZones';

vi.mock('@/lib/api/serviceZones', () => ({
  serviceZonesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    searchPlaces: vi.fn(),
    placeDetails: vi.fn(),
  },
}));
vi.mock('./ServiceZonesMap', () => ({ ServiceZonesMap: () => <div>map</div> }));

const kp3 = { id: 'z3', name: 'Knowledge Park III', centerLatitude: 28.4716, centerLongitude: 77.4838, radiusMeters: 3000, isActive: true };

describe('ServiceZonesScreen', () => {
  beforeEach(() => {
    vi.mocked(serviceZonesApi.list).mockResolvedValue([kp3]);
  });

  it('lists service areas with radius and status', async () => {
    render(<ServiceZonesScreen />);
    expect(await screen.findByText('Knowledge Park III')).toBeTruthy();
    expect(screen.getByText('3.0 km')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('adds an area found with Google search', async () => {
    vi.mocked(serviceZonesApi.searchPlaces).mockResolvedValue([
      { placeId: 'ChIJkp2000001', primaryText: 'Knowledge Park II', secondaryText: 'Greater Noida' },
    ]);
    vi.mocked(serviceZonesApi.placeDetails).mockResolvedValue({ latitude: 28.4594, longitude: 77.4934, formattedAddress: 'KP II' });
    vi.mocked(serviceZonesApi.create).mockResolvedValue({ ...kp3, id: 'z2', name: 'Knowledge Park II' });

    render(<ServiceZonesScreen />);
    await screen.findByText('Knowledge Park III');
    fireEvent.click(screen.getByRole('button', { name: 'Add service area' }));
    fireEvent.change(screen.getByPlaceholderText(/Search a sector/), { target: { value: 'knowledge park 2' } });
    fireEvent.click(await screen.findByRole('option', { name: /Knowledge Park II/ }, { timeout: 2000 }));
    await waitFor(() => expect((screen.getByDisplayValue('28.4594000') as HTMLInputElement).value).toBe('28.4594000'));
    fireEvent.click(screen.getByRole('button', { name: 'Add area' }));

    await waitFor(() =>
      expect(serviceZonesApi.create).toHaveBeenCalledWith({
        name: 'Knowledge Park II',
        centerLatitude: 28.4594,
        centerLongitude: 77.4934,
        radiusKm: 3,
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/Added Knowledge Park II/);
  });

  it('pauses a live area', async () => {
    vi.mocked(serviceZonesApi.update).mockResolvedValue({ ...kp3, isActive: false });
    render(<ServiceZonesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pause Knowledge Park III' }));
    await waitFor(() => expect(serviceZonesApi.update).toHaveBeenCalledWith('z3', { isActive: false }));
  });
});
