import { formatAmountMinor } from './currencies';

export const STATUS = {
  PAID: 'paid',
  OVERDUE: 'overdue',
  DUE_SOON: 'dueSoon',
  UPCOMING: 'upcoming',
};

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** @param {number} [months=1] Pass negative to go back in time */
export function addMonth(d, months = 1) {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + months);
  return x;
}

export function billStatus(bill, todayStart) {
  if (bill.paid) return STATUS.PAID;
  const dueStart = startOfDay(bill.due);
  if (dueStart < todayStart) return STATUS.OVERDUE;
  const soonEnd = addDays(todayStart, 3);
  if (dueStart <= endOfDay(soonEnd)) return STATUS.DUE_SOON;
  return STATUS.UPCOMING;
}

/** @deprecated Prefer formatBillAmount or formatAmountMinor with currency */
export function formatCurrency(cents) {
  return formatAmountMinor(Number(cents) || 0, 'USD');
}

export { formatBillAmount } from './currencies';

export function formatDueDateLong(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDueDateShort(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function formatMonthYear(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function isSameMonth(date, reference) {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
  );
}
