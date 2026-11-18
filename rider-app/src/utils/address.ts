export interface AddressLike {
  addressLine1?: string | null;
  addressLine2?: string | null;
  street?: string | null;
  landmark?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

/** Second line under the house/flat line: area, landmark, city, PIN — whatever the customer gave. */
export function addressDetail(address?: AddressLike | null): string | null {
  if (!address) return null;
  const parts = [
    address.addressLine2,
    address.landmark ? `Near ${address.landmark}` : null,
    [address.city, address.postalCode].filter(Boolean).join(' '),
  ]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** First line: house / flat / building. */
export function addressTitle(address?: AddressLike | null, fallback = 'Customer address'): string {
  return (address?.addressLine1 || address?.street || '').trim() || fallback;
}
