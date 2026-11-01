'use client';

import { useEffect, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AdminAuditLog } from '@/components/admin/admin-audit-log';
import { AdminBuyers } from '@/components/admin/admin-buyers';
import { AdminDeals } from '@/components/admin/admin-deals';
import { AdminListings } from '@/components/admin/admin-listings';
import { AdminRatings } from '@/components/admin/admin-ratings';
import { AdminMembers } from '@/components/admin/admin-members';
import { AdminOverview } from '@/components/admin/admin-overview';
import { AdminSignIn } from '@/components/admin/admin-sign-in';
import { AdminStaff } from '@/components/admin/admin-staff';
import { AdminTypeRequests } from '@/components/admin/admin-type-requests';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import type { AdminAccess, AdminPermission } from '@/lib/admin';
import { buttonPrimary, buttonSecondary } from '@/lib/ui';

type Tab = 'overview' | 'members' | 'listings' | 'buyers' | 'deals' | 'ratings' | 'requests' | 'staff' | 'log';

type GateState =
  | { status: 'checking' }
  | { status: 'signed-out' }
  | { status: 'no-access' }
  | { status: 'error' }
  | { status: 'ready'; access: AdminAccess };

const hasPermission = (access: AdminAccess, permission: AdminPermission) =>
  access.role === 'super_admin' || access.permissions.includes(permission);

const TABS: { value: Tab; label: string; visible: (access: AdminAccess) => boolean }[] = [
  { value: 'overview', label: 'نظرة عامة', visible: () => true },
  { value: 'members', label: 'الأعضاء', visible: (access) => hasPermission(access, 'members') },
  { value: 'listings', label: 'الإعلانات', visible: (access) => hasPermission(access, 'listings') },
  { value: 'buyers', label: 'العملاء', visible: (access) => hasPermission(access, 'listings') },
  { value: 'deals', label: 'الصفقات والعمولات', visible: (access) => access.role === 'super_admin' },
  { value: 'ratings', label: 'التقييمات', visible: (access) => hasPermission(access, 'members') },
  { value: 'requests', label: 'طلبات تغيير النوع', visible: (access) => hasPermission(access, 'members') },
  { value: 'staff', label: 'المشرفون', visible: (access) => access.role === 'super_admin' },
  { value: 'log', label: 'سجل النشاط', visible: () => true },
];

export function AdminConsole() {
  const { session, loading, signOut } = useAuth();
  const userId = session?.user.id ?? null;
  const [gate, setGate] = useState<GateState>({ status: 'checking' });
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setGate({ status: 'signed-out' });
      return;
    }
    let active = true;
    setGate({ status: 'checking' });
    (async () => {
      const { data, error } = await supabase
        .from('admin_members')
        .select('role, permissions, is_active')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setGate({ status: 'error' });
        return;
      }
      if (!data || !data.is_active) {
        setGate({ status: 'no-access' });
        return;
      }
      setGate({ status: 'ready', access: { role: data.role, permissions: data.permissions } });
    })();
    return () => {
      active = false;
    };
  }, [loading, userId]);

  if (loading || gate.status === 'checking') return <LoadingState label="جاري التحقق من الصلاحيات..." />;
  if (gate.status === 'signed-out') return <AdminSignIn />;

  if (gate.status === 'error' || gate.status === 'no-access') {
    return (
      <NoticePanel
        tone={gate.status === 'error' ? 'error' : 'neutral'}
        title={gate.status === 'error' ? 'تعذر التحقق من صلاحياتك' : 'لا تملك صلاحية الوصول'}
        description={
          gate.status === 'error'
            ? 'حدث خطأ أثناء التحقق. حاول مرة أخرى بعد قليل.'
            : 'هذه الصفحة مخصصة لفريق إدارة فرصة فقط.'
        }
        action={
          <button type="button" onClick={() => signOut()} className={`${buttonSecondary} mt-2`}>
            <LogOut className="h-4 w-4" aria-hidden />
            تسجيل الخروج
          </button>
        }
      />
    );
  }

  const access = gate.access;
  const visibleTabs = TABS.filter((item) => item.visible(access));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-brand-700">
              {access.role === 'super_admin' ? 'المالك الأعلى للمنصة' : 'مشرف مساعد'}
            </p>
            <h1 className="text-2xl font-bold text-slate-900">لوحة إدارة فرصة</h1>
          </div>
        </div>
        <button type="button" onClick={() => signOut()} className={`${buttonSecondary} self-start md:self-auto`}>
          <LogOut className="h-4 w-4" aria-hidden />
          تسجيل الخروج
        </button>
      </header>

      <nav className="mt-8 flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1" aria-label="أقسام الإدارة">
        {visibleTabs.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-current={tab === item.value ? 'page' : undefined}
            onClick={() => setTab(item.value)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === item.value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === 'overview' && <AdminOverview />}
        {tab === 'members' && <AdminMembers />}
        {tab === 'listings' && <AdminListings />}
        {tab === 'buyers' && <AdminBuyers />}
        {tab === 'deals' && <AdminDeals />}
        {tab === 'ratings' && <AdminRatings />}
        {tab === 'requests' && <AdminTypeRequests />}
        {tab === 'staff' && <AdminStaff />}
        {tab === 'log' && <AdminAuditLog />}
      </div>
    </div>
  );
}

export { buttonPrimary };
