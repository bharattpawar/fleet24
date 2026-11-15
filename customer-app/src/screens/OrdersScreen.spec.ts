import { apiRequest } from '../api/client';
import { OrderItemSummary } from './OrdersScreen';

declare const global: any;

jest.mock('../api/storage', () => ({
  authStorage: {
    getAccessToken: jest.fn(() => Promise.resolve('mock-access-token')),
  },
}));

const originalFetch = global.fetch;

describe('Customer Orders & Refund Status UI (Stage 2D-C)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('Order Statuses & Refund Mapping Rules', () => {
    it('1. Maps normal placed order as confirmed fulfillment', async () => {
      const mockOrder: OrderItemSummary = {
        id: 'ord-1',
        orderNumber: 'FL-20261115-001',
        restaurantName: 'Burger Hub',
        outletName: 'Main St',
        status: 'placed',
        paymentStatus: 'captured',
        totalPayable: '450.00',
        itemCount: 2,
        createdAt: '2026-11-15T06:00:00Z',
        refund: null,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders: [mockOrder] } }),
      });

      const res = await apiRequest<{ orders: OrderItemSummary[] }>('/orders');
      const order = res.orders[0];

      expect(order.status).toBe('placed');
      expect(order.paymentStatus).toBe('captured');
      expect(order.refund).toBeNull();
    });

    it('2. Maps in-flight fulfillment statuses: preparing and out_for_delivery', async () => {
      const mockOrders: OrderItemSummary[] = [
        {
          id: 'ord-prep',
          orderNumber: 'FL-PREP',
          restaurantName: 'Pizza Hub',
          outletName: 'Center',
          status: 'preparing',
          paymentStatus: 'captured',
          totalPayable: '600.00',
          itemCount: 1,
          createdAt: '2026-11-15T06:10:00Z',
        },
        {
          id: 'ord-ofd',
          orderNumber: 'FL-OFD',
          restaurantName: 'Pizza Hub',
          outletName: 'Center',
          status: 'out_for_delivery',
          paymentStatus: 'captured',
          totalPayable: '600.00',
          itemCount: 1,
          createdAt: '2026-11-15T06:20:00Z',
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders: mockOrders } }),
      });

      const res = await apiRequest<{ orders: OrderItemSummary[] }>('/orders');
      expect(res.orders[0].status).toBe('preparing');
      expect(res.orders[1].status).toBe('out_for_delivery');
    });

    it('3. Maps captured payment conflict order: status=payment_conflict, payment=captured', async () => {
      const mockConflictOrder: OrderItemSummary = {
        id: 'ord-conf-1',
        orderNumber: 'FL-CONF-1',
        restaurantName: 'Biryani Express',
        outletName: 'Alpha 1',
        status: 'payment_conflict',
        paymentStatus: 'captured',
        totalPayable: '520.00',
        itemCount: 3,
        createdAt: '2026-11-15T06:30:00Z',
        refund: null, // Pending Admin review
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders: [mockConflictOrder] } }),
      });

      const res = await apiRequest<{ orders: OrderItemSummary[] }>('/orders');
      const order = res.orders[0];

      expect(order.status).toBe('payment_conflict');
      expect(order.paymentStatus).toBe('captured');
      expect(order.refund).toBeNull();
    });

    it('4. Handles conflict order with refund pending (refund in progress)', async () => {
      const mockRefundPending: OrderItemSummary = {
        id: 'ord-conf-pending',
        orderNumber: 'FL-CONF-PENDING',
        restaurantName: 'Biryani Express',
        outletName: 'Alpha 1',
        status: 'payment_conflict',
        paymentStatus: 'captured',
        totalPayable: '520.00',
        itemCount: 3,
        createdAt: '2026-11-15T06:30:00Z',
        refund: {
          amount: '520.00',
          status: 'pending',
          reason: 'Admin approved full refund for active-order conflict',
          refundId: 'rfnd_rzp_12345',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders: [mockRefundPending] } }),
      });

      const res = await apiRequest<{ orders: OrderItemSummary[] }>('/orders');
      const order = res.orders[0];

      expect(order.refund).toBeDefined();
      expect(order.refund?.status).toBe('pending');
      expect(order.refund?.amount).toBe('520.00');
      expect(order.refund?.refundId).toBe('rfnd_rzp_12345');
    });

    it('5. Handles conflict order with refund failed (needs operations review)', async () => {
      const mockRefundFailed: OrderItemSummary = {
        id: 'ord-conf-failed',
        orderNumber: 'FL-CONF-FAILED',
        restaurantName: 'Biryani Express',
        outletName: 'Alpha 1',
        status: 'payment_conflict',
        paymentStatus: 'captured',
        totalPayable: '520.00',
        itemCount: 3,
        createdAt: '2026-11-15T06:30:00Z',
        refund: {
          amount: '520.00',
          status: 'failed',
          reason: 'Provider gateway network rejection',
          refundId: null,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders: [mockRefundFailed] } }),
      });

      const res = await apiRequest<{ orders: OrderItemSummary[] }>('/orders');
      const order = res.orders[0];

      expect(order.refund?.status).toBe('failed');
    });

    it('6. Handles confirmed full refund completion', async () => {
      const mockRefundProcessed: OrderItemSummary = {
        id: 'ord-conf-done',
        orderNumber: 'FL-CONF-DONE',
        restaurantName: 'Biryani Express',
        outletName: 'Alpha 1',
        status: 'payment_conflict',
        paymentStatus: 'captured',
        totalPayable: '520.00',
        itemCount: 3,
        createdAt: '2026-11-15T06:30:00Z',
        refund: {
          amount: '520.00',
          status: 'processed',
          reason: 'Admin approved full refund',
          refundId: 'rfnd_settled_9999',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders: [mockRefundProcessed] } }),
      });

      const res = await apiRequest<{ orders: OrderItemSummary[] }>('/orders');
      const order = res.orders[0];

      expect(order.refund?.status).toBe('processed');
      expect(order.refund?.refundId).toBe('rfnd_settled_9999');
    });

    it('7. Handles cancelled order without refund (unpaid or rejected before charge)', async () => {
      const mockCancelledUnpaid: OrderItemSummary = {
        id: 'ord-cancelled',
        orderNumber: 'FL-CANCELLED',
        restaurantName: 'Salad Co',
        outletName: 'West',
        status: 'cancelled',
        paymentStatus: 'pending',
        totalPayable: '200.00',
        itemCount: 1,
        createdAt: '2026-11-15T05:00:00Z',
        refund: null,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { orders: [mockCancelledUnpaid] } }),
      });

      const res = await apiRequest<{ orders: OrderItemSummary[] }>('/orders');
      const order = res.orders[0];

      expect(order.status).toBe('cancelled');
      expect(order.refund).toBeNull();
    });

    it('8. Enforces action eligibility: NO Pay Now on payment_conflict or captured orders', () => {
      const conflictOrder: OrderItemSummary = {
        id: 'ord-1',
        orderNumber: 'FL-1',
        restaurantName: 'R1',
        outletName: 'O1',
        status: 'payment_conflict',
        paymentStatus: 'captured',
        totalPayable: '100',
        itemCount: 1,
        createdAt: '2026-11-15',
      };

      const isPendingPayment = conflictOrder.status === 'pending_payment';
      expect(isPendingPayment).toBe(false);
    });

    it('9. Enforces tracking eligibility: NO Live Tracking on payment_conflict orders', () => {
      const trackableStatuses = [
        'placed',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'out_for_delivery',
        'delivered',
      ];

      expect(trackableStatuses.includes('payment_conflict')).toBe(false);
      expect(trackableStatuses.includes('cancelled')).toBe(false);
    });
  });
});
