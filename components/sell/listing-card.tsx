import Link from 'next/link';
import { Banknote, Clock, MapPin, Percent, User } from 'lucide-react';
import { categoryLabel, type ListingWithOwner } from '@/lib/domain';
import { formatCommission, formatEGP } from '@/lib/format';
import { cardClass } from '@/lib/ui';

export function ListingCard({ listing }: { listing: ListingWithOwner }) {
  return (
    <Link
      href={`/sell/${listing.id}`}
      className={`${cardClass} group flex flex-col gap-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">
          {categoryLabel(listing.category)}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {listing.duration_days} يوم
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900 group-hover:text-brand-800">
          {listing.title}
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-slate-600">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          {listing.location}
        </p>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Banknote className="h-3.5 w-3.5" aria-hidden />
            السعر
          </span>
          <span className="text-base font-bold text-slate-900">{formatEGP(listing.price)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Percent className="h-3.5 w-3.5" aria-hidden />
            العمولة
          </span>
          <span className="text-base font-bold text-gold-700">
            {formatCommission(listing.commission_type, listing.commission_value)}
          </span>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <User className="h-3.5 w-3.5" aria-hidden />
        {listing.owner?.full_name ?? 'صاحب فرصة'}
      </p>
    </Link>
  );
}
