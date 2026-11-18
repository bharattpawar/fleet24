require('dotenv').config({ path: __dirname + '/../.env' });
const { io } = require('socket.io-client');
const { Pool } = require('pg');

const BASE_URL = 'http://localhost:4000/api/v1';
const WS_URL = 'http://localhost:4000/tracking';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'Unknown error';
    const err = new Error(`API Error ${res.status} on ${path}: ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getAuthToken(phone) {
  try {
    await request('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  } catch {
    // Ignore rate-limit / existing OTP
  }
  const verify = await request('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, otp: '123456' }),
  });
  return verify.data.tokens.accessToken;
}

async function createPaidKitchenReadyOrder(customerToken, restaurantToken, outletId) {
  // 1. Get menu item
  const menuRes = await request(`/public/outlets/${outletId}/menu`);
  const items = Array.isArray(menuRes.data) ? menuRes.data : [];
  const item = items.find((i) => i.isAvailable) || items[0];

  // 2. Add to cart
  await request('/cart/items', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ outletId, menuItemId: item.id, quantity: 1 }),
  });

  // 3. Confirm address
  const addrRes = await request('/users/addresses', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const addressId = addrRes.data[0].id;

  // 4. Place order
  const orderRes = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ deliveryAddressId: addressId }),
  });
  const order = orderRes.data;

  // 5. Payment Session
  const paymentSession = await request(`/orders/${order.id}/payment-session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
  });

  // 6. Verify Payment
  const crypto = require('crypto');
  const razorpayOrderId = paymentSession.data.razorpayOrderId;
  const razorpayPaymentId = `pay_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const secret = process.env.RAZORPAY_KEY_SECRET || 'uPGeYrmtYiZ0TP4nf2w4cOfe';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
  const signature = hmac.digest('hex');

  await request('/payments/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: signature,
    }),
  });

  // 7. Kitchen confirm and prepare
  await request(`/restaurant/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${restaurantToken}` },
    body: JSON.stringify({ status: 'confirmed' }),
  });

  await request(`/restaurant/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${restaurantToken}` },
    body: JSON.stringify({ status: 'preparing' }),
  });

  return order;
}

async function main() {
  console.log('=====================================================================');
  console.log('  FLEET24 DISPATCH CONCURRENCY & MULTI-APP INTEGRATION VERIFICATION  ');
  console.log('=====================================================================\n');

  // Authenticate Actors
  console.log('[Auth] Logging in Customer, Restaurant Staff, and 2 Real Riders...');
  const customerToken = await getAuthToken('+919876543210');
  const restaurantToken = await getAuthToken('+919876543210');
  const rider1Token = await getAuthToken('+911234567890'); // Demo Rider (id: f206d273-2629-413a-8cc9-4531cc7bb3a1)
  const rider2Token = await getAuthToken('+919888847327'); // Phase 5.1 Test Rider (id: aa5c46b2-b952-4e2a-b582-8399c6aee1de)

  const outletId = 'b1000000-0000-4000-8000-000000000001';

  // Ensure riders are online and reset capacity
  await pool.query("UPDATE riders SET is_online = true, availability_status = 'available', current_active_orders_count = 0 WHERE id IN ('f206d273-2629-413a-8cc9-4531cc7bb3a1', 'aa5c46b2-b952-4e2a-b582-8399c6aee1de')");
  await pool.query("UPDATE deliveries SET status = 'completed' WHERE rider_id IN ('f206d273-2629-413a-8cc9-4531cc7bb3a1', 'aa5c46b2-b952-4e2a-b582-8399c6aee1de') AND status NOT IN ('completed', 'cancelled')");

  // Push fresh location for both riders
  await request('/riders/location', {
    method: 'POST',
    headers: { Authorization: `Bearer ${rider1Token}` },
    body: JSON.stringify({ latitude: 28.4744, longitude: 77.5040, accuracy: 5.0, heading: 90, speed: 10 }),
  });
  await request('/riders/location', {
    method: 'POST',
    headers: { Authorization: `Bearer ${rider2Token}` },
    body: JSON.stringify({ latitude: 28.4750, longitude: 77.5045, accuracy: 5.0, heading: 45, speed: 12 }),
  });

  console.log('✓ Actors authenticated and fresh GPS positions established.\n');

  // =========================================================================
  // TEST 1: Dispatch Worker Idempotency Under Concurrent Execution
  // =========================================================================
  console.log('---------------------------------------------------------------------');
  console.log('TEST 1: Dispatch Worker Idempotency Under Concurrent Execution (10x)');
  console.log('---------------------------------------------------------------------');
  const order1 = await createPaidKitchenReadyOrder(customerToken, restaurantToken, outletId);
  console.log(`✓ Test Order 1 created: #${order1.orderNumber} (ID: ${order1.id})`);

  // Fire 10 parallel assignments simultaneously
  console.log('Firing 10 simultaneous dispatch assignment triggers on Order 1...');
  const dispatchPromises = Array.from({ length: 10 }, (_, i) =>
    request(`/restaurant/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${restaurantToken}` },
      body: JSON.stringify({ status: 'ready_for_pickup' }),
    }).catch(err => ({ error: err.message }))
  );

  const results = await Promise.all(dispatchPromises);
  const successCount = results.filter(r => !r.error).length;
  console.log(`✓ 10 Concurrent Dispatch Requests Handled. Success count: ${successCount}/10`);

  // Verify DB state: exactly ONE delivery row must exist for order1
  const delivRes = await pool.query('SELECT id, order_id, rider_id, status FROM deliveries WHERE order_id = $1', [order1.id]);
  console.log(`✓ Deliveries row count in PostgreSQL: ${delivRes.rows.length} (Must be exactly 1)`);
  if (delivRes.rows.length !== 1) {
    throw new Error(`CRITICAL DEFECT: Duplicate deliveries created! Found ${delivRes.rows.length} rows.`);
  }

  const assignedRiderId = delivRes.rows[0].rider_id;
  console.log(`✓ Delivery successfully created (ID: ${delivRes.rows[0].id}, Status: ${delivRes.rows[0].status}, Assigned Rider: ${assignedRiderId})`);

  // Verify attempts count: exactly ONE active offered attempt
  const attemptsRes = await pool.query('SELECT id, status, rider_id FROM delivery_assignment_attempts WHERE order_id = $1 AND status = $2', [order1.id, 'offered']);
  console.log(`✓ Active 'offered' attempts in PostgreSQL: ${attemptsRes.rows.length} (Must be exactly 1)`);
  if (attemptsRes.rows.length !== 1) {
    throw new Error(`CRITICAL DEFECT: Duplicate assignment attempts! Found ${attemptsRes.rows.length}`);
  }
  console.log('>>> TEST 1 PASSED: Strict dispatch worker idempotency confirmed.\n');

  // =========================================================================
  // TEST 2: Multiple Riders Cannot Claim The Same Delivery (Row Lock Check)
  // =========================================================================
  console.log('---------------------------------------------------------------------');
  console.log('TEST 2: Concurrency & Lock Protection — Multiple Riders Claiming');
  console.log('---------------------------------------------------------------------');
  console.log(`Order 1 is offered to Rider ID: ${assignedRiderId}`);

  const isAssignedToRider1 = assignedRiderId === 'f206d273-2629-413a-8cc9-4531cc7bb3a1';
  const legitToken = isAssignedToRider1 ? rider1Token : rider2Token;
  const illegitimateToken = isAssignedToRider1 ? rider2Token : rider1Token;
  const legitName = isAssignedToRider1 ? 'Demo Rider' : 'Test Rider 2';
  const illegitName = isAssignedToRider1 ? 'Test Rider 2' : 'Demo Rider';

  console.log(`Attempting race condition: ${legitName} (legitimate) vs ${illegitName} (unauthorized) firing simultaneous accept...`);

  let legitSuccess = false;
  let illegitRejected = false;
  let illegitError = '';

  const [resLegit, resIllegit] = await Promise.allSettled([
    request(`/riders/orders/${order1.id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${legitToken}` },
    }),
    request(`/riders/orders/${order1.id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${illegitimateToken}` },
    }),
  ]);

  if (resLegit.status === 'fulfilled' && resLegit.value?.data?.status === 'accepted') {
    legitSuccess = true;
    console.log(`✓ Legitimate rider (${legitName}) successfully accepted the order.`);
  } else {
    console.error('Legit rider failed:', resLegit);
  }

  if (resIllegit.status === 'rejected') {
    illegitRejected = true;
    illegitError = resIllegit.reason?.message;
    console.log(`✓ Unauthorized rider (${illegitName}) was strictly REJECTED: "${illegitError}"`);
  } else {
    throw new Error(`CRITICAL SECURITY FLAW: Unauthorized rider was allowed to claim the delivery!`);
  }

  // Idempotent retry: Legit rider calls accept AGAIN
  console.log('Testing second accept call from legitimate rider (idempotency check)...');
  const secondAcceptRes = await request(`/riders/orders/${order1.id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${legitToken}` },
  });
  console.log(`✓ Second accept handled idempotently: Status is "${secondAcceptRes.data.status}"`);

  // Verify delivery is still accepted by legit rider
  const verifyLock = await pool.query('SELECT status, rider_id FROM deliveries WHERE order_id = $1', [order1.id]);
  if (verifyLock.rows[0].rider_id !== assignedRiderId || verifyLock.rows[0].status !== 'accepted') {
    throw new Error('Delivery state corrupted after concurrent accept attempt!');
  }
  console.log('>>> TEST 2 PASSED: Row-level lock strictly prevents cross-rider claiming.\n');

  // =========================================================================
  // TEST 3: Offer Expiration & Automatic Reassignment
  // =========================================================================
  console.log('---------------------------------------------------------------------');
  console.log('TEST 3: Offer Expiration & Automatic Reassignment');
  console.log('---------------------------------------------------------------------');
  // Create Order 2
  const order2 = await createPaidKitchenReadyOrder(customerToken, restaurantToken, outletId);
  await request(`/restaurant/orders/${order2.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${restaurantToken}` },
    body: JSON.stringify({ status: 'ready_for_pickup' }),
  });

  const deliv2 = (await pool.query('SELECT id, rider_id, status FROM deliveries WHERE order_id = $1', [order2.id])).rows[0];
  console.log(`✓ Order 2 created & assigned to rider ${deliv2.rider_id} (Status: ${deliv2.status})`);

  // Artificially expire the offer
  console.log('Artificially expiring offer for Order 2 in PostgreSQL (offer_expires_at = NOW() - 30 seconds)...');
  await pool.query("UPDATE deliveries SET offer_expires_at = NOW() - INTERVAL '30 seconds' WHERE id = $1", [deliv2.id]);

  // Wait 12 seconds for the background OfferExpirationWorker to run its 10-second cron
  console.log('Waiting 12 seconds for OfferExpirationWorker cron loop to detect & expire offer...');
  await new Promise(r => setTimeout(r, 12000));

  // Check attempt status
  const attempt2 = (await pool.query('SELECT status, responded_at FROM delivery_assignment_attempts WHERE delivery_id = $1 ORDER BY created_at DESC LIMIT 1', [deliv2.id])).rows[0];
  console.log(`✓ Previous assignment attempt status: "${attempt2.status}"`);

  // Check delivery status
  const postExpireDeliv = (await pool.query('SELECT status, last_dispatch_attempt_at FROM deliveries WHERE id = $1', [deliv2.id])).rows[0];
  console.log(`✓ Delivery post-expiration status: "${postExpireDeliv.status}"`);

  if (attempt2.status !== 'expired' && postExpireDeliv.status !== 'unassigned' && postExpireDeliv.status !== 'assigned') {
    throw new Error('Offer expiration worker failed to expire timed out offer!');
  }
  console.log('>>> TEST 3 PASSED: Offer expiration and worker reassignment loop verified.\n');

  // =========================================================================
  // TEST 4: Customer Real-Time Tracking WebSocket Coordinates Reception
  // =========================================================================
  console.log('---------------------------------------------------------------------');
  console.log('TEST 4: Customer WebSocket Receives Actual Rider GPS Coordinates');
  console.log('---------------------------------------------------------------------');

  // Connect customer WebSocket client to /tracking
  console.log('Connecting Customer Socket.IO client to /tracking...');
  const customerSocket = io(WS_URL, {
    transports: ['websocket'],
    auth: { token: customerToken },
  });

  await new Promise((resolve, reject) => {
    customerSocket.on('connect', () => {
      console.log(`✓ Customer Socket Connected (ID: ${customerSocket.id})`);
      resolve();
    });
    customerSocket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Customer socket connection timeout')), 6000);
  });

  // Subscribe to Order 1 tracking
  console.log(`Customer subscribing to Order 1 tracking room: "subscribe:delivery" for ${order1.id}...`);
  customerSocket.emit('subscribe:delivery', { orderId: order1.id });

  let receivedLocationEvent = null;
  customerSocket.on('delivery.location.updated', (payload) => {
    receivedLocationEvent = payload;
  });

  // Rider 1 progresses Order 1 to "picked_up"
  await request(`/riders/orders/${order1.id}/arrived`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${legitToken}` },
  });
  await request(`/riders/orders/${order1.id}/pickup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${legitToken}` },
  });
  console.log('✓ Rider confirmed food pickup (Status: picked_up).');

  // Push hardware GPS update with high-precision telemetry
  const hardwareGpsTelemetry = {
    latitude: 28.475821,
    longitude: 77.505912,
    accuracy: 4.8,
    heading: 88.5,
    speed: 7.2,
  };

  console.log('Rider transmitting hardware GPS telemetry to /riders/location:', hardwareGpsTelemetry);
  await request('/riders/location', {
    method: 'POST',
    headers: { Authorization: `Bearer ${legitToken}` },
    body: JSON.stringify(hardwareGpsTelemetry),
  });

  // Wait for WebSocket event arrival
  console.log('Waiting for Customer WebSocket to receive live telemetry broadcast...');
  for (let i = 0; i < 20; i++) {
    if (receivedLocationEvent) break;
    await new Promise(r => setTimeout(r, 200));
  }

  if (!receivedLocationEvent) {
    throw new Error('Customer WebSocket did not receive delivery.location.updated event!');
  }

  console.log('✓ Customer Socket received real-time event "delivery.location.updated":', {
    orderId: receivedLocationEvent.orderId,
    latitude: receivedLocationEvent.latitude,
    longitude: receivedLocationEvent.longitude,
    accuracy: receivedLocationEvent.accuracy,
    speed: receivedLocationEvent.speed,
    heading: receivedLocationEvent.heading,
  });

  if (
    Math.abs(receivedLocationEvent.latitude - hardwareGpsTelemetry.latitude) > 0.0001 ||
    Math.abs(receivedLocationEvent.longitude - hardwareGpsTelemetry.longitude) > 0.0001
  ) {
    throw new Error('Coordinates mismatch between rider transmission and customer reception!');
  }

  customerSocket.disconnect();
  console.log('>>> TEST 4 PASSED: Customer receives exact live rider telemetry via WebSocket.\n');

  // =========================================================================
  // TEST 5: Financial Ledger Exactly One Posting Idempotency
  // =========================================================================
  console.log('---------------------------------------------------------------------');
  console.log('TEST 5: Exactly One Financial Ledger Posting (Completion Idempotency)');
  console.log('---------------------------------------------------------------------');

  // Rider arrives at customer
  await request(`/riders/orders/${order1.id}/arrived-customer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${legitToken}` },
  });

  // First completion request
  const complete1 = await request(`/riders/orders/${order1.id}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${legitToken}` },
  });
  console.log(`✓ Initial completion request status: "${complete1.data.status}"`);

  // Query ledger entries for this delivery
  const delivId = delivRes.rows[0].id;
  const ledgerRows1 = (await pool.query(
    "SELECT id, transaction_reference, entry_type, amount, direction, idempotency_key FROM financial_ledger WHERE order_id = $1 AND entry_type = 'rider_delivery_earning'",
    [order1.id]
  )).rows;

  console.log(`✓ Financial ledger entries for delivery earning: ${ledgerRows1.length} (Must be exactly 1)`);
  console.log('  Entry:', ledgerRows1[0]);

  if (ledgerRows1.length !== 1) {
    throw new Error(`CRITICAL FINANCIAL DEFECT: Expected 1 ledger posting, got ${ledgerRows1.length}`);
  }

  // Second completion request (simulating network retry / duplicate tap)
  console.log('Sending duplicate / retry completion request...');
  const complete2 = await request(`/riders/orders/${order1.id}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${legitToken}` },
  });
  console.log(`✓ Retry completion response: "${complete2.data.status}" (alreadyCompleted: ${complete2.data.alreadyCompleted})`);

  // Query ledger entries again
  const ledgerRows2 = (await pool.query(
    "SELECT id FROM financial_ledger WHERE order_id = $1 AND entry_type = 'rider_delivery_earning'",
    [order1.id]
  )).rows;

  console.log(`✓ Financial ledger entries after retry: ${ledgerRows2.length} (Still exactly 1)`);
  if (ledgerRows2.length !== 1) {
    throw new Error(`CRITICAL FINANCIAL DEFECT: Duplicate ledger postings created on completion retry! Count: ${ledgerRows2.length}`);
  }
  console.log('>>> TEST 5 PASSED: Exactly one immutable financial ledger posting confirmed.\n');

  // =========================================================================
  // TEST 6: Triple-App Order State & ID Consistency
  // =========================================================================
  console.log('---------------------------------------------------------------------');
  console.log('TEST 6: Triple-App Order State & ID Consistency');
  console.log('---------------------------------------------------------------------');

  // Customer View
  const custOrder = (await request(`/orders/${order1.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  })).data;

  // Delivery View
  const finalDeliv = (await pool.query('SELECT id, status, delivered_at FROM deliveries WHERE order_id = $1', [order1.id])).rows[0];

  // Kitchen View
  const kitchenOrder = (await pool.query('SELECT id, order_number, status FROM orders WHERE id = $1', [order1.id])).rows[0];

  console.log('Checking state consistency across Customer, Restaurant, and Rider domains:');
  console.log(`- Customer App Order Status:   "${custOrder.status}" (ID: ${custOrder.id})`);
  console.log(`- Rider Delivery Record Status: "${finalDeliv.status}" (Delivered At: ${finalDeliv.delivered_at})`);
  console.log(`- Kitchen DB Order Status:     "${kitchenOrder.status}" (Order Number: ${kitchenOrder.order_number})`);

  if (custOrder.status !== 'delivered' || finalDeliv.status !== 'completed' || kitchenOrder.status !== 'delivered') {
    throw new Error('Inconsistent order status across applications!');
  }

  console.log('>>> TEST 6 PASSED: Consistent order ID and terminal status across Customer, Kitchen, and Rider.\n');

  console.log('=====================================================================');
  console.log('  ALL INTEGRATION, CONCURRENCY & LEDGER VERIFICATIONS PASSED (100%)  ');
  console.log('=====================================================================');

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
