'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import {
  ACCOUNT_TYPE_OTHER,
  accountTypeLabel,
  accountTypeRequestStatusLabel,
  profileStatusLabel,
  type AccountTypeRequest,
} from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { translateError } from '@/lib/messages';
import { buttonPrimary, cardClass, inputClass, labelClass } from '@/lib/ui';

export function AccountSettingsPanel() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [requests, setRequests] = useState<AccountTypeRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('account_type_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setRequests([]);
        return;
      }
      setFailed(false);
      setRequests(data as AccountTypeRequest[]);
    })();
    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  if (!profile) return null;
  if (requests === null) return <LoadingState label="جاري تحميل بيانات حسابك..." />;
  if (failed) {
    return <NoticePanel tone="error" title="تعذر تحميل بيانات حسابك" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  }

  const pending = requests.find((request) => request.status === 'pending');
  const target = ACCOUNT_TYPE_OTHER[profile.account_type];
  const canRequest = profile.status === 'active' && !pending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const trimmed = reason.trim();
    if (trimmed.length < 10 || trimmed.length > 1000) {
      setMessage({ tone: 'error', text: 'يرجى كتابة سبب الطلب بين 10 و1000 حرف' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('request_account_type_change', {
      p_requested_type: target,
      p_reason: trimmed,
    });
    setSubmitting(false);
    if (error) {
      setMessage({ tone: 'error', text: translateError(error) });
      return;
    }
    setReason('');
    setMessage({ tone: 'success', text: 'تم إرسال طلبك، وسيراجعه فريق فرصة قريباً' });
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="account-info-title">
        <h2 id="account-info-title" className="text-lg font-bold text-slate-900">
          بيانات الحساب
        </h2>
        <dl className="grid gap-4 text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-slate-500">الاسم</dt>
            <dd className="font-semibold text-slate-900">{profile.full_name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-slate-500">نوع الحساب</dt>
            <dd className="font-semibold text-slate-900">{accountTypeLabel[profile.account_type]}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-slate-500">المحافظة</dt>
            <dd className="font-semibold text-slate-900">{profile.governorate ?? 'غير محددة'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">حالة الحساب</dt>
            <dd className="font-semibold text-slate-900">{profileStatusLabel[profile.status]}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-col gap-6">
        <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="type-request-title">
          <div>
            <h2 id="type-request-title" className="text-lg font-bold text-slate-900">
              طلب تغيير نوع الحساب
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              لا يمكن تغيير نوع الحساب مباشرة. أرسل طلباً لتحويل حسابك إلى «{accountTypeLabel[target]}»، وستتم مراجعته من فريق فرصة قبل التفعيل.
            </p>
          </div>

          {pending ? (
            <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              <Clock className="h-4 w-4" aria-hidden />
              لديك طلب قيد المراجعة منذ {formatDate(pending.created_at)}
            </p>
          ) : canRequest ? (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <div>
                <label htmlFor="type-reason" className={labelClass}>
                  سبب الطلب
                </label>
                <textarea
                  id="type-reason"
                  rows={4}
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={inputClass}
                  placeholder="اشرح سبب رغبتك في تغيير نوع الحساب"
                />
              </div>
              <button type="submit" disabled={submitting} className={`${buttonPrimary} self-start`}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                إرسال الطلب
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">طلبات تغيير النوع غير متاحة أثناء إيقاف الحساب.</p>
          )}

          {message && (
            <p role="status" className={`text-sm ${message.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
              {message.text}
            </p>
          )}
        </section>

        <section className={`${cardClass} flex flex-col gap-4`} aria-labelledby="type-history-title">
          <h2 id="type-history-title" className="text-lg font-bold text-slate-900">
            سجل الطلبات
          </h2>
          {requests.length === 0 ? (
            <p className="text-sm text-slate-600">لم ترسل أي طلب لتغيير نوع الحساب.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((request) => (
                <li key={request.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">إلى: {accountTypeLabel[request.requested_type]}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-slate-600">
                      {request.status === 'approved' && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />}
                      {request.status === 'rejected' && <XCircle className="h-4 w-4 text-rose-600" aria-hidden />}
                      {accountTypeRequestStatusLabel[request.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">أُرسل في {formatDate(request.created_at)}</p>
                  {request.admin_note && <p className="mt-2 text-slate-700">ملاحظة الإدارة: {request.admin_note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
