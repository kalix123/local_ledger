import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import EditTransaction from '../components/EditTransaction';
import TransactionRow from '../components/TransactionRow';
import { useCategory, useStore } from '../store';
import { Transaction } from '../types';
import { Icon } from '../icons';
import { Button, Card, Chip, Field, T, useP } from '../ui';
import { currentCycle, formatMoney, friendlyDate } from '../utils';

/** Rows rendered at a time. Years of history would otherwise mount thousands of views at once. */
export const HISTORY_PAGE = 150;

export default function HistoryScreen() {
  const p = useP();
  const { data } = useStore();
  const cat = useCategory();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [offset, setOffset] = useState(0); // 0 = current cycle, -1 = previous, … ; null-ish via "all time"
  const [allTime, setAllTime] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  // Paging resets whenever the search or filters change: the limit only applies to the view it was set for.
  const viewKey = [q, filter, allTime, offset].join('|');
  const [paging, setPaging] = useState({ viewKey, limit: HISTORY_PAGE });
  const limit = paging.viewKey === viewKey ? paging.limit : HISTORY_PAGE;
  const cur = data.settings.currency;

  const now = new Date();
  const ref = new Date(now.getFullYear(), now.getMonth() + offset, Math.min(now.getDate(), 28));
  const cycle = currentCycle(data.settings.cycleStartDay, ref);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.transactions
      .filter((t) => allTime || (t.date >= cycle.start && t.date < cycle.end))
      .filter((t) => filter === 'all' || t.type === filter)
      .filter((t) => !needle || [t.merchant, t.note, t.raw, cat(t.categoryId).name].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [data.transactions, q, filter, allTime, cycle.start, cycle.end, cat]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of list.slice(0, limit)) {
      const g = m.get(t.date);
      if (g) g.push(t);
      else m.set(t.date, [t]);
    }
    return [...m.entries()];
  }, [list, limit]);

  const { totalOut, totalIn } = useMemo(() => {
    let out = 0;
    let inc = 0;
    for (const t of list) {
      if (t.type === 'expense') out += t.amount;
      else inc += t.amount;
    }
    return { totalOut: out, totalIn: inc };
  }, [list]);

  return (
    <View>
      <Field placeholder="Search merchant, note, category…" value={q} onChangeText={setQ} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Pressable disabled={allTime} onPress={() => setOffset((o) => o - 1)} hitSlop={10} style={{ opacity: allTime ? 0.3 : 1 }}>
          <Icon name="chevron-left" size={22} color={p.accent} pack="icons" />
        </Pressable>
        <Pressable onPress={() => setAllTime((v) => !v)}>
          <T weight="700">{allTime ? 'All time' : cycle.label}</T>
        </Pressable>
        <Pressable disabled={allTime || offset >= 0} onPress={() => setOffset((o) => o + 1)} hitSlop={10} style={{ opacity: allTime || offset >= 0 ? 0.3 : 1 }}>
          <Icon name="chevron-right" size={22} color={p.accent} pack="icons" />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Expenses" active={filter === 'expense'} onPress={() => setFilter('expense')} />
        <Chip label="Income" active={filter === 'income'} onPress={() => setFilter('income')} />
        <Chip label={allTime ? 'This period' : 'All time'} onPress={() => setAllTime((v) => !v)} />
      </View>
      <T size={13} muted style={{ marginVertical: 6 }}>
        {list.length.toLocaleString('en-US')} {list.length === 1 ? 'entry' : 'entries'} · out {formatMoney(totalOut, cur)} · in {formatMoney(totalIn, cur)}
      </T>

      {groups.length ? (
        groups.map(([date, txs]) => (
          <View key={date} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, paddingHorizontal: 4 }}>
              <T size={13} weight="700" muted>
                {friendlyDate(date)}
              </T>
              <T size={12} muted>
                {formatMoney(
                  txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
                  cur,
                  { sign: true },
                )}
              </T>
            </View>
            <Card style={{ paddingVertical: 4 }}>
              {txs.map((t) => (
                <TransactionRow key={t.id} tx={t} onPress={() => setEditing(t)} />
              ))}
            </Card>
          </View>
        ))
      ) : (
        <Card style={{ marginTop: 10 }}>
          <T muted>{q ? 'No matches.' : 'No transactions in this period.'}</T>
        </Card>
      )}
      {list.length > limit ? (
        <Button
          label={`Show more (${(list.length - limit).toLocaleString('en-US')} older)`}
          kind="ghost"
          onPress={() => setPaging({ viewKey, limit: limit + HISTORY_PAGE })}
          style={{ alignSelf: 'center', marginTop: 12 }}
        />
      ) : null}
      <EditTransaction key={editing?.id ?? "none"} tx={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
