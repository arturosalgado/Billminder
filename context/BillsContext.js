import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { addDays } from '../utils/billUtils';
import { normalizeCategoryInput } from '../utils/billCategories';
import { CategoriesProvider, useCategories } from './CategoriesContext';
import { normalizeCurrency } from '../utils/currencies';
import {
  buildNextBillAfterMarkPaid,
  isNonRecurringRepeat,
  normalizeRepeat,
} from '../utils/billRecurrence';
import {
  loadBills,
  saveBills,
  cancelScheduledNotificationById,
} from '../services/billPersistence';
import { registerBillsReload } from '../services/billsReloadRegistry';
import {
  reconcileBillNotifications,
  computeBillReminderDate,
  scheduleBillReminderAt,
} from '../services/billReminders';

const BillsContext = createContext(null);

function BillsProviderInner({ children }) {
  const { customCategories } = useCategories();
  const [bills, setBills] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const billsRef = useRef(bills);
  useEffect(() => {
    billsRef.current = bills;
  }, [bills]);

  const reloadFromStorage = useCallback(async () => {
    const next = await loadBills();
    setBills(next);
  }, []);

  useEffect(() => {
    registerBillsReload(reloadFromStorage);
    return () => registerBillsReload(null);
  }, [reloadFromStorage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadBills();
        if (cancelled) return;
        setBills(loaded);
      } catch {
        if (!cancelled) setBills([]);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        await saveBills(bills);
      } catch {
        // ignore persist errors
      }
    })();
  }, [bills, hydrated]);

  useEffect(() => {
    if (!hydrated || Platform.OS === 'web') return;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const updated = await reconcileBillNotifications(bills);
          if (!cancelled && updated !== bills) {
            setBills(updated);
          }
        } catch {
          // ignore
        }
      })();
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bills, hydrated]);

  const markPaid = useCallback(async (billId) => {
    const b = billsRef.current.find((x) => x.id === billId);
    if (!b) return;

    if (b.scheduledNotificationId && Platform.OS !== 'web') {
      await cancelScheduledNotificationById(b.scheduledNotificationId);
    }

    let next = buildNextBillAfterMarkPaid(b);

    if (!isNonRecurringRepeat(b.repeat) && Platform.OS !== 'web') {
      const when = computeBillReminderDate(next);
      if (when.getTime() > Date.now()) {
        const nid = await scheduleBillReminderAt(next, when);
        if (nid) {
          next = {
            ...next,
            scheduledNotificationId: nid,
            reminderScheduledForMs: when.getTime(),
          };
        }
      }
    }

    setBills((prev) => prev.map((x) => (x.id === billId ? next : x)));
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const snoozeReminder = useCallback((billId, dayCount) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        if (b.scheduledNotificationId && Platform.OS !== 'web') {
          void cancelScheduledNotificationById(b.scheduledNotificationId);
        }
        return {
          ...b,
          due: addDays(b.due, dayCount),
          reminderOverrideAt: undefined,
          scheduledNotificationId: undefined,
          reminderScheduledForMs: undefined,
        };
      })
    );
  }, []);

  const reassignBillsCategoryToOther = useCallback((formerCategoryId) => {
    setBills((prev) =>
      prev.map((b) =>
        b.category === formerCategoryId ? { ...b, category: 'Other' } : b
      )
    );
  }, []);

  const addBill = useCallback(
    async (input) => {
      const name = String(input?.name ?? '').trim();
      const amountCents = Number(input?.amountCents);
      if (!name || !Number.isFinite(amountCents) || amountCents < 0) {
        return false;
      }

      const id = `bill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newBill = {
        id,
        name,
        amountCents,
        due: new Date(input.due.getTime()),
        paid: false,
        repeat: normalizeRepeat(input.repeat),
        category: normalizeCategoryInput(input.category, customCategories),
        currency: normalizeCurrency(input.currency),
        remind: input.remind,
        paymentHistory: [],
      };

    let scheduledNotificationId;
    let reminderScheduledForMs;
    if (Platform.OS !== 'web') {
      const when = computeBillReminderDate(newBill);
      if (when.getTime() > Date.now()) {
        const nid = await scheduleBillReminderAt(newBill, when);
        if (nid) {
          scheduledNotificationId = nid;
          reminderScheduledForMs = when.getTime();
        }
      }
    }

      setBills((prev) => [
        ...prev,
        {
          ...newBill,
          ...(scheduledNotificationId
            ? { scheduledNotificationId, reminderScheduledForMs }
            : {}),
        },
      ]);
      return true;
    },
    [customCategories]
  );

  const updateBillRecurrence = useCallback((billId, repeat) => {
    const normalized = normalizeRepeat(repeat);
    setBills((prev) =>
      prev.map((x) => (x.id === billId ? { ...x, repeat: normalized } : x))
    );
  }, []);

  const removeBill = useCallback((billId) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setBills((prev) => {
      const target = prev.find((b) => b.id === billId);
      if (target?.scheduledNotificationId && Platform.OS !== 'web') {
        void cancelScheduledNotificationById(target.scheduledNotificationId);
      }
      return prev.filter((b) => b.id !== billId);
    });
  }, []);

  const value = useMemo(
    () => ({
      bills,
      billsHydrated: hydrated,
      refreshBills: reloadFromStorage,
      markPaid,
      snoozeReminder,
      addBill,
      removeBill,
      updateBillRecurrence,
      reassignBillsCategoryToOther,
    }),
    [
      bills,
      hydrated,
      reloadFromStorage,
      markPaid,
      snoozeReminder,
      addBill,
      removeBill,
      updateBillRecurrence,
      reassignBillsCategoryToOther,
    ]
  );

  return (
    <BillsContext.Provider value={value}>{children}</BillsContext.Provider>
  );
}

export function BillsProvider({ children }) {
  return (
    <CategoriesProvider>
      <BillsProviderInner>{children}</BillsProviderInner>
    </CategoriesProvider>
  );
}

export function useBills() {
  const ctx = useContext(BillsContext);
  if (!ctx) {
    throw new Error('useBills must be used within BillsProvider');
  }
  return ctx;
}
