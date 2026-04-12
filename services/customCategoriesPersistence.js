import AsyncStorage from '@react-native-async-storage/async-storage';

export const CUSTOM_CATEGORIES_STORAGE_KEY = 'billminder_custom_categories';

/** @returns {Promise<Array<{ id: string, label: string, color: string }>>} */
export async function loadCustomCategories() {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out = [];
    for (const row of parsed) {
      if (!row || typeof row.id !== 'string' || typeof row.label !== 'string') {
        continue;
      }
      const label = row.label.trim();
      if (!label) continue;
      const color =
        typeof row.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(row.color)
          ? row.color
          : '#8A8FA8';
      out.push({ id: row.id, label, color });
    }
    return out;
  } catch {
    return [];
  }
}

export async function saveCustomCategories(list) {
  await AsyncStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(list));
}
