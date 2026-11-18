import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { calculateDistanceKm } from '../common/utils/geo';
import { GeoService } from '../geo/geo.service';
import { CreateServiceZoneDto, UpdateServiceZoneDto } from './dto/service-zone.dto';

export interface ServiceZone {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** First zones, created once when the table is empty. Located with Google, never hard-coded coordinates. */
export const DEFAULT_ZONE_SEEDS = [
  { name: 'Knowledge Park II', query: 'Knowledge Park II, Greater Noida, Uttar Pradesh', radiusMeters: 3000 },
  { name: 'Knowledge Park III', query: 'Knowledge Park III, Greater Noida, Uttar Pradesh', radiusMeters: 3000 },
];

@Injectable()
export class ServiceZonesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ServiceZonesService.name);
  private static readonly CACHE_MS = 30_000;
  private cache: { at: number; zones: ServiceZone[]; anyConfigured: boolean } | null = null;

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly geoService: GeoService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.configService.get<string>('NODE_ENV') === 'test') return;
    try {
      await this.ensureDefaultZones();
    } catch (err) {
      this.logger.warn(`Could not create default service zones: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Creates the Knowledge Park II / III zones when no zone exists yet. */
  async ensureDefaultZones(): Promise<number> {
    const existing = await this.db.query.serviceZones.findFirst();
    if (existing) return 0;

    let created = 0;
    for (const seed of DEFAULT_ZONE_SEEDS) {
      try {
        const suggestions = await this.geoService.autocomplete({ input: seed.query });
        if (!suggestions[0]) throw new Error('no search result');
        const place = await this.geoService.placeDetails(suggestions[0].placeId);
        await this.db.insert(schema.serviceZones).values({
          name: seed.name,
          centerLatitude: place.latitude.toFixed(7),
          centerLongitude: place.longitude.toFixed(7),
          radiusMeters: seed.radiusMeters,
          isActive: true,
        });
        created += 1;
        this.logger.log(`Created service zone '${seed.name}' at ${place.latitude}, ${place.longitude} (${seed.radiusMeters} m)`);
      } catch (err) {
        this.logger.warn(
          `Could not locate '${seed.query}' (${err instanceof Error ? err.message : err}). Add this zone from the admin dashboard.`,
        );
      }
    }
    this.invalidate();
    return created;
  }

  async listAll(): Promise<ServiceZone[]> {
    const rows = await this.db.query.serviceZones.findMany({ orderBy: [asc(schema.serviceZones.createdAt)] });
    return rows.map(toZone);
  }

  async listActive(): Promise<ServiceZone[]> {
    return (await this.snapshot()).zones;
  }

  /** Active zones plus whether any zone (active or not) exists. Cached for 30 s. */
  private async snapshot() {
    if (this.cache && Date.now() - this.cache.at < ServiceZonesService.CACHE_MS) return this.cache;
    const rows = await this.db.query.serviceZones.findMany({ orderBy: [asc(schema.serviceZones.createdAt)] });
    const all = rows.map(toZone);
    this.cache = { at: Date.now(), zones: all.filter((z) => z.isActive), anyConfigured: all.length > 0 };
    return this.cache;
  }

  /**
   * Returns the zone containing the point, or null when outside every active zone.
   * `enforced` is false when no zone is configured at all, so the platform keeps working.
   */
  async locate(latitude: unknown, longitude: unknown): Promise<{ enforced: boolean; zone: ServiceZone | null }> {
    const { zones, anyConfigured } = await this.snapshot();
    // No zone configured yet: do not block the platform. All zones switched off: nothing is served.
    if (!anyConfigured) return { enforced: false, zone: null };

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { enforced: true, zone: null };
    return { enforced: true, zone: findContainingZone(zones, lat, lng) };
  }

  /** True when the point may be served (inside an active zone, or no zones configured). */
  async isServiceable(latitude: unknown, longitude: unknown): Promise<boolean> {
    const { enforced, zone } = await this.locate(latitude, longitude);
    return !enforced || zone !== null;
  }

  async assertServiceable(latitude: unknown, longitude: unknown, message: string) {
    if (!(await this.isServiceable(latitude, longitude))) {
      throw new BadRequestException(message);
    }
  }

  async create(dto: CreateServiceZoneDto, adminUserId: string): Promise<ServiceZone> {
    const [row] = await this.db
      .insert(schema.serviceZones)
      .values({
        name: dto.name.trim(),
        centerLatitude: dto.centerLatitude.toFixed(7),
        centerLongitude: dto.centerLongitude.toFixed(7),
        radiusMeters: Math.round(dto.radiusKm * 1000),
        isActive: dto.isActive ?? true,
        createdBy: adminUserId,
      })
      .returning();
    this.invalidate();
    return toZone(row);
  }

  async update(id: string, dto: UpdateServiceZoneDto): Promise<ServiceZone> {
    const hasLat = dto.centerLatitude !== undefined;
    if (hasLat !== (dto.centerLongitude !== undefined)) {
      throw new BadRequestException('centerLatitude and centerLongitude must be updated together.');
    }
    const patch: Partial<typeof schema.serviceZones.$inferInsert> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (hasLat) {
      patch.centerLatitude = dto.centerLatitude!.toFixed(7);
      patch.centerLongitude = dto.centerLongitude!.toFixed(7);
    }
    if (dto.radiusKm !== undefined) patch.radiusMeters = Math.round(dto.radiusKm * 1000);
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    const [row] = await this.db
      .update(schema.serviceZones)
      .set(patch)
      .where(eq(schema.serviceZones.id, id))
      .returning();
    if (!row) throw new NotFoundException('Service zone not found.');
    this.invalidate();
    return toZone(row);
  }

  invalidate() {
    this.cache = null;
  }
}

export function findContainingZone(zones: ServiceZone[], latitude: number, longitude: number): ServiceZone | null {
  let best: { zone: ServiceZone; km: number } | null = null;
  for (const zone of zones) {
    if (!zone.isActive) continue;
    const km = calculateDistanceKm(zone.centerLatitude, zone.centerLongitude, latitude, longitude);
    if (km * 1000 <= zone.radiusMeters + 1e-6 && (!best || km < best.km)) best = { zone, km };
  }
  return best ? best.zone : null;
}

function toZone(row: typeof schema.serviceZones.$inferSelect): ServiceZone {
  return {
    id: row.id,
    name: row.name,
    centerLatitude: Number(row.centerLatitude),
    centerLongitude: Number(row.centerLongitude),
    radiusMeters: row.radiusMeters,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
