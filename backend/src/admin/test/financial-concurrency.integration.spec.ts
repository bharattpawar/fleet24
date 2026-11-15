import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from '../../database/schema';
import { eq, sql } from 'drizzle-orm';
import { getIstMonthBoundaries } from '../../common/utils/ist-date.util';

dotenv.config();

/**
 * Live PostgreSQL-Backed Concurrency & Financial Integrity Integration Test Suite
 * Tests actual PostgreSQL transactions, row-level locks, and multi-session concurrency.
 */
describe('Database-Backed Financial Concurrency Integration Tests', () => {
  jest.setTimeout(60000);

  let pool: Pool;
  let db: ReturnType<typeof drizzle>;

  // Test entities created dynamically
  let testCustomerId: string;
  let testRestaurantId: string;
  let testOutletId: string;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required for integration tests');
    }

    pool = new Pool({
      connectionString: dbUrl,
      max: 10, // Supports true parallel connections
      ssl: { rejectUnauthorized: false },
    });

    db = drizzle(pool, { schema });

    // Seed test user (customer)
    const [cust] = await db
      .insert(schema.users)
      .values({
        fullName: 'Concurrency Test Customer',
        phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
      })
      .returning();
    testCustomerId = cust.id;

    // Seed test restaurant & outlet
    const [rest] = await db
      .insert(schema.restaurants)
      .values({
        name: 'Concurrency Test Restaurant',
        slug: `conc-test-rest-${Date.now()}`,
      })
      .returning();
    testRestaurantId = rest.id;

    const [outlet] = await db
      .insert(schema.restaurantOutlets)
      .values({
        restaurantId: testRestaurantId,
        name: 'Main Outlet',
        phone: '9876543210',
        address: 'Test Sector, Greater Noida 201310',
        latitude: '28.4744',
        longitude: '77.5040',
        deliveryRadiusKm: '5.0',
      })
      .returning();
    testOutletId = outlet.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testCustomerId) {
      await db.delete(schema.orders).where(eq(schema.orders.customerId, testCustomerId));
      await db.delete(schema.users).where(eq(schema.users.id, testCustomerId));
    }
    if (testRestaurantId) {
      await db
        .delete(schema.restaurantMonthlyDeliveryCredits)
        .where(eq(schema.restaurantMonthlyDeliveryCredits.restaurantId, testRestaurantId));
      await db.delete(schema.restaurantOutlets).where(eq(schema.restaurantOutlets.id, testOutletId));
      await db.delete(schema.restaurants).where(eq(schema.restaurants.id, testRestaurantId));
    }

    await pool.end();
  });

  describe('Scenario 1: Customer Free-Delivery Multi-Session Concurrency', () => {
    it('prevents two simultaneous checkout requests from double-claiming the 3rd free delivery', async () => {
      // Step A: Seed 2 prior delivered orders for the customer
      await db.insert(schema.orders).values([
        {
          orderNumber: `ORD-CONC-1-${Date.now()}`,
          customerId: testCustomerId,
          outletId: testOutletId,
          status: 'delivered',
          itemTotal: '300.00',
          deliveryFee: '0.00', // Free order 1
          taxAmount: '15.00',
          totalPayable: '315.00',
          deliveryAddressSnapshot: {},
          deliveryLatitude: '28.4744',
          deliveryLongitude: '77.5040',
        },
        {
          orderNumber: `ORD-CONC-2-${Date.now()}`,
          customerId: testCustomerId,
          outletId: testOutletId,
          status: 'delivered',
          itemTotal: '300.00',
          deliveryFee: '0.00', // Free order 2
          taxAmount: '15.00',
          totalPayable: '315.00',
          deliveryAddressSnapshot: {},
          deliveryLatitude: '28.4744',
          deliveryLongitude: '77.5040',
        },
      ]);

      // Step B: Simulate 2 concurrent checkouts from separate DB clients competing for the 3rd free order
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      const simulateCheckout = async (client: any, sessionLabel: string) => {
        try {
          await client.query('BEGIN');

          // Row lock customer
          await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [testCustomerId]);

          // Count prior eligible orders under lock
          const countRes = await client.query(
            `SELECT count(*)::int as count FROM orders 
             WHERE customer_id = $1 
               AND status IN ('delivered', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery')`,
            [testCustomerId],
          );
          const priorCount = countRes.rows[0].count;

          // If priorCount < 3, delivery fee is 0.00, else 30.00
          const fee = priorCount < 3 ? '0.00' : '30.00';

          const insertRes = await client.query(
            `INSERT INTO orders (order_number, customer_id, outlet_id, status, item_total, delivery_fee, tax_amount, total_payable, delivery_address_snapshot, delivery_latitude, delivery_longitude)
             VALUES ($1, $2, $3, 'delivered', '200.00', $4, '10.00', '240.00', '{}', '28.4744', '77.5040')
             RETURNING id, delivery_fee`,
            [`ORD-${sessionLabel}-${Date.now()}`, testCustomerId, testOutletId, fee],
          );

          await client.query('COMMIT');
          return insertRes.rows[0];
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      };

      // Execute both checkouts concurrently
      const [res1, res2] = await Promise.all([
        simulateCheckout(client1, 'SESS1'),
        simulateCheckout(client2, 'SESS2'),
      ]);

      const fees = [res1.delivery_fee, res2.delivery_fee].sort();
      // Exactly one order receives free delivery ('0.00'), the other pays standard fee ('30.00')
      expect(fees).toEqual(['0.00', '30.00']);
    });
  });

  describe('Scenario 2: Concurrent Restaurant Monthly Credit Consumption', () => {
    it('prevents negative credit balance and charges extra fee when remaining credit is exactly 1', async () => {
      const { yearMonth, startUtc, endUtc } = getIstMonthBoundaries();

      // Seed credit block with 149 used out of 150 (exactly 1 remaining)
      const [block] = await db
        .insert(schema.restaurantMonthlyDeliveryCredits)
        .values({
          restaurantId: testRestaurantId,
          periodMonthYear: yearMonth,
          allocatedCredits: 150,
          usedCredits: 149,
          additionalDeliveriesCount: 0,
          additionalPerDeliveryFee: '25.00',
          periodStart: startUtc,
          periodEnd: endUtc,
        })
        .returning();

      // Simulate 2 parallel delivery completions
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      const simulateCreditConsume = async (client: any, _ordId?: string) => {
        try {
          await client.query('BEGIN');

          const lockRes = await client.query(
            'SELECT * FROM restaurant_monthly_delivery_credits WHERE id = $1 FOR UPDATE',
            [block.id],
          );
          const current = lockRes.rows[0];

          let isExtra = false;
          let newUsed = current.used_credits;
          let newExtra = current.additional_deliveries_count;

          if (current.used_credits < current.allocated_credits) {
            newUsed += 1;
          } else {
            isExtra = true;
            newExtra += 1;
          }

          await client.query(
            `UPDATE restaurant_monthly_delivery_credits 
             SET used_credits = $1, additional_deliveries_count = $2, updated_at = NOW() 
             WHERE id = $3`,
            [newUsed, newExtra, block.id],
          );

          await client.query('COMMIT');
          return { isExtra, used: newUsed, extra: newExtra };
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      };

      const [c1, c2] = await Promise.all([
        simulateCreditConsume(client1, 'ord-1'),
        simulateCreditConsume(client2, 'ord-2'),
      ]);

      const extraFlags = [c1.isExtra, c2.isExtra].sort();
      // Exactly one consumed the remaining credit (isExtra = false), the other was charged extra (isExtra = true)
      expect(extraFlags).toEqual([false, true]);

      // Check final DB state
      const [finalBlock] = await db
        .select()
        .from(schema.restaurantMonthlyDeliveryCredits)
        .where(eq(schema.restaurantMonthlyDeliveryCredits.id, block.id));

      expect(finalBlock.usedCredits).toBe(150);
      expect(finalBlock.additionalDeliveriesCount).toBe(1);
    });
  });

  describe('Scenario 3: Financial Settings Concurrent Draft Version Creation', () => {
    it('prevents duplicate version_number allocation using transactional advisory locks', async () => {
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      const createDraft = async (client: any, reason: string) => {
        try {
          await client.query('BEGIN');
          // Advisory lock 420042
          await client.query('SELECT pg_advisory_xact_lock(420042)');

          const maxRes = await client.query(
            'SELECT coalesce(max(version_number), 0)::int as max_v FROM financial_settings_versions',
          );
          const nextV = maxRes.rows[0].max_v + 1;

          const insRes = await client.query(
            `INSERT INTO financial_settings_versions (version_number, status, settings_payload, change_reason, created_by)
             VALUES ($1, 'draft', '{}', $2, $3)
             RETURNING id, version_number`,
            [nextV, reason, testCustomerId],
          );

          await client.query('COMMIT');
          return insRes.rows[0];
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      };

      const [d1, d2] = await Promise.all([
        createDraft(client1, 'Draft A'),
        createDraft(client2, 'Draft B'),
      ]);

      expect(d1.version_number).not.toBe(d2.version_number);
      expect(Math.abs(d1.version_number - d2.version_number)).toBe(1);

      // Clean up created test draft versions
      await db
        .delete(schema.financialSettingsVersions)
        .where(sql`id IN (${d1.id}, ${d2.id})`);
    });
  });

  describe('Scenario 4: Financial Ledger Idempotency', () => {
    it('rejects duplicate financial ledger insertions with the same idempotency key', async () => {
      const idempotencyKey = `conc_test_ledger_${Date.now()}`;

      // Insert 1
      await db.insert(schema.financialLedger).values({
        transactionReference: 'REF_TEST_1',
        entityType: 'platform',
        entityId: 'platform',
        entryType: 'manual_adjustment',
        direction: 'credit',
        amount: '100.00',
        currency: 'INR',
        idempotencyKey,
      });

      // Insert 2 with same idempotency key must violate unique constraint
      await expect(
        db.insert(schema.financialLedger).values({
          transactionReference: 'REF_TEST_2',
          entityType: 'platform',
          entityId: 'platform',
          entryType: 'manual_adjustment',
          direction: 'credit',
          amount: '100.00',
          currency: 'INR',
          idempotencyKey,
        }),
      ).rejects.toThrow();

      // Clean up
      await db
        .delete(schema.financialLedger)
        .where(eq(schema.financialLedger.idempotencyKey, idempotencyKey));
    });
  });
});

