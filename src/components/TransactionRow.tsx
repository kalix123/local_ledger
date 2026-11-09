import React from 'react';
import { Pressable, View } from 'react-native';
import { CatIcon } from '../icons';
import { useCategory, useStore } from '../store';
import { Transaction } from '../types';
import { T, useP } from '../ui';
import { formatMoney } from '../utils';

export default function TransactionRow({ tx, onPress }: { tx: Transaction; onPress?: () => void }) {
  const p = useP();
  const { data } = useStore();
  const c = useCategory()(tx.categoryId);
  const title = tx.merchant || tx.note || c.name;
  const subtitle = [tx.merchant && tx.note ? tx.note : '', c.name].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <CatIcon cat={c} size={20} color={p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T weight="600" numberOfLines={1}>
          {title}
        </T>
        <T size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>
          {subtitle}
          {tx.source === 'ai' ? ' · AI' : ''}
        </T>
      </View>
      <T weight="700" color={tx.type === 'income' ? p.income : p.expense}>
        {formatMoney(tx.type === 'income' ? tx.amount : -tx.amount, data.settings.currency, { sign: true })}
      </T>
    </Pressable>
  );
}
