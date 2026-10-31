import type { Metadata } from 'next';
import { AdminConsole } from '@/components/admin/admin-console';

export const metadata: Metadata = {
  title: 'لوحة الإدارة | فرصة',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminConsole />;
}
