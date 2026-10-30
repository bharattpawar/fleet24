import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardService } from './admin-dashboard.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('AdminDashboardService Metrics & Analytics Integration', () => {
  let service: AdminDashboardService;
  let mockDb: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockDb = {
      select: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  describe('getOverview Calculations', () => {
    it('accurately aggregates consolidated platform metrics across tables', async () => {
      // Mock sequence of database select queries for getOverview:
      // 1. totalCustomers
      // 2. newCustomers
      // 3. activeCustomers
      // 4. restaurantCounts
      // 5. outletCounts
      // 6. riderMetrics
      // 7. orderMetrics
      // 8. todayOrdersRow
      // 9. deliveryMetrics
      // 10. attemptMetrics
      // 11. paymentStats
      // 12. todayPaymentStats
      // 13. refundStats
      // 14. todayRefundStats

      const createQueryChain = (resultValue: any) => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(resultValue),
        leftJoin: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(resultValue),
      });

      mockDb.select
        .mockReturnValueOnce(createQueryChain([{ count: 150 }])) // totalCustomers
        .mockReturnValueOnce(createQueryChain([{ count: 25 }])) // newCustomers
        .mockReturnValueOnce(createQueryChain([{ count: 40 }])) // activeCustomers
        .mockReturnValueOnce({
          from: jest.fn().mockResolvedValue([
            { totalRestaurants: 12, activeRestaurants: 10, inactiveRestaurants: 2 },
          ]),
        }) // restaurantCounts
        .mockReturnValueOnce({
          from: jest.fn().mockResolvedValue([
            { totalOutlets: 18, activeOutlets: 16, acceptingOrdersOutlets: 14 },
          ]),
        }) // outletCounts
        .mockReturnValueOnce({
          from: jest.fn().mockResolvedValue([
            {
              totalRiders: 30,
              pendingVerification: 4,
              approvedRiders: 24,
              rejectedRiders: 2,
              suspendedRiders: 1,
              availableRiders: 15,
              busyRiders: 8,
              offlineRiders: 7,
            },
          ]),
        }) // riderMetrics
        .mockReturnValueOnce(
          createQueryChain([
            {
              totalOrders: 320,
              completedOrders: 280,
              cancelledOrders: 20,
              rejectedOrders: 5,
              processingOrders: 15,
              awaitingAssignmentOrders: 3,
            },
          ]),
        ) // orderMetrics
        .mockReturnValueOnce(createQueryChain([{ todayOrders: 45 }])) // todayOrdersRow
        .mockReturnValueOnce(
          createQueryChain([
            {
              totalDeliveries: 300,
              activeDeliveries: 12,
              unassignedDeliveries: 2,
              acceptedDeliveries: 4,
              pickedUpDeliveries: 6,
              completedDeliveries: 280,
              cancelledDeliveries: 8,
            },
          ]),
        ) // deliveryMetrics
        .mockReturnValueOnce(
          createQueryChain([
            {
              pendingOffers: 3,
              expiredOffers: 6,
            },
          ]),
        ) // attemptMetrics
        .mockReturnValueOnce(createQueryChain([{ capturedAmount: '154000.50' }])) // paymentStats
        .mockReturnValueOnce(createQueryChain([{ todayCapturedAmount: '21500.00' }])) // todayPaymentStats
        .mockReturnValueOnce(
          createQueryChain([
            {
              processedRefundAmount: '4500.50',
              pendingRefundAmount: '1200.00',
            },
          ]),
        ) // refundStats
        .mockReturnValueOnce(createQueryChain([{ todayProcessedRefundAmount: '600.00' }])); // todayRefundStats

      const res = await service.getOverview({ period: 'last_7_days' });

      // Customer validations
      expect(res.customers.totalCustomers).toBe(150);
      expect(res.customers.newCustomers).toBe(25);
      expect(res.customers.activeCustomers).toBe(40);

      // Restaurant & Outlet distinction
      expect(res.restaurants.totalRestaurants).toBe(12);
      expect(res.restaurants.totalOutlets).toBe(18);
      expect(res.restaurants.activeRestaurants).toBe(10);
      expect(res.restaurants.acceptingOrdersOutlets).toBe(14);

      // Rider metrics
      expect(res.riders.totalRiders).toBe(30);
      expect(res.riders.approvedRiders).toBe(24);
      expect(res.riders.availableRiders).toBe(15);
      expect(res.riders.busyRiders).toBe(8);

      // Order metrics
      expect(res.orders.totalOrders).toBe(320);
      expect(res.orders.todayOrders).toBe(45);
      expect(res.orders.completedOrders).toBe(280);

      // Financial accuracy: Net = Captured - Refunded
      // 154000.50 - 4500.50 = 149500.00
      expect(res.financials.currency).toBe('INR');
      expect(res.financials.totalCapturedAmount).toBe(154000.50);
      expect(res.financials.todayCapturedAmount).toBe(21500.00);
      expect(res.financials.totalRefundedAmount).toBe(4500.50);
      expect(res.financials.todayRefundedAmount).toBe(600.00);
      expect(res.financials.netCollectedAmount).toBe(149500.00);
      expect(res.financials.pendingRefundAmount).toBe(1200.00);
    });
  });

  describe('getOrdersAnalytics', () => {
    it('calculates average order value and formats daily time series', async () => {
      const summaryResult = [
        {
          totalOrders: 10,
          completedOrders: 8,
          cancelledOrders: 1,
          rejectedOrders: 1,
          awaitingAssignment: 0,
          totalOrderValue: '5000.00',
        },
      ];

      const seriesResult = [
        {
          date: '2026-10-24',
          totalOrders: 6,
          completedOrders: 5,
          cancelledOrders: 1,
          rejectedOrders: 0,
          totalValue: '3000.00',
        },
        {
          date: '2026-10-25',
          totalOrders: 4,
          completedOrders: 3,
          cancelledOrders: 0,
          rejectedOrders: 1,
          totalValue: '2000.00',
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(summaryResult),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              groupBy: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockResolvedValue(seriesResult),
              }),
            }),
          }),
        });

      const res = await service.getOrdersAnalytics({ period: 'last_7_days' });

      expect(res.currency).toBe('INR');
      expect(res.summary.totalOrders).toBe(10);
      expect(res.summary.totalOrderValue).toBe(5000.00);
      expect(res.summary.averageOrderValue).toBe(500.00); // 5000 / 10
      expect(res.series.length).toBe(2);
      expect(res.series[0].date).toBe('2026-10-24');
      expect(res.series[0].totalValue).toBe(3000.00);
    });
  });

  describe('getRevenueAnalytics', () => {
    it('calculates gross, refunded, and net retained money without commission assumptions', async () => {
      const paymentsSummary = [
        {
          totalCapturedAmount: '20000.00',
          capturedCount: 20,
          failedCount: 2,
          pendingCount: 1,
        },
      ];

      const refundsSummary = [
        {
          processedRefundAmount: '1500.00',
          pendingRefundAmount: '500.00',
          failedRefundAmount: '0.00',
          processedCount: 3,
          pendingCount: 1,
          failedCount: 0,
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(paymentsSummary),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(refundsSummary),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              groupBy: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              groupBy: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const res = await service.getRevenueAnalytics({ period: 'last_7_days' });

      expect(res.currency).toBe('INR');
      expect(res.summary.grossCapturedAmount).toBe(20000.00);
      expect(res.summary.processedRefundAmount).toBe(1500.00);
      expect(res.summary.netCollectedAmount).toBe(18500.00); // 20000 - 1500
      expect(res.summary.pendingRefundAmount).toBe(500.00);
      expect(res.paymentStatusBreakdown.captured).toBe(20);
      expect(res.paymentStatusBreakdown.failed).toBe(2);
      expect(res.refundStatusBreakdown.processed).toBe(3);
    });
  });
});

