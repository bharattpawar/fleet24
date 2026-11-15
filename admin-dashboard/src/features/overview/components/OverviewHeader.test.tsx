import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverviewHeader } from './OverviewHeader';

describe('OverviewHeader', () => {
  it('renders the selected period and IST', () => {
    const handlePeriodChange = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <OverviewHeader
        selectedPeriod="last_7_days"
        onPeriodChange={handlePeriodChange}
        onRefresh={handleRefresh}
      />
    );

    expect(screen.getByLabelText('Date range')).toHaveValue('last_7_days');
    expect(screen.getByText('Asia/Kolkata (IST)')).toBeDefined();
  });

  it('triggers onPeriodChange callback when period button clicked', () => {
    const handlePeriodChange = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <OverviewHeader
        selectedPeriod="last_7_days"
        onPeriodChange={handlePeriodChange}
        onRefresh={handleRefresh}
      />
    );

    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'today' } });

    expect(handlePeriodChange).toHaveBeenCalledWith('today');
  });

  it('triggers onRefresh callback when Sync button clicked', () => {
    const handlePeriodChange = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <OverviewHeader
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

