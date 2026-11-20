/**
 * Reads the real type and pixel size of an uploaded image from its bytes, so a renamed or
 * mislabeled file is rejected. Supports the formats the apps render: PNG, JPEG and WebP.
 */
export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ImageInfo {
  mimeType: ImageMime;
  width: number;
  height: number;
}

export function readImageInfo(buf: Buffer): ImageInfo | null {
  if (buf.length < 24) return null;

  // PNG: signature, then IHDR width/height (big-endian) at bytes 16..23.
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    return { mimeType: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // WebP: RIFF....WEBP then a VP8 / VP8L / VP8X chunk.
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' && buf.length >= 30) {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      return { mimeType: 'image/webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { mimeType: 'image/webp', width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    if (chunk === 'VP8 ') {
      return { mimeType: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    return null;
  }

  // JPEG: walk markers until a start-of-frame segment.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) return null;
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = buf.readUInt16BE(offset + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) {
        return { mimeType: 'image/jpeg', height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
    return null;
  }
  return null;
}

export const MEDIA_LIMITS = {
  maxBytes: 3 * 1024 * 1024,
  minSide: 64,
  maxSide: 4096,
} as const;

/** Throws a human-readable message when the upload is not usable. */
export function validateImage(buf: Buffer): ImageInfo {
  if (buf.length === 0) throw new Error('The file is empty.');
  if (buf.length > MEDIA_LIMITS.maxBytes) throw new Error('Images must be 3 MB or smaller.');
  const info = readImageInfo(buf);
  if (!info) throw new Error('Upload a PNG, JPEG or WebP image.');
  if (info.width < MEDIA_LIMITS.minSide || info.height < MEDIA_LIMITS.minSide) {
    throw new Error(`Image is too small (${info.width}×${info.height}); use at least ${MEDIA_LIMITS.minSide}px on each side.`);
  }
  if (info.width > MEDIA_LIMITS.maxSide || info.height > MEDIA_LIMITS.maxSide) {
    throw new Error(`Image is too large (${info.width}×${info.height}); keep each side at ${MEDIA_LIMITS.maxSide}px or less.`);
  }
  return info;
}
