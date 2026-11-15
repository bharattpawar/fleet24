import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, lt, or, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { AdminPaymentQueryDto, AdminRefundQueryDto } from './dto/admin-transactions.dto';

const { payments, refunds, orders, users, restaurants, restaurantOutlets } = schema;
const orderContext = {
  orderId: orders.id, orderNumber: orders.orderNumber, customer: users.fullName,
  customerPhone: users.phone, restaurant: restaurants.name,
  outletId: restaurantOutlets.id, outlet: restaurantOutlets.name,
};
const paymentFields = {
  id: payments.id, amount: payments.amount, currency: payments.currency,
  status: payments.status, paidAt: payments.paidAt, createdAt: payments.createdAt,
};
const refundFields = {
  id: refunds.id, paymentId: refunds.paymentId, amount: refunds.amount, status: refunds.status,
  reason: refunds.reason, createdAt: refunds.createdAt, providerRefundId: refunds.providerRefundId,
  isManualReviewRequired: refunds.isManualReviewRequired, currency: payments.currency,
};

@Injectable()
export class AdminTransactionsService {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  private paymentQuery() {
    return this.db.select({ ...paymentFields, ...orderContext, provider: payments.provider,
      providerOrderId: payments.providerOrderId, providerPaymentId: payments.providerPaymentId }).from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .innerJoin(restaurantOutlets, eq(orders.outletId, restaurantOutlets.id))
      .innerJoin(restaurants, eq(restaurantOutlets.restaurantId, restaurants.id));
  }

  private refundQuery() {
    return this.db.select({ ...refundFields, orderId: orders.id, orderNumber: orders.orderNumber,
      attemptCount: refunds.attemptCount, lastAttemptAt: refunds.lastAttemptAt,
      nextRetryAt: refunds.nextRetryAt, processingLeaseExpiresAt: refunds.processingLeaseExpiresAt,
      lastErrorCode: refunds.lastErrorCode, lastErrorMessage: refunds.lastErrorMessage,
      updatedAt: refunds.updatedAt }).from(refunds)
      .innerJoin(payments, eq(refunds.paymentId, payments.id))
      .innerJoin(orders, eq(payments.orderId, orders.id));
  }

  private dateBounds(query: AdminPaymentQueryDto | AdminRefundQueryDto, column: typeof payments.createdAt | typeof refunds.createdAt): SQL | undefined {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from >= to) throw new BadRequestException('From must precede to.');
    return and(from ? gte(column, from) : undefined, to ? lt(column, to) : undefined);
  }

  async listPayments(query: AdminPaymentQueryDto) {
    const search = query.search?.trim();
    const pattern = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const where = and(
      this.dateBounds(query, payments.createdAt),
      query.status ? eq(payments.status, query.status) : undefined,
      query.outletId ? eq(orders.outletId, query.outletId) : undefined,
      pattern ? or(ilike(orders.orderNumber, pattern), ilike(users.fullName, pattern),
        ilike(users.phone, pattern), ilike(payments.providerOrderId, pattern),
        ilike(payments.providerPaymentId, pattern)) : undefined,
    );
    const [data, [summary]] = await Promise.all([
      this.paymentQuery().where(where)
        .orderBy(desc(payments.createdAt), desc(payments.id)).limit(query.limit).offset((query.page - 1) * query.limit),
      this.db.select({ total: count() }).from(this.paymentQuery().where(where).as('matching_payments')),
    ]);
    return { data, total: summary.total, page: query.page, limit: query.limit, totalPages: Math.ceil(summary.total / query.limit) };
  }

  async getPayment(id: string) {
    const [payment] = await this.paymentQuery().where(eq(payments.id, id)).limit(1);
    if (!payment) throw new NotFoundException('Payment not found.');
    const relatedRefunds = await this.db.select(refundFields).from(refunds).innerJoin(payments, eq(refunds.paymentId, payments.id)).where(eq(refunds.paymentId, id))
      .orderBy(desc(refunds.createdAt), desc(refunds.id));
    return { ...payment, refunds: relatedRefunds };
  }

  async listRefunds(query: AdminRefundQueryDto) {
    const search = query.search?.trim();
    const pattern = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const where = and(
      this.dateBounds(query, refunds.createdAt),
      query.status ? eq(refunds.status, query.status) : undefined,
      query.needsReview === undefined ? undefined : eq(refunds.isManualReviewRequired, query.needsReview === 'true'),
      pattern ? or(ilike(orders.orderNumber, pattern), ilike(refunds.providerRefundId, pattern)) : undefined,
    );
    const [data, [summary]] = await Promise.all([
      this.refundQuery().where(where)
        .orderBy(desc(refunds.createdAt), desc(refunds.id)).limit(query.limit).offset((query.page - 1) * query.limit),
      this.db.select({ total: count() }).from(this.refundQuery().where(where).as('matching_refunds')),
    ]);
    return { data: data.map(({ id, paymentId, amount, currency, status, reason, createdAt, providerRefundId, isManualReviewRequired, orderId, orderNumber }) => ({
      id, paymentId, amount, currency, status, reason, createdAt, providerRefundId, isManualReviewRequired, orderId, orderNumber,
    })), total: summary.total, page: query.page, limit: query.limit, totalPages: Math.ceil(summary.total / query.limit) };
  }

  async getRefund(id: string) {
    const [refund] = await this.refundQuery().where(eq(refunds.id, id)).limit(1);
    if (!refund) throw new NotFoundException('Refund not found.');
    return refund;
  }

  listOutlets() {
    return this.db.select({ id: restaurantOutlets.id, name: restaurantOutlets.name, restaurant: restaurants.name })
      .from(restaurantOutlets).innerJoin(restaurants, eq(restaurantOutlets.restaurantId, restaurants.id))
      .orderBy(restaurants.name, restaurantOutlets.name, restaurantOutlets.id);
  }
}
