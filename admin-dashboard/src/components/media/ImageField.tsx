import { useId, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { IMAGE_RULES, imageRefUrl, uploadImage } from '@/lib/api/media';
import { HOME_ART } from './homeArt';
import { checkImageFile } from './checkImageFile';

export interface ImageFieldProps {
  label: string;
  value: string | undefined;
  onChange: (ref: string) => void;
  /** Screen-reader description; omit to hide the field. */
  alt?: string;
  onAltChange?: (alt: string) => void;
  /** Recommended shape, e.g. { width: 3, height: 2, hint: '1200 × 800' }. Off-shape uploads get a warning, not a block. */
  aspect?: { width: number; height: number; hint: string };
  optional?: boolean;
}

type Mode = 'idle' | 'art' | 'url';

export function ImageField({ label, value, onChange, alt, onAltChange, aspect, optional }: ImageFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [info, setInfo] = useState('');
  const [dragging, setDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const preview = imageRefUrl(value);

  function confirmReplace() {
    return !value || window.confirm('Replace the current image? The live app keeps showing the old one until you publish.');
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setWarning('');
    setInfo('');
    const checked = await checkImageFile(file, aspect);
    if ('error' in checked && checked.error) {
      setError(checked.error);
      return;
    }
    if (!confirmReplace()) return;
    setProgress(0);
    try {
      const uploaded = await uploadImage(file, setProgress);
      onChange(uploaded.ref);
      setPreviewFailed(false);
      setInfo(`Uploaded ${uploaded.width}×${uploaded.height}px, ${Math.round(uploaded.sizeBytes / 1024)} KB.`);
      if (checked.warning) setWarning(checked.warning);
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(typeof message === 'string' ? message : 'Upload failed. Check your connection and try again.');
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3" aria-labelledby={`${id}-label`}>
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-semibold">{label}{optional ? ' (optional)' : ''}</span>
        {aspect && <span className="text-xs text-slate-500">Best size {aspect.hint}</span>}
      </div>
      <div
        className={`flex flex-wrap items-center gap-3 rounded-md border-2 border-dashed p-2 ${dragging ? 'border-emerald-600 bg-emerald-50' : 'border-transparent'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files?.[0]); }}
      >
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
          {preview && !previewFailed
            ? <img src={preview} alt={alt || label} className="h-full w-full object-cover" onError={() => setPreviewFailed(true)} />
            : <span className="px-2 text-center text-xs text-slate-500">{value ? 'Preview unavailable' : 'No image'}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} id={`${id}-file`} type="file" accept={IMAGE_RULES.types.join(',')} className="sr-only" onChange={e => void handleFile(e.target.files?.[0])} />
          <label htmlFor={`${id}-file`} className="admin-control cursor-pointer">{value ? 'Replace image' : 'Upload image'}</label>
          <button type="button" className="admin-control" onClick={() => setMode(mode === 'art' ? 'idle' : 'art')}>Built-in image</button>
          <button type="button" className="admin-control" onClick={() => setMode(mode === 'url' ? 'idle' : 'url')}>Image URL</button>
          {value && optional && (
            <button type="button" className="admin-control" onClick={() => { if (window.confirm('Remove this image?')) onChange(''); }}>Remove</button>
          )}
        </div>
        <p className="w-full text-xs text-slate-500">Drag a PNG, JPEG or WebP here (up to 3 MB).</p>
      </div>
      {progress !== null && (
        <div role="progressbar" aria-label={`Uploading ${label}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded bg-slate-200">
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {warning && <p className="text-sm text-amber-800">{warning}</p>}
      {info && <p role="status" className="text-xs text-slate-600">{info}</p>}
      {mode === 'art' && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="listbox" aria-label="Built-in images">
          {HOME_ART.map(art => (
            <button
              key={art.key}
              type="button"
              role="option"
              aria-selected={value === `asset:${art.key}`}
              title={art.label}
              className={`rounded-md border p-1 text-[10px] ${value === `asset:${art.key}` ? 'border-emerald-700 ring-2 ring-emerald-600' : 'border-slate-200'}`}
              onClick={() => { if (confirmReplace()) { onChange(`asset:${art.key}`); setPreviewFailed(false); setMode('idle'); } }}
            >
              <img src={`/home-art/${art.key}.webp`} alt="" className="mx-auto h-12 w-12 object-contain" loading="lazy" />
              {art.label}
            </button>
          ))}
        </div>
      )}
      {mode === 'url' && (
        <label className="block text-sm">Image URL
          <input type="url" className="admin-control w-full" placeholder="https://…" defaultValue={value?.startsWith('http') ? value : ''}
            onBlur={e => { const next = e.target.value.trim(); if (next && next !== value && confirmReplace()) { onChange(next); setPreviewFailed(false); } }} />
        </label>
      )}
      {onAltChange && (
        <label className="block text-sm">Image description for screen readers
          <input className="admin-control w-full" maxLength={120} placeholder="e.g. Chicken biryani in a bowl" value={alt ?? ''} onChange={e => onAltChange(e.target.value)} />
        </label>
      )}
    </div>
  );
}
