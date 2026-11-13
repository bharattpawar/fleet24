const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const customers = await pool.query(
    "SELECT u.id, u.phone, u.email, u.full_name, ur.role FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE ur.role = 'customer' LIMIT 3",
  );
  console.log('CUSTOMERS:', customers.rows);

  const outlets = await pool.query(
    'SELECT id, restaurant_id, name, latitude, longitude, address, phone, is_active, is_accepting_orders FROM restaurant_outlets LIMIT 3',
  );
  console.log('OUTLETS:', outlets.rows);

  const staff = await pool.query(
    'SELECT s.id, s.outlet_id, s.designation, u.phone, u.full_name FROM restaurant_staff s JOIN users u ON s.user_id = u.id LIMIT 3',
  );
  console.log('STAFF:', staff.rows);

  const riders = await pool.query(
    'SELECT r.id, r.user_id, r.verification_status, r.availability_status, r.is_online, r.current_active_orders_count, u.phone, u.full_name FROM riders r JOIN users u ON r.user_id = u.id',
  );
  console.log('RIDERS:', riders.rows);

  const items = await pool.query(
    'SELECT id, outlet_id, name, price, is_available FROM menu_items LIMIT 3',
  );
  console.log('MENU_ITEMS:', items.rows);

  const addresses = await pool.query(
    'SELECT id, user_id, label, address_line1, city, latitude, longitude FROM customer_addresses LIMIT 3',
  );
  console.log('ADDRESSES:', addresses.rows);

  await pool.end();
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
