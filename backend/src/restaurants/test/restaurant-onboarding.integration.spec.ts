import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { ConflictException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { RestaurantOnboardingService } from '../restaurant-onboarding.service';
import { AdminManagementService } from '../../admin/admin-management.service';
import { MenusService } from '../menus.service';
import { SubmitRestaurantApplicationDto } from '../dto/restaurant-onboarding.dto';

dotenv.config();

/**
 * Restaurant self-registration against real PostgreSQL:
 * submit -> hidden from customers -> admin rejects -> owner re-applies -> admin approves -> visible.
 */
describe('Restaurant self-registration (database)', () => {
  jest.setTimeout(60000);

  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let onboarding: RestaurantOnboardingService;
  let admin: AdminManagementService;
  let menus: MenusService;
  const userIds: string[] = [];
  const restaurantIds: string[] = [];

  const form = (overrides: Partial<SubmitRestaurantApplicationDto> = {}): SubmitRestaurantApplicationDto => ({
    restaurantName: 'Sharma Dhaba Test',
    cuisines: ['North Indian', 'Chinese'],
    ownerName: 'Rakesh Sharma',
    ownerEmail: 'owner@example.com',
    contactPhone: '9811100000',
    outletAddress: 'Shop 4, Test Market, Sector 19, Noida',
    latitude: 28.5850,
    longitude: 77.3100,
    fssaiNumber: '12345678901234',
    fssaiExpiry: '2030-03-31',
    panNumber: 'ABCDE1234F',
    gstin: undefined,
    bankAccountHolder: 'Rakesh Sharma',
    bankAccountNumber: '123456789012',
    bankIfsc: 'HDFC0001234',
    ...overrides,
  });

  const newUser = async (label: string) => {
    const [user] = await db
      .insert(schema.users)
      .values({ phone: `+9197${Math.floor(10000000 + Math.random() * 89999999)}`, fullName: label })
      .returning();
    userIds.push(user.id);
    return user;
  };

  const publicOutletIds = async () =>
    (await menus.getPublicActiveOutlets()).map((o: any) => o.id ?? o.outletId);

  beforeAll(() => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL environment variable is required for integration tests');
    pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    db = drizzle(pool, { schema });
    onboarding = new RestaurantOnboardingService(db);
    admin = new AdminManagementService(db);
    menus = new MenusService(db, {} as any);
  });

  afterAll(async () => {
    if (restaurantIds.length) {
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.entityId, restaurantIds));
      // Outlets first (their staff rows cascade), then the restaurants (applications cascade).
      await db.delete(schema.restaurantOutlets).where(inArray(schema.restaurantOutlets.restaurantId, restaurantIds));
      await db.delete(schema.restaurants).where(inArray(schema.restaurants.id, restaurantIds));
    }
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await pool?.end();
  });

  it('a new user has no application yet', async () => {
    const user = await newUser('No Application');
    await expect(onboarding.getMyApplication(user.id)).resolves.toEqual({ status: 'none' });
  });

  it('runs the whole flow: hidden while pending, reject, re-apply, approve, visible', async () => {
    const owner = await newUser('Restaurant Owner');

    // 1. Submit: pending, hidden from customers, owner linked with the restaurant_staff role.
    const submitted = await onboarding.submit(owner.id, form());
    restaurantIds.push(submitted.restaurantId);
    expect(submitted.status).toBe('pending');

    const restaurant = await db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, submitted.restaurantId),
      with: { outlets: true, application: true },
    });
    expect(restaurant).toMatchObject({ verificationStatus: 'pending', isActive: false, ownerId: owner.id });
    expect(restaurant!.outlets).toHaveLength(1);
    const outletId = restaurant!.outlets[0].id;
    expect(restaurant!.outlets[0]).toMatchObject({ phone: '+919811100000', name: 'Sharma Dhaba Test' });
    expect(restaurant!.application).toMatchObject({ fssaiNumber: '12345678901234', panNumber: 'ABCDE1234F', gstin: null });

    const staff = await db.query.restaurantStaff.findFirst({ where: eq(schema.restaurantStaff.userId, owner.id) });
    expect(staff).toMatchObject({ outletId, designation: 'Owner', isActive: true });
    const roles = await db.query.userRoles.findMany({ where: eq(schema.userRoles.userId, owner.id) });
    expect(roles.map((r) => r.role)).toContain('restaurant_staff');

    expect(await publicOutletIds()).not.toContain(outletId);

    // 2. A second submit while under review is refused.
    await expect(onboarding.submit(owner.id, form())).rejects.toThrow(ConflictException);

    // 3. Admin sees the details, then rejects with a reason.
    const details = await admin.getRestaurantApplicationDetails(submitted.restaurantId);
    expect(details.application).toMatchObject({ ownerName: 'Rakesh Sharma', bankIfsc: 'HDFC0001234', cuisines: ['North Indian', 'Chinese'] });

    const adminUser = await newUser('Admin');
    await admin.verifyRestaurant(adminUser.id, submitted.restaurantId, {
      verificationStatus: 'rejected',
      rejectionReason: 'FSSAI number does not match the licence',
    } as any);
    const rejected = await onboarding.getMyApplication(owner.id);
    expect(rejected).toMatchObject({ status: 'rejected', rejectionReason: 'FSSAI number does not match the licence' });
    expect(rejected.application).toMatchObject({ bankAccountNumberMasked: '••••9012', fssaiNumber: '12345678901234' });
    expect(rejected.application).not.toHaveProperty('bankAccountNumber');

    // 4. Owner corrects and re-applies: back to pending, same restaurant, still hidden.
    const again = await onboarding.submit(owner.id, form({ fssaiNumber: '22345678901234', gstin: '09ABCDE1234F1Z5' }));
    expect(again).toEqual({ status: 'pending', restaurantId: submitted.restaurantId });
    await expect(onboarding.getMyApplication(owner.id)).resolves.toMatchObject({ status: 'pending', rejectionReason: null });
    expect(await publicOutletIds()).not.toContain(outletId);

    // 5. Admin approves: live for customers and approved in the app.
    await admin.verifyRestaurant(adminUser.id, submitted.restaurantId, { verificationStatus: 'approved' } as any);
    await expect(onboarding.getMyApplication(owner.id)).resolves.toMatchObject({ status: 'approved' });
    expect(await publicOutletIds()).toContain(outletId);
  });

  it('treats a restaurant set up by admin (no application) as approved and blocks a second registration', async () => {
    const staffUser = await newUser('Admin-made Staff');
    const [restaurant] = await db
      .insert(schema.restaurants)
      .values({ name: 'Admin Made Kitchen', slug: `admin-made-${Date.now()}`, isActive: true })
      .returning();
    restaurantIds.push(restaurant.id);
    const [outlet] = await db
      .insert(schema.restaurantOutlets)
      .values({ restaurantId: restaurant.id, name: 'Main', phone: '+919800000000', address: 'X', latitude: '28.5', longitude: '77.3' })
      .returning();
    await db.insert(schema.restaurantStaff).values({ userId: staffUser.id, outletId: outlet.id, designation: 'Manager' });

    await expect(onboarding.getMyApplication(staffUser.id)).resolves.toMatchObject({ status: 'approved', application: null });
    await expect(onboarding.submit(staffUser.id, form())).rejects.toThrow(ConflictException);
  });
});
