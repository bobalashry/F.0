'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Clock } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState, NoticePanel } from '@/components/common/state-panels';
import { DealsList } from '@/components/deals/deals-list';
import { ListingStatusBadge } from '@/components/sell/listing-status-badge';
import { ApplicationStatusBadge } from '@/components/sell/application-status-badge';
import { supabase } from '@/lib/supabase';
import { categoryLabel, type ApplicationWithListing, type Listing } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { buttonPrimary, cardClass } from '@/lib/ui';

type Tab = 'main' | 'deals';

export function DashboardHome() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('main');
  if (!profile) return null;
  const isOwner = profile.account_type === 'owner';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-brand-700">{isOwner ? 'لوحة صاحب الفرصة' : 'لوحة الباحث عن الفرص'}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">أهلاً، {profile.full_name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {isOwner
              ? 'تابع إعلاناتك، وراجع المتقدمين، وأدر الاتفاقات الموثقة.'
              : 'تابع طلباتك على الفرص، وكل اتفاق وقعته مع أصحاب الفرص.'}
          </p>
        </div>
        {isOwner && (
          <Link href="/sell/new" className={`${buttonPrimary} self-start md:self-auto`}>
            <Plus className="h-4 w-4" aria-hidden />
            انشر فرصة جديدة
          </Link>
        )}
      </header>

      <div className="mt-8 inline-flex rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="أقسام اللوحة">
        {(
          [
            { value: 'main', label: isOwner ? 'إعلاناتي' : 'طلباتي' },
            { value: 'deals', label: 'الاتفاقات' },
          ] as { value: Tab; label: string }[]
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
              tab === item.value ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'deals' ? <DealsList /> : isOwner ? <OwnerListings ownerId={profile.id} /> : <WorkerApplications workerId={profile.id} />}
      </div>
    </div>
  );
}

function OwnerListings({ ownerId }: { ownerId: string }) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setListings([]);
        return;
      }
      setListings(data as Listing[]);
    })();
    return () => {
      active = false;
    };
  }, [ownerId]);

  if (listings === null) return <LoadingState label="جاري تحميل إعلاناتك..." />;
  if (failed) return <NoticePanel tone="error" title="تعذر تحميل إعلاناتك" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  if (listings.length === 0) {
    return (
      <NoticePanel
        title="لم تنشر أي فرصة بعد"
        description="ابدأ بنشر أول فرصة بيع بالعمولة، وسيظهر إعلانك للباحثين فوراً."
        action={
          <Link href="/sell/new" className={buttonPrimary}>
            <Plus className="h-4 w-4" aria-hidden />
            انشر فرصتك الأولى
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {listings.map((listing) => (
        <li key={listing.id}>
          <Link
            href={`/sell/${listing.id}`}
            className={`${cardClass} group flex h-full flex-col gap-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">{categoryLabel(listing.category)}</span>
              <ListingStatusBadge status={listing.status} />
            </div>
            <h3 className="line-clamp-2 text-lg font-bold text-slate-900 group-hover:text-brand-800">{listing.title}</h3>
            <p className="mt-auto flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              نُشر في {formatDate(listing.created_at)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function WorkerApplications({ workerId }: { workerId: string }) {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationWithListing[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('*, listing:listings(id, title, price, location, status, category, owner:profiles!owner_id(full_name))')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setFailed(true);
        setApplications([]);
        return;
      }
      setApplications(data as ApplicationWithListing[]);
    })();
    return () => {
      active = false;
    };
  }, [workerId]);

  if (applications === null) return <LoadingState label="جاري تحميل طلباتك..." />;
  if (failed) return <NoticePanel tone="error" title="تعذر تحميل طلباتك" description="حدث خطأ أثناء التحميل. حاول مرة أخرى بعد قليل." />;
  if (applications.length === 0) {
    return (
      <NoticePanel
        title="لم تقدم على أي فرصة بعد"
        description="تصفح فرص البيع بالعمولة وقدّم على ما يناسبك."
        action={
          <Link href="/sell" className={buttonPrimary}>
            تصفح الفرص
          </Link>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {applications.map((application) => (
        <li key={application.id}>
          <button
            type="button"
            onClick={() => application.listing && router.push(`/sell/${application.listing.id}`)}
            disabled={!application.listing}
            className={`${cardClass} group flex w-full flex-col gap-3 text-start transition hover:border-brand-300 hover:shadow-lg disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:shadow-sm md:flex-row md:items-center md:justify-between`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-base font-bold text-slate-900 group-hover:text-brand-800">
                {application.listing?.title ?? 'فرصة لم تعد متاحة'}
              </span>
              <span className="text-sm text-slate-500">
                {application.listing
                  ? `${application.listing.owner?.full_name ?? 'صاحب فرصة'} · ${application.listing.location}`
                  : 'تم إغلاق هذه الفرصة أو حذفها'}
              </span>
              <span className="text-xs text-slate-400">قُدّم في {formatDate(application.created_at)}</span>
            </div>
            <ApplicationStatusBadge status={application.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}
