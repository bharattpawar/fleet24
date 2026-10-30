import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';

@Injectable()
export class OutletAuthorizationService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Verifies that the user has admin authority OR is an active staff member assigned to the specified outlet.
   * Returns the outlet entity if authorized.
   */
  async verifyOutletAccess(
    user: AuthenticatedUserPayload,
    outletId: string,
  ): Promise<typeof schema.restaurantOutlets.$inferSelect> {
    const outlet = await this.db.query.restaurantOutlets.findFirst({
      where: eq(schema.restaurantOutlets.id, outletId),
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet with ID '${outletId}' not found.`);
    }

    // Admins bypass outlet assignment restrictions
    if (user.roles && user.roles.includes('admin')) {
      return outlet;
    }

    // For restaurant staff, verify active assignment in restaurant_staff table
    if (user.roles && user.roles.includes('restaurant_staff')) {
      const assignment = await this.db.query.restaurantStaff.findFirst({
        where: and(
          eq(schema.restaurantStaff.userId, user.userId),
          eq(schema.restaurantStaff.outletId, outletId),
          eq(schema.restaurantStaff.isActive, true),
        ),
      });

      if (!assignment) {
        throw new ForbiddenException(
          `Access denied. You are not authorized to manage outlet '${outletId}'.`,
        );
      }

      return outlet;
    }

    throw new ForbiddenException('Access denied. Insufficient permissions.');
  }

  /**
   * Verifies if user has authority to manage a restaurant (Admin only).
   */
  async verifyRestaurantAdminAccess(user: AuthenticatedUserPayload) {
    if (!user.roles || !user.roles.includes('admin')) {
      throw new ForbiddenException('Admin role required for restaurant-level operations.');
    }
  }
}
