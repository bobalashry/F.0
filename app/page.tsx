import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Megaphone, Rocket, Users, Lock } from 'lucide-react';
import { buttonPrimary, buttonSecondary, cardClass } from '@/lib/ui';

const SECTIONS = [
  {
    key: 'sell',
    name: 'بيعلي',
    englishName: 'Sell For Me',
    description: 'انشر منتجاتك أو عقاراتك أو سياراتك، وحدد عمولة لمن يُتم البيع. الباحثون عن الفرص يتقدمون ويبدأون البيع.',
    href: '/sell',
    icon: Megaphone,
    available: true,
  },
  {
    key: 'market',
    name: 'سوقلي',
    englishName: 'Market For Me',
    description: 'اطلب خدمات التسويق من المسوقين المحترفين: السوشيال ميديا، التصوير، وصناعة المحتوى.',
    href: null,
    icon: Rocket,
    available: false,
  },
  {
    key: 'partner',
    name: 'شاركني',
    englishName: 'Partner With Me',
    description: 'اعرض مشروعك وابحث عن شريك بخبرة أو تمويل، مع تفاوض منظم بين الأطراف.',
    href: null,
    icon: Users,
    available: false,
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <img
          src="https://images.pexels.com/photos/27520637/pexels-photo-27520637.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
          alt="مقهى في القاهرة يجتمع فيه الناس"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-slate-900/90 via-slate-900/70 to-slate-900/40" aria-hidden />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-20 sm:px-6 md:py-28">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-gold-200 backdrop-blur">
            منصة فرص للتجارة والتسويق والشراكات في مصر
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            فرصتك تبدأ من هنا
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
            سوق رقمي واحد يجمع أصحاب الأعمال بالأشخاص الباحثين عن فرص العمل بالعمولة، والخدمات التسويقية، والشراكات
            التجارية. كل اتفاق موثق، وكل عمولة معلنة قبل الموافقة.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/sell" className={`${buttonPrimary} px-6 py-3.5`}>
              تصفح فرص بيعلي
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/signup" className={`${buttonSecondary} px-6 py-3.5`}>
              أنشئ حسابك مجاناً
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20" aria-labelledby="sections-title">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-bold text-brand-700">ثلاثة أقسام في منصة واحدة</p>
          <h2 id="sections-title" className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            اختر الفرصة المناسبة لك
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const body = (
              <>
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      section.available ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  {section.available ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">متاح الآن</span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      <Lock className="h-3 w-3" aria-hidden />
                      قريباً
                    </span>
                  )}
                </div>
                <div className="mt-6 flex flex-col gap-1">
                  <h3 className="text-2xl font-bold text-slate-900">{section.name}</h3>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500" dir="ltr">
                    {section.englishName}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{section.description}</p>
                {section.available && (
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-700 transition group-hover:gap-3">
                    ابدأ الآن
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </>
            );

            return section.href ? (
              <Link
                key={section.key}
                href={section.href}
                className={`${cardClass} group flex flex-col transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg`}
              >
                {body}
              </Link>
            ) : (
              <div key={section.key} className={`${cardClass} flex flex-col opacity-80`} aria-disabled="true">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            { title: 'حساب بنوع واضح', text: 'تسجل كباحث عن فرصة أو كصاحب فرصة، ولكل نوع لوحته وصلاحياته.' },
            { title: 'اتفاق موثق', text: 'عند قبول أي متقدم يُنشأ رقم صفقة فريد وسجل كامل بالشروط والعمولة.' },
            { title: 'عمولة معلنة', text: 'تظهر قيمة العمولة وشروط استحقاقها بوضوح قبل أن تتقدم على أي فرصة.' },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
