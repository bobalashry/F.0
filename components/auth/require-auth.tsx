'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import type { AccountType } from '@/lib/domain';
import { buttonPrimary } from '@/lib/ui';

export function RequireAuth({
  children,
  accountType,
}: {
  children: ReactNode;
  accountType?: AccountType;
}) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace('/signin');
  }, [loading, session, router]);

  if (loading) return <LoadingState />;
  if (!session) return null;

  if (!profile) {
    return (
      <NoticePanel
        tone="error"
        title="تعذر تحميل بيانات حسابك"
        description="حدث خطأ أثناء تحميل بيانات حسابك. حاول تسجيل الخروج ثم الدخول مرة أخرى."
      />
    );
  }

  if (accountType && profile.account_type !== accountType) {
    return (
      <NoticePanel
        title="هذه الصفحة غير متاحة لنوع حسابك"
        description={
          accountType === 'owner'
            ? 'هذه الصفحة مخصصة لأصحاب الفرص فقط. يمكن للباحث عن الفرص التقديم على الإعلانات من صفحة الإعلان نفسها.'
            : 'هذه الصفحة مخصصة للباحثين عن الفرص فقط.'
        }
        action={
          <Link href="/dashboard" className={`${buttonPrimary} mt-2`}>
            الذهاب إلى لوحتي
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
