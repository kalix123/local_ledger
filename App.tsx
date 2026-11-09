import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import BudgetsScreen from './src/screens/BudgetsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import HomeScreen, { Tab } from './src/screens/HomeScreen';
import SettingsScreen, { KofiFooter } from './src/screens/SettingsScreen';
import { StoreProvider, useStore } from './src/store';
import AppBadge from './src/components/AppBadge';
import { Icon, IconName } from './src/icons';
import { T } from './src/ui';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'budgets', label: 'Budgets', icon: 'budgets' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const TITLES: Record<Tab, string> = { home: 'Local Ledger', history: 'History', budgets: 'Budgets', settings: 'Settings' };

function Shell() {
  const { palette: p, ready, data, advanced, loadError } = useStore();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (Platform.OS === 'web') document.body.style.backgroundColor = p.bg;
  }, [p.bg]);

  const go = (t: Tab) => {
    setTab(t);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <StatusBar style={p.dark ? 'light' : 'dark'} />
      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <View style={{ marginRight: 10 }}>
          <AppBadge id={data.settings.appIcon} size={30} />
        </View>
        <T size={24} weight="800" style={{ flex: 1, letterSpacing: -0.4 }}>
          {TITLES[tab]}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.ok, marginRight: 6 }} />
          <T size={12} muted weight="600">
            Offline{advanced ? ' · Advanced' : ''}
          </T>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
          <View style={{ width: '100%', maxWidth: 688, alignSelf: 'center' }}>
            {loadError ? (
              <View accessibilityRole="alert" style={{ backgroundColor: p.surface, borderColor: p.danger, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="warning" size={18} color={p.danger} pack="icons" />
                  <T weight="700">{"Couldn't read your saved data"}</T>
                </View>
                <T size={13} muted style={{ marginTop: 4, lineHeight: 19 }}>
                  To protect it, nothing will be saved until you restart the app. If this keeps happening, restore a backup or reset in Settings → Data.
                </T>
              </View>
            ) : null}
            {tab === 'home' && <HomeScreen go={go} />}
            {tab === 'history' && <HistoryScreen />}
            {tab === 'budgets' && <BudgetsScreen />}
            {tab === 'settings' && <SettingsScreen />}
            <KofiFooter />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ backgroundColor: p.surface, borderTopWidth: 1, borderTopColor: p.border, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Pressable
                key={t.id}
                onPress={() => go(t.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 9 }}
              >
                <View style={{ opacity: active ? 1 : 0.6 }}>
                  <Icon name={t.icon} size={22} color={active ? p.accent : p.textMuted} />
                </View>
                <Text style={{ fontSize: 11, marginTop: 2, fontWeight: active ? '700' : '500', color: active ? p.accent : p.textMuted }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Last line of defence: a render bug shows a recoverable screen instead of a blank app. Data on disk is untouched. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('Local Ledger crashed', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#101418' }}>
        <Text style={{ color: '#ECEFF3', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
        <Text style={{ color: '#9AA5B1', textAlign: 'center', marginBottom: 16 }}>Your data is safe on this device. Try again, and if it keeps happening, export a backup from Settings.</Text>
        <Pressable onPress={() => this.setState({ error: null })} accessibilityRole="button" style={{ backgroundColor: '#14A394', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
