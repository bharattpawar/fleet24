import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ApplicationDetailsCard } from './ApplicationDetailsCard';
import { fssaiExpiryNote } from '../fssaiExpiry';

const application = {
  ownerName: 'Rakesh Sharma',
  ownerEmail: null,
  contactPhone: '+919811100000',
  cuisines: ['North Indian', 'Chinese'],
  fssaiNumber: '12345678901234',
  fssaiExpiry: '2020-01-31',
  panNumber: 'ABCDE1234F',
  gstin: null,
  bankAccountHolder: 'Rakesh Sharma',
  bankAccountNumber: '123456789012',
  bankIfsc: 'HDFC0001234',
  submittedAt: '2026-11-18T10:00:00.000Z',
};

it('shows every number the admin needs to verify', () => {
  render(<ApplicationDetailsCard application={application} />);
  for (const text of ['12345678901234', 'ABCDE1234F', 'HDFC0001234', '123456789012', '+919811100000', 'North Indian, Chinese']) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  expect(screen.getByText('Not registered')).toBeTruthy(); // no GSTIN
  expect(screen.getByText('Not given')).toBeTruthy(); // no email
});

it('flags an expired FSSAI licence', () => {
  render(<ApplicationDetailsCard application={application} />);
  expect(screen.getByText(/2020-01-31 \(expired\)/)).toBeTruthy();
});

it('notes licences expiring within 30 days', () => {
  const today = new Date(2026, 10, 18);
  expect(fssaiExpiryNote('2026-12-01', today)).toBe('soon');
  expect(fssaiExpiryNote('2027-06-01', today)).toBeNull();
  expect(fssaiExpiryNote('2026-11-17', today)).toBe('expired');
  expect(fssaiExpiryNote(null, today)).toBeNull();
});
