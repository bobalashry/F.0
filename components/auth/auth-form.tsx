'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Store, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GOVERNORATES, type AccountType } from '@/lib/domain';
import { translateError } from '@/lib/messages';
import { buttonPrimary, cardClass, inputClass, labelClass } from '@/lib/ui';

type Mode = 'signin' | 'signup';

const ACCOUNT_OPTIONS: { value: AccountType; title: string; description: string; icon: typeof Search }[] = [
  {
    value: 'worker',
    title: 'باحث عن فرصة',
    description: 'أتقدم على فرص البيع بالعمولة والتسويق والشراكات',
    icon: Search,
  },
  {
    value: 'owner',
    title: 'صاحب فرصة',
    description: 'أنشر منتجاتي أو مشروعاتي وأختار المناسب من المتقدمين',
    icon: Store,
  },
];

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isSignup = mode === 'signup';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (!email || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }

    if (isSignup) {
      const fullName = String(form.get('full_name') ?? '').trim();
      const governorate = String(form.get('governorate') ?? '').trim();
      const confirm = String(form.get('confirm_password') ?? '');

      if (fullName.length < 2 || fullName.length > 80) {
        setError('الاسم يجب أن يكون بين حرفين و80 حرفاً');
        return;
      }
      if (password.length < 8) {
        setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
        return;
      }
      if (password !== confirm) {
        setError('كلمتا المرور غير متطابقتين');
        return;
      }
      if (!accountType) {
        setError('اختر نوع الحساب أولاً');
        return;
      }

      setSubmitting(true);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, governorate, account_type: accountType },
        },
      });
      setSubmitting(false);

      if (signUpError) {
        setError(translateError(signUpError));
        return;
      }
      if (data.session) {
        router.replace('/dashboard');
        return;
      }
      setInfo('تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الدخول.');
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (signInError) {
      setError(translateError(signInError));
      return;
    }
    router.replace('/dashboard');
  };

  return (
    <div className={`${cardClass} w-full max-w-md p-6 sm:p-8`}>
      <h1 className="text-2xl font-bold text-slate-900">
        {isSignup ? 'إنشاء حساب جديد' : 'مرحباً بعودتك'}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {isSignup ? 'اختر نوع حسابك وابدأ خلال دقيقة.' : 'سجّل دخولك للوصول إلى لوحتك وفرصك.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        {isSignup && (
          <fieldset className="flex flex-col gap-3">
            <legend className={labelClass}>نوع الحساب</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {ACCOUNT_OPTIONS.map((option) => {
                const selected = accountType === option.value;
                const Icon = option.icon;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition ${
                      selected
                        ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="account_type"
                      value={option.value}
                      checked={selected}
                      onChange={() => setAccountType(option.value)}
                      className="sr-only"
                    />
                    <Icon className={`h-5 w-5 ${selected ? 'text-brand-700' : 'text-slate-500'}`} aria-hidden />
                    <span className="text-sm font-bold text-slate-900">{option.title}</span>
                    <span className="text-xs leading-relaxed text-slate-600">{option.description}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">نوع الحساب ثابت بعد التسجيل ولا يمكن تغييره مباشرة.</p>
          </fieldset>
        )}

        {isSignup && (
          <div>
            <label htmlFor="full_name" className={labelClass}>
              الاسم الكامل
            </label>
            <input id="full_name" name="full_name" type="text" autoComplete="name" className={inputClass} placeholder="مثال: أحمد محمود" />
          </div>
        )}

        <div>
          <label htmlFor="email" className={labelClass}>
            البريد الإلكتروني
          </label>
          <input id="email" name="email" type="email" autoComplete="email" dir="ltr" className={inputClass} placeholder="name@example.com" />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            كلمة المرور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            dir="ltr"
            className={inputClass}
            placeholder={isSignup ? '8 أحرف على الأقل' : '••••••••'}
          />
        </div>

        {isSignup && (
          <>
            <div>
              <label htmlFor="confirm_password" className={labelClass}>
                تأكيد كلمة المرور
              </label>
              <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" dir="ltr" className={inputClass} />
            </div>
            <div>
              <label htmlFor="governorate" className={labelClass}>
                المحافظة <span className="font-normal text-slate-400">(اختياري)</span>
              </label>
              <select id="governorate" name="governorate" defaultValue="" className={inputClass}>
                <option value="">اختر المحافظة</option>
                {GOVERNORATES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{info}</span>
          </div>
        )}

        <button type="submit" disabled={submitting} className={`${buttonPrimary} w-full`}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSignup ? 'إنشاء الحساب' : 'تسجيل الدخول'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {isSignup ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟'}{' '}
        <Link href={isSignup ? '/signin' : '/signup'} className="font-semibold text-brand-700 hover:text-brand-800">
          {isSignup ? 'تسجيل الدخول' : 'إنشاء حساب'}
        </Link>
      </p>
    </div>
  );
}
