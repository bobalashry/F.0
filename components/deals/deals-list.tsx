'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { DealStatusBadge } from '@/components/deals/deal-status-badge';
import { supabase } from '@/lib/supabase';
import type { DealWithParties } from '@/lib/domain';
import { formatCommission } from '@/lib/format';
import { cardClass } from '@/lib/ui';

export function DealsList() {
  const { profile } = useAuth();
  const [deals, setDeals] = useState<DealWithParties[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, owner:profiles!owner_id(full_name), worker:profiles!worker_id(full_name)')
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setDeals([]);
        return;
      }
      setDeals(data as DealWithParties[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (deals === null) return <LoadingState label="جاري تحميل الاتفاقات..." />;
  if (failed) {
    return <NoticePanel tone="error" title="تعذر تحميل الاتفاقات" description="حدث خطأ أثناء تحميل الاتفاقات. حاول مرة أخرى بعد قليل." />;
  }
  if (deals.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        لا توجد اتفاقات موثقة بعد. تظهر هنا الاتفاقات فور قبول أي متقدم على فرصة.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {deals.map((deal) => {
        const isOwner = deal.owner_id === profile?.id;
        const counterpart = isOwner ? deal.worker?.full_name : deal.owner?.full_name;
        return (
          <li key={deal.id}>
            <Link
              href={`/deals/${deal.id}`}
              className={`${cardClass} group flex h-full flex-col gap-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-500" dir="ltr">
                  <FileText className="h-4 w-4" aria-hidden />
                  {deal.deal_number}
                </span>
                <DealStatusBadge status={deal.status} />
              </div>
              <h3 className="line-clamp-2 text-base font-bold text-slate-900 group-hover:text-brand-800">{deal.listing_title}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">{isOwner ? 'المتقدم' : 'صاحب الفرصة'}</p>
                  <p className="font-semibold text-slate-800">{counterpart ?? 'غير متاح'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">العمولة</p>
                  <p className="font-semibold text-gold-700">{formatCommission(deal.commission_type, deal.commission_value)}</p>
                </div>
              </div>
              <span className="mt-auto flex items-center gap-2 text-sm font-bold text-brand-700">
                عرض تفاصيل الاتفاق
                <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
