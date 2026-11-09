import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, TextInputInstance, View } from 'react-native';
import { Icon } from '../icons';
import { parseEntry } from '../parser';
import { useCategory, useStore } from '../store';
import { ParsedEntry, Transaction } from '../types';
import { Chip, T, useP } from '../ui';
import { formatMoney, friendlyDate } from '../utils';

const EXAMPLES = [
  'spent 10.50 at WinCo on ice cream',
  'got paid for work 135 plus 20 in tips',
  'coffee 4.75 at Starbucks',
  'gas 42 yesterday',
  'rent 1250',
];

export default function QuickEntry({ autoFocus }: { autoFocus?: boolean }) {
  const p = useP();
  const { data, addTransaction, deleteTransaction, addRule } = useStore();
  const cat = useCategory();
  const [text, setText] = useState('');
  const [override, setOverride] = useState<{ type?: 'income' | 'expense'; categoryId?: string; amount?: string }>({});
  const [picking, setPicking] = useState(false);
  const [remember, setRemember] = useState(true);
  const [toast, setToast] = useState<{ tx: Transaction; msg: string } | null>(null);
  const [exampleIdx, setExampleIdx] = useState(0);
  const inputRef = useRef<TextInputInstance>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setExampleIdx((i) => (i + 1) % EXAMPLES.length), 4000);
    return () => {
      clearInterval(t);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const parsed = useMemo<ParsedEntry | null>(() => {
    if (!text.trim()) return null;
    return parseEntry(text, data.categories, data.rules);
  }, [text, data.categories, data.rules]);

  const entry = useMemo(() => {
    if (!parsed) return null;
    const type = override.type ?? parsed.type;
    let categoryId = override.categoryId ?? parsed.categoryId;
    if (cat(categoryId).kind !== type) categoryId = type === 'income' ? 'other-income' : 'other';
    const amount = override.amount !== undefined ? parseFloat(override.amount) : parsed.amount;
    return { ...parsed, type, categoryId, amount: amount && isFinite(amount) && amount > 0 ? amount : null };
  }, [parsed, override, cat]);

  const reset = () => {
    setText('');
    setOverride({});
    setPicking(false);
  };

  const showToast = (tx: Transaction, msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ tx, msg });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const submit = () => {
    if (!entry) return;
    if (entry.amount === null) {
      setOverride((o) => ({ ...o, amount: o.amount ?? '' }));
      return;
    }
    const tx = addTransaction({
      type: entry.type,
      amount: entry.amount,
      categoryId: entry.categoryId,
      merchant: entry.merchant,
      note: entry.note,
      date: entry.date,
      raw: text.trim(),
      source: 'parser',
    });
    if (override.categoryId && remember && entry.merchant) {
      addRule({ match: entry.merchant.toLowerCase(), merchant: entry.merchant, categoryId: entry.categoryId });
    }
    const c = cat(tx.categoryId);
    showToast(tx, `${tx.type === 'income' ? 'Added income' : 'Logged'} ${formatMoney(tx.amount, data.settings.currency)} · ${c.name}`);
    reset();
    inputRef.current?.focus();
  };

  const undo = () => {
    if (!toast) return;
    deleteTransaction(toast.tx.id);
    setText(toast.tx.raw);
    setToast(null);
  };

  const c = entry ? cat(entry.categoryId) : null;
  const pool = data.categories.filter((x) => x.kind === (entry?.type ?? 'expense'));
  const isIncome = entry?.type === 'income';

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: p.surface,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: text ? p.accent : p.border,
          paddingLeft: 14,
          paddingRight: 6,
          shadowColor: '#000',
          shadowOpacity: p.dark ? 0 : 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <View style={{ marginRight: 8 }}>
          <Icon name="edit" size={20} color={text ? p.accent : p.textMuted} />
        </View>
        <TextInput
          ref={inputRef}
          value={text}
          autoFocus={autoFocus}
          onChangeText={(v) => {
            setText(v);
            if (!v) reset();
          }}
          onSubmitEditing={submit}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={`e.g. "${EXAMPLES[exampleIdx]}"`}
          placeholderTextColor={p.textMuted}
          accessibilityLabel="Describe a transaction"
          style={{ flex: 1, color: p.text, fontSize: 16, paddingVertical: 15, outlineStyle: 'none' } as any}
        />
        <Pressable
          onPress={submit}
          disabled={!entry}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          style={({ pressed }) => ({
            backgroundColor: entry ? p.accent : p.surfaceAlt,
            width: 42,
            height: 42,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="enter" size={22} color={entry ? p.accentText : p.textMuted} />
        </Pressable>
      </View>

      {entry && c ? (
        <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip icon={isIncome ? 'income' : 'expense'} label={isIncome ? 'Income' : 'Expense'} color={isIncome ? p.income : p.text} onPress={() => setOverride((o) => ({ ...o, type: isIncome ? 'expense' : 'income', categoryId: undefined }))} />
            {override.amount !== undefined ? (
              <TextInput
                autoFocus
                keyboardType="decimal-pad"
                value={override.amount}
                onChangeText={(v) => setOverride((o) => ({ ...o, amount: v.replace(/[^0-9.]/g, '') }))}
                onSubmitEditing={submit}
                placeholder="Amount"
                placeholderTextColor={p.danger}
                style={{ width: 90, color: p.text, borderBottomWidth: 2, borderColor: p.accent, fontSize: 16, fontWeight: '700', marginRight: 8, marginBottom: 6, paddingVertical: 3 }}
              />
            ) : (
              <Chip label={entry.amount !== null ? formatMoney(entry.amount, data.settings.currency) : 'No amount'} color={entry.amount === null ? p.danger : isIncome ? p.income : p.text} onPress={() => setOverride((o) => ({ ...o, amount: entry.amount?.toString() ?? '' }))} />
            )}
            <Chip cat={c} label={c.name} trailing="chevron-down" active={picking} onPress={() => setPicking((v) => !v)} />
            {entry.merchant ? <Chip icon="store" label={entry.merchant} /> : null}
            <Chip icon="calendar" label={friendlyDate(entry.date)} />
          </View>
          {entry.note ? (
            <T size={13} muted style={{ marginTop: 2 }}>
              “{entry.note}”
            </T>
          ) : null}

          {picking ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
              {pool.map((x) => (
                <Chip
                  key={x.id}
                  cat={x}
                  label={x.name}
                  active={x.id === entry.categoryId}
                  onPress={() => {
                    setOverride((o) => ({ ...o, categoryId: x.id }));
                    setPicking(false);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}

          {override.categoryId && entry.merchant ? (
            <Pressable onPress={() => setRemember((r) => !r)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <View style={{ marginRight: 6 }}>
                <Icon name={remember ? 'checkbox-on' : 'checkbox-off'} size={16} color={p.accent} />
              </View>
              <T size={13} muted>
                Always file {entry.merchant} under {c.name}
              </T>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <T size={12} muted style={{ flex: 1 }}>
              {entry.amount === null ? 'No amount found — tap “No amount” to type one.' : 'Press Enter to save · tap a chip to adjust'}
            </T>
          </View>
        </View>
      ) : null}

      {toast ? (
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: p.text, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
          <View style={{ marginRight: 8 }}>
            <Icon name="check" size={16} color={p.bg} pack="icons" />
          </View>
          <Text style={{ color: p.bg, flex: 1, fontSize: 14 }}>{toast.msg}</Text>
          <Pressable onPress={undo} hitSlop={10}>
            <Text style={{ color: p.bg, fontWeight: '700', textDecorationLine: 'underline' }}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
