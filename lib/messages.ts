const ERROR_MESSAGES: Array<[string, string]> = [
  ['Invalid login credentials', 'البريد الإلكتروني أو كلمة المرور غير صحيحة'],
  ['User already registered', 'هذا البريد الإلكتروني مسجل بالفعل'],
  ['already registered', 'هذا البريد الإلكتروني مسجل بالفعل'],
  ['Password should be at least', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'],
  ['Email rate limit exceeded', 'محاولات كثيرة، انتظر قليلاً ثم حاول مرة أخرى'],
  ['Failed to fetch', 'تعذر الاتصال بالخادم، تحقق من اتصال الإنترنت'],
  ['NetworkError', 'تعذر الاتصال بالخادم، تحقق من اتصال الإنترنت'],
  ['application_not_found', 'الطلب غير موجود'],
  ['application_not_pending', 'هذا الطلب تمت مراجعته بالفعل'],
  ['listing_not_active', 'الإعلان غير منشور حالياً'],
  ['deal_not_active', 'هذا الاتفاق مكتمل بالفعل'],
  ['deal_not_found', 'الاتفاق غير موجود'],
  ['applications_one_per_worker', 'سبق أن تقدمت على هذا الإعلان'],
  ['row-level security', 'ليس لديك صلاحية لتنفيذ هذا الإجراء'],
  ['not_allowed', 'ليس لديك صلاحية لتنفيذ هذا الإجراء'],
  ['deals_listing_id_fkey', 'لا يمكن حذف الإعلان لوجود اتفاقات مرتبطة به، يمكنك إغلاقه بدلاً من ذلك'],
];

export const translateError = (error: { message?: string } | null | undefined) => {
  const message = error?.message ?? '';
  const match = ERROR_MESSAGES.find(([needle]) => message.includes(needle));
  return match ? match[1] : 'حدث خطأ غير متوقع، حاول مرة أخرى';
};
