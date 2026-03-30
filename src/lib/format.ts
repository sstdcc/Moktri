/**
 * Shared formatting utilities for مفتاح
 */

const periodLabels: Record<string, string> = {
  monthly: 'شهرياً',
  yearly: 'سنوياً',
  daily: 'يومياً',
};

export const formatPrice = (
  amount: number,
  currency = 'YER',
  period?: string | null
): string => {
  const formatted = amount.toLocaleString('ar-YE');
  const suffix = period ? ` ${periodLabels[period] || ''}` : '';
  const currencyLabel = currency === 'YER' ? 'ر.ي' : currency;
  return `${formatted} ${currencyLabel}${suffix}`;
};

export const timeAgo = (date: string | Date): string => {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'الآن';
  if (diffMin === 1) return 'منذ دقيقة';
  if (diffMin === 2) return 'منذ دقيقتين';
  if (diffMin < 11) return `منذ ${diffMin} دقائق`;
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHour === 1) return 'منذ ساعة';
  if (diffHour === 2) return 'منذ ساعتين';
  if (diffHour < 11) return `منذ ${diffHour} ساعات`;
  if (diffHour < 24) return `منذ ${diffHour} ساعة`;
  if (diffDay === 1) return 'منذ يوم';
  if (diffDay === 2) return 'منذ يومين';
  if (diffDay < 11) return `منذ ${diffDay} أيام`;
  if (diffDay < 7) return `منذ ${diffDay} يوم`;
  if (diffWeek === 1) return 'منذ أسبوع';
  if (diffWeek === 2) return 'منذ أسبوعين';
  if (diffWeek < 5) return `منذ ${diffWeek} أسابيع`;
  return `منذ ${diffDay} يوم`;
};

export const formatYemeniPhone = (phone: string): string => {
  if (!phone) return '';
  // Strip all non-digits
  let digits = phone.replace(/[^\d]/g, '');
  // Normalize to +967 format
  if (digits.startsWith('00967')) digits = digits.slice(2);
  else if (digits.startsWith('967')) { /* keep */ }
  else if (digits.startsWith('0')) digits = '967' + digits.slice(1);
  else if (digits.length <= 9) digits = '967' + digits;
  return '+' + digits;
};

export const formatPhoneDisplay = (phone: string): string => {
  const normalized = formatYemeniPhone(phone);
  if (normalized.length < 10) return normalized;
  // +967 7XX XXX XXX
  return normalized.replace(/^\+(\d{3})(\d{3})(\d{3})(\d{3})$/, '+$1 $2 $3 $4');
};

export const whatsappLink = (phone: string, message = ''): string => {
  const digits = formatYemeniPhone(phone).replace('+', '');
  return `https://wa.me/${digits}${message ? '?text=' + encodeURIComponent(message) : ''}`;
};

export const telLink = (phone: string): string => {
  return `tel:${formatYemeniPhone(phone)}`;
};
