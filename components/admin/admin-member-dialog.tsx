'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { accountTypeLabel, profileStatusLabel, type AdminMember } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { translateError } from '@/lib/messages';
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass } from '@/lib/ui';

type Action = 'suspend' | 'ban' | 'reactivate' | 'delete';

interface AdminMemberDialogProps {
  member: AdminMember | null;
  onClose: () => void;
  onChanged: () => void;
}

const MIN_REASON_LENGTH = 5;

export function AdminMemberDialog({ member, onClose, onChanged }: AdminMemberDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason('');
    setConfirmEmail('');
    setError(null);
  }, [member?.user_id]);

  if (!member) return null;

  const isProtected = member.admin_role !== null;

  const setStatus = async (status: 'active' | 'suspended' | 'banned', action: Action) => {
    setError(null);
    if (status !== 'active' && reason.trim().length < MIN_REASON_LENGTH) {
      setError(`اكتب سبب الإجراء (${MIN_REASON_LENGTH} أحرف على الأقل). سيُسجَّل في سجل النشاط.`);
      return;
    }
    setBusy(action);
    const { error: rpcError } = await supabase.rpc('admin_set_account_status', {
      p_user_id: member.user_id,
      p_status: status,
      p_reason: reason.trim(),
    });
    setBusy(null);
    if (rpcError) {
      setError(translateError(rpcError));
      return;
    }
    toast.success('تم تحديث حالة الحساب');
    onChanged();
  };

  const deleteMember = async () => {
    setError(null);
    setBusy('delete');
    const { error: rpcError } = await supabase.rpc('admin_delete_member', {
      p_user_id: member.user_id,
      p_confirm_email: confirmEmail.trim(),
    });
    setBusy(null);
    if (rpcError) {
      setError(translateError(rpcError));
      return;
    }
    toast.success('تم حذف الحساب نهائياً');
    onChanged();
  };

  const canDelete = confirmEmail.trim().toLowerCase() === member.email.toLowerCase();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member.full_name || 'بدون اسم'}</DialogTitle>
          <DialogDescription dir="ltr" className="text-end">
            {member.email}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
          <div>
            <dt className="text-slate-500">نوع الحساب</dt>
            <dd className="font-semibold text-slate-900">{accountTypeLabel[member.account_type]}</dd>
          </div>
          <div>
            <dt className="text-slate-500">الحالة</dt>
            <dd className="font-semibold text-slate-900">{profileStatusLabel[member.status]}</dd>
          </div>
          {member.status_reason && (
            <div className="col-span-2">
              <dt className="text-slate-500">آخر سبب مسجل</dt>
              <dd className="text-slate-900">{member.status_reason}</dd>
            </div>
          )}
        </dl>

        {isProtected ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            هذا حساب مشرف في الإدارة. لا يمكن إيقافه أو حذفه من هذه الصفحة، وتُدار صلاحياته من قسم المشرفون.
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="member-reason" className={labelClass}>
                سبب الإجراء (مطلوب للإيقاف والحظر)
              </label>
              <textarea
                id="member-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {member.status === 'active' ? (
                <>
                  <button type="button" disabled={busy !== null} onClick={() => setStatus('suspended', 'suspend')} className={buttonSecondary}>
                    إيقاف مؤقت
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => setStatus('banned', 'ban')} className={buttonDanger}>
                    حظر الحساب
                  </button>
                </>
              ) : (
                <button type="button" disabled={busy !== null} onClick={() => setStatus('active', 'reactivate')} className={buttonPrimary}>
                  إعادة تفعيل الحساب
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <p className="text-sm font-semibold text-rose-800">حذف الحساب نهائياً</p>
              <p className="text-sm leading-relaxed text-rose-800/80">
                لا يمكن التراجع عن الحذف. لن يُحذف الحساب إذا كانت له صفقات مسجلة. للتأكيد اكتب البريد الإلكتروني للعضو.
              </p>
              <input
                type="email"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                aria-label="تأكيد البريد الإلكتروني للحذف"
                dir="ltr"
                className={inputClass}
              />
              <button type="button" disabled={!canDelete || busy !== null} onClick={deleteMember} className={`${buttonDanger} self-start`}>
                حذف الحساب نهائياً
              </button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
