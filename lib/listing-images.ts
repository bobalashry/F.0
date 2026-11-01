import { supabase } from '@/lib/supabase';

export const LISTING_IMAGE_BUCKET = 'listing-images';
export const MAX_LISTING_IMAGES = 8;
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const LISTING_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const listingImageUrl = (path: string) =>
  supabase.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
