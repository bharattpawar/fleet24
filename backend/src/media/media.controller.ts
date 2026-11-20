import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Response } from 'express';
import { AuthenticatedUserPayload, CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { MEDIA_LIMITS, validateImage } from './image-info';

interface UploadedImageFile {
  buffer: Buffer;
  originalname?: string;
  size: number;
}

export interface MediaUploadResult {
  id: string;
  /** Store this in content; apps turn it into /public/media/<id>. */
  ref: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
}

@Controller()
export class MediaController {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  /** POST /api/v1/admin/media  (multipart, field "file"). Same bytes → same id. */
  @Post('admin/media')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MEDIA_LIMITS.maxBytes, files: 1 } }))
  async upload(
    @UploadedFile() file: UploadedImageFile | undefined,
    @CurrentUser() user: AuthenticatedUserPayload,
  ): Promise<MediaUploadResult> {
    if (!file?.buffer) throw new BadRequestException('Choose an image to upload.');
    let info;
    try {
      info = validateImage(file.buffer);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const [existing] = await this.db
      .select({ id: schema.mediaAssets.id })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.sha256, sha256));
    const id = existing?.id ?? (
      await this.db
        .insert(schema.mediaAssets)
        .values({
          sha256,
          mimeType: info.mimeType,
          width: info.width,
          height: info.height,
          sizeBytes: file.buffer.length,
          data: file.buffer,
          originalName: file.originalname?.slice(0, 200) ?? null,
          uploadedBy: user?.userId ?? null,
        })
        .onConflictDoNothing({ target: schema.mediaAssets.sha256 })
        .returning({ id: schema.mediaAssets.id })
    )[0]?.id;
    // Lost a race with an identical upload: read the winner.
    const finalId = id ?? (await this.db.select({ id: schema.mediaAssets.id }).from(schema.mediaAssets).where(eq(schema.mediaAssets.sha256, sha256)))[0].id;
    return { id: finalId, ref: `media:${finalId}`, width: info.width, height: info.height, mimeType: info.mimeType, sizeBytes: file.buffer.length };
  }

  /** GET /api/v1/public/media/:id  — immutable, cache forever. */
  @Get('public/media/:id')
  async serve(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const [asset] = await this.db
      .select({ data: schema.mediaAssets.data, mimeType: schema.mediaAssets.mimeType, sha256: schema.mediaAssets.sha256 })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, id));
    if (!asset) throw new NotFoundException('Image not found.');
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${asset.sha256}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.end(asset.data);
  }
}
