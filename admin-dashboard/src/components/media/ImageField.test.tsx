import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { ImageField } from './ImageField';

const media = vi.hoisted(() => ({ uploadImage: vi.fn() }));
vi.mock('@/lib/api/media', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/media')>('@/lib/api/media')),
  uploadImage: media.uploadImage,
}));

// jsdom cannot decode images: report a fixed size for any object URL.
class FakeImage {
  naturalWidth = 1200;
  naturalHeight = 600;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
}

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <><ImageField label="Hero photo" value={value} onChange={setValue} aspect={{ width: 1, height: 1, hint: '800 × 800' }} /><span data-testid="value">{value}</span></>;
}

describe('ImageField', () => {
  beforeEach(() => {
    media.uploadImage.mockReset();
    vi.stubGlobal('Image', FakeImage);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('uploads a valid image, stores its media reference and warns about the shape', async () => {
    media.uploadImage.mockImplementation(async (_f: File, progress: (p: number) => void) => {
      progress(50);
      return { id: 'm1', ref: 'media:m1', width: 1200, height: 600, mimeType: 'image/png', sizeBytes: 2048 };
    });
    render(<Harness />);
    const file = new File([new Uint8Array(100)], 'hero.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload image'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('media:m1'));
    expect(screen.getByRole('status')).toHaveTextContent('1200×600');
    expect(screen.getByText(/looks best around 800 × 800/)).toBeInTheDocument();
  });

  it('rejects other file types without uploading', async () => {
    render(<Harness />);
    const file = new File(['%PDF'], 'menu.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Upload image'), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG, JPEG or WebP');
    expect(media.uploadImage).not.toHaveBeenCalled();
  });

  it('asks before replacing an existing image and keeps it when cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness initial="asset:biryani" />);
    fireEvent.click(screen.getByRole('button', { name: 'Built-in image' }));
    fireEvent.click(screen.getByRole('option', { name: /Pizza/ }));
    expect(screen.getByTestId('value')).toHaveTextContent('asset:biryani');
  });

  it('shows the server reason when an upload fails', async () => {
    media.uploadImage.mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { data: { message: 'Image is too small (40×40).' } } }));
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Upload image'), { target: { files: [new File([new Uint8Array(10)], 'a.webp', { type: 'image/webp' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('too small');
  });
});
