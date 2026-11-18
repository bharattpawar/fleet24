import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { isUsableLocation, withLocationStatus } from './address-location.util';
import { ServiceZonesService } from '../service-zones/service-zones.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly serviceZones: ServiceZonesService,
  ) {}

  /** Adds needsLocationConfirmation, isServiceable and the containing zone name. */
  private async decorate<T extends { latitude: unknown; longitude: unknown }>(address: T) {
    const withStatus = withLocationStatus(address);
    if (withStatus.needsLocationConfirmation) {
      return { ...withStatus, isServiceable: false, serviceZoneName: null as string | null };
    }
    const { enforced, zone } = await this.serviceZones.locate(address.latitude, address.longitude);
    return { ...withStatus, isServiceable: !enforced || zone !== null, serviceZoneName: zone?.name ?? null };
  }

  async getAddresses(userId: string) {
    const rows = await this.db.query.customerAddresses.findMany({
      where: eq(schema.customerAddresses.userId, userId),
      orderBy: [desc(schema.customerAddresses.isDefault), desc(schema.customerAddresses.createdAt)],
    });
    return Promise.all(rows.map((row) => this.decorate(row)));
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    this.assertUsableLocation(dto.latitude, dto.longitude);

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
        city: dto.city.trim(),
        postalCode: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isDefault: dto.isDefault ?? false,
      })
      .returning();

    return this.decorate(address);
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const existing = await this.db.query.customerAddresses.findFirst({
      where: and(
        eq(schema.customerAddresses.id, addressId),
        eq(schema.customerAddresses.userId, userId),
      ),
    });
    if (!existing) {
      throw new NotFoundException('Address not found.');
    }

    const hasLat = dto.latitude !== undefined;
    const hasLng = dto.longitude !== undefined;
    if (hasLat !== hasLng) {
      throw new BadRequestException('latitude and longitude must be updated together.');
    }
    if (hasLat) {
      this.assertUsableLocation(dto.latitude, dto.longitude);
    }

    if (dto.isDefault) {
      await this.db
        .update(schema.customerAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.customerAddresses.userId, userId));
    }

    const patch: Partial<typeof schema.customerAddresses.$inferInsert> = { updatedAt: new Date() };
    if (dto.label !== undefined) patch.label = dto.label || 'Home';
    if (dto.addressLine1 !== undefined) patch.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined) patch.addressLine2 = dto.addressLine2 || null;
    if (dto.landmark !== undefined) patch.landmark = dto.landmark || null;
    if (dto.city !== undefined) patch.city = dto.city.trim();
    if (dto.postalCode !== undefined) patch.postalCode = dto.postalCode;
    if (hasLat) {
      patch.latitude = dto.latitude;
      patch.longitude = dto.longitude;
    }
    if (dto.isDefault !== undefined) patch.isDefault = dto.isDefault;

    const [updated] = await this.db
      .update(schema.customerAddresses)
      .set(patch)
      .where(
        and(
          eq(schema.customerAddresses.id, addressId),
          eq(schema.customerAddresses.userId, userId),
        ),
      )
      .returning();

    return this.decorate(updated);
  }

  private assertUsableLocation(latitude: unknown, longitude: unknown) {
    if (!isUsableLocation(latitude, longitude)) {
      throw new BadRequestException(
        'Please pin the delivery location on the map before saving this address.',
      );
    }
  }
}
