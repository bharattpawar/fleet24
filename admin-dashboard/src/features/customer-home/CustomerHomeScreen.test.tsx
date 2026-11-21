import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CustomerHomeScreen } from './CustomerHomeScreen';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: api }));

const catalog = {
  category: [{ id: 'cat-1', name: 'Biryani' }],
  restaurant: [],
  outlet: [{ id: 'o-1', name: 'Spice Hub' }],
  dish: [],
};

describe('CustomerHomeScreen', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: { draft: [], catalog } });
    api.put.mockReset().mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('builds search hints, offer tiles and a rail toggle and publishes them', async () => {
    render(<CustomerHomeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add search hints' }));
    expect(screen.getByRole('button', { name: 'Add search hints' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Search hint 1'), { target: { value: 'biryani' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add offer tiles' }));
    fireEvent.change(screen.getAllByLabelText(/^Title/)[0], { target: { value: 'Offers for you' } });
    fireEvent.change(screen.getByLabelText(/Tile title/), { target: { value: 'Flat 50% OFF' } });
    fireEvent.click(screen.getByRole('button', { name: 'Built-in image' }));
    fireEvent.click(screen.getByRole('option', { name: /Lightning/ }));
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'o-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add restaurant rail toggle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [, body] = api.put.mock.calls[0];
    expect(body.publish).toBe(true);
    expect(body.sections[0]).toMatchObject({ kind: 'search_hints', hints: ['biryani'] });
    expect(body.sections[1]).toMatchObject({ kind: 'tiles', title: 'Offers for you', targets: [{ type: 'outlet', id: 'o-1', title: 'Flat 50% OFF', image: 'asset:promo-bolt' }] });
    expect(body.sections[2].tabs.map((t: { filter: string }) => t.filter)).toEqual(['fast', 'offers']);
    expect(await screen.findByRole('status')).toHaveTextContent('published');
  });

  it('starter layout fills the draft with real destinations and built-in art', async () => {
    render(<CustomerHomeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load starter layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const { sections } = api.put.mock.calls[0][1];
    expect(sections.map((s: { kind: string }) => s.kind)).toEqual(['shortcuts', 'search_hints', 'banner', 'tiles', 'rail', 'category']);
    expect(sections[2].targets).toEqual([{ type: 'category', id: 'cat-1' }]);
    expect(sections[5]).toMatchObject({ title: 'Biryani', image: 'asset:biryani' });
    expect(sections[0].shortcuts[0]).toMatchObject({ action: 'food', image: 'asset:shortcut-food' });
  });

  it('shows the server validation message', async () => {
    api.put.mockRejectedValue(Object.assign(new Error('bad'), { isAxiosError: true, response: { data: { message: 'Section 1: banner needs a photo URL.' } } }));
    render(<CustomerHomeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('banner needs a photo URL');
  });
});
