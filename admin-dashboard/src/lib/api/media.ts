import { apiClient } from './client';

export interface UploadedImage {
  id: string;
  /** Store this in content: `media:<id>`. */
  ref: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
}

export const IMAGE_RULES = {
  types: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 3 * 1024 * 1024,
  minSide: 64,
  maxSide: 4096,
} as const;

/** POST /admin/media — stores the file in the database and returns its reference. */
export async function uploadImage(file: File, onProgress?: (percent: number) => void): Promise<UploadedImage> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<UploadedImage>('/admin/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: event => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

/** Where the browser can load an image reference from. */
export function imageRefUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith('media:')) return `${apiClient.defaults.baseURL}/public/media/${ref.slice(6)}`;
  if (ref.startsWith('asset:')) return `/home-art/${ref.slice(6)}.webp`;
  if (/^https?:\/\//i.test(ref)) return ref;
  return null;
}
