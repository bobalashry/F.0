'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Pause, Pencil, Play, Trash2, XCircle } from 'lucide-react';
import { ListingStatusBadge } from '@/components/sell/listing-status-badge';
import { supabase } from '@/lib/supabase';
import type { ListingStatus, ListingWithOwner } from '@/lib/domain';
import { translateError } from '@/lib/messages';
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass } from '@/lib/ui';

interface OwnerListingActionsProps {
  listing: ListingWithOwner;
  onStatusChange: (status: ListingStatus) => void;
}

export function OwnerListingActions({ listing, onStatusChange }: OwnerListingActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<'status' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const changeStatus = async (status: ListingStatus) => {
    setMessage(null);
    setBusy('status');
    const { data, error } = await supabase
      .from('listings')
      .update({ status })
      .eq('id', listing.id)
      .select('id')
      .maybeSingle();
    setBusy(null);

    if (error || !data) {
      setMessage({ tone: 'error', text: translateError(error ?? { message: 'not_allowed' }) });
      return;
    }
    onStatusChange(status);
    setMessage({ tone: 'success', text: 'تم تحديث حالة الإعلان' });
  };

  const deleteListing = async () => {
    setMessage(null);
    setBusy('delete');
    const { data, error } = await supabase.from('listings').delete().eq('id', listing.id).select('id');
    setBusy(null);

    if (error || !data || data.length === 0) {
      setMessage({ tone: 'error', text: translateError(error ?? { message: 'not_allowed' }) });
      setConfirmDelete(false);
      return;
    }
    router.push('/sell');
  };

  if (listing.status === 'suspended') {
    return (
      <section className={`${cardClass} flex flex-col gap-4`} aria-labelledby="manage-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="manage-title" className="text-lg font-bold text-slate-900">
            إدارة الإعلان
          </h2>
          <ListingStatusBadge status={listing.status} />
        </div>
        <p className="text-sm leading-relaxed text-slate-700">
          أوقفت إدارة فرصة هذا الإعلان، ولا يمكنك تعديله أو تفعيله من حسابك حالياً.
        </p>
      </section>
    );
  }

  const statusActions: { status: ListingStatus; label: string; icon: typeof Pause; primary?: boolean }[] = [];
  if (listing.status === 'active') {
    statusActions.push({ status: 'paused', label: 'إيقاف مؤقت', icon: Pause });
  } else {
    statusActions.push({ status: 'active', label: 'تفعيل الإعلان', icon: Play, primary: true });
  }
  if (listing.status !== 'closed') {
    statusActions.push({ status: 'closed', label: 'إغلاق الإعلان', icon: XCircle });
  }

  return (
    <section className={`${cardClass} flex flex-col gap-5`} aria-labelledby="manage-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="manage-title" className="text-lg font-bold text-slate-900">
          إدارة الإعلان
        </h2>
        <ListingStatusBadge status={listing.status} />
      </div>

      <div className="flex flex-col gap-3">
        {statusActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.status}
              type="button"
              disabled={busy !== null}
              onClick={() => changeStatus(action.status)}
              className={action.primary ? buttonPrimary : buttonSecondary}
            >
              {busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
              {action.label}
            </button>
          );
        })}
        <Link href={`/sell/${listing.id}/edit`} className={buttonSecondary}>
          <Pencil className="h-4 w-4" aria-hidden />
          تعديل بيانات الإعلان
        </Link>
      </div>

      <div className="border-t border-slate-200 pt-5">
        {confirmDelete ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-slate-700">
              هل أنت متأكد من حذف هذا الإعلان نهائياً؟ لا يمكن التراجع عن ذلك.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy !== null} className={`${buttonSecondary} flex-1`}>
                تراجع
              </button>
              <button type="button" onClick={deleteListing} disabled={busy !== null} className={`${buttonDanger} flex-1 border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:text-white`}>
                {busy === 'delete' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                تأكيد الحذف
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy !== null} className={`${buttonDanger} w-full`}>
            <Trash2 className="h-4 w-4" aria-hidden />
            حذف الإعلان
          </button>
        )}
      </div>

      {message && (
        <p role="status" className={`text-sm ${message.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
