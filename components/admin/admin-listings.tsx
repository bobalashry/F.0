'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { ListingStatusBadge } from '@/components/sell/listing-status-badge';
import { categoryLabel, type ListingStatus } from '@/lib/domain';
import { formatDate, formatEGP } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { translateError } from '@/lib/messages';
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from '@/lib/ui';

interface AdminListing {
  id: string;
  title: string;
  category: string;
  price: number | null;
  location: string | null;
  status: ListingStatus;
  created_at: string;
  owner: { full_name: string | null } | null;
}

const MIN_REASON_LENGTH = 5;

export function AdminListings() {
  const [listings, setListings] = useState<AdminListing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<AdminListing | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, category, price, location, status, created_at, owner:profiles!owner_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setListings([]);
        return;
      }
      setFailed(false);
      setListings(data as unknown as AdminListing[]);
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (listings === null) return <LoadingState label="جاري تحميل الإعلانات..." />;
  if (failed) return <NoticePanel tone="error" title="تعذر تحميل الإعلانات" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  if (listings.length === 0) return <NoticePanel title="لا توجد إعلانات" description="ستظهر هنا الإعلانات فور إضافتها." />;

  return (
    <>
      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-5 py-3 text-start font-semibold">الإعلان</th>
              <th className="px-5 py-3 text-start font-semibold">صاحب الإعلان</th>
              <th className="px-5 py-3 text-start font-semibold">القسم</th>
              <th className="px-5 py-3 text-start font-semibold">السعر</th>
              <th className="px-5 py-3 text-start font-semibold">الحالة</th>
              <th className="px-5 py-3 text-start font-semibold">تاريخ النشر</th>
              <th className="px-5 py-3 text-start font-semibold">
                <span className="sr-only">الإجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3 font-semibold text-slate-900">{listing.title}</td>
                <td className="px-5 py-3 text-slate-700">{listing.owner?.full_name || 'غير معروف'}</td>
                <td className="px-5 py-3 text-slate-700">{categoryLabel[listing.category as keyof typeof categoryLabel] ?? listing.category}</td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-700">{listing.price == null ? '—' : formatEGP(listing.price)}</td>
                <td className="px-5 py-3">
                  <ListingStatusBadge status={listing.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(listing.created_at)}</td>
                <td className="px-5 py-3 text-end">
                  <button
                    type="button"
                    onClick={() => setSelected(listing)}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                  >
                    إدارة
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminListingDialog
        listing={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          setReloadKey((key) => key + 1);
        }}
      />
    </>
  );
}

interface AdminListingDialogProps {
  listing: AdminListing | null;
  onClose: () => void;
  onChanged: () => void;
}

function AdminListingDialog({ listing, onClose, onChanged }: AdminListingDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason('');
    setConfirmDelete(false);
    setError(null);
  }, [listing?.id]);

  if (!listing) return null;

  const run = async (
    call: () => PromiseLike<{ error: { message: string } | null }>,
    successMessage: string,
  ) => {
    setError(null);
    setBusy(true);
    const { error: rpcError } = await call();
    setBusy(false);
    if (rpcError) {
      setError(translateError(rpcError));
      return;
    }
    toast.success(successMessage);
    onChanged();
  };

  const suspend = () => {
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`اكتب سبب الإيقاف (${MIN_REASON_LENGTH} أحرف على الأقل). سيُسجَّل في سجل النشاط.`);
      return;
    }
    run(
      () => supabase.rpc('admin_set_listing_status', { p_listing_id: listing.id, p_status: 'suspended', p_reason: reason.trim() }),
      'تم إيقاف الإعلان',
    );
  };

  const reactivate = () =>
    run(
      () => supabase.rpc('admin_set_listing_status', { p_listing_id: listing.id, p_status: 'active', p_reason: 'إعادة التفعيل من الإدارة' }),
      'تمت إعادة تفعيل الإعلان',
    );

  const remove = () => run(() => supabase.rpc('admin_delete_listing', { p_listing_id: listing.id }), 'تم حذف الإعلان');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{listing.title}</DialogTitle>
          <DialogDescription>صاحب الإعلان: {listing.owner?.full_name || 'غير معروف'}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">الحالة الحالية:</span>
          <ListingStatusBadge status={listing.status} />
        </div>

        {listing.status !== 'suspended' && (
          <div>
            <label htmlFor="listing-reason" className={labelClass}>
              سبب الإيقاف
            </label>
            <textarea id="listing-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {listing.status === 'suspended' ? (
            <button type="button" disabled={busy} onClick={reactivate} className={buttonPrimary}>
              إعادة تفعيل الإعلان
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={suspend} className={buttonSecondary}>
              إيقاف الإعلان
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-sm leading-relaxed text-rose-800/80">
            حذف الإعلان نهائي. لا يمكن حذف إعلان له صفقات مسجلة، ويمكنك إيقافه بدلاً من ذلك.
          </p>
          {confirmDelete ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={busy} onClick={remove} className={buttonDanger}>
                نعم، احذف الإعلان نهائياً
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={buttonSecondary}>
                تراجع
              </button>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className={`${buttonDanger} self-start`}>
              حذف الإعلان
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
