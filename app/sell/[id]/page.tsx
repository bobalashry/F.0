import { RequireAuth } from '@/components/auth/require-auth';
import { ListingDetail } from '@/components/sell/listing-detail';

export default function ListingPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <ListingDetail listingId={params.id} />
    </RequireAuth>
  );
}
