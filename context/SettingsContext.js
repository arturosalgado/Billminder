import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadDefaultCurrency, saveDefaultCurrency } from '../services/appSettings';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../utils/currencies';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [defaultCurrency, setDefaultCurrencyState] = useState(DEFAULT_CURRENCY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const c = await loadDefaultCurrency();
        if (!cancelled) setDefaultCurrencyState(c);
      } catch {
        if (!cancelled) setDefaultCurrencyState(DEFAULT_CURRENCY);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setDefaultCurrency = useCallback(async (code) => {
    const next = normalizeCurrency(code);
    setDefaultCurrencyState(next);
    try {
      await saveDefaultCurrency(next);
    } catch {
      // ignore persist errors
    }
  }, []);

  const value = useMemo(
    () => ({
      defaultCurrency,
      setDefaultCurrency,
      settingsHydrated: hydrated,
    }),
    [defaultCurrency, setDefaultCurrency, hydrated]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
