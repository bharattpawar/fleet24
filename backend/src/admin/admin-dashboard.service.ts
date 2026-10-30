import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql, and, gte, lt, eq, desc } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import {
  AdminDashboardFilterDto,
  AdminRecentActivityQueryDto,
} from './dto/admin-dashboard.dto';
import { resolveDateRange } from './admin-date.util';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: any,
  ) {}

  /**
   * GET /api/v1/admin/dashboard/overview
   * Consolidated metrics for Customers, Restaurants, Riders, Orders, Deliveries and Financials.
   */
  async getOverview(filterDto: AdminDashboardFilterDto) {
    const { startDate, endDate, period } = resolveDateRange(
      filterDto.period,
      filterDto.from,
      filterDto.to,
    );

    // 1. Customer Metrics
    // Count total customers and customers registered within period
    const [totalCustomersRow] = await this.db
      .select({ count: sql<number>`count(distinct ${schema.userRoles.userId})::int` })
      .from(schema.userRoles)
      .where(eq(schema.userRoles.role, 'customer'));

    const [newCustomersRow] = await this.db
      .select({ count: sql<number>`count(distinct ${schema.userRoles.userId})::int` })
      .from(schema.userRoles)
      .where(
        and(
          eq(schema.userRoles.role, 'customer'),
          gte(schema.userRoles.createdAt, startDate),
          lt(schema.userRoles.createdAt, endDate),
        ),
      );

    // Active customers: Customers who placed at least 1 order during the selected period
    const [activeCustomersRow] = await this.db
      .select({ count: sql<number>`count(distinct ${schema.orders.customerId})::int` })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, startDate),
          lt(schema.orders.createdAt, endDate),
        ),
      );

    // 2. Restaurant Metrics (Distinguishing parent restaurants from outlets)
    const [restaurantCounts] = await this.db
      .select({
        totalRestaurants: sql<number>`count(*)::int`,
        activeRestaurants: sql<number>`count(*) filter (where ${schema.restaurants.isActive} = true)::int`,
        inactiveRestaurants: sql<number>`count(*) filter (where ${schema.restaurants.isActive} = false)::int`,
      })
      .from(schema.restaurants);

    const [outletCounts] = await this.db
      .select({
        totalOutlets: sql<number>`count(*)::int`,
        activeOutlets: sql<number>`count(*) filter (where ${schema.restaurantOutlets.isActive} = true)::int`,
        acceptingOrdersOutlets: sql<number>`count(*) filter (where ${schema.restaurantOutlets.isAcceptingOrders} = true)::int`,
      })
      .from(schema.restaurantOutlets);

    // 3. Rider Metrics
    // Using verified schema columns: verificationStatus ('pending' | 'approved' | 'rejected')
    // and availabilityStatus ('offline' | 'available' | 'busy')
    const [riderMetrics] = await this.db
      .select({
        totalRiders: sql<number>`count(*)::int`,
        pendingVerification: sql<number>`count(*) filter (where ${schema.riders.verificationStatus} = 'pending')::int`,
        approvedRiders: sql<number>`count(*) filter (where ${schema.riders.verificationStatus} = 'approved')::int`,
        rejectedRiders: sql<number>`count(*) filter (where ${schema.riders.verificationStatus} = 'rejected')::int`,
        suspendedRiders: sql<number>`count(*) filter (where ${schema.riders.suspensionReason} is not null)::int`,
        availableRiders: sql<number>`count(*) filter (where ${schema.riders.availabilityStatus} = 'available' and ${schema.riders.suspensionReason} is null and ${schema.riders.verificationStatus} = 'approved')::int`,
        busyRiders: sql<number>`count(*) filter (where ${schema.riders.availabilityStatus} = 'busy' and ${schema.riders.suspensionReason} is null)::int`,
        offlineRiders: sql<number>`count(*) filter (where ${schema.riders.availabilityStatus} = 'offline' or ${schema.riders.suspensionReason} is not null)::int`,
      })
      .from(schema.riders);

    // 4. Order Metrics (Over the selected period and Today IST)
    const todayRange = resolveDateRange('today');

    const [orderMetrics] = await this.db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        completedOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'delivered')::int`,
        cancelledOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'cancelled')::int`,
        rejectedOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'rejected')::int`,
        processingOrders: sql<number>`count(*) filter (where ${schema.orders.status} in ('placed', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'))::int`,
        awaitingAssignmentOrders: sql<number>`count(*) filter (where ${schema.orders.status} in ('confirmed', 'preparing', 'ready_for_pickup'))::int`,
      })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, startDate),
          lt(schema.orders.createdAt, endDate),
        ),
      );

    const [todayOrdersRow] = await this.db
      .select({
        todayOrders: sql<number>`count(*)::int`,
      })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, todayRange.startDate),
          lt(schema.orders.createdAt, todayRange.endDate),
        ),
      );

    // 5. Delivery Metrics (Over the selected period)
    const [deliveryMetrics] = await this.db
      .select({
        totalDeliveries: sql<number>`count(*)::int`,
        activeDeliveries: sql<number>`count(*) filter (where ${schema.deliveries.status} in ('assigned', 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer'))::int`,
        unassignedDeliveries: sql<number>`count(*) filter (where ${schema.deliveries.status} = 'unassigned')::int`,
        acceptedDeliveries: sql<number>`count(*) filter (where ${schema.deliveries.status} = 'accepted')::int`,
        pickedUpDeliveries: sql<number>`count(*) filter (where ${schema.deliveries.status} = 'picked_up')::int`,
        completedDeliveries: sql<number>`count(*) filter (where ${schema.deliveries.status} = 'completed')::int`,
        cancelledDeliveries: sql<number>`count(*) filter (where ${schema.deliveries.status} = 'cancelled')::int`,
      })
      .from(schema.deliveries)
      .where(
        and(
          gte(schema.deliveries.createdAt, startDate),
          lt(schema.deliveries.createdAt, endDate),
        ),
      );

    // Pending and expired assignment offers
    const [attemptMetrics] = await this.db
      .select({
        pendingOffers: sql<number>`count(*) filter (where ${schema.deliveryAssignmentAttempts.status} = 'offered')::int`,
        expiredOffers: sql<number>`count(*) filter (where ${schema.deliveryAssignmentAttempts.status} = 'expired')::int`,
      })
      .from(schema.deliveryAssignmentAttempts)
      .where(
        and(
          gte(schema.deliveryAssignmentAttempts.createdAt, startDate),
          lt(schema.deliveryAssignmentAttempts.createdAt, endDate),
        ),
      );

    // 6. Financial Metrics (Currency: INR)
    // Captured payment: payments where status = 'captured' (and refunded amounts deducted for net)
    const [paymentStats] = await this.db
      .select({
        capturedAmount: sql<string>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.status} in ('captured', 'refunded', 'partially_refunded')), 0)::text`,
      })
      .from(schema.payments)
      .where(
        and(
          gte(schema.payments.createdAt, startDate),
          lt(schema.payments.createdAt, endDate),
        ),
      );

    const [todayPaymentStats] = await this.db
      .select({
        todayCapturedAmount: sql<string>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.status} in ('captured', 'refunded', 'partially_refunded')), 0)::text`,
      })
      .from(schema.payments)
      .where(
        and(
          gte(schema.payments.createdAt, todayRange.startDate),
          lt(schema.payments.createdAt, todayRange.endDate),
        ),
      );

    const [refundStats] = await this.db
      .select({
        processedRefundAmount: sql<string>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.status} = 'processed'), 0)::text`,
        pendingRefundAmount: sql<string>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.status} = 'pending'), 0)::text`,
      })
      .from(schema.refunds)
      .where(
        and(
          gte(schema.refunds.createdAt, startDate),
          lt(schema.refunds.createdAt, endDate),
        ),
      );

    const [todayRefundStats] = await this.db
      .select({
        todayProcessedRefundAmount: sql<string>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.status} = 'processed'), 0)::text`,
      })
      .from(schema.refunds)
      .where(
        and(
          gte(schema.refunds.createdAt, todayRange.startDate),
          lt(schema.refunds.createdAt, todayRange.endDate),
        ),
      );

    const totalCaptured = parseFloat(paymentStats?.capturedAmount || '0');
    const todayCaptured = parseFloat(todayPaymentStats?.todayCapturedAmount || '0');
    const totalRefunded = parseFloat(refundStats?.processedRefundAmount || '0');
    const todayRefunded = parseFloat(todayRefundStats?.todayProcessedRefundAmount || '0');
    const pendingRefund = parseFloat(refundStats?.pendingRefundAmount || '0');
    const netCollected = Number((totalCaptured - totalRefunded).toFixed(2));

    return {
      customers: {
        totalCustomers: totalCustomersRow?.count || 0,
        newCustomers: newCustomersRow?.count || 0,
        activeCustomers: activeCustomersRow?.count || 0,
      },
      restaurants: {
        totalRestaurants: restaurantCounts?.totalRestaurants || 0,
        activeRestaurants: restaurantCounts?.activeRestaurants || 0,
        inactiveRestaurants: restaurantCounts?.inactiveRestaurants || 0,
        totalOutlets: outletCounts?.totalOutlets || 0,
        activeOutlets: outletCounts?.activeOutlets || 0,
        acceptingOrdersOutlets: outletCounts?.acceptingOrdersOutlets || 0,
      },
      riders: {
        totalRiders: riderMetrics?.totalRiders || 0,
        pendingVerification: riderMetrics?.pendingVerification || 0,
        approvedRiders: riderMetrics?.approvedRiders || 0,
        rejectedRiders: riderMetrics?.rejectedRiders || 0,
        suspendedRiders: riderMetrics?.suspendedRiders || 0,
        availableRiders: riderMetrics?.availableRiders || 0,
        busyRiders: riderMetrics?.busyRiders || 0,
        offlineRiders: riderMetrics?.offlineRiders || 0,
      },
      orders: {
        totalOrders: orderMetrics?.totalOrders || 0,
        todayOrders: todayOrdersRow?.todayOrders || 0,
        completedOrders: orderMetrics?.completedOrders || 0,
        cancelledOrders: orderMetrics?.cancelledOrders || 0,
        rejectedOrders: orderMetrics?.rejectedOrders || 0,
        processingOrders: orderMetrics?.processingOrders || 0,
        awaitingRiderAssignment: orderMetrics?.awaitingAssignmentOrders || 0,
      },
      deliveries: {
        totalDeliveries: deliveryMetrics?.totalDeliveries || 0,
        activeDeliveries: deliveryMetrics?.activeDeliveries || 0,
        unassignedDeliveries: deliveryMetrics?.unassignedDeliveries || 0,
        pendingOffers: attemptMetrics?.pendingOffers || 0,
        acceptedDeliveries: deliveryMetrics?.acceptedDeliveries || 0,
        pickedUpDeliveries: deliveryMetrics?.pickedUpDeliveries || 0,
        completedDeliveries: deliveryMetrics?.completedDeliveries || 0,
        expiredOffers: attemptMetrics?.expiredOffers || 0,
      },
      financials: {
        currency: 'INR',
        totalCapturedAmount: totalCaptured,
        todayCapturedAmount: todayCaptured,
        totalRefundedAmount: totalRefunded,
        todayRefundedAmount: todayRefunded,
        netCollectedAmount: netCollected,
        pendingRefundAmount: pendingRefund,
      },
      meta: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: 'Asia/Kolkata',
      },
    };
  }

  /**
   * GET /api/v1/admin/dashboard/orders
   * Detailed order breakdown and daily time series.
   */
  async getOrdersAnalytics(filterDto: AdminDashboardFilterDto) {
    const { startDate, endDate, period } = resolveDateRange(
      filterDto.period,
      filterDto.from,
      filterDto.to,
    );

    // Summary totals for the period
    const [summary] = await this.db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        completedOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'delivered')::int`,
        cancelledOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'cancelled')::int`,
        rejectedOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'rejected')::int`,
        awaitingAssignment: sql<number>`count(*) filter (where ${schema.orders.status} in ('confirmed', 'preparing', 'ready_for_pickup'))::int`,
        totalOrderValue: sql<string>`coalesce(sum(${schema.orders.totalPayable}), 0)::text`,
      })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, startDate),
          lt(schema.orders.createdAt, endDate),
        ),
      );

    const totalOrdersCount = summary?.totalOrders || 0;
    const totalOrderValueNum = parseFloat(summary?.totalOrderValue || '0');
    const averageOrderValue = totalOrdersCount > 0 ? Number((totalOrderValueNum / totalOrdersCount).toFixed(2)) : 0;

    // Daily time series grouped in Asia/Kolkata timezone
    const dailySeries = await this.db
      .select({
        date: sql<string>`to_char(${schema.orders.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
        totalOrders: sql<number>`count(*)::int`,
        completedOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'delivered')::int`,
        cancelledOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'cancelled')::int`,
        rejectedOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'rejected')::int`,
        totalValue: sql<string>`coalesce(sum(${schema.orders.totalPayable}), 0)::text`,
      })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, startDate),
          lt(schema.orders.createdAt, endDate),
        ),
      )
      .groupBy(sql`to_char(${schema.orders.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${schema.orders.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`);

    return {
      period,
      currency: 'INR',
      summary: {
        totalOrders: totalOrdersCount,
        completedOrders: summary?.completedOrders || 0,
        cancelledOrders: summary?.cancelledOrders || 0,
        rejectedOrders: summary?.rejectedOrders || 0,
        awaitingAssignment: summary?.awaitingAssignment || 0,
        totalOrderValue: totalOrderValueNum,
        averageOrderValue,
      },
      series: dailySeries.map((row: any) => ({
        date: row.date,
        totalOrders: row.totalOrders,
        completedOrders: row.completedOrders,
        cancelledOrders: row.cancelledOrders,
        rejectedOrders: row.rejectedOrders,
        totalValue: parseFloat(row.totalValue || '0'),
      })),
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: 'Asia/Kolkata',
      },
    };
  }

  /**
   * GET /api/v1/admin/dashboard/revenue
   * Detailed financial analytics: customer collections, refunds, net money retained, and breakdowns.
   */
  async getRevenueAnalytics(filterDto: AdminDashboardFilterDto) {
    const { startDate, endDate, period } = resolveDateRange(
      filterDto.period,
      filterDto.from,
      filterDto.to,
    );

    // Payments summary
    const [paymentsSummary] = await this.db
      .select({
        totalCapturedAmount: sql<string>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.status} in ('captured', 'refunded', 'partially_refunded')), 0)::text`,
        capturedCount: sql<number>`count(*) filter (where ${schema.payments.status} in ('captured', 'refunded', 'partially_refunded'))::int`,
        failedCount: sql<number>`count(*) filter (where ${schema.payments.status} = 'failed')::int`,
        pendingCount: sql<number>`count(*) filter (where ${schema.payments.status} = 'pending')::int`,
      })
      .from(schema.payments)
      .where(
        and(
          gte(schema.payments.createdAt, startDate),
          lt(schema.payments.createdAt, endDate),
        ),
      );

    // Refunds summary
    const [refundsSummary] = await this.db
      .select({
        processedRefundAmount: sql<string>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.status} = 'processed'), 0)::text`,
        pendingRefundAmount: sql<string>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.status} = 'pending'), 0)::text`,
        failedRefundAmount: sql<string>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.status} = 'failed'), 0)::text`,
        processedCount: sql<number>`count(*) filter (where ${schema.refunds.status} = 'processed')::int`,
        pendingCount: sql<number>`count(*) filter (where ${schema.refunds.status} = 'pending')::int`,
        failedCount: sql<number>`count(*) filter (where ${schema.refunds.status} = 'failed')::int`,
      })
      .from(schema.refunds)
      .where(
        and(
          gte(schema.refunds.createdAt, startDate),
          lt(schema.refunds.createdAt, endDate),
        ),
      );

    const grossCaptured = parseFloat(paymentsSummary?.totalCapturedAmount || '0');
    const processedRefunds = parseFloat(refundsSummary?.processedRefundAmount || '0');
    const pendingRefunds = parseFloat(refundsSummary?.pendingRefundAmount || '0');
    const netRetained = Number((grossCaptured - processedRefunds).toFixed(2));

    // Daily payments series
    const dailyPayments = await this.db
      .select({
        date: sql<string>`to_char(${schema.payments.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
        capturedAmount: sql<string>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.status} in ('captured', 'refunded', 'partially_refunded')), 0)::text`,
        transactionCount: sql<number>`count(*)::int`,
      })
      .from(schema.payments)
      .where(
        and(
          gte(schema.payments.createdAt, startDate),
          lt(schema.payments.createdAt, endDate),
        ),
      )
      .groupBy(sql`to_char(${schema.payments.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${schema.payments.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`);

    // Daily refunds series
    const dailyRefunds = await this.db
      .select({
        date: sql<string>`to_char(${schema.refunds.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
        refundedAmount: sql<string>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.status} = 'processed'), 0)::text`,
        refundCount: sql<number>`count(*) filter (where ${schema.refunds.status} = 'processed')::int`,
      })
      .from(schema.refunds)
      .where(
        and(
          gte(schema.refunds.createdAt, startDate),
          lt(schema.refunds.createdAt, endDate),
        ),
      )
      .groupBy(sql`to_char(${schema.refunds.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${schema.refunds.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`);

    return {
      period,
      currency: 'INR',
      summary: {
        grossCapturedAmount: grossCaptured,
        processedRefundAmount: processedRefunds,
        netCollectedAmount: netRetained,
        pendingRefundAmount: pendingRefunds,
        fleet24CommissionNote: 'Fleet24 commission calculation pending commercial settlement model definition',
      },
      paymentStatusBreakdown: {
        captured: paymentsSummary?.capturedCount || 0,
        failed: paymentsSummary?.failedCount || 0,
        pending: paymentsSummary?.pendingCount || 0,
      },
      refundStatusBreakdown: {
        processed: refundsSummary?.processedCount || 0,
        pending: refundsSummary?.pendingCount || 0,
        failed: refundsSummary?.failedCount || 0,
      },
      dailyPaymentSeries: dailyPayments.map((row: any) => ({
        date: row.date,
        capturedAmount: parseFloat(row.capturedAmount || '0'),
        transactionCount: row.transactionCount,
      })),
      dailyRefundSeries: dailyRefunds.map((row: any) => ({
        date: row.date,
        refundedAmount: parseFloat(row.refundedAmount || '0'),
        refundCount: row.refundCount,
      })),
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: 'Asia/Kolkata',
      },
    };
  }

  /**
   * GET /api/v1/admin/dashboard/riders
   * Rider verification breakdown, availability status, delivery performance and registration trends.
   */
  async getRiderAnalytics(filterDto: AdminDashboardFilterDto) {
    const { startDate, endDate, period } = resolveDateRange(
      filterDto.period,
      filterDto.from,
      filterDto.to,
    );

    // Overall rider pool metrics
    const [riderSummary] = await this.db
      .select({
        totalRiders: sql<number>`count(*)::int`,
        pendingVerification: sql<number>`count(*) filter (where ${schema.riders.verificationStatus} = 'pending')::int`,
        approvedRiders: sql<number>`count(*) filter (where ${schema.riders.verificationStatus} = 'approved')::int`,
        rejectedRiders: sql<number>`count(*) filter (where ${schema.riders.verificationStatus} = 'rejected')::int`,
        suspendedRiders: sql<number>`count(*) filter (where ${schema.riders.suspensionReason} is not null)::int`,
        availableRiders: sql<number>`count(*) filter (where ${schema.riders.availabilityStatus} = 'available' and ${schema.riders.suspensionReason} is null and ${schema.riders.verificationStatus} = 'approved')::int`,
        busyRiders: sql<number>`count(*) filter (where ${schema.riders.availabilityStatus} = 'busy' and ${schema.riders.suspensionReason} is null)::int`,
        offlineRiders: sql<number>`count(*) filter (where ${schema.riders.availabilityStatus} = 'offline' or ${schema.riders.suspensionReason} is not null)::int`,
      })
      .from(schema.riders);

    // Delivery counts during period
    const [deliveryMetrics] = await this.db
      .select({
        activeDeliveryCount: sql<number>`count(*) filter (where ${schema.deliveries.status} in ('assigned', 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer'))::int`,
        completedDeliveryCount: sql<number>`count(*) filter (where ${schema.deliveries.status} = 'completed')::int`,
      })
      .from(schema.deliveries)
      .where(
        and(
          gte(schema.deliveries.createdAt, startDate),
          lt(schema.deliveries.createdAt, endDate),
        ),
      );

    // Historical rejected and expired offers during period
    const [offerMetrics] = await this.db
      .select({
        rejectedOffers: sql<number>`count(*) filter (where ${schema.deliveryAssignmentAttempts.status} = 'rejected')::int`,
        expiredOffers: sql<number>`count(*) filter (where ${schema.deliveryAssignmentAttempts.status} = 'expired')::int`,
        acceptedOffers: sql<number>`count(*) filter (where ${schema.deliveryAssignmentAttempts.status} = 'accepted')::int`,
      })
      .from(schema.deliveryAssignmentAttempts)
      .where(
        and(
          gte(schema.deliveryAssignmentAttempts.createdAt, startDate),
          lt(schema.deliveryAssignmentAttempts.createdAt, endDate),
        ),
      );

    // Rider registration trend series
    const registrationTrends = await this.db
      .select({
        date: sql<string>`to_char(${schema.riders.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
        registrations: sql<number>`count(*)::int`,
      })
      .from(schema.riders)
      .where(
        and(
          gte(schema.riders.createdAt, startDate),
          lt(schema.riders.createdAt, endDate),
        ),
      )
      .groupBy(sql`to_char(${schema.riders.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${schema.riders.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`);

    return {
      period,
      summary: {
        totalRiders: riderSummary?.totalRiders || 0,
        activeDeliveries: deliveryMetrics?.activeDeliveryCount || 0,
        completedDeliveries: deliveryMetrics?.completedDeliveryCount || 0,
        rejectedOffers: offerMetrics?.rejectedOffers || 0,
        expiredOffers: offerMetrics?.expiredOffers || 0,
        acceptedOffers: offerMetrics?.acceptedOffers || 0,
      },
      verificationBreakdown: {
        pending: riderSummary?.pendingVerification || 0,
        approved: riderSummary?.approvedRiders || 0,
        rejected: riderSummary?.rejectedRiders || 0,
        suspended: riderSummary?.suspendedRiders || 0,
      },
      availabilityBreakdown: {
        available: riderSummary?.availableRiders || 0,
        busy: riderSummary?.busyRiders || 0,
        offline: riderSummary?.offlineRiders || 0,
      },
      registrationTrends: registrationTrends.map((row: any) => ({
        date: row.date,
        registrations: row.registrations,
      })),
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: 'Asia/Kolkata',
      },
    };
  }

  /**
   * GET /api/v1/admin/dashboard/restaurants
   * Restaurant & Outlet breakdown, orders by restaurant, completed vs cancelled.
   */
  async getRestaurantAnalytics(filterDto: AdminDashboardFilterDto) {
    const { startDate, endDate, period } = resolveDateRange(
      filterDto.period,
      filterDto.from,
      filterDto.to,
    );

    // Restaurant counts
    const [restaurantCounts] = await this.db
      .select({
        totalRestaurants: sql<number>`count(*)::int`,
        activeRestaurants: sql<number>`count(*) filter (where ${schema.restaurants.isActive} = true)::int`,
        inactiveRestaurants: sql<number>`count(*) filter (where ${schema.restaurants.isActive} = false)::int`,
      })
      .from(schema.restaurants);

    // Outlets counts
    const [outletCounts] = await this.db
      .select({
        totalOutlets: sql<number>`count(*)::int`,
        activeOutlets: sql<number>`count(*) filter (where ${schema.restaurantOutlets.isActive} = true)::int`,
        acceptingOrdersOutlets: sql<number>`count(*) filter (where ${schema.restaurantOutlets.isAcceptingOrders} = true)::int`,
      })
      .from(schema.restaurantOutlets);

    // Performance by restaurant during period
    const restaurantPerformance = await this.db
      .select({
        restaurantId: schema.restaurants.id,
        restaurantName: schema.restaurants.name,
        totalOrders: sql<number>`count(${schema.orders.id})::int`,
        completedOrders: sql<number>`count(${schema.orders.id}) filter (where ${schema.orders.status} = 'delivered')::int`,
        cancelledOrders: sql<number>`count(${schema.orders.id}) filter (where ${schema.orders.status} = 'cancelled')::int`,
        totalGrossValue: sql<string>`coalesce(sum(${schema.orders.totalPayable}), 0)::text`,
      })
      .from(schema.restaurants)
      .leftJoin(
        schema.restaurantOutlets,
        eq(schema.restaurants.id, schema.restaurantOutlets.restaurantId),
      )
      .leftJoin(
        schema.orders,
        and(
          eq(schema.restaurantOutlets.id, schema.orders.outletId),
          gte(schema.orders.createdAt, startDate),
          lt(schema.orders.createdAt, endDate),
        ),
      )
      .groupBy(schema.restaurants.id, schema.restaurants.name)
      .orderBy(desc(sql`count(${schema.orders.id})`));

    // Summary totals for cancellation rate calculation
    let totalOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;

    const mappedPerformance = restaurantPerformance.map((row: any) => {
      const ordersCount = row.totalOrders || 0;
      const comp = row.completedOrders || 0;
      const canc = row.cancelledOrders || 0;
      totalOrders += ordersCount;
      completedOrders += comp;
      cancelledOrders += canc;
      const cancellationRate = ordersCount > 0 ? Number(((canc / ordersCount) * 100).toFixed(2)) : 0;

      return {
        restaurantId: row.restaurantId,
        restaurantName: row.restaurantName,
        totalOrders: ordersCount,
        completedOrders: comp,
        cancelledOrders: canc,
        cancellationRate,
        totalGrossValue: parseFloat(row.totalGrossValue || '0'),
      };
    });

    const overallCancellationRate =
      totalOrders > 0 ? Number(((cancelledOrders / totalOrders) * 100).toFixed(2)) : 0;

    // Restaurant registration trend
    const registrationTrends = await this.db
      .select({
        date: sql<string>`to_char(${schema.restaurants.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
        registrations: sql<number>`count(*)::int`,
      })
      .from(schema.restaurants)
      .where(
        and(
          gte(schema.restaurants.createdAt, startDate),
          lt(schema.restaurants.createdAt, endDate),
        ),
      )
      .groupBy(sql`to_char(${schema.restaurants.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${schema.restaurants.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`);

    return {
      period,
      summary: {
        totalRestaurants: restaurantCounts?.totalRestaurants || 0,
        activeRestaurants: restaurantCounts?.activeRestaurants || 0,
        inactiveRestaurants: restaurantCounts?.inactiveRestaurants || 0,
        totalOutlets: outletCounts?.totalOutlets || 0,
        activeOutlets: outletCounts?.activeOutlets || 0,
        acceptingOrdersOutlets: outletCounts?.acceptingOrdersOutlets || 0,
        totalOrders,
        completedOrders,
        cancelledOrders,
        overallCancellationRate,
      },
      restaurantPerformance: mappedPerformance,
      registrationTrends: registrationTrends.map((row: any) => ({
        date: row.date,
        registrations: row.registrations,
      })),
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: 'Asia/Kolkata',
      },
    };
  }

  /**
   * GET /api/v1/admin/dashboard/recent-activity
   * Operational activity feed assembled from orders, refunds, and user registration timestamps.
   */
  async getRecentActivity(queryDto: AdminRecentActivityQueryDto) {
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 20;
    const offset = (page - 1) * limit;

    // We query the most recent orders, payments, refunds and riders to construct an accurate operational timeline
    const recentOrders = await this.db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        status: schema.orders.status,
        totalPayable: schema.orders.totalPayable,
        createdAt: schema.orders.createdAt,
      })
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit);

    const recentRefunds = await this.db
      .select({
        id: schema.refunds.id,
        amount: schema.refunds.amount,
        status: schema.refunds.status,
        reason: schema.refunds.reason,
        createdAt: schema.refunds.createdAt,
      })
      .from(schema.refunds)
      .orderBy(desc(schema.refunds.createdAt))
      .limit(limit);

    const recentRiders = await this.db
      .select({
        id: schema.riders.id,
        fullName: schema.riders.fullName,
        verificationStatus: schema.riders.verificationStatus,
        createdAt: schema.riders.createdAt,
      })
      .from(schema.riders)
      .orderBy(desc(schema.riders.createdAt))
      .limit(limit);

    // Merge into normalized event timeline
    const events: Array<{
      id: string;
      source: 'order' | 'refund' | 'rider';
      eventType: string;
      description: string;
      timestamp: string;
      metadata: Record<string, any>;
    }> = [];

    for (const ord of recentOrders) {
      events.push({
        id: `ord_${ord.id}`,
        source: 'order',
        eventType: `order_${ord.status}`,
        description: `Order #${ord.orderNumber} is ${ord.status} (INR ${ord.totalPayable})`,
        timestamp: ord.createdAt.toISOString(),
        metadata: {
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          status: ord.status,
        },
      });
    }

    for (const ref of recentRefunds) {
      events.push({
        id: `ref_${ref.id}`,
        source: 'refund',
        eventType: `refund_${ref.status}`,
        description: `Refund for INR ${ref.amount} is ${ref.status}`,
        timestamp: ref.createdAt.toISOString(),
        metadata: {
          refundId: ref.id,
          amount: ref.amount,
          status: ref.status,
        },
      });
    }

    for (const r of recentRiders) {
      events.push({
        id: `rdr_${r.id}`,
        source: 'rider',
        eventType: `rider_registered`,
        description: `Rider ${r.fullName || 'New Rider'} registered (Verification: ${r.verificationStatus})`,
        timestamp: r.createdAt.toISOString(),
        metadata: {
          riderId: r.id,
          verificationStatus: r.verificationStatus,
        },
      });
    }

    // Sort descending by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by type if requested
    const filteredEvents =
      queryDto.type && queryDto.type !== 'all'
        ? events.filter((e) => e.source === queryDto.type)
        : events;

    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    return {
      page,
      limit,
      totalEvents: filteredEvents.length,
      events: paginatedEvents,
    };
  }
}
