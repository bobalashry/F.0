'use client';

import { useEffect, useState } from 'react';
import { Banknote, CalendarClock, FileText, MapPin, Percent, ScrollText, Tag, User } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { ApplicantsPanel } from '@/components/sell/applicants-panel';
import { ApplyPanel } from '@/components/sell/apply-panel';
import { OwnerListingActions } from '@/components/sell/owner-listing-actions';
import { ListingStatusBadge } from '@/components/sell/listing-status-badge';
import { supabase } from '@/lib/supabase';
import { categoryLabel, PLATFORM_FEE_PERCENT, type ListingStatus, type ListingWithOwner } from '@/lib/domain';
import { commissionBreakdown, formatCommission, formatEGP, formatNetCommission } from '@/lib/format';
import { cardClass } from '@/lib/ui';

export function ListingDetail({ listingId }: { listingId: string }) {
  const { profile } = useAuth();
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; listing: ListingWithOwner }
  >({ status: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*, owner:profiles!owner_id(full_name)')
        .eq('id', listingId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setState({ status: 'error' });
        return;
      }
      if (!data) {
        setState({ status: 'missing' });
        return;
      }
      setState({ status: 'ready', listing: data as ListingWithOwner });
    })();
    return () => {
      active = false;
    };
  }, [listingId]);

  if (state.status === 'loading') return <LoadingState label="جاري تحميل تفاصيل الفرصة..." />;
  if (state.status === 'missing') {
    return (
      <NoticePanel
        title="الفرصة غير متاحة"
        description="ربما تم إغلاقها أو حذفها، أو لا تملك صلاحية عرضها."
      />
    );
  }
  if (state.status === 'error') {
    return (
      <NoticePanel tone="error" title="تعذر تحميل الفرصة" description="حدث خطأ أثناء تحميل تفاصيل الفرصة. حاول مرة أخرى بعد قليل." />
    );
  }

  const { listing } = state;
  const isOwner = profile?.id === listing.owner_id;
  const changeStatus = (status: ListingStatus) =>
    setState((current) => (current.status === 'ready' ? { ...current, listing: { ...current.listing, status } } : current));
  const isWorker = profile?.account_type === 'worker' && !isOwner;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <article className="flex flex-col gap-6">
          <div className={`${cardClass} flex flex-col gap-5`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">
                {categoryLabel(listing.category)}
              </span>
              <ListingStatusBadge status={listing.status} />
            </div>
            <h1 className="text-3xl font-bold leading-tight text-slate-900">{listing.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
                {listing.location}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" aria-hidden />
                {listing.owner?.full_name ?? 'صاحب فرصة'}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Metric icon={Banknote} label="السعر" value={formatEGP(listing.price)} />
            <Metric
              icon={Percent}
              label={isOwner ? 'العمولة الإجمالية' : 'صافي العمولة للمسوق'}
              value={
                isOwner
                  ? formatCommission(listing.commission_type, listing.commission_value)
                  : formatNetCommission(listing.commission_type, listing.commission_value)
              }
              highlight
            />
            <Metric icon={CalendarClock} label="مدة الإعلان" value={`${listing.duration_days} يوم`} />
          </div>

          {isOwner && <CommissionSplit listing={listing} />}

          <div className={`${cardClass} flex flex-col gap-3`}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileText className="h-5 w-5 text-brand-700" aria-hidden />
              الوصف
            </h2>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{listing.description}</p>
          </div>

          <div className={`${cardClass} flex flex-col gap-3 border-gold-200 bg-gold-50/40`}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ScrollText className="h-5 w-5 text-gold-700" aria-hidden />
              شروط استحقاق العمولة
            </h2>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{listing.commission_terms}</p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Tag className="h-3.5 w-3.5" aria-hidden />
              تم الإعلان عن هذه الشروط قبل التقديم، وتُوثّق في الاتفاق عند قبول المتقدم.
            </p>
          </div>
        </article>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {isOwner && <OwnerListingActions listing={listing} onStatusChange={changeStatus} />}
          {isWorker && <ApplyPanel listing={listing} />}
          {!isOwner && !isWorker && (
            <div className={`${cardClass} text-sm leading-relaxed text-slate-600`}>
              هذه الفرصة منشورة من صاحب آخر. التقديم متاح لحسابات الباحثين عن الفرص.
            </div>
          )}
        </aside>
      </div>

      {isOwner && (
        <div className="mt-10">
          <ApplicantsPanel listingId={listing.id} listingStatus={listing.status} />
        </div>
      )}
    </div>
  );
}

function CommissionSplit({ listing }: { listing: ListingWithOwner }) {
  const split = commissionBreakdown(listing.commission_type, listing.commission_value, listing.price);
  const rows = [
    { label: 'العمولة الإجمالية', value: formatEGP(split.total), tone: 'text-slate-900' },
    { label: `خصم المنصة (${PLATFORM_FEE_PERCENT}%)`, value: `- ${formatEGP(split.fee)}`, tone: 'text-rose-700' },
    { label: 'صافي عمولة المسوق', value: formatEGP(split.net), tone: 'text-gold-700' },
  ];
  return (
    <div className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="text-lg font-bold text-slate-900">توزيع العمولة</h2>
      <dl className="flex flex-col divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-slate-600">{row.label}</dt>
            <dd className={`text-sm font-bold ${row.tone}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-slate-500">تحسب المنصة {PLATFORM_FEE_PERCENT}% من العمولة الإجمالية، ويظهر للمسوق صافي العمولة فقط.</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${cardClass} flex flex-col gap-2 p-5`}>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </span>
      <span className={`text-lg font-bold ${highlight ? 'text-gold-700' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}
