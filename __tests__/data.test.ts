import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultData } from '../src/defaults';
import { MAX_AMOUNT, sanitize } from '../src/sanitize';
import { CHUNK_PREFIX, CHUNK_SIZE, LEGACY_KEY, loadRaw, META_KEY, resetStorageCache, save } from '../src/storage';
import { AppData } from '../src/types';
import { currentCycle, summarize, toCSV } from '../src/utils';
import { makeData, makeTransactions } from './helpers';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetStorageCache();
  jest.clearAllMocks();
});

const roundTrip = (d: AppData) => sanitize(JSON.parse(JSON.stringify(d)));

describe('sanitize: valid data', () => {
  test('a normal backup round-trips unchanged', () => {
    const d = makeData(500);
    expect(roundTrip(d)).toEqual(d);
  });

  test('defaults round-trip unchanged', () => {
    expect(roundTrip(defaultData())).toEqual(defaultData());
  });
});

describe('sanitize: rejects things that are not backups', () => {
  test.each([null, undefined, 5, 'hello', [], [1, 2], {}, { transactions: 'nope' }, { transactions: {} }])('%p', (raw) => {
    expect(() => sanitize(raw)).toThrow();
  });
});

describe('sanitize: repairs damaged data', () => {
  const base = () => JSON.parse(JSON.stringify(defaultData()));

  test('drops transactions with bad amounts or dates, keeps the good ones', () => {
    const raw = base();
    raw.transactions = [
      { id: 'ok', amount: 5, date: '2026-11-01', type: 'expense', categoryId: 'groceries' },
      { id: 'nan', amount: NaN, date: '2026-11-01' },
      { id: 'inf', amount: 'Infinity', date: '2026-11-01' },
      { id: 'huge', amount: MAX_AMOUNT * 10, date: '2026-11-01' },
      { id: 'nodate', amount: 5 },
      { id: 'baddate', amount: 5, date: '2026-02-30' },
      { id: 'garbage', amount: 5, date: 'yesterday' },
      { id: 'obj', amount: { x: 1 }, date: '2026-11-01' },
      null,
      'string',
      42,
      [],
    ];
    expect(sanitize(raw).transactions.map((t) => t.id)).toEqual(['ok']);
  });

  test('normalises fields', () => {
    const raw = base();
    raw.transactions = [{ id: 7, amount: '-12.345', date: '2026-11-01T10:00:00Z', type: 'weird', merchant: 12, note: null, source: 'hacker', createdAt: 'x' }];
    const [t] = sanitize(raw).transactions;
    expect(t).toMatchObject({ id: '7', amount: 12.35, date: '2026-11-01', type: 'expense', merchant: '12', note: '', source: 'parser' });
    expect(Number.isFinite(t.createdAt)).toBe(true);
  });

  test('duplicate transaction ids are made unique (so deleting one never deletes both)', () => {
    const raw = base();
    raw.transactions = [
      { id: 'dup', amount: 1, date: '2026-11-01' },
      { id: 'dup', amount: 2, date: '2026-11-02' },
      { amount: 3, date: '2026-11-03' },
    ];
    const ids = sanitize(raw).transactions.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  test('entries pointing at a missing or wrong-kind category go to the Other buckets', () => {
    const raw = base();
    raw.transactions = [
      { id: 'a', amount: 1, date: '2026-11-01', type: 'expense', categoryId: 'deleted' },
      { id: 'b', amount: 1, date: '2026-11-01', type: 'income', categoryId: 'groceries' },
    ];
    expect(sanitize(raw).transactions.map((t) => t.categoryId)).toEqual(['other', 'other-income']);
  });

  test('categories: bad entries dropped, duplicates removed, Other buckets always present', () => {
    const raw = base();
    raw.categories = [{ id: 'pets', name: 'Pets', kind: 'expense', icon: 'pet' }, { id: 'pets', name: 'Dup' }, { name: 'no id' }, null, { id: 'x', icon: 'toString', kind: 'nonsense' }];
    const cats = sanitize(raw).categories;
    expect(cats.map((c) => c.id)).toEqual(['pets', 'x', 'other', 'other-income']);
    expect(cats[1]).toMatchObject({ icon: 'tag', kind: 'expense', name: 'Unnamed' });
  });

  test('empty category list falls back to defaults', () => {
    const raw = base();
    raw.categories = [];
    expect(sanitize(raw).categories.map((c) => c.id)).toEqual(defaultData().categories.map((c) => c.id));
  });

  test('budgets: only positive numbers for real expense categories', () => {
    const raw = base();
    raw.budgets = { groceries: '250', dining: -5, entertainment: 'lots', paycheck: 100, ghost: 50, health: Infinity, __proto__: { polluted: 1 } };
    expect(sanitize(raw).budgets).toEqual({ groceries: 250 });
    expect(({} as any).polluted).toBeUndefined();
  });

  test('a __proto__ key in JSON does not pollute objects', () => {
    const raw = JSON.parse('{"transactions":[],"budgets":{"__proto__":{"evil":true}},"settings":{"__proto__":{"evil":true}}}');
    sanitize(raw);
    expect(({} as any).evil).toBeUndefined();
  });

  test('rules: blank and duplicate matches dropped, unknown categories reset', () => {
    const raw = base();
    raw.rules = [{ match: 'WinCo', categoryId: 'groceries' }, { match: 'winco ', categoryId: 'dining' }, { match: '   ' }, { match: 5 }, { match: 'abc', categoryId: 'ghost' }, null];
    const rules = sanitize(raw).rules;
    expect(rules.map((r) => [r.match, r.categoryId])).toEqual([
      ['winco', 'groceries'],
      ['5', 'other'],
      ['abc', 'other'],
    ]);
  });

  test('settings: every field validated', () => {
    const raw = base();
    raw.settings = {
      mode: 'god',
      currency: { $: 1 },
      cycleStartDay: 'abc',
      theme: 'neon',
      customTheme: { bg: 'red', accent: '#00FF00' },
      iconPack: 'toString',
      appIcon: 'hacked',
      supporterCode: 12345,
      ai: { provider: 'evilcorp', baseUrl: 7, cloudRiskAcknowledged: 'yes', useForUnclearEntries: 'no' },
    };
    const s = sanitize(raw).settings;
    expect(s).toMatchObject({ mode: 'basic', currency: '$', cycleStartDay: 1, theme: 'system', iconPack: 'icons', appIcon: 'coin', supporterCode: '12345' });
    expect(s.customTheme).toEqual({ ...defaultData().settings.customTheme, accent: '#00FF00' });
    expect(s.ai).toMatchObject({ provider: 'none', baseUrl: '7', cloudRiskAcknowledged: false, useForUnclearEntries: true });
  });

  test.each([
    [0, 1],
    [31, 28],
    [15.7, 15],
    ['10', 10],
  ])('cycle start day %p → %p', (input, out) => {
    const raw = base();
    raw.settings.cycleStartDay = input;
    expect(sanitize(raw).settings.cycleStartDay).toBe(out);
  });

  test('the cloud-AI acknowledgement is only accepted as literal true', () => {
    const raw = base();
    raw.settings.ai = { provider: 'openai', baseUrl: 'https://api.openai.com/v1', cloudRiskAcknowledged: 1 };
    expect(sanitize(raw).settings.ai.cloudRiskAcknowledged).toBe(false);
  });

  test('oversized strings are trimmed', () => {
    const raw = base();
    raw.transactions = [{ id: 'x', amount: 1, date: '2026-11-01', note: 'n'.repeat(100000), merchant: 'm'.repeat(100000), raw: 'r'.repeat(100000) }];
    const [t] = sanitize(raw).transactions;
    expect(t.note.length).toBeLessThanOrEqual(200);
    expect(t.merchant.length).toBeLessThanOrEqual(60);
    expect(t.raw.length).toBeLessThanOrEqual(500);
  });

  test('missing optional sections get defaults', () => {
    const d = sanitize({ transactions: [] });
    expect(d.settings).toEqual(defaultData().settings);
    expect(d.rules).toEqual([]);
    expect(d.budgets).toEqual(defaultData().budgets);
  });
});

describe('storage', () => {
  test('nothing saved yet', async () => {
    expect(await loadRaw()).toBeNull();
  });

  test('small data round-trips', async () => {
    const d = makeData(10);
    await save(d);
    resetStorageCache();
    expect(sanitize((await loadRaw())!.data)).toEqual(d);
  });

  test('20,000 transactions are split into chunks well under the Android 2 MB limit', async () => {
    const d = makeData(20_000);
    await save(d);
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CHUNK_PREFIX));
    expect(keys).toHaveLength(Math.ceil(20_000 / CHUNK_SIZE));
    for (const [, v] of await AsyncStorage.multiGet([...keys, META_KEY])) expect(v!.length).toBeLessThan(1_000_000);
    resetStorageCache();
    expect(sanitize((await loadRaw())!.data).transactions).toEqual(d.transactions);
  });

  test('adding one entry only rewrites the chunk it lives in', async () => {
    const d = makeData(5_500); // last chunk is half full
    await save(d);
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    // The store puts new entries at the front of the list, so test exactly that.
    const next = { ...d, transactions: [makeTransactions(1, { seed: 9 })[0], ...d.transactions] };
    await save(next);
    const written = (AsyncStorage.multiSet as jest.Mock).mock.calls.flatMap((c) => c[0].map(([k]: [string]) => k));
    expect(written).toEqual([CHUNK_PREFIX + '5']);
  });

  test('saving and loading keeps the newest-first order exactly', async () => {
    const d = makeData(2_345);
    await save(d);
    resetStorageCache();
    const loaded = (await loadRaw())!.data as typeof d;
    expect(loaded.transactions.map((t) => t.id)).toEqual(d.transactions.map((t) => t.id));
  });

  test('data saved in the older newest-first chunk order still loads in the right order', async () => {
    const d = makeData(1_500);
    const { transactions, ...rest } = d;
    await AsyncStorage.multiSet([
      [META_KEY, JSON.stringify({ ...rest, chunks: 2 })], // no `order` field
      [CHUNK_PREFIX + '0', JSON.stringify(transactions.slice(0, CHUNK_SIZE))],
      [CHUNK_PREFIX + '1', JSON.stringify(transactions.slice(CHUNK_SIZE))],
    ]);
    resetStorageCache();
    const loaded = (await loadRaw())!.data as typeof d;
    expect(loaded.transactions.map((t) => t.id)).toEqual(transactions.map((t) => t.id));
  });

  test('changing a setting does not rewrite any transactions', async () => {
    const d = makeData(3_000);
    await save(d);
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    await save({ ...d, settings: { ...d.settings, currency: '€' } });
    const written = (AsyncStorage.multiSet as jest.Mock).mock.calls.flatMap((c) => c[0].map(([k]: [string]) => k));
    expect(written).toEqual([META_KEY]);
  });

  test('when the list shrinks, leftover chunks are removed', async () => {
    await save(makeData(3_500));
    await save(makeData(1_200));
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CHUNK_PREFIX)).sort();
    expect(keys).toEqual([CHUNK_PREFIX + '0', CHUNK_PREFIX + '1']);
    resetStorageCache();
    expect((await loadRaw())!.data).toMatchObject({ transactions: expect.any(Array) });
    expect(((await loadRaw())!.data as AppData).transactions).toHaveLength(1_200);
  });

  test('deleting everything leaves no chunks', async () => {
    await save(makeData(2_000));
    await save(defaultData());
    expect((await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CHUNK_PREFIX))).toEqual([]);
  });

  test('reads the old single-key format and migrates it', async () => {
    const d = makeData(50);
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(d));
    const loaded = sanitize((await loadRaw())!.data);
    expect(loaded).toEqual(d);
    await save(loaded);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
    resetStorageCache();
    expect(sanitize((await loadRaw())!.data)).toEqual(d);
  });

  test('corrupted meta throws instead of returning empty data', async () => {
    await AsyncStorage.setItem(META_KEY, '{not json');
    await expect(loadRaw()).rejects.toThrow(/corrupted/);
  });

  test('a missing chunk throws instead of silently losing entries', async () => {
    await save(makeData(2_500));
    await AsyncStorage.removeItem(CHUNK_PREFIX + '1');
    resetStorageCache();
    await expect(loadRaw()).rejects.toThrow(/incomplete/);
  });

  test('a corrupted chunk throws', async () => {
    await save(makeData(1_500));
    await AsyncStorage.setItem(CHUNK_PREFIX + '0', '[{"broken"');
    resetStorageCache();
    await expect(loadRaw()).rejects.toThrow(/corrupted/);
  });
});

describe('large data performance', () => {
  // Generous limits: these catch accidental O(n²) work, not micro-regressions.
  const big = makeData(50_000);

  test('sanitize 50k entries', () => {
    const t0 = Date.now();
    const json = JSON.parse(JSON.stringify(big));
    expect(sanitize(json).transactions).toHaveLength(50_000);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  test('summarize a cycle over 50k entries', () => {
    const c = currentCycle(1, new Date(2026, 10, 9));
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) summarize(big, c.start, c.end);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  test('CSV export of 50k entries', () => {
    const t0 = Date.now();
    const csv = toCSV(big);
    expect(csv.split('\n').length).toBeGreaterThan(50_000);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  test('save and load 50k entries', async () => {
    const t0 = Date.now();
    await save(big);
    resetStorageCache();
    const loaded = sanitize((await loadRaw())!.data);
    expect(loaded.transactions).toHaveLength(50_000);
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  test('totals stay exact to the cent over many entries', () => {
    const d = makeData(10_000);
    const c = { start: '0000-01-01', end: '9999-12-31' };
    const s = summarize(d, c.start, c.end);
    const cents = d.transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + Math.round(t.amount * 100), 0);
    expect(Math.round(s.spent * 100)).toBe(cents);
  });
});
