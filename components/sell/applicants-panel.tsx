'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, UserRound, XCircle } from 'lucide-react';
import { ApplicationStatusBadge } from '@/components/sell/application-status-badge';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import type { ApplicationWithWorker, ListingStatus } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { translateError } from '@/lib/messages';
import { buttonPrimary, buttonDanger, cardClass } from '@/lib/ui';

interface ApplicantsPanelProps {
  listingId: string;
  listingStatus: ListingStatus;
}

export function ApplicantsPanel({ listingId, listingStatus }: ApplicantsPanelProps) {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationWithWorker[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('*, worker:profiles!worker_id(full_name)')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setApplications([]);
        return;
      }
      setFailed(false);
      setApplications(data as ApplicationWithWorker[]);
    })();
    return () => {
      active = false;
    };
  }, [listingId, reloadKey]);

  const accept = async (application: ApplicationWithWorker) => {
    setMessage(null);
    setBusyId(application.id);
    const { data, error } = await supabase.rpc('accept_application', { p_application_id: application.id });
    setBusyId(null);

    if (error || typeof data !== 'string') {
      setMessage({ tone: 'error', text: translateError(error) });
      return;
    }
    router.push(`/deals/${data}`);
  };

  const reject = async (application: ApplicationWithWorker) => {
    setMessage(null);
    setBusyId(application.id);
    const { error } = await supabase.rpc('reject_application', { p_application_id: application.id });
    setBusyId(null);

    if (error) {
      setMessage({ tone: 'error', text: translateError(error) });
      return;
    }
    setApplications((current) =>
      current?.map((item) => (item.id === application.id ? { ...item, status: 'rejected' } : item)) ?? null,
    );
    setMessage({ tone: 'success', text: `تم رفض طلب ${application.worker?.full_name ?? 'المتقدم'}` });
  };

  return (
    <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="applicants-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="applicants-title" className="text-lg font-bold text-slate-900">
            المتقدمون على الفرصة
          </h2>
          <p className="mt-1 text-sm text-slate-500">راجع رسالة كل متقدم، ثم اقبل المناسب لتوثيق الاتفاق.</p>
        </div>
      </div>

      {message && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.tone === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {message.text}
        </p>
      )}

      {applications === null ? (
        <LoadingState label="جاري تحميل المتقدمين..." />
      ) : failed ? (
        <NoticePanel tone="error" title="تعذر تحميل المتقدمين" description="حدث خطأ أثناء تحميل الطلبات. حاول تحديث الصفحة." />
      ) : applications.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          لا يوجد متقدمون حتى الآن. ستظهر الطلبات هنا فور وصولها.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {applications.map((application) => {
            const busy = busyId === application.id;
            return (
              <li key={application.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                      <UserRound className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{application.worker?.full_name ?? 'مستخدم'}</p>
                      <p className="text-xs text-slate-500">تقدم في {formatDate(application.created_at)}</p>
                    </div>
                  </div>
                  <ApplicationStatusBadge status={application.status} />
                </div>

                <p className="whitespace-pre-line rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-700">{application.message}</p>

                {application.status === 'pending' && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => reject(application)}
                      disabled={busy || listingStatus !== 'active'}
                      className={buttonDanger}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                      رفض
                    </button>
                    <button
                      type="button"
                      onClick={() => accept(application)}
                      disabled={busy || listingStatus !== 'active'}
                      className={buttonPrimary}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                      قبول وتوثيق الاتفاق
                    </button>
                  </div>
                )}
                {application.status === 'pending' && listingStatus !== 'active' && (
                  <p className="text-xs text-amber-700">فعّل الإعلان أولاً لتتمكن من قبول المتقدمين.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
