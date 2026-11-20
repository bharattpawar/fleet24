import { readImageInfo, validateImage } from './image-info';

const png = (w: number, h: number) => {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
};
const jpeg = (w: number, h: number) => Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,
  0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const webpVp8x = (w: number, h: number) => {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3);
  return b;
};

describe('image inspection', () => {
  it('reads type and size from PNG, JPEG and WebP bytes', () => {
    expect(readImageInfo(png(800, 600))).toEqual({ mimeType: 'image/png', width: 800, height: 600 });
    expect(readImageInfo(jpeg(1200, 900))).toEqual({ mimeType: 'image/jpeg', width: 1200, height: 900 });
    expect(readImageInfo(webpVp8x(640, 480))).toEqual({ mimeType: 'image/webp', width: 640, height: 480 });
  });

  it('rejects files that are not images, whatever their name says', () => {
    expect(() => validateImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>   '))).toThrow('PNG, JPEG or WebP');
    expect(() => validateImage(Buffer.from('%PDF-1.7 ....................'))).toThrow('PNG, JPEG or WebP');
  });

  it('rejects tiny, huge and empty images', () => {
    expect(() => validateImage(png(32, 32))).toThrow('too small');
    expect(() => validateImage(png(5000, 400))).toThrow('too large');
    expect(() => validateImage(Buffer.alloc(0))).toThrow('empty');
    expect(() => validateImage(Buffer.alloc(3 * 1024 * 1024 + 1))).toThrow('3 MB');
  });
});
