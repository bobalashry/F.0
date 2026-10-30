import type { CommissionType } from '@/lib/domain';

export const formatEGP = (amount: number) => `${amount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} جنيه`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatCommission = (type: CommissionType, value: number) =>
  type === 'percentage'
    ? `${value.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}% من قيمة الصفقة`
    : formatEGP(value);
