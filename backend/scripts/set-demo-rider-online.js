const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const riderId = 'f206d273-2629-413a-8cc9-4531cc7bb3a1'; // Demo Rider (+911234567890)
  
  // Set all other riders offline
  await pool.query("UPDATE riders SET is_online = false, availability_status = 'offline' WHERE id != $1", [riderId]);

  // Set Demo Rider online and available
  await pool.query(
    "UPDATE riders SET is_online = true, availability_status = 'available', current_active_orders_count = 0 WHERE id = $1",
    [riderId]
  );

  // Clear any hung active deliveries for Demo Rider
  await pool.query(
    "UPDATE deliveries SET status = 'completed' WHERE rider_id = $1 AND status NOT IN ('completed', 'cancelled')",
    [riderId]
  );

  // Upsert fresh GPS location near Knowledge Park III (28.4744, 77.5040)
  await pool.query(
    `INSERT INTO rider_locations (rider_id, latitude, longitude, accuracy, updated_at) 
     VALUES ($1, 28.4744, 77.5040, 5, NOW())
     ON CONFLICT (rider_id) DO UPDATE 
     SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy = EXCLUDED.accuracy, updated_at = NOW()`,
    [riderId]
  );

  console.log('✅ Demo Rider (+911234567890) is now ONLINE, AVAILABLE, and at location (28.4744, 77.5040). Ready for live orders!');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
