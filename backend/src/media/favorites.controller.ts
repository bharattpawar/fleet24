import { Controller, Delete, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuthenticatedUserPayload, CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';

/** Hearted restaurants (outlets) for the signed-in customer. */
@Controller('customer/favorites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class FavoritesController {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUserPayload) {
    const rows = await this.db
      .select({ outletId: schema.customerFavoriteOutlets.outletId })
      .from(schema.customerFavoriteOutlets)
      .where(eq(schema.customerFavoriteOutlets.userId, user.userId))
      .orderBy(desc(schema.customerFavoriteOutlets.createdAt));
    return { outletIds: rows.map(row => row.outletId) };
  }

  @Put(':outletId')
  async add(@CurrentUser() user: AuthenticatedUserPayload, @Param('outletId', new ParseUUIDPipe()) outletId: string) {
    const [outlet] = await this.db
      .select({ id: schema.restaurantOutlets.id })
      .from(schema.restaurantOutlets)
      .where(eq(schema.restaurantOutlets.id, outletId));
    if (!outlet) throw new NotFoundException('Restaurant not found.');
    await this.db.insert(schema.customerFavoriteOutlets).values({ userId: user.userId, outletId }).onConflictDoNothing();
    return { outletId, favorite: true };
  }

  @Delete(':outletId')
  async remove(@CurrentUser() user: AuthenticatedUserPayload, @Param('outletId', new ParseUUIDPipe()) outletId: string) {
    await this.db
      .delete(schema.customerFavoriteOutlets)
      .where(and(eq(schema.customerFavoriteOutlets.userId, user.userId), eq(schema.customerFavoriteOutlets.outletId, outletId)));
    return { outletId, favorite: false };
  }
}
