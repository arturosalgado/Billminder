/** Supported currencies: code → minor units (ISO 4217 fraction digits) */
export const CURRENCY_MINOR_UNITS = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  MXN: 2,
  BRL: 2,
  INR: 2,
  JPY: 0,
};

export const DEFAULT_CURRENCY = 'USD';

const VALID_CODES = new Set(Object.keys(CURRENCY_MINOR_UNITS));

/** Horizontal picker: code + display symbol for labels */
export const CURRENCY_OPTIONS = [
  { code: 'USD', caption: 'USD ($)' },
  { code: 'EUR', caption: 'EUR (€)' },
  { code: 'GBP', caption: 'GBP (£)' },
  { code: 'CAD', caption: 'CAD ($)' },
  { code: 'AUD', caption: 'AUD ($)' },
  { code: 'JPY', caption: 'JPY (¥)' },
  { code: 'MXN', caption: 'MXN ($)' },
  { code: 'BRL', caption: 'BRL (R$)' },
  { code: 'INR', caption: 'INR (₹)' },
];

const LOCALE_BY_CURRENCY = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  CAD: 'en-CA',
  AUD: 'en-AU',
  JPY: 'ja-JP',
  MXN: 'es-MX',
  BRL: 'pt-BR',
  INR: 'en-IN',
};

export function normalizeCurrency(raw) {
  if (typeof raw !== 'string') return DEFAULT_CURRENCY;
  const u = raw.trim().toUpperCase();
  return VALID_CODES.has(u) ? u : DEFAULT_CURRENCY;
}

export function minorUnitScale(currencyCode) {
  const c = normalizeCurrency(currencyCode);
  const d = CURRENCY_MINOR_UNITS[c] ?? 2;
  return 10 ** d;
}

export function formatAmountMinor(minor, currencyCode) {
  const c = normalizeCurrency(currencyCode);
  const digits = CURRENCY_MINOR_UNITS[c] ?? 2;
  const major = minor / minorUnitScale(c);
  const locale = LOCALE_BY_CURRENCY[c] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: c,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    return `${(major).toFixed(digits)} ${c}`;
  }
}

/** Multi-currency summary segments: "$1,200 USD" */
export function formatAmountMinorWithCode(minor, currencyCode) {
  const c = normalizeCurrency(currencyCode);
  return `${formatAmountMinor(minor, c)} ${c}`;
}

export function formatBillAmount(bill) {
  const c = normalizeCurrency(bill?.currency);
  return formatAmountMinor(Number(bill?.amountCents) || 0, c);
}

export function parseAmountStringToMinor(raw, currencyCode) {
  const c = normalizeCurrency(currencyCode);
  const digits = CURRENCY_MINOR_UNITS[c] ?? 2;
  const cleaned = String(raw).replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  if (digits === 0) return Math.round(parsed);
  return Math.round(parsed * minorUnitScale(c));
}

export function amountPlaceholder(currencyCode) {
  const c = normalizeCurrency(currencyCode);
  return CURRENCY_MINOR_UNITS[c] === 0 ? '0' : '0.00';
}

export function amountKeyboardType(currencyCode) {
  const c = normalizeCurrency(currencyCode);
  return CURRENCY_MINOR_UNITS[c] === 0 ? 'number-pad' : 'decimal-pad';
}
