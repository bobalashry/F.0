'use client';

import { useEffect, useState } from 'react';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { DealStatusBadge } from '@/components/deals/deal-status-badge';
import { supabase } from '@/lib/supabase';
import { PLATFORM_FEE_PERCENT, type DealStatus } from '@/lib/domain';
import { formatDate, formatEGP } from '@/lib/format';
import { cardClass } from '@/lib/ui';

interface FinanceSummary {
  commission_total: number;
  platform_fee_total: number;
  worker_net_total: number;
  completed_deals: number;
  active_deals: number;
}

interface AdminDeal {
  deal_id: string;
  deal_number: string;
  listing_title: string;
  owner_name: string;
  worker_name: string;
  status: DealStatus;
  commission_total: number | null;
  platform_fee_amount: number | null;
  worker_commission_amount: number | null;
  created_at: string;
  completed_at: string | null;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; summary: FinanceSummary; deals: AdminDeal[] };

export function AdminDeals() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      const [summaryResult, dealsResult] = await Promise.all([
        supabase.rpc('admin_finance_summary'),
        supabase.rpc('admin_list_deals', { p_limit: 200 }),
      ]);
      if (!active) return;
      if (summaryResult.error || !summaryResult.data || dealsResult.error || !Array.isArray(dealsResult.data)) {
        setState({ status: 'error' });
        return;
      }
      setState({
        status: 'ready',
        summary: summaryResult.data as FinanceSummary,
        deals: dealsResult.data as AdminDeal[],
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state.status === 'loading') return <LoadingState label="جاري تحميل بيانات الصفقات..." />;
  if (state.status === 'error') {
    return <NoticePanel tone="error" title="تعذر تحميل البيانات" description="حدث خطأ أثناء تحميل الصفقات والعمولات. حدّث الصفحة وحاول مرة أخرى." />;
  }

  const { summary, deals } = state;
  const cards = [
    { label: 'إجمالي العمولات', value: formatEGP(summary.commission_total) },
    { label: `عمولة المنصة (${PLATFORM_FEE_PERCENT}%)`, value: formatEGP(summary.platform_fee_total) },
    { label: 'صافي عمولات المسوقين', value: formatEGP(summary.worker_net_total) },
    { label: 'اتفاقات مكتملة', value: String(summary.completed_deals) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`${cardClass} flex flex-col gap-2 p-5`}>
            <span className="text-xs font-semibold text-slate-500">{card.label}</span>
            <span className="text-xl font-bold text-slate-900">{card.value}</span>
          </div>
        ))}
      </div>

      <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="admin-deals-title">
        <div>
          <h2 id="admin-deals-title" className="text-lg font-bold text-slate-900">
            الاتفاقات والعمولات
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {summary.active_deals} اتفاق نشط. المسوق يرى صافي عمولته فقط، وتظهر هنا التفاصيل كاملة.
          </p>
        </div>

        {deals.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">لا توجد اتفاقات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-start text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 text-start font-semibold">الاتفاق</th>
                  <th className="py-3 text-start font-semibold">الأطراف</th>
                  <th className="py-3 text-start font-semibold">الإجمالي</th>
                  <th className="py-3 text-start font-semibold">عمولة المنصة</th>
                  <th className="py-3 text-start font-semibold">صافي المسوق</th>
                  <th className="py-3 text-start font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deals.map((deal) => (
                  <tr key={deal.deal_id} className="align-top">
                    <td className="py-3 pe-4">
                      <p className="font-bold text-slate-900">{deal.listing_title}</p>
                      <p className="text-xs text-slate-500" dir="ltr">
                        {deal.deal_number}
                      </p>
                      <p className="text-xs text-slate-400">بدأ في {formatDate(deal.created_at)}</p>
                    </td>
                    <td className="py-3 pe-4 text-slate-700">
                      <p>المالك: {deal.owner_name}</p>
                      <p>المسوق: {deal.worker_name}</p>
                    </td>
                    <td className="py-3 pe-4 font-semibold text-slate-900">
                      {deal.commission_total === null ? '-' : formatEGP(deal.commission_total)}
                    </td>
                    <td className="py-3 pe-4 text-rose-700">
                      {deal.platform_fee_amount === null ? '-' : formatEGP(deal.platform_fee_amount)}
                    </td>
                    <td className="py-3 pe-4 font-semibold text-gold-700">
                      {deal.worker_commission_amount === null ? '-' : formatEGP(deal.worker_commission_amount)}
                    </td>
                    <td className="py-3">
                      <DealStatusBadge status={deal.status} />
                      {deal.completed_at && <p className="mt-1 text-xs text-slate-500">أُتم في {formatDate(deal.completed_at)}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
