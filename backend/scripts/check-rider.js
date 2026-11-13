require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function check() {
  const res = await pool.query("SELECT id, order_id, rider_id, status FROM deliveries WHERE rider_id = 'f206d273-2629-413a-8cc9-4531cc7bb3a1' AND status NOT IN ('completed', 'cancelled')");
  console.log('Active deliveries count:', res.rows.length);
  console.log(res.rows);
  await pool.end();
}
check();
