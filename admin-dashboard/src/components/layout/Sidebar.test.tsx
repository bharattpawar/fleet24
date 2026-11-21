import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { pageDescriptions, pageTitles } from './navigation';
import { Header } from './Header';

vi.mock('@/features/auth/AdminAuthContext', () => ({ useAdminAuth: () => ({ user: { fullName: 'Asha', phone: '+910000000000' }, logout: vi.fn() }) }));

describe('admin navigation', () => {
  it('puts daily operations first, then directory, then finance', () => {
    render(<MemoryRouter initialEntries={['/orders']}><Sidebar /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Dashboard' });
    const groups = [...nav.querySelectorAll('.admin-nav-group > p')].map(p => p.textContent);
    expect(groups).toEqual(['Operations', 'Directory', 'Finance']);
    expect(within(nav).getByRole('link', { name: 'Live Orders' })).toHaveAttribute('aria-current', 'page');
  });

  it('gives every page a title and a one-line description', () => {
    const paths = Object.keys(pageTitles);
    expect(paths.length).toBeGreaterThanOrEqual(17);
    for (const path of paths) {
      expect(pageDescriptions[path]?.length, path).toBeGreaterThan(10);
    }
  });

  it('header shows the page title and its description', () => {
    render(<MemoryRouter><Header title="Live Orders" description={pageDescriptions['/orders']} onOpenNavigation={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Live Orders' })).toBeInTheDocument();
    expect(screen.getByText('Every active order and its current stage')).toBeInTheDocument();
  });
});
