import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { sql, and, gte, lt, eq, ilike, or, desc, asc } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import {
  AdminCustomerQueryDto,
  BlockCustomerDto,
  AdminRestaurantApplicationQueryDto,
  AdminVerifyRestaurantDto,
  AdminSuspendRestaurantDto,
  AdminUploadDocumentDto,
  AdminVerifyDocumentDto,
  AdminUpdateOutletOperationsDto,
} from './dto/admin-management.dto';

@Injectable()
export class AdminManagementService {
  private readonly logger = new Logger(AdminManagementService.name);

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: any,
  ) {}

  // =========================================================================
  // CUSTOMER MANAGEMENT
  // =========================================================================

  /**
   * List customers with pagination, filtering, search, and order aggregations.
   */
  async listCustomers(query: AdminCustomerQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(schema.userRoles.role, 'customer')];

    // Status filter
    if (query.status === 'active') {
      conditions.push(eq(schema.users.isActive, true));
    } else if (query.status === 'blocked') {
      conditions.push(eq(schema.users.isActive, false));
    }

    // Search filter
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.users.fullName, s),
          ilike(schema.users.phone, s),
          ilike(schema.users.email, s),
        ),
      );
    }

    // Date range filter
    if (query.from) {
      conditions.push(gte(schema.users.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lt(schema.users.createdAt, new Date(query.to)));
    }

    // Determine sort
    const orderByClause =
      query.sortBy === 'order_count'
        ? query.sortOrder === 'asc'
          ? asc(sql`count(${schema.orders.id})`)
          : desc(sql`count(${schema.orders.id})`)
        : query.sortOrder === 'asc'
        ? asc(schema.users.createdAt)
        : desc(schema.users.createdAt);

    // Main query
    const rows = await this.db
      .select({
        id: schema.users.id,
        fullName: schema.users.fullName,
        phone: schema.users.phone,
        email: schema.users.email,
        isActive: schema.users.isActive,
        blockedReason: schema.users.blockedReason,
        blockedAt: schema.users.blockedAt,
        createdAt: schema.users.createdAt,
        totalOrders: sql<number>`count(${schema.orders.id})::int`,
        completedOrders: sql<number>`count(${schema.orders.id}) filter (where ${schema.orders.status} = 'delivered')::int`,
        totalSpent: sql<string>`coalesce(sum(${schema.orders.totalPayable}) filter (where ${schema.orders.status} = 'delivered'), 0)::text`,
      })
      .from(schema.users)
      .innerJoin(schema.userRoles, eq(schema.users.id, schema.userRoles.userId))
      .leftJoin(schema.orders, eq(schema.users.id, schema.orders.customerId))
      .where(and(...conditions))
      .groupBy(schema.users.id)
      .orderBy(orderByClause, desc(schema.users.id))
      .limit(limit)
      .offset(offset);

    // Count query
    const [countRow] = await this.db
      .select({ count: sql<number>`count(distinct ${schema.users.id})::int` })
      .from(schema.users)
      .innerJoin(schema.userRoles, eq(schema.users.id, schema.userRoles.userId))
      .where(and(...conditions));

    const total = countRow?.count || 0;

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: rows.map((r: any) => ({
        id: r.id,
        fullName: r.fullName,
        phone: r.phone,
        email: r.email,
        isActive: r.isActive,
        accountStatus: r.isActive ? 'active' : 'blocked',
        blockedReason: r.blockedReason,
        blockedAt: r.blockedAt,
        createdAt: r.createdAt,
        totalOrders: r.totalOrders || 0,
        completedOrders: r.completedOrders || 0,
        totalSpentAmount: parseFloat(r.totalSpent || '0'),
      })),
    };
  }

  /**
   * Get comprehensive customer details, order history, payment history, and refund summary.
   */
  async getCustomerDetails(customerId: string) {
    const customer = await this.db.query.users.findFirst({
      where: eq(schema.users.id, customerId),
      with: {
        roles: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found.`);
    }

    const hasCustomerRole = customer.roles.some((r: any) => r.role === 'customer');
    if (!hasCustomerRole) {
      throw new NotFoundException(`User ${customerId} is not registered as a customer.`);
    }

    // Orders summary
    const [orderSummary] = await this.db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        completedOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'delivered')::int`,
        cancelledOrders: sql<number>`count(*) filter (where ${schema.orders.status} = 'cancelled')::int`,
        totalSpent: sql<string>`coalesce(sum(${schema.orders.totalPayable}) filter (where ${schema.orders.status} = 'delivered'), 0)::text`,
      })
      .from(schema.orders)
      .where(eq(schema.orders.customerId, customerId));

    // Recent 10 orders
    const recentOrders = await this.db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        status: schema.orders.status,
        totalPayable: schema.orders.totalPayable,
        createdAt: schema.orders.createdAt,
      })
      .from(schema.orders)
      .where(eq(schema.orders.customerId, customerId))
      .orderBy(desc(schema.orders.createdAt))
      .limit(10);

    // Payments & refunds summary
    const [financialSummary] = await this.db
      .select({
        capturedPayments: sql<string>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.status} in ('captured', 'refunded', 'partially_refunded')), 0)::text`,
        processedRefunds: sql<string>`coalesce(sum(${schema.refunds.amount}) filter (where ${schema.refunds.status} = 'processed'), 0)::text`,
      })
      .from(schema.orders)
      .leftJoin(schema.payments, eq(schema.orders.id, schema.payments.orderId))
      .leftJoin(schema.refunds, eq(schema.payments.id, schema.refunds.paymentId))
      .where(eq(schema.orders.customerId, customerId));

    return {
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        isActive: customer.isActive,
        accountStatus: customer.isActive ? 'active' : 'blocked',
        blockedReason: customer.blockedReason,
        blockedAt: customer.blockedAt,
        createdAt: customer.createdAt,
      },
      orderSummary: {
        totalOrders: orderSummary?.totalOrders || 0,
        completedOrders: orderSummary?.completedOrders || 0,
        cancelledOrders: orderSummary?.cancelledOrders || 0,
        totalSpentAmount: parseFloat(orderSummary?.totalSpent || '0'),
      },
      financialSummary: {
        capturedAmount: parseFloat(financialSummary?.capturedPayments || '0'),
        refundedAmount: parseFloat(financialSummary?.processedRefunds || '0'),
      },
      recentOrders,
    };
  }

  /**
   * Block a customer account with reason and administrative audit.
   */
  async blockCustomer(adminUserId: string, customerId: string, dto: BlockCustomerDto) {
    if (adminUserId === customerId) {
      throw new BadRequestException('Administrators cannot block their own administrative accounts.');
    }

    const customer = await this.db.query.users.findFirst({
      where: eq(schema.users.id, customerId),
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found.`);
    }

    const now = new Date();

    await this.db
      .update(schema.users)
      .set({
        isActive: false,
        blockedReason: dto.reason,
        blockedAt: now,
        blockedBy: adminUserId,
        updatedAt: now,
      })
      .where(eq(schema.users.id, customerId));

    // Audit log
    await this.db.insert(schema.auditLogs).values({
      action: 'customer_blocked',
      entityType: 'user',
      entityId: customerId,
      performedByUserId: adminUserId,
      details: {
        reason: dto.reason,
        previousState: customer.isActive,
      },
    });

    this.logger.log(`Admin ${adminUserId} blocked customer ${customerId}. Reason: ${dto.reason}`);

    return {
      id: customerId,
      isActive: false,
      accountStatus: 'blocked',
      blockedReason: dto.reason,
      blockedAt: now.toISOString(),
      message: 'Customer account has been blocked successfully.',
    };
  }

  /**
   * Unblock a customer account.
   */
  async unblockCustomer(adminUserId: string, customerId: string) {
    const customer = await this.db.query.users.findFirst({
      where: eq(schema.users.id, customerId),
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found.`);
    }

    const now = new Date();

    await this.db
      .update(schema.users)
      .set({
        isActive: true,
        blockedReason: null,
        blockedAt: null,
        blockedBy: null,
        updatedAt: now,
      })
      .where(eq(schema.users.id, customerId));

    // Audit log
    await this.db.insert(schema.auditLogs).values({
      action: 'customer_unblocked',
      entityType: 'user',
      entityId: customerId,
      performedByUserId: adminUserId,
      details: {
        previousBlockedReason: customer.blockedReason,
      },
    });

    this.logger.log(`Admin ${adminUserId} unblocked customer ${customerId}`);

    return {
      id: customerId,
      isActive: true,
      accountStatus: 'active',
      message: 'Customer account has been unblocked successfully.',
    };
  }

  // =========================================================================
  // RESTAURANT APPLICATION & VERIFICATION MANAGEMENT
  // =========================================================================

  /**
   * List restaurant onboarding applications with status filters and owner details.
   */
  async listRestaurantApplications(query: AdminRestaurantApplicationQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.verificationStatus && query.verificationStatus !== 'all') {
      conditions.push(eq(schema.restaurants.verificationStatus, query.verificationStatus as any));
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.restaurants.name, s),
          ilike(schema.restaurants.slug, s),
        ),
      );
    }

    if (query.from) {
      conditions.push(gte(schema.restaurants.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lt(schema.restaurants.createdAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        id: schema.restaurants.id,
        name: schema.restaurants.name,
        slug: schema.restaurants.slug,
        verificationStatus: schema.restaurants.verificationStatus,
        isActive: schema.restaurants.isActive,
        createdAt: schema.restaurants.createdAt,
        ownerId: schema.restaurants.ownerId,
        ownerName: schema.users.fullName,
        ownerPhone: schema.users.phone,
        ownerEmail: schema.users.email,
        outletCount: sql<number>`count(distinct ${schema.restaurantOutlets.id})::int`,
        documentCount: sql<number>`count(distinct ${schema.restaurantDocuments.id})::int`,
      })
      .from(schema.restaurants)
      .leftJoin(schema.users, eq(schema.restaurants.ownerId, schema.users.id))
      .leftJoin(schema.restaurantOutlets, eq(schema.restaurants.id, schema.restaurantOutlets.restaurantId))
      .leftJoin(schema.restaurantDocuments, eq(schema.restaurants.id, schema.restaurantDocuments.restaurantId))
      .where(whereClause)
      .groupBy(schema.restaurants.id, schema.users.id)
      .orderBy(desc(schema.restaurants.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.restaurants)
      .where(whereClause);

    const total = countRow?.count || 0;

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        verificationStatus: r.verificationStatus,
        isActive: r.isActive,
        createdAt: r.createdAt,
        owner: r.ownerId
          ? {
              id: r.ownerId,
              fullName: r.ownerName,
              phone: r.ownerPhone,
              email: r.email,
            }
          : null,
        outletCount: r.outletCount || 0,
        documentCount: r.documentCount || 0,
      })),
    };
  }

  /**
   * Get restaurant application details with submitted documents and outlets.
   */
  async getRestaurantApplicationDetails(restaurantId: string) {
    const restaurant = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, restaurantId),
      with: {
        owner: true,
        outlets: true,
        documents: true,
        application: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant application with ID ${restaurantId} not found.`);
    }

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description,
        logoUrl: restaurant.logoUrl,
        verificationStatus: restaurant.verificationStatus,
        rejectionReason: restaurant.rejectionReason,
        suspensionReason: restaurant.suspensionReason,
        verifiedAt: restaurant.verifiedAt,
        isActive: restaurant.isActive,
        createdAt: restaurant.createdAt,
      },
      owner: restaurant.owner
        ? {
            id: restaurant.owner.id,
            fullName: restaurant.owner.fullName,
            phone: restaurant.owner.phone,
            email: restaurant.owner.email,
          }
        : null,
      outlets: restaurant.outlets,
      documents: restaurant.documents,
      // Self-registration details to verify (null for restaurants set up by admin).
      application: restaurant.application
        ? {
            ownerName: restaurant.application.ownerName,
            ownerEmail: restaurant.application.ownerEmail,
            contactPhone: restaurant.application.contactPhone,
            cuisines: restaurant.application.cuisines,
            fssaiNumber: restaurant.application.fssaiNumber,
            fssaiExpiry: restaurant.application.fssaiExpiry,
            panNumber: restaurant.application.panNumber,
            gstin: restaurant.application.gstin,
            bankAccountHolder: restaurant.application.bankAccountHolder,
            bankAccountNumber: restaurant.application.bankAccountNumber,
            bankIfsc: restaurant.application.bankIfsc,
            submittedAt: restaurant.application.submittedAt,
          }
        : null,
    };
  }

  /**
   * Approve or reject a restaurant onboarding application.
   */
  async verifyRestaurant(
    adminUserId: string,
    restaurantId: string,
    dto: AdminVerifyRestaurantDto,
  ) {
    const restaurant = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, restaurantId),
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found.`);
    }

    if (dto.verificationStatus === 'rejected' && (!dto.rejectionReason || !dto.rejectionReason.trim())) {
      throw new BadRequestException('A non-empty rejectionReason is required when rejecting a restaurant.');
    }

    const now = new Date();

    if (dto.verificationStatus === 'approved') {
      await this.db
        .update(schema.restaurants)
        .set({
          verificationStatus: 'approved',
          rejectionReason: null,
          verifiedAt: now,
          verifiedBy: adminUserId,
          isActive: true,
          updatedAt: now,
        })
        .where(eq(schema.restaurants.id, restaurantId));
    } else {
      await this.db
        .update(schema.restaurants)
        .set({
          verificationStatus: 'rejected',
          rejectionReason: dto.rejectionReason,
          verifiedAt: now,
          verifiedBy: adminUserId,
          isActive: false,
          updatedAt: now,
        })
        .where(eq(schema.restaurants.id, restaurantId));
    }

    // Audit log
    await this.db.insert(schema.auditLogs).values({
      action: `restaurant_${dto.verificationStatus}`,
      entityType: 'restaurant',
      entityId: restaurantId,
      performedByUserId: adminUserId,
      details: {
        verificationStatus: dto.verificationStatus,
        rejectionReason: dto.rejectionReason || null,
      },
    });

    this.logger.log(`Admin ${adminUserId} set restaurant ${restaurantId} status to ${dto.verificationStatus}`);

    return {
      id: restaurantId,
      verificationStatus: dto.verificationStatus,
      rejectionReason: dto.rejectionReason || null,
      verifiedAt: now.toISOString(),
      message: `Restaurant has been ${dto.verificationStatus} successfully.`,
    };
  }

  /**
   * Suspend restaurant and prevent all its outlets from accepting orders.
   */
  async suspendRestaurant(
    adminUserId: string,
    restaurantId: string,
    dto: AdminSuspendRestaurantDto,
  ) {
    const restaurant = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, restaurantId),
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found.`);
    }

    const now = new Date();

    // Suspend restaurant
    await this.db
      .update(schema.restaurants)
      .set({
        verificationStatus: 'suspended',
        suspensionReason: dto.suspensionReason,
        isActive: false,
        updatedAt: now,
      })
      .where(eq(schema.restaurants.id, restaurantId));

    // Disable order acceptance on all associated outlets
    await this.db
      .update(schema.restaurantOutlets)
      .set({
        isAcceptingOrders: false,
        updatedAt: now,
      })
      .where(eq(schema.restaurantOutlets.restaurantId, restaurantId));

    // Audit log
    await this.db.insert(schema.auditLogs).values({
      action: 'restaurant_suspended',
      entityType: 'restaurant',
      entityId: restaurantId,
      performedByUserId: adminUserId,
      details: {
        suspensionReason: dto.suspensionReason,
      },
    });

    this.logger.log(`Admin ${adminUserId} suspended restaurant ${restaurantId}. Reason: ${dto.suspensionReason}`);

    return {
      id: restaurantId,
      verificationStatus: 'suspended',
      suspensionReason: dto.suspensionReason,
      message: 'Restaurant suspended and all associated outlets deactivated from accepting orders.',
    };
  }

  /**
   * Unsuspend / reinstate restaurant.
   */
  async unsuspendRestaurant(adminUserId: string, restaurantId: string) {
    const restaurant = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, restaurantId),
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found.`);
    }

    const now = new Date();

    await this.db
      .update(schema.restaurants)
      .set({
        verificationStatus: 'approved',
        suspensionReason: null,
        isActive: true,
        updatedAt: now,
      })
      .where(eq(schema.restaurants.id, restaurantId));

    // Audit log
    await this.db.insert(schema.auditLogs).values({
      action: 'restaurant_unsuspended',
      entityType: 'restaurant',
      entityId: restaurantId,
      performedByUserId: adminUserId,
      details: {
        previousSuspensionReason: restaurant.suspensionReason,
      },
    });

    this.logger.log(`Admin ${adminUserId} unsuspended restaurant ${restaurantId}`);

    return {
      id: restaurantId,
      verificationStatus: 'approved',
      isActive: true,
      message: 'Restaurant reinstated successfully.',
    };
  }

  // =========================================================================
  // OUTLET OPERATIONAL MANAGEMENT
  // =========================================================================

  /**
   * View outlets for a specific restaurant.
   */
  async listRestaurantOutlets(restaurantId: string) {
    const restaurant = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, restaurantId),
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found.`);
    }

    return this.db.query.restaurantOutlets.findMany({
      where: eq(schema.restaurantOutlets.restaurantId, restaurantId),
      orderBy: [desc(schema.restaurantOutlets.createdAt)],
    });
  }

  /**
   * Admin control for activating, deactivating, or setting order acceptance on an outlet.
   */
  async updateOutletOperations(
    adminUserId: string,
    outletId: string,
    dto: AdminUpdateOutletOperationsDto,
  ) {
    const outlet = await this.db.query.restaurantOutlets.findFirst({
      where: eq(schema.restaurantOutlets.id, outletId),
      with: {
        restaurant: true,
      },
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet with ID ${outletId} not found.`);
    }

    // If parent restaurant is suspended, prevent opening order acceptance
    if (outlet.restaurant.verificationStatus === 'suspended' && dto.isAcceptingOrders === true) {
      throw new BadRequestException(
        'Cannot enable order acceptance on outlet while parent restaurant is suspended.',
      );
    }

    const updates: any = { updatedAt: new Date() };
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.isAcceptingOrders !== undefined) updates.isAcceptingOrders = dto.isAcceptingOrders;

    const [updatedOutlet] = await this.db
      .update(schema.restaurantOutlets)
      .set(updates)
      .where(eq(schema.restaurantOutlets.id, outletId))
      .returning();

    // Audit log
    await this.db.insert(schema.auditLogs).values({
      action: 'outlet_operations_updated',
      entityType: 'outlet',
      entityId: outletId,
      performedByUserId: adminUserId,
      details: dto,
    });

    return updatedOutlet;
  }

  // =========================================================================
  // DOCUMENT MANAGEMENT
  // =========================================================================

  /**
   * Attach verification document metadata to a restaurant.
   */
  async uploadDocument(
    adminUserId: string,
    restaurantId: string,
    dto: AdminUploadDocumentDto,
  ) {
    const restaurant = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, restaurantId),
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found.`);
    }

    const [doc] = await this.db
      .insert(schema.restaurantDocuments)
      .values({
        restaurantId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber || null,
        documentUrl: dto.documentUrl,
        storageProvider: 's3_compatible',
        storageKey: dto.storageKey || null,
        verificationStatus: 'pending',
        notes: dto.notes || null,
      })
      .returning();

    return doc;
  }

  /**
   * Verify or reject a restaurant document.
   */
  async verifyDocument(
    adminUserId: string,
    documentId: string,
    dto: AdminVerifyDocumentDto,
  ) {
    const doc = await this.db.query.restaurantDocuments.findFirst({
      where: eq(schema.restaurantDocuments.id, documentId),
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID ${documentId} not found.`);
    }

    const [updated] = await this.db
      .update(schema.restaurantDocuments)
      .set({
        verificationStatus: dto.status,
        notes: dto.notes || doc.notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.restaurantDocuments.id, documentId))
      .returning();

    return updated;
  }
}
