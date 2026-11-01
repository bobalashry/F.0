export type AccountType = 'worker' | 'owner';
export type ListingStatus = 'active' | 'paused' | 'closed' | 'sold' | 'suspended';
export type CommissionType = 'percentage' | 'fixed';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type DealStatus = 'active' | 'completed';

export const PLATFORM_FEE_PERCENT = 10;

export type ProfileStatus = 'active' | 'suspended' | 'banned';

export interface Profile {
  id: string;
  account_type: AccountType;
  full_name: string;
  governorate: string | null;
  status: ProfileStatus;
}

export interface ContactDetails {
  company_name: string | null;
  responsible_person: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

export interface OwnerContact {
  company_name: string | null;
  responsible_person: string | null;
  phone: string | null;
  address: string | null;
  governorate: string | null;
}

export interface OwnerName {
  full_name: string;
}

export interface Listing {
  id: string;
  owner_id: string;
  category: ListingCategory;
  title: string;
  description: string;
  price: number;
  location: string;
  commission_type: CommissionType;
  commission_value: number;
  commission_terms: string;
  duration_days: number;
  status: ListingStatus;
  product_name: string | null;
  specs: string | null;
  image_paths: string[];
  created_at: string;
}

export interface ListingWithOwner extends Listing {
  owner: OwnerName | null;
}

export interface Application {
  id: string;
  listing_id: string;
  worker_id: string;
  message: string;
  status: ApplicationStatus;
  created_at: string;
}

export interface ApplicationWithWorker extends Application {
  worker: OwnerName | null;
}

export interface ApplicationWithListing extends Application {
  listing: (Pick<Listing, 'id' | 'title' | 'price' | 'location' | 'status' | 'category'> & { owner: OwnerName | null }) | null;
}

export interface Deal {
  id: string;
  deal_number: string;
  listing_id: string;
  application_id: string;
  owner_id: string;
  worker_id: string;
  listing_title: string;
  listing_price: number;
  commission_type: CommissionType;
  commission_value: number;
  commission_terms: string;
  worker_commission_amount: number | null;
  status: DealStatus;
  created_at: string;
  completed_at: string | null;
}

export interface DealFinancials {
  deal_id: string;
  commission_total: number;
  platform_fee_percent: number;
  platform_fee_amount: number;
  worker_commission_amount: number;
}

export interface DealWithParties extends Deal {
  owner: OwnerName | null;
  worker: OwnerName | null;
}

export interface DealEvent {
  id: string;
  deal_id: string;
  event_type: 'created' | 'completed';
  note: string | null;
  created_at: string;
}

export type ListingCategory = 'cars' | 'real_estate' | 'electronics' | 'furniture' | 'commercial' | 'services';

export const LISTING_CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: 'cars', label: 'السيارات' },
  { value: 'real_estate', label: 'العقارات' },
  { value: 'electronics', label: 'الأجهزة الإلكترونية' },
  { value: 'furniture', label: 'الأثاث' },
  { value: 'commercial', label: 'المنتجات التجارية' },
  { value: 'services', label: 'الخدمات' },
];

export const GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'البحر الأحمر',
  'البحيرة',
  'الفيوم',
  'الغربية',
  'الإسماعيلية',
  'المنوفية',
  'المنيا',
  'القليوبية',
  'الوادي الجديد',
  'السويس',
  'أسوان',
  'أسيوط',
  'بني سويف',
  'بورسعيد',
  'دمياط',
  'الشرقية',
  'جنوب سيناء',
  'كفر الشيخ',
  'مطروح',
  'الأقصر',
  'قنا',
  'شمال سيناء',
  'سوهاج',
];

export const categoryLabel = (value: ListingCategory) =>
  LISTING_CATEGORIES.find((c) => c.value === value)?.label ?? value;

export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  pending: 'قيد المراجعة',
  accepted: 'مقبول',
  rejected: 'مرفوض',
  withdrawn: 'تم السحب',
};

export const listingStatusLabel: Record<ListingStatus, string> = {
  active: 'منشور',
  paused: 'متوقف مؤقتاً',
  closed: 'مغلق',
  sold: 'تم البيع',
  suspended: 'موقوف من الإدارة',
};

export type BuyerStatus = 'pending' | 'accepted' | 'objected';

export interface Buyer {
  id: string;
  reference_number: string;
  listing_id: string;
  worker_id: string;
  owner_id: string;
  buyer_name: string;
  buyer_phone: string;
  status: BuyerStatus;
  objection_evidence: string | null;
  consent_confirmed_at: string;
  decided_at: string | null;
  protection_ends_at: string | null;
  created_at: string;
}

export const buyerStatusLabel: Record<BuyerStatus, string> = {
  pending: 'بانتظار مراجعة المالك',
  accepted: 'مؤكد ومحمي',
  objected: 'معترض عليه',
};

export const dealStatusLabel: Record<DealStatus, string> = {
  active: 'اتفاق نشط',
  completed: 'مكتمل',
};
