'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';

export function LoadingState({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-600">
      <Loader2 className="h-8 w-8 animate-spin text-brand-700" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function NoticePanel({
  title,
  description,
  tone = 'neutral',
  action,
}: {
  title: string;
  description: string;
  tone?: 'neutral' | 'error';
  action?: ReactNode;
}) {
  const Icon = tone === 'error' ? AlertTriangle : ShieldAlert;
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          tone === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-700'
        }`}
      >
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      {action}
    </div>
  );
}
