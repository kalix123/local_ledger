import React from 'react';
import { Image, View } from 'react-native';
import { Icon } from '../icons';
import { useStore } from '../store';
import { APP_ICONS } from '../theme';
import { AppIconId } from '../types';

const LOGO = require('../../assets/logo.png');

/** The app's own logo for the default badge; supporter badges are drawn in the current icon style. */
export default function AppBadge({ id, size }: { id: AppIconId; size: number }) {
  const { palette: p } = useStore();
  if (id === 'coin' || !APP_ICONS[id]) {
    return <Image source={LOGO} style={{ width: size, height: size, borderRadius: size * 0.22 }} accessibilityLabel="Local Ledger" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={id} size={size * 0.6} color={p.accentText} />
    </View>
  );
}
