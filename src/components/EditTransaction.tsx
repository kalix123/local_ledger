import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { confirm } from '../platform';
import { useStore } from '../store';
import { Transaction, TxType } from '../types';
import { Button, Chip, Field, Segmented, T, useP } from '../ui';

export default function EditTransaction({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const p = useP();
  const { data, updateTransaction, deleteTransaction } = useStore();
  // Callers pass key={tx.id}, so this component remounts (and re-reads tx) for each entry.
  const [type, setType] = useState<TxType>(tx?.type ?? 'expense');
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '');
  const [merchant, setMerchant] = useState(tx?.merchant ?? '');
  const [note, setNote] = useState(tx?.note ?? '');
  const [date, setDate] = useState(tx?.date ?? '');
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '');

  if (!tx) return null;
  const amt = parseFloat(amount);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const pool = data.categories.filter((c) => c.kind === type);
  const valid = isFinite(amt) && amt > 0 && validDate && pool.some((c) => c.id === categoryId);

  const save = () => {
    updateTransaction(tx.id, { type, amount: Math.round(amt * 100) / 100, merchant: merchant.trim(), note: note.trim(), date, categoryId, source: 'manual' });
    onClose();
  };
  const remove = async () => {
    if (await confirm('Delete transaction?', 'This removes it from this device.', 'Delete', true)) {
      deleteTransaction(tx.id);
      onClose();
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: p.surface, borderRadius: 18, maxWidth: 520, width: '100%', alignSelf: 'center', maxHeight: '90%' }}>
          <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
            <T size={18} weight="700" style={{ marginBottom: 4 }}>
              Edit transaction
            </T>
            {tx.raw ? (
              <T size={12} muted style={{ marginBottom: 14 }}>
                You typed: “{tx.raw}”
              </T>
            ) : null}
            <Segmented
              value={type}
              onChange={(v) => {
                setType(v);
                setCategoryId(v === 'income' ? 'other-income' : 'other');
              }}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
            <View style={{ height: 12 }} />
            <Field label="Amount" keyboardType="decimal-pad" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} />
            <T size={13} weight="600" style={{ marginBottom: 6 }}>
              Category
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {pool.map((c) => (
                <Chip key={c.id} cat={c} label={c.name} active={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
              ))}
            </View>
            <Field label="Merchant / source" value={merchant} onChangeText={setMerchant} />
            <Field label="Note" value={note} onChangeText={setNote} />
            <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <Button label="Delete" kind="danger" onPress={remove} />
              <View style={{ flex: 1 }} />
              <Button label="Cancel" kind="secondary" onPress={onClose} />
              <Button label="Save" onPress={save} disabled={!valid} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
