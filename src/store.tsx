import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { defaultData } from './defaults';
import { sanitize } from './sanitize';
import { loadRaw, save } from './storage';
import { isValidSupporterCode } from './supporter';
import { Palette, resolvePalette } from './theme';
import { AppData, Category, MerchantRule, Settings, Transaction } from './types';
import { uid } from './utils';

type Updater = (d: AppData) => AppData;

interface Store {
  data: AppData;
  ready: boolean;
  /** Set when saved data couldn't be read. Saving is paused so the data on disk is never overwritten. */
  loadError: string | null;
  palette: Palette;
  isSupporter: boolean;
  advanced: boolean;
  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => Transaction | undefined;
  restoreTransaction: (t: Transaction) => void;
  setBudget: (categoryId: string, amount: number | null) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addRule: (r: Omit<MerchantRule, 'id'>) => void;
  deleteRule: (id: string) => void;
  addCategory: (c: Omit<Category, 'id'>) => void;
  deleteCategory: (id: string) => void;
  replaceAll: (d: AppData) => void;
  wipe: () => void;
}

const Ctx = createContext<Store | null>(null);

export { sanitize } from './sanitize';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scheme = useColorScheme();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  /** Run the pending debounced save now. Saves are chained so two writes never interleave. */
  function flushSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const snapshot = dataRef.current;
    saving.current = saving.current.then(() => save(snapshot)).catch((e) => console.warn('Save failed', e));
  }

  useEffect(() => {
    let alive = true;
    loadRaw()
      .then((raw) => {
        if (alive && raw) setData(sanitize(raw.data));
      })
      .catch((e) => {
        console.warn('Could not load saved data', e);
        if (alive) setLoadError(e?.message || 'Saved data could not be read.');
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || loadError) return; // never overwrite data we failed to read
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 250);
  }, [data, ready, loadError]);

  // Write a pending save right away when the app is backgrounded (Android may kill it
  // without warning after that) or the store unmounts, instead of dropping the last edit.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && saveTimer.current) flushSave();
    });
    return () => {
      sub.remove();
      if (saveTimer.current) flushSave();
    };
  }, []);

  const update = useCallback((fn: Updater) => setData((d) => fn(d)), []);

  const isSupporter = isValidSupporterCode(data.settings.supporterCode);
  const palette = useMemo(
    () => resolvePalette(data.settings.theme, scheme === 'dark', isSupporter, data.settings.customTheme),
    [data.settings.theme, data.settings.customTheme, scheme, isSupporter],
  );

  const actions = useMemo(
    () => ({
      addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => {
        const tx: Transaction = { ...t, id: uid(), createdAt: Date.now() };
        update((d) => ({ ...d, transactions: [tx, ...d.transactions] }));
        return tx;
      },
      updateTransaction: (id: string, patch: Partial<Transaction>) =>
        update((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTransaction: (id: string) => {
        const removed = dataRef.current.transactions.find((t) => t.id === id);
        update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
        return removed;
      },
      restoreTransaction: (t: Transaction) => update((d) => ({ ...d, transactions: [t, ...d.transactions] })),
      setBudget: (categoryId: string, amount: number | null) =>
        update((d) => {
          const budgets = { ...d.budgets };
          if (amount === null || !Number.isFinite(amount) || amount <= 0) delete budgets[categoryId];
          else budgets[categoryId] = Math.round(amount * 100) / 100;
          return { ...d, budgets };
        }),
      updateSettings: (patch: Partial<Settings>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      addRule: (r: Omit<MerchantRule, 'id'>) =>
        update((d) => {
          const match = r.match.trim().toLowerCase();
          if (!match) return d;
          return { ...d, rules: [...d.rules.filter((x) => x.match.toLowerCase() !== match), { ...r, match, id: uid() }] };
        }),
      deleteRule: (id: string) => update((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) })),
      addCategory: (c: Omit<Category, 'id'>) =>
        update((d) => ({ ...d, categories: [...d.categories, { ...c, id: `c-${uid()}` }] })),
      deleteCategory: (id: string) =>
        update((d) => {
          const cat = d.categories.find((c) => c.id === id);
          if (!cat) return d;
          const fallback = cat.kind === 'income' ? 'other-income' : 'other';
          const budgets = { ...d.budgets };
          delete budgets[id];
          return {
            ...d,
            budgets,
            categories: d.categories.filter((c) => c.id !== id),
            transactions: d.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback } : t)),
            rules: d.rules.map((r) => (r.categoryId === id ? { ...r, categoryId: fallback } : r)),
          };
        }),
      // Importing a backup or resetting is an explicit choice to replace what's stored, so saving resumes.
      replaceAll: (d: AppData) => {
        setLoadError(null);
        setData(d);
      },
      wipe: () => {
        setLoadError(null);
        setData(defaultData());
      },
    }),
    [update],
  );

  const value: Store = { data, ready, loadError, palette, isSupporter, advanced: data.settings.mode === 'advanced', ...actions };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function useCategory() {
  const { data } = useStore();
  return useCallback(
    (id: string): Category => data.categories.find((c) => c.id === id) ?? { id, name: 'Unknown', emoji: '❔', icon: 'tag', kind: 'expense', keywords: [] },
    [data.categories],
  );
}
