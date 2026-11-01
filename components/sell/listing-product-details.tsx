'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import { listingImageUrl } from '@/lib/listing-images';
import type { Listing } from '@/lib/domain';
import { cardClass } from '@/lib/ui';

export function ListingProductDetails({ listing }: { listing: Pick<Listing, 'product_name' | 'specs' | 'image_paths'> }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const images = listing.image_paths ?? [];
  const activeImage = images[activeIndex];

  if (!listing.product_name && !listing.specs && images.length === 0) return null;

  return (
    <div className={`${cardClass} flex flex-col gap-5`}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Package className="h-5 w-5 text-brand-700" aria-hidden />
        المنتج
      </h2>

      {images.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
            <img src={listingImageUrl(activeImage)} alt={listing.product_name ?? 'صورة المنتج'} className="h-full w-full object-cover" />
          </div>
          {images.length > 1 && (
            <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {images.map((path, index) => (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`عرض الصورة ${index + 1}`}
                    aria-current={index === activeIndex}
                    className={`aspect-square w-full overflow-hidden rounded-lg border-2 transition ${
                      index === activeIndex ? 'border-brand-600' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={listingImageUrl(path)} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {listing.product_name && <p className="text-base font-bold text-slate-900">{listing.product_name}</p>}
      {listing.specs && <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{listing.specs}</p>}
    </div>
  );
}
