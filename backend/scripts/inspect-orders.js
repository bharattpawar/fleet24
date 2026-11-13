require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function checkOrders() {
  const res = await pool.query("SELECT id, order_number, status, created_at FROM orders WHERE order_number IN ('FL-20261104-4846', 'FL-20261104-7460')");
  console.log('Orders:', res.rows);
  const deliv = await pool.query("SELECT d.id, d.order_id, d.rider_id, d.status, d.dispatch_failure_reason, o.order_number FROM deliveries d JOIN orders o ON d.order_id = o.id WHERE o.order_number IN ('FL-20261104-4846', 'FL-20261104-7460')");
  console.log('Deliveries:', deliv.rows);
  await pool.end();
}
checkOrders();
