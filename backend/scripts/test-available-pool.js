async function testAvailableOrders() {
  try {
    // 1. Request OTP
    await fetch('http://localhost:4000/api/v1/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+911234567890' }),
    });

    // 2. Verify OTP with dev bypass 123456
    const authRes = await fetch('http://localhost:4000/api/v1/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+911234567890',
        otp: '123456',
      }),
    });

    const authData = await authRes.json();
    const token = authData.data?.tokens?.accessToken || authData.tokens?.accessToken;
    if (!token) {
      console.error('Failed to get token:', authData);
      return;
    }
    console.log('Rider authenticated. Token acquired.');

    // 3. Fetch available orders pool
    const poolRes = await fetch('http://localhost:4000/api/v1/riders/orders/available', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const poolJson = await poolRes.json();
    const pool = poolJson.data || poolJson;
    console.log(`Available orders count: ${pool.length}`);
    console.log('Available orders:');
    for (const o of pool) {
      console.log(`- #${o.orderNumber} (${o.orderStatus}) | ${o.outlet?.name} | Dist: ${o.distanceKm} km | Earning: ₹${o.estimatedEarnings} | Bill: ₹${o.totalPayable}`);
    }
  } catch (err) {
    console.error('Error testing available orders:', err.message);
  }
}

testAvailableOrders();
