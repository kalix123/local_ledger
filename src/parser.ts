/**
 * Deterministic, offline natural-language transaction parser.
 * No network, no model — just ordered rules, so results are instant and predictable.
 *
 *   "spent 10.50 at WinCo on ice cream"            → expense 10.50 · WinCo · Groceries · "ice cream"
 *   "just got paid for work 135 plus 20 in tips"    → income 155 · Work · Paycheck · "tips"
 */
import { KNOWN_MERCHANTS } from './defaults';
import { Category, MerchantRule, ParsedEntry, TxType } from './types';
import { round2, toISODate } from './utils';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_RE = '(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|rsday|urday)?';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (phrase: string) => new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}(?=$|[^a-z0-9])`, 'i');

/* ---------------------------------------------------------------- dates */

function extractDate(text: string, now: Date): { date: string; rest: string } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const strip = (re: RegExp) => text.replace(re, ' ');
  let m: RegExpMatchArray | null;

  if ((m = text.match(/\b(?:on\s+)?yesterday\b/i))) {
    d.setDate(d.getDate() - 1);
    return { date: toISODate(d), rest: strip(/\b(?:on\s+)?yesterday\b/i) };
  }
  if ((m = text.match(/\b(\d{1,2})\s+days?\s+ago\b/i))) {
    d.setDate(d.getDate() - Number(m[1]));
    return { date: toISODate(d), rest: strip(/\b\d{1,2}\s+days?\s+ago\b/i) };
  }
  const wdRe = new RegExp(`\\b(last|on|this past)\\s+${WEEKDAY_RE}\\b`, 'i');
  if ((m = text.match(wdRe))) {
    const target = WEEKDAYS.findIndex((w) => w.startsWith(m![2].toLowerCase().slice(0, 3)));
    let diff = (d.getDay() - target + 7) % 7;
    if (diff === 0 && m[1].toLowerCase() === 'last') diff = 7;
    d.setDate(d.getDate() - diff);
    return { date: toISODate(d), rest: strip(wdRe) };
  }
  // 3/14 or 3/14/26 or 3/14/2026 (US month/day)
  if ((m = text.match(/\b(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const month = Number(m[1]) - 1;
    const day = Number(m[2]);
    let year = m[3] ? Number(m[3]) : d.getFullYear();
    if (year < 100) year += 2000;
    const parsed = new Date(year, month, day);
    if (!m[3] && parsed > d) parsed.setFullYear(year - 1); // "12/30" typed in January means last year
    if (parsed.getMonth() === month) {
      return { date: toISODate(parsed), rest: strip(/\b(?:on\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/) };
    }
  }
  return { date: toISODate(d), rest: text.replace(/\b(?:just\s+now|today|tonight|this morning|this afternoon|this evening)\b/i, ' ') };
}

/* -------------------------------------------------------------- amounts */

interface AmountToken {
  start: number;
  end: number;
  value: number;
  dollar: boolean;
  sign: '' | '+' | '-';
}

const AMOUNT_RE =
  /(^|[^\w.$])([+-])?(\$)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d*\.\d{1,2}|\d+(?:\.\d{1,2})?)(k)?(?![\w/]|\.\d)(?:\s?(?:bucks|dollars?|usd))?/gi;

function findAmounts(text: string): AmountToken[] {
  const out: AmountToken[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const lead = m[1].length;
    const start = (m.index ?? 0) + lead;
    let value = parseFloat(m[4].replace(/,/g, ''));
    if (m[5]) value *= 1000;
    if (!isFinite(value)) continue;
    out.push({ start, end: (m.index ?? 0) + m[0].length, value, dollar: !!m[3], sign: (m[2] as '+' | '-') ?? '' });
  }
  return out;
}

const JOINER = /^\s*(?:\+|plus|and|&|,)\s*(?:another|an extra|extra)?\s*$/i;

function extractAmount(text: string): { amount: number | null; sign: '' | '+' | '-'; rest: string } {
  const tokens = findAmounts(text);
  if (!tokens.length) return { amount: null, sign: '', rest: text };
  let i = tokens.findIndex((t) => t.dollar);
  if (i < 0) i = 0;
  let total = tokens[i].value;
  let last = i;
  while (last + 1 < tokens.length && JOINER.test(text.slice(tokens[last].end, tokens[last + 1].start))) {
    last++;
    total += tokens[last].value;
  }
  const rest = text.slice(0, tokens[i].start) + ' ' + text.slice(tokens[last].end);
  return { amount: round2(total), sign: tokens[i].sign, rest };
}

/* ----------------------------------------------------------------- type */

const STRONG_INCOME = /\b(got paid|get paid|getting paid|been paid|was paid|paid me|payday|paycheck|salary|wages|earned|received|income|deposit(?:ed)?|refund(?:ed)?|reimburs\w*|sold|bonus|cash ?back|dividend|interest earned)\b/i;
const WEAK_INCOME = /\b(tips\b|made|gift from|from mom|from dad|venmo from|got \$?\d)/i;
const EXPENSE_VERB = /\b(spent|spend|bought|buy|purchased?|paid(?! me)|pay|cost|owed|bill|charged|ordered)\b/i;

function detectType(lower: string, sign: string): TxType {
  if (sign === '+') return 'income';
  if (sign === '-') return 'expense';
  if (STRONG_INCOME.test(lower)) return 'income';
  if (WEAK_INCOME.test(lower) && !EXPENSE_VERB.test(lower)) return 'income';
  return 'expense';
}

/* ------------------------------------------------------------- merchant */

function titleCase(s: string) {
  if (/[A-Z]/.test(s)) return s; // respect the user's own capitalization ("WinCo")
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

const MERCHANT_STOP = '(?:on|for|with|today|yesterday|and|in|to|last|this|because|via|using|\\d)';

function extractMerchantPhrase(text: string, type: TxType): { merchant: string; rest: string } {
  const preps = type === 'income' ? '(?:from|for|at|by)' : '(?:at|@|from)';
  const re = new RegExp(`(?:^|\\s)${preps}\\s+(?!the\\s+(?:store|mall)\\b)([A-Za-z0-9'&.\\-]+(?:\\s+(?!${MERCHANT_STOP}\\b)[A-Za-z0-9'&.\\-]+){0,3})`, 'i');
  const m = text.match(re);
  if (!m) return { merchant: '', rest: text };
  const name = m[1].replace(/[.\-]+$/, '').trim();
  if (!name || /^\d/.test(name)) return { merchant: '', rest: text };
  return { merchant: titleCase(name), rest: text.replace(m[0], ' ') };
}

/* ---------------------------------------------------------------- notes */

const FILLER = new Set(
  'i i\'ve ive just got get paid pay spent spend bought buy purchased had have has was were a an the some me my on for at in with of to from bucks dollars dollar usd and plus also today worth like about around ~ - , . ! :'.split(' '),
);

function cleanNote(text: string): string {
  const words = text.replace(/[,;!]+/g, ' ').split(/\s+/).filter(Boolean);
  while (words.length && FILLER.has(words[0].toLowerCase())) words.shift();
  while (words.length && FILLER.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.join(' ').replace(/\s+([.,])/g, '$1').slice(0, 80);
}

/* --------------------------------------------------------------- public */

export function parseEntry(
  input: string,
  categories: Category[],
  rules: MerchantRule[],
  now: Date = new Date(),
): ParsedEntry {
  const original = input.trim().replace(/\s+/g, ' ');
  const lowerOriginal = original.toLowerCase();

  // 1) date
  let { date, rest } = extractDate(original, now);

  // 2) user rules first, then built-in merchant dictionary (longest match wins)
  let merchant = '';
  let merchantCategory = '';
  const rule = [...rules]
    .filter((r) => r.match.trim() && wordRe(r.match.trim().toLowerCase()).test(rest))
    .sort((a, b) => b.match.length - a.match.length)[0];
  if (rule) {
    merchant = rule.merchant || titleCase(rule.match);
    merchantCategory = rule.categoryId;
    rest = rest.replace(new RegExp(`(?:\\b(?:at|@|from)\\s+)?${escapeRe(rule.match.trim())}`, 'i'), ' ');
  } else {
    const key = Object.keys(KNOWN_MERCHANTS)
      .filter((k) => wordRe(k).test(rest))
      .sort((a, b) => b.length - a.length)[0];
    if (key) {
      [merchant, merchantCategory] = KNOWN_MERCHANTS[key];
      rest = rest.replace(new RegExp(`(?:\\b(?:at|@|from)\\s+)?${escapeRe(key)}`, 'i'), ' ');
    }
  }

  // 3) amount (sums "135 plus 20", "$12 + $3")
  const amt = extractAmount(rest);
  rest = amt.rest;

  // 4) income vs expense
  const type = detectType(lowerOriginal, amt.sign);

  // 5) merchant from "at X" / "from X" if the dictionary didn't find one
  if (!merchant) {
    const mp = extractMerchantPhrase(rest, type);
    merchant = mp.merchant;
    rest = mp.rest;
  }

  // 6) category: rule/dictionary → keyword match (longest wins) → fallback
  const pool = categories.filter((c) => c.kind === type);
  let categoryId = '';
  if (merchantCategory && pool.some((c) => c.id === merchantCategory)) categoryId = merchantCategory;
  if (!categoryId) {
    let best = { id: '', len: 0 };
    for (const c of pool) {
      for (const kw of [...c.keywords, c.name.toLowerCase()]) {
        if (kw && kw.length > best.len && wordRe(kw).test(lowerOriginal)) best = { id: c.id, len: kw.length };
      }
    }
    categoryId = best.id;
  }
  let confident = true;
  if (!categoryId) {
    const fallback = type === 'income' ? 'other-income' : 'other';
    categoryId = pool.find((c) => c.id === fallback)?.id ?? pool[0]?.id ?? fallback;
    if (type === 'expense') confident = false;
  }
  if (amt.amount === null) confident = false;

  // 7) whatever is left becomes the note
  const note = cleanNote(rest);

  return { type, amount: amt.amount, merchant, categoryId, note, date, confident };
}
