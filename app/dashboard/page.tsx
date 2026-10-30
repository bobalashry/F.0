import { RequireAuth } from '@/components/auth/require-auth';
import { DashboardHome } from '@/components/dashboard/dashboard-home';

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardHome />
    </RequireAuth>
  );
}
