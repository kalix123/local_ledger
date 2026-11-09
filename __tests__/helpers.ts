import { DEFAULT_CATEGORIES, defaultData } from '../src/defaults';
import { AppData, Transaction } from '../src/types';
import { toISODate } from '../src/utils';

/** Deterministic pseudo-random numbers so large-data tests are repeatable. */
export function rng(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const MERCHANTS = ['WinCo', 'Starbucks', 'Shell', 'Amazon', 'Target', "Lupe's", 'Netflix', 'CVS', '', ''];
const NOTES = ['', 'ice cream', 'latte', 'gas', 'gift for mom, "big" one', 'line\nbreak', '=SUM(A1)', 'café ☕', ''];

/** `n` transactions spread over the `days` days before `end`. */
export function makeTransactions(n: number, { days = 365 * 3, end = new Date(2026, 10, 9), seed = 42 } = {}): Transaction[] {
  const r = rng(seed);
  const expense = DEFAULT_CATEGORIES.filter((c) => c.kind === 'expense');
  const income = DEFAULT_CATEGORIES.filter((c) => c.kind === 'income');
  const out: Transaction[] = [];
  for (let i = 0; i < n; i++) {
    const isIncome = r() < 0.12;
    const pool = isIncome ? income : expense;
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - Math.floor(r() * days));
    out.push({
      id: `t${i}`,
      type: isIncome ? 'income' : 'expense',
      amount: Math.round((isIncome ? 200 + r() * 2000 : 1 + r() * 150) * 100) / 100,
      categoryId: pool[Math.floor(r() * pool.length)].id,
      merchant: MERCHANTS[Math.floor(r() * MERCHANTS.length)],
      note: NOTES[Math.floor(r() * NOTES.length)],
      date: toISODate(d),
      raw: `entry ${i}`,
      createdAt: 1_700_000_000_000 + i,
      source: 'parser',
    });
  }
  return out;
}

export function makeData(n: number, opts?: Parameters<typeof makeTransactions>[1]): AppData {
  return { ...defaultData(), transactions: makeTransactions(n, opts) };
}
