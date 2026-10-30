'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ADMIN_PERMISSIONS, type AdminPermission } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { translateError } from '@/lib/messages';
import { buttonPrimary, buttonSecondary } from '@/lib/ui';

export interface PermissionTarget {
  user_id: string;
  full_name: string;
  email: string;
  permissions: AdminPermission[];
}

interface AdminPermissionsDialogProps {
  target: PermissionTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AdminPermissionsDialog({ target, onClose, onSaved }: AdminPermissionsDialogProps) {
  const [selected, setSelected] = useState<AdminPermission[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(target?.permissions ?? []);
    setError(null);
  }, [target?.user_id]);

  if (!target) return null;

  const toggle = (permission: AdminPermission) => {
    setSelected((current) =>
      current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission],
    );
  };

  const save = async () => {
    setError(null);
    if (selected.length === 0) {
      setError('اختر صلاحية واحدة على الأقل');
      return;
    }
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('admin_grant_access', {
      p_user_id: target.user_id,
      p_permissions: selected,
    });
    setBusy(false);
    if (rpcError) {
      setError(translateError(rpcError));
      return;
    }
    toast.success('تم حفظ صلاحيات المشرف');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>صلاحيات المشرف</DialogTitle>
          <DialogDescription>
            {target.full_name || 'بدون اسم'} · <span dir="ltr">{target.email}</span>
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold text-slate-700">الصلاحيات الممنوحة</legend>
          {ADMIN_PERMISSIONS.map((permission) => (
            <label
              key={permission.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
            >
              <input
                type="checkbox"
                checked={selected.includes(permission.value)}
                onChange={() => toggle(permission.value)}
                className="mt-1 h-4 w-4 accent-brand-600"
              />
              <span className="flex flex-col gap-1">
                <span className="font-semibold text-slate-900">{permission.label}</span>
                <span className="text-sm leading-relaxed text-slate-600">{permission.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonSecondary}>
            إلغاء
          </button>
          <button type="button" disabled={busy} onClick={save} className={buttonPrimary}>
            حفظ الصلاحيات
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
