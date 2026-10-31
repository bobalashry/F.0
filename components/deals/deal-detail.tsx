'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, CheckCircle2, Info, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { DealStatusBadge } from '@/components/deals/deal-status-badge';
import { CommissionBreakdownCard } from '@/components/deals/commission-breakdown-card';
import { OwnerContactCard } from '@/components/deals/owner-contact-card';
import { supabase } from '@/lib/supabase';
import type { DealEvent, DealWithParties } from '@/lib/domain';
import { formatDate, formatEGP } from '@/lib/format';
import { translateError } from '@/lib/messages';
import { buttonPrimary, cardClass } from '@/lib/ui';

interface DealDetailProps {
  dealId: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; deal: DealWithParties; events: DealEvent[] };

export function DealDetail({ dealId }: DealDetailProps) {
  const { profile } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [dealResult, eventsResult] = await Promise.all([
        supabase
          .from('deals')
          .select('*, owner:profiles!owner_id(full_name), worker:profiles!worker_id(full_name)')
          .eq('id', dealId)
          .maybeSingle(),
        supabase.from('deal_events').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
      ]);
      if (!active) return;
      if (dealResult.error || eventsResult.error) {
        setState({ status: 'error' });
        return;
      }
      if (!dealResult.data) {
        setState({ status: 'missing' });
        return;
      }
      setState({
        status: 'ready',
        deal: dealResult.data as DealWithParties,
        events: (eventsResult.data ?? []) as DealEvent[],
      });
    })();
    return () => {
      active = false;
    };
  }, [dealId, reloadKey]);

  const completeDeal = async () => {
    setMessage(null);
    setCompleting(true);
    const { error } = await supabase.rpc('complete_deal', { p_deal_id: dealId });
    setCompleting(false);

    if (error) {
      setMessage({ tone: 'error', text: translateError(error) });
      return;
    }
    setMessage({ tone: 'success', text: 'تم تسجيل إتمام الاتفاق في السجل' });
    setReloadKey((key) => key + 1);
  };

  if (state.status === 'loading') return <LoadingState label="جاري تحميل الاتفاق..." />;
  if (state.status === 'missing') {
    return <NoticePanel title="الاتفاق غير متاح" description="هذا الاتفاق غير موجود، أو أنك لست أحد طرفيه." />;
  }
  if (state.status === 'error') {
    return <NoticePanel tone="error" title="تعذر تحميل الاتفاق" description="حدث خطأ أثناء تحميل تفاصيل الاتفاق. حاول مرة أخرى." />;
  }

  const { deal, events } = state;
  const isOwner = profile?.id === deal.owner_id;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-800">
        <ArrowRight className="h-4 w-4" aria-hidden />
        العودة إلى لوحتي
      </Link>

      <header className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-slate-500" dir="ltr">
            {deal.deal_number}
          </p>
          <h1 className="text-3xl font-bold leading-tight text-slate-900">{deal.listing_title}</h1>
        </div>
        <DealStatusBadge status={deal.status} />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <section className={`${cardClass} grid gap-6 sm:grid-cols-2`}>
            <Party label="صاحب الفرصة" name={deal.owner?.full_name} />
            <Party label="المتقدم المقبول" name={deal.worker?.full_name} />
            <Party label="سعر الفرصة" name={formatEGP(deal.listing_price)} />
            <Party
              label={isOwner ? 'صافي عمولة المسوق' : 'صافي عمولتك'}
              name={deal.worker_commission_amount === null ? null : formatEGP(deal.worker_commission_amount)}
              highlight
            />
          </section>

          <section className={`${cardClass} flex flex-col gap-3`}>
            <h2 className="text-lg font-bold text-slate-900">شروط استحقاق العمولة</h2>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{deal.commission_terms}</p>
          </section>

          <section className={`${cardClass} flex flex-col gap-5`}>
            <h2 className="text-lg font-bold text-slate-900">سجل الاتفاق</h2>
            <ol className="relative flex flex-col gap-6 ps-6">
              <span className="absolute start-[7px] top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden />
              {events.map((event) => (
                <li key={event.id} className="relative flex flex-col gap-1">
                  <span
                    className={`absolute -start-6 top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                      event.event_type === 'completed' ? 'bg-emerald-600' : 'bg-brand-600'
                    }`}
                    aria-hidden
                  />
                  <p className="text-sm font-bold text-slate-900">{event.note ?? 'تحديث على الاتفاق'}</p>
                  <p className="text-xs text-slate-500">{formatDate(event.created_at)}</p>
                </li>
              ))}
              {deal.status === 'active' && (
                <li className="relative flex flex-col gap-1">
                  <span className="absolute -start-6 top-1 h-4 w-4 rounded-full bg-slate-300 ring-4 ring-white" aria-hidden />
                  <p className="text-sm font-bold text-slate-400">بانتظار إتمام الاتفاق</p>
                </li>
              )}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {!isOwner && <OwnerContactCard listingId={deal.listing_id} />}
          {isOwner && <CommissionBreakdownCard dealId={deal.id} />}
          {isOwner && deal.status === 'active' && (
            <section className={`${cardClass} flex flex-col gap-4`}>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <CalendarCheck className="h-5 w-5 text-brand-700" aria-hidden />
                إتمام الاتفاق
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                عند إتمام المهمة وتحقق شروط العمولة، سجّل إتمام الاتفاق ليُحفظ في السجل بتاريخ اليوم.
              </p>
              <button type="button" onClick={completeDeal} disabled={completing} className={buttonPrimary}>
                {completing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                تسجيل إتمام الاتفاق
              </button>
              {message && (
                <p role="status" className={`text-sm ${message.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {message.text}
                </p>
              )}
            </section>
          )}

          {deal.status === 'completed' && (
            <section className={`${cardClass} flex flex-col gap-3 border-emerald-200 bg-emerald-50/50`}>
              <h2 className="flex items-center gap-2 text-base font-bold text-emerald-900">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                تم إتمام الاتفاق
              </h2>
              <p className="text-sm leading-relaxed text-emerald-900/80">هذا الاتفاق مكتمل ومحفوظ في السجل.</p>
            </section>
          )}

          <section className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <p>
              <span className="mb-1 flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden />
                ملاحظة
              </span>
              هذا السجل يوثق الاتفاق والعمولة فقط، ولا تتم عبره أي تحويلات مالية حالياً.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Party({ label, name, highlight = false }: { label: string; name?: string | null; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className={`text-base font-bold ${highlight ? 'text-gold-700' : 'text-slate-900'}`}>{name ?? 'غير متاح'}</span>
    </div>
  );
}
