const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query(`
    SELECT o.id, o.order_number, o.status as order_status, o.total_payable, o.outlet_id, ro.name as outlet_name,
           d.id as delivery_id, d.rider_id, d.status as delivery_status, d.dispatch_failure_reason, d.offer_expires_at
    FROM orders o
    LEFT JOIN restaurant_outlets ro ON ro.id = o.outlet_id
    LEFT JOIN deliveries d ON d.order_id = o.id
    WHERE o.status IN ('confirmed', 'preparing', 'ready_for_pickup')
    ORDER BY o.created_at DESC
  `);
  console.log('Active non-delivered orders:', JSON.stringify(res.rows, null, 2));
  await pool.end();
}

run().catch(console.error);
