import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  loadCustomCategories,
  saveCustomCategories,
} from '../services/customCategoriesPersistence';
import {
  BILL_CATEGORIES,
  CUSTOM_CATEGORY_COLOR_PALETTE,
  mergeCategoryLists,
} from '../utils/billCategories';

const CategoriesContext = createContext(null);

function allLabelsLower(customCategories) {
  const set = new Set(BILL_CATEGORIES.map((c) => c.label.toLowerCase()));
  for (const c of customCategories) {
    set.add(c.label.toLowerCase());
  }
  return set;
}

export function CategoriesProvider({ children }) {
  const [customCategories, setCustomCategories] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadCustomCategories();
        if (!cancelled) setCustomCategories(loaded);
      } catch {
        if (!cancelled) setCustomCategories([]);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next) => {
    try {
      await saveCustomCategories(next);
    } catch {
      // ignore
    }
  }, []);

  const mergedCategories = useMemo(
    () => mergeCategoryLists(customCategories),
    [customCategories]
  );

  const addCustomCategory = useCallback(
    (label) => {
      const t = String(label).trim();
      if (!t) return { ok: false, error: 'empty' };
      const lower = t.toLowerCase();
      const labels = allLabelsLower(customCategories);
      if (labels.has(lower)) return { ok: false, error: 'duplicate' };
      const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const color =
        CUSTOM_CATEGORY_COLOR_PALETTE[
          customCategories.length % CUSTOM_CATEGORY_COLOR_PALETTE.length
        ];
      const next = [...customCategories, { id, label: t, color }];
      setCustomCategories(next);
      void persist(next);
      return { ok: true };
    },
    [customCategories, persist]
  );

  const updateCustomCategory = useCallback(
    (id, label) => {
      const t = String(label).trim();
      if (!t) return { ok: false, error: 'empty' };
      const lower = t.toLowerCase();
      const idx = customCategories.findIndex((c) => c.id === id);
      if (idx < 0) return { ok: false, error: 'notfound' };
      const labels = allLabelsLower(
        customCategories.filter((c) => c.id !== id)
      );
      if (labels.has(lower)) return { ok: false, error: 'duplicate' };
      const next = customCategories.map((c) =>
        c.id === id ? { ...c, label: t } : c
      );
      setCustomCategories(next);
      void persist(next);
      return { ok: true };
    },
    [customCategories, persist]
  );

  const removeCustomCategory = useCallback(
    (id) => {
      const next = customCategories.filter((c) => c.id !== id);
      setCustomCategories(next);
      void persist(next);
    },
    [customCategories, persist]
  );

  const value = useMemo(
    () => ({
      customCategories,
      mergedCategories,
      categoriesHydrated: hydrated,
      addCustomCategory,
      updateCustomCategory,
      removeCustomCategory,
    }),
    [
      customCategories,
      mergedCategories,
      hydrated,
      addCustomCategory,
      updateCustomCategory,
      removeCustomCategory,
    ]
  );

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) {
    throw new Error('useCategories must be used within CategoriesProvider');
  }
  return ctx;
}
