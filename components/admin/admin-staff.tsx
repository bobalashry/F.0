'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPermissionsDialog, type PermissionTarget } from '@/components/admin/admin-permissions-dialog';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { ADMIN_PERMISSIONS, type AdminMember, type AdminPermission, type AdminStaffMember } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { translateError } from '@/lib/messages';
import { buttonDanger, buttonSecondary, cardClass, inputClass } from '@/lib/ui';

const permissionLabel = (value: AdminPermission) => ADMIN_PERMISSIONS.find((item) => item.value === value)?.label ?? value;

export function AdminStaff() {
  const [staff, setStaff] = useState<AdminStaffMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [permissionTarget, setPermissionTarget] = useState<PermissionTarget | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('admin_list_staff');
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setStaff([]);
        return;
      }
      setFailed(false);
      setStaff(data as AdminStaffMember[]);
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = () => setReloadKey((key) => key + 1);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">فريق الإدارة</h2>
          <p className="text-sm text-slate-600">حساب المالك الأعلى محمي ولا يمكن تعديله أو إيقافه من هنا.</p>
        </div>

        {staff === null ? (
          <LoadingState label="جاري تحميل المشرفين..." />
        ) : failed ? (
          <NoticePanel tone="error" title="تعذر تحميل المشرفين" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />
        ) : (
          <ul className="flex flex-col gap-3">
            {staff.map((member) => {
              const isSuper = member.admin_role === 'super_admin';
              return (
                <li key={member.user_id} className={`${cardClass} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-900">
                      {member.full_name || 'بدون اسم'}
                      <span className="ms-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                        {isSuper ? 'المالك الأعلى' : 'مشرف مساعد'}
                      </span>
                    </span>
                    <span className="text-sm text-slate-500" dir="ltr">
                      {member.email}
                    </span>
                    <span className="text-sm text-slate-700">
                      {isSuper
                        ? 'صلاحيات كاملة'
                        : member.is_active
                          ? member.permissions.map(permissionLabel).join(' · ') || 'بدون صلاحيات'
                          : 'موقوف'}
                    </span>
                  </div>

                  {isSuper ? (
                    <span className="text-sm font-semibold text-slate-500">محمي</span>
                  ) : (
                    <AssistantActions member={member} onEdit={() => setPermissionTarget({ user_id: member.user_id, full_name: member.full_name, email: member.email, permissions: member.is_active ? member.permissions : [] })} onChanged={refresh} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddAssistantSection onPick={(member) => setPermissionTarget({ user_id: member.user_id, full_name: member.full_name, email: member.email, permissions: [] })} />

      <AdminPermissionsDialog
        target={permissionTarget}
        onClose={() => setPermissionTarget(null)}
        onSaved={() => {
          setPermissionTarget(null);
          refresh();
        }}
      />
    </div>
  );
}

function AssistantActions({ member, onEdit, onChanged }: { member: AdminStaffMember; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suspend = async () => {
    setError(null);
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('admin_revoke_access', { p_user_id: member.user_id });
    setBusy(false);
    if (rpcError) {
      setError(translateError(rpcError));
      return;
    }
    toast.success('تم إيقاف المشرف');
    onChanged();
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onEdit} className={buttonSecondary}>
          {member.is_active ? 'تعديل الصلاحيات' : 'إعادة تفعيل'}
        </button>
        {member.is_active && (
          <button type="button" disabled={busy} onClick={suspend} className={buttonDanger}>
            إيقاف المشرف
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

function AddAssistantSection({ onPick }: { onPick: (member: AdminMember) => void }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AdminMember[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!search) {
      setResults(null);
      setFailed(false);
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('admin_list_members', { p_search: search, p_limit: 20 });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setResults([]);
        return;
      }
      setFailed(false);
      setResults((data as AdminMember[]).filter((member) => member.admin_role === null));
    })();
    return () => {
      active = false;
    };
  }, [search]);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">إضافة مشرف مساعد</h2>
        <p className="text-sm text-slate-600">ابحث عن عضو مسجل في المنصة ثم امنحه الصلاحيات المناسبة.</p>
      </div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالاسم أو البريد الإلكتروني"
          aria-label="البحث عن عضو لإضافته مشرفاً"
          className={`${inputClass} pe-11`}
        />
      </div>

      {results && (
        failed ? (
          <NoticePanel tone="error" title="تعذر البحث" description="حدث خطأ أثناء البحث. حاول مرة أخرى." />
        ) : results.length === 0 ? (
          <p className="text-sm text-slate-500">لا يوجد عضو مطابق يمكن ترقيته إلى مشرف.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {results.map((member) => (
              <li key={member.user_id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-900">{member.full_name || 'بدون اسم'}</span>
                  <span className="text-sm text-slate-500" dir="ltr">
                    {member.email}
                  </span>
                </div>
                <button type="button" onClick={() => onPick(member)} className={buttonSecondary}>
                  منح صلاحيات
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
