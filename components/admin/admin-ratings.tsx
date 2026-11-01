'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Star } from 'lucide-react';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { translateError } from '@/lib/messages';
import { buttonDanger, buttonSecondary, cardClass, inputClass, labelClass } from '@/lib/ui';

interface AdminRating {
  rating_id: string;
  deal_number: string;
  rater_name: string;
  ratee_name: string;
  stars: number;
  comment: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
}

export function AdminRatings() {
  const [ratings, setRatings] = useState<AdminRating[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('admin_list_ratings', { p_limit: 200 });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setRatings([]);
        return;
      }
      setFailed(false);
      setRatings(data as AdminRating[]);
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const setVisibility = async (ratingId: string, hidden: boolean, reason?: string) => {
    setMessage(null);
    setBusyId(ratingId);
    const { error } = await supabase.rpc('admin_set_rating_visibility', {
      p_rating_id: ratingId,
      p_hidden: hidden,
      p_reason: reason ?? null,
    });
    setBusyId(null);

    if (error) {
      setMessage({ tone: 'error', text: translateError(error) });
      return;
    }
    setHidingId(null);
    setMessage({ tone: 'success', text: hidden ? 'تم إخفاء التقييم' : 'تمت استعادة التقييم' });
    setReloadKey((key) => key + 1);
  };

  const handleHide = (event: FormEvent<HTMLFormElement>, ratingId: string) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    if (reason.length < 5) {
      setMessage({ tone: 'error', text: 'اكتب سبب الإخفاء (5 أحرف على الأقل)' });
      return;
    }
    setVisibility(ratingId, true, reason);
  };

  return (
    <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="admin-ratings-title">
      <div>
        <h2 id="admin-ratings-title" className="text-lg font-bold text-slate-900">
          التقييمات
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          التقييمات المخفية لا تدخل في متوسط تقييم أي طرف. كل إخفاء أو استعادة يُسجَّل في سجل النشاط.
        </p>
      </div>

      {message && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.tone === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {message.text}
        </p>
      )}

      {ratings === null ? (
        <LoadingState label="جاري تحميل التقييمات..." />
      ) : failed ? (
        <NoticePanel tone="error" title="تعذر تحميل التقييمات" description="حدث خطأ أثناء تحميل البيانات. حدّث الصفحة وحاول مرة أخرى." />
      ) : ratings.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">لا توجد تقييمات بعد.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {ratings.map((rating) => {
            const busy = busyId === rating.rating_id;
            const isHiding = hidingId === rating.rating_id;
            return (
              <li key={rating.rating_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-slate-900">
                      {rating.rater_name} قيّم {rating.ratee_name}
                    </p>
                    <p className="text-xs text-slate-500" dir="ltr">
                      {rating.deal_number} · {formatDate(rating.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" aria-label={`${rating.stars} من 5 نجوم`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${n <= rating.stars ? 'fill-gold-500 text-gold-500' : 'text-slate-300'}`} aria-hidden />
                    ))}
                  </div>
                </div>

                {rating.comment && <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{rating.comment}</p>}

                {rating.is_hidden && (
                  <p className="rounded-lg bg-rose-50 p-3 text-xs leading-relaxed text-rose-800">
                    مخفي: {rating.hidden_reason ?? 'بدون سبب مسجل'}
                  </p>
                )}

                {rating.is_hidden ? (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setVisibility(rating.rating_id, false)} disabled={busy} className={buttonSecondary}>
                      استعادة التقييم
                    </button>
                  </div>
                ) : isHiding ? (
                  <form onSubmit={(event) => handleHide(event, rating.rating_id)} className="flex flex-col gap-3" noValidate>
                    <div>
                      <label htmlFor={`hide-${rating.rating_id}`} className={labelClass}>
                        سبب الإخفاء
                      </label>
                      <input id={`hide-${rating.rating_id}`} name="reason" type="text" maxLength={500} className={inputClass} />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setHidingId(null)} disabled={busy} className={buttonSecondary}>
                        تراجع
                      </button>
                      <button type="submit" disabled={busy} className={buttonDanger}>
                        إخفاء التقييم
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setHidingId(rating.rating_id)} disabled={busy} className={buttonDanger}>
                      إخفاء التقييم
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
