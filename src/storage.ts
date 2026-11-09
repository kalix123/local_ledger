/**
 * On-device persistence.
 *
 * Android's AsyncStorage can't read a single value bigger than ~2 MB (SQLite CursorWindow),
 * which is roughly 8,000 transactions as one JSON blob. So transactions are split into
 * chunks of CHUNK_SIZE under their own keys, and everything else lives in a small meta key.
 * Only chunks whose contents changed are rewritten, so adding one entry doesn't rewrite
 * years of history.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, Transaction } from './types';

export const META_KEY = 'localledger:data:v2';
export const CHUNK_PREFIX = 'localledger:tx:';
export const LEGACY_KEY = 'localledger:data:v1';
export const CHUNK_SIZE = 1000;

/**
 * In memory, transactions are newest-first. On disk they're stored oldest-first, so a new entry
 * only touches the last chunk instead of shifting every chunk by one. `order` marks that format;
 * data saved without it is in the old newest-first order.
 */
type Meta = Omit<AppData, 'transactions'> & { chunks: number; order?: 'oldest-first' };

/** What was last written per key, so unchanged chunks are skipped. */
const written = new Map<string, string>();

export function resetStorageCache() {
  written.clear();
}

/** Raw (unsanitized) data, or null if nothing has been saved yet. Throws if storage can't be read. */
export async function loadRaw(): Promise<{ data: unknown; rawText: () => string } | null> {
  const metaText = await AsyncStorage.getItem(META_KEY);
  if (metaText === null) {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy === null) return null;
    return { data: JSON.parse(legacy), rawText: () => legacy };
  }
  const keys = [] as string[];
  let meta: Meta;
  try {
    meta = JSON.parse(metaText);
  } catch {
    throw Object.assign(new Error('Saved data is corrupted.'), { rawText: metaText });
  }
  const chunks = Number.isInteger(meta.chunks) && meta.chunks > 0 ? meta.chunks : 0;
  for (let i = 0; i < chunks; i++) keys.push(CHUNK_PREFIX + i);
  const pairs = keys.length ? await AsyncStorage.multiGet(keys) : [];
  const transactions: Transaction[] = [];
  const texts: string[] = [metaText];
  for (const [k, v] of pairs) {
    if (v === null) throw Object.assign(new Error(`Saved data is incomplete (missing ${k}).`), { rawText: texts.join('\n') });
    texts.push(v);
    let arr: unknown;
    try {
      arr = JSON.parse(v);
    } catch {
      throw Object.assign(new Error(`Saved data is corrupted (${k}).`), { rawText: texts.join('\n') });
    }
    if (Array.isArray(arr)) transactions.push(...(arr as Transaction[]));
  }
  if (meta.order === 'oldest-first') transactions.reverse();
  const { chunks: _n, order: _o, ...rest } = meta;
  // Remember what's on disk so the first save only writes real changes.
  written.set(META_KEY, metaText);
  pairs.forEach(([k, v]) => v !== null && written.set(k, v));
  return { data: { ...rest, transactions }, rawText: () => texts.join('\n') };
}

export async function save(data: AppData): Promise<void> {
  const { transactions, ...rest } = data;
  const oldestFirst = transactions.slice().reverse();
  const chunks = Math.ceil(oldestFirst.length / CHUNK_SIZE);
  const sets: [string, string][] = [];
  for (let i = 0; i < chunks; i++) {
    const key = CHUNK_PREFIX + i;
    const text = JSON.stringify(oldestFirst.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    if (written.get(key) !== text) sets.push([key, text]);
  }
  const metaText = JSON.stringify({ ...rest, chunks, order: 'oldest-first' } satisfies Meta);
  if (written.get(META_KEY) !== metaText) sets.push([META_KEY, metaText]);

  // Chunks that no longer exist (the list shrank).
  const stale = [...written.keys()].filter((k) => k.startsWith(CHUNK_PREFIX) && Number(k.slice(CHUNK_PREFIX.length)) >= chunks);

  if (sets.length) await AsyncStorage.multiSet(sets);
  if (stale.length) await AsyncStorage.multiRemove(stale);
  sets.forEach(([k, v]) => written.set(k, v));
  stale.forEach((k) => written.delete(k));
  if (written.has(LEGACY_KEY) === false) {
    // One-time cleanup of the old single-blob format once the new one is safely written.
    await AsyncStorage.removeItem(LEGACY_KEY);
    written.set(LEGACY_KEY, '');
  }
}
