import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { getIstMonthBoundaries, getIstHour } from '../common/utils/ist-date.util';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import {
  FinancialSettingsPayload,
  RiderDistanceSlab,
} from '../database/schema/financial-settings';
import {
  CreateFinancialSettingsDraftDto,
  UpdateFinancialSettingsDraftDto,
  PublishFinancialSettingsDto,
  PreviewCalculationDto,
  AdminSettingsHistoryQueryDto,
} from './dto/financial-settings.dto';

@Injectable()
export class FinancialSettingsService {
  private readonly logger = new Logger(FinancialSettingsService.name);

  // Fallback approved baseline defaults if no configuration has ever been published
  public static readonly DEFAULT_SETTINGS: FinancialSettingsPayload = {
    riderEarnings: {
      calculationStrategy: 'fixed_per_delivery',
      baseEarning: 30.0,
      additionalPerKmRate: 0,
      minDeliveryEarning: 30.0,
      maxDeliveryEarning: 200.0,
    },
    restaurantCommission: {
      commissionPercentage: 0.0, // Baseline: 0% until admin publishes approved rate
      fixedCommissionPerOrder: 0.0,
      commissionBasis: 'item_total',
    },
    customerDeliveryFee: {
      freeOrderThresholdCount: 3, // First 3 eligible orders free
      baseDeliveryFeeAfterFree: 30.0,
      minDeliveryFee: 0.0,
      maxDeliveryFee: 100.0,
      cancelledOrdersConsumeFreeQuota: false,
    },
    restaurantMonthlyCreditBlock: {
      monthlyDeliveriesQuota: 150, // 150 free deliveries per month
      additionalPerDeliveryFee: 25.0, // ₹25 per extra delivery
      billingPeriodMonths: 1,
    },
    incentives: {
      riderPromotionalBonus: 0.0,
      peakBonusFlat: 0.0,
    },
    deliveryServiceability: {
      maxRoadDistanceMeters: 3000,
      minDeliveryMinutes: 15,
      handlingMinutes: 10,
    },
  };

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ==========================================
  // SETTINGS RESOLUTION & ACTIVATION
  // ==========================================

  /**
   * Get the currently active financial configuration version.
   * If any scheduled versions have reached their effectiveFrom, promotes them automatically.
   * Accepts an optional transactional client and optional row-lock options to participate
   * in the caller's transaction boundary without publication races.
   */
  async getActiveSettings(
    client: any = this.db,
    options?: { lock?: 'for_share' | 'for_update' },
  ): Promise<{
    versionId: string;
    versionNumber: number;
    settings: FinancialSettingsPayload;
    effectiveFrom: Date | null;
    publishedAt: Date | null;
  }> {
    // 1. Check for scheduled versions ready to become active (only on pool connection to avoid nested txn issues)
    if (client === this.db) {
      await this.promoteDueScheduledSettings();
    }

    // 2. Fetch the active pointer from financial_settings using provided transactional client
    let pointerQuery = client
      .select()
      .from(schema.financialSettings)
      .where(eq(schema.financialSettings.id, 'global'));

    if (options?.lock === 'for_share' && client !== this.db && typeof pointerQuery.for === 'function') {
      pointerQuery = pointerQuery.for('share');
    } else if (options?.lock === 'for_update' && client !== this.db && typeof pointerQuery.for === 'function') {
      pointerQuery = pointerQuery.for('update');
    }

    const [pointer] = await pointerQuery;

    if (pointer && pointer.activeVersionId) {
      const [activeVersion] = await client
        .select()
        .from(schema.financialSettingsVersions)
        .where(eq(schema.financialSettingsVersions.id, pointer.activeVersionId));

      if (activeVersion && activeVersion.status === 'active') {
        return {
          versionId: activeVersion.id,
          versionNumber: activeVersion.versionNumber,
          settings: activeVersion.settingsPayload,
          effectiveFrom: activeVersion.effectiveFrom,
          publishedAt: activeVersion.publishedAt,
        };
      }
    }

    // Check if an active version exists directly
    const [directActive] = await client
      .select()
      .from(schema.financialSettingsVersions)
      .where(eq(schema.financialSettingsVersions.status, 'active'))
      .orderBy(desc(schema.financialSettingsVersions.versionNumber))
      .limit(1);

    if (directActive) {
      // Sync pointer
      await client
        .insert(schema.financialSettings)
        .values({
          id: 'global',
          activeVersionId: directActive.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.financialSettings.id],
          set: {
            activeVersionId: directActive.id,
            updatedAt: new Date(),
          },
        });

      return {
        versionId: directActive.id,
        versionNumber: directActive.versionNumber,
        settings: directActive.settingsPayload,
        effectiveFrom: directActive.effectiveFrom,
        publishedAt: directActive.publishedAt,
      };
    }

    // Return virtual default if no versions in database yet
    return {
      versionId: 'default-v0',
      versionNumber: 0,
      settings: FinancialSettingsService.DEFAULT_SETTINGS,
      effectiveFrom: null,
      publishedAt: null,
    };
  }

  /**
   * Promotes scheduled configurations whose effectiveFrom <= now() to 'active',
   * marking previous active versions as 'superseded'.
   */
  async promoteDueScheduledSettings(): Promise<number> {
    const now = new Date();

    const dueScheduled = await this.db
      .select()
      .from(schema.financialSettingsVersions)
      .where(
        and(
          eq(schema.financialSettingsVersions.status, 'scheduled'),
          lte(schema.financialSettingsVersions.effectiveFrom, now),
        ),
      )
      .orderBy(schema.financialSettingsVersions.effectiveFrom);

    if (dueScheduled.length === 0) {
      return 0;
    }

    let promotedCount = 0;
    for (const version of dueScheduled) {
      await this.db.transaction(async (tx) => {
        // Mark current active as superseded
        await tx
          .update(schema.financialSettingsVersions)
          .set({
            status: 'superseded',
            effectiveUntil: now,
            updatedAt: now,
          })
          .where(eq(schema.financialSettingsVersions.status, 'active'));

        // Promote scheduled to active
        await tx
          .update(schema.financialSettingsVersions)
          .set({
            status: 'active',
            updatedAt: now,
          })
          .where(eq(schema.financialSettingsVersions.id, version.id));

        // Update active pointer
        await tx
          .insert(schema.financialSettings)
          .values({
            id: 'global',
            activeVersionId: version.id,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.financialSettings.id],
            set: {
              activeVersionId: version.id,
              updatedAt: now,
            },
          });

        this.logger.log(`Promoted scheduled financial settings version ${version.versionNumber} to active`);
        promotedCount++;
      });
    }

    return promotedCount;
  }

  // ==========================================
  // DRAFT & PUBLISH LIFECYCLE
  // ==========================================

  /**
   * Create a new draft financial settings version.
   * Uses an atomic PostgreSQL transactional advisory lock to prevent version number race conditions.
   */
  async createDraftSettings(adminUserId: string, dto: CreateFinancialSettingsDraftDto) {
    this.validateSettingsPayload(dto.settingsPayload);

    return await this.db.transaction(async (tx) => {
      // 1. Acquire transactional advisory lock for financial settings versioning (magic key 420042)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(420042)`);

      // 2. Fetch current maximum version number inside the lock
      const [latest] = await tx
        .select({ maxVersion: sql<number>`coalesce(max(version_number), 0)::int` })
        .from(schema.financialSettingsVersions);

      const nextVersionNumber = (latest?.maxVersion ?? 0) + 1;

      const [draft] = await tx
        .insert(schema.financialSettingsVersions)
        .values({
          versionNumber: nextVersionNumber,
          status: 'draft',
          settingsPayload: dto.settingsPayload,
          changeReason: dto.changeReason,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          createdBy: adminUserId,
        })
        .returning();

      // Audit log
      await tx.insert(schema.auditLogs).values({
        action: 'financial_settings_draft_created',
        entityType: 'financial_settings_version',
        entityId: draft.id,
        performedByUserId: adminUserId,
        details: {
          versionNumber: nextVersionNumber,
          changeReason: dto.changeReason,
        },
      });

      this.logger.log(`Created draft financial settings version ${nextVersionNumber} (ID: ${draft.id})`);
      return draft;
    });
  }

  /**
   * Update an existing draft version. Published/active versions cannot be edited.
   */
  async updateDraftSettings(adminUserId: string, versionId: string, dto: UpdateFinancialSettingsDraftDto) {
    const [version] = await this.db
      .select()
      .from(schema.financialSettingsVersions)
      .where(eq(schema.financialSettingsVersions.id, versionId));

    if (!version) {
      throw new NotFoundException(`Settings version ${versionId} not found`);
    }

    if (version.status !== 'draft') {
      throw new BadRequestException(
        `Cannot edit version with status '${version.status}'. Only 'draft' versions can be modified.`,
      );
    }

    if (dto.settingsPayload) {
      this.validateSettingsPayload(dto.settingsPayload);
    }

    const now = new Date();
    const [updated] = await this.db
      .update(schema.financialSettingsVersions)
      .set({
        settingsPayload: dto.settingsPayload || version.settingsPayload,
        changeReason: dto.changeReason || version.changeReason,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : version.effectiveFrom,
        updatedAt: now,
      })
      .where(eq(schema.financialSettingsVersions.id, versionId))
      .returning();

    return updated;
  }

  /**
   * Publish or schedule a draft financial settings version.
   * If effectiveFrom is in the future, marks as 'scheduled'.
   * Otherwise, immediately promotes to 'active' and supersedes current active version.
   */
  async publishSettings(adminUserId: string, versionId: string, dto?: PublishFinancialSettingsDto) {
    return await this.db.transaction(async (tx) => {
      const [version] = await tx
        .select()
        .from(schema.financialSettingsVersions)
        .where(eq(schema.financialSettingsVersions.id, versionId))
        .for('update');

      if (!version) {
        throw new NotFoundException(`Settings version ${versionId} not found`);
      }

      if (version.status !== 'draft') {
        throw new BadRequestException(
          `Cannot publish version with status '${version.status}'. Only 'draft' versions can be published.`,
        );
      }

      const now = new Date();
      const effectiveFrom = dto?.effectiveFrom ? new Date(dto.effectiveFrom) : (version.effectiveFrom || now);

      const isFutureScheduled = effectiveFrom.getTime() > now.getTime();
      const targetStatus = isFutureScheduled ? 'scheduled' : 'active';

      if (!isFutureScheduled) {
        // Supersede existing active version
        await tx
          .update(schema.financialSettingsVersions)
          .set({
            status: 'superseded',
            effectiveUntil: now,
            updatedAt: now,
          })
          .where(eq(schema.financialSettingsVersions.status, 'active'));
      }

      // Update version to target status
      const [published] = await tx
        .update(schema.financialSettingsVersions)
        .set({
          status: targetStatus,
          effectiveFrom,
          approvedBy: adminUserId,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.financialSettingsVersions.id, versionId))
        .returning();

      if (!isFutureScheduled) {
        // Update global pointer
        await tx
          .insert(schema.financialSettings)
          .values({
            id: 'global',
            activeVersionId: published.id,
            updatedBy: adminUserId,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.financialSettings.id],
            set: {
              activeVersionId: published.id,
              updatedBy: adminUserId,
              updatedAt: now,
            },
          });
      }

      // Audit log
      await tx.insert(schema.auditLogs).values({
        action: isFutureScheduled ? 'financial_settings_scheduled' : 'financial_settings_published',
        entityType: 'financial_settings_version',
        entityId: published.id,
        performedByUserId: adminUserId,
        details: {
          versionNumber: published.versionNumber,
          targetStatus,
          effectiveFrom: effectiveFrom.toISOString(),
          notes: dto?.notes,
        },
      });

      this.logger.log(
        `Financial settings version ${published.versionNumber} ${targetStatus === 'active' ? 'activated' : 'scheduled for ' + effectiveFrom.toISOString()} by admin ${adminUserId}`,
      );

      return published;
    });
  }

  /**
   * Get version history with pagination and status filters
   */
  async getSettingsHistory(query: AdminSettingsHistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (query.status && query.status !== 'all') {
      conditions.push(eq(schema.financialSettingsVersions.status, query.status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.financialSettingsVersions)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const items = await this.db
      .select()
      .from(schema.financialSettingsVersions)
      .where(whereClause)
      .orderBy(desc(schema.financialSettingsVersions.versionNumber))
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
  // CALCULATION ENGINES
  // ==========================================

  /**
   * Calculate Rider Earning based on configured strategy
   */
  calculateRiderEarning(params: {
    settings: FinancialSettingsPayload;
    distanceMeters?: number | null;
    orderPlacedAt?: Date;
    waitingMinutes?: number;
  }): {
    baseFare: number;
    distanceUsedKm: number;
    distanceEarning: number;
    incentives: number;
    waitingTimeEarning: number;
    finalEarning: number;
    calculationBreakdown: Record<string, any>;
  } {
    const cfg = params.settings.riderEarnings;
    const distanceKm = params.distanceMeters ? Math.max(0, params.distanceMeters / 1000) : 0;
    let baseFare = cfg.baseEarning;
    let distanceEarning = 0;
    let incentives = 0;
    let waitingTimeEarning = 0;

    switch (cfg.calculationStrategy) {
      case 'fixed_per_delivery':
        baseFare = cfg.baseEarning;
        distanceEarning = 0;
        break;

      case 'distance_rate':
        baseFare = 0;
        distanceEarning = distanceKm * (cfg.additionalPerKmRate || 0);
        break;

      case 'base_plus_distance':
        baseFare = cfg.baseEarning;
        distanceEarning = distanceKm * (cfg.additionalPerKmRate || 0);
        break;

      case 'distance_slabs':
        baseFare = cfg.baseEarning;
        distanceEarning = this.computeDistanceSlabEarning(distanceKm, cfg.distanceSlabs || []);
        break;
    }

    // Peak hour multiplier/incentive (Calculated strictly in Asia/Kolkata IST)
    const orderHour = getIstHour(params.orderPlacedAt || new Date());
    const isPeak = cfg.peakHours?.some((p) => orderHour >= p.startHour && orderHour <= p.endHour);
    if (isPeak && cfg.peakHourMultiplier && cfg.peakHourMultiplier > 1) {
      const peakBonus = (baseFare + distanceEarning) * (cfg.peakHourMultiplier - 1);
      incentives += peakBonus;
    }

    // Promotional flat bonus from incentives payload
    if (params.settings.incentives?.riderPromotionalBonus) {
      incentives += params.settings.incentives.riderPromotionalBonus;
    }

    // Waiting time compensation
    if (params.waitingMinutes && cfg.waitingTimeRatePerMinute && params.waitingMinutes > 0) {
      waitingTimeEarning = params.waitingMinutes * cfg.waitingTimeRatePerMinute;
    }

    let rawTotal = baseFare + distanceEarning + incentives + waitingTimeEarning;

    // Apply min/max constraints
    if (cfg.minDeliveryEarning && rawTotal < cfg.minDeliveryEarning) {
      rawTotal = cfg.minDeliveryEarning;
    }
    if (cfg.maxDeliveryEarning && rawTotal > cfg.maxDeliveryEarning) {
      rawTotal = cfg.maxDeliveryEarning;
    }

    const finalEarning = Math.round(rawTotal * 100) / 100;

    return {
      baseFare: Math.round(baseFare * 100) / 100,
      distanceUsedKm: Math.round(distanceKm * 100) / 100,
      distanceEarning: Math.round(distanceEarning * 100) / 100,
      incentives: Math.round(incentives * 100) / 100,
      waitingTimeEarning: Math.round(waitingTimeEarning * 100) / 100,
      finalEarning,
      calculationBreakdown: {
        strategy: cfg.calculationStrategy,
        baseFare,
        distanceKm,
        distanceEarning,
        incentives,
        waitingTimeEarning,
        minEarningApplied: cfg.minDeliveryEarning && rawTotal === cfg.minDeliveryEarning,
        maxEarningApplied: cfg.maxDeliveryEarning && rawTotal === cfg.maxDeliveryEarning,
      },
    };
  }

  private computeDistanceSlabEarning(distanceKm: number, slabs: RiderDistanceSlab[]): number {
    if (!slabs || slabs.length === 0) return 0;
    const sorted = [...slabs].sort((a, b) => a.upToKm - b.upToKm);
    for (const slab of sorted) {
      if (distanceKm <= slab.upToKm) {
        return slab.rate;
      }
    }
    return sorted[sorted.length - 1].rate;
  }

  /**
   * Calculate Restaurant Commission on order
   */
  calculateRestaurantCommission(params: {
    settings: FinancialSettingsPayload;
    itemTotal: number;
    discountAmount?: number;
    totalPayable?: number;
  }): {
    commissionBasisAmount: number;
    commissionPercentage: number;
    commissionAmount: number;
    fixedCommission: number;
    totalCommission: number;
  } {
    const cfg = params.settings.restaurantCommission;
    let basisAmount = params.itemTotal;

    if (cfg.commissionBasis === 'item_total_minus_discounts') {
      basisAmount = Math.max(0, params.itemTotal - (params.discountAmount || 0));
    } else if (cfg.commissionBasis === 'total_payable') {
      basisAmount = params.totalPayable ?? params.itemTotal;
    }

    const percentageCommission = (basisAmount * cfg.commissionPercentage) / 100;
    const fixedCommission = cfg.fixedCommissionPerOrder || 0;
    const totalCommission = Math.round((percentageCommission + fixedCommission) * 100) / 100;

    return {
      commissionBasisAmount: Math.round(basisAmount * 100) / 100,
      commissionPercentage: cfg.commissionPercentage,
      commissionAmount: Math.round(percentageCommission * 100) / 100,
      fixedCommission: Math.round(fixedCommission * 100) / 100,
      totalCommission,
    };
  }

  /**
   * Calculate Customer Delivery Fee
   */
  calculateCustomerDeliveryFee(params: {
    settings: FinancialSettingsPayload;
    priorEligibleOrdersCount: number;
    distanceKm?: number;
  }): {
    isFreeDelivery: boolean;
    deliveryFee: number;
    reason: string;
  } {
    const cfg = params.settings.customerDeliveryFee;

    if (params.priorEligibleOrdersCount < cfg.freeOrderThresholdCount) {
      return {
        isFreeDelivery: true,
        deliveryFee: 0.0,
        reason: `Free delivery promotion applied (Order ${params.priorEligibleOrdersCount + 1} of ${cfg.freeOrderThresholdCount} free orders)`,
      };
    }

    let fee = cfg.baseDeliveryFeeAfterFree;
    if (cfg.additionalPerKmFee && params.distanceKm && params.distanceKm > 0) {
      fee += params.distanceKm * cfg.additionalPerKmFee;
    }

    if (cfg.minDeliveryFee !== undefined && fee < cfg.minDeliveryFee) {
      fee = cfg.minDeliveryFee;
    }
    if (cfg.maxDeliveryFee !== undefined && fee > cfg.maxDeliveryFee) {
      fee = cfg.maxDeliveryFee;
    }

    return {
      isFreeDelivery: false,
      deliveryFee: Math.round(fee * 100) / 100,
      reason: 'Standard customer delivery fee',
    };
  }

  // ==========================================
  // SIMULATION PREVIEW (NON-MUTATING)
  // ==========================================

  /**
   * Preview proposed settings without mutating database or ledger
   */
  async previewSettings(dto: PreviewCalculationDto) {
    this.validateSettingsPayload(dto.proposedSettings);

    const riderResult = dto.riderSample
      ? this.calculateRiderEarning({
          settings: dto.proposedSettings,
          distanceMeters: (dto.riderSample.distanceKm || 0) * 1000,
          orderPlacedAt: dto.riderSample.orderPlacedHour !== undefined
            ? new Date(new Date().setHours(dto.riderSample.orderPlacedHour))
            : new Date(),
          waitingMinutes: dto.riderSample.waitingMinutes,
        })
      : null;

    const restaurantResult = dto.restaurantSample
      ? this.calculateRestaurantCommission({
          settings: dto.proposedSettings,
          itemTotal: dto.restaurantSample.itemTotal || 0,
          discountAmount: dto.restaurantSample.discountAmount,
        })
      : null;

    const customerResult = dto.customerSample
      ? this.calculateCustomerDeliveryFee({
          settings: dto.proposedSettings,
          priorEligibleOrdersCount: dto.customerSample.customerPriorCompletedOrdersCount || 0,
          distanceKm: dto.customerSample.distanceKm,
        })
      : null;

    return {
      simulatedAt: new Date().toISOString(),
      riderCalculation: riderResult,
      restaurantCalculation: restaurantResult,
      customerCalculation: customerResult,
      notice: 'This is a simulation preview. No financial ledger entries or balance changes were executed.',
    };
  }

  // ==========================================
  // RESTAURANT MONTHLY DELIVERY CREDITS
  // ==========================================

  /**
   * Ensures restaurant has an active monthly credit block allocated for current YYYY-MM
   * Calculated in Indian Standard Time (Asia/Kolkata).
   */
  async getOrCreateMonthlyCreditBlock(restaurantId: string, customDate?: Date, txClient?: any) {
    const client = txClient || this.db;
    const targetDate = customDate || new Date();
    const { yearMonth, startUtc, endUtc } = getIstMonthBoundaries(targetDate);

    const [existing] = await client
      .select()
      .from(schema.restaurantMonthlyDeliveryCredits)
      .where(
        and(
          eq(schema.restaurantMonthlyDeliveryCredits.restaurantId, restaurantId),
          eq(schema.restaurantMonthlyDeliveryCredits.periodMonthYear, yearMonth),
        ),
      );

    if (existing) {
      return existing;
    }

    const { settings } = await this.getActiveSettings();
    const quota = settings.restaurantMonthlyCreditBlock.monthlyDeliveriesQuota;
    const additionalFee = settings.restaurantMonthlyCreditBlock.additionalPerDeliveryFee;

    const [created] = await client
      .insert(schema.restaurantMonthlyDeliveryCredits)
      .values({
        restaurantId,
        periodMonthYear: yearMonth,
        allocatedCredits: quota,
        usedCredits: 0,
        additionalDeliveriesCount: 0,
        additionalPerDeliveryFee: additionalFee.toFixed(2),
        periodStart: startUtc,
        periodEnd: endUtc,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      // Concurrently inserted by another transaction
      const [reFetched] = await client
        .select()
        .from(schema.restaurantMonthlyDeliveryCredits)
        .where(
          and(
            eq(schema.restaurantMonthlyDeliveryCredits.restaurantId, restaurantId),
            eq(schema.restaurantMonthlyDeliveryCredits.periodMonthYear, yearMonth),
          ),
        );
      return reFetched;
    }

    return created;
  }

  /**
   * Atomically consumes one delivery credit for a completed order.
   * If quota exhausted, increments additionalDeliveriesCount.
   * Idempotent per orderId.
   */
  async consumeRestaurantDeliveryCredit(restaurantId: string, orderId: string, txClient?: any) {
    const client = txClient || this.db;

    // Check if this delivery already consumed a credit (avoid double charge)
    const [existingLedger] = await client
      .select()
      .from(schema.financialLedger)
      .where(
        and(
          eq(schema.financialLedger.orderId, orderId),
          eq(schema.financialLedger.entryType, 'restaurant_commission_debit'),
          eq(schema.financialLedger.idempotencyKey, `rest_credit_consume_${orderId}`),
        ),
      );

    if (existingLedger) {
      this.logger.debug(`Delivery credit already recorded for order ${orderId}`);
      return { alreadyConsumed: true };
    }

    const now = new Date();
    const creditBlock = await this.getOrCreateMonthlyCreditBlock(restaurantId, now, client);

    // Lock credit block row FOR UPDATE
    const [lockedBlock] = await client
      .select()
      .from(schema.restaurantMonthlyDeliveryCredits)
      .where(eq(schema.restaurantMonthlyDeliveryCredits.id, creditBlock.id))
      .for('update');

    let isExtraChargeable = false;
    let newUsed = lockedBlock.usedCredits;
    let newExtra = lockedBlock.additionalDeliveriesCount;

    if (lockedBlock.usedCredits < lockedBlock.allocatedCredits) {
      newUsed += 1;
    } else {
      isExtraChargeable = true;
      newExtra += 1;
    }

    await client
      .update(schema.restaurantMonthlyDeliveryCredits)
      .set({
        usedCredits: newUsed,
        additionalDeliveriesCount: newExtra,
        updatedAt: now,
      })
      .where(eq(schema.restaurantMonthlyDeliveryCredits.id, lockedBlock.id));

    // If extra chargeable, record debit in financial ledger
    if (isExtraChargeable) {
      const extraFee = lockedBlock.additionalPerDeliveryFee;
      await client.insert(schema.financialLedger).values({
        transactionReference: `EXT_DEL_${orderId.substring(0, 8).toUpperCase()}`,
        entityType: 'restaurant',
        entityId: restaurantId,
        orderId,
        entryType: 'restaurant_commission_debit',
        direction: 'debit',
        amount: extraFee,
        currency: 'INR',
        idempotencyKey: `rest_credit_consume_${orderId}`,
        sourceReference: lockedBlock.id,
        metadata: {
          periodMonthYear: lockedBlock.periodMonthYear,
          additionalDeliveryIndex: newExtra,
          chargePerDelivery: extraFee,
        },
      });
    }

    return {
      periodMonthYear: lockedBlock.periodMonthYear,
      isExtraChargeable,
      usedCredits: newUsed,
      allocatedCredits: lockedBlock.allocatedCredits,
      remainingCredits: Math.max(0, lockedBlock.allocatedCredits - newUsed),
      additionalDeliveriesCount: newExtra,
    };
  }

  // ==========================================
  // VALIDATION HELPER
  // ==========================================

  private validateSettingsPayload(p: FinancialSettingsPayload) {
    if (!p.riderEarnings || !p.restaurantCommission || !p.customerDeliveryFee || !p.restaurantMonthlyCreditBlock) {
      throw new BadRequestException('Settings payload is missing one or more required configuration sections');
    }

    if (p.riderEarnings.baseEarning < 0) {
      throw new BadRequestException('Rider base earning cannot be negative');
    }

    if (p.restaurantCommission.commissionPercentage < 0 || p.restaurantCommission.commissionPercentage > 100) {
      throw new BadRequestException('Restaurant commission percentage must be between 0 and 100');
    }

    if (p.customerDeliveryFee.freeOrderThresholdCount < 0) {
      throw new BadRequestException('freeOrderThresholdCount cannot be negative');
    }

    if (p.restaurantMonthlyCreditBlock.monthlyDeliveriesQuota < 0) {
      throw new BadRequestException('monthlyDeliveriesQuota cannot be negative');
    }

    if (p.deliveryServiceability) {
      if (
        p.deliveryServiceability.maxRoadDistanceMeters === undefined ||
        p.deliveryServiceability.maxRoadDistanceMeters <= 0 ||
        !Number.isInteger(p.deliveryServiceability.maxRoadDistanceMeters)
      ) {
        throw new BadRequestException('maxRoadDistanceMeters must be a positive whole integer');
      }
    }
  }
}
