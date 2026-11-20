import { BadRequestException, Body, Controller, Get, Inject, Put, Query, UseGuards } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { MenusService } from './menus.service';

import { HomeCatalog, HomeSection, HomeSectionError, HomeTarget, validateHomeSections } from './customer-home.sections';

@Controller()
export class CustomerHomeController {
  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly menus: MenusService,
  ) {}

  private async catalog() {
    const [categories, restaurants, outlets, dishes] = await Promise.all([
      this.db.select({ id: schema.menuCategories.id, name: schema.menuCategories.name }).from(schema.menuCategories),
      this.db.select({ id: schema.restaurants.id, name: schema.restaurants.name }).from(schema.restaurants),
      this.db.select({ id: schema.restaurantOutlets.id, name: schema.restaurantOutlets.name }).from(schema.restaurantOutlets),
      this.db.select({ id: schema.menuItems.id, name: schema.menuItems.name }).from(schema.menuItems),
    ]);
    return { category: categories, restaurant: restaurants, outlet: outlets, dish: dishes };
  }

  @Get('admin/customer-home')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async editor() {
    const [record] = await this.db.select().from(schema.customerHome);
    return { draft: record?.draft ?? [], catalog: await this.catalog() };
  }

  @Put('admin/customer-home')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async save(@Body() body: { sections: unknown; publish?: boolean }) {
    if (body?.publish !== undefined && typeof body.publish !== 'boolean') {
      throw new BadRequestException('publish must be true or false.');
    }
    let sections: HomeSection[];
    try {
      sections = validateHomeSections(body?.sections, (await this.catalog()) as HomeCatalog);
    } catch (err) {
      if (err instanceof HomeSectionError) throw new BadRequestException(err.message);
      throw err;
    }
    const values = { draft: sections, ...(body.publish ? { published: sections } : {}) };
    await this.db.insert(schema.customerHome).values({ id: 1, ...values })
      .onConflictDoUpdate({ target: schema.customerHome.id, set: values });
    return { saved: true };
  }

  /** Veg flags and declared cuisines for each outlet, two queries in total. */
  private async outletFacts(outlets: Array<{ id: string; restaurantId?: string }>) {
    const [vegByOutlet, cuisinesByRestaurant] = await Promise.all([
      this.menus.vegFactsByOutlet(outlets.map(outlet => outlet.id)),
      this.menus.cuisinesByRestaurant([...new Set(outlets.flatMap(outlet => outlet.restaurantId ? [outlet.restaurantId] : []))]),
    ]);
    const cuisinesByOutlet = Object.fromEntries(
      outlets.map(outlet => [outlet.id, (outlet.restaurantId && cuisinesByRestaurant[outlet.restaurantId]) || []]),
    );
    return { vegByOutlet, cuisinesByOutlet };
  }

  private parseCoordinates(latitude?: string, longitude?: string) {
    const lat = latitude === undefined ? undefined : Number(latitude);
    const lon = longitude === undefined ? undefined : Number(longitude);
    if ((lat !== undefined || lon !== undefined) &&
        (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)) {
      throw new BadRequestException('Invalid delivery coordinates.');
    }
    return { lat, lon };
  }

  /**
   * GET /public/search?q=biryani&latitude=&longitude=
   * Restaurants whose name, outlet, declared cuisine or menu category matches, plus matching dishes
   * they can sell now. Only kitchens the customer could see on Home are searched.
   */
  @Get('public/search')
  async search(@Query('q') q?: string, @Query('latitude') latitude?: string, @Query('longitude') longitude?: string) {
    const term = (q ?? '').trim();
    if (term.length < 2) throw new BadRequestException('Type at least 2 characters to search.');
    if (term.length > 60) throw new BadRequestException('Search is limited to 60 characters.');
    const { lat, lon } = this.parseCoordinates(latitude, longitude);
    const outlets = await this.menus.getPublicActiveOutlets(lat, lon);
    const ids = outlets.map(outlet => outlet.id);
    const [categoriesByOutlet, facts, dishes] = await Promise.all([
      this.menus.listAvailableCategoryNamesByOutlet(ids),
      this.outletFacts(outlets),
      this.menus.searchAvailableDishes(ids, term),
    ]);
    const needle = term.toLowerCase();
    const has = (value?: string | null) => Boolean(value && value.toLowerCase().includes(needle));
    const dishOutletIds = new Set(dishes.map(match => match.outletId));
    const matched = outlets.filter(outlet =>
      has(outlet.restaurantName) || has(outlet.outletName) ||
      facts.cuisinesByOutlet[outlet.id]?.some(has) || categoriesByOutlet[outlet.id]?.some(has) ||
      dishOutletIds.has(outlet.id));
    // Open kitchens and direct name matches first.
    const rank = (outlet: (typeof outlets)[number]) =>
      (outlet.isAcceptingOrders ? 0 : 2) + (has(outlet.restaurantName) ? 0 : 1);
    matched.sort((a, b) => rank(a) - rank(b) || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    const byId = new Map(outlets.map(outlet => [outlet.id, outlet]));
    return {
      query: term,
      outlets: matched,
      dishes: dishes.flatMap(match => {
        const outlet = byId.get(match.outletId);
        return outlet ? [{ outlet, dish: match.dish }] : [];
      }),
      vegByOutlet: facts.vegByOutlet,
      cuisinesByOutlet: facts.cuisinesByOutlet,
      categoriesByOutlet,
    };
  }

  @Get('public/customer-home')
  async feed(@Query('latitude') latitude?: string, @Query('longitude') longitude?: string) {
    const { lat, lon } = this.parseCoordinates(latitude, longitude);
    const [outlets, records] = await Promise.all([
      this.menus.getPublicActiveOutlets(lat, lon),
      this.db.select().from(schema.customerHome),
    ]);
    const sections = (records[0]?.published as HomeSection[] | undefined)?.filter(section => !section.hidden) ?? [];
    const eligible = outlets.filter(outlet => outlet.isAcceptingOrders &&
      (lat === undefined || (outlet.latitude != null && outlet.longitude != null)));
    // Full menus only when a published section points at a dish or a category
    const needsMenu = sections.some(section => section.targets.some(target => target.type === 'dish' || target.type === 'category'));
    const [menuEntries, categoriesByOutlet] = await Promise.all([
      needsMenu
        ? Promise.all(eligible.map(async outlet =>
            [outlet.id, (await this.menus.listMenuItemsForOutlet(outlet.id))
              .filter(item => item.effectiveIsAvailable && item.categoryIsActive)] as const,
          ))
        : Promise.resolve([] as const),
      // Cuisine chips: one query for all outlets instead of loading every menu
      this.menus.listAvailableCategoryNamesByOutlet(outlets.map(outlet => outlet.id)),
    ]);
    const { vegByOutlet, cuisinesByOutlet } = await this.outletFacts(outlets);
    const menus = new Map(menuEntries);
    // Category destinations: the app filters Home by this cuisine name when tapped.
    const categoryIds = sections.flatMap(section => section.targets.filter(t => t.type === 'category').map(t => t.id));
    const categoryNames = new Map(
      categoryIds.length
        ? (await this.db
            .select({ id: schema.menuCategories.id, name: schema.menuCategories.name })
            .from(schema.menuCategories)
            .where(inArray(schema.menuCategories.id, categoryIds))
          ).map(row => [row.id, row.name] as const)
        : [],
    );
    return {
      outlets,
      categoriesByOutlet,
      vegByOutlet,
      cuisinesByOutlet,
      sections: sections.flatMap(section => {
        // Rail toggle and search hints carry no destinations: the app builds them from `outlets`.
        if (section.kind === 'rail' || section.kind === 'search_hints' || section.kind === 'shortcuts') return [{ ...section, cards: [] }];
        const resolve = (target: HomeTarget) => {
          const matches = eligible.flatMap(outlet => {
            const dish = target.type === 'dish' ? menus.get(outlet.id)?.find(item => item.id === target.id) : undefined;
            const matchesTarget = target.type === 'outlet' ? outlet.id === target.id :
              target.type === 'restaurant' ? outlet.restaurantId === target.id :
              target.type === 'dish' ? Boolean(dish) : menus.get(outlet.id)?.some(item => item.categoryId === target.id);
            return matchesTarget ? [{ outlet, dish }] : [];
          });
          return target.type === 'category' ? matches : matches.slice(0, 1);
        };
        if (section.kind === 'tiles') {
          // Each tile keeps its own title/photo; tiles whose destination has nothing open nearby are dropped.
          const tiles = section.targets.flatMap(target => {
            const cards = resolve(target);
            const name = categoryNames.get(target.id);
            return cards.length ? [{ ...target, ...(name ? { name } : {}), cards }] : [];
          });
          return tiles.length ? [{ ...section, targets: tiles, cards: tiles.flatMap(tile => tile.cards.slice(0, 1)) }] : [];
        }
        const cards = section.targets.flatMap(resolve);
        const name = section.kind === 'category' ? categoryNames.get(section.targets[0]?.id) : undefined;
        return cards.length ? [{ ...section, ...(name ? { categoryName: name } : {}), cards }] : [];
      }),
    };
  }
}
