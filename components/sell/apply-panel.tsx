'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send, Undo2 } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ApplicationStatusBadge } from '@/components/sell/application-status-badge';
import { supabase } from '@/lib/supabase';
import type { Application, ListingWithOwner } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { translateError } from '@/lib/messages';
import { buttonDanger, buttonPrimary, cardClass, inputClass, labelClass } from '@/lib/ui';

interface ApplyPanelProps {
  listing: ListingWithOwner;
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; application: Application | null };

export function ApplyPanel({ listing }: ApplyPanelProps) {
  const { profile } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const workerId = profile?.id;

  useEffect(() => {
    if (!workerId) return;
    let active = true;
    (async () => {
      const { data, error: loadError } = await supabase
        .from('applications')
        .select('*')
        .eq('listing_id', listing.id)
        .eq('worker_id', workerId)
        .maybeSingle();
      if (!active) return;
      if (loadError) {
        setLoad({ status: 'error' });
        return;
      }
      setLoad({ status: 'ready', application: (data as Application | null) ?? null });
    })();
    return () => {
      active = false;
    };
  }, [listing.id, workerId, reloadKey]);

  const isActive = listing.status === 'active';

  const handleApply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const message = String(new FormData(event.currentTarget).get('message') ?? '').trim();
    if (message.length < 10) {
      setError('اكتب رسالة تعريفية من 10 أحرف على الأقل');
      return;
    }
    if (message.length > 1000) {
      setError('الرسالة يجب ألا تتجاوز 1000 حرف');
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from('applications').insert({ listing_id: listing.id, message });
    setSubmitting(false);

    if (insertError) {
      setError(translateError(insertError));
      return;
    }
    setSuccess('تم إرسال طلبك بنجاح. ستجد حالته هنا.');
    setReloadKey((key) => key + 1);
  };

  const withdraw = async (application: Application) => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const { error: withdrawError } = await supabase.rpc('withdraw_application', { p_application_id: application.id });
    setSubmitting(false);

    if (withdrawError) {
      setError(translateError(withdrawError));
      return;
    }
    setSuccess('تم سحب طلبك');
    setReloadKey((key) => key + 1);
  };

  if (load.status === 'loading') {
    return (
      <div className={`${cardClass} flex items-center justify-center gap-2 py-10 text-sm text-slate-500`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        جاري تحميل حالة طلبك...
      </div>
    );
  }

  if (load.status === 'error') {
    return (
      <div role="alert" className={`${cardClass} text-sm text-rose-700`}>
        تعذر تحميل حالة طلبك. حدّث الصفحة وحاول مرة أخرى.
      </div>
    );
  }

  const { application } = load;

  return (
    <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="apply-title">
      <div>
        <h2 id="apply-title" className="text-lg font-bold text-slate-900">
          {application ? 'حالة طلبك' : 'قدّم على هذه الفرصة'}
        </h2>
        {!application && <p className="mt-1 text-sm text-slate-500">عرّف نفسك لصاحب الفرصة بإيجاز وأوضح خبرتك في البيع.</p>}
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

      {application ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <ApplicationStatusBadge status={application.status} />
            <span className="text-xs text-slate-500">أُرسل في {formatDate(application.created_at)}</span>
          </div>
          <p className="whitespace-pre-line rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-700">{application.message}</p>
          {application.status === 'pending' && (
            <button type="button" onClick={() => withdraw(application)} disabled={submitting} className={buttonDanger}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />}
              سحب الطلب
            </button>
          )}
        </div>
      ) : !isActive ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          هذا الإعلان غير متاح للتقديم حالياً.
        </p>
      ) : (
        <form onSubmit={handleApply} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="apply-message" className={labelClass}>
              رسالتك لصاحب الفرصة
            </label>
            <textarea
              id="apply-message"
              name="message"
              rows={5}
              maxLength={1000}
              className={inputClass}
              placeholder="مثال: لدي خبرة 3 سنوات في البيع المباشر وأستطيع الوصول لعملاء في منطقتي..."
            />
          </div>
          <button type="submit" disabled={submitting} className={buttonPrimary}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            إرسال الطلب
          </button>
        </form>
      )}
    </section>
  );
}
