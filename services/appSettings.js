import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CURRENCY, normalizeCurrency } from '../utils/currencies';

const STORAGE_KEY = 'billminder_default_currency';

export async function loadDefaultCurrency() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_CURRENCY;
    return normalizeCurrency(raw);
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export async function saveDefaultCurrency(code) {
  await AsyncStorage.setItem(STORAGE_KEY, normalizeCurrency(code));
}
