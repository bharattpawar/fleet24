import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq, notInArray, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { computeCouponDiscount } from '../common/utils/discounts';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

type Promotion = typeof schema.promotions.$inferSelect;

/** Orders in these states give the coupon back to the customer. */
const RELEASED_ORDER_STATUSES = ['cancelled', 'rejected'] as const;

export interface CouponEvaluation {
  promotionId: string;
  code: string;
  description: string | null;
  applied: boolean;
  discountAmount: number;
  /** Why the coupon does not apply right now (null when applied). */
  message: string | null;
}

const normalizeCode = (code: string) => code.trim().toUpperCase();

@Injectable()
export class PromotionsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ---------- admin ----------

  async listAll() {
    const rows = await this.db.select().from(schema.promotions).orderBy(desc(schema.promotions.createdAt));
    const usage = await this.db
      .select({ promotionId: schema.promotionRedemptions.promotionId, count: sql<number>`count(*)::int` })
      .from(schema.promotionRedemptions)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.promotionRedemptions.orderId))
      .where(notInArray(schema.orders.status, [...RELEASED_ORDER_STATUSES]))
      .groupBy(schema.promotionRedemptions.promotionId);
    const used = new Map(usage.map((u) => [u.promotionId, u.count]));
    return rows.map((row) => ({ ...row, timesUsed: used.get(row.id) ?? 0 }));
  }

  async create(dto: CreatePromotionDto) {
    this.assertRules(dto);
    const code = normalizeCode(dto.code);
    const existing = await this.db.query.promotions.findFirst({ where: eq(schema.promotions.code, code) });
    if (existing) throw new ConflictException(`Coupon code ${code} already exists.`);
    const [row] = await this.db
      .insert(schema.promotions)
      .values({
        code,
        description: dto.description?.trim() || null,
        discountType: dto.discountType,
        discountValue: dto.discountValue.toFixed(2),
        minOrderAmount: (dto.minOrderAmount ?? 0).toFixed(2),
        maxDiscountAmount: dto.maxDiscountAmount != null ? dto.maxDiscountAmount.toFixed(2) : null,
        usageLimitPerUser: dto.usageLimitPerUser ?? 1,
        totalUsageLimit: dto.totalUsageLimit ?? null,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        isActive: dto.isActive ?? true,
      })
      .returning();
    return row;
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const current = await this.db.query.promotions.findFirst({ where: eq(schema.promotions.id, id) });
    if (!current) throw new NotFoundException('Coupon not found.');
    this.assertRules({
      discountType: dto.discountType ?? current.discountType,
      discountValue: dto.discountValue ?? Number(current.discountValue),
      validFrom: dto.validFrom ?? current.validFrom.toISOString(),
      validUntil: dto.validUntil ?? current.validUntil.toISOString(),
    });
    const [row] = await this.db
      .update(schema.promotions)
      .set({
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.discountType ? { discountType: dto.discountType } : {}),
        ...(dto.discountValue !== undefined ? { discountValue: dto.discountValue.toFixed(2) } : {}),
        ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount.toFixed(2) } : {}),
        ...(dto.maxDiscountAmount !== undefined
          ? { maxDiscountAmount: dto.maxDiscountAmount === null ? null : dto.maxDiscountAmount.toFixed(2) }
          : {}),
        ...(dto.usageLimitPerUser !== undefined ? { usageLimitPerUser: dto.usageLimitPerUser } : {}),
        ...(dto.totalUsageLimit !== undefined ? { totalUsageLimit: dto.totalUsageLimit } : {}),
        ...(dto.validFrom ? { validFrom: new Date(dto.validFrom) } : {}),
        ...(dto.validUntil ? { validUntil: new Date(dto.validUntil) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.promotions.id, id))
      .returning();
    return row;
  }

  private assertRules(rules: { discountType: string; discountValue: number; validFrom: string; validUntil: string }) {
    if (rules.discountType === 'percentage' && rules.discountValue > 100) {
      throw new BadRequestException('A percentage coupon cannot be more than 100%.');
    }
    if (new Date(rules.validUntil).getTime() <= new Date(rules.validFrom).getTime()) {
      throw new BadRequestException('Valid until must be after valid from.');
    }
  }

  // ---------- customer ----------

  async findByCode(code: string, client: any = this.db): Promise<Promotion | null> {
    const row = await client.query.promotions.findFirst({
      where: eq(schema.promotions.code, normalizeCode(code)),
    });
    return row ?? null;
  }

  /**
   * Checks a coupon for this customer and food total: active, in date, under its usage limits and
   * minimum order. Pass `lock` inside the checkout transaction so two orders cannot overrun a limit.
   */
  async evaluate(params: {
    promotionId: string;
    customerId: string;
    itemTotal: number;
    client?: any;
    lock?: boolean;
    now?: Date;
  }): Promise<CouponEvaluation | null> {
    const client = params.client ?? this.db;
    const query = client.select().from(schema.promotions).where(eq(schema.promotions.id, params.promotionId));
    const [promo]: Promotion[] = params.lock ? await query.for('update') : await query;
    if (!promo) return null;

    const result = (applied: boolean, discountAmount: number, message: string | null): CouponEvaluation => ({
      promotionId: promo.id,
      code: promo.code,
      description: promo.description,
      applied,
      discountAmount,
      message,
    });

    const now = params.now ?? new Date();
    if (!promo.isActive) return result(false, 0, 'This coupon is no longer available.');
    if (now < promo.validFrom) return result(false, 0, 'This coupon is not active yet.');
    if (now > promo.validUntil) return result(false, 0, 'This coupon has expired.');

    const counts = await client
      .select({
        total: sql<number>`count(*)::int`,
        mine: sql<number>`count(*) filter (where ${schema.promotionRedemptions.userId} = ${params.customerId})::int`,
      })
      .from(schema.promotionRedemptions)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.promotionRedemptions.orderId))
      .where(
        and(
          eq(schema.promotionRedemptions.promotionId, promo.id),
          notInArray(schema.orders.status, [...RELEASED_ORDER_STATUSES]),
        ),
      );
    const total = counts[0]?.total ?? 0;
    const mine = counts[0]?.mine ?? 0;
    if (promo.totalUsageLimit != null && total >= promo.totalUsageLimit) {
      return result(false, 0, 'This coupon has been fully used.');
    }
    if (mine >= promo.usageLimitPerUser) {
      return result(false, 0, 'You have already used this coupon.');
    }

    const { discountAmount, reason } = computeCouponDiscount(promo, params.itemTotal);
    return reason ? result(false, 0, reason) : result(true, discountAmount, null);
  }

  /** Records that an order used the coupon. Call inside the checkout transaction. */
  async recordRedemption(
    client: any,
    params: { promotionId: string; customerId: string; orderId: string; discountAmount: number },
  ) {
    await client.insert(schema.promotionRedemptions).values({
      promotionId: params.promotionId,
      userId: params.customerId,
      orderId: params.orderId,
      discountAmount: params.discountAmount.toFixed(2),
    });
    await client
      .update(schema.promotions)
      .set({ timesUsed: sql`${schema.promotions.timesUsed} + 1`, updatedAt: new Date() })
      .where(eq(schema.promotions.id, params.promotionId));
  }
}
