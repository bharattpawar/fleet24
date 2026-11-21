import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { menuItems } from './menus';
import { restaurantOutlets } from './restaurants';

/** Private, user-owned dish plans. Snapshots survive a removed menu item/outlet. */
export const customerEatListItems = pgTable(
  'customer_eat_list_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').references(() => restaurantOutlets.id, { onDelete: 'set null' }),
    menuItemId: uuid('menu_item_id').references(() => menuItems.id, { onDelete: 'set null' }),
    dishName: varchar('dish_name', { length: 100 }).notNull(),
    restaurantName: varchar('restaurant_name', { length: 100 }).notNull(),
    outletName: varchar('outlet_name', { length: 100 }).notNull(),
    imageUrl: varchar('image_url', { length: 2048 }),
    isVeg: boolean('is_veg').notNull(),
    savedPrice: numeric('saved_price', { precision: 10, scale: 2 }).notNull(),
    note: varchar('note', { length: 1000 }),
    plannedDate: date('planned_date'),
    plannedTime: time('planned_time', { precision: 0 }),
    timeZone: varchar('time_zone', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('eat_list_user_dish_outlet_unique').on(
      table.userId,
      table.outletId,
      table.menuItemId,
    ),
    index('eat_list_user_saved_idx').on(table.userId, table.createdAt.desc(), table.id.desc()),
    index('eat_list_user_plan_idx').on(
      table.userId,
      table.plannedDate,
      sql`coalesce(${table.plannedTime}, '23:59:59'::time)`,
      table.id,
    ),
    check(
      'eat_list_time_requires_date',
      sql`${table.plannedTime} IS NULL OR ${table.plannedDate} IS NOT NULL`,
    ),
    check(
      'eat_list_plan_requires_zone',
      sql`${table.plannedDate} IS NULL OR ${table.timeZone} IS NOT NULL`,
    ),
  ],
).enableRLS();
