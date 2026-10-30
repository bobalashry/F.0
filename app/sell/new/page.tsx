import { RequireAuth } from '@/components/auth/require-auth';
import { ListingForm } from '@/components/sell/listing-form';

export default function NewListingPage() {
  return (
    <RequireAuth accountType="owner">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <p className="text-sm font-bold text-brand-700">بيعلي · فرصة جديدة</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">انشر فرصة بيع بالعمولة</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            كلما كانت التفاصيل واضحة، زاد عدد المتقدمين المناسبين. ستظهر الفرصة للباحثين فور نشرها.
          </p>
        </div>
        <ListingForm />
      </div>
    </RequireAuth>
  );
}
