import React, { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { aiReady, aiSummary, buildSummaryPayload, isCloud } from '../ai';
import EditTransaction from '../components/EditTransaction';
import QuickEntry from '../components/QuickEntry';
import TransactionRow from '../components/TransactionRow';
import { useCategory, useStore } from '../store';
import { Transaction } from '../types';
import { Button, Card, CatLabel, ProgressBar, SectionTitle, T, useP } from '../ui';
import { currentCycle, formatMoney, round2, summarize } from '../utils';

export type Tab = 'home' | 'history' | 'budgets' | 'settings';

export default function HomeScreen({ go }: { go: (t: Tab) => void }) {
  const p = useP();
  const { data, advanced } = useStore();
  const cat = useCategory();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const cur = data.settings.currency;
  const cycle = currentCycle(data.settings.cycleStartDay);
  const sum = useMemo(() => summarize(data, cycle.start, cycle.end), [data.transactions, cycle.start, cycle.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const net = sum.income - sum.spent;
  const pace = cycle.dayIndex / cycle.totalDays;

  const budgets = Object.entries(data.budgets)
    .filter(([id]) => data.categories.some((c) => c.id === id))
    .map(([id, cap]) => ({ id, cap, spent: sum.byCategory[id] ?? 0 }))
    .sort((a, b) => b.spent / b.cap - a.spent / a.cap);

  const topCats = Object.entries(sum.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCat = topCats[0]?.[1] ?? 0;

  const recent = useMemo(
    () => [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, advanced ? 8 : 5),
    [data.transactions, advanced],
  );

  return (
    <View>
      <QuickEntry autoFocus={Platform.OS === 'web'} />

      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={13} muted weight="600">
            {cycle.label}
          </T>
          <T size={12} muted>
            Day {cycle.dayIndex} of {cycle.totalDays}
          </T>
        </View>
        <T size={34} weight="800" style={{ marginTop: 6, letterSpacing: -0.5 }}>
          {formatMoney(sum.spent, cur)}
        </T>
        <T size={13} muted>
          spent this {data.settings.cycleStartDay === 1 ? 'month' : 'cycle'}
        </T>
        <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
          <Stat label="Income" value={formatMoney(sum.income, cur)} color={p.income} />
          <Stat label="Net" value={formatMoney(net, cur, { sign: true })} color={net >= 0 ? p.income : p.danger} />
          <Stat label="Per day" value={formatMoney(round2(sum.spent / Math.max(cycle.dayIndex, 1)), cur)} />
        </View>
      </Card>

      <SectionTitle
        right={
          <Pressable onPress={() => go('budgets')}>
            <T size={13} weight="600" color={p.accent}>
              {budgets.length ? 'Manage' : 'Set a budget'}
            </T>
          </Pressable>
        }
      >
        Budgets
      </SectionTitle>
      {budgets.length ? (
        <Card>
          {budgets.slice(0, advanced ? 8 : 4).map((b, i) => {
            const c = cat(b.id);
            const left = b.cap - b.spent;
            return (
              <View key={b.id} style={{ marginTop: i ? 14 : 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <CatLabel cat={c} />
                  <T size={13} muted>
                    {formatMoney(b.spent, cur, { cents: false })} / {formatMoney(b.cap, cur, { cents: false })}
                  </T>
                </View>
                <ProgressBar value={b.spent} max={b.cap} paceAt={pace} />
                <T size={12} color={left < 0 ? p.danger : p.textMuted} style={{ marginTop: 4 }}>
                  {left >= 0 ? `${formatMoney(left, cur)} left` : `${formatMoney(-left, cur)} over`}
                  {left >= 0 && b.spent / b.cap > pace + 0.1 ? ' · spending faster than the month' : ''}
                </T>
              </View>
            );
          })}
        </Card>
      ) : (
        <Card>
          <T muted>No budgets yet. Set a monthly cap per category to see progress here.</T>
        </Card>
      )}

      {topCats.length ? (
        <>
          <SectionTitle>Where it went</SectionTitle>
          <Card>
            {topCats.map(([id, amt], i) => {
              const c = cat(id);
              return (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: i ? 10 : 0 }}>
                  <CatLabel cat={c} weight="400" width={130} />
                  <View style={{ flex: 1, height: 8, backgroundColor: p.surfaceAlt, borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' }}>
                    <View style={{ width: `${(amt / maxCat) * 100}%`, height: '100%', backgroundColor: p.accent, borderRadius: 4 }} />
                  </View>
                  <T size={13} weight="600" style={{ minWidth: 70, textAlign: 'right' }}>
                    {formatMoney(amt, cur)}
                  </T>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {advanced && aiReady(data.settings.ai) ? <AISummaryCard sum={sum} cycle={cycle} /> : null}

      <SectionTitle
        right={
          data.transactions.length ? (
            <Pressable onPress={() => go('history')}>
              <T size={13} weight="600" color={p.accent}>
                See all
              </T>
            </Pressable>
          ) : null
        }
      >
        Recent
      </SectionTitle>
      <Card style={{ paddingVertical: 6 }}>
        {recent.length ? (
          recent.map((t) => <TransactionRow key={t.id} tx={t} onPress={() => setEditing(t)} />)
        ) : (
          <T muted style={{ paddingVertical: 10 }}>
            Nothing logged yet — type your first entry above and press Enter.
          </T>
        )}
      </Card>
      <EditTransaction key={editing?.id ?? "none"} tx={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const p = useP();
  return (
    <View style={{ flex: 1, backgroundColor: p.surfaceAlt, borderRadius: 12, padding: 10 }}>
      <T size={11} muted weight="600" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </T>
      <T size={15} weight="700" color={color} style={{ marginTop: 3 }} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

function AISummaryCard({ sum, cycle }: { sum: ReturnType<typeof summarize>; cycle: ReturnType<typeof currentCycle> }) {
  const p = useP();
  const { data } = useStore();
  const cat = useCategory();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState('');
  const [err, setErr] = useState('');
  const [showPayload, setShowPayload] = useState(false);
  const ai = data.settings.ai;

  const ids = new Set([...Object.keys(sum.byCategory), ...Object.keys(data.budgets)]);
  const payload = buildSummaryPayload({
    period: cycle.label,
    currency: data.settings.currency,
    income: round2(sum.income),
    spent: round2(sum.spent),
    dayOfCycle: cycle.dayIndex,
    daysInCycle: cycle.totalDays,
    categories: [...ids].map((id) => ({ name: cat(id).name, spent: round2(sum.byCategory[id] ?? 0), ...(data.budgets[id] ? { budget: data.budgets[id] } : {}) })),
  });

  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      setOut(await aiSummary(ai, payload));
    } catch (e: any) {
      setErr(e?.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>AI summary</SectionTitle>
      <Card>
        {out ? <T style={{ lineHeight: 22 }}>{out}</T> : <T muted>Get a quick read on how this month is pacing.</T>}
        {err ? (
          <T size={13} color={p.danger} style={{ marginTop: 8 }}>
            {err}
          </T>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <Button label={busy ? 'Thinking…' : out ? 'Regenerate' : 'Generate summary'} onPress={run} disabled={busy} small />
          <Button label={showPayload ? 'Hide data' : 'What gets sent?'} kind="ghost" small onPress={() => setShowPayload((v) => !v)} />
        </View>
        <T size={11} muted style={{ marginTop: 8 }}>
          Sends category totals only (no merchants, notes or individual transactions) to {isCloud(ai) ? 'cloud service ' : 'local endpoint '}
          {ai.baseUrl}
        </T>
        {showPayload ? (
          <View style={{ backgroundColor: p.surfaceAlt, borderRadius: 8, padding: 10, marginTop: 8 }}>
            <T size={11} style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>
              {payload}
            </T>
          </View>
        ) : null}
      </Card>
    </>
  );
}
