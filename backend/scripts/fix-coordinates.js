const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixCoordinates() {
  try {
    const res1 = await pool.query(`
      UPDATE customer_addresses
      SET latitude = '28.4855000', longitude = '77.5135000'
      WHERE latitude = '28.4744000' AND longitude = '77.5040000'
    `);
    console.log(`Updated customer_addresses: ${res1.rowCount}`);

    const res2 = await pool.query(`
      UPDATE orders
      SET delivery_latitude = '28.4855000', delivery_longitude = '77.5135000'
      WHERE delivery_latitude = '28.4744000' AND delivery_longitude = '77.5040000'
    `);
    console.log(`Updated orders: ${res2.rowCount}`);

    const res3 = await pool.query(`
      UPDATE deliveries
      SET distance_meters = '1800.00'
      WHERE distance_meters = '0.00' OR distance_meters IS NULL
    `);
    console.log(`Updated deliveries: ${res3.rowCount}`);

    // Verify
    const verify = await pool.query(`
      SELECT o.order_number, o.delivery_latitude, o.delivery_longitude, d.distance_meters
      FROM orders o
      LEFT JOIN deliveries d ON d.order_id = o.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    console.table(verify.rows);
  } catch (err) {
    console.error('Error fixing coordinates:', err.message);
  } finally {
    await pool.end();
  }
}

fixCoordinates();

