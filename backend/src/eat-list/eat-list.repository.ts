import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';
import { EatListQueryDto } from './eat-list.dto';
import { EatListCursor, normalizePlan } from './eat-list.validation';

export type Plan = ReturnType<typeof normalizePlan>;
export interface DishRow {
  id: string;
  outlet_id: string;
  dish_name: string;
  restaurant_name: string;
  outlet_name: string;
  image_url: string | null;
  is_veg: boolean;
  price: string;
  discount_type: 'percentage' | 'fixed_amount' | null;
  discount_value: string | null;
}
export interface EntryRow {
  id: string;
  outlet_id: string | null;
  menu_item_id: string | null;
  dish_name: string;
  restaurant_name: string;
  outlet_name: string;
  image_url: string | null;
  is_veg: boolean;
  saved_price: string;
  note: string | null;
  planned_date: string | null;
  planned_time: string | null;
  time_zone: string | null;
  created_at_iso: string;
  updated_at: Date;
  live_name: string | null;
  live_image: string | null;
  live_veg: boolean | null;
  live_price: string | null;
  discount_type: 'percentage' | 'fixed_amount' | null;
  discount_value: string | null;
  can_open: boolean;
  available: boolean;
  restaurant_id: string | null;
  slug: string | null;
  address: string | null;
  delivery_radius_km: string | null;
  accepting: boolean | null;
}
const selectEntries = `SELECT e.*, e.planned_date::text,
  to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_iso,
  m.name AS live_name, m.image_url AS live_image, m.is_veg AS live_veg,
  coalesce(ov.custom_price,m.base_price) AS live_price, m.discount_type, m.discount_value,
  coalesce(m.id IS NOT NULL AND c.is_active AND o.is_active AND r.is_active,false) AS can_open,
  coalesce(coalesce(ov.is_available,m.is_available) AND c.is_active AND o.is_active AND r.is_active AND o.is_accepting_orders,false) AS available,
  o.restaurant_id, r.slug, o.address, o.delivery_radius_km, o.is_accepting_orders AS accepting
  FROM customer_eat_list_items e
  LEFT JOIN restaurant_outlets o ON o.id=e.outlet_id
  LEFT JOIN restaurants r ON r.id=o.restaurant_id
  LEFT JOIN menu_items m ON m.id=e.menu_item_id AND m.restaurant_id=o.restaurant_id
  LEFT JOIN menu_categories c ON c.id=m.category_id
  LEFT JOIN outlet_menu_item_overrides ov ON ov.outlet_id=o.id AND ov.menu_item_id=m.id`;

@Injectable()
export class EatListRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async dish(outletId: string, menuItemId: string): Promise<DishRow | undefined> {
    const { rows } = await this.pool.query<DishRow>(
      `SELECT m.id,o.id AS outlet_id,m.name AS dish_name,
      r.name AS restaurant_name,o.name AS outlet_name,m.image_url,m.is_veg,
      coalesce(ov.custom_price,m.base_price) AS price,m.discount_type,m.discount_value
      FROM menu_items m JOIN menu_categories c ON c.id=m.category_id
      JOIN restaurant_outlets o ON o.restaurant_id=m.restaurant_id JOIN restaurants r ON r.id=o.restaurant_id
      LEFT JOIN outlet_menu_item_overrides ov ON ov.outlet_id=o.id AND ov.menu_item_id=m.id
      WHERE o.id=$1 AND m.id=$2 AND c.is_active AND o.is_active AND r.is_active`,
      [outletId, menuItemId],
    );
    return rows[0];
  }
  async insert(userId: string, dish: DishRow, price: number, plan: Plan): Promise<string> {
    // A duplicate save is idempotent: it never erases an existing note or resets its saved date.
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO customer_eat_list_items
      (user_id,outlet_id,menu_item_id,dish_name,restaurant_name,outlet_name,image_url,is_veg,saved_price,note,planned_date,planned_time,time_zone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (user_id,outlet_id,menu_item_id) DO NOTHING RETURNING id`,
      [
        userId,
        dish.outlet_id,
        dish.id,
        dish.dish_name,
        dish.restaurant_name,
        dish.outlet_name,
        dish.image_url,
        dish.is_veg,
        price,
        plan.note,
        plan.plannedDate,
        plan.plannedTime,
        plan.timeZone,
      ],
    );
    if (rows[0]) return rows[0].id;
    const existing = await this.pool.query<{ id: string }>(
      'SELECT id FROM customer_eat_list_items WHERE user_id=$1 AND outlet_id=$2 AND menu_item_id=$3',
      [userId, dish.outlet_id, dish.id],
    );
    return existing.rows[0]?.id;
  }
  async get(userId: string, id: string): Promise<EntryRow | undefined> {
    return (
      await this.pool.query<EntryRow>(`${selectEntries} WHERE e.user_id=$1 AND e.id=$2`, [
        userId,
        id,
      ])
    ).rows[0];
  }
  async list(userId: string, query: EatListQueryDto, cursor: EatListCursor | null) {
    const values: unknown[] = [userId];
    const bind = (value: unknown) => {
      values.push(value);
      return '$' + values.length;
    };
    const where = ['e.user_id=$1'];
    if (query.mode === 'planned') where.push('e.planned_date IS NOT NULL');
    if (query.mode === 'someday') where.push('e.planned_date IS NULL');
    if (query.date) where.push(`e.planned_date=${bind(query.date)}::date`);
    if (cursor) {
      if (query.mode === 'planned')
        where.push(
          `(e.planned_date,coalesce(e.planned_time,'23:59:59'::time),e.id) > (${bind(cursor.plannedDate)}::date,coalesce(${bind(cursor.plannedTime)}::time,'23:59:59'::time),${bind(cursor.id)}::uuid)`,
        );
      else
        where.push(
          `(e.created_at,e.id) < (${bind(cursor.createdAt)}::timestamptz,${bind(cursor.id)}::uuid)`,
        );
    }
    const order =
      query.mode === 'planned'
        ? "e.planned_date,coalesce(e.planned_time,'23:59:59'::time),e.id"
        : 'e.created_at DESC,e.id DESC';
    return (
      await this.pool.query<EntryRow>(
        `${selectEntries} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${bind(query.limit + 1)}`,
        values,
      )
    ).rows;
  }
  async stats(userId: string) {
    return (
      await this.pool.query<{ all: number; planned: number; someday: number }>(
        `SELECT count(*)::int AS all,
      count(*) FILTER (WHERE planned_date IS NOT NULL)::int AS planned,
      count(*) FILTER (WHERE planned_date IS NULL)::int AS someday FROM customer_eat_list_items WHERE user_id=$1`,
        [userId],
      )
    ).rows[0];
  }
  async membership(userId: string, outletId: string, itemIds: string[]) {
    return (
      await this.pool.query<{ menuItemId: string; id: string }>(
        'SELECT menu_item_id AS "menuItemId",id FROM customer_eat_list_items WHERE user_id=$1 AND outlet_id=$2 AND menu_item_id=ANY($3::uuid[])',
        [userId, outletId, itemIds],
      )
    ).rows;
  }
  async update(userId: string, id: string, plan: Plan) {
    return (
      await this.pool.query(
        `UPDATE customer_eat_list_items SET note=$3,planned_date=$4,planned_time=$5,time_zone=$6,updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING id`,
        [userId, id, plan.note, plan.plannedDate, plan.plannedTime, plan.timeZone],
      )
    ).rowCount;
  }
  async remove(userId: string, id: string) {
    return (
      await this.pool.query(
        'DELETE FROM customer_eat_list_items WHERE user_id=$1 AND id=$2 RETURNING id',
        [userId, id],
      )
    ).rowCount;
  }
}
