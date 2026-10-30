'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { accountTypeLabel, accountTypeRequestStatusLabel, type AccountTypeRequest, type AccountTypeRequestStatus } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { translateError } from '@/lib/messages';
import { formatDate } from '@/lib/format';
import { buttonDanger, buttonPrimary, cardClass, inputClass, labelClass } from '@/lib/ui';

interface RequestRow extends AccountTypeRequest {
  member_name: string;
}

const statusTone: Record<AccountTypeRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function AdminTypeRequests() {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('account_type_requests')
        .select('id, user_id, current_type, requested_type, reason, status, admin_note, created_at, reviewed_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setRows([]);
        return;
      }
      const requests = data as AccountTypeRequest[];
      const userIds = [...new Set(requests.map((request) => request.user_id))];
      const names = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        for (const profile of (profiles ?? []) as { id: string; full_name: string }[]) {
          names.set(profile.id, profile.full_name);
        }
      }
      if (!active) return;
      setFailed(false);
      setRows(
        requests.map((request) => ({
          ...request,
          member_name: names.get(request.user_id) || 'بدون اسم',
        })),
      );
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (rows === null) return <LoadingState label="جاري تحميل الطلبات..." />;
  if (failed) return <NoticePanel tone="error" title="تعذر تحميل الطلبات" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  if (rows.length === 0) return <NoticePanel title="لا توجد طلبات" description="ستظهر هنا طلبات تغيير نوع الحساب عند تقديمها." />;

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <TypeRequestCard key={row.id} row={row} onReviewed={() => setReloadKey((key) => key + 1)} />
      ))}
    </div>
  );
}

function TypeRequestCard({ row, onReviewed }: { row: RequestRow; onReviewed: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = async (approve: boolean) => {
    setError(null);
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('review_account_type_request', {
      p_request_id: row.id,
      p_approve: approve,
      p_note: note.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError(translateError(rpcError));
      return;
    }
    toast.success(approve ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب');
    onReviewed();
  };

  return (
    <article className={`${cardClass} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{row.member_name}</h3>
          <p className="text-sm text-slate-600">
            من {accountTypeLabel[row.current_type]} إلى {accountTypeLabel[row.requested_type]} · {formatDate(row.created_at)}
          </p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[row.status]}`}>
          {accountTypeRequestStatusLabel[row.status]}
        </span>
      </div>

      <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-900">سبب الطلب: </span>
        {row.reason}
      </p>

      {row.status !== 'pending' && row.admin_note && (
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">ملاحظة الإدارة: </span>
          {row.admin_note}
        </p>
      )}

      {row.status === 'pending' && (
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
          <div>
            <label htmlFor={`note-${row.id}`} className={labelClass}>
              ملاحظة للعضو (اختيارية)
            </label>
            <textarea id={`note-${row.id}`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => review(true)} className={buttonPrimary}>
              قبول الطلب
            </button>
            <button type="button" disabled={busy} onClick={() => review(false)} className={buttonDanger}>
              رفض الطلب
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
