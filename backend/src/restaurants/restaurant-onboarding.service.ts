import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomBytes } from 'crypto';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { RestaurantApplicationStatus, SubmitRestaurantApplicationDto } from './dto/restaurant-onboarding.dto';

type Db = NodePgDatabase<typeof schema>;

/** "+919876543210" for a 10-digit or +91 number. */
function toE164India(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `+91${digits.slice(-10)}`;
}

function slugFor(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'restaurant';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

function maskAccount(accountNumber: string): string {
  return accountNumber.length <= 4 ? accountNumber : `••••${accountNumber.slice(-4)}`;
}

/**
 * Restaurant self-registration from the restaurant app.
 * A submission creates the restaurant hidden from customers (isActive=false, pending), its first outlet,
 * links the applicant as the outlet's owner and gives them the restaurant_staff role. Admin approval
 * (AdminManagementService.verifyRestaurant) makes it live.
 */
@Injectable()
export class RestaurantOnboardingService {
  private readonly logger = new Logger(RestaurantOnboardingService.name);

  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: Db) {}

  /** The signed-in user's restaurant, if any: one they own, else one they are staff of. */
  private async findMyRestaurant(userId: string) {
    const owned = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.ownerId, userId),
      with: { application: true, outlets: true },
    });
    if (owned) return owned;

    const assignment = await this.db.query.restaurantStaff.findFirst({
      where: and(eq(schema.restaurantStaff.userId, userId), eq(schema.restaurantStaff.isActive, true)),
      with: { outlet: { with: { restaurant: { with: { application: true, outlets: true } } } } },
    });
    return assignment?.outlet?.restaurant ?? null;
  }

  async getMyApplication(userId: string) {
    const restaurant = await this.findMyRestaurant(userId);
    if (!restaurant) return { status: 'none' as RestaurantApplicationStatus };

    const application = restaurant.application;
    // Restaurants set up by admin have no application: they are managed, not under review.
    const status: RestaurantApplicationStatus = application
      ? (restaurant.verificationStatus as RestaurantApplicationStatus)
      : restaurant.verificationStatus === 'suspended'
        ? 'suspended'
        : 'approved';

    const outlet = restaurant.outlets[0];
    return {
      status,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      rejectionReason: status === 'rejected' ? restaurant.rejectionReason : null,
      submittedAt: application?.submittedAt ?? null,
      // For pre-filling the form when re-applying; the full bank account number is never echoed back.
      application: application
        ? {
            restaurantName: restaurant.name,
            cuisines: application.cuisines,
            ownerName: application.ownerName,
            ownerEmail: application.ownerEmail,
            contactPhone: application.contactPhone,
            outletAddress: outlet?.address ?? '',
            latitude: outlet ? Number(outlet.latitude) : null,
            longitude: outlet ? Number(outlet.longitude) : null,
            fssaiNumber: application.fssaiNumber,
            fssaiExpiry: application.fssaiExpiry,
            panNumber: application.panNumber,
            gstin: application.gstin,
            bankAccountHolder: application.bankAccountHolder,
            bankAccountNumberMasked: maskAccount(application.bankAccountNumber),
            bankIfsc: application.bankIfsc,
          }
        : null,
    };
  }

  async submit(userId: string, dto: SubmitRestaurantApplicationDto) {
    const existing = await this.findMyRestaurant(userId);
    if (existing) {
      if (!existing.application) {
        throw new ConflictException('This account already has access to a restaurant.');
      }
      if (existing.verificationStatus !== 'rejected') {
        throw new ConflictException(
          existing.verificationStatus === 'approved'
            ? 'Your restaurant is already approved.'
            : 'Your application is already submitted and under review.',
        );
      }
      return this.resubmit(existing.id, existing.outlets[0]?.id, userId, dto);
    }

    const contactPhone = toE164India(dto.contactPhone);
    const now = new Date();

    const result = await this.db.transaction(async (tx) => {
      const [restaurant] = await tx
        .insert(schema.restaurants)
        .values({
          name: dto.restaurantName,
          slug: slugFor(dto.restaurantName),
          ownerId: userId,
          verificationStatus: 'pending',
          isActive: false, // hidden from customers until admin approves
        })
        .returning();

      const [outlet] = await tx
        .insert(schema.restaurantOutlets)
        .values({
          restaurantId: restaurant.id,
          name: dto.restaurantName,
          phone: contactPhone,
          address: dto.outletAddress,
          latitude: dto.latitude.toFixed(7),
          longitude: dto.longitude.toFixed(7),
        })
        .returning();

      await tx.insert(schema.restaurantStaff).values({
        userId,
        outletId: outlet.id,
        designation: 'Owner',
      });

      await tx
        .insert(schema.userRoles)
        .values({ userId, role: 'restaurant_staff' })
        .onConflictDoNothing();

      await tx.insert(schema.restaurantApplications).values({
        restaurantId: restaurant.id,
        applicantUserId: userId,
        ...this.applicationFields(dto, contactPhone),
        submittedAt: now,
      });

      await tx.insert(schema.auditLogs).values({
        action: 'restaurant_application_submitted',
        entityType: 'restaurant',
        entityId: restaurant.id,
        performedByUserId: userId,
        details: { restaurantName: dto.restaurantName },
      });

      return { restaurantId: restaurant.id };
    });

    this.logger.log(`User ${userId} submitted restaurant application ${result.restaurantId}`);
    return { status: 'pending' as RestaurantApplicationStatus, restaurantId: result.restaurantId };
  }

  /** A rejected applicant corrects their details; the application goes back to pending review. */
  private async resubmit(
    restaurantId: string,
    outletId: string | undefined,
    userId: string,
    dto: SubmitRestaurantApplicationDto,
  ) {
    const contactPhone = toE164India(dto.contactPhone);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.restaurants)
        .set({
          name: dto.restaurantName,
          verificationStatus: 'pending',
          rejectionReason: null,
          isActive: false,
          updatedAt: now,
        })
        .where(eq(schema.restaurants.id, restaurantId));

      if (outletId) {
        await tx
          .update(schema.restaurantOutlets)
          .set({
            name: dto.restaurantName,
            phone: contactPhone,
            address: dto.outletAddress,
            latitude: dto.latitude.toFixed(7),
            longitude: dto.longitude.toFixed(7),
            updatedAt: now,
          })
          .where(eq(schema.restaurantOutlets.id, outletId));
      }

      await tx
        .update(schema.restaurantApplications)
        .set({ ...this.applicationFields(dto, contactPhone), submittedAt: now, updatedAt: now })
        .where(eq(schema.restaurantApplications.restaurantId, restaurantId));

      await tx.insert(schema.auditLogs).values({
        action: 'restaurant_application_resubmitted',
        entityType: 'restaurant',
        entityId: restaurantId,
        performedByUserId: userId,
        details: { restaurantName: dto.restaurantName },
      });
    });

    this.logger.log(`User ${userId} re-submitted restaurant application ${restaurantId}`);
    return { status: 'pending' as RestaurantApplicationStatus, restaurantId };
  }

  private applicationFields(dto: SubmitRestaurantApplicationDto, contactPhone: string) {
    return {
      ownerName: dto.ownerName,
      ownerEmail: dto.ownerEmail ?? null,
      contactPhone,
      cuisines: Array.from(new Set(dto.cuisines.map((c) => c.trim()).filter(Boolean))),
      fssaiNumber: dto.fssaiNumber,
      fssaiExpiry: dto.fssaiExpiry ? dto.fssaiExpiry.slice(0, 10) : null,
      panNumber: dto.panNumber,
      gstin: dto.gstin ?? null,
      bankAccountHolder: dto.bankAccountHolder,
      bankAccountNumber: dto.bankAccountNumber,
      bankIfsc: dto.bankIfsc,
    };
  }
}
