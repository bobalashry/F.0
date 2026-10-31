'use client';

import { useEffect, useState } from 'react';
import { Building2, Phone } from 'lucide-react';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import type { OwnerContact } from '@/lib/domain';
import { cardClass } from '@/lib/ui';

interface OwnerContactCardProps {
  listingId: string;
}

export function OwnerContactCard({ listingId }: OwnerContactCardProps) {
  const [contact, setContact] = useState<OwnerContact | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_owner_contact', { p_listing_id: listingId });
      if (!active) return;
      if (error || !Array.isArray(data) || data.length === 0) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setContact(data[0] as OwnerContact);
    })();
    return () => {
      active = false;
    };
  }, [listingId]);

  if (failed) {
    return <NoticePanel tone="error" title="تعذر تحميل بيانات التواصل" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  }
  if (!contact) return <LoadingState label="جاري تحميل بيانات التواصل..." />;

  const rows = [
    { label: 'اسم المعرض', value: contact.company_name },
    { label: 'المسؤول', value: contact.responsible_person },
    { label: 'المحافظة', value: contact.governorate },
    { label: 'العنوان', value: contact.address },
  ];

  return (
    <section className={`${cardClass} flex flex-col gap-5 border-brand-200`}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Building2 className="h-5 w-5 text-brand-700" aria-hidden />
        بيانات التواصل مع المعرض
      </h2>
      <p className="text-sm leading-relaxed text-slate-600">تظهر لك هذه البيانات لأن طلبك على هذه الفرصة مقبول.</p>
      <dl className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <dt className="text-xs font-semibold text-slate-500">{row.label}</dt>
            <dd className="text-sm font-bold text-slate-900">{row.value || 'غير مسجل'}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold text-slate-500">رقم الموبايل</dt>
          <dd>
            {contact.phone ? (
              <a href={`tel:${contact.phone}`} dir="ltr" className="inline-flex items-center gap-2 text-sm font-bold text-brand-800 hover:underline">
                <Phone className="h-4 w-4" aria-hidden />
                {contact.phone}
              </a>
            ) : (
              <span className="text-sm font-bold text-slate-900">غير مسجل</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
