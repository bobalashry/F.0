import { CheckCircle2, CircleDot } from 'lucide-react';
import { dealStatusLabel, type DealStatus } from '@/lib/domain';

const STYLES: Record<DealStatus, string> = {
  active: 'bg-brand-50 text-brand-800 ring-brand-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export function DealStatusBadge({ status }: { status: DealStatus }) {
  const Icon = status === 'completed' ? CheckCircle2 : CircleDot;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${STYLES[status]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {dealStatusLabel[status]}
    </span>
  );
}
