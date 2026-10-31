import { PLATFORM_FEE_PERCENT, type CommissionType } from '@/lib/domain';

export const formatEGP = (amount: number) => `${amount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} جنيه`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatCommission = (type: CommissionType, value: number) =>
  type === 'percentage'
    ? `${value.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}% من قيمة الصفقة`
    : formatEGP(value);

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

const netShare = (100 - PLATFORM_FEE_PERCENT) / 100;

export const formatNetCommission = (type: CommissionType, value: number) =>
  type === 'percentage'
    ? `${roundMoney(value * netShare).toLocaleString('ar-EG', { maximumFractionDigits: 2 })}% من قيمة الصفقة`
    : formatEGP(roundMoney(value * netShare));

export const commissionBreakdown = (type: CommissionType, value: number, price: number) => {
  const total = roundMoney(type === 'percentage' ? (price * value) / 100 : value);
  const fee = roundMoney((total * PLATFORM_FEE_PERCENT) / 100);
  return { total, fee, net: roundMoney(total - fee) };
};
