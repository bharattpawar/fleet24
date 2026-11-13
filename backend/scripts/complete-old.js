require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function completeOld() {
  await pool.query("UPDATE deliveries SET status = 'completed', delivered_at = NOW() WHERE id = '7e381153-ee78-4803-97fd-8e0d85c21ddc'");
  await pool.query("UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = '9651f4e1-0369-4390-8ad2-02906604dd16'");
  await pool.query("UPDATE riders SET current_active_orders_count = 0 WHERE id = 'f206d273-2629-413a-8cc9-4531cc7bb3a1'");
  console.log('Successfully completed leftover delivery and reset active order count.');
  await pool.end();
}
completeOld();
