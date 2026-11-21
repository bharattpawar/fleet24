import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { applyDishDiscount } from '../common/utils/discounts';
import { EatListPlanDto, EatListQueryDto, SaveEatListDto } from './eat-list.dto';
import { EatListRepository, EntryRow } from './eat-list.repository';
import { normalizePlan, readCursor, validDate } from './eat-list.validation';

@Injectable()
export class EatListService {
  constructor(private readonly repository: EatListRepository) {}
  private present(row: EntryRow) {
    return {
      id: row.id,
      menuItemId: row.menu_item_id,
      outletId: row.outlet_id,
      name: row.live_name ?? row.dish_name,
      restaurantName: row.restaurant_name,
      outletName: row.outlet_name,
      imageUrl: row.live_name ? row.live_image : row.image_url,
      isVeg: row.live_veg ?? row.is_veg,
      savedPrice: Number(row.saved_price),
      price:
        row.can_open && row.live_price != null
          ? applyDishDiscount(Number(row.live_price), row.discount_type, row.discount_value)
          : Number(row.saved_price),
      note: row.note,
      plannedDate: row.planned_date,
      plannedTime: row.planned_time?.slice(0, 5) ?? null,
      timeZone: row.time_zone,
      createdAt: row.created_at_iso,
      updatedAt: row.updated_at.toISOString(),
      isAvailable: row.available,
      canOpenMenu: row.can_open,
      outlet: row.can_open
        ? {
            id: row.outlet_id,
            restaurantId: row.restaurant_id,
            restaurantName: row.restaurant_name,
            outletName: row.outlet_name,
            slug: row.slug,
            address: row.address,
            deliveryRadiusKm: row.delivery_radius_km,
            isAcceptingOrders: row.accepting,
            logoUrl: null,
          }
        : null,
    };
  }
  async get(userId: string, id: string) {
    const row = await this.repository.get(userId, id);
    if (!row) throw new NotFoundException('This dish is no longer in your Eat List.');
    return this.present(row);
  }
  async list(userId: string, query: EatListQueryDto) {
    if (query.date && (!validDate(query.date) || query.mode !== 'planned'))
      throw new BadRequestException('Use a valid date with the Planned filter.');
    const cursor = readCursor(query.cursor, query.mode, query.date);
    const [rows, stats] = await Promise.all([
      this.repository.list(userId, query, cursor),
      this.repository.stats(userId),
    ]);
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              id: last.id,
              createdAt: last.created_at_iso,
              plannedDate: last.planned_date,
              plannedTime: last.planned_time?.slice(0, 5) ?? null,
              mode: query.mode,
              date: query.date || null,
            }),
          ).toString('base64url')
        : null;
    return { items: page.map((row) => this.present(row)), stats, nextCursor };
  }
  async save(userId: string, dto: SaveEatListDto) {
    const plan = normalizePlan(dto);
    const dish = await this.repository.dish(dto.outletId, dto.menuItemId);
    if (!dish)
      throw new NotFoundException('This dish is no longer available in that restaurant menu.');
    const id = await this.repository.insert(
      userId,
      dish,
      applyDishDiscount(Number(dish.price), dish.discount_type, dish.discount_value),
      plan,
    );
    if (!id) throw new BadRequestException('The list changed while saving. Please try again.');
    return this.get(userId, id);
  }
  async update(userId: string, id: string, dto: EatListPlanDto) {
    const existing = await this.get(userId, id);
    const merged = { ...existing, ...dto };
    if (Object.prototype.hasOwnProperty.call(dto, 'plannedDate') && !dto.plannedDate) {
      merged.plannedTime = null;
      merged.timeZone = null;
    }
    const plan = normalizePlan(merged);
    if (!(await this.repository.update(userId, id, plan)))
      throw new NotFoundException('This dish is no longer in your Eat List.');
    return this.get(userId, id);
  }
  membership(userId: string, outletId: string, itemIds: string[]) {
    return this.repository.membership(userId, outletId, itemIds);
  }
  async remove(userId: string, id: string) {
    if (!(await this.repository.remove(userId, id)))
      throw new NotFoundException('This dish is no longer in your Eat List.');
    return { id, removed: true };
  }
}
