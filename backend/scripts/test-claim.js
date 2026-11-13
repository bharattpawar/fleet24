async function testClaim() {
  try {
    // 1. Request & Verify OTP
    await fetch('http://localhost:4000/api/v1/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+911234567890' }),
    });

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
    console.log('Rider authenticated.');

    // 2. Claim order FL-20261105-2862
    const claimRes = await fetch('http://localhost:4000/api/v1/riders/orders/389dc104-2993-4dbc-86af-a66fe5eaf5b3/claim', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    const claimData = await claimRes.json();
    console.log('Claim Result:', claimData);

    // 3. Verify Active Orders now returns this delivery
    const activeRes = await fetch('http://localhost:4000/api/v1/riders/orders/active', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activeData = await activeRes.json();
    console.log('Active Orders for Rider:', JSON.stringify(activeData.data || activeData, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testClaim();

