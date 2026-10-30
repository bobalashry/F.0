import { applicationStatusLabel, type ApplicationStatus } from '@/lib/domain';

const STYLES: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
  withdrawn: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${STYLES[status]}`}>
      {applicationStatusLabel[status]}
    </span>
  );
}
