'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Star } from 'lucide-react';
import { LoadingState } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { translateError } from '@/lib/messages';
import { buttonPrimary, cardClass, inputClass, labelClass } from '@/lib/ui';

interface DealRatingPanelProps {
  dealId: string;
}

interface RatingRow {
  rater_id: string;
  ratee_id: string;
  stars: number | null;
  comment: string | null;
  created_at: string;
  is_mine: boolean;
  counterpart_visible: boolean;
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: RatingRow[] };

export function DealRatingPanel({ dealId }: DealRatingPanelProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('get_deal_ratings', { p_deal_id: dealId });
      if (!active) return;
      if (rpcError || !Array.isArray(data)) {
        setLoad({ status: 'error' });
        return;
      }
      setLoad({ status: 'ready', rows: data as RatingRow[] });
    })();
    return () => {
      active = false;
    };
  }, [dealId, reloadKey]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (stars < 1) {
      setError('اختر عدد النجوم أولاً');
      return;
    }

    const comment = String(new FormData(event.currentTarget).get('comment') ?? '').trim();
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('submit_deal_rating', {
      p_deal_id: dealId,
      p_stars: stars,
      p_comment: comment || null,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(translateError(rpcError));
      return;
    }
    setReloadKey((key) => key + 1);
  };

  if (load.status === 'loading') return <LoadingState label="جاري تحميل التقييمات..." />;

  if (load.status === 'error') {
    return (
      <section role="alert" className={`${cardClass} text-sm text-rose-700`}>
        تعذر تحميل التقييمات. حدّث الصفحة وحاول مرة أخرى.
      </section>
    );
  }

  const mine = load.rows.find((row) => row.is_mine);
  const theirs = load.rows.find((row) => !row.is_mine && row.counterpart_visible);
  const shownStars = hovered || stars;

  if (mine) {
    return (
      <section className={`${cardClass} flex flex-col gap-4`} aria-labelledby="deal-rating-title">
        <h2 id="deal-rating-title" className="text-lg font-bold text-slate-900">
          تقييمك للاتفاق
        </h2>
        <StarRow value={mine.stars ?? 0} />
        {mine.comment && <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{mine.comment}</p>}
        <p className="text-xs text-slate-500">أُرسل في {formatDate(mine.created_at)}</p>

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-bold text-slate-900">تقييم الطرف الآخر</h3>
          {theirs ? (
            <div className="mt-3 flex flex-col gap-3">
              <StarRow value={theirs.stars ?? 0} />
              {theirs.comment && <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{theirs.comment}</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-500">سيظهر تقييم الطرف الآخر هنا فور قيامه بالتقييم.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="deal-rating-title">
      <div>
        <h2 id="deal-rating-title" className="text-lg font-bold text-slate-900">
          قيّم الطرف الآخر
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          تقييمك لا يظهر للطرف الآخر إلا بعد أن يقيّمك هو أيضاً، لضمان تقييم عادل.
        </p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <span className={labelClass}>عدد النجوم</span>
          <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} من 5 نجوم`}
                onClick={() => setStars(value)}
                onMouseEnter={() => setHovered(value)}
                className="rounded-md p-1 transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-brand-700"
              >
                <Star
                  className={`h-7 w-7 transition-colors ${value <= shownStars ? 'fill-gold-500 text-gold-500' : 'text-slate-300'}`}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="deal-rating-comment" className={labelClass}>
            تعليق (اختياري)
          </label>
          <textarea id="deal-rating-comment" name="comment" rows={3} maxLength={500} className={inputClass} />
        </div>

        <button type="submit" disabled={submitting} className={buttonPrimary}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          إرسال التقييم
        </button>
      </form>
    </section>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${value} من 5 نجوم`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-5 w-5 ${n <= value ? 'fill-gold-500 text-gold-500' : 'text-slate-300'}`} aria-hidden />
      ))}
    </div>
  );
}
