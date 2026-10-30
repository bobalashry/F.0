'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { ListingForm } from '@/components/sell/listing-form';
import { supabase } from '@/lib/supabase';
import type { Listing } from '@/lib/domain';

export function ListingEditLoader({ listingId }: { listingId: string }) {
  const { profile } = useAuth();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'missing' } | { status: 'ready'; listing: Listing }>({
    status: 'loading',
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('listings').select('*').eq('id', listingId).maybeSingle();
      if (!active) return;
      if (error || !data) {
        setState({ status: 'missing' });
        return;
      }
      setState({ status: 'ready', listing: data as Listing });
    })();
    return () => {
      active = false;
    };
  }, [listingId]);

  if (state.status === 'loading') return <LoadingState label="جاري تحميل الفرصة..." />;
  if (state.status === 'missing') {
    return <NoticePanel title="الفرصة غير موجودة" description="ربما تم حذفها أو لا تملك صلاحية تعديلها." />;
  }
  if (state.listing.owner_id !== profile?.id) {
    return <NoticePanel title="لا تملك صلاحية تعديل هذه الفرصة" description="يمكن لصاحب الفرصة فقط تعديل إعلانه." />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-bold text-brand-700">تعديل الفرصة</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{state.listing.title}</h1>
      </div>
      <ListingForm initial={state.listing} />
    </div>
  );
}
