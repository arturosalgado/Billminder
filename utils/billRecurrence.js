import {
  addDays,
  addMonth,
  formatMonthYear,
} from './billUtils';

export const REPEAT_OPTIONS = [
  'Never',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Yearly',
];

/** Map legacy / unknown values to a canonical repeat label */
export function normalizeRepeat(raw) {
  if (raw === 'One-time') return 'Never';
  if (REPEAT_OPTIONS.includes(raw)) return raw;
  return 'Never';
}

export function isNonRecurringRepeat(repeat) {
  return normalizeRepeat(repeat) === 'Never';
}

function addMonths(d, count) {
  let x = new Date(d.getTime());
  for (let i = 0; i < count; i += 1) {
    x = addMonth(x);
  }
  return x;
}

/** Next due after marking paid, for recurring bills (caller skips if non-recurring). */
export function computeNextDueAfterPayment(due, repeat) {
  const r = normalizeRepeat(repeat);
  switch (r) {
    case 'Weekly':
      return addDays(due, 7);
    case 'Monthly':
      return addMonth(due);
    case 'Quarterly':
      return addMonths(due, 3);
    case 'Yearly':
      return addMonths(due, 12);
    default:
      return new Date(due.getTime());
  }
}

const CLEARED_REMINDER = {
  reminderOverrideAt: undefined,
  scheduledNotificationId: undefined,
  reminderScheduledForMs: undefined,
};

/**
 * Bill state after user marks paid (same row: paid stays true for Never, else unpaid + advanced due).
 */
export function buildNextBillAfterMarkPaid(bill, now = new Date()) {
  const entryMonth = formatMonthYear(now);
  const paymentHistory = [
    { month: entryMonth, status: 'Paid' },
    ...bill.paymentHistory,
  ].slice(0, 12);

  if (isNonRecurringRepeat(bill.repeat)) {
    return {
      ...bill,
      ...CLEARED_REMINDER,
      paid: true,
      paymentHistory,
    };
  }

  return {
    ...bill,
    ...CLEARED_REMINDER,
    paid: false,
    due: computeNextDueAfterPayment(bill.due, bill.repeat),
    paymentHistory,
  };
}
