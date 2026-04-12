import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { registerBillNotificationCategory } from '../services/billReminders';

const PROMPT_KEY = 'billminder_notifications_prompt_done';
const PERMISSION_KEY = 'billminder_notifications_permission';

const NotificationPermissionContext = createContext(null);

async function persistPermissionStatus(status) {
  try {
    await AsyncStorage.setItem(PERMISSION_KEY, status);
  } catch {
    // ignore
  }
}

async function ensureAndroidDefaultChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

export function NotificationPermissionProvider({ children }) {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [ready, setReady] = useState(false);

  const refreshPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermissionStatus('denied');
      await persistPermissionStatus('denied');
      return 'denied';
    }
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
      await persistPermissionStatus(status);
      return status;
    } catch {
      setPermissionStatus('denied');
      await persistPermissionStatus('denied');
      return 'denied';
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (!cancelled) {
            setPermissionStatus('denied');
            setReady(true);
          }
          return;
        }

        await ensureAndroidDefaultChannel();
        await registerBillNotificationCategory();

        const prompted = await AsyncStorage.getItem(PROMPT_KEY);

        if (!prompted) {
          const result = await Notifications.requestPermissionsAsync();
          if (!cancelled) {
            await AsyncStorage.setItem(PROMPT_KEY, 'true');
            await persistPermissionStatus(result.status);
            setPermissionStatus(result.status);
          }
        } else {
          const { status } = await Notifications.getPermissionsAsync();
          if (!cancelled) {
            await persistPermissionStatus(status);
            setPermissionStatus(status);
          }
        }
      } catch {
        if (!cancelled) {
          setPermissionStatus('denied');
          await persistPermissionStatus('denied');
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshPermission();
      }
    });
    return () => sub.remove();
  }, [refreshPermission]);

  const value = useMemo(
    () => ({
      permissionStatus,
      notificationsReady: ready,
      refreshPermission,
    }),
    [permissionStatus, ready, refreshPermission]
  );

  return (
    <NotificationPermissionContext.Provider value={value}>
      {children}
    </NotificationPermissionContext.Provider>
  );
}

export function useNotificationPermission() {
  const ctx = useContext(NotificationPermissionContext);
  if (!ctx) {
    throw new Error(
      'useNotificationPermission must be used within NotificationPermissionProvider'
    );
  }
  return ctx;
}
