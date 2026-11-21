import { home } from './homeTheme';

/** Keep food cards readable while using the available browser/tablet width. */
export function homeCardWidth(width: number): number {
  if (width < 600) return Math.round((width - home.gutter) / 3.05) - 6;
  const columns = Math.max(2, Math.floor(width / 240));
  return Math.floor((width - home.gutter * 2 - (columns - 1) * 10) / columns);
}

export function restaurantColumns(width: number): number {
  return width >= 1200 ? 4 : width >= 900 ? 3 : width >= 600 ? 2 : 1;
}
