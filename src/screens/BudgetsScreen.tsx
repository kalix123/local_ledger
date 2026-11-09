import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { Icon } from '../icons';
import { Category } from '../types';
import { Card, CatLabel, ProgressBar, SectionTitle, T, useP } from '../ui';
import { currentCycle, formatMoney, summarize } from '../utils';

export default function BudgetsScreen() {
  const p = useP();
  const { data, setBudget } = useStore();
  const cur = data.settings.currency;
  const cycle = currentCycle(data.settings.cycleStartDay);
  const sum = useMemo(() => summarize(data, cycle.start, cycle.end), [data, cycle.start, cycle.end]);
  const pace = cycle.dayIndex / cycle.totalDays;
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const expenseCats = data.categories.filter((c) => c.kind === 'expense');
  const budgeted = expenseCats.filter((c) => data.budgets[c.id]);
  const unbudgeted = expenseCats.filter((c) => !data.budgets[c.id]);
  const totalCap = budgeted.reduce((s, c) => s + data.budgets[c.id], 0);
  const totalSpentBudgeted = budgeted.reduce((s, c) => s + (sum.byCategory[c.id] ?? 0), 0);

  const commit = (id: string) => {
    const v = parseFloat(draft);
    setBudget(id, isFinite(v) && v > 0 ? v : null);
    setEditing(null);
  };
  const startEdit = (id: string) => {
    setEditing(id);
    setDraft(data.budgets[id] ? String(data.budgets[id]) : '');
  };

  const row = (c: Category) => {
    const id = c.id;
    const cap = data.budgets[id];
    const spent = sum.byCategory[id] ?? 0;
    const isEditing = editing === id;
    return (
      <View key={id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <CatLabel cat={c} flex />
          {isEditing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T muted>{cur}</T>
              <TextInput
                autoFocus
                value={draft}
                onChangeText={(v) => setDraft(v.replace(/[^0-9.]/g, ''))}
                onSubmitEditing={() => commit(id)}
                onBlur={() => commit(id)}
                keyboardType="decimal-pad"
                placeholder="0 = none"
                placeholderTextColor={p.textMuted}
                style={{ width: 90, color: p.text, fontSize: 15, fontWeight: '700', borderBottomWidth: 2, borderColor: p.accent, paddingVertical: 2, marginLeft: 2 }}
              />
              <T size={12} muted>
                {' '}
                /mo
              </T>
            </View>
          ) : (
            <Pressable onPress={() => startEdit(id)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <T size={14} weight="600" color={p.accent}>
                {cap ? `${formatMoney(cap, cur, { cents: false })}/mo` : '+ Set cap'}
              </T>
              {cap ? <Icon name="edit" size={13} color={p.accent} /> : null}
            </Pressable>
          )}
        </View>
        {cap ? (
          <>
            <View style={{ marginTop: 8 }}>
              <ProgressBar value={spent} max={cap} paceAt={pace} height={10} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
              <T size={12} muted>
                {formatMoney(spent, cur)} spent · {Math.round((spent / cap) * 100)}%
              </T>
              <T size={12} color={spent > cap ? p.danger : p.textMuted}>
                {spent > cap ? `${formatMoney(spent - cap, cur)} over` : `${formatMoney(cap - spent, cur)} left`}
              </T>
            </View>
          </>
        ) : spent > 0 ? (
          <T size={12} muted style={{ marginTop: 4 }}>
            {formatMoney(spent, cur)} spent, no cap
          </T>
        ) : null}
      </View>
    );
  };

  return (
    <View>
      <Card>
        <T size={13} muted weight="600">
          {cycle.label} · day {cycle.dayIndex} of {cycle.totalDays}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6, marginBottom: 10 }}>
          <T size={28} weight="800">
            {formatMoney(totalSpentBudgeted, cur, { cents: false })}
          </T>
          <T muted style={{ marginLeft: 6, marginBottom: 4 }}>
            of {formatMoney(totalCap, cur, { cents: false })} budgeted
          </T>
        </View>
        <ProgressBar value={totalSpentBudgeted} max={totalCap || 1} paceAt={pace} height={12} />
        <T size={12} muted style={{ marginTop: 8 }}>
          The thin line marks where you&apos;d be if you spent evenly through the {data.settings.cycleStartDay === 1 ? 'month' : 'cycle'}.
        </T>
      </Card>

      <SectionTitle>Your budgets</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {budgeted.length ? budgeted.map((c) => row(c)) : <T muted style={{ paddingVertical: 12 }}>No caps yet — pick a category below.</T>}
      </Card>

      {unbudgeted.length ? (
        <>
          <SectionTitle>Other categories</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>{unbudgeted.map((c) => row(c))}</Card>
        </>
      ) : null}
    </View>
  );
}
