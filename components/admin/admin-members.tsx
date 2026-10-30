'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminMemberDialog } from '@/components/admin/admin-member-dialog';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { accountTypeLabel, profileStatusLabel, type AdminMember } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { cardClass, inputClass } from '@/lib/ui';

const statusTone: Record<AdminMember['status'], string> = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  suspended: 'bg-amber-50 text-amber-800 ring-amber-200',
  banned: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function AdminMembers() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<AdminMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<AdminMember | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('admin_list_members', { p_search: search, p_limit: 100 });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setMembers([]);
        return;
      }
      setFailed(false);
      setMembers(data as AdminMember[]);
    })();
    return () => {
      active = false;
    };
  }, [search, reloadKey]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالاسم أو البريد الإلكتروني"
          aria-label="بحث في الأعضاء"
          className={`${inputClass} pe-11`}
        />
      </div>

      {members === null ? (
        <LoadingState label="جاري تحميل الأعضاء..." />
      ) : failed ? (
        <NoticePanel tone="error" title="تعذر تحميل الأعضاء" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />
      ) : members.length === 0 ? (
        <NoticePanel title="لا توجد نتائج" description="لم نجد أعضاء مطابقين للبحث." />
      ) : (
        <div className={`${cardClass} overflow-x-auto p-0`}>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3 text-start font-semibold">الاسم</th>
                <th className="px-5 py-3 text-start font-semibold">البريد الإلكتروني</th>
                <th className="px-5 py-3 text-start font-semibold">نوع الحساب</th>
                <th className="px-5 py-3 text-start font-semibold">الحالة</th>
                <th className="px-5 py-3 text-start font-semibold">تاريخ التسجيل</th>
                <th className="px-5 py-3 text-start font-semibold">
                  <span className="sr-only">الإجراءات</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.user_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-semibold text-slate-900">
                    {member.full_name || 'بدون اسم'}
                    {member.admin_role && (
                      <span className="ms-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                        {member.admin_role === 'super_admin' ? 'المالك الأعلى' : 'مشرف'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600" dir="ltr">
                    {member.email}
                  </td>
                  <td className="px-5 py-3 text-slate-700">{accountTypeLabel[member.account_type]}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[member.status]}`}>
                      {profileStatusLabel[member.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(member.created_at)}</td>
                  <td className="px-5 py-3 text-end">
                    <button
                      type="button"
                      onClick={() => setSelected(member)}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                    >
                      إدارة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminMemberDialog
        member={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          setReloadKey((key) => key + 1);
        }}
      />
    </div>
  );
}
