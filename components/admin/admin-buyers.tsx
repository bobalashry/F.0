'use client';

import { useEffect, useState } from 'react';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { BuyerStatusBadge } from '@/components/sell/buyer-status-badge';
import { supabase } from '@/lib/supabase';
import { buyerStatusLabel, type BuyerStatus } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { cardClass } from '@/lib/ui';

interface AdminBuyer {
  id: string;
  reference_number: string;
  buyer_name: string;
  buyer_phone: string;
  status: BuyerStatus;
  objection_evidence: string | null;
  protection_ends_at: string | null;
  created_at: string;
  listing_title: string;
  worker_name: string;
  owner_name: string;
}

type Filter = 'all' | BuyerStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: buyerStatusLabel.pending },
  { value: 'objected', label: buyerStatusLabel.objected },
  { value: 'accepted', label: buyerStatusLabel.accepted },
];

export function AdminBuyers() {
  const [filter, setFilter] = useState<Filter>('all');
  const [buyers, setBuyers] = useState<AdminBuyer[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setBuyers(null);
      const { data, error } = await supabase.rpc('admin_list_buyers', {
        p_status: filter === 'all' ? null : filter,
        p_limit: 200,
      });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setBuyers([]);
        return;
      }
      setFailed(false);
      setBuyers(data as AdminBuyer[]);
    })();
    return () => {
      active = false;
    };
  }, [filter]);

  return (
    <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="admin-buyers-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="admin-buyers-title" className="text-lg font-bold text-slate-900">
            العملاء المسجلون والاعتراضات
          </h2>
          <p className="mt-1 text-sm text-slate-500">متابعة كل عميل سجّله مسوق، مع أي اعتراض من صاحب الفرصة ودليله.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية حسب الحالة">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filter === item.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {buyers === null ? (
        <LoadingState label="جاري تحميل العملاء..." />
      ) : failed ? (
        <NoticePanel tone="error" title="تعذر تحميل العملاء" description="حدث خطأ أثناء تحميل البيانات. حدّث الصفحة وحاول مرة أخرى." />
      ) : buyers.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">لا توجد نتائج لهذا الفلتر.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-start text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 text-start font-semibold">العميل</th>
                <th className="py-3 text-start font-semibold">الإعلان</th>
                <th className="py-3 text-start font-semibold">المسوق</th>
                <th className="py-3 text-start font-semibold">الحالة</th>
                <th className="py-3 text-start font-semibold">الحماية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buyers.map((buyer) => (
                <tr key={buyer.id} className="align-top">
                  <td className="py-3 pe-4">
                    <p className="font-bold text-slate-900">{buyer.buyer_name}</p>
                    <p dir="ltr" className="text-start text-xs text-slate-500">
                      {buyer.buyer_phone}
                    </p>
                    <p className="text-xs text-slate-400">{buyer.reference_number}</p>
                  </td>
                  <td className="py-3 pe-4 text-slate-700">
                    {buyer.listing_title}
                    <p className="text-xs text-slate-500">صاحب الفرصة: {buyer.owner_name}</p>
                  </td>
                  <td className="py-3 pe-4 text-slate-700">{buyer.worker_name}</td>
                  <td className="py-3 pe-4">
                    <BuyerStatusBadge status={buyer.status} />
                    {buyer.status === 'objected' && buyer.objection_evidence && (
                      <p className="mt-2 max-w-xs rounded-lg bg-rose-50 p-2 text-xs leading-relaxed text-rose-800">
                        {buyer.objection_evidence}
                      </p>
                    )}
                  </td>
                  <td className="py-3 text-xs text-slate-500">
                    {buyer.protection_ends_at ? `حتى ${formatDate(buyer.protection_ends_at)}` : 'غير مفعّلة'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
