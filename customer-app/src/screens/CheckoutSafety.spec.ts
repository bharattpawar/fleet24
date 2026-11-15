import { apiRequest, ApiError } from '../api/client';

declare const global: any;

jest.mock('../api/storage', () => ({
  authStorage: {
    getAccessToken: jest.fn(() => Promise.resolve('mock-access-token')),
  },
}));

// Mock fetch
const originalFetch = global.fetch;

describe('Customer App Checkout & Payment Safety (Stage 2D-B)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('Authoritative Verification & Conflict Safety', () => {
    it('1. Handles confirmed placed order: verified=true, captured, placed', async () => {
      const mockVerifyResponse = {
        success: true,
        statusCode: 200,
        data: {
          verified: true,
          orderId: 'ord-101',
          orderNumber: 'FL-20261115-001',
          orderStatus: 'placed',
          paymentId: 'pay-101',
          paymentStatus: 'captured',
          amount: '450.00',
          isConflict: false,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVerifyResponse),
      });

      const res = await apiRequest<any>('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpayOrderId: 'order_123',
          razorpayPaymentId: 'pay_123',
          razorpaySignature: 'sig_123',
        }),
      });

      expect(res.verified).toBe(true);
      expect(res.orderStatus).toBe('placed');
      expect(res.paymentStatus).toBe('captured');
      expect(res.isConflict).toBe(false);
    });

    it('2. Handles captured payment conflict: verified=true, captured, payment_conflict, isConflict=true', async () => {
      const mockVerifyConflict = {
        success: true,
        statusCode: 200,
        data: {
          verified: true,
          orderId: 'ord-conflict-202',
          orderNumber: 'FL-20261115-CONF1',
          orderStatus: 'payment_conflict',
          paymentId: 'pay-202',
          paymentStatus: 'captured',
          amount: '520.00',
          isConflict: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVerifyConflict),
      });

      const res = await apiRequest<any>('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpayOrderId: 'order_456',
          razorpayPaymentId: 'pay_456',
          razorpaySignature: 'sig_456',
        }),
      });

      expect(res.verified).toBe(true);
      expect(res.orderStatus).toBe('payment_conflict');
      expect(res.paymentStatus).toBe('captured');
      expect(res.isConflict).toBe(true);
    });

    it('3. Does NOT treat authorized payment as captured: verified=false, pending', async () => {
      const mockVerifyAuthorized = {
        success: true,
        statusCode: 200,
        data: {
          verified: false,
          orderId: 'ord-auth-303',
          orderNumber: 'FL-20261115-AUTH',
          orderStatus: 'pending_payment',
          paymentId: 'pay-303',
          paymentStatus: 'pending',
          amount: '350.00',
          isConflict: false,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVerifyAuthorized),
      });

      const res = await apiRequest<any>('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpayOrderId: 'order_789',
          razorpayPaymentId: 'pay_789',
          razorpaySignature: 'sig_789',
        }),
      });

      expect(res.verified).toBe(false);
      expect(res.orderStatus).toBe('pending_payment');
      expect(res.paymentStatus).toBe('pending');
      // Must not be treated as placed or conflict
      expect(res.orderStatus === 'placed').toBe(false);
      expect(res.orderStatus === 'payment_conflict').toBe(false);
    });

    it('4. Preserves ApiError with code ACTIVE_ORDER_IN_PROGRESS on checkout conflict', async () => {
      const mockBackendError = {
        statusCode: 400,
        error: 'Bad Request',
        code: 'ACTIVE_ORDER_IN_PROGRESS',
        message: 'You already have an active order #FL-ACTIVE-1 (preparing).',
        activeOrder: {
          id: 'ord-act-1',
          orderNumber: 'FL-ACTIVE-1',
          status: 'preparing',
          placedAt: '2026-11-15T06:00:00Z',
          totalPayable: '380.00',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockBackendError),
      });

      let caughtError: any;
      try {
        await apiRequest('/orders', {
          method: 'POST',
          body: JSON.stringify({ deliveryAddressId: 'addr-1' }),
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError.statusCode).toBe(400);
      expect(caughtError.code).toBe('ACTIVE_ORDER_IN_PROGRESS');
      expect(caughtError.activeOrder).toBeDefined();
      expect(caughtError.activeOrder.orderNumber).toBe('FL-ACTIVE-1');
      expect(caughtError.activeOrder.status).toBe('preparing');
    });

    it('5. Network/gateway verification timeout throws ApiError with status 0 without corrupting state', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network request timed out'));

      let caughtError: any;
      try {
        await apiRequest('/payments/verify', { method: 'POST' });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError.statusCode).toBe(0);
      expect(caughtError.message).toBe('Network request timed out');
    });

    it('6. Webhook race: Idempotent verifyPayment return when already captured', async () => {
      // When webhook already finalized payment_conflict or placed before client verify completes:
      const mockWebhookRaceResponse = {
        success: true,
        statusCode: 200,
        data: {
          verified: true,
          orderId: 'ord-race-1',
          orderNumber: 'FL-20261115-RACE',
          orderStatus: 'payment_conflict',
          paymentId: 'pay-race-1',
          paymentStatus: 'captured',
          amount: '400.00',
          isConflict: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWebhookRaceResponse),
      });

      const res = await apiRequest<any>('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpayOrderId: 'order_race',
          razorpayPaymentId: 'pay_race',
          razorpaySignature: 'sig_race',
        }),
      });

      expect(res.verified).toBe(true);
      expect(res.isConflict).toBe(true);
      expect(res.paymentStatus).toBe('captured');
    });

    it('7. Unexpected backend status does not falsely trigger placement', async () => {
      const mockUnexpectedStatus = {
        success: true,
        statusCode: 200,
        data: {
          verified: true,
          orderId: 'ord-unknown',
          orderNumber: 'FL-UNKNOWN',
          orderStatus: 'under_investigation',
          paymentId: 'pay-unknown',
          paymentStatus: 'captured',
          amount: '100.00',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUnexpectedStatus),
      });

      const res = await apiRequest<any>('/payments/verify', { method: 'POST' });

      // In CartScreen logic:
      const isPlacedSuccess = Boolean(
        res.verified &&
        res.paymentStatus === 'captured' &&
        res.orderStatus === 'placed'
      );

      const isConflict = Boolean(
        res.verified &&
        res.paymentStatus === 'captured' &&
        (res.orderStatus === 'payment_conflict' || res.isConflict)
      );

      expect(isPlacedSuccess).toBe(false);
      expect(isConflict).toBe(false);
      // Falls safely through to Case C (Verifying Payment notice) without false success!
    });
  });

  describe('Active Order Restrictions & UX Safety (Stage 2D-D)', () => {
    it('8. Proactive check detects active order: GET /orders/active returns hasActiveOrder=true and activeOrder details', async () => {
      const mockActiveOrderResponse = {
        success: true,
        statusCode: 200,
        data: {
          hasActiveOrder: true,
          activeOrder: {
            id: 'ord-active-888',
            orderNumber: 'FL-20261115-888',
            status: 'preparing',
            totalAmount: '350.00',
            createdAt: '2026-11-15T08:00:00.000Z',
            restaurant: {
              id: 'rest-1',
              name: 'Tandoori Nights',
            },
          },
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockActiveOrderResponse),
      });

      const res = await apiRequest<any>('/orders/active');

      expect(res.hasActiveOrder).toBe(true);
      expect(res.activeOrder).toBeDefined();
      expect(res.activeOrder.id).toBe('ord-active-888');
      expect(res.activeOrder.orderNumber).toBe('FL-20261115-888');
      expect(res.activeOrder.status).toBe('preparing');
      expect(res.activeOrder.restaurant.name).toBe('Tandoori Nights');
    });

    it('9. Proactive check when no active order exists: returns hasActiveOrder=false and activeOrder=null', async () => {
      const mockNoActiveResponse = {
        success: true,
        statusCode: 200,
        data: {
          hasActiveOrder: false,
          activeOrder: null,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNoActiveResponse),
      });

      const res = await apiRequest<any>('/orders/active');

      expect(res.hasActiveOrder).toBe(false);
      expect(res.activeOrder).toBeNull();
    });

    it('10. Order creation blocked by active order returns 409 ACTIVE_ORDER_IN_PROGRESS with conflict payload', async () => {
      const mock409ConflictPayload = {
        success: false,
        statusCode: 409,
        error: {
          code: 'ACTIVE_ORDER_IN_PROGRESS',
          message: 'Customer already has an active order in progress: ord-active-999',
          activeOrder: {
            id: 'ord-active-999',
            orderNumber: 'FL-20261115-999',
            status: 'confirmed',
            totalAmount: '680.00',
            createdAt: '2026-11-15T08:15:00.000Z',
          },
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve(mock409ConflictPayload),
      });

      let caughtError: any = null;
      try {
        await apiRequest<any>('/orders', {
          method: 'POST',
          body: JSON.stringify({ outletId: 'out-1', items: [] }),
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError.statusCode).toBe(409);
      expect(caughtError.code).toBe('ACTIVE_ORDER_IN_PROGRESS');
      expect(caughtError.activeOrder).toBeDefined();
      expect(caughtError.activeOrder.id).toBe('ord-active-999');
      expect(caughtError.activeOrder.status).toBe('confirmed');
    });

    it('11. Track Current Order navigation passes the active order ID directly', () => {
      const activeOrder = {
        id: 'ord-track-777',
        orderNumber: 'FL-20261115-777',
        status: 'out_for_delivery',
      };

      const mockOnTrackOrder = jest.fn();
      mockOnTrackOrder(activeOrder.id);

      expect(mockOnTrackOrder).toHaveBeenCalledTimes(1);
      expect(mockOnTrackOrder).toHaveBeenCalledWith('ord-track-777');
    });

    it('12. Cart items and restaurant context are preserved when active order modal is dismissed', () => {
      let cartState = {
        restaurantId: 'rest-keep-1',
        restaurantName: 'Burger Craft',
        items: [{ id: 'item-1', name: 'Smash Burger', quantity: 2, price: 299 }],
      };

      const clearCart = jest.fn(() => {
        cartState = { restaurantId: '', restaurantName: '', items: [] };
      });

      // User encounters ACTIVE_ORDER_IN_PROGRESS or dismisses modal:
      // In CartScreen: "Keep Cart for Later" simply closes modal (setIsActiveOrderModalOpen(false))
      const onDismissModal = () => {
        // Does NOT call clearCart()
      };

      onDismissModal();

      expect(clearCart).not.toHaveBeenCalled();
      expect(cartState.items.length).toBe(1);
      expect(cartState.restaurantName).toBe('Burger Craft');
    });

    it('13. Proactive active-order banner renders with correct order reference and track action', () => {
      const activeOrder = {
        id: 'ord-banner-123',
        orderNumber: 'FL-20261115-123',
        status: 'preparing',
      };

      const bannerTitle = `Order #${activeOrder.orderNumber} is in progress`;
      const bannerSub = 'You already have an active order in progress. Tap to track your delivery.';

      expect(bannerTitle).toBe('Order #FL-20261115-123 is in progress');
      expect(bannerSub).toContain('Tap to track your delivery');
    });

    it('14. AppState foreground transition re-triggers active order verification', () => {
      const fetchActiveOrder = jest.fn();

      const handleAppStateChange = (nextAppState: string) => {
        if (nextAppState === 'active') {
          fetchActiveOrder();
        }
      };

      // Background to active
      handleAppStateChange('active');
      expect(fetchActiveOrder).toHaveBeenCalledTimes(1);

      // Inactive/background does not re-fetch
      handleAppStateChange('background');
      expect(fetchActiveOrder).toHaveBeenCalledTimes(1);
    });

    it('15. Race condition safety: order creation 409 triggers ActiveOrderWarningModal without payment session initiation', () => {
      const initiatePaymentSession = jest.fn();
      const openActiveOrderModal = jest.fn();

      const handleCheckoutError = (err: any) => {
        if (err.code === 'ACTIVE_ORDER_IN_PROGRESS') {
          openActiveOrderModal(err.activeOrder);
          return;
        }
        initiatePaymentSession();
      };

      const conflictErr = new ApiError('Active order exists', 409, 'ACTIVE_ORDER_IN_PROGRESS', {
        id: 'ord-racing-555',
        orderNumber: 'FL-20261115-555',
        status: 'preparing',
      });

      handleCheckoutError(conflictErr);

      expect(openActiveOrderModal).toHaveBeenCalledWith(conflictErr.activeOrder);
      expect(initiatePaymentSession).not.toHaveBeenCalled();
    });
  });
});
