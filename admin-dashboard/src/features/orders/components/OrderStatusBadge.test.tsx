import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderStatusBadge } from './OrderStatusBadge';

describe('OrderStatusBadge', () => {
  it('renders order lifecycle badges accurately', () => {
    render(<OrderStatusBadge type="order" status="delivered" />);
    expect(screen.getByText('DELIVERED')).toBeDefined();

    render(<OrderStatusBadge type="order" status="out_for_delivery" />);
    expect(screen.getByText('OUT FOR DELIVERY')).toBeDefined();

    render(<OrderStatusBadge type="order" status="cancelled" />);
    expect(screen.getByText('CANCELLED')).toBeDefined();
  });

  it('renders payment status badges accurately', () => {
    render(<OrderStatusBadge type="payment" status="captured" />);
    expect(screen.getByText('PAID')).toBeDefined();

    render(<OrderStatusBadge type="payment" status="refunded" />);
    expect(screen.getByText('REFUNDED')).toBeDefined();
  });

  it('renders delivery status badges accurately', () => {
    render(<OrderStatusBadge type="delivery" status="completed" />);
    expect(screen.getByText('DELIVERED')).toBeDefined();

    render(<OrderStatusBadge type="delivery" status="unassigned" />);
    expect(screen.getByText('UNASSIGNED')).toBeDefined();
  });
});

