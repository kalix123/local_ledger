import { AppData, Transaction } from './types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => toISODate(new Date());

export function formatMoney(n: number, currency: string, opts: { sign?: boolean; cents?: boolean } = {}): string {
  // cents: false hides ".00" but still shows real cents ($10.50 stays $10.50, $400 shows as $400)
  if (!Number.isFinite(n)) n = 0;
  const cents = (opts.cents ?? true) || !Number.isInteger(Math.round(Math.abs(n) * 100) / 100);
  const abs = Math.abs(n);
  const body = abs.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : '';
  return `${sign}${currency}${body}`;
}

export function friendlyDate(iso: string): string {
  const t = today();
  if (iso === t) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === toISODate(y)) return 'Yesterday';
  const d = fromISODate(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || isNaN(d.getTime())) return iso || 'Unknown date';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** The current budget cycle [start, end) given a start day of month (1–28). */
export function currentCycle(startDay: number, ref = new Date()): { start: string; end: string; label: string; dayIndex: number; totalDays: number } {
  const day = Number.isFinite(startDay) ? Math.min(Math.max(1, Math.floor(startDay)), 28) : 1;
  let start = new Date(ref.getFullYear(), ref.getMonth(), day);
  if (ref.getDate() < day) start = new Date(ref.getFullYear(), ref.getMonth() - 1, day);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, day);
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  const refMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dayIndex = Math.round((refMidnight.getTime() - start.getTime()) / 86400000) + 1;
  const label =
    day === 1
      ? start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(end.getTime() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return { start: toISODate(start), end: toISODate(end), label, dayIndex, totalDays };
}

export function inRange(tx: Transaction, start: string, end: string) {
  return tx.date >= start && tx.date < end;
}

export interface CycleSummary {
  spent: number;
  income: number;
  byCategory: Record<string, number>;
  txs: Transaction[];
}

export function summarize(data: AppData, start: string, end: string): CycleSummary {
  const txs = data.transactions.filter((t) => inRange(t, start, end));
  const byCategory: Record<string, number> = {};
  let spent = 0;
  let income = 0;
  for (const t of txs) {
    if (t.type === 'expense') {
      spent += t.amount;
      byCategory[t.categoryId] = (byCategory[t.categoryId] ?? 0) + t.amount;
    } else {
      income += t.amount;
    }
  }
  return { spent, income, byCategory, txs };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function toCSV(data: AppData): string {
  const cat = (id: string) => data.categories.find((c) => c.id === id)?.name ?? id;
  // A leading = + - @ (or tab/CR) makes Excel/Sheets run the cell as a formula; prefix ' to keep it plain text.
  const esc = (raw: string) => {
    const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['date', 'type', 'amount', 'category', 'merchant', 'note', 'original_text']];
  for (const t of [...data.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([t.date, t.type, t.amount.toFixed(2), cat(t.categoryId), t.merchant, t.note, t.raw]);
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
