import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadBills,
  markBillPaidOnlyInStorage,
  cancelScheduledNotificationById,
  setBillReminderSchedule,
} from './billPersistence';
import { requestBillsReload } from './billsReloadRegistry';
import { formatBillAmount } from '../utils/billUtils';

const ACTION_DEDUPE_KEY = 'billminder_notif_action_dedupe';

export const BILL_REMINDER_TYPE = 'bill_reminder';
/** Category id: no `:` or `-` per expo-notifications */
export const BILL_REMINDER_CATEGORY = 'bill_reminder';
export const ACTION_MARK_PAID = 'MARK_PAID';
export const ACTION_REMIND_TOMORROW = 'REMIND_TOMORROW';

export async function registerBillNotificationCategory() {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync(BILL_REMINDER_CATEGORY, [
    {
      identifier: ACTION_MARK_PAID,
      buttonTitle: 'Mark as Paid',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: ACTION_REMIND_TOMORROW,
      buttonTitle: 'Remind Me Tomorrow',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
}

function reminderDaysBefore(remind) {
  if (remind === '1 day before') return 1;
  if (remind === '3 days before') return 3;
  if (remind === '7 days before') return 7;
  return 0;
}

function atNineAm(d) {
  const x = new Date(d);
  x.setHours(9, 0, 0, 0);
  return x;
}

export function computeBillReminderDate(bill) {
  if (
    bill.reminderOverrideAt instanceof Date &&
    !Number.isNaN(bill.reminderOverrideAt.getTime()) &&
    bill.reminderOverrideAt.getTime() > Date.now()
  ) {
    return bill.reminderOverrideAt;
  }
  const due = new Date(bill.due);
  const offset = reminderDaysBefore(bill.remind);
  const day = new Date(due);
  day.setDate(day.getDate() - offset);
  return atNineAm(day);
}

/** Full due date for notification body */
function formatDueExact(due) {
  return due.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

async function dismissIfPossible(notificationIdentifier) {
  try {
    await Notifications.dismissNotificationAsync(notificationIdentifier);
  } catch {
    // not present in tray
  }
}

/**
 * Schedule local reminder: 9am on reminder day, title "{name} is due soon", body amount + exact due date.
 * @returns {Promise<string|null>} notification id from expo-notifications
 */
export async function scheduleBillReminderAt(bill, triggerDate) {
  if (Platform.OS === 'web') return null;
  if (!(triggerDate instanceof Date) || Number.isNaN(triggerDate.getTime())) {
    return null;
  }
  if (triggerDate.getTime() <= Date.now()) return null;

  const title = `${bill.name} is due soon`;
  const body = `${formatBillAmount(bill)} — Due ${formatDueExact(bill.due)}`;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      categoryIdentifier: BILL_REMINDER_CATEGORY,
      sound: 'default',
      data: {
        type: BILL_REMINDER_TYPE,
        billId: bill.id,
        fireAt: String(triggerDate.getTime()),
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: 'default',
    },
  });
}

function notificationStateChanged(prev, next) {
  if (prev.length !== next.length) return true;
  const pmap = new Map(prev.map((b) => [b.id, b]));
  for (const b of next) {
    const p = pmap.get(b.id);
    if (!p) return true;
    if (p.scheduledNotificationId !== b.scheduledNotificationId) return true;
    if (p.reminderScheduledForMs !== b.reminderScheduledForMs) return true;
  }
  return false;
}

/**
 * Ensures each unpaid bill has exactly one future reminder when needed; clears ids when paid or past.
 * Returns updated bills array when schedule fields change.
 */
export async function reconcileBillNotifications(bills) {
  if (Platform.OS === 'web') return bills;

  const next = bills.map((b) => ({ ...b }));

  for (let i = 0; i < next.length; i += 1) {
    const bill = next[i];

    if (bill.paid) {
      if (bill.scheduledNotificationId) {
        await cancelScheduledNotificationById(bill.scheduledNotificationId);
        bill.scheduledNotificationId = undefined;
        bill.reminderScheduledForMs = undefined;
      }
      continue;
    }

    const when = computeBillReminderDate(bill);
    const whenMs = when.getTime();

    if (whenMs <= Date.now()) {
      if (bill.scheduledNotificationId) {
        await cancelScheduledNotificationById(bill.scheduledNotificationId);
        bill.scheduledNotificationId = undefined;
        bill.reminderScheduledForMs = undefined;
      }
      continue;
    }

    if (
      bill.scheduledNotificationId &&
      bill.reminderScheduledForMs === whenMs
    ) {
      continue;
    }

    if (bill.scheduledNotificationId) {
      await cancelScheduledNotificationById(bill.scheduledNotificationId);
    }

    const newId = await scheduleBillReminderAt(bill, when);
    bill.scheduledNotificationId = newId ?? undefined;
    bill.reminderScheduledForMs = newId ? whenMs : undefined;
  }

  if (!notificationStateChanged(bills, next)) {
    return bills;
  }
  return next;
}

export async function handleBillNotificationResponse(response) {
  if (Platform.OS === 'web') return;
  const { actionIdentifier, notification } = response;
  if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) return;

  const data = notification.request.content.data;
  if (data?.type !== BILL_REMINDER_TYPE) return;
  const billId = data?.billId;
  if (billId == null || billId === '') return;

  const dedupeSig = JSON.stringify({
    id: notification.request.identifier,
    action: actionIdentifier,
    date: notification.date,
  });
  try {
    const prev = await AsyncStorage.getItem(ACTION_DEDUPE_KEY);
    if (prev === dedupeSig) return;
  } catch {
    // continue
  }

  const nid = notification.request.identifier;

  if (actionIdentifier === ACTION_MARK_PAID) {
    await markBillPaidOnlyInStorage(String(billId));
    await dismissIfPossible(nid);
    await requestBillsReload();
    try {
      await AsyncStorage.setItem(ACTION_DEDUPE_KEY, dedupeSig);
    } catch {
      // ignore
    }
    return;
  }

  if (actionIdentifier === ACTION_REMIND_TOMORROW) {
    const fireRaw = data.fireAt;
    let base;
    if (fireRaw != null && fireRaw !== '') {
      base = new Date(Number(fireRaw));
    } else {
      base = new Date(notification.date);
    }
    if (Number.isNaN(base.getTime())) {
      base = new Date();
    }

    const nextTrigger = new Date(base.getTime());
    nextTrigger.setDate(nextTrigger.getDate() + 1);

    await dismissIfPossible(nid);

    const bills = await loadBills();
    const bill = bills.find((b) => b.id === String(billId));
    if (bill?.scheduledNotificationId) {
      await cancelScheduledNotificationById(bill.scheduledNotificationId);
    }

    if (bill && nextTrigger.getTime() > Date.now()) {
      const newId = await scheduleBillReminderAt(bill, nextTrigger);
      await setBillReminderSchedule(String(billId), nextTrigger, newId);
      await requestBillsReload();
    }
    try {
      await AsyncStorage.setItem(ACTION_DEDUPE_KEY, dedupeSig);
    } catch {
      // ignore
    }
  }
}
