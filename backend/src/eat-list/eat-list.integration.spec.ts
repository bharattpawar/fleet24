import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import { EatListRepository } from './eat-list.repository';
import { EatListService } from './eat-list.service';
import { EatListQueryDto } from './eat-list.dto';
dotenv.config();

/** Real PostgreSQL, isolated fixtures in one rolled-back transaction. */
describe('Eat List persistence, privacy and pagination (database)', () => {
  jest.setTimeout(60000);
  let pool: Pool;
  let client: PoolClient;
  let service: EatListService;
  const user = randomUUID(),
    other = randomUUID(),
    restaurant = randomUUID(),
    outlet = randomUUID(),
    foreignOutlet = randomUUID();
  const dishIds = Array.from({ length: 4 }, () => randomUUID());
  const target = (i = 0) => ({ outletId: outlet, menuItemId: dishIds[i] });
  const query = (mode: 'all' | 'planned' | 'someday' = 'all', rest = {}) =>
    Object.assign(new EatListQueryDto(), { mode, ...rest });
  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error(
        'DATABASE_URL must point to a migrated database for Eat List integration tests.',
      );
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO users(id,full_name) VALUES ($1,'Eat List QA'),($2,'Eat List Other QA')",
      [user, other],
    );
    await client.query(
      "INSERT INTO restaurants(id,name,slug,verification_status) VALUES ($1,'Eat List QA Kitchen',$2,'approved')",
      [restaurant, `eat-list-qa-${restaurant}`],
    );
    await client.query(
      "INSERT INTO restaurant_outlets(id,restaurant_id,name,phone,address,latitude,longitude) VALUES ($1,$2,'QA Outlet','9000000000','QA address',28.47,77.5)",
      [outlet, restaurant],
    );
    const category = randomUUID();
    await client.query(
      "INSERT INTO menu_categories(id,restaurant_id,name) VALUES ($1,$2,'QA Dishes')",
      [category, restaurant],
    );
    for (let i = 0; i < dishIds.length; i++)
      await client.query(
        "INSERT INTO menu_items(id,restaurant_id,category_id,name,base_price,is_available,discount_type,discount_value) VALUES ($1,$2,$3,$4,200,$5,'percentage',10)",
        [dishIds[i], restaurant, category, `QA Dish ${i}`, i !== 3],
      );
    service = new EatListService(new EatListRepository(client as unknown as Pool));
  });
  beforeEach(async () => {
    await client.query('SAVEPOINT eat_list_test');
  });
  afterEach(async () => {
    await client.query('ROLLBACK TO SAVEPOINT eat_list_test');
  });
  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    await pool?.end();
  });

  it('saves authoritative discounted prices, notes and calendar plans across repository instances', async () => {
    await client.query(
      'INSERT INTO outlet_menu_item_overrides(outlet_id,menu_item_id,custom_price) VALUES ($1,$2,150)',
      [outlet, dishIds[0]],
    );
    const saved = await service.save(user, {
      ...target(),
      note: '  Eat with friends  ',
      plannedDate: '2026-12-24',
      plannedTime: '20:30',
      timeZone: 'Asia/Kolkata',
    });
    expect(saved).toMatchObject({
      name: 'QA Dish 0',
      price: 135,
      savedPrice: 135,
      note: 'Eat with friends',
      plannedDate: '2026-12-24',
      plannedTime: '20:30',
      timeZone: 'Asia/Kolkata',
    });
    const fresh = new EatListService(new EatListRepository(client as unknown as Pool));
    expect(await fresh.get(user, saved.id)).toMatchObject({
      id: saved.id,
      createdAt: saved.createdAt,
      note: saved.note,
    });
    const edited = await fresh.update(user, saved.id, { note: 'Changed note', plannedDate: null });
    expect(edited).toMatchObject({
      note: 'Changed note',
      plannedDate: null,
      plannedTime: null,
      timeZone: null,
      createdAt: saved.createdAt,
    });
  });
  it('keeps duplicate saves idempotent without overwriting notes or saved dates', async () => {
    const first = await service.save(user, { ...target(), note: 'Keep this' });
    const again = await service.save(user, { ...target(), note: 'Do not overwrite' });
    expect(again).toMatchObject({ id: first.id, note: 'Keep this', createdAt: first.createdAt });
    expect((await service.list(user, query())).stats.all).toBe(1);
  });
  it('isolates list, membership, read, edit and delete by authenticated owner', async () => {
    const first = await service.save(user, target());
    expect((await service.list(other, query())).items).toEqual([]);
    expect(await service.membership(other, outlet, dishIds)).toEqual([]);
    expect(await service.membership(user, outlet, dishIds)).toEqual([
      { id: first.id, menuItemId: dishIds[0] },
    ]);
    await expect(service.get(other, first.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.update(other, first.id, { note: 'steal' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.remove(other, first.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.get(user, first.id)).toMatchObject({ note: null });
  });
  it('rejects a menu/outlet mismatch and a forged date filter', async () => {
    await expect(
      service.save(user, { ...target(), outletId: foreignOutlet }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.list(user, query('planned', { date: '2026-02-30' })),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('paginates equal saved timestamps without gaps and orders planned meals by day/time', async () => {
    for (let i = 0; i < 4; i++)
      await service.save(user, {
        ...target(i),
        ...(i < 3
          ? {
              plannedDate: i === 2 ? '2026-12-25' : '2026-12-24',
              plannedTime: i === 0 ? null : '12:00',
              timeZone: 'UTC',
            }
          : {}),
      });
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await service.list(
        user,
        query('all', { limit: 1, cursor: cursor || undefined }),
      );
      ids.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(new Set(ids).size).toBe(4);
    const planned = await service.list(user, query('planned', { limit: 1 }));
    expect(planned.items[0].menuItemId).toBe(dishIds[1]);
    const next = await service.list(
      user,
      query('planned', { limit: 1, cursor: planned.nextCursor }),
    );
    expect(next.items[0].menuItemId).toBe(dishIds[0]);
    expect((await service.list(user, query('planned', { date: '2026-12-25' }))).items).toHaveLength(
      1,
    );
    expect((await service.list(user, query('someday'))).stats).toEqual({
      all: 4,
      planned: 3,
      someday: 1,
    });
    await expect(
      service.list(user, query('someday', { cursor: planned.nextCursor })),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('preserves unavailable/deleted dishes and allows notes and removal afterwards', async () => {
    const saved = await service.save(user, { ...target(3), note: 'Try another day' });
    expect(saved).toMatchObject({ isAvailable: false, canOpenMenu: true });
    await client.query('DELETE FROM menu_items WHERE id=$1', [dishIds[3]]);
    const orphan = await service.get(user, saved.id);
    expect(orphan).toMatchObject({
      menuItemId: null,
      name: 'QA Dish 3',
      note: 'Try another day',
      canOpenMenu: false,
      savedPrice: 180,
    });
    expect(await service.update(user, saved.id, { note: 'Still on my list' })).toMatchObject({
      note: 'Still on my list',
    });
    await service.remove(user, saved.id);
    await expect(service.get(user, saved.id)).rejects.toMatchObject({ status: 404 });
  });
  it('matches active public-menu visibility and refuses inactive restaurants', async () => {
    // Admin-created active kitchens may retain the default verification label; public discovery uses is_active.
    await client.query("UPDATE restaurants SET verification_status='pending' WHERE id=$1", [
      restaurant,
    ]);
    const saved = await service.save(user, target());
    expect(saved.canOpenMenu).toBe(true);
    await client.query('UPDATE restaurants SET is_active=false WHERE id=$1', [restaurant]);
    await expect(service.save(user, target(1))).rejects.toMatchObject({ status: 404 });
    expect(await service.get(user, saved.id)).toMatchObject({
      canOpenMenu: false,
      isAvailable: false,
    });
  });
  it('enables RLS with no public read/write policies on personal plans', async () => {
    const result = await client.query(
      "SELECT relrowsecurity FROM pg_class WHERE oid='customer_eat_list_items'::regclass",
    );
    expect(result.rows[0].relrowsecurity).toBe(true);
    expect(
      (await client.query("SELECT * FROM pg_policies WHERE tablename='customer_eat_list_items'"))
        .rows,
    ).toHaveLength(0);
  });
});
