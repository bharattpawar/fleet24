const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupRiders() {
  try {
    const phones = ['+911234567890', '+919876543210', '+919888847327'];

    for (const phone of phones) {
      // 1. Ensure user exists
      let userRes = await pool.query("SELECT id, phone FROM users WHERE phone = $1", [phone]);
      let userId;
      if (userRes.rows.length === 0) {
        const uIns = await pool.query(`
          INSERT INTO users (phone, full_name, email, is_active)
          VALUES ($1, $2, $3, true)
          RETURNING id
        `, [phone, phone.includes('1234567890') ? 'Demo Rider' : 'Test Rider', `rider_${phone.replace(/\D/g,'')}@fleet24.app`]);
        userId = uIns.rows[0].id;
        console.log(`Created user ${phone}:`, userId);
      } else {
        userId = userRes.rows[0].id;
        console.log(`User ${phone} exists:`, userId);
      }

      // 2. Ensure rider role
      const roleCheck = await pool.query("SELECT * FROM user_roles WHERE user_id = $1 AND role = 'rider'", [userId]);
      if (roleCheck.rows.length === 0) {
        await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'rider')", [userId]);
        console.log(`Added rider role for ${phone}`);
      }

      // 3. Ensure rider profile
      let riderId;
      const riderCheck = await pool.query("SELECT id FROM riders WHERE user_id = $1", [userId]);
      if (riderCheck.rows.length === 0) {
        const rIns = await pool.query(`
          INSERT INTO riders (user_id, full_name, verification_status, availability_status, is_online, is_verified, vehicle_type, vehicle_number)
          VALUES ($1, $2, 'approved', 'available', true, true, 'motorcycle', 'UP-16-AB-1234')
          RETURNING id
        `, [userId, phone.includes('1234567890') ? 'Demo Rider' : 'Test Rider']);
        riderId = rIns.rows[0].id;
        console.log(`Created rider ${phone}:`, riderId);
      } else {
        riderId = riderCheck.rows[0].id;
        await pool.query(`
          UPDATE riders SET verification_status = 'approved', availability_status = 'available', is_online = true, is_verified = true, suspension_reason = NULL
          WHERE id = $1
        `, [riderId]);
        console.log(`Updated rider ${phone} to approved & available:`, riderId);
      }

      // 4. Ensure location near restaurant (28.4744, 77.5040)
      await pool.query(`
        INSERT INTO rider_locations (rider_id, latitude, longitude, accuracy, heading, speed, captured_at, updated_at)
        VALUES ($1, 28.4744000, 77.5040000, 5, 0, 0, NOW(), NOW())
        ON CONFLICT (rider_id) DO UPDATE SET
          latitude = 28.4744000,
          longitude = 77.5040000,
          accuracy = 5,
          captured_at = NOW(),
          updated_at = NOW()
      `, [riderId]);
      console.log(`Updated GPS for ${phone} to NOW()`);
    }

    pool.end();
  } catch(err) {
    console.error('Error in setupRiders:', err);
    pool.end();
  }
}

setupRiders();
