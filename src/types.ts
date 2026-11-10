export type TxType = 'expense' | 'income';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number; // always positive; sign comes from `type`
  categoryId: string;
  merchant: string;
  note: string;
  date: string; // local YYYY-MM-DD
  raw: string; // original text the user typed
  createdAt: number;
  source: 'parser' | 'manual';
}

export interface Category {
  id: string;
  name: string;
  emoji: string; // shown when the Emoji icon pack is chosen
  icon: string; // semantic IconName (src/icons.tsx)
  kind: TxType;
  keywords: string[]; // lower-case words/phrases that hint at this category
}

/** Advanced mode: user-defined "if text contains X → merchant/category" rules. */
export interface MerchantRule {
  id: string;
  match: string; // lower-case substring to look for
  merchant: string; // display name to use
  categoryId: string;
}

export type ThemeId = 'system' | 'light' | 'dark' | 'midnight' | 'forest' | 'sunset' | 'paper' | 'custom';

/** Supporter-only: four hex colours; the rest of the palette is derived from them. */
export interface CustomTheme {
  bg: string;
  surface: string;
  text: string;
  accent: string;
}
export type IconPackId = 'icons' | 'emoji' | 'line' | 'bold';
export type AppIconId = 'coin' | 'leaf' | 'rocket' | 'gem' | 'cat';

export interface Settings {
  mode: 'basic' | 'advanced';
  currency: string;
  cycleStartDay: number; // 1-28, day of month the budget cycle resets
  theme: ThemeId;
  customTheme: CustomTheme;
  iconPack: IconPackId;
  appIcon: AppIconId;
  supporterCode: string; // validated offline; empty = not a supporter
  autoFocusEntry: boolean; // focus the quick-entry box (open the keyboard) when Home opens
}

export interface AppData {
  version: 1;
  transactions: Transaction[];
  categories: Category[];
  budgets: Record<string, number>; // categoryId -> monthly cap
  rules: MerchantRule[];
  settings: Settings;
}

export interface ParsedEntry {
  type: TxType;
  amount: number | null;
  merchant: string;
  categoryId: string;
  note: string;
  date: string;
  confident: boolean; // false => amount missing or category fell back to "Other"
}
