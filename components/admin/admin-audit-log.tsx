'use client';

import { useEffect, useState } from 'react';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { ADMIN_ACTION_LABELS, type AuditLogEntry } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { cardClass } from '@/lib/ui';

const describeDetails = (details: Record<string, unknown>) => {
  const parts: string[] = [];
  if (typeof details.status === 'string') parts.push(`الحالة: ${details.status}`);
  if (typeof details.reason === 'string' && details.reason) parts.push(`السبب: ${details.reason}`);
  if (typeof details.approved === 'boolean') parts.push(details.approved ? 'تمت الموافقة' : 'تم الرفض');
  if (typeof details.email === 'string') parts.push(`البريد: ${details.email}`);
  return parts.join(' · ');
};

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('id, actor_name, action, target_type, target_id, details, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setEntries([]);
        return;
      }
      setEntries(data as AuditLogEntry[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (entries === null) return <LoadingState label="جاري تحميل سجل النشاط..." />;
  if (failed) return <NoticePanel tone="error" title="تعذر تحميل السجل" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  if (entries.length === 0) return <NoticePanel title="لا يوجد نشاط مسجل" description="ستظهر هنا كل الإجراءات الإدارية فور تنفيذها." />;

  return (
    <div className={`${cardClass} overflow-x-auto p-0`}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-start text-slate-600">
          <tr>
            <th className="px-5 py-3 text-start font-semibold">التاريخ والوقت</th>
            <th className="px-5 py-3 text-start font-semibold">المشرف</th>
            <th className="px-5 py-3 text-start font-semibold">الإجراء</th>
            <th className="px-5 py-3 text-start font-semibold">التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-slate-100 last:border-0">
              <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(entry.created_at)}</td>
              <td className="px-5 py-3 font-semibold text-slate-900">{entry.actor_name}</td>
              <td className="px-5 py-3 text-slate-800">{ADMIN_ACTION_LABELS[entry.action] ?? entry.action}</td>
              <td className="px-5 py-3 text-slate-600">{describeDetails(entry.details) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
