import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  registerBillNotificationCategory,
  handleBillNotificationResponse,
  BILL_REMINDER_TYPE,
} from '../services/billReminders';

/**
 * Registers notification categories and handles action taps (including cold start).
 */
export default function NotificationResponseBridge() {
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    let active = true;

    (async () => {
      try {
        await registerBillNotificationCategory();
      } catch {
        // category registration can fail before native is ready
      }
      if (!active) return;
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (
          last?.notification?.request?.content?.data?.type ===
          BILL_REMINDER_TYPE
        ) {
          await handleBillNotificationResponse(last);
        }
      } catch {
        // ignore
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleBillNotificationResponse(response);
      }
    );

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return null;
}
