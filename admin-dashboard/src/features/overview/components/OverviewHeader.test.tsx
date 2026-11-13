import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverviewHeader } from './OverviewHeader';

describe('OverviewHeader', () => {
  it('renders admin identity and current period correctly', () => {
    const handlePeriodChange = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <OverviewHeader
        adminName="Bharat Super Admin"
        adminPhone="+919876543210"
        selectedPeriod="last_7_days"
        onPeriodChange={handlePeriodChange}
        onRefresh={handleRefresh}
      />
    );

    expect(screen.getByText('Platform Overview')).toBeDefined();
    expect(screen.getByText('Bharat Super Admin')).toBeDefined();
    expect(screen.getByText('Asia/Kolkata (IST)')).toBeDefined();
  });

  it('triggers onPeriodChange callback when period button clicked', () => {
    const handlePeriodChange = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <OverviewHeader
        adminName="Super Admin"
        selectedPeriod="last_7_days"
        onPeriodChange={handlePeriodChange}
        onRefresh={handleRefresh}
      />
    );

    const todayButton = screen.getByText('Today');
    fireEvent.click(todayButton);

    expect(handlePeriodChange).toHaveBeenCalledWith('today');
  });

  it('triggers onRefresh callback when Sync button clicked', () => {
    const handlePeriodChange = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <OverviewHeader
        adminName="Super Admin"
        selectedPeriod="last_7_days"
        onPeriodChange={handlePeriodChange}
        onRefresh={handleRefresh}
      />
    );

    const syncButton = screen.getByTitle('Refresh All Overview Data');
    fireEvent.click(syncButton);

    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });
});

