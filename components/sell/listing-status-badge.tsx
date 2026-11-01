import { listingStatusLabel, type ListingStatus } from '@/lib/domain';

const STYLES: Record<ListingStatus, string> = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  paused: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed: 'bg-slate-100 text-slate-700 ring-slate-200',
  sold: 'bg-sky-50 text-sky-800 ring-sky-200',
  suspended: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${STYLES[status]}`}>
      {listingStatusLabel[status]}
    </span>
  );
}
