import type { AccountType, ProfileStatus } from '@/lib/domain';

export type AdminRole = 'super_admin' | 'assistant';
export type AdminPermission = 'members' | 'listings';
export type AccountTypeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdminAccess {
  role: AdminRole;
  permissions: AdminPermission[];
}

export const ADMIN_PERMISSIONS: { value: AdminPermission; label: string; description: string }[] = [
  { value: 'members', label: 'إدارة الأعضاء', description: 'عرض الأعضاء وإيقافهم وحظرهم، ومراجعة طلبات تغيير نوع الحساب' },
  { value: 'listings', label: 'إدارة الإعلانات', description: 'عرض الإعلانات وإيقافها وحذفها' },
];

export const accountTypeLabel: Record<AccountType, string> = {
  worker: 'باحث عن فرص',
  owner: 'صاحب فرصة',
};

export const ACCOUNT_TYPE_OTHER: Record<AccountType, AccountType> = {
  worker: 'owner',
  owner: 'worker',
};

export const profileStatusLabel: Record<ProfileStatus, string> = {
  active: 'نشط',
  suspended: 'موقوف مؤقتاً',
  banned: 'محظور',
};

export const accountTypeRequestStatusLabel: Record<AccountTypeRequestStatus, string> = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

export const ADMIN_ACTION_LABELS: Record<string, string> = {
  change_account_status: 'تغيير حالة حساب',
  delete_account: 'حذف حساب',
  change_listing_status: 'تغيير حالة إعلان',
  delete_listing: 'حذف إعلان',
  review_account_type_request: 'مراجعة طلب تغيير نوع الحساب',
  grant_admin_access: 'منح صلاحيات مشرف',
  revoke_admin_access: 'سحب صلاحيات مشرف',
};

export interface AccountTypeRequest {
  id: string;
  user_id: string;
  current_type: AccountType;
  requested_type: AccountType;
  reason: string;
  status: AccountTypeRequestStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface AdminMember {
  user_id: string;
  full_name: string;
  email: string;
  account_type: AccountType;
  status: ProfileStatus;
  status_reason: string | null;
  governorate: string | null;
  created_at: string;
  admin_role: AdminRole | null;
}

export interface AdminStaffMember {
  user_id: string;
  full_name: string;
  email: string;
  admin_role: AdminRole;
  permissions: AdminPermission[];
  is_active: boolean;
  created_at: string;
}

export interface AdminStats {
  members: number;
  owners: number;
  workers: number;
  restricted_accounts: number;
  listings: number;
  active_listings: number;
  deals: number;
  commissions_total: number;
  pending_type_requests: number;
}

export interface AuditLogEntry {
  id: number;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
