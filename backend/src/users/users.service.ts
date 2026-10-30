import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { CreateAddressDto } from './dto/address.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getAddresses(userId: string) {
    return this.db.query.customerAddresses.findMany({
      where: eq(schema.customerAddresses.userId, userId),
      orderBy: [desc(schema.customerAddresses.isDefault), desc(schema.customerAddresses.createdAt)],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.db
        .update(schema.customerAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.customerAddresses.userId, userId));
    }

    const [address] = await this.db
      .insert(schema.customerAddresses)
      .values({
        userId,
        label: dto.label || 'Home',
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2 || null,
        landmark: dto.landmark || null,
        city: dto.city || 'Greater Noida',
        postalCode: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isDefault: dto.isDefault ?? false,
      })
      .returning();

    return address;
  }
}
