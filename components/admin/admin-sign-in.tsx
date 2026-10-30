'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { translateError } from '@/lib/messages';
import { buttonPrimary, cardClass, inputClass, labelClass } from '@/lib/ui';

export function AdminSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError(translateError(signInError));
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <ShieldCheck className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">دخول الإدارة</h1>
        <p className="text-sm leading-relaxed text-slate-600">هذه الصفحة مخصصة لفريق إدارة فرصة فقط.</p>
      </div>

      <form onSubmit={submit} className={`${cardClass} flex flex-col gap-5`} noValidate>
        <div>
          <label htmlFor="admin-email" className={labelClass}>
            البريد الإلكتروني
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="admin-password" className={labelClass}>
            كلمة المرور
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={buttonPrimary}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          تسجيل الدخول
        </button>
      </form>
    </div>
  );
}
