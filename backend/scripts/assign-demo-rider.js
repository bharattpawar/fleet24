const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  // 1. Mark other test riders offline
  await pool.query(
    "UPDATE riders SET availability_status = 'offline', is_online = false WHERE id != 'f206d273-2629-413a-8cc9-4531cc7bb3a1'",
  );
  console.log('Marked all other riders offline.');

  // 2. Ensure Demo Rider (+911234567890) is available & ready
  await pool.query(
    "UPDATE riders SET availability_status = 'available', is_online = true, current_active_orders_count = 0 WHERE id = 'f206d273-2629-413a-8cc9-4531cc7bb3a1'",
  );
  console.log('Demo Rider (+911234567890) is AVAILABLE.');

  // 3. Assign FL-20261104-7460 delivery to Demo Rider with fresh 15-minute offer window
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query(
    "UPDATE deliveries SET rider_id = 'f206d273-2629-413a-8cc9-4531cc7bb3a1', status = 'assigned', offer_expires_at = $1 WHERE id = '4652dd14-31b9-455a-b595-ddc5191a8e2a'",
    [expiresAt],
  );

  // 4. Update or insert assignment attempt
  await pool.query(
    "UPDATE delivery_assignment_attempts SET rider_id = 'f206d273-2629-413a-8cc9-4531cc7bb3a1', status = 'offered', expires_at = $1 WHERE delivery_id = '4652dd14-31b9-455a-b595-ddc5191a8e2a'",
    [expiresAt],
  );

  console.log('Order FL-20261104-7460 is now OFFERED to Demo Rider until:', expiresAt.toISOString());
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

