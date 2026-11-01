'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { BuyerStatusBadge } from '@/components/sell/buyer-status-badge';
import { supabase } from '@/lib/supabase';
import type { Buyer } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { translateError } from '@/lib/messages';
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from '@/lib/ui';

interface BuyersReviewPanelProps {
  listingId: string;
}

export function BuyersReviewPanel({ listingId }: BuyersReviewPanelProps) {
  const [buyers, setBuyers] = useState<Buyer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [objectingId, setObjectingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setBuyers([]);
        return;
      }
      setFailed(false);
      setBuyers(data as Buyer[]);
    })();
    return () => {
      active = false;
    };
  }, [listingId, reloadKey]);

  const decide = async (buyerId: string, decision: 'accept' | 'object', evidence?: string) => {
    setMessage(null);
    setBusyId(buyerId);
    const { error } = await supabase.rpc('decide_buyer', {
      p_buyer_id: buyerId,
      p_decision: decision,
      p_evidence: evidence ?? null,
    });
    setBusyId(null);

    if (error) {
      setMessage({ tone: 'error', text: translateError(error) });
      return;
    }
    setObjectingId(null);
    setMessage({
      tone: 'success',
      text: decision === 'accept' ? 'تم تأكيد العميل ومنحه حماية 60 يوماً' : 'تم تسجيل اعتراضك على العميل',
    });
    setReloadKey((key) => key + 1);
  };

  const handleObject = (event: FormEvent<HTMLFormElement>, buyerId: string) => {
    event.preventDefault();
    const evidence = String(new FormData(event.currentTarget).get('evidence') ?? '').trim();
    if (evidence.length < 10) {
      setMessage({ tone: 'error', text: 'اكتب سبب الاعتراض ودليله (10 أحرف على الأقل)' });
      return;
    }
    decide(buyerId, 'object', evidence);
  };

  return (
    <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="buyers-review-title">
      <div>
        <h2 id="buyers-review-title" className="text-lg font-bold text-slate-900">
          العملاء المسجلون على الفرصة
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          راجع كل عميل سجّله مسوق، ثم أكّده أو اعترض عليه مع توضيح الدليل. التأكيد يمنح العميل حماية 60 يوماً.
        </p>
      </div>

      {message && (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
            message.tone === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {message.tone === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          {message.text}
        </p>
      )}

      {buyers === null ? (
        <LoadingState label="جاري تحميل العملاء..." />
      ) : failed ? (
        <NoticePanel tone="error" title="تعذر تحميل العملاء" description="حدث خطأ أثناء تحميل البيانات. حاول تحديث الصفحة." />
      ) : buyers.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          لم يسجل أي مسوق عملاء على هذه الفرصة بعد.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {buyers.map((buyer) => {
            const busy = busyId === buyer.id;
            const isObjecting = objectingId === buyer.id;
            return (
              <li key={buyer.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                      <UserRound className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{buyer.buyer_name}</p>
                      <p dir="ltr" className="text-start text-xs text-slate-500">
                        {buyer.buyer_phone}
                      </p>
                    </div>
                  </div>
                  <BuyerStatusBadge status={buyer.status} />
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>الرقم المرجعي: {buyer.reference_number}</span>
                  <span>سُجّل في {formatDate(buyer.created_at)}</span>
                  {buyer.protection_ends_at && (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      حماية حتى {formatDate(buyer.protection_ends_at)}
                    </span>
                  )}
                </div>

                {buyer.status === 'objected' && buyer.objection_evidence && (
                  <p className="rounded-lg bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">{buyer.objection_evidence}</p>
                )}

                {buyer.status === 'pending' && !isObjecting && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setObjectingId(buyer.id)} disabled={busy} className={buttonDanger}>
                      اعتراض
                    </button>
                    <button type="button" onClick={() => decide(buyer.id, 'accept')} disabled={busy} className={buttonPrimary}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                      تأكيد العميل
                    </button>
                  </div>
                )}

                {buyer.status === 'pending' && isObjecting && (
                  <form onSubmit={(event) => handleObject(event, buyer.id)} className="flex flex-col gap-3" noValidate>
                    <div>
                      <label htmlFor={`evidence-${buyer.id}`} className={labelClass}>
                        سبب الاعتراض ودليله
                      </label>
                      <textarea id={`evidence-${buyer.id}`} name="evidence" rows={3} maxLength={2000} className={inputClass} />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setObjectingId(null)} disabled={busy} className={buttonSecondary}>
                        تراجع
                      </button>
                      <button type="submit" disabled={busy} className={buttonDanger}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                        إرسال الاعتراض
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
