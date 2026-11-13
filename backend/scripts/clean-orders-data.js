const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanOrdersData() {
  const client = await pool.connect();
  try {
    console.log('--- STARTING ORDERS DATA CLEANUP ---');

    await client.query('BEGIN');

    // 1. Delete dependent delivery attempts & deliveries
    const delAttempts = await client.query('DELETE FROM delivery_assignment_attempts');
    console.log(`Deleted ${delAttempts.rowCount} delivery assignment attempts`);

    const delDeliveries = await client.query('DELETE FROM deliveries');
    console.log(`Deleted ${delDeliveries.rowCount} deliveries`);

    // 2. Delete refunds & payments
    const delRefunds = await client.query('DELETE FROM refunds');
    console.log(`Deleted ${delRefunds.rowCount} refunds`);

    const delPayments = await client.query('DELETE FROM payments');
    console.log(`Deleted ${delPayments.rowCount} payments`);

    // 3. Delete financial ledger records linked to orders
    const delLedger = await client.query('DELETE FROM financial_ledger');
    console.log(`Deleted ${delLedger.rowCount} financial ledger entries`);

    // 4. Delete promotion redemptions
    const delPromos = await client.query('DELETE FROM promotion_redemptions');
    console.log(`Deleted ${delPromos.rowCount} promotion redemptions`);

    // 5. Delete order items & status history
    const delItems = await client.query('DELETE FROM order_items');
    console.log(`Deleted ${delItems.rowCount} order items`);

    const delHistory = await client.query('DELETE FROM order_status_history');
    console.log(`Deleted ${delHistory.rowCount} order status history entries`);

    // 6. Delete all orders
    const delOrders = await client.query('DELETE FROM orders');
    console.log(`Deleted ${delOrders.rowCount} orders`);

    // 7. Clear cart items
    const delCart = await client.query('DELETE FROM cart_items');
    console.log(`Deleted ${delCart.rowCount} cart items`);

    // 8. Reset all approved riders to 0 active orders and available status
    const resetRiders = await client.query(`
      UPDATE riders
      SET current_active_orders_count = 0,
          availability_status = 'available'
      WHERE verification_status = 'approved'
    `);
    console.log(`Reset ${resetRiders.rowCount} approved riders to 0 active orders & 'available'`);

    await client.query('COMMIT');
    console.log('--- ALL RESTAURANT ORDER DATA CLEANED SUCCESSFULLY ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cleaning orders data:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanOrdersData();

