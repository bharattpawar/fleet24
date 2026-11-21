import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { RestaurantOrdersService } from '../restaurant-orders.service';
import { RestaurantUpdatableStatus } from '../dto/restaurant-order.dto';

dotenv.config();

/**
 * A customer cancelling a paid order and the kitchen confirming it at the same moment.
 * The kitchen must see the cancellation and refuse; it must never overwrite it (the refund is already running).
 */
describe('Restaurant order status vs concurrent customer cancel (database)', () => {
  jest.setTimeout(60000);

  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let service: RestaurantOrdersService;
  const created = { users: [] as string[], restaurantId: '', outletId: '', orderIds: [] as string[] };
  let ownerId = '';

  const assignOrder = jest.fn().mockResolvedValue(null);

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL environment variable is required for integration tests');
    pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    db = drizzle(pool, { schema });

    const suffix = `${Date.now()}`.slice(-7);
    const [owner] = await db.insert(schema.users).values({ phone: `+91977${suffix}`, fullName: 'Race Test Owner' }).returning();
    const [customer] = await db.insert(schema.users).values({ phone: `+91966${suffix}`, fullName: 'Race Test Customer' }).returning();
    ownerId = owner.id;
    created.users.push(owner.id, customer.id);

    const [restaurant] = await db
      .insert(schema.restaurants)
      .values({ name: 'Race Test Kitchen', slug: `race-test-${suffix}`, ownerId })
      .returning();
    created.restaurantId = restaurant.id;
    const [outlet] = await db
      .insert(schema.restaurantOutlets)
      .values({
        restaurantId: restaurant.id,
        name: 'Race Test Outlet',
        phone: '9000000001',
        address: 'Test address',
        latitude: '28.4744000',
        longitude: '77.5040000',
      })
      .returning();
    created.outletId = outlet.id;

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderNumber: `FL-RACE-${suffix}`,
        customerId: customer.id,
        outletId: outlet.id,
        status: 'placed',
        itemTotal: '200.00',
        deliveryFee: '0.00',
        totalPayable: '200.00',
        deliveryAddressSnapshot: { label: 'Home' },
        deliveryLatitude: '28.4890000',
        deliveryLongitude: '77.5200000',
      })
      .returning();
    created.orderIds.push(order.id);

    service = new RestaurantOrdersService(
      db as any,
      { initiateOrderRefund: jest.fn() } as any,
      { assignOrder } as any,
      { cleanupDeliveryForCancelledOrder: jest.fn() } as any,
    );
  });

  afterAll(async () => {
    for (const id of created.orderIds) {
      await db.delete(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.orderId, id));
      await db.delete(schema.orders).where(eq(schema.orders.id, id));
    }
    if (created.outletId) await db.delete(schema.restaurantOutlets).where(eq(schema.restaurantOutlets.id, created.outletId));
    if (created.restaurantId) await db.delete(schema.restaurants).where(eq(schema.restaurants.id, created.restaurantId));
    for (const id of created.users) await db.delete(schema.users).where(eq(schema.users.id, id));
    await pool.end();
  });

  it('refuses to confirm an order the customer cancelled at the same moment', async () => {
    const orderId = created.orderIds[0];

    // Customer cancel is in flight: row updated, not yet committed.
    const cancelClient = await pool.connect();
    await cancelClient.query('BEGIN');
    await cancelClient.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1 AND status = 'placed'`, [orderId]);

    const confirm = service
      .updateOrderStatus(ownerId, ['restaurant_staff'], orderId, { status: RestaurantUpdatableStatus.CONFIRMED } as any)
      .then(
        () => 'confirmed',
        (err: Error) => err.message,
      );

    await new Promise((resolve) => setTimeout(resolve, 300));
    await cancelClient.query('COMMIT');
    cancelClient.release();

    const outcome = await confirm;
    const [row] = await db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, orderId));

    expect(row.status).toBe('cancelled');
    expect(outcome).toMatch(/terminal status 'cancelled'/);
    expect(assignOrder).not.toHaveBeenCalled();
  });
});
