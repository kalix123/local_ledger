import { DEFAULT_CATEGORIES } from '../src/defaults';
import { parseEntry } from '../src/parser';
import { Category, MerchantRule, ParsedEntry } from '../src/types';

const NOW = new Date(2026, 10, 9); // Mon Nov 9 2026
const parse = (s: string, rules: MerchantRule[] = [], cats: Category[] = DEFAULT_CATEGORIES, now = NOW) => parseEntry(s, cats, rules, now);

describe('everyday entries', () => {
  const cases: [string, Partial<ParsedEntry>][] = [
    ['spent 10.50 at WinCo on ice cream', { type: 'expense', amount: 10.5, merchant: 'WinCo', categoryId: 'groceries', note: 'ice cream' }],
    ['just got paid for work 135 plus 20 in tips', { type: 'income', amount: 155, merchant: 'Work', categoryId: 'paycheck', note: 'tips' }],
    ['$4.75 starbucks latte', { type: 'expense', amount: 4.75, merchant: 'Starbucks', categoryId: 'dining', note: 'latte' }],
    ['gas 42 at shell yesterday', { amount: 42, merchant: 'Shell', categoryId: 'transport', date: '2026-11-08' }],
    ['rent 1,250', { amount: 1250, categoryId: 'housing' }],
    ['paid 80 for the electric bill', { type: 'expense', amount: 80, categoryId: 'utilities' }],
    ['lunch with sam 18', { amount: 18, categoryId: 'dining' }],
    ["spent 12 on 2 tacos at Lupe's", { amount: 12, merchant: "Lupe's", categoryId: 'dining' }],
    ['refund from amazon 25.99', { type: 'income', amount: 25.99, merchant: 'Amazon', categoryId: 'other-income' }],
    ['+50 from mom', { type: 'income', amount: 50, merchant: 'Mom' }],
    ['sold my old bike for 120', { type: 'income', amount: 120, categoryId: 'side' }],
    ['movie tickets 24 last friday', { amount: 24, categoryId: 'entertainment', date: '2026-11-06' }],
    ['bought a thing at the store', { amount: null, confident: false }],
    ['random 30', { amount: 30, categoryId: 'other', confident: false }],
    ['uber eats 32', { merchant: 'Uber Eats', categoryId: 'dining' }],
    ['groceries 64.20 on 11/2', { amount: 64.2, categoryId: 'groceries', date: '2026-11-02' }],
    ['15 tip at dinner', { type: 'expense', amount: 15, categoryId: 'dining' }],
  ];
  test.each(cases)('%s', (input, expected) => {
    expect(parse(input)).toMatchObject(expected);
  });
});

describe('amounts', () => {
  test.each([
    ['coffee 4', 4],
    ['coffee $4', 4],
    ['coffee .99', 0.99],
    ['coffee 0.5', 0.5],
    ['coffee 3.333', null], // three decimals is not money
    ['tv 1,299.99', 1299.99],
    ['car 12,000', 12000],
    ['laptop 1.5k', 1500],
    ['rent 2k', 2000],
    ['snacks 5 bucks', 5],
    ['snacks 5 dollars', 5],
    ['groceries $12 + $3', 15],
    ['groceries 12 and 3', 15],
    ['0.1 plus 0.2 candy', 0.3], // no floating-point 0.30000000000000004
    ['paid 0 for a free sample', 0],
  ])('%s → %p', (input, amount) => {
    expect(parse(input).amount).toBe(amount);
  });

  test('prefers the $ amount over other numbers', () => {
    expect(parse('bought 3 shirts for $45').amount).toBe(45);
  });

  test('a date is not read as an amount', () => {
    const r = parse('groceries 30 on 11/2');
    expect(r.amount).toBe(30);
    expect(r.date).toBe('2026-11-02');
  });

  test('explicit sign wins over wording', () => {
    expect(parse('-20 refund').type).toBe('expense');
    expect(parse('+20 groceries').type).toBe('income');
  });
});

describe('dates', () => {
  test.each([
    ['coffee 4 today', '2026-11-09'],
    ['coffee 4', '2026-11-09'],
    ['coffee 4 yesterday', '2026-11-08'],
    ['coffee 4 3 days ago', '2026-11-06'],
    ['coffee 4 1 day ago', '2026-11-08'],
    ['coffee 4 last monday', '2026-11-02'], // today is Monday, so "last monday" is a week ago
    ['coffee 4 on monday', '2026-11-09'],
    ['coffee 4 on sat', '2026-11-07'],
    ['coffee 4 this past wednesday', '2026-11-04'],
    ['coffee 4 on 11/1', '2026-11-01'],
    ['coffee 4 on 3/14/25', '2025-03-14'],
    ['coffee 4 on 3/14/2024', '2024-03-14'],
    ['coffee 4 on 12/30', '2025-12-30'], // future date without a year → last year
  ])('%s → %s', (input, date) => {
    expect(parse(input).date).toBe(date);
  });

  test('invalid calendar date is ignored rather than rolled over', () => {
    // 2/30 is not a real date; it must not become March 2.
    expect(parse('coffee 4 on 2/30').date).not.toBe('2026-03-02');
  });

  test('yesterday across a month boundary', () => {
    expect(parse('coffee 4 yesterday', [], DEFAULT_CATEGORIES, new Date(2026, 2, 1)).date).toBe('2026-02-28');
  });

  test('yesterday across a year boundary', () => {
    expect(parse('coffee 4 yesterday', [], DEFAULT_CATEGORIES, new Date(2026, 0, 1)).date).toBe('2025-12-31');
  });

  test('leap day', () => {
    expect(parse('coffee 4 on 2/29/2028').date).toBe('2028-02-29');
  });
});

describe('income vs expense', () => {
  test.each([
    ['paycheck 1200', 'income'],
    ['got paid 300', 'income'],
    ['salary 4000', 'income'],
    ['cashback 12', 'income'],
    ['venmo from alex 20', 'income'],
    ['tips 40', 'income'],
    ['paid alex 20', 'expense'],
    ['bought tips book 20', 'expense'],
    ['coffee 4', 'expense'],
  ])('%s → %s', (input, type) => {
    expect(parse(input).type).toBe(type);
  });

  test('income always lands in an income category', () => {
    const r = parse('got paid 100 for groceries run');
    expect(r.type).toBe('income');
    expect(DEFAULT_CATEGORIES.find((c) => c.id === r.categoryId)?.kind).toBe('income');
  });
});

describe('merchant rules', () => {
  const rule = (match: string, categoryId: string, merchant = ''): MerchantRule => ({ id: match, match, merchant, categoryId });

  test('a user rule beats the built-in dictionary', () => {
    expect(parse('walmart 20 for tires', [rule('walmart', 'transport', 'Walmart')]).categoryId).toBe('transport');
  });

  test('the longest matching rule wins', () => {
    const r = parse('joe coffee 5', [rule('joe', 'shopping', 'Joe'), rule('joe coffee', 'dining', 'Joe Coffee')]);
    expect(r).toMatchObject({ merchant: 'Joe Coffee', categoryId: 'dining' });
  });

  test('rules match whole words only', () => {
    expect(parse('shellfish dinner 30', [rule('shell', 'transport')]).categoryId).toBe('dining');
  });

  test('a rule with regex characters does not crash', () => {
    expect(() => parse('a+b (co) 10', [rule('a+b (co)', 'shopping')])).not.toThrow();
    expect(parse('a+b (co) 10', [rule('a+b (co)', 'shopping')]).categoryId).toBe('shopping');
  });

  test('blank rules are ignored', () => {
    expect(parse('coffee 4', [rule('   ', 'shopping')]).categoryId).toBe('dining');
  });

  test('a rule pointing at a category of the wrong kind falls back sensibly', () => {
    const r = parse('got paid by acme 500', [rule('acme', 'groceries', 'Acme')]);
    expect(r.type).toBe('income');
    expect(DEFAULT_CATEGORIES.find((c) => c.id === r.categoryId)?.kind).toBe('income');
  });
});

describe('hostile and unusual input', () => {
  test.each([
    '',
    '   ',
    '$',
    '+',
    '...',
    '$$$ 5',
    '🍕 pizza 12 🍕',
    'café crème 4',
    '日本 ラーメン 900',
    'at at at at',
    'from',
    '<script>alert(1)</script> 5',
    "'; DROP TABLE transactions; -- 5",
    '\n\t coffee \n 4 \t',
    'a'.repeat(5000),
    '1'.repeat(400),
    '9'.repeat(30) + ' dollars',
    'spent ' + '1 plus '.repeat(200) + '1',
  ])('does not throw: %p', (input) => {
    const r = parse(input);
    expect(['income', 'expense']).toContain(r.type);
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.note.length).toBeLessThanOrEqual(80);
    if (r.amount !== null) expect(Number.isFinite(r.amount)).toBe(true);
  });

  test('a long input is parsed quickly (no regex blow-up)', () => {
    const inputs = ['a '.repeat(3000) + '5', 'at ' + 'x '.repeat(3000), '1,'.repeat(3000) + '5', 'on 1/'.repeat(1000)];
    for (const s of inputs) {
      const t0 = Date.now();
      parse(s);
      expect(Date.now() - t0).toBeLessThan(500);
    }
  });

  test('works with no categories at all', () => {
    expect(() => parse('coffee 4', [], [])).not.toThrow();
  });

  test('works when the fallback categories were removed', () => {
    const cats = DEFAULT_CATEGORIES.filter((c) => c.id !== 'other' && c.id !== 'other-income');
    const r = parse('random thing 30', [], cats);
    expect(r.categoryId).toBeTruthy();
  });

  test('is deterministic', () => {
    const a = parse('spent 10.50 at WinCo on ice cream');
    for (let i = 0; i < 20; i++) expect(parse('spent 10.50 at WinCo on ice cream')).toEqual(a);
  });
});
