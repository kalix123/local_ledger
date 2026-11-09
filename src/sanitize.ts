/**
 * Validate and repair anything loaded from disk or a backup file. Backups can be hand-edited,
 * truncated, from an older/newer version, or not Local Ledger files at all, so nothing is trusted:
 * every field is type-checked and anything unusable is dropped or reset to a default.
 */
import { DEFAULT_CATEGORIES, defaultData, DEFAULT_SETTINGS } from './defaults';
import { ICON_PACKS, isIconName } from './icons';
import { APP_ICONS, HEX_RE, THEMES } from './theme';
import { AIProvider, AppData, AppIconId, Category, IconPackId, MerchantRule, Settings, ThemeId, Transaction } from './types';
import { uid } from './utils';

/** Largest single amount accepted (guards against typos like 1e300 breaking totals). */
export const MAX_AMOUNT = 1_000_000_000;

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' ? String(v) : fallback);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const d = s.slice(0, 10);
  if (!ISO_DATE.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day ? d : null;
}

function sanitizeCategories(raw: unknown): Category[] {
  const list = Array.isArray(raw) && raw.length ? raw : defaultData().categories;
  const seen = new Set<string>();
  const out: Category[] = [];
  for (const c of list) {
    if (!isObj(c)) continue;
    const id = str(c.id, 60).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const def = DEFAULT_CATEGORIES.find((d) => d.id === id);
    out.push({
      id,
      name: str(c.name, 40).trim() || def?.name || 'Unnamed',
      kind: c.kind === 'income' ? 'income' : c.kind === 'expense' ? 'expense' : (def?.kind ?? 'expense'),
      icon: isIconName(c.icon) ? c.icon : (def?.icon ?? 'tag'),
      emoji: typeof c.emoji === 'string' && c.emoji ? c.emoji.slice(0, 8) : (def?.emoji ?? '🏷️'),
      keywords: Array.isArray(c.keywords)
        ? c.keywords.filter((k: unknown): k is string => typeof k === 'string' && !!k.trim()).map((k: string) => k.toLowerCase().slice(0, 40)).slice(0, 100)
        : [],
    });
  }
  // Deleting a category moves its entries to these, so they must always exist.
  for (const id of ['other', 'other-income']) {
    if (!seen.has(id)) out.push({ ...DEFAULT_CATEGORIES.find((d) => d.id === id)!, keywords: [] });
  }
  return out;
}

function sanitizeTransactions(raw: unknown[], categories: Category[]): Transaction[] {
  const catKind = new Map(categories.map((c) => [c.id, c.kind]));
  const seen = new Set<string>();
  const out: Transaction[] = [];
  for (const t of raw) {
    if (!isObj(t)) continue;
    const amount = typeof t.amount === 'number' ? t.amount : typeof t.amount === 'string' ? parseFloat(t.amount) : NaN;
    const date = validDate(t.date);
    if (!Number.isFinite(amount) || Math.abs(amount) > MAX_AMOUNT || !date) continue;
    let id = str(t.id, 60);
    if (!id || seen.has(id)) id = uid() + out.length.toString(36);
    seen.add(id);
    const type = t.type === 'income' ? 'income' : 'expense';
    let categoryId = str(t.categoryId, 60);
    // Unknown or wrong-kind category → the matching "Other" bucket, so nothing becomes invisible in budgets.
    if (catKind.get(categoryId) !== type) categoryId = type === 'income' ? 'other-income' : 'other';
    out.push({
      id,
      type,
      amount: Math.round(Math.abs(amount) * 100) / 100,
      categoryId,
      merchant: str(t.merchant, 60),
      note: str(t.note, 200),
      date,
      raw: str(t.raw, 500),
      createdAt: Number.isFinite(Number(t.createdAt)) ? Number(t.createdAt) : Date.now(),
      source: t.source === 'ai' || t.source === 'manual' ? t.source : 'parser',
    });
  }
  return out;
}

function sanitizeBudgets(raw: unknown, categories: Category[], fallback: Record<string, number>): Record<string, number> {
  if (!isObj(raw)) return { ...fallback };
  const out: Record<string, number> = {};
  for (const c of categories) {
    if (c.kind !== 'expense' || !Object.prototype.hasOwnProperty.call(raw, c.id)) continue;
    const v = Number(raw[c.id]);
    if (Number.isFinite(v) && v > 0 && v <= MAX_AMOUNT) out[c.id] = Math.round(v * 100) / 100;
  }
  return out;
}

function sanitizeRules(raw: unknown, categories: Category[]): MerchantRule[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(categories.map((c) => c.id));
  const seen = new Set<string>();
  const out: MerchantRule[] = [];
  for (const r of raw) {
    if (!isObj(r)) continue;
    const match = str(r.match, 60).trim().toLowerCase();
    if (!match || seen.has(match)) continue;
    seen.add(match);
    out.push({ id: str(r.id, 60) || uid(), match, merchant: str(r.merchant, 60), categoryId: ids.has(r.categoryId) ? r.categoryId : 'other' });
  }
  return out;
}

const THEME_IDS: ThemeId[] = ['system', 'custom', ...(Object.keys(THEMES) as ThemeId[])];
const PROVIDERS: AIProvider[] = ['none', 'ollama', 'openai', 'anthropic'];

function sanitizeSettings(raw: unknown): Settings {
  const s = isObj(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const ai = isObj(s.ai) ? s.ai : {};
  const ct = isObj(s.customTheme) ? s.customTheme : {};
  const hex = (v: unknown, f: string) => (typeof v === 'string' && HEX_RE.test(v) ? v : f);
  const day = Number(s.cycleStartDay);
  return {
    mode: s.mode === 'advanced' ? 'advanced' : 'basic',
    currency: typeof s.currency === 'string' ? s.currency.slice(0, 4) : d.currency,
    cycleStartDay: Number.isFinite(day) ? Math.min(28, Math.max(1, Math.floor(day))) : d.cycleStartDay,
    theme: THEME_IDS.includes(s.theme) ? s.theme : d.theme,
    customTheme: { bg: hex(ct.bg, d.customTheme.bg), surface: hex(ct.surface, d.customTheme.surface), text: hex(ct.text, d.customTheme.text), accent: hex(ct.accent, d.customTheme.accent) },
    iconPack: typeof s.iconPack === 'string' && Object.prototype.hasOwnProperty.call(ICON_PACKS, s.iconPack) ? (s.iconPack as IconPackId) : d.iconPack,
    appIcon: typeof s.appIcon === 'string' && Object.prototype.hasOwnProperty.call(APP_ICONS, s.appIcon) ? (s.appIcon as AppIconId) : d.appIcon,
    supporterCode: str(s.supporterCode, 40),
    ai: {
      provider: PROVIDERS.includes(ai.provider) ? ai.provider : d.ai.provider,
      baseUrl: str(ai.baseUrl, 300),
      model: str(ai.model, 120),
      apiKey: str(ai.apiKey, 500),
      cloudRiskAcknowledged: ai.cloudRiskAcknowledged === true,
      useForUnclearEntries: typeof ai.useForUnclearEntries === 'boolean' ? ai.useForUnclearEntries : d.ai.useForUnclearEntries,
    },
  };
}

export function sanitize(raw: unknown): AppData {
  if (!isObj(raw)) throw new Error('Not a Local Ledger backup.');
  if (!Array.isArray(raw.transactions)) throw new Error('Backup is missing a transactions list.');
  const categories = sanitizeCategories(raw.categories);
  return {
    version: 1,
    categories,
    transactions: sanitizeTransactions(raw.transactions, categories),
    budgets: sanitizeBudgets(raw.budgets, categories, defaultData().budgets),
    rules: sanitizeRules(raw.rules, categories),
    settings: sanitizeSettings(raw.settings),
  };
}
