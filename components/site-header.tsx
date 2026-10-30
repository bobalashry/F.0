'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Handshake, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { buttonPrimary, buttonSecondary } from '@/lib/ui';

const NAV_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/sell', label: 'بيعلي' },
];

export function SiteHeader() {
  const { session, profile, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-slate-900" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
            <Handshake className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-bold">فرصة</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="القائمة الرئيسية">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isActive(link.href)
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {session && (
            <Link
              href="/dashboard"
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isActive('/dashboard')
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              لوحتي
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <>
              {profile && (
                <span className="text-sm text-slate-600">
                  مرحباً، <span className="font-semibold text-slate-900">{profile.full_name}</span>
                </span>
              )}
              <button type="button" onClick={handleSignOut} className={buttonSecondary}>
                <LogOut className="h-4 w-4" aria-hidden />
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <Link href="/signin" className={buttonSecondary}>
                تسجيل الدخول
              </Link>
              <Link href="/signup" className={buttonPrimary}>
                إنشاء حساب
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 md:hidden"
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="القائمة على الهاتف">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  لوحتي
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-lg px-4 py-3 text-start text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  تسجيل الخروج
                </button>
              </>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <Link href="/signin" onClick={() => setOpen(false)} className={buttonSecondary}>
                  تسجيل الدخول
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className={buttonPrimary}>
                  إنشاء حساب
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
