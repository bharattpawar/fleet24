import { IMAGE_RULES } from '@/lib/api/media';

function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('This file could not be read as an image.')); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Checks a file before uploading; returns an error message or null. Also returns a shape warning. */
export async function checkImageFile(file: File, aspect?: { width: number; height: number; hint: string }) {
  if (!(IMAGE_RULES.types as readonly string[]).includes(file.type)) return { error: 'Use a PNG, JPEG or WebP image.' };
  if (file.size > IMAGE_RULES.maxBytes) return { error: `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 3 MB.` };
  let size: { width: number; height: number };
  try {
    size = await readDimensions(file);
  } catch (err) {
    return { error: (err as Error).message };
  }
  if (size.width < IMAGE_RULES.minSide || size.height < IMAGE_RULES.minSide) return { error: `Image is only ${size.width}×${size.height}px.` };
  if (size.width > IMAGE_RULES.maxSide || size.height > IMAGE_RULES.maxSide) return { error: `Image is ${size.width}×${size.height}px; keep each side at 4096px or less.` };
  let warning: string | undefined;
  if (aspect) {
    const want = aspect.width / aspect.height;
    const got = size.width / size.height;
    if (Math.abs(got - want) / want > 0.25) warning = `This image is ${size.width}×${size.height}; this slot looks best around ${aspect.hint}. It will be cropped to fit.`;
  }
  return { size, warning };
}

