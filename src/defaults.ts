import { AppData, Category, Settings } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', emoji: '🛒', icon: 'groceries', kind: 'expense', keywords: ['grocery', 'groceries', 'milk', 'eggs', 'bread', 'produce', 'ice cream', 'snacks', 'fruit', 'vegetables', 'meat', 'cereal'] },
  { id: 'dining', name: 'Dining Out', emoji: '🍔', icon: 'dining', kind: 'expense', keywords: ['lunch', 'dinner', 'breakfast', 'brunch', 'restaurant', 'coffee', 'latte', 'pizza', 'burger', 'tacos', 'sushi', 'takeout', 'take out', 'drinks', 'beer', 'cafe', 'doordash', 'ubereats', 'uber eats', 'grubhub'] },
  { id: 'transport', name: 'Transport', emoji: '🚗', icon: 'transport', kind: 'expense', keywords: ['gas', 'fuel', 'uber', 'lyft', 'bus', 'train', 'parking', 'toll', 'taxi', 'metro', 'oil change', 'car wash', 'tires'] },
  { id: 'housing', name: 'Housing', emoji: '🏠', icon: 'housing', kind: 'expense', keywords: ['rent', 'mortgage', 'hoa', 'landlord', 'repair', 'furniture'] },
  { id: 'utilities', name: 'Utilities', emoji: '💡', icon: 'utilities', kind: 'expense', keywords: ['electric', 'electricity', 'power bill', 'water bill', 'internet', 'wifi', 'phone bill', 'cell', 'utility', 'utilities', 'trash', 'sewer'] },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', icon: 'shopping', kind: 'expense', keywords: ['clothes', 'shoes', 'shirt', 'jacket', 'electronics', 'gift', 'gifts', 'book', 'books', 'headphones', 'shopping'] },
  { id: 'entertainment', name: 'Fun', emoji: '🎮', icon: 'entertainment', kind: 'expense', keywords: ['movie', 'movies', 'game', 'games', 'concert', 'tickets', 'bowling', 'netflix', 'spotify', 'hulu', 'steam', 'subscription'] },
  { id: 'health', name: 'Health', emoji: '💊', icon: 'health', kind: 'expense', keywords: ['doctor', 'dentist', 'pharmacy', 'medicine', 'prescription', 'gym', 'vitamins', 'copay', 'therapy'] },
  { id: 'other', name: 'Other', emoji: '📦', icon: 'other', kind: 'expense', keywords: [] },
  { id: 'paycheck', name: 'Paycheck', emoji: '💼', icon: 'paycheck', kind: 'income', keywords: ['paid', 'paycheck', 'salary', 'wages', 'work', 'job', 'payroll', 'tips', 'tip'] },
  { id: 'side', name: 'Side Income', emoji: '✨', icon: 'side', kind: 'income', keywords: ['sold', 'freelance', 'gig', 'commission', 'side'] },
  { id: 'other-income', name: 'Other Income', emoji: '💰', icon: 'other-income', kind: 'income', keywords: ['refund', 'gift', 'reimbursed', 'reimbursement', 'cashback', 'cash back', 'interest', 'dividend', 'bonus'] },
];

/** Built-in merchant dictionary: lower-case key → [display name, categoryId]. */
export const KNOWN_MERCHANTS: Record<string, [string, string]> = {
  winco: ['WinCo', 'groceries'],
  walmart: ['Walmart', 'groceries'],
  costco: ['Costco', 'groceries'],
  kroger: ['Kroger', 'groceries'],
  safeway: ['Safeway', 'groceries'],
  'trader joes': ["Trader Joe's", 'groceries'],
  "trader joe's": ["Trader Joe's", 'groceries'],
  aldi: ['Aldi', 'groceries'],
  'whole foods': ['Whole Foods', 'groceries'],
  publix: ['Publix', 'groceries'],
  heb: ['H-E-B', 'groceries'],
  'fred meyer': ['Fred Meyer', 'groceries'],
  target: ['Target', 'shopping'],
  amazon: ['Amazon', 'shopping'],
  'best buy': ['Best Buy', 'shopping'],
  ikea: ['IKEA', 'housing'],
  'home depot': ['Home Depot', 'housing'],
  lowes: ["Lowe's", 'housing'],
  starbucks: ['Starbucks', 'dining'],
  mcdonalds: ["McDonald's", 'dining'],
  "mcdonald's": ["McDonald's", 'dining'],
  chipotle: ['Chipotle', 'dining'],
  'taco bell': ['Taco Bell', 'dining'],
  subway: ['Subway', 'dining'],
  dutch: ['Dutch Bros', 'dining'],
  'dutch bros': ['Dutch Bros', 'dining'],
  wendys: ["Wendy's", 'dining'],
  "wendy's": ["Wendy's", 'dining'],
  doordash: ['DoorDash', 'dining'],
  shell: ['Shell', 'transport'],
  chevron: ['Chevron', 'transport'],
  arco: ['ARCO', 'transport'],
  exxon: ['Exxon', 'transport'],
  uber: ['Uber', 'transport'],
  'uber eats': ['Uber Eats', 'dining'],
  lyft: ['Lyft', 'transport'],
  netflix: ['Netflix', 'entertainment'],
  spotify: ['Spotify', 'entertainment'],
  steam: ['Steam', 'entertainment'],
  cvs: ['CVS', 'health'],
  walgreens: ['Walgreens', 'health'],
};

export const DEFAULT_SETTINGS: Settings = {
  mode: 'basic',
  currency: '$',
  cycleStartDay: 1,
  theme: 'system',
  customTheme: { bg: '#101418', surface: '#1A2026', text: '#ECEFF3', accent: '#14A394' },
  iconPack: 'icons',
  appIcon: 'coin',
  supporterCode: '',
  ai: {
    provider: 'none',
    baseUrl: '',
    model: '',
    apiKey: '',
    cloudRiskAcknowledged: false,
    useForUnclearEntries: true,
  },
};

export function defaultData(): AppData {
  return {
    version: 1,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, keywords: [...c.keywords] })),
    budgets: { groceries: 400, dining: 150, entertainment: 60 },
    rules: [],
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai }, customTheme: { ...DEFAULT_SETTINGS.customTheme } },
  };
}

export const AI_PRESETS: Record<Exclude<import('./types').AIProvider, 'none'>, { baseUrl: string; model: string; cloud: boolean; label: string }> = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2', cloud: false, label: 'Ollama (local)' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', cloud: true, label: 'OpenAI-compatible' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5', cloud: true, label: 'Anthropic' },
};

/** Change this to your own Ko-fi page. */
export const KOFI_URL = 'https://ko-fi.com/cora_tealeaf';
