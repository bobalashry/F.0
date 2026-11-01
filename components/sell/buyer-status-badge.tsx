import { buyerStatusLabel, type BuyerStatus } from '@/lib/domain';

const STYLES: Record<BuyerStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  objected: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function BuyerStatusBadge({ status }: { status: BuyerStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${STYLES[status]}`}>
      {buyerStatusLabel[status]}
    </span>
  );
}
