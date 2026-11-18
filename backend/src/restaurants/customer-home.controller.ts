import { BadRequestException, Body, Controller, Get, Inject, Put, Query, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { MenusService } from './menus.service';

type Target = { type: 'category' | 'restaurant' | 'outlet' | 'dish'; id: string };
type Section = { kind: 'banner' | 'category' | 'row'; title: string; image?: string; cta?: string; hidden?: boolean; targets: Target[] };

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
  async save(@Body() body: { sections: Section[]; publish?: boolean }) {
    if (!Array.isArray(body?.sections) || body.sections.length > 40 || (body.publish !== undefined && typeof body.publish !== 'boolean')) {
      throw new BadRequestException('Expected up to 40 sections.');
    }
    const catalog = await this.catalog();
    for (const section of body.sections) {
      if (!section || !['banner', 'category', 'row'].includes(section.kind) ||
          typeof section.title !== 'string' || !section.title.trim() || section.title.length > 100 ||
          (section.hidden !== undefined && typeof section.hidden !== 'boolean') ||
          !Array.isArray(section.targets) || !section.targets.length || section.targets.length > 20 ||
          (section.kind !== 'row' && section.targets.length !== 1)) {
        throw new BadRequestException('Invalid section title, type or target count.');
      }
      if (section.kind === 'banner' && (typeof section.cta !== 'string' || !section.cta.trim() || section.cta.length > 40)) {
        throw new BadRequestException('Enter a banner CTA of up to 40 characters.');
      }
      if (section.kind !== 'row') {
        try {
          if (typeof section.image !== 'string' || section.image.length > 2048) throw new Error();
          const url = new URL(section.image);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
        } catch {
          throw new BadRequestException('Enter a valid HTTP or HTTPS image URL.');
        }
      }
      for (const target of section.targets) {
        if (!target || !Object.prototype.hasOwnProperty.call(catalog, target.type) ||
            !catalog[target.type].some(item => item.id === target.id) ||
            (section.kind === 'category' && target.type !== 'category') ||
            (section.kind === 'row' && !['dish', 'outlet'].includes(target.type))) {
          throw new BadRequestException('Select an existing destination allowed for this section.');
        }
      }
    }
    const values = { draft: body.sections, ...(body.publish ? { published: body.sections } : {}) };
    await this.db.insert(schema.customerHome).values({ id: 1, ...values })
      .onConflictDoUpdate({ target: schema.customerHome.id, set: values });
    return { saved: true };
  }

  @Get('public/customer-home')
  async feed(@Query('latitude') latitude?: string, @Query('longitude') longitude?: string) {
    const lat = latitude === undefined ? undefined : Number(latitude);
    const lon = longitude === undefined ? undefined : Number(longitude);
    if ((lat !== undefined || lon !== undefined) &&
        (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)) {
      throw new BadRequestException('Invalid delivery coordinates.');
    }
    const [outlets, records] = await Promise.all([
      this.menus.getPublicActiveOutlets(lat, lon),
      this.db.select().from(schema.customerHome),
    ]);
    const sections = (records[0]?.published as Section[] | undefined)?.filter(section => !section.hidden) ?? [];
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
    const menus = new Map(menuEntries);
    return {
      outlets,
      categoriesByOutlet,
      sections: sections.flatMap(section => {
        const cards = section.targets.flatMap(target => {
          const matches = eligible.flatMap(outlet => {
            const dish = target.type === 'dish' ? menus.get(outlet.id)?.find(item => item.id === target.id) : undefined;
            const matchesTarget = target.type === 'outlet' ? outlet.id === target.id :
              target.type === 'restaurant' ? outlet.restaurantId === target.id :
              target.type === 'dish' ? Boolean(dish) : menus.get(outlet.id)?.some(item => item.categoryId === target.id);
            return matchesTarget ? [{ outlet, dish }] : [];
          });
          return target.type === 'category' ? matches : matches.slice(0, 1);
        });
        return cards.length ? [{ ...section, cards }] : [];
      }),
    };
  }
}
