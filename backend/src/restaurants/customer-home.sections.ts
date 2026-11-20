/**
 * Customer Home content that admin edits (draft -> publish) and the app renders top to bottom.
 *
 * Kinds:
 * - banner        Hero campaign: eyebrow, title, subtitle, photo, button label, one destination.
 * - tiles         Row of offer tiles; each target carries its own title, sub-line and photo.
 * - category      One cuisine circle (photo + title) pointing at a menu category.
 * - row           Curated rail of outlets or dishes.
 * - rail          Two- or three-way toggle over a restaurant rail (all / offers / fastest).
 * - search_hints  Rotating "Search for '…'" placeholder texts.
 */

export type TargetType = 'category' | 'restaurant' | 'outlet' | 'dish';
export type HomeSectionKind = 'banner' | 'tiles' | 'category' | 'row' | 'rail' | 'search_hints';
export type RailFilter = 'all' | 'offers' | 'fast';

export interface HomeTarget {
  type: TargetType;
  id: string;
  /** tiles only */
  title?: string;
  subtitle?: string;
  image?: string;
}

export interface HomeSection {
  kind: HomeSectionKind;
  title: string;
  hidden?: boolean;
  image?: string;
  cta?: string;
  /** banner only: small line above the title, e.g. "WEEKEND SPECIAL" */
  eyebrow?: string;
  /** banner only: line under the title, e.g. "Flat ₹150 OFF on delights!" */
  subtitle?: string;
  /** rail only */
  tabs?: Array<{ label: string; filter: RailFilter }>;
  /** search_hints only */
  hints?: string[];
  targets: HomeTarget[];
}

export type HomeCatalog = Record<TargetType, Array<{ id: string; name: string }>>;

export const HOME_SECTION_KINDS: HomeSectionKind[] = ['banner', 'tiles', 'category', 'row', 'rail', 'search_hints'];
const RAIL_FILTERS: RailFilter[] = ['all', 'offers', 'fast'];
const TARGET_TYPES: TargetType[] = ['category', 'restaurant', 'outlet', 'dish'];

export class HomeSectionError extends Error {}

const isText = (value: unknown, max: number, required = true) =>
  value === undefined || value === null || value === ''
    ? !required
    : typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function isImageUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Allowed number of destinations and their types per kind. */
const TARGET_RULES: Record<HomeSectionKind, { min: number; max: number; types: TargetType[] }> = {
  banner: { min: 1, max: 1, types: TARGET_TYPES },
  tiles: { min: 1, max: 8, types: TARGET_TYPES },
  category: { min: 1, max: 1, types: ['category'] },
  row: { min: 1, max: 20, types: ['outlet', 'dish'] },
  rail: { min: 0, max: 0, types: [] },
  search_hints: { min: 0, max: 0, types: [] },
};

/**
 * Checks admin input and returns clean sections (trimmed text, unknown fields dropped).
 * Throws HomeSectionError with a message admin can act on.
 */
export function validateHomeSections(input: unknown, catalog: HomeCatalog): HomeSection[] {
  if (!Array.isArray(input) || input.length > 40) throw new HomeSectionError('Expected up to 40 sections.');
  if (input.filter((s) => s?.kind === 'search_hints').length > 1) {
    throw new HomeSectionError('Add search hints only once.');
  }

  return input.map((raw: any, index): HomeSection => {
    const where = `Section ${index + 1}`;
    if (!raw || !HOME_SECTION_KINDS.includes(raw.kind)) throw new HomeSectionError(`${where}: unknown section type.`);
    const kind: HomeSectionKind = raw.kind;
    if (!isText(raw.title, 100)) throw new HomeSectionError(`${where}: enter a title of up to 100 characters.`);
    if (raw.hidden !== undefined && typeof raw.hidden !== 'boolean') throw new HomeSectionError(`${where}: invalid hidden flag.`);

    const section: HomeSection = { kind, title: raw.title.trim(), targets: [] };
    if (raw.hidden) section.hidden = true;

    if (kind === 'banner' || kind === 'category') {
      if (!isImageUrl(raw.image)) throw new HomeSectionError(`${where}: enter a valid HTTP or HTTPS image URL.`);
      section.image = raw.image;
    }
    if (kind === 'banner') {
      if (!isText(raw.cta, 40)) throw new HomeSectionError(`${where}: enter a button label of up to 40 characters.`);
      if (!isText(raw.eyebrow, 30, false)) throw new HomeSectionError(`${where}: the small top line is up to 30 characters.`);
      if (!isText(raw.subtitle, 80, false)) throw new HomeSectionError(`${where}: the sub-line is up to 80 characters.`);
      section.cta = raw.cta.trim();
      if (raw.eyebrow?.trim()) section.eyebrow = raw.eyebrow.trim();
      if (raw.subtitle?.trim()) section.subtitle = raw.subtitle.trim();
    }
    if (kind === 'rail') {
      const tabs = raw.tabs;
      if (!Array.isArray(tabs) || tabs.length < 1 || tabs.length > 3) {
        throw new HomeSectionError(`${where}: add 1 to 3 toggle options.`);
      }
      section.tabs = tabs.map((tab: any) => {
        if (!tab || !isText(tab.label, 30) || !RAIL_FILTERS.includes(tab.filter)) {
          throw new HomeSectionError(`${where}: each toggle option needs a label (up to 30 characters) and a filter.`);
        }
        return { label: tab.label.trim(), filter: tab.filter };
      });
    }
    if (kind === 'search_hints') {
      const hints = raw.hints;
      if (!Array.isArray(hints) || hints.length < 1 || hints.length > 10 || !hints.every((h: unknown) => isText(h, 40))) {
        throw new HomeSectionError(`${where}: add 1 to 10 search hints of up to 40 characters.`);
      }
      section.hints = hints.map((h: string) => h.trim());
    }

    const rule = TARGET_RULES[kind];
    const targets = Array.isArray(raw.targets) ? raw.targets : [];
    if (targets.length < rule.min || targets.length > rule.max) {
      throw new HomeSectionError(
        rule.max === 0
          ? `${where}: this section has no destinations.`
          : `${where}: choose ${rule.min === rule.max ? rule.min : `${rule.min} to ${rule.max}`} destination(s).`,
      );
    }
    section.targets = targets.map((t: any, j: number): HomeTarget => {
      if (!t || !rule.types.includes(t.type) || !catalog[t.type as TargetType]?.some((item) => item.id === t.id)) {
        throw new HomeSectionError(`${where}: choose an existing destination allowed for this section.`);
      }
      const target: HomeTarget = { type: t.type, id: t.id };
      if (kind === 'tiles') {
        if (!isText(t.title, 40)) throw new HomeSectionError(`${where}, tile ${j + 1}: enter a title of up to 40 characters.`);
        if (!isText(t.subtitle, 40, false)) throw new HomeSectionError(`${where}, tile ${j + 1}: the sub-line is up to 40 characters.`);
        if (!isImageUrl(t.image)) throw new HomeSectionError(`${where}, tile ${j + 1}: enter a valid HTTP or HTTPS image URL.`);
        target.title = t.title.trim();
        if (t.subtitle?.trim()) target.subtitle = t.subtitle.trim();
        target.image = t.image;
      }
      return target;
    });
    return section;
  });
}
