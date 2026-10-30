import { RequireAuth } from '@/components/auth/require-auth';
import { SellBrowser } from '@/components/sell/sell-browser';

export default function SellPage() {
  return (
    <RequireAuth>
      <SellBrowser />
    </RequireAuth>
  );
}
