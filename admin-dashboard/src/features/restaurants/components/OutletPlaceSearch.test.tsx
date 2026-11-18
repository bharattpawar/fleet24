import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { serviceZonesApi } from '@/lib/api/serviceZones';
import { hasOutletCoordinates, OutletPlaceSearch } from './OutletPlaceSearch';

vi.mock('@/lib/api/serviceZones', () => ({
  serviceZonesApi: { searchPlaces: vi.fn(), placeDetails: vi.fn() },
}));

it('uses the selected address and coordinates from place details', async () => {
  const result = { formattedAddress: 'Example Street', latitude: 1, longitude: 2 };
  vi.mocked(serviceZonesApi.searchPlaces).mockResolvedValue([
    { placeId: 'place', primaryText: 'Example', secondaryText: 'Street' },
  ]);
  vi.mocked(serviceZonesApi.placeDetails).mockResolvedValue(result);
  const onSelect = vi.fn();
  render(<OutletPlaceSearch onSelect={onSelect} />);

  fireEvent.change(screen.getByLabelText('Find address'), { target: { value: 'Example' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Example Street' }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(result));
  expect(serviceZonesApi.placeDetails).toHaveBeenCalledWith('place', expect.any(String));
});

it('requires both coordinates and rejects values outside the geographic range', () => {
  expect(hasOutletCoordinates('', '10')).toBe(false);
  expect(hasOutletCoordinates('0', '0')).toBe(true);
  expect(hasOutletCoordinates('90.1', '10')).toBe(false);
});
