import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { MenusService } from '../menus.service';
import { OutletAuthorizationService } from '../outlet-auth.service';

dotenv.config();

/**
 * Menu editing is scoped to the restaurant(s) the user owns or staffs:
 * - staff assigned to outlets of two restaurants can edit both
 * - an owner without a staff row (admin-created restaurant) can edit categories
 * - nobody can move a dish into another restaurant's category or price another restaurant's dish
 */
describe('Menu ownership (database)', () => {
  jest.setTimeout(60000);

  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let menus: MenusService;
  const ids = { users: [] as string[], restaurants: [] as string[], outlets: [] as string[] };
  const fx: Record<string, string> = {};

  const staff = (userId: string) => ({ userId, roles: ['restaurant_staff'] }) as any;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL environment variable is required for integration tests');
    pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    db = drizzle(pool, { schema });
    menus = new MenusService(db as any, new OutletAuthorizationService(db as any));

    const s = `${Date.now()}`.slice(-7);
    const [multi] = await db.insert(schema.users).values({ phone: `+91955${s}`, fullName: 'Two-kitchen cook' }).returning();
    const [owner] = await db.insert(schema.users).values({ phone: `+91944${s}`, fullName: 'Owner without staff row' }).returning();
    ids.users.push(multi.id, owner.id);
    fx.multi = multi.id;
    fx.owner = owner.id;

    for (const key of ['A', 'B']) {
      const [r] = await db
        .insert(schema.restaurants)
        .values({ name: `Ownership ${key}`, slug: `ownership-${key}-${s}`, ownerId: key === 'B' ? owner.id : null })
        .returning();
      const [o] = await db
        .insert(schema.restaurantOutlets)
        .values({ restaurantId: r.id, name: `Outlet ${key}`, phone: '9000000002', address: 'x', latitude: '28.47', longitude: '77.50' })
        .returning();
      const [c] = await db.insert(schema.menuCategories).values({ restaurantId: r.id, name: `Mains ${key}` }).returning();
      const [i] = await db
        .insert(schema.menuItems)
        .values({ restaurantId: r.id, categoryId: c.id, name: `Dish ${key}`, basePrice: '100.00' })
        .returning();
      ids.restaurants.push(r.id);
      ids.outlets.push(o.id);
      Object.assign(fx, { [`rest${key}`]: r.id, [`outlet${key}`]: o.id, [`cat${key}`]: c.id, [`item${key}`]: i.id });
    }
    // Staff at both restaurants; the restaurant B assignment is inserted first on purpose.
    await db.insert(schema.restaurantStaff).values([
      { userId: multi.id, outletId: fx.outletB, designation: 'Cook' },
      { userId: multi.id, outletId: fx.outletA, designation: 'Cook' },
    ]);
  });

  afterAll(async () => {
    await db.delete(schema.outletMenuItemOverrides).where(inArray(schema.outletMenuItemOverrides.outletId, ids.outlets));
    await db.delete(schema.restaurantStaff).where(inArray(schema.restaurantStaff.outletId, ids.outlets));
    await db.delete(schema.menuItems).where(inArray(schema.menuItems.restaurantId, ids.restaurants));
    await db.delete(schema.menuCategories).where(inArray(schema.menuCategories.restaurantId, ids.restaurants));
    await db.delete(schema.restaurantOutlets).where(inArray(schema.restaurantOutlets.id, ids.outlets));
    await db.delete(schema.restaurants).where(inArray(schema.restaurants.id, ids.restaurants));
    await db.delete(schema.users).where(inArray(schema.users.id, ids.users));
    await pool.end();
  });

  it('lets staff of two restaurants edit dishes and categories in both', async () => {
    await expect(menus.updateMenuItem(fx.itemA, { basePrice: 120 } as any, staff(fx.multi))).resolves.toMatchObject({ basePrice: '120.00' });
    await expect(menus.updateMenuItem(fx.itemB, { basePrice: 130 } as any, staff(fx.multi))).resolves.toMatchObject({ basePrice: '130.00' });
    await expect(menus.updateCategory(fx.catA, { name: 'Mains A2' } as any, staff(fx.multi))).resolves.toMatchObject({ name: 'Mains A2' });
  });

  it('lets an owner without a staff row edit their categories', async () => {
    await expect(menus.updateCategory(fx.catB, { name: 'Owner rename' } as any, staff(fx.owner))).resolves.toMatchObject({ name: 'Owner rename' });
  });

  it("refuses to move a dish into another restaurant's category", async () => {
    await expect(menus.updateMenuItem(fx.itemB, { categoryId: fx.catA } as any, staff(fx.owner))).rejects.toThrow(/category/i);
    const [row] = await db.select({ categoryId: schema.menuItems.categoryId }).from(schema.menuItems).where(eq(schema.menuItems.id, fx.itemB));
    expect(row.categoryId).toBe(fx.catB);
  });

  it("refuses an outlet price override for another restaurant's dish", async () => {
    await expect(
      menus.setOutletMenuItemOverride(fx.outletB, fx.itemA, { isAvailable: true, customPrice: 1 } as any, staff(fx.owner)),
    ).rejects.toThrow();
  });

  it('refuses users with no link to the restaurant', async () => {
    await expect(menus.updateMenuItem(fx.itemA, { basePrice: 1 } as any, staff(fx.owner))).rejects.toThrow();
  });
});
