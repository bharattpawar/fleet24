import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiderStatusBadge } from './RiderStatusBadge';

describe('RiderStatusBadge', () => {
  it('renders verification approved badge correctly', () => {
    render(<RiderStatusBadge type="verification" status="approved" />);
    expect(screen.getByText('APPROVED')).toBeDefined();
  });

  it('renders verification pending KYC badge correctly', () => {
    render(<RiderStatusBadge type="verification" status="pending" />);
    expect(screen.getByText('PENDING KYC')).toBeDefined();
  });

  it('renders availability status correctly', () => {
    render(<RiderStatusBadge type="availability" status="available" />);
    expect(screen.getByText('AVAILABLE')).toBeDefined();
  });

  it('renders busy on delivery status correctly', () => {
    render(<RiderStatusBadge type="availability" status="busy" />);
    expect(screen.getByText('ON DELIVERY')).toBeDefined();
  });

  it('renders suspension badge correctly', () => {
    render(<RiderStatusBadge type="suspension" status={true} />);
    expect(screen.getByText('SUSPENDED')).toBeDefined();
  });
});

