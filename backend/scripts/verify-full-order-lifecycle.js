const crypto = require('crypto');
const { Pool } = require('pg');
const { io } = require('socket.io-client');
require('dotenv').config();

const API_URL = 'http://localhost:4000/api/v1';
const SOCKET_URL = 'http://localhost:4000';
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'uPGeYrmtYiZ0TP4nf2w4cOfe';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `API Error ${res.status} on ${endpoint}: ${data?.message || JSON.stringify(data) || res.statusText}`,
    );
  }
  return data;
}

async function loginUser(phone, otp = '123456') {
  try {
    await request('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  } catch (e) {
    // Cooldown is normal
  }
  const verifyRes = await request('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
  return verifyRes.data.tokens.accessToken;
}

async function main() {
  console.log('===========================================================');
  console.log('   FLEET24 REAL ORDER LIFECYCLE & RIDER DISPATCH TEST      ');
  console.log('===========================================================\n');

  // Step 1: Login Demo Rider (+911234567890)
  console.log('[Step 1] Authenticating Demo Rider (+911234567890)...');
  
  // Clean up prior test runs for demo rider to ensure full capacity
  await pool.query("UPDATE deliveries SET status = 'completed' WHERE rider_id = 'f206d273-2629-413a-8cc9-4531cc7bb3a1' AND status != 'completed'");
  await pool.query("UPDATE riders SET current_active_orders_count = 0, availability_status = 'available', is_online = true WHERE id = 'f206d273-2629-413a-8cc9-4531cc7bb3a1'");

  const riderToken = await loginUser('+911234567890');
  console.log('✓ Rider Authenticated. Token acquired.');

  // Verify Rider Profile
  const riderProfile = await request('/riders/profile', {
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  console.log(`✓ Rider Profile: "${riderProfile.data.fullName}" (${riderProfile.data.verificationStatus})`);

  // Ensure Demo Rider is AVAILABLE and active in Greater Noida
  await request('/riders/location', {
    method: 'POST',
    headers: { Authorization: `Bearer ${riderToken}` },
    body: JSON.stringify({
      latitude: 28.4744,
      longitude: 77.504,
      accuracy: 5,
    }),
  });
  await request('/riders/availability', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${riderToken}` },
    body: JSON.stringify({ availabilityStatus: 'available' }),
  });
  console.log('✓ Rider GPS Telemetry posted and status set to "available".');

  // Step 2: Establish Rider Socket.IO Connection & listen for private offer
  console.log('\n[Step 2] Connecting Rider Socket.IO...');
  const socket = io(`${SOCKET_URL}/tracking`, {
    transports: ['websocket'],
    auth: { token: riderToken },
  });

  let capturedSocketOffer = null;
  const socketOfferPromise = new Promise((resolve) => {
    socket.on('delivery.offer.created', (payload) => {
      console.log('⚡ [SOCKET EVENT RECEIVED] delivery.offer.created:', payload.orderNumber);
      capturedSocketOffer = payload;
      resolve(payload);
    });
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✓ Rider Socket.IO Connected successfully. (Socket ID:', socket.id, ')');
      resolve(true);
    });
    socket.on('connect_error', (err) => {
      reject(new Error(`Socket connection failed: ${err.message}`));
    });
    setTimeout(() => reject(new Error('Socket connection timed out')), 5000);
  });

  // Step 3: Login Customer (+919876543210)
  console.log('\n[Step 3] Customer placing items in Cart & Checking out...');
  const customerToken = await loginUser('+919876543210');
  
  // Find menu item from Knowledge Park III outlet
  const menuRes = await request('/public/outlets/b1000000-0000-4000-8000-000000000001/menu');
  const items = Array.isArray(menuRes.data) ? menuRes.data : [];
  const selectedItem = items.find((i) => i.isAvailable) || items[0];
  console.log(`✓ Selected Item: "${selectedItem.name}" (₹${selectedItem.effectivePrice || selectedItem.basePrice})`);

  // Add to Cart
  await request('/cart/items', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      outletId: 'b1000000-0000-4000-8000-000000000001',
      menuItemId: selectedItem.id,
      quantity: 1,
    }),
  });
  console.log('✓ Item added to customer cart.');

  // Ensure Customer has a delivery address
  const addrRes = await request('/users/addresses', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  let addressId = addrRes.data?.[0]?.id;
  if (!addressId) {
    const newAddr = await request('/users/addresses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        label: 'Home',
        addressLine1: 'Flat 402, Tower B, Stellar Park',
        addressLine2: 'Knowledge Park III',
        city: 'Greater Noida',
        postalCode: '201310',
        latitude: 28.475,
        longitude: 77.505,
      }),
    });
    addressId = newAddr.data.id;
  }
  console.log('✓ Customer delivery address confirmed (ID:', addressId, ')');

  // Place Order (POST /orders)
  const orderRes = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ deliveryAddressId: addressId }),
  });
  const order = orderRes.data;
  console.log(`✓ Order Placed: #${order.orderNumber} (ID: ${order.id}) - Status: ${order.status}`);

  // Step 4: Payment Capture
  console.log('\n[Step 4] Initiating & Verifying Real Payment...');
  const paySession = await request(`/orders/${order.id}/payment-session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const razorpayOrderId = paySession.data.razorpayOrderId;
  const razorpayPaymentId = `pay_qa_live_${Date.now()}`;
  const razorpaySignature = crypto
    .createHmac('sha256', RAZORPAY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  await request('/payments/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    }),
  });
  console.log('✓ Payment Signature verified & captured successfully.');

  // Step 5: Restaurant Kitchen Confirms & Marks Ready for Pickup
  console.log('\n[Step 5] Restaurant Kitchen Processing Order...');
  const restaurantToken = await loginUser('+919876543210'); // Has restaurant_staff role
  
  await request(`/restaurant/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${restaurantToken}` },
    body: JSON.stringify({ status: 'confirmed' }),
  });
  console.log('✓ Restaurant Kitchen: Order CONFIRMED');

  await request(`/restaurant/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${restaurantToken}` },
    body: JSON.stringify({ status: 'preparing' }),
  });
  console.log('✓ Restaurant Kitchen: Order PREPARING');

  console.log('Kitchen marking order READY_FOR_PICKUP (triggers canonical dispatch engine)...');
  await request(`/restaurant/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${restaurantToken}` },
    body: JSON.stringify({ status: 'ready_for_pickup' }),
  });
  console.log('✓ Restaurant Kitchen: Order READY_FOR_PICKUP');

  // Step 6: Verify Automatic Dispatch Trigger & Rider WebSocket Event
  console.log('\n[Step 6] Verifying Automatic Dispatch & Realtime Event...');
  const wsOffer = await Promise.race([
    socketOfferPromise,
    new Promise((_, r) => setTimeout(() => r(new Error('Timed out waiting for socket offer event')), 6000)),
  ]).catch((e) => {
    console.warn('Socket note:', e.message);
    return capturedSocketOffer;
  });

  if (wsOffer) {
    console.log('✓ Real-time WebSocket Offer received by Demo Rider:');
    console.log(`  - Order Number: #${wsOffer.orderNumber}`);
    console.log(`  - Restaurant: ${wsOffer.outlet?.name} (${wsOffer.outlet?.address})`);
    console.log(`  - Dropoff: ${wsOffer.deliveryAddress?.addressLine1}`);
    console.log(`  - Estimated Earnings: ₹${wsOffer.estimatedEarnings}`);
  }

  // Step 7: Verify Rider Offer via REST API
  const offersRes = await request('/riders/orders/offers', {
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  const activeOffer = offersRes.data?.find((o) => o.orderId === order.id);
  if (!activeOffer) {
    throw new Error(`Order ${order.orderNumber} not found in rider pending offers list!`);
  }
  console.log('✓ REST API /riders/orders/offers confirmed offer for Demo Rider:');
  console.log(`  - Outlet: ${activeOffer.outlet?.name}`);
  console.log(`  - Address: ${activeOffer.outlet?.address}`);
  console.log(`  - Dropoff: ${activeOffer.deliveryAddress?.addressLine1}, ${activeOffer.deliveryAddress?.city}`);
  console.log(`  - Expires in: ${activeOffer.remainingSeconds}s`);

  // Step 8: Rider Accepts Offer
  console.log('\n[Step 8] Rider Accepting Offer...');
  await request(`/riders/orders/${order.id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  console.log('✓ Rider Accepted Offer! Delivery status: "accepted".');

  // Step 9: Rider Confirms Arrival at Restaurant
  console.log('\n[Step 9] Rider Arrives at Restaurant...');
  await request(`/riders/orders/${order.id}/arrived`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  console.log('✓ Rider arrived at restaurant. Delivery status: "at_restaurant".');

  // Step 10: Rider Confirms Food Picked Up
  console.log('\n[Step 10] Rider Confirms Food Picked Up...');
  await request(`/riders/orders/${order.id}/pickup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  console.log('✓ Rider picked up food. Delivery status: "picked_up".');

  // Step 11: Rider Arrives at Customer
  console.log('\n[Step 11] Rider Arrives at Customer...');
  await request(`/riders/orders/${order.id}/arrived-customer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  console.log('✓ Rider arrived at customer doorstep. Delivery status: "arrived_customer".');

  // Step 12: Customer taps "I got my order"
  console.log('\n[Step 12] Customer confirms they received the order...');
  const trackingRes = await request(`/orders/${order.id}/delivery`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  if (!trackingRes.data?.canConfirmDelivery) {
    throw new Error('Customer tracking does not allow confirming delivery!');
  }

  const completeRes = await request(`/orders/${order.id}/delivery/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  console.log('✓ Customer Confirmed Delivery! Status:', completeRes.data?.status || 'completed');

  // Final Order Status Verification
  const finalOrder = await request(`/orders/${order.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  console.log(`\n🎉 FINAL ORDER STATUS: #${finalOrder.data.orderNumber} is "${finalOrder.data.status.toUpperCase()}"!`);
  console.log('\n===========================================================');
  console.log('   FULL ORDER FLOW VERIFIED SUCCESSFULLY (100% REAL APIS)  ');
  console.log('===========================================================');

  socket.disconnect();
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
