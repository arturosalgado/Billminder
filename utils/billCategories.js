import { normalizeCurrency } from './currencies';
import { normalizeRepeat } from './billRecurrence';

/** Canonical built-in categories (order preserved) */
export const BILL_CATEGORIES = [
  { id: 'Housing', label: 'Housing', color: '#4660AF' },
  { id: 'Utilities', label: 'Utilities', color: '#14A096' },
  { id: 'Subscriptions', label: 'Subscriptions', color: '#823CC8' },
  { id: 'Insurance', label: 'Insurance', color: '#D48228' },
  { id: 'Transport', label: 'Transport', color: '#2EA05A' },
  { id: 'Other', label: 'Other', color: '#8A8FA8' },
];

export const BUILTIN_CATEGORY_IDS = new Set(BILL_CATEGORIES.map((c) => c.id));

const LEGACY_MAP = {
  'Credit Cards': 'Other',
};

/** Rotating palette for user-created categories */
export const CUSTOM_CATEGORY_COLOR_PALETTE = [
  '#5B7C99',
  '#C45C5C',
  '#6B9E7D',
  '#9B6BB8',
  '#B8860B',
  '#4A90A4',
  '#A67C52',
  '#6C757D',
];

export function mergeCategoryLists(customCategories) {
  const safe = Array.isArray(customCategories) ? customCategories : [];
  return [...BILL_CATEGORIES, ...safe];
}

/**
 * When loading from storage: legacy + built-ins only; keep other strings (custom ids).
 */
export function deserializeCategory(raw) {
  if (typeof raw !== 'string') return 'Other';
  const trimmed = raw.trim();
  if (!trimmed) return 'Other';
  if (LEGACY_MAP[trimmed]) return LEGACY_MAP[trimmed];
  if (BUILTIN_CATEGORY_IDS.has(trimmed)) return trimmed;
  return trimmed;
}

/**
 * Validate category id for a new/updated bill (built-in, custom list, or Other).
 */
export function normalizeCategoryInput(raw, customCategories) {
  if (typeof raw !== 'string') return 'Other';
  const trimmed = raw.trim();
  if (!trimmed) return 'Other';
  if (LEGACY_MAP[trimmed]) return LEGACY_MAP[trimmed];
  if (BUILTIN_CATEGORY_IDS.has(trimmed)) return trimmed;
  const custom = Array.isArray(customCategories) ? customCategories : [];
  if (custom.some((c) => c.id === trimmed)) return trimmed;
  return 'Other';
}

/** Resolve display meta; unknown ids fall back to Other */
export function getCategoryMeta(categoryId, customCategories) {
  const merged = mergeCategoryLists(
    Array.isArray(customCategories) ? customCategories : []
  );
  const id = typeof categoryId === 'string' ? categoryId.trim() : '';
  const hit = merged.find((c) => c.id === id);
  if (hit) return hit;
  return BILL_CATEGORIES[BILL_CATEGORIES.length - 1];
}

/** @deprecated Use normalizeCategoryInput + custom list, or deserializeCategory */
export function normalizeCategory(raw) {
  return normalizeCategoryInput(raw, []);
}

/** Rough monthly equivalent for budgeting (one-time bills contribute 0). */
export function estimateMonthlyAmountCents(amountCents, repeat) {
  const r = normalizeRepeat(repeat);
  const n = Number(amountCents) || 0;
  switch (r) {
    case 'Never':
      return 0;
    case 'Weekly':
      return Math.round((n * 52) / 12);
    case 'Monthly':
      return n;
    case 'Quarterly':
      return Math.round(n / 3);
    case 'Yearly':
      return Math.round(n / 12);
    default:
      return 0;
  }
}

export function sumEstimatedMonthlyCentsForBills(bills) {
  let sum = 0;
  for (const b of bills) {
    sum += estimateMonthlyAmountCents(b.amountCents, b.repeat);
  }
  return sum;
}

/** @returns {Array<{ currency: string, minor: number }>} sorted by currency code */
export function sumEstimatedMonthlyByCurrency(bills) {
  const map = new Map();
  for (const b of bills) {
    const c = normalizeCurrency(b.currency);
    const add = estimateMonthlyAmountCents(b.amountCents, b.repeat);
    map.set(c, (map.get(c) || 0) + add);
  }
  return [...map.entries()]
    .map(([currency, minor]) => ({ currency, minor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
