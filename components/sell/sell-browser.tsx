'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Search, SearchX } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ListingCard } from '@/components/sell/listing-card';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { supabase } from '@/lib/supabase';
import { LISTING_CATEGORIES, type ListingCategory, type ListingWithOwner } from '@/lib/domain';
import { buttonPrimary, buttonSecondary, inputClass } from '@/lib/ui';

type CategoryFilter = ListingCategory | 'all';

export function SellBrowser() {
  const { profile } = useAuth();
  const [listings, setListings] = useState<ListingWithOwner[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*, owner:profiles!owner_id(full_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setListings([]);
        return;
      }
      setFailed(false);
      setListings(data as ListingWithOwner[]);
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    if (!listings) return [];
    const term = query.trim().toLowerCase();
    return listings.filter((listing) => {
      if (category !== 'all' && listing.category !== category) return false;
      if (!term) return true;
      return [listing.title, listing.location, listing.description].some((field) =>
        field.toLowerCase().includes(term),
      );
    });
  }, [listings, query, category]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-brand-700">بيعلي · Sell For Me</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">فرص البيع بالعمولة</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            تصفح المنتجات والعقارات والسيارات المعروضة للبيع، وتقدم على الفرص التي تناسبك. العمولة وشروط استحقاقها
            معلنة في كل إعلان.
          </p>
        </div>
        {profile?.account_type === 'owner' && (
          <Link href="/sell/new" className={`${buttonPrimary} self-start md:self-auto`}>
            <Plus className="h-4 w-4" aria-hidden />
            انشر فرصة جديدة
          </Link>
        )}
      </header>

      <div className="mt-8 flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الفرصة أو المنطقة..."
            className={`${inputClass} ps-12`}
            aria-label="البحث في الفرص"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="تصفية حسب التصنيف">
          {[{ value: 'all' as CategoryFilter, label: 'الكل' }, ...LISTING_CATEGORIES].map((item) => {
            const selected = category === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                aria-pressed={selected}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selected
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-800'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        {listings === null ? (
          <LoadingState label="جاري تحميل الفرص..." />
        ) : failed ? (
          <NoticePanel
            tone="error"
            title="تعذر تحميل الفرص"
            description="حدث خطأ أثناء تحميل الفرص المتاحة. تحقق من اتصالك ثم حاول مرة أخرى."
            action={
              <button type="button" onClick={() => setReloadKey((key) => key + 1)} className={buttonSecondary}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                إعادة المحاولة
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <NoticePanel
            title={listings.length === 0 ? 'لا توجد فرص منشورة حالياً' : 'لا توجد نتائج مطابقة'}
            description={
              listings.length === 0
                ? 'ستظهر هنا الفرص فور نشرها من أصحاب الأعمال.'
                : 'جرّب تغيير كلمات البحث أو اختيار تصنيف آخر.'
            }
            action={
              listings.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                  }}
                  className={buttonSecondary}
                >
                  <SearchX className="h-4 w-4" aria-hidden />
                  مسح الفلاتر
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">{filtered.length} فرصة متاحة</p>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
