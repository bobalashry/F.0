'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState } from '@/components/common/state-panels';
import { BuyerStatusBadge } from '@/components/sell/buyer-status-badge';
import { supabase } from '@/lib/supabase';
import type { Buyer } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { translateError } from '@/lib/messages';
import { buttonPrimary, cardClass, inputClass, labelClass } from '@/lib/ui';

const PHONE_PATTERN = /^01[0125][0-9]{8}$/;

interface BuyerRegistrationPanelProps {
  listingId: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; hasAcceptedOffer: boolean; buyers: Buyer[] };

export function BuyerRegistrationPanel({ listingId }: BuyerRegistrationPanelProps) {
  const { profile } = useAuth();
  const workerId = profile?.id;
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!workerId) return;
    let active = true;
    (async () => {
      const [offerResult, buyersResult] = await Promise.all([
        supabase
          .from('applications')
          .select('id')
          .eq('listing_id', listingId)
          .eq('worker_id', workerId)
          .eq('status', 'accepted')
          .maybeSingle(),
        supabase.from('buyers').select('*').eq('listing_id', listingId).order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      if (offerResult.error || buyersResult.error || !Array.isArray(buyersResult.data)) {
        setLoad({ status: 'error' });
        return;
      }
      setLoad({
        status: 'ready',
        hasAcceptedOffer: offerResult.data !== null,
        buyers: buyersResult.data as Buyer[],
      });
    })();
    return () => {
      active = false;
    };
  }, [listingId, workerId, reloadKey]);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const buyerName = String(form.get('buyer_name') ?? '').trim();
    const buyerPhone = String(form.get('buyer_phone') ?? '').replace(/\s/g, '');
    const consent = form.get('consent') === 'on';

    if (buyerName.length < 3) {
      setError('اسم العميل يجب أن يكون 3 أحرف على الأقل');
      return;
    }
    if (!PHONE_PATTERN.test(buyerPhone)) {
      setError('أدخل رقم هاتف مصري صحيح (11 رقماً يبدأ بـ 01)');
      return;
    }
    if (!consent) {
      setError('يجب تأكيد موافقة العميل على تسجيل بياناته');
      return;
    }

    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc('register_buyer', {
      p_listing_id: listingId,
      p_buyer_name: buyerName,
      p_buyer_phone: buyerPhone,
      p_consent: consent,
    });
    setSubmitting(false);

    if (rpcError || typeof data !== 'string') {
      setError(translateError(rpcError));
      return;
    }
    event.currentTarget.reset();
    setSuccess('تم تسجيل العميل بنجاح وإرسال بياناته لصاحب الفرصة للمراجعة.');
    setReloadKey((key) => key + 1);
  };

  if (load.status === 'loading' || !workerId) return <LoadingState label="جاري تحميل بيانات العملاء..." />;

  if (load.status === 'error') {
    return (
      <div role="alert" className={`${cardClass} text-sm text-rose-700`}>
        تعذر تحميل بيانات العملاء. حدّث الصفحة وحاول مرة أخرى.
      </div>
    );
  }

  if (!load.hasAcceptedOffer && load.buyers.length === 0) return null;

  return (
    <section className={`${cardClass} flex flex-col gap-6`} aria-labelledby="buyers-register-title">
      <div>
        <h2 id="buyers-register-title" className="text-lg font-bold text-slate-900">
          تسجيل العملاء
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          سجّل العميل الذي جلبته لهذه الفرصة. يحصل العميل المسجل على حماية لمدة 60 يوماً من تاريخ قبول العرض.
        </p>
      </div>

      {success && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {success}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {load.hasAcceptedOffer ? (
        <form onSubmit={handleRegister} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div>
            <label htmlFor="buyer-name" className={labelClass}>
              اسم العميل
            </label>
            <input id="buyer-name" name="buyer_name" maxLength={120} className={inputClass} />
          </div>
          <div>
            <label htmlFor="buyer-phone" className={labelClass}>
              رقم هاتف العميل
            </label>
            <input id="buyer-phone" name="buyer_phone" inputMode="tel" dir="ltr" maxLength={14} className={inputClass} />
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 sm:col-span-2">
            <input type="checkbox" name="consent" className="mt-1 h-4 w-4 accent-brand-700" />
            <span>أؤكد أن العميل وافق على مشاركة اسمه ورقم هاتفه مع صاحب الفرصة لغرض هذه الصفقة.</span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className={buttonPrimary}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
              تسجيل العميل
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          يمكنك تسجيل العملاء بعد قبول صاحب الفرصة لعرضك.
        </p>
      )}

      {load.buyers.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-slate-900">عملاؤك المسجلون</h3>
          <ul className="flex flex-col gap-3">
            {load.buyers.map((buyer) => (
              <li key={buyer.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{buyer.buyer_name}</span>
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
                  <p className="rounded-lg bg-rose-50 p-3 text-xs leading-relaxed text-rose-800">
                    اعتراض صاحب الفرصة: {buyer.objection_evidence}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
