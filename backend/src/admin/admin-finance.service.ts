import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql, desc, gte, lte, inArray } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { FinancialSettingsService } from './financial-settings.service';
import {
  AdminRiderEarningsQueryDto,
  CreateRiderPayoutRequestDto,
  AdminRiderPayoutQueryDto,
  AdminRejectPayoutDto,
  AdminRestaurantSettlementQueryDto,
  GenerateSettlementDto,
} from './dto/admin-finance.dto';

export interface PayoutProviderResult {
  success: boolean;
  providerTransferId?: string;
  failureReason?: string;
}

/**
 * Pluggable Payment/Disbursement Provider Interface
 * Safe abstraction: RazorpayX / Sandbox / Bank Transfer
 */
export interface IPayoutProvider {
  processPayout(params: {
    payoutId: string;
    amount: string;
    currency: string;
    beneficiaryId: string;
    beneficiaryType: 'rider' | 'restaurant';
    idempotencyKey: string;
  }): Promise<PayoutProviderResult>;
}

/**
 * Default Sandbox/Safe Payout Provider
 * Used in test/staging/development where live direct bank disbursement credentials are not configured
 */
export class SandboxPayoutProvider implements IPayoutProvider {
  private readonly logger = new Logger(SandboxPayoutProvider.name);

  async processPayout(params: {
    payoutId: string;
    amount: string;
    currency: string;
    beneficiaryId: string;
    beneficiaryType: 'rider' | 'restaurant';
    idempotencyKey: string;
  }): Promise<PayoutProviderResult> {
    this.logger.log(
      `[SandboxPayoutProvider] Processing sandbox transfer for ${params.beneficiaryType} ${params.beneficiaryId}: amount ${params.amount} ${params.currency} (Idempotency: ${params.idempotencyKey})`,
    );

    // Deterministic simulation: always succeeds in sandbox
    const mockTransferId = `sbx_xfer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      success: true,
      providerTransferId: mockTransferId,
    };
  }
}

@Injectable()
export class AdminFinanceService {
  private readonly logger = new Logger(AdminFinanceService.name);
  private payoutProvider: IPayoutProvider;

  // Standard platform fee parameters (clearly declared, never arbitrarily fabricated)
  // Delivery earnings default to full order delivery fee collected from customer, or configurable base rate
  public static readonly DEFAULT_RIDER_DELIVERY_PAY = '30.00';
  public static readonly DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE = 0.0; // 0% unless configured

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly settingsService: FinancialSettingsService,
  ) {
    this.payoutProvider = new SandboxPayoutProvider();
  }

  /**
   * Override provider for testing or production gateway integration
   */
  setPayoutProvider(provider: IPayoutProvider) {
    this.payoutProvider = provider;
  }

  // ==========================================
  // IMMUTABLE FINANCIAL LEDGER CORE
  // ==========================================

  /**
   * Append an immutable entry to the financial ledger.
   * Enforces idempotency via unique index on idempotencyKey.
   */
  async recordTransaction(
    params: {
      transactionReference: string;
      entityType: 'rider' | 'restaurant' | 'platform' | 'customer';
      entityId: string;
      orderId?: string | null;
      entryType:
        | 'order_payment'
        | 'rider_delivery_earning'
        | 'rider_incentive'
        | 'rider_payout'
        | 'rider_payout_reversal'
        | 'restaurant_order_credit'
        | 'restaurant_commission_debit'
        | 'restaurant_settlement'
        | 'restaurant_settlement_reversal'
        | 'customer_refund_debit'
        | 'manual_adjustment';
      direction: 'credit' | 'debit';
      amount: string;
      currency?: string;
      idempotencyKey: string;
      sourceReference?: string | null;
      metadata?: Record<string, any>;
    },
    txClient?: any,
  ) {
    const client = txClient || this.db;

    // Check for existing ledger entry with same idempotency key
    const [existing] = await client
      .select()
      .from(schema.financialLedger)
      .where(eq(schema.financialLedger.idempotencyKey, params.idempotencyKey));

    if (existing) {
      this.logger.debug(
        `Ledger entry with idempotency key ${params.idempotencyKey} already exists. Returning existing entry.`,
      );
      return existing;
    }

    const [inserted] = await client
      .insert(schema.financialLedger)
      .values({
        transactionReference: params.transactionReference,
        entityType: params.entityType,
        entityId: params.entityId,
        orderId: params.orderId || null,
        entryType: params.entryType,
        direction: params.direction,
        amount: params.amount,
        currency: params.currency || 'INR',
        idempotencyKey: params.idempotencyKey,
        sourceReference: params.sourceReference || null,
        metadata: params.metadata || null,
      })
      .returning();

    this.logger.log(
      `Ledger entry recorded: [${params.direction.toUpperCase()}] ${params.entryType} amount=${params.amount} entity=${params.entityType}:${params.entityId}`,
    );

    return inserted;
  }

  /**
   * Query financial ledger entries with pagination and filters
   */
  async getLedgerEntries(query: {
    entityType?: 'rider' | 'restaurant' | 'platform' | 'customer';
    entityId?: string;
    entryType?: string;
    orderId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.entityType) {
      conditions.push(eq(schema.financialLedger.entityType, query.entityType));
    }
    if (query.entityId) {
      conditions.push(eq(schema.financialLedger.entityId, query.entityId));
    }
    if (query.orderId) {
      conditions.push(eq(schema.financialLedger.orderId, query.orderId));
    }
    if (query.entryType && query.entryType !== 'all') {
      conditions.push(eq(schema.financialLedger.entryType, query.entryType as any));
    }
    if (query.from) {
      conditions.push(gte(schema.financialLedger.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(schema.financialLedger.createdAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.financialLedger)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const items = await this.db
      .select()
      .from(schema.financialLedger)
      .where(whereClause)
      .orderBy(desc(schema.financialLedger.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ==========================================
  // RIDER EARNINGS MANAGEMENT
  // ==========================================

  /**
   * Record rider delivery earnings when a delivery completes.
   * Uses dynamic financial settings calculation strategy and saves version snapshot.
   * Credit rider balance in financial ledger.
   */
  async recordDeliveryEarning(
    orderId: string,
    riderId: string,
    deliveryId: string,
    distanceKmOverride?: number,
    txClient?: any,
  ) {
    const client = txClient || this.db;

    // Fetch order to inspect frozen delivery fee and placed time
    const [order] = await client
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Fetch delivery distance if recorded
    const [delivery] = await client
      .select({ distanceMeters: schema.deliveries.distanceMeters })
      .from(schema.deliveries)
      .where(eq(schema.deliveries.id, deliveryId));

    // Resolve distance: explicit override (in km) or persisted distanceMeters from delivery
    let distanceMeters: number = 0;
    if (distanceKmOverride !== undefined && distanceKmOverride !== null) {
      distanceMeters = distanceKmOverride * 1000;
    } else if (delivery?.distanceMeters) {
      distanceMeters = parseFloat(delivery.distanceMeters);
    }

    // Resolve active financial settings
    const activeSettingsInfo = await this.settingsService.getActiveSettings();

    const calcResult = this.settingsService.calculateRiderEarning({
      settings: activeSettingsInfo.settings,
      distanceMeters,
      orderPlacedAt: order.placedAt || undefined,
    });

    const earningAmountStr = calcResult.finalEarning.toFixed(2);
    const calculationSnapshot = {
      versionId: activeSettingsInfo.versionId,
      versionNumber: activeSettingsInfo.versionNumber,
      strategy: activeSettingsInfo.settings.riderEarnings.calculationStrategy,
      baseFare: calcResult.baseFare,
      distanceUsedKm: calcResult.distanceUsedKm,
      distanceEarning: calcResult.distanceEarning,
      incentives: calcResult.incentives,
      waitingTimeEarning: calcResult.waitingTimeEarning,
      finalEarning: calcResult.finalEarning,
      breakdown: calcResult.calculationBreakdown,
    };

    const idempotencyKey = `rider_delivery_earning_${deliveryId}_${orderId}`;

    return this.recordTransaction(
      {
        transactionReference: `DEL_EARN_${deliveryId.substring(0, 8).toUpperCase()}`,
        entityType: 'rider',
        entityId: riderId,
        orderId,
        entryType: 'rider_delivery_earning',
        direction: 'credit',
        amount: earningAmountStr,
        currency: 'INR',
        idempotencyKey,
        sourceReference: deliveryId,
        metadata: {
          deliveryId,
          orderNumber: order.orderNumber,
          settingsVersionId: activeSettingsInfo.versionId,
          ...calculationSnapshot,
        },
      },
      client,
    );
  }

  /**
   * Rider earnings summary: total earned, total paid out, pending payout reservations, and available balance
   */
  async getRiderEarningsSummary(riderId: string) {
    // 1. Verify rider exists
    const [rider] = await this.db
      .select()
      .from(schema.riders)
      .where(eq(schema.riders.id, riderId));

    if (!rider) {
      throw new NotFoundException(`Rider with ID ${riderId} not found`);
    }

    // 2. Aggregate ledger credits (earnings, incentives)
    const [creditsResult] = await this.db
      .select({
        totalCredits: sql<string>`coalesce(sum(amount), 0.00)::text`,
      })
      .from(schema.financialLedger)
      .where(
        and(
          eq(schema.financialLedger.entityType, 'rider'),
          eq(schema.financialLedger.entityId, riderId),
          eq(schema.financialLedger.direction, 'credit'),
        ),
      );

    // 3. Aggregate ledger debits (processed payouts)
    const [debitsResult] = await this.db
      .select({
        totalDebits: sql<string>`coalesce(sum(amount), 0.00)::text`,
      })
      .from(schema.financialLedger)
      .where(
        and(
          eq(schema.financialLedger.entityType, 'rider'),
          eq(schema.financialLedger.entityId, riderId),
          eq(schema.financialLedger.direction, 'debit'),
        ),
      );

    // 4. Aggregate active payout reservations (requested, approved, processing) not yet debited from ledger
    const [pendingPayoutsResult] = await this.db
      .select({
        reservedAmount: sql<string>`coalesce(sum(amount), 0.00)::text`,
      })
      .from(schema.riderPayouts)
      .where(
        and(
          eq(schema.riderPayouts.riderId, riderId),
          inArray(schema.riderPayouts.status, ['requested', 'approved', 'processing']),
        ),
      );

    const totalEarned = parseFloat(creditsResult?.totalCredits || '0.00');
    const totalWithdrawn = parseFloat(debitsResult?.totalDebits || '0.00');
    const reservedPending = parseFloat(pendingPayoutsResult?.reservedAmount || '0.00');

    // Available balance = Total earned - Total withdrawn - Pending payout reservations
    const rawAvailable = totalEarned - totalWithdrawn - reservedPending;
    const availableBalance = Math.max(0, Math.round(rawAvailable * 100) / 100).toFixed(2);

    return {
      riderId,
      riderName: rider.fullName,
      totalEarned: totalEarned.toFixed(2),
      totalWithdrawn: totalWithdrawn.toFixed(2),
      reservedPending: reservedPending.toFixed(2),
      availableBalance,
      currency: 'INR',
    };
  }

  /**
   * List order-wise delivery earnings for a rider with pagination
   */
  async listRiderEarnings(query: AdminRiderEarningsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.financialLedger.entityType, 'rider'),
      inArray(schema.financialLedger.entryType, ['rider_delivery_earning', 'rider_incentive']),
    ];

    if (query.riderId) {
      conditions.push(eq(schema.financialLedger.entityId, query.riderId));
    }
    if (query.from) {
      conditions.push(gte(schema.financialLedger.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(schema.financialLedger.createdAt, new Date(query.to)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.financialLedger)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const earnings = await this.db
      .select({
        id: schema.financialLedger.id,
        transactionReference: schema.financialLedger.transactionReference,
        riderId: schema.financialLedger.entityId,
        orderId: schema.financialLedger.orderId,
        entryType: schema.financialLedger.entryType,
        amount: schema.financialLedger.amount,
        currency: schema.financialLedger.currency,
        createdAt: schema.financialLedger.createdAt,
        metadata: schema.financialLedger.metadata,
      })
      .from(schema.financialLedger)
      .where(whereClause)
      .orderBy(desc(schema.financialLedger.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: earnings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ==========================================
  // RIDER PAYOUT WORKFLOW
  // ==========================================

  /**
   * Rider requests payout of available earnings balance.
   * Validates available balance and creates a 'requested' payout record.
   */
  async requestRiderPayout(riderId: string, dto: CreateRiderPayoutRequestDto) {
    const requestAmount = Number(dto.amount);
    if (isNaN(requestAmount) || requestAmount <= 0) {
      throw new BadRequestException('Payout request amount must be greater than 0');
    }

    const requestedAmountStr = requestAmount.toFixed(2);

    return await this.db.transaction(async (tx) => {
      // 1. Lock rider row
      const [rider] = await tx
        .select()
        .from(schema.riders)
        .where(eq(schema.riders.id, riderId))
        .for('update');

      if (!rider) {
        throw new NotFoundException(`Rider with ID ${riderId} not found`);
      }

      if (rider.verificationStatus !== 'approved') {
        throw new BadRequestException('Only verified and approved riders can request payouts');
      }

      // 2. Calculate current available balance within transaction
      const [creditsResult] = await tx
        .select({
          totalCredits: sql<string>`coalesce(sum(amount), 0.00)::text`,
        })
        .from(schema.financialLedger)
        .where(
          and(
            eq(schema.financialLedger.entityType, 'rider'),
            eq(schema.financialLedger.entityId, riderId),
            eq(schema.financialLedger.direction, 'credit'),
          ),
        );

      const [debitsResult] = await tx
        .select({
          totalDebits: sql<string>`coalesce(sum(amount), 0.00)::text`,
        })
        .from(schema.financialLedger)
        .where(
          and(
            eq(schema.financialLedger.entityType, 'rider'),
            eq(schema.financialLedger.entityId, riderId),
            eq(schema.financialLedger.direction, 'debit'),
          ),
        );

      const [pendingPayoutsResult] = await tx
        .select({
          reservedAmount: sql<string>`coalesce(sum(amount), 0.00)::text`,
        })
        .from(schema.riderPayouts)
        .where(
          and(
            eq(schema.riderPayouts.riderId, riderId),
            inArray(schema.riderPayouts.status, ['requested', 'approved', 'processing']),
          ),
        );

      const totalEarned = parseFloat(creditsResult?.totalCredits || '0.00');
      const totalWithdrawn = parseFloat(debitsResult?.totalDebits || '0.00');
      const reservedPending = parseFloat(pendingPayoutsResult?.reservedAmount || '0.00');
      const availableBalance = Math.max(0, totalEarned - totalWithdrawn - reservedPending);

      if (requestAmount > availableBalance) {
        throw new BadRequestException(
          `Insufficient available balance. Requested: ₹${requestedAmountStr}, Available: ₹${availableBalance.toFixed(2)}`,
        );
      }

      const idempotencyKey = `rider_payout_${riderId}_${Date.now()}`;

      const [payout] = await tx
        .insert(schema.riderPayouts)
        .values({
          riderId,
          amount: requestedAmountStr,
          currency: 'INR',
          status: 'requested',
          idempotencyKey,
        })
        .returning();

      this.logger.log(`Payout requested: Payout ID ${payout.id} for rider ${riderId}, amount ₹${requestedAmountStr}`);

      return payout;
    });
  }

  /**
   * Admin approves a requested rider payout.
   */
  async approveRiderPayout(adminUserId: string, payoutId: string) {
    return await this.db.transaction(async (tx) => {
      const [payout] = await tx
        .select()
        .from(schema.riderPayouts)
        .where(eq(schema.riderPayouts.id, payoutId))
        .for('update');

      if (!payout) {
        throw new NotFoundException(`Payout ${payoutId} not found`);
      }

      if (payout.status !== 'requested') {
        throw new BadRequestException(
          `Cannot approve payout with status '${payout.status}'. Payout must be in 'requested' status.`,
        );
      }

      const now = new Date();
      const [updated] = await tx
        .update(schema.riderPayouts)
        .set({
          status: 'approved',
          approvedAt: now,
          approvedByUserId: adminUserId,
          updatedAt: now,
        })
        .where(eq(schema.riderPayouts.id, payoutId))
        .returning();

      this.logger.log(`Payout ${payoutId} approved by admin user ${adminUserId}`);
      return updated;
    });
  }

  /**
   * Admin rejects a rider payout request with a mandatory reason.
   */
  async rejectRiderPayout(adminUserId: string, payoutId: string, dto: AdminRejectPayoutDto) {
    return await this.db.transaction(async (tx) => {
      const [payout] = await tx
        .select()
        .from(schema.riderPayouts)
        .where(eq(schema.riderPayouts.id, payoutId))
        .for('update');

      if (!payout) {
        throw new NotFoundException(`Payout ${payoutId} not found`);
      }

      if (payout.status !== 'requested' && payout.status !== 'approved') {
        throw new BadRequestException(
          `Cannot reject payout with status '${payout.status}'. Only 'requested' or 'approved' payouts can be rejected.`,
        );
      }

      const now = new Date();
      const [updated] = await tx
        .update(schema.riderPayouts)
        .set({
          status: 'rejected',
          rejectedAt: now,
          rejectedByUserId: adminUserId,
          rejectionReason: dto.rejectionReason,
          updatedAt: now,
        })
        .where(eq(schema.riderPayouts.id, payoutId))
        .returning();

      this.logger.log(`Payout ${payoutId} rejected by admin user ${adminUserId}. Reason: ${dto.rejectionReason}`);
      return updated;
    });
  }

  /**
   * Admin processes an approved rider payout through the payout provider.
   * If successful, records 'rider_payout' debit in financial ledger.
   * If failed, marks payout status as 'failed'.
   */
  async processRiderPayout(adminUserId: string, payoutId: string) {
    // 1. Lock and validate payout
    const [payout] = await this.db
      .select()
      .from(schema.riderPayouts)
      .where(eq(schema.riderPayouts.id, payoutId));

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (payout.status !== 'approved') {
      throw new BadRequestException(
        `Cannot process payout with status '${payout.status}'. Payout must be 'approved' before processing.`,
      );
    }

    // Set to 'processing'
    await this.db
      .update(schema.riderPayouts)
      .set({
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(schema.riderPayouts.id, payoutId));

    // 2. Delegate to payout provider abstraction
    let providerResult: PayoutProviderResult;
    try {
      providerResult = await this.payoutProvider.processPayout({
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        beneficiaryId: payout.riderId,
        beneficiaryType: 'rider',
        idempotencyKey: `disburse_${payout.id}`,
      });
    } catch (err: any) {
      this.logger.error(`Payout processing threw exception: ${err.message}`, err.stack);
      providerResult = {
        success: false,
        failureReason: err.message || 'Provider communication failure',
      };
    }

    const now = new Date();

    // 3. Update status and debit ledger if successful
    if (providerResult.success) {
      return await this.db.transaction(async (tx) => {
        const [updatedPayout] = await tx
          .update(schema.riderPayouts)
          .set({
            status: 'processed',
            processedAt: now,
            processedByUserId: adminUserId,
            providerTransferId: providerResult.providerTransferId,
            updatedAt: now,
          })
          .where(eq(schema.riderPayouts.id, payoutId))
          .returning();

        // Record debit transaction in financial ledger
        await this.recordTransaction(
          {
            transactionReference: `PAYOUT_${payout.id.substring(0, 8).toUpperCase()}`,
            entityType: 'rider',
            entityId: payout.riderId,
            entryType: 'rider_payout',
            direction: 'debit',
            amount: payout.amount,
            currency: payout.currency,
            idempotencyKey: `ledger_rider_payout_${payout.id}`,
            sourceReference: providerResult.providerTransferId || payout.id,
            metadata: {
              payoutId: payout.id,
              providerTransferId: providerResult.providerTransferId,
            },
          },
          tx,
        );

        this.logger.log(`Payout ${payoutId} successfully processed and recorded in ledger.`);
        return updatedPayout;
      });
    } else {
      const [failedPayout] = await this.db
        .update(schema.riderPayouts)
        .set({
          status: 'failed',
          failureReason: providerResult.failureReason || 'Disbursement provider failed',
          updatedAt: now,
        })
        .where(eq(schema.riderPayouts.id, payoutId))
        .returning();

      this.logger.warn(`Payout ${payoutId} failed: ${providerResult.failureReason}`);
      return failedPayout;
    }
  }

  /**
   * List rider payouts with pagination and status filters
   */
  async listRiderPayouts(query: AdminRiderPayoutQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.riderId) {
      conditions.push(eq(schema.riderPayouts.riderId, query.riderId));
    }
    if (query.status && query.status !== 'all') {
      conditions.push(eq(schema.riderPayouts.status, query.status as any));
    }
    if (query.from) {
      conditions.push(gte(schema.riderPayouts.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(schema.riderPayouts.createdAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.riderPayouts)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const items = await this.db
      .select({
        id: schema.riderPayouts.id,
        riderId: schema.riderPayouts.riderId,
        amount: schema.riderPayouts.amount,
        currency: schema.riderPayouts.currency,
        status: schema.riderPayouts.status,
        requestedAt: schema.riderPayouts.requestedAt,
        approvedAt: schema.riderPayouts.approvedAt,
        rejectedAt: schema.riderPayouts.rejectedAt,
        rejectionReason: schema.riderPayouts.rejectionReason,
        processedAt: schema.riderPayouts.processedAt,
        providerTransferId: schema.riderPayouts.providerTransferId,
        failureReason: schema.riderPayouts.failureReason,
        createdAt: schema.riderPayouts.createdAt,
      })
      .from(schema.riderPayouts)
      .where(whereClause)
      .orderBy(desc(schema.riderPayouts.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ==========================================
  // RESTAURANT SETTLEMENT MANAGEMENT
  // ==========================================

  /**
   * Calculate and generate periodic settlement for a restaurant.
   * Scans delivered orders within [periodStart, periodEnd] for the restaurant.
   * Net Payable = Gross Orders (itemTotal) - Commission - Refunds.
   */
  async generateRestaurantSettlement(adminUserId: string, dto: GenerateSettlementDto) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodStart > periodEnd) {
      throw new BadRequestException('periodStart cannot be after periodEnd');
    }

    // 1. Verify restaurant exists
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, dto.restaurantId));

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${dto.restaurantId} not found`);
    }

    // 2. Fetch delivered orders for the restaurant within the period (joining restaurant_outlets)
    const eligibleOrders = await this.db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        itemTotal: schema.orders.itemTotal,
        taxAmount: schema.orders.taxAmount,
        deliveredAt: schema.orders.deliveredAt,
      })
      .from(schema.orders)
      .innerJoin(
        schema.restaurantOutlets,
        eq(schema.orders.outletId, schema.restaurantOutlets.id),
      )
      .where(
        and(
          eq(schema.restaurantOutlets.restaurantId, dto.restaurantId),
          eq(schema.orders.status, 'delivered'),
          gte(schema.orders.deliveredAt, periodStart),
          lte(schema.orders.deliveredAt, periodEnd),
        ),
      );

    if (eligibleOrders.length === 0) {
      throw new BadRequestException(
        `No delivered orders found for restaurant ${dto.restaurantId} between ${dto.periodStart} and ${dto.periodEnd}`,
      );
    }

    // 3. Compute Gross item total and Tax
    let grossTotal = 0;
    let totalTax = 0;

    for (const ord of eligibleOrders) {
      grossTotal += parseFloat(ord.itemTotal || '0.00');
      totalTax += parseFloat(ord.taxAmount || '0.00');
    }

    // 4. Fetch refunded orders for this restaurant within the period (if any)
    const refundedPayments = await this.db
      .select({
        orderId: schema.payments.orderId,
        refundAmount: schema.refunds.amount,
      })
      .from(schema.refunds)
      .innerJoin(schema.payments, eq(schema.refunds.paymentId, schema.payments.id))
      .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
      .innerJoin(
        schema.restaurantOutlets,
        eq(schema.orders.outletId, schema.restaurantOutlets.id),
      )
      .where(
        and(
          eq(schema.restaurantOutlets.restaurantId, dto.restaurantId),
          eq(schema.refunds.status, 'processed'),
          gte(schema.refunds.createdAt, periodStart),
          lte(schema.refunds.createdAt, periodEnd),
        ),
      );

    let totalRefundDeductions = 0;
    for (const ref of refundedPayments) {
      totalRefundDeductions += parseFloat(ref.refundAmount || '0.00');
    }

    // Resolve active settings for restaurant commission basis and percentage
    const activeSettingsInfo = await this.settingsService.getActiveSettings();
    const commCalc = this.settingsService.calculateRestaurantCommission({
      settings: activeSettingsInfo.settings,
      itemTotal: grossTotal,
    });

    const commissionAmount = commCalc.totalCommission;

    // Net payable = Gross item total - Commission - Refund deductions
    const netPayable = Math.max(0, grossTotal - commissionAmount - totalRefundDeductions);

    const idempotencyKey = `rest_settlement_${dto.restaurantId}_${periodStart.getTime()}_${periodEnd.getTime()}`;

    // Prevent duplicate settlement for same restaurant & exact period
    const [existing] = await this.db
      .select()
      .from(schema.restaurantSettlements)
      .where(eq(schema.restaurantSettlements.idempotencyKey, idempotencyKey));

    if (existing) {
      throw new ConflictException(
        `A settlement for this restaurant for period ${dto.periodStart} to ${dto.periodEnd} already exists (ID: ${existing.id})`,
      );
    }

    const [settlement] = await this.db
      .insert(schema.restaurantSettlements)
      .values({
        restaurantId: dto.restaurantId,
        periodStart,
        periodEnd,
        grossOrderAmount: grossTotal.toFixed(2),
        commissionAmount: commissionAmount.toFixed(2),
        taxAmount: totalTax.toFixed(2),
        refundDeductions: totalRefundDeductions.toFixed(2),
        netPayableAmount: netPayable.toFixed(2),
        currency: 'INR',
        status: 'pending',
        settlementReference: `SETTLE_${restaurant.name.substring(0, 3).toUpperCase()}_${Date.now().toString().slice(-6)}`,
        idempotencyKey,
      })
      .returning();

    this.logger.log(
      `Restaurant settlement generated: ${settlement.id} for restaurant ${dto.restaurantId}. Gross: ₹${grossTotal.toFixed(2)}, Net: ₹${netPayable.toFixed(2)}`,
    );

    return settlement;
  }

  /**
   * Approve a pending restaurant settlement
   */
  async approveRestaurantSettlement(adminUserId: string, settlementId: string) {
    return await this.db.transaction(async (tx) => {
      const [settlement] = await tx
        .select()
        .from(schema.restaurantSettlements)
        .where(eq(schema.restaurantSettlements.id, settlementId))
        .for('update');

      if (!settlement) {
        throw new NotFoundException(`Settlement with ID ${settlementId} not found`);
      }

      if (settlement.status !== 'pending') {
        throw new BadRequestException(
          `Cannot approve settlement with status '${settlement.status}'. Status must be 'pending'.`,
        );
      }

      const now = new Date();
      const [updated] = await tx
        .update(schema.restaurantSettlements)
        .set({
          status: 'approved',
          approvedAt: now,
          approvedByUserId: adminUserId,
          updatedAt: now,
        })
        .where(eq(schema.restaurantSettlements.id, settlementId))
        .returning();

      return updated;
    });
  }

  /**
   * Process an approved restaurant settlement
   * Marks settlement as 'settled' and records debit in financial ledger
   */
  async processRestaurantSettlement(adminUserId: string, settlementId: string) {
    const [settlement] = await this.db
      .select()
      .from(schema.restaurantSettlements)
      .where(eq(schema.restaurantSettlements.id, settlementId));

    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${settlementId} not found`);
    }

    if (settlement.status !== 'approved') {
      throw new BadRequestException(
        `Cannot process settlement with status '${settlement.status}'. Settlement must be 'approved' first.`,
      );
    }

    // Execute disbursement via provider abstraction
    const providerResult = await this.payoutProvider.processPayout({
      payoutId: settlement.id,
      amount: settlement.netPayableAmount,
      currency: settlement.currency,
      beneficiaryId: settlement.restaurantId,
      beneficiaryType: 'restaurant',
      idempotencyKey: `disburse_rest_${settlement.id}`,
    });

    const now = new Date();

    if (providerResult.success) {
      return await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(schema.restaurantSettlements)
          .set({
            status: 'settled',
            settledAt: now,
            updatedAt: now,
          })
          .where(eq(schema.restaurantSettlements.id, settlementId))
          .returning();

        // Write ledger debit record
        await this.recordTransaction(
          {
            transactionReference: settlement.settlementReference || `SETTLE_${settlement.id.substring(0, 8)}`,
            entityType: 'restaurant',
            entityId: settlement.restaurantId,
            entryType: 'restaurant_settlement',
            direction: 'debit',
            amount: settlement.netPayableAmount,
            currency: settlement.currency,
            idempotencyKey: `ledger_rest_settlement_${settlement.id}`,
            sourceReference: providerResult.providerTransferId || settlement.id,
            metadata: {
              settlementId: settlement.id,
              grossAmount: settlement.grossOrderAmount,
              commission: settlement.commissionAmount,
              refunds: settlement.refundDeductions,
            },
          },
          tx,
        );

        return updated;
      });
    } else {
      const [failed] = await this.db
        .update(schema.restaurantSettlements)
        .set({
          status: 'failed',
          failureReason: providerResult.failureReason || 'Settlement transfer failed',
          updatedAt: now,
        })
        .where(eq(schema.restaurantSettlements.id, settlementId))
        .returning();

      return failed;
    }
  }

  /**
   * List restaurant settlements with pagination and status filters
   */
  async listRestaurantSettlements(query: AdminRestaurantSettlementQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.restaurantId) {
      conditions.push(eq(schema.restaurantSettlements.restaurantId, query.restaurantId));
    }
    if (query.status && query.status !== 'all') {
      conditions.push(eq(schema.restaurantSettlements.status, query.status as any));
    }
    if (query.from) {
      conditions.push(gte(schema.restaurantSettlements.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(schema.restaurantSettlements.createdAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.restaurantSettlements)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const items = await this.db
      .select({
        id: schema.restaurantSettlements.id,
        restaurantId: schema.restaurantSettlements.restaurantId,
        periodStart: schema.restaurantSettlements.periodStart,
        periodEnd: schema.restaurantSettlements.periodEnd,
        grossOrderAmount: schema.restaurantSettlements.grossOrderAmount,
        commissionAmount: schema.restaurantSettlements.commissionAmount,
        taxAmount: schema.restaurantSettlements.taxAmount,
        refundDeductions: schema.restaurantSettlements.refundDeductions,
        netPayableAmount: schema.restaurantSettlements.netPayableAmount,
        currency: schema.restaurantSettlements.currency,
        status: schema.restaurantSettlements.status,
        settlementReference: schema.restaurantSettlements.settlementReference,
        approvedAt: schema.restaurantSettlements.approvedAt,
        settledAt: schema.restaurantSettlements.settledAt,
        failureReason: schema.restaurantSettlements.failureReason,
        createdAt: schema.restaurantSettlements.createdAt,
      })
      .from(schema.restaurantSettlements)
      .where(whereClause)
      .orderBy(desc(schema.restaurantSettlements.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ==========================================
  // FINANCIAL OVERVIEW & RECONCILIATION
  // ==========================================

  /**
   * Consolidated financial dashboard overview:
   * Total customer payments captured, refunds processed, rider earnings & payouts,
   * restaurant payable and settled amounts, and net platform balance.
   */
  async getFinancialOverview() {
    // 1. Total payments captured
    const [paymentsResult] = await this.db
      .select({
        totalCaptured: sql<string>`coalesce(sum(amount), 0.00)::text`,
        totalRefunded: sql<string>`coalesce(sum(refund_amount), 0.00)::text`,
      })
      .from(schema.payments)
      .where(inArray(schema.payments.status, ['captured', 'refunded', 'partially_refunded']));

    // 2. Total rider earnings credited
    const [riderCreditsResult] = await this.db
      .select({
        totalRiderEarned: sql<string>`coalesce(sum(amount), 0.00)::text`,
      })
      .from(schema.financialLedger)
      .where(
        and(
          eq(schema.financialLedger.entityType, 'rider'),
          eq(schema.financialLedger.direction, 'credit'),
        ),
      );

    // 3. Total rider payouts disbursed
    const [riderPayoutsResult] = await this.db
      .select({
        totalRiderPaid: sql<string>`coalesce(sum(amount), 0.00)::text`,
      })
      .from(schema.riderPayouts)
      .where(eq(schema.riderPayouts.status, 'processed'));

    // 4. Total restaurant settlements settled
    const [settlementsResult] = await this.db
      .select({
        totalSettled: sql<string>`coalesce(sum(net_payable_amount), 0.00)::text`,
      })
      .from(schema.restaurantSettlements)
      .where(eq(schema.restaurantSettlements.status, 'settled'));

    const totalCaptured = parseFloat(paymentsResult?.totalCaptured || '0.00');
    const totalRefunded = parseFloat(paymentsResult?.totalRefunded || '0.00');
    const totalRiderEarned = parseFloat(riderCreditsResult?.totalRiderEarned || '0.00');
    const totalRiderPaid = parseFloat(riderPayoutsResult?.totalRiderPaid || '0.00');
    const totalRestaurantSettled = parseFloat(settlementsResult?.totalSettled || '0.00');

    // Pending rider liability = Total rider earned - Total rider paid
    const pendingRiderLiability = Math.max(0, totalRiderEarned - totalRiderPaid);

    // Net platform funds = Total captured - Total refunded - Total rider paid - Total restaurant settled
    const netPlatformFunds = totalCaptured - totalRefunded - totalRiderPaid - totalRestaurantSettled;

    return {
      currency: 'INR',
      customerCollections: {
        totalCaptured: totalCaptured.toFixed(2),
        totalRefunded: totalRefunded.toFixed(2),
        netCollections: (totalCaptured - totalRefunded).toFixed(2),
      },
      riderLiabilities: {
        totalEarned: totalRiderEarned.toFixed(2),
        totalDisbursed: totalRiderPaid.toFixed(2),
        pendingLiability: pendingRiderLiability.toFixed(2),
      },
      restaurantSettlements: {
        totalSettled: totalRestaurantSettled.toFixed(2),
      },
      platformNetBalance: netPlatformFunds.toFixed(2),
    };
  }

  /**
   * Run comprehensive financial integrity reconciliation:
   * 1. Detect order total vs captured payment mismatches
   * 2. Detect completed deliveries with missing rider earnings entries
   * 3. Detect failed payouts requiring administrative action
   */
  async runFinancialReconciliation() {
    // Check 1: Order total payable vs payment amount mismatch
    const orderMismatches = await this.db
      .select({
        orderId: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        orderTotal: schema.orders.totalPayable,
        paymentAmount: schema.payments.amount,
        paymentStatus: schema.payments.status,
      })
      .from(schema.orders)
      .innerJoin(schema.payments, eq(schema.orders.id, schema.payments.orderId))
      .where(
        and(
          eq(schema.payments.status, 'captured'),
          sql`${schema.orders.totalPayable} != ${schema.payments.amount}`,
        ),
      );

    // Check 2: Completed deliveries without rider earnings entry in ledger
    const missingEarningsDeliveries = await this.db
      .select({
        deliveryId: schema.deliveries.id,
        orderId: schema.deliveries.orderId,
        riderId: schema.deliveries.riderId,
        deliveredAt: schema.deliveries.deliveredAt,
      })
      .from(schema.deliveries)
      .where(
        and(
          eq(schema.deliveries.status, 'completed'),
          sql`NOT EXISTS (
            SELECT 1 FROM ${schema.financialLedger}
            WHERE ${schema.financialLedger.orderId} = ${schema.deliveries.orderId}
              AND ${schema.financialLedger.entryType} = 'rider_delivery_earning'
          )`,
        ),
      );

    // Check 3: Failed rider payouts
    const failedPayouts = await this.db
      .select({
        id: schema.riderPayouts.id,
        riderId: schema.riderPayouts.riderId,
        amount: schema.riderPayouts.amount,
        failureReason: schema.riderPayouts.failureReason,
        createdAt: schema.riderPayouts.createdAt,
      })
      .from(schema.riderPayouts)
      .where(eq(schema.riderPayouts.status, 'failed'));

    // Check 4: Failed restaurant settlements
    const failedSettlements = await this.db
      .select({
        id: schema.restaurantSettlements.id,
        restaurantId: schema.restaurantSettlements.restaurantId,
        amount: schema.restaurantSettlements.netPayableAmount,
        failureReason: schema.restaurantSettlements.failureReason,
        createdAt: schema.restaurantSettlements.createdAt,
      })
      .from(schema.restaurantSettlements)
      .where(eq(schema.restaurantSettlements.status, 'failed'));

    const isHealthy =
      orderMismatches.length === 0 &&
      missingEarningsDeliveries.length === 0 &&
      failedPayouts.length === 0 &&
      failedSettlements.length === 0;

    return {
      status: isHealthy ? 'healthy' : 'discrepancies_detected',
      checkedAt: new Date().toISOString(),
      orderPaymentMismatchesCount: orderMismatches.length,
      orderPaymentMismatches: orderMismatches,
      uncreditedDeliveriesCount: missingEarningsDeliveries.length,
      uncreditedDeliveries: missingEarningsDeliveries,
      failedPayoutsCount: failedPayouts.length,
      failedPayouts,
      failedSettlementsCount: failedSettlements.length,
      failedSettlements,
    };
  }
}
