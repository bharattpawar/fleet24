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
 * - shortcuts     Row of up to 6 service cards under the location (Food, Offers, Fast…), each opening a real app action.
 *
 * Every image field is an image reference: `media:<id>` (uploaded by admin), `asset:<key>` (built-in
 * illustration) or an http(s) URL.
 */
import { isImageRef } from './home-art';

export type TargetType = 'category' | 'restaurant' | 'outlet' | 'dish';
export type HomeSectionKind = 'banner' | 'tiles' | 'category' | 'row' | 'rail' | 'search_hints' | 'shortcuts';
export type ShortcutAction = 'food' | 'offers' | 'fast' | 'veg' | 'favourites' | 'orders' | 'profile';
export const SHORTCUT_ACTIONS: ShortcutAction[] = ['food', 'offers', 'fast', 'veg', 'favourites', 'orders', 'profile'];
export type RailFilter = 'all' | 'offers' | 'fast';

export interface HomeTarget {
  type: TargetType;
  id: string;
  /** tiles only */
  title?: string;
  subtitle?: string;
  image?: string;
  /** Describes the image for screen readers. */
  alt?: string;
}

export interface HomeShortcut {
  title: string;
  image: string;
  alt?: string;
  /** Small pill on the card, e.g. "10 MINS". */
  badge?: string;
  action: ShortcutAction;
}

export interface HomeSection {
  kind: HomeSectionKind;
  title: string;
  hidden?: boolean;
  image?: string;
  /** banner only: second photo on the left side. */
  imageLeft?: string;
  /** Describes the section's photo(s) for screen readers. */
  imageAlt?: string;
  cta?: string;
  /** banner only: small line above the title, e.g. "WEEKEND SPECIAL" */
  eyebrow?: string;
  /** banner only: line under the title, e.g. "Flat ₹150 OFF on delights!" */
  subtitle?: string;
  /** rail only */
  tabs?: Array<{ label: string; filter: RailFilter }>;
  /** search_hints only */
  hints?: string[];
  /** shortcuts only */
  shortcuts?: HomeShortcut[];
  targets: HomeTarget[];
}

export type HomeCatalog = Record<TargetType, Array<{ id: string; name: string }>>;

export const HOME_SECTION_KINDS: HomeSectionKind[] = ['banner', 'tiles', 'category', 'row', 'rail', 'search_hints', 'shortcuts'];
const RAIL_FILTERS: RailFilter[] = ['all', 'offers', 'fast'];
const TARGET_TYPES: TargetType[] = ['category', 'restaurant', 'outlet', 'dish'];

export class HomeSectionError extends Error {}

const isText = (value: unknown, max: number, required = true) =>
  value === undefined || value === null || value === ''
    ? !required
    : typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const IMAGE_HELP = 'upload a photo, pick a built-in illustration, or enter an HTTP(S) image URL';

/** Allowed number of destinations and their types per kind. */
const TARGET_RULES: Record<HomeSectionKind, { min: number; max: number; types: TargetType[] }> = {
  banner: { min: 1, max: 1, types: TARGET_TYPES },
  tiles: { min: 1, max: 8, types: TARGET_TYPES },
  category: { min: 1, max: 1, types: ['category'] },
  row: { min: 1, max: 20, types: ['outlet', 'dish'] },
  rail: { min: 0, max: 0, types: [] },
  search_hints: { min: 0, max: 0, types: [] },
  shortcuts: { min: 0, max: 0, types: [] },
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
  if (input.filter((s) => s?.kind === 'shortcuts').length > 1) {
    throw new HomeSectionError('Add the shortcut row only once.');
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
      if (!isImageRef(raw.image)) throw new HomeSectionError(`${where}: ${IMAGE_HELP}.`);
      section.image = raw.image;
      if (!isText(raw.imageAlt, 120, false)) throw new HomeSectionError(`${where}: image description is up to 120 characters.`);
      if (raw.imageAlt?.trim()) section.imageAlt = raw.imageAlt.trim();
    }
    if (kind === 'banner' && raw.imageLeft !== undefined && raw.imageLeft !== '') {
      if (!isImageRef(raw.imageLeft)) throw new HomeSectionError(`${where}: left photo — ${IMAGE_HELP}.`);
      section.imageLeft = raw.imageLeft;
    }
    if (kind === 'shortcuts') {
      const items = raw.shortcuts;
      if (!Array.isArray(items) || items.length < 1 || items.length > 6) {
        throw new HomeSectionError(`${where}: add 1 to 6 shortcuts.`);
      }
      section.shortcuts = items.map((item: any, j: number) => {
        const at = `${where}, shortcut ${j + 1}`;
        if (!item || !isText(item.title, 14)) throw new HomeSectionError(`${at}: enter a label of up to 14 characters.`);
        if (!isImageRef(item.image)) throw new HomeSectionError(`${at}: ${IMAGE_HELP}.`);
        if (!SHORTCUT_ACTIONS.includes(item.action)) throw new HomeSectionError(`${at}: choose what it opens.`);
        if (!isText(item.badge, 12, false)) throw new HomeSectionError(`${at}: the badge is up to 12 characters.`);
        if (!isText(item.alt, 120, false)) throw new HomeSectionError(`${at}: image description is up to 120 characters.`);
        const shortcut: HomeShortcut = { title: item.title.trim(), image: item.image, action: item.action };
        if (item.badge?.trim()) shortcut.badge = item.badge.trim();
        if (item.alt?.trim()) shortcut.alt = item.alt.trim();
        return shortcut;
      });
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
        if (!isImageRef(t.image)) throw new HomeSectionError(`${where}, tile ${j + 1}: ${IMAGE_HELP}.`);
        if (!isText(t.alt, 120, false)) throw new HomeSectionError(`${where}, tile ${j + 1}: image description is up to 120 characters.`);
        target.title = t.title.trim();
        if (t.subtitle?.trim()) target.subtitle = t.subtitle.trim();
        target.image = t.image;
        if (t.alt?.trim()) target.alt = t.alt.trim();
      }
      return target;
    });
    return section;
  });
}
