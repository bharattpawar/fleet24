/** Columns of the kitchen display board (≥1280px). Every live order status belongs to exactly one column. */
export const LIVE_STATUSES = ['placed', 'confirmed', 'preparing', 'ready_for_pickup'] as const;

export const BOARD_COLUMNS = [
  { key: 'placed', label: 'New', statuses: ['placed'], empty: 'New orders appear here first.' },
  { key: 'preparing', label: 'Preparing', statuses: ['confirmed', 'preparing'], empty: 'Accepted orders move here.' },
  { key: 'ready_for_pickup', label: 'Ready for pickup', statuses: ['ready_for_pickup'], empty: 'Packed orders wait here for the rider.' },
] as const;

export const BOARD_MIN_WIDTH = 1280;

export function groupForBoard<T extends { status: string }>(orders: T[]): Record<(typeof BOARD_COLUMNS)[number]['key'], T[]> {
  const result = { placed: [] as T[], preparing: [] as T[], ready_for_pickup: [] as T[] };
  for (const order of orders) {
    const column = BOARD_COLUMNS.find(c => (c.statuses as readonly string[]).includes(order.status));
    if (column) result[column.key].push(order);
  }
  return result;
}

export function liveOrderCount(orders: Array<{ status: string }>): number {
  return orders.filter(o => (LIVE_STATUSES as readonly string[]).includes(o.status)).length;
}
