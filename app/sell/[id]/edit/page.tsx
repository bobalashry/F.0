import { RequireAuth } from '@/components/auth/require-auth';
import { ListingEditLoader } from '@/components/sell/listing-edit-loader';

export default function EditListingPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth accountType="owner">
      <ListingEditLoader listingId={params.id} />
    </RequireAuth>
  );
}
