'use client';

import { useState, type ChangeEvent } from 'react';
import { AlertCircle, ImagePlus, Loader2, X } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import {
  LISTING_IMAGE_BUCKET,
  LISTING_IMAGE_EXTENSIONS,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGES,
  listingImageUrl,
} from '@/lib/listing-images';
import { translateError } from '@/lib/messages';
import { labelClass } from '@/lib/ui';

interface ListingImagesFieldProps {
  value: string[];
  onChange: (paths: string[]) => void;
}

export function ListingImagesField({ value, onChange }: ListingImagesFieldProps) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setError(null);
    if (files.length === 0 || !profile) return;

    const remaining = MAX_LISTING_IMAGES - value.length;
    if (files.length > remaining) {
      setError(remaining > 0 ? `يمكنك إضافة ${remaining} صور فقط` : `الحد الأقصى ${MAX_LISTING_IMAGES} صور`);
      return;
    }
    const invalid = files.find((file) => !LISTING_IMAGE_EXTENSIONS[file.type]);
    if (invalid) {
      setError('الصور المسموحة: JPG أو PNG أو WEBP');
      return;
    }
    const oversized = files.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);
    if (oversized) {
      setError('حجم كل صورة يجب ألا يتجاوز 5 ميجابايت');
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];
    for (const file of files) {
      const path = `${profile.id}/${crypto.randomUUID()}.${LISTING_IMAGE_EXTENSIONS[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from(LISTING_IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (uploadError) {
        setError(translateError(uploadError));
        break;
      }
      uploaded.push(path);
    }
    setUploading(false);

    if (uploaded.length > 0) onChange([...value, ...uploaded]);
  };

  const removeImage = (path: string) => onChange(value.filter((item) => item !== path));

  return (
    <div className="flex flex-col gap-3">
      <span className={labelClass}>
        صور المنتج ({value.length}/{MAX_LISTING_IMAGES})
      </span>

      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((path) => (
            <li key={path} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <img src={listingImageUrl(path)} alt="صورة من المنتج" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(path)}
                aria-label="إزالة الصورة"
                className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow transition hover:bg-rose-600 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:bg-brand-50/40 ${
          uploading || value.length >= MAX_LISTING_IMAGES ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ImagePlus className="h-5 w-5" aria-hidden />}
        {uploading ? 'جاري رفع الصور...' : 'اختر صور المنتج من جهازك'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFiles}
          disabled={uploading || value.length >= MAX_LISTING_IMAGES}
          className="sr-only"
        />
      </label>
      <p className="text-xs text-slate-500">JPG أو PNG أو WEBP، حتى 5 ميجابايت للصورة الواحدة.</p>
    </div>
  );
}
