const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query(`
    SELECT 
      d.id, d.order_id, d.rider_id, d.status, d.offer_expires_at, 
      NOW() as now,
      o.order_number, o.status as order_status,
      r.user_id, r.full_name, r.availability_status
    FROM deliveries d
    LEFT JOIN orders o ON o.id = d.order_id
    LEFT JOIN riders r ON r.id = d.rider_id
    ORDER BY d.created_at DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

run().catch(console.error);

