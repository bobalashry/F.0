import { RequireAuth } from '@/components/auth/require-auth';
import { DealDetail } from '@/components/deals/deal-detail';

export default function DealPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <DealDetail dealId={params.id} />
    </RequireAuth>
  );
}
