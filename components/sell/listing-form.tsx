'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LISTING_CATEGORIES, type CommissionType, type Listing } from '@/lib/domain';
import { translateError } from '@/lib/messages';
import { ListingImagesField } from '@/components/sell/listing-images-field';
import { MAX_LISTING_IMAGES } from '@/lib/listing-images';
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from '@/lib/ui';

interface ListingFormProps {
  initial?: Listing;
}

interface ListingPayload {
  category: string;
  title: string;
  description: string;
  price: number;
  location: string;
  commission_type: CommissionType;
  commission_value: number;
  commission_terms: string;
  duration_days: number;
  product_name: string;
  specs: string | null;
  image_paths: string[];
}

const COMMISSION_OPTIONS: { value: CommissionType; label: string; hint: string }[] = [
  { value: 'percentage', label: 'نسبة من قيمة البيع', hint: 'مثال: 5% من سعر البيع' },
  { value: 'fixed', label: 'مبلغ ثابت', hint: 'مثال: 1000 جنيه لكل صفقة' },
];

function readPayload(form: FormData, imagePaths: string[]): { payload?: ListingPayload; error?: string } {
  const specs = String(form.get('specs') ?? '').trim();
  const payload: ListingPayload = {
    category: String(form.get('category') ?? ''),
    title: String(form.get('title') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    price: Number(form.get('price')),
    location: String(form.get('location') ?? '').trim(),
    commission_type: String(form.get('commission_type') ?? 'percentage') as CommissionType,
    commission_value: Number(form.get('commission_value')),
    commission_terms: String(form.get('commission_terms') ?? '').trim(),
    duration_days: Number(form.get('duration_days')),
    product_name: String(form.get('product_name') ?? '').trim(),
    specs: specs || null,
    image_paths: imagePaths,
  };

  if (!payload.category) return { error: 'اختر تصنيف الفرصة' };
  if (payload.product_name.length < 2 || payload.product_name.length > 120) {
    return { error: 'اسم المنتج يجب أن يكون بين حرفين و120 حرفاً' };
  }
  if (payload.image_paths.length === 0) return { error: 'أضف صورة واحدة على الأقل للمنتج' };
  if (payload.image_paths.length > MAX_LISTING_IMAGES) return { error: `الحد الأقصى ${MAX_LISTING_IMAGES} صور` };
  if (payload.specs && payload.specs.length > 2000) return { error: 'المواصفات يجب ألا تتجاوز 2000 حرف' };
  if (payload.title.length < 3 || payload.title.length > 120) return { error: 'عنوان الفرصة يجب أن يكون بين 3 و120 حرفاً' };
  if (payload.description.length < 10) return { error: 'الوصف يجب أن يكون 10 أحرف على الأقل' };
  if (!Number.isFinite(payload.price) || payload.price < 0) return { error: 'أدخل سعراً صحيحاً بالجنيه' };
  if (payload.location.length < 2) return { error: 'أدخل المنطقة أو المدينة' };
  if (!Number.isFinite(payload.commission_value) || payload.commission_value < 0) return { error: 'أدخل قيمة عمولة صحيحة' };
  if (payload.commission_type === 'percentage' && payload.commission_value > 100) return { error: 'النسبة لا يمكن أن تتجاوز 100%' };
  if (payload.commission_terms.length < 5) return { error: 'اكتب شروط استحقاق العمولة بوضوح' };
  if (!Number.isInteger(payload.duration_days) || payload.duration_days < 1 || payload.duration_days > 365) {
    return { error: 'مدة الإعلان يجب أن تكون بين يوم و365 يوماً' };
  }

  return { payload };
}

export function ListingForm({ initial }: ListingFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [commissionType, setCommissionType] = useState<CommissionType>(initial?.commission_type ?? 'percentage');
  const [imagePaths, setImagePaths] = useState<string[]>(initial?.image_paths ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const { payload, error: validationError } = readPayload(new FormData(event.currentTarget), imagePaths);
    if (!payload) {
      setError(validationError ?? 'تحقق من البيانات المدخلة');
      return;
    }

    setSubmitting(true);
    if (initial) {
      const { error: updateError } = await supabase.from('listings').update(payload).eq('id', initial.id);
      setSubmitting(false);
      if (updateError) {
        setError(translateError(updateError));
        return;
      }
      router.push(`/sell/${initial.id}`);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('listings')
      .insert({ ...payload, status: 'active' })
      .select('id')
      .maybeSingle();
    setSubmitting(false);

    if (insertError || !data) {
      setError(translateError(insertError));
      return;
    }
    router.push(`/sell/${data.id}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <section className={`${cardClass} flex flex-col gap-5`}>
        <div>
          <h2 className="text-lg font-bold text-slate-900">المنتج</h2>
          <p className="mt-1 text-sm text-slate-500">حدد المنتج بدقة، وأضف صوره ومواصفاته ليثق به المسوقون والمشترون.</p>
        </div>

        <div>
          <label htmlFor="product_name" className={labelClass}>
            اسم المنتج
          </label>
          <input
            id="product_name"
            name="product_name"
            type="text"
            maxLength={120}
            defaultValue={initial?.product_name ?? ''}
            className={inputClass}
            placeholder="مثال: آيفون 15 برو ماكس 256 جيجا"
          />
        </div>

        <div>
          <label htmlFor="specs" className={labelClass}>
            المواصفات
          </label>
          <textarea
            id="specs"
            name="specs"
            rows={4}
            maxLength={2000}
            defaultValue={initial?.specs ?? ''}
            className={inputClass}
            placeholder={'مثال:\nالسعة: 256 جيجا\nاللون: تيتانيوم طبيعي\nالحالة: مستعمل بحالة ممتازة'}
          />
        </div>

        <ListingImagesField value={imagePaths} onChange={setImagePaths} />
      </section>

      <section className={`${cardClass} flex flex-col gap-5`}>
        <div>
          <h2 className="text-lg font-bold text-slate-900">تفاصيل الفرصة</h2>
          <p className="mt-1 text-sm text-slate-500">اكتب معلومات واضحة تساعد المتقدمين على الفهم السريع.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={labelClass}>
              التصنيف
            </label>
            <select id="category" name="category" defaultValue={initial?.category ?? ''} className={inputClass}>
              <option value="" disabled>
                اختر التصنيف
              </option>
              {LISTING_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="location" className={labelClass}>
              المنطقة أو المدينة
            </label>
            <input id="location" name="location" type="text" defaultValue={initial?.location ?? ''} className={inputClass} placeholder="مثال: مدينة نصر، القاهرة" />
          </div>
        </div>

        <div>
          <label htmlFor="title" className={labelClass}>
            عنوان الفرصة
          </label>
          <input id="title" name="title" type="text" defaultValue={initial?.title ?? ''} className={inputClass} placeholder="مثال: شقة للبيع بتشطيب سوبر لوكس" />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>
            الوصف
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={initial?.description ?? ''}
            className={inputClass}
            placeholder="اشرح المنتج أو الخدمة، وحالتها، وأي تفاصيل تهم المشتري"
          />
        </div>

        <div>
          <label htmlFor="price" className={labelClass}>
            السعر (جنيه مصري)
          </label>
          <input id="price" name="price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={initial?.price ?? ''} className={inputClass} />
        </div>
      </section>

      <section className={`${cardClass} flex flex-col gap-5`}>
        <div>
          <h2 className="text-lg font-bold text-slate-900">العمولة ومدة الإعلان</h2>
          <p className="mt-1 text-sm text-slate-500">
            العمولة معلنة للمتقدمين قبل التقديم، ولا تستحق إلا وفق الشروط التي تكتبها هنا.
          </p>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className={labelClass}>نوع العمولة</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {COMMISSION_OPTIONS.map((option) => {
              const selected = commissionType === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition ${
                    selected ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-100' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="commission_type"
                    value={option.value}
                    checked={selected}
                    onChange={() => setCommissionType(option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-bold text-slate-900">{option.label}</span>
                  <span className="text-xs text-slate-600">{option.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="commission_value" className={labelClass}>
              {commissionType === 'percentage' ? 'نسبة العمولة (%)' : 'قيمة العمولة (جنيه)'}
            </label>
            <input
              id="commission_value"
              name="commission_value"
              type="number"
              min="0"
              max={commissionType === 'percentage' ? 100 : undefined}
              step="0.01"
              inputMode="decimal"
              defaultValue={initial?.commission_value ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="duration_days" className={labelClass}>
              مدة الإعلان (بالأيام)
            </label>
            <input id="duration_days" name="duration_days" type="number" min="1" max="365" step="1" inputMode="numeric" defaultValue={initial?.duration_days ?? 30} className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="commission_terms" className={labelClass}>
            شروط استحقاق العمولة
          </label>
          <textarea
            id="commission_terms"
            name="commission_terms"
            rows={3}
            defaultValue={initial?.commission_terms ?? ''}
            className={inputClass}
            placeholder="مثال: تستحق العمولة بعد توقيع عقد البيع واستلام الدفعة الأولى"
          />
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => router.back()} className={buttonSecondary}>
          إلغاء
        </button>
        <button type="submit" disabled={submitting} className={buttonPrimary}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {isEdit ? 'حفظ التعديلات' : 'نشر الفرصة'}
        </button>
      </div>
    </form>
  );
}
