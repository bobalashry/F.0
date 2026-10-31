'use client';

import { useEffect, useState } from 'react';
import { Percent } from 'lucide-react';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import type { DealFinancials } from '@/lib/domain';
import { formatEGP } from '@/lib/format';
import { cardClass } from '@/lib/ui';

interface CommissionBreakdownCardProps {
  dealId: string;
}

export function CommissionBreakdownCard({ dealId }: CommissionBreakdownCardProps) {
  const [financials, setFinancials] = useState<DealFinancials | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('deal_financials').select('*').eq('deal_id', dealId).maybeSingle();
      if (!active) return;
      if (error || !data) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setFinancials(data as DealFinancials);
    })();
    return () => {
      active = false;
    };
  }, [dealId]);

  if (failed) {
    return <NoticePanel tone="error" title="تعذر تحميل تفاصيل العمولة" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  }
  if (!financials) return <LoadingState label="جاري تحميل تفاصيل العمولة..." />;

  const rows = [
    { label: 'العمولة الإجمالية', value: formatEGP(financials.commission_total), tone: 'text-slate-900' },
    {
      label: `خصم المنصة (${financials.platform_fee_percent.toLocaleString('ar-EG')}%)`,
      value: `- ${formatEGP(financials.platform_fee_amount)}`,
      tone: 'text-rose-700',
    },
    { label: 'صافي عمولة المسوق', value: formatEGP(financials.worker_commission_amount), tone: 'text-gold-700' },
  ];

  return (
    <section className={`${cardClass} flex flex-col gap-5`}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Percent className="h-5 w-5 text-brand-700" aria-hidden />
        توزيع العمولة
      </h2>
      <dl className="flex flex-col divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-slate-600">{row.label}</dt>
            <dd className={`text-sm font-bold ${row.tone}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-slate-500">
        تُحسب المبالغ عند قبول المتقدم وتُحفظ في الاتفاق، ولا تتغير مع تعديل الفرصة لاحقاً.
      </p>
    </section>
  );
}
