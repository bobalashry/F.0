'use client';

import { useEffect, useState } from 'react';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import type { AdminStats } from '@/lib/admin';
import { formatEGP } from '@/lib/format';
import { cardClass } from '@/lib/ui';

export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('admin_stats');
      if (!active) return;
      if (error || !data || typeof data !== 'object') {
        setFailed(true);
        return;
      }
      setStats(data as AdminStats);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return <NoticePanel tone="error" title="تعذر تحميل الإحصائيات" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  }
  if (!stats) return <LoadingState label="جاري تحميل الإحصائيات..." />;

  const cards = [
    { label: 'عدد الأعضاء', value: String(stats.members) },
    { label: 'أصحاب الفرص', value: String(stats.owners) },
    { label: 'الباحثون عن فرص', value: String(stats.workers) },
    { label: 'حسابات موقوفة أو محظورة', value: String(stats.restricted_accounts) },
    { label: 'إجمالي الإعلانات', value: String(stats.listings) },
    { label: 'إعلانات منشورة', value: String(stats.active_listings) },
    { label: 'عدد الصفقات', value: String(stats.deals) },
    { label: 'طلبات تغيير النوع قيد المراجعة', value: String(stats.pending_type_requests) },
    { label: 'إجمالي العمولات المسجلة', value: formatEGP(stats.commissions_total) },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <li key={card.label} className={`${cardClass} flex flex-col gap-2`}>
          <span className="text-sm font-semibold text-slate-500">{card.label}</span>
          <span className="text-3xl font-bold text-slate-900">{card.value}</span>
        </li>
      ))}
    </ul>
  );
}
