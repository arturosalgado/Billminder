import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { deserializeCategory } from '../utils/billCategories';
import { normalizeBillNameInput } from '../utils/billUtils';
import { normalizeCurrency } from '../utils/currencies';
import {
  buildNextBillAfterMarkPaid,
  isNonRecurringRepeat,
  normalizeRepeat,
} from '../utils/billRecurrence';

export const STORAGE_KEY = 'billminder_bills';

export async function cancelScheduledNotificationById(notificationId) {
  if (Platform.OS === 'web' || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // already fired or invalid id
  }
}

export function serializeBills(bills) {
  return JSON.stringify(
    bills.map((b) => {
      const name = normalizeBillNameInput(b?.name) || 'Unnamed bill';
      const amountParsed = Number(b.amountCents);
      const amountCents = Number.isFinite(amountParsed)
        ? Math.max(0, Math.round(amountParsed))
        : 0;
      const row = {
        ...b,
        name,
        amountCents,
        due: b.due instanceof Date ? b.due.toISOString() : b.due,
      };
      if (b.reminderOverrideAt instanceof Date) {
        row.reminderOverrideAt = b.reminderOverrideAt.toISOString();
      }
      if (typeof b.scheduledNotificationId === 'string') {
        row.scheduledNotificationId = b.scheduledNotificationId;
      }
      if (typeof b.reminderScheduledForMs === 'number') {
        row.reminderScheduledForMs = b.reminderScheduledForMs;
      }
      return row;
    })
  );
}

export function deserializeBills(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const raw of data) {
    if (!raw || typeof raw.id !== 'string') continue;
    const due = new Date(raw.due);
    if (Number.isNaN(due.getTime())) continue;
    let reminderOverrideAt = null;
    if (raw.reminderOverrideAt) {
      const ro = new Date(raw.reminderOverrideAt);
      if (!Number.isNaN(ro.getTime())) reminderOverrideAt = ro;
    }
    const scheduledNotificationId =
      typeof raw.scheduledNotificationId === 'string'
        ? raw.scheduledNotificationId
        : undefined;
    const reminderScheduledForMs =
      typeof raw.reminderScheduledForMs === 'number'
        ? raw.reminderScheduledForMs
        : undefined;
    const nameNormalized = normalizeBillNameInput(
      typeof raw.name === 'string' ? raw.name : ''
    );
    if (!nameNormalized) continue;

    const amountParsed = Number(raw.amountCents);
    const amountCents = Number.isFinite(amountParsed)
      ? Math.max(0, Math.round(amountParsed))
      : 0;

    out.push({
      id: raw.id,
      name: nameNormalized,
      amountCents,
      due,
      paid: Boolean(raw.paid),
      repeat: normalizeRepeat(
        typeof raw.repeat === 'string' ? raw.repeat : 'Never'
      ),
      category: deserializeCategory(
        typeof raw.category === 'string' ? raw.category : 'Other'
      ),
      currency: normalizeCurrency(
        typeof raw.currency === 'string' ? raw.currency : 'USD'
      ),
      remind: typeof raw.remind === 'string' ? raw.remind : 'On the day',
      paymentHistory: Array.isArray(raw.paymentHistory)
        ? raw.paymentHistory.map((p) => ({
            month: String(p?.month ?? ''),
            status: String(p?.status ?? 'Paid'),
          }))
        : [],
      ...(reminderOverrideAt ? { reminderOverrideAt } : {}),
      ...(scheduledNotificationId ? { scheduledNotificationId } : {}),
      ...(reminderScheduledForMs != null
        ? { reminderScheduledForMs }
        : {}),
    });
  }
  return out;
}

export async function loadBills() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return deserializeBills(parsed);
  } catch {
    return [];
  }
}

export async function saveBills(bills) {
  await AsyncStorage.setItem(STORAGE_KEY, serializeBills(bills));
}

export async function markBillPaidOnlyInStorage(billId) {
  const bills = await loadBills();
  const target = bills.find((b) => b.id === billId);
  if (target?.scheduledNotificationId) {
    await cancelScheduledNotificationById(target.scheduledNotificationId);
  }
  let next = bills.map((b) =>
    b.id === billId ? buildNextBillAfterMarkPaid(b) : b
  );
  const updated = next.find((b) => b.id === billId);
  await saveBills(next);
  if (
    updated &&
    !isNonRecurringRepeat(updated.repeat) &&
    Platform.OS !== 'web'
  ) {
    const { computeBillReminderDate, scheduleBillReminderAt } = await import(
      './billReminders.js'
    );
    const when = computeBillReminderDate(updated);
    if (when.getTime() > Date.now()) {
      const nid = await scheduleBillReminderAt(updated, when);
      if (nid) {
        next = next.map((b) =>
          b.id === billId
            ? {
                ...b,
                scheduledNotificationId: nid,
                reminderScheduledForMs: when.getTime(),
              }
            : b
        );
        await saveBills(next);
      }
    }
  }
  return next;
}

export async function setBillReminderOverride(billId, date) {
  const bills = await loadBills();
  const next = bills.map((b) => {
    if (b.id !== billId) return b;
    if (!date || Number.isNaN(date.getTime())) {
      const { reminderOverrideAt: _r, ...rest } = b;
      return rest;
    }
    return { ...b, reminderOverrideAt: new Date(date.getTime()) };
  });
  await saveBills(next);
  return next;
}

/** After "Remind tomorrow" — persist override + new scheduled notification id */
export async function setBillReminderSchedule(
  billId,
  fireAt,
  notificationId
) {
  const bills = await loadBills();
  const next = bills.map((b) => {
    if (b.id !== billId) return b;
    const row = {
      ...b,
      reminderOverrideAt: new Date(fireAt.getTime()),
    };
    if (notificationId) {
      row.scheduledNotificationId = notificationId;
      row.reminderScheduledForMs = fireAt.getTime();
    } else {
      delete row.scheduledNotificationId;
      delete row.reminderScheduledForMs;
    }
    return row;
  });
  await saveBills(next);
  return next;
}
