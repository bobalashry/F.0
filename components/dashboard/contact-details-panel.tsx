'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import type { ContactDetails } from '@/lib/domain';
import { translateError } from '@/lib/messages';
import { buttonPrimary, cardClass, inputClass, labelClass } from '@/lib/ui';

const PHONE_PATTERN = /^01[0125][0-9]{8}$/;

type FormState = Record<'company_name' | 'responsible_person' | 'phone' | 'address' | 'city', string>;

const EMPTY_FORM: FormState = { company_name: '', responsible_person: '', phone: '', address: '', city: '' };

export function ContactDetailsPanel() {
  const { profile } = useAuth();
  const [form, setForm] = useState<FormState | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = profile?.account_type === 'owner';

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('get_my_contact_details');
      if (!active) return;
      if (rpcError || !Array.isArray(data)) {
        setFailed(true);
        return;
      }
      const row = (data[0] ?? null) as Partial<Record<keyof FormState, string | null>> | null;
      setForm({
        company_name: row?.company_name ?? '',
        responsible_person: row?.responsible_person ?? '',
        phone: row?.phone ?? '',
        address: row?.address ?? '',
        city: row?.city ?? '',
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!profile) return null;
  if (failed) return <NoticePanel tone="error" title="تعذر تحميل بيانات التواصل" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  if (!form) return <LoadingState label="جاري تحميل بيانات التواصل..." />;

  const update = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((current) => (current ? { ...current, [key]: event.target.value } : current));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const phone = form.phone.replace(/\s+/g, '');
    if (!PHONE_PATTERN.test(phone)) {
      setError('أدخل رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 01)');
      return;
    }
    if (isOwner && (!form.company_name.trim() || !form.responsible_person.trim() || !form.address.trim())) {
      setError('اسم المعرض واسم المسؤول والعنوان مطلوبة');
      return;
    }

    const payload = isOwner
      ? {
          company_name: form.company_name.trim(),
          responsible_person: form.responsible_person.trim(),
          phone,
          address: form.address.trim(),
        }
      : { phone, city: form.city.trim() || null };

    setSaving(true);
    const { error: updateError } = await supabase.from('profiles').update(payload).eq('id', profile.id);
    setSaving(false);
    if (updateError) {
      setError(translateError(updateError));
      return;
    }
    setForm({ ...form, phone });
    toast.success('تم حفظ بيانات التواصل');
  };

  return (
    <section className={`${cardClass} flex flex-col gap-6`} aria-labelledby="contact-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <Phone className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 id="contact-title" className="text-lg font-bold text-slate-900">
            بيانات التواصل
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {isOwner
              ? 'لا تظهر بيانات معرضك للمسوقين إلا بعد قبول طلبهم على الفرصة.'
              : 'لا تظهر بياناتك للطرف الآخر إلا بعد قبول طلبك على الفرصة.'}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="grid gap-5 sm:grid-cols-2" noValidate>
        {isOwner && (
          <>
            <div>
              <label htmlFor="company_name" className={labelClass}>
                اسم المعرض
              </label>
              <input id="company_name" value={form.company_name} onChange={update('company_name')} maxLength={120} className={inputClass} />
            </div>
            <div>
              <label htmlFor="responsible_person" className={labelClass}>
                اسم المسؤول
              </label>
              <input id="responsible_person" value={form.responsible_person} onChange={update('responsible_person')} maxLength={120} className={inputClass} />
            </div>
          </>
        )}
        <div>
          <label htmlFor="phone" className={labelClass}>
            رقم الموبايل
          </label>
          <input id="phone" type="tel" dir="ltr" inputMode="tel" value={form.phone} onChange={update('phone')} placeholder="01xxxxxxxxx" className={inputClass} />
        </div>
        {isOwner ? (
          <div>
            <label htmlFor="address" className={labelClass}>
              العنوان التفصيلي
            </label>
            <input id="address" value={form.address} onChange={update('address')} maxLength={300} className={inputClass} />
          </div>
        ) : (
          <div>
            <label htmlFor="city" className={labelClass}>
              المدينة
            </label>
            <input id="city" value={form.city} onChange={update('city')} maxLength={80} className={inputClass} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-700 sm:col-span-2">
            {error}
          </p>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className={buttonPrimary}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            حفظ بيانات التواصل
          </button>
        </div>
      </form>
    </section>
  );
}
