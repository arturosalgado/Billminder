import { Platform, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import {
  CURRENCY_MINOR_UNITS,
  normalizeCurrency,
} from './currencies';
import { normalizeRepeat } from './billRecurrence';
import {
  getCategoryMeta,
  normalizeCategoryInput,
} from './billCategories';

export const BILL_CSV_HEADERS = [
  'Name',
  'Amount',
  'Currency',
  'Category',
  'Due Date',
  'Status',
  'Paid Date',
  'Recurrence',
  'Notes',
];

export function formatDateYmd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** paymentHistory stores `month` from formatMonthYear (e.g. "April 2026"). */
function paymentMonthLabelToYmd(monthLabel) {
  if (!monthLabel || typeof monthLabel !== 'string') return '';
  const trimmed = monthLabel.trim();
  const match = trimmed.match(/^(.+?)\s+(\d{4})$/);
  if (!match) return '';
  const d = new Date(`${match[1].trim()} 1, ${match[2]}`);
  if (Number.isNaN(d.getTime())) return '';
  return formatDateYmd(d);
}

function escapeCsvField(value) {
  const s = String(value ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function amountMajorString(bill) {
  const c = normalizeCurrency(bill.currency);
  const digits = CURRENCY_MINOR_UNITS[c] ?? 2;
  const minor = Number(bill.amountCents) || 0;
  const scale = 10 ** digits;
  const major = minor / scale;
  return major.toFixed(digits);
}

function paidDateForExport(bill) {
  if (!bill.paid) return '';
  const first = Array.isArray(bill.paymentHistory)
    ? bill.paymentHistory[0]
    : null;
  if (first?.month) {
    const ymd = paymentMonthLabelToYmd(first.month);
    if (ymd) return ymd;
  }
  return '';
}

/** @param {object[]} bills @param {object[]} customCategories */
export function buildBillsCsv(bills, customCategories) {
  const lines = [BILL_CSV_HEADERS.map(escapeCsvField).join(',')];

  for (const bill of bills) {
    const catId = normalizeCategoryInput(
      bill.category,
      customCategories
    );
    const categoryLabel = getCategoryMeta(catId, customCategories).label;
    const row = [
      bill.name,
      amountMajorString(bill),
      normalizeCurrency(bill.currency),
      categoryLabel,
      formatDateYmd(bill.due instanceof Date ? bill.due : new Date(bill.due)),
      bill.paid ? 'Paid' : 'Unpaid',
      paidDateForExport(bill),
      normalizeRepeat(bill.repeat),
      typeof bill.notes === 'string' ? bill.notes : '',
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Writes CSV to cache and opens the system share sheet (native) or downloads (web).
 * @param {string} csvText
 * @param {{ dialogTitle?: string }} [opts]
 */
export async function shareBillsCsvFile(csvText, opts = {}) {
  const today = formatDateYmd(new Date());
  const filename = `BillMinder_Export_${today}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const base = cacheDirectory;
  if (!base) {
    throw new Error('Cache directory is not available');
  }
  const uri = `${base}${filename}`;
  await writeAsStringAsync(uri, csvText, {
    encoding: EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: opts.dialogTitle ?? 'Export bills',
    ...(Platform.OS === 'ios'
      ? { UTI: 'public.comma-separated-values-text' }
      : {}),
  });
}

export function exportShareErrorMessage(err) {
  const msg = err && typeof err.message === 'string' ? err.message : String(err);
  if (msg === 'User did not share') return null;
  return msg || 'Export failed';
}

export function showExportErrorAlert(err) {
  const detail = exportShareErrorMessage(err);
  if (!detail) return;
  Alert.alert('Export failed', detail);
}
