import 'reflect-metadata';
import { PaymentsController } from './payments.controller';

describe('PaymentsController hosted checkout page', () => {
  const ATTACK = '"></script><script>alert(document.domain)</script>';

  function makeController(nodeEnv: string, orderStatus = 'pending_payment') {
    const paymentsService = {
      getOrderForCheckout: jest.fn().mockResolvedValue({
        order: { id: 'order-1', orderNumber: 'F24-1001', totalPayable: '249.00', status: orderStatus },
        payment: { providerOrderId: 'order_RZP_1' },
        keyId: 'rzp_test_key',
        amountInPaise: 24900,
      }),
    };
    const configService = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined)),
    };
    return new PaymentsController(paymentsService as any, {} as any, configService as any);
  }

  function makeRes() {
    const res: any = { headers: {} as Record<string, string> };
    res.setHeader = jest.fn((k: string, v: string) => {
      res.headers[k.toLowerCase()] = v;
    });
    res.status = jest.fn(() => res);
    res.type = jest.fn(() => res);
    res.send = jest.fn((body: string) => {
      res.body = body;
      return res;
    });
    res.redirect = jest.fn((code: number, url: string) => {
      res.redirectCode = code;
      res.redirectUrl = url;
    });
    return res;
  }

  it('never reflects an attacker-controlled returnUrl into the page', async () => {
    const controller = makeController('production');
    const res = makeRes();
    await controller.renderCheckout('order-1', { query: { returnUrl: ATTACK } } as any, res);

    expect(res.body).not.toContain('<script>alert');
    expect(res.body).not.toContain(ATTACK);
    expect(res.body).toContain('fleet24://payment-callback');
    expect(res.headers['content-security-policy']).toMatch(/script-src 'nonce-/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('keeps an allowed development return URL outside production', async () => {
    const controller = makeController('development');
    const res = makeRes();
    await controller.renderCheckout(
      'order-1',
      { query: { returnUrl: 'http://localhost:8081/payment-callback' } } as any,
      res,
    );
    expect(res.body).toContain('http://localhost:8081/payment-callback');
  });

  it('refuses to render for orders that are no longer awaiting payment', async () => {
    const controller = makeController('production', 'placed');
    const res = makeRes();
    await controller.renderCheckout('order-1', { query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).not.toContain('F24-1001');
  });

  it('redirect callback ignores non-allowlisted return URLs', async () => {
    const controller = makeController('production');
    const res = makeRes();
    await controller.redirectCallback(
      { body: { orderId: 'order-1', returnUrl: 'https://evil.example/steal', razorpay_signature: 'sig' } } as any,
      res,
    );
    expect(res.redirectCode).toBe(303);
    expect(res.redirectUrl.startsWith('fleet24://payment-callback?orderId=order-1')).toBe(true);
  });
});
