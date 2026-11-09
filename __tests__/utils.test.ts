import { defaultData } from '../src/defaults';
import { AppData, Transaction } from '../src/types';
import { currentCycle, formatMoney, fromISODate, friendlyDate, inRange, round2, summarize, toCSV, toISODate, uid } from '../src/utils';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: uid(),
  type: 'expense',
  amount: 10,
  categoryId: 'groceries',
  merchant: '',
  note: '',
  date: '2026-11-05',
  raw: '',
  createdAt: 0,
  source: 'parser',
  ...over,
});
const withTxs = (transactions: Transaction[]): AppData => ({ ...defaultData(), transactions });

describe('formatMoney', () => {
  test.each([
    [0, {}, '$0.00'],
    [10.5, {}, '$10.50'],
    [1234567.891, {}, '$1,234,567.89'],
    [-42, {}, '−$42.00'],
    [42, { sign: true }, '+$42.00'],
    [0, { sign: true }, '$0.00'],
    [400, { cents: false }, '$400'],
    [10.5, { cents: false }, '$10.50'], // real cents are never hidden
    [0.1 + 0.2, {}, '$0.30'],
    [1e12, {}, '$1,000,000,000,000.00'],
  ])('%p %p → %s', (n, opts, out) => {
    expect(formatMoney(n as number, '$', opts as any)).toBe(out);
  });

  test('uses any currency symbol', () => {
    expect(formatMoney(5, '€')).toBe('€5.00');
    expect(formatMoney(5, 'CHF ')).toBe('CHF 5.00');
    expect(formatMoney(5, '')).toBe('5.00');
  });

  test('never prints NaN or Infinity', () => {
    for (const n of [NaN, Infinity, -Infinity]) expect(formatMoney(n, '$')).not.toMatch(/NaN|∞|Infinity/);
  });
});

describe('dates', () => {
  test('ISO round trip uses local time', () => {
    for (const s of ['2026-01-01', '2026-03-08', '2026-11-01', '2028-02-29', '2026-12-31']) expect(toISODate(fromISODate(s))).toBe(s);
  });

  test('friendlyDate', () => {
    const now = new Date();
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    expect(friendlyDate(toISODate(now))).toBe('Today');
    expect(friendlyDate(toISODate(y))).toBe('Yesterday');
    expect(friendlyDate('2001-07-04')).toMatch(/2001/);
  });

  test('friendlyDate never shows "Invalid Date"', () => {
    for (const s of ['', 'garbage', '2026-13-45']) expect(friendlyDate(s)).not.toMatch(/Invalid/);
  });
});

describe('currentCycle', () => {
  test('calendar month', () => {
    const c = currentCycle(1, new Date(2026, 10, 9));
    expect(c).toMatchObject({ start: '2026-11-01', end: '2026-12-01', dayIndex: 9, totalDays: 30 });
    expect(c.label).toBe('November 2026');
  });

  test('payday cycle before the start day belongs to the previous month', () => {
    expect(currentCycle(15, new Date(2026, 10, 9))).toMatchObject({ start: '2026-10-15', end: '2026-11-15', dayIndex: 26, totalDays: 31 });
  });

  test('payday cycle on the start day', () => {
    expect(currentCycle(15, new Date(2026, 10, 15))).toMatchObject({ start: '2026-11-15', dayIndex: 1 });
  });

  test('the day before the start day is the last day of the cycle', () => {
    const c = currentCycle(15, new Date(2026, 10, 14));
    expect(c.dayIndex).toBe(c.totalDays);
  });

  test('crosses the year boundary', () => {
    expect(currentCycle(10, new Date(2027, 0, 3))).toMatchObject({ start: '2026-12-10', end: '2027-01-10' });
  });

  test('February, normal and leap year', () => {
    expect(currentCycle(1, new Date(2026, 1, 10)).totalDays).toBe(28);
    expect(currentCycle(1, new Date(2028, 1, 10)).totalDays).toBe(29);
  });

  test('daylight-saving changes do not break day counts', () => {
    // US DST starts Mar 8 2026 and ends Nov 1 2026.
    expect(currentCycle(1, new Date(2026, 2, 31))).toMatchObject({ dayIndex: 31, totalDays: 31 });
    expect(currentCycle(1, new Date(2026, 10, 30))).toMatchObject({ dayIndex: 30, totalDays: 30 });
  });

  test.each([0, -5, 29, 31, 100, 2.5, NaN, Infinity])('bad start day %p still gives a valid cycle', (day) => {
    const c = currentCycle(day as number, new Date(2026, 10, 9));
    expect(c.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(c.end > c.start).toBe(true);
    expect(c.dayIndex).toBeGreaterThanOrEqual(1);
    expect(c.dayIndex).toBeLessThanOrEqual(c.totalDays);
    expect(c.label).not.toMatch(/Invalid|NaN/);
  });

  test('every day of a year lands inside its own cycle', () => {
    for (const startDay of [1, 15, 28]) {
      for (let d = 0; d < 366; d++) {
        const ref = new Date(2026, 0, 1 + d);
        const c = currentCycle(startDay, ref);
        const iso = toISODate(ref);
        expect(iso >= c.start && iso < c.end).toBe(true);
      }
    }
  });
});

describe('summarize', () => {
  test('splits income and spending, groups by category, respects the range', () => {
    const data = withTxs([
      tx({ amount: 10, categoryId: 'groceries' }),
      tx({ amount: 5.25, categoryId: 'groceries' }),
      tx({ amount: 20, categoryId: 'dining' }),
      tx({ amount: 100, type: 'income', categoryId: 'paycheck' }),
      tx({ amount: 999, date: '2026-10-31' }), // before
      tx({ amount: 999, date: '2026-12-01' }), // end is exclusive
    ]);
    const s = summarize(data, '2026-11-01', '2026-12-01');
    expect(s.spent).toBeCloseTo(35.25);
    expect(s.income).toBe(100);
    expect(s.byCategory).toEqual({ groceries: 15.25, dining: 20 });
    expect(s.txs).toHaveLength(4);
  });

  test('cents add up exactly over many entries', () => {
    const data = withTxs(Array.from({ length: 1000 }, () => tx({ amount: 0.1 })));
    expect(round2(summarize(data, '2026-11-01', '2026-12-01').spent)).toBe(100);
  });

  test('empty data', () => {
    expect(summarize(withTxs([]), '2026-11-01', '2026-12-01')).toEqual({ spent: 0, income: 0, byCategory: {}, txs: [] });
  });

  test('inRange is start-inclusive and end-exclusive', () => {
    expect(inRange(tx({ date: '2026-11-01' }), '2026-11-01', '2026-12-01')).toBe(true);
    expect(inRange(tx({ date: '2026-12-01' }), '2026-11-01', '2026-12-01')).toBe(false);
  });
});

describe('toCSV', () => {
  const parseCSV = (csv: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (q) {
        if (ch === '"' && csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += ch;
    }
    row.push(cell);
    rows.push(row);
    return rows;
  };

  test('header and sorted rows', () => {
    const csv = toCSV(withTxs([tx({ date: '2026-11-05', amount: 1 }), tx({ date: '2026-11-01', amount: 2.5 })]));
    const rows = parseCSV(csv);
    expect(rows[0]).toEqual(['date', 'type', 'amount', 'category', 'merchant', 'note', 'original_text']);
    expect(rows[1].slice(0, 4)).toEqual(['2026-11-01', 'expense', '2.50', 'Groceries']);
    expect(rows).toHaveLength(3);
  });

  test('commas, quotes and line breaks survive a round trip', () => {
    const tricky = 'He said "hi", then\nleft\r\nagain';
    const rows = parseCSV(toCSV(withTxs([tx({ note: tricky, merchant: 'A, B & "C"' })])));
    expect(rows).toHaveLength(2);
    expect(rows[1][4]).toBe('A, B & "C"');
    expect(rows[1][5]).toBe(tricky);
  });

  test('cells that a spreadsheet would run as formulas are neutralised', () => {
    const rows = parseCSV(toCSV(withTxs([tx({ note: '=HYPERLINK("http://x","click")', merchant: '@SUM(A1)', raw: '+50 from mom' })])));
    for (const cell of rows[1].slice(4)) expect(cell).not.toMatch(/^[=+\-@]/);
    expect(rows[1][6]).toContain('+50 from mom');
  });

  test('unknown category ids are exported as-is', () => {
    expect(parseCSV(toCSV(withTxs([tx({ categoryId: 'deleted-cat' })])))[1][3]).toBe('deleted-cat');
  });
});

test('uid is unique across many calls', () => {
  const ids = new Set(Array.from({ length: 20000 }, uid));
  expect(ids.size).toBe(20000);
});
