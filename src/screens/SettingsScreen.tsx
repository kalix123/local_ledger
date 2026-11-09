import React, { useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { aiParseEntry, isCloud, isLocalUrl } from '../ai';
import AppBadge from '../components/AppBadge';
import { CATEGORY_ICON_CHOICES, emojiFor, Icon, ICON_PACKS, IconName } from '../icons';
import { AI_PRESETS, KOFI_URL } from '../defaults';
import { confirm, notify, pickTextFile, saveTextFile } from '../platform';
import { sanitize, useCategory, useStore } from '../store';
import { isValidSupporterCode, normalizeCode } from '../supporter';
import { APP_ICONS, contrast, DEFAULT_CUSTOM_THEME, HEX_RE, THEMES } from '../theme';
import { AIProvider, AppIconId, CustomTheme, IconPackId, ThemeId, TxType } from '../types';
import { Button, Card, CatLabel, Chip, Divider, Field, SectionTitle, Segmented, T, ToggleRow, useP } from '../ui';
import { toCSV, today } from '../utils';

export default function SettingsScreen() {
  const { advanced, updateSettings, data } = useStore();
  return (
    <View>
      <Card>
        <T weight="700" style={{ marginBottom: 10 }}>
          Mode
        </T>
        <Segmented
          value={data.settings.mode}
          onChange={(mode) => updateSettings({ mode })}
          options={[
            { value: 'basic', label: 'Basic' },
            { value: 'advanced', label: 'Advanced' },
          ]}
        />
        <T size={12} muted style={{ marginTop: 8 }}>
          {advanced
            ? 'Advanced unlocks merchant rules, custom categories, budget cycle, backups and optional AI.'
            : 'Basic keeps things simple: quick entry, budgets and a dashboard. Switch to Advanced for rules, backups and AI.'}
        </T>
      </Card>

      <PrivacyCard />
      <AppearanceSection />
      {advanced ? (
        <>
          <CycleSection />
          <RulesSection />
          <CategoriesSection />
          <AISection />
          <DataSection />
        </>
      ) : null}
      <SupporterSection />
    </View>
  );
}

function PrivacyCard() {
  const p = useP();
  return (
    <Card style={{ marginTop: 16, borderColor: p.ok }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="shield" size={18} color={p.ok} />
        <T weight="700">Your data stays on this device</T>
      </View>
      <T size={13} muted style={{ marginTop: 4, lineHeight: 19 }}>
        No account, no cloud sync, no analytics, no bank connections. Everything is stored locally and the app works fully offline. The only network
        requests ever made are to an AI endpoint you configure yourself in Advanced mode.
      </T>
    </Card>
  );
}

/* ------------------------------------------------------------ appearance */

const SUPPORTER_MSG = 'Unlock with a supporter code (see the bottom of Settings). Thank you!';
const PACK_PREVIEW: IconName[] = ['groceries', 'dining', 'transport', 'paycheck', 'calendar'];

function AppearanceSection() {
  const p = useP();
  const { data, updateSettings, isSupporter } = useStore();
  const themes: { id: ThemeId; label: string; locked: boolean }[] = [
    { id: 'system', label: 'System', locked: false },
    ...Object.entries(THEMES).map(([id, t]) => ({ id: id as ThemeId, label: t.label, locked: t.supporter && !isSupporter })),
    // Custom is only listed once a supporter code is entered.
    ...(isSupporter ? [{ id: 'custom' as ThemeId, label: 'Custom', locked: false }] : []),
  ];
  return (
    <>
      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <T weight="600" style={{ marginBottom: 8 }}>
          Theme
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {themes.map((t) => (
            <Chip
              key={t.id}
              icon={t.locked ? 'lock' : t.id === 'custom' ? 'palette' : undefined}
              label={t.label}
              active={data.settings.theme === t.id}
              onPress={() => (t.locked ? notify('Supporter theme', SUPPORTER_MSG) : updateSettings({ theme: t.id }))}
            />
          ))}
        </View>
        {data.settings.theme === 'custom' && isSupporter ? <CustomThemeEditor /> : null}

        <T weight="600" style={{ marginTop: 14, marginBottom: 8 }}>
          Icon style
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(ICON_PACKS) as IconPackId[]).map((id) => {
            const pack = ICON_PACKS[id];
            const locked = pack.supporter && !isSupporter;
            const active = data.settings.iconPack === id;
            return (
              <Pressable
                key={id}
                onPress={() => (locked ? notify('Supporter icon pack', SUPPORTER_MSG) : updateSettings({ iconPack: id }))}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: p.surfaceAlt,
                  borderWidth: 2,
                  borderColor: active ? p.accent : 'transparent',
                  opacity: locked ? 0.5 : 1,
                  minWidth: 140,
                  flexGrow: 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  {locked ? <Icon name="lock" size={13} color={p.textMuted} pack="icons" /> : null}
                  <T size={13} weight="700">
                    {pack.label}
                  </T>
                  {pack.supporter ? (
                    <T size={11} muted>
                      supporter
                    </T>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {PACK_PREVIEW.map((n) => (
                    <Icon key={n} name={n} size={18} color={p.accent} pack={id} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <T weight="600" style={{ marginTop: 14, marginBottom: 8 }}>
          App badge
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(Object.keys(APP_ICONS) as AppIconId[]).map((id) => {
            const locked = APP_ICONS[id].supporter && !isSupporter;
            return (
              <Pressable
                key={id}
                accessibilityLabel={`${APP_ICONS[id].label} badge`}
                onPress={() => (locked ? notify('Supporter badge', SUPPORTER_MSG) : updateSettings({ appIcon: id }))}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 14,
                  marginRight: 8,
                  marginBottom: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: p.surfaceAlt,
                  borderWidth: 2,
                  borderColor: data.settings.appIcon === id ? p.accent : 'transparent',
                  opacity: locked ? 0.45 : 1,
                }}
              >
                <AppBadge id={id} size={32} />
                {locked ? (
                  <View style={{ position: 'absolute', right: 3, bottom: 3 }}>
                    <Icon name="lock" size={12} color={p.text} pack="icons" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Divider />
        <Field
          label="Currency symbol"
          value={data.settings.currency}
          maxLength={4}
          onChangeText={(currency) => updateSettings({ currency })}
          style={{ width: 90 }}
        />
      </Card>
    </>
  );
}

const CUSTOM_FIELDS: { key: keyof CustomTheme; label: string; hint: string; presets: string[] }[] = [
  { key: 'bg', label: 'Background', hint: 'Behind everything', presets: ['#0B0B12', '#101418', '#0E1A2B', '#1B1B1F', '#F5F6F8', '#FFF8F0', '#EEF4F1', '#F4EFE6'] },
  { key: 'surface', label: 'Cards', hint: 'Panels, rows and the tab bar', presets: ['#14141F', '#1A2026', '#1A2740', '#26262C', '#FFFFFF', '#FBF8F2', '#E8F0EC', '#2A1E2E'] },
  { key: 'text', label: 'Text', hint: 'Main text; muted text is derived', presets: ['#FFFFFF', '#ECEFF3', '#E8E2D0', '#15181D', '#2E2A24', '#1D2B36'] },
  { key: 'accent', label: 'Accent', hint: 'Buttons, highlights, icons', presets: ['#14A394', '#5B8CFF', '#A78BFA', '#F06A3B', '#E5487A', '#F2C14E', '#22A35A', '#7A5C3E'] },
];

function CustomThemeEditor() {
  const p = useP();
  const { data, updateSettings } = useStore();
  const ct = data.settings.customTheme;
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const set = (key: keyof CustomTheme, value: string) => {
    let v = value.trim();
    if (v && !v.startsWith('#')) v = '#' + v;
    setDrafts((d) => ({ ...d, [key]: v }));
    if (HEX_RE.test(v)) updateSettings({ customTheme: { ...ct, [key]: v.toUpperCase() } });
  };

  const textOnBg = contrast(ct.text, ct.bg);
  const textOnCard = contrast(ct.text, ct.surface);
  const lowContrast = Math.min(textOnBg, textOnCard) < 4.5;

  return (
    <View style={{ marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: p.border, backgroundColor: p.bg }}>
      <T size={13} muted style={{ marginBottom: 10 }}>
        Pick four colours; borders, muted text and button text are worked out for you.
      </T>
      {CUSTOM_FIELDS.map((f) => {
        const draft = drafts[f.key] ?? ct[f.key];
        const invalid = !HEX_RE.test(draft);
        return (
          <View key={f.key} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: ct[f.key], borderWidth: 1, borderColor: p.border }} />
              <View style={{ flex: 1 }}>
                <T weight="600">{f.label}</T>
                <T size={11} muted>
                  {f.hint}
                </T>
              </View>
              <TextInput
                value={draft}
                onChangeText={(v) => set(f.key, v)}
                onBlur={() => setDrafts((d) => ({ ...d, [f.key]: ct[f.key] }))}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                accessibilityLabel={`${f.label} colour hex`}
                style={{
                  width: 92,
                  color: p.text,
                  backgroundColor: p.surfaceAlt,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: invalid ? p.danger : p.border,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  fontSize: 14,
                  fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 40 }}>
              {f.presets.map((c) => (
                <Pressable
                  key={c}
                  accessibilityLabel={`Use ${c} for ${f.label}`}
                  onPress={() => set(f.key, c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: c,
                    borderWidth: 2,
                    borderColor: ct[f.key].toUpperCase() === c.toUpperCase() ? p.accent : p.border,
                  }}
                />
              ))}
            </View>
          </View>
        );
      })}
      {lowContrast ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon name="warning" size={14} color={p.warn} pack="icons" />
          <T size={12} color={p.warn} style={{ flex: 1 }}>
            Text may be hard to read (contrast {Math.min(textOnBg, textOnCard).toFixed(1)}:1; aim for 4.5:1 or more).
          </T>
        </View>
      ) : null}
      <Button
        label="Reset colours"
        kind="ghost"
        small
        style={{ alignSelf: 'flex-start' }}
        onPress={() => {
          setDrafts({});
          updateSettings({ customTheme: { ...DEFAULT_CUSTOM_THEME } });
        }}
      />
    </View>
  );
}

/* ----------------------------------------------------------------- cycle */

function CycleSection() {
  const { data, updateSettings } = useStore();
  const [v, setV] = useState(String(data.settings.cycleStartDay));
  return (
    <>
      <SectionTitle>Budget cycle</SectionTitle>
      <Card>
        <Field
          label="Cycle starts on day"
          value={v}
          keyboardType="number-pad"
          onChangeText={(s) => {
            setV(s.replace(/\D/g, ''));
            const n = parseInt(s, 10);
            if (n >= 1 && n <= 28) updateSettings({ cycleStartDay: n });
          }}
          hint="1–28. Set this to your payday if you budget paycheck-to-paycheck."
          style={{ width: 90 }}
        />
      </Card>
    </>
  );
}

/* ----------------------------------------------------------------- rules */

function RulesSection() {
  const p = useP();
  const { data, addRule, deleteRule } = useStore();
  const cat = useCategory();
  const [match, setMatch] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('groceries');
  const add = () => {
    if (!match.trim()) return;
    addRule({ match: match.trim().toLowerCase(), merchant: merchant.trim() || match.trim(), categoryId });
    setMatch('');
    setMerchant('');
  };
  return (
    <>
      <SectionTitle>Merchant rules</SectionTitle>
      <Card>
        <T size={13} muted style={{ marginBottom: 10 }}>
          When an entry contains the text, use this merchant name and category. Rules beat the built-in dictionary. Correcting a category in the quick-entry
          preview also creates one.
        </T>
        {data.rules.length ? (
          data.rules.map((r) => {
            const c = cat(r.categoryId);
            return (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.border }}>
                <View style={{ flex: 1 }}>
                  <T weight="600">“{r.match}”</T>
                  <T size={12} muted>
                    → {r.merchant} · {c.name}
                  </T>
                </View>
                <Button label="Remove" kind="ghost" small onPress={() => deleteRule(r.id)} />
              </View>
            );
          })
        ) : (
          <T muted size={13}>
            No rules yet.
          </T>
        )}
        <View style={{ height: 14 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="If text contains" placeholder="e.g. joe's" value={match} onChangeText={setMatch} autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Merchant name" placeholder="Joe's Diner" value={merchant} onChangeText={setMerchant} />
          </View>
        </View>
        <T size={13} weight="600" style={{ marginBottom: 6 }}>
          File under
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {data.categories.map((c) => (
            <Chip key={c.id} cat={c} label={c.name} active={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>
        <Button label="Add rule" onPress={add} disabled={!match.trim()} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------ categories */

function CategoriesSection() {
  const p = useP();
  const { data, addCategory, deleteCategory } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>('tag');
  const [emoji, setEmoji] = useState('');
  const [kind, setKind] = useState<TxType>('expense');
  const [keywords, setKeywords] = useState('');
  const protectedIds = new Set(['other', 'other-income']);
  const add = () => {
    if (!name.trim()) return;
    addCategory({
      name: name.trim(),
      icon,
      emoji: emoji.trim() || emojiFor(icon),
      kind,
      keywords: keywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    });
    setName('');
    setKeywords('');
    setEmoji('');
    setIcon('tag');
  };
  const remove = async (id: string, label: string) => {
    if (await confirm(`Delete “${label}”?`, 'Its transactions move to Other. Budgets for it are removed.', 'Delete', true)) deleteCategory(id);
  };
  return (
    <>
      <SectionTitle>Categories</SectionTitle>
      <Card>
        {data.categories.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: p.border }}>
            <View style={{ flex: 1 }}>
              <CatLabel cat={c} weight="400" />
              <T size={12} muted style={{ marginLeft: 24 }}>
                {c.kind}
                {c.keywords.length ? ` · ${c.keywords.slice(0, 4).join(', ')}${c.keywords.length > 4 ? '…' : ''}` : ''}
              </T>
            </View>
            {protectedIds.has(c.id) ? null : <Button label="Delete" kind="ghost" small onPress={() => remove(c.id, c.name)} />}
          </View>
        ))}
        <View style={{ height: 14 }} />
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
        <View style={{ height: 10 }} />
        <Field label="Name" placeholder="Pets" value={name} onChangeText={setName} />
        <T size={13} weight="600" style={{ marginBottom: 6 }}>
          Icon
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {CATEGORY_ICON_CHOICES.map((n) => (
            <Pressable
              key={n}
              accessibilityLabel={`${n} icon`}
              onPress={() => setIcon(n)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: icon === n ? p.accent : p.surfaceAlt,
              }}
            >
              <Icon name={n} size={20} color={icon === n ? p.accentText : p.text} />
            </Pressable>
          ))}
        </View>
        <Field
          label="Emoji (optional, used with the Emoji icon style)"
          placeholder={emojiFor(icon)}
          value={emoji}
          onChangeText={setEmoji}
          maxLength={4}
          style={{ width: 90 }}
        />
        <Field label="Keywords (comma separated)" placeholder="vet, dog food, petco" value={keywords} onChangeText={setKeywords} autoCapitalize="none" />
        <Button label="Add category" onPress={add} disabled={!name.trim()} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------- AI */

function AISection() {
  const p = useP();
  const { data, updateAI } = useStore();
  const ai = data.settings.ai;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const cloud = isCloud(ai);

  const pickProvider = (provider: AIProvider) => {
    if (provider === 'none') return updateAI({ provider });
    const preset = AI_PRESETS[provider];
    updateAI({ provider, baseUrl: preset.baseUrl, model: preset.model, cloudRiskAcknowledged: false });
    setTestResult('');
  };

  const test = async () => {
    setTesting(true);
    setTestResult('');
    try {
      const r = await aiParseEntry(ai, 'grabbed lunch at the taco truck for 12 bucks', data.categories);
      setTestResult(`Connected. Test parse: ${r.type} ${r.amount ?? '?'} → ${r.categoryId}`);
    } catch (e: any) {
      setTestResult(`Error: ${e?.message ?? 'Failed'}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <SectionTitle>AI assist (optional, bring your own)</SectionTitle>
      <Card>
        <T size={13} muted style={{ marginBottom: 10, lineHeight: 19 }}>
          The built-in parser handles most entries offline. Optionally connect a model to interpret messy text and write monthly summaries. Off by default.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip label="Off" active={ai.provider === 'none'} onPress={() => pickProvider('none')} />
          <Chip icon="local" label="Ollama (local)" active={ai.provider === 'ollama'} onPress={() => pickProvider('ollama')} />
          <Chip label="OpenAI-compatible" active={ai.provider === 'openai'} onPress={() => pickProvider('openai')} />
          <Chip label="Anthropic" active={ai.provider === 'anthropic'} onPress={() => pickProvider('anthropic')} />
        </View>

        {ai.provider !== 'none' ? (
          <>
            {/* The unmissable warning. Always shown for any non-local endpoint. */}
            {cloud ? (
              <View style={{ backgroundColor: p.dangerBg, borderColor: p.danger, borderWidth: 2, borderRadius: 12, padding: 14, marginVertical: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="warning" size={20} color={p.danger} pack="icons" />
                  <T weight="800" color={p.danger} size={16} style={{ flex: 1 }}>
                    Privacy warning: this is a cloud AI service
                  </T>
                </View>
                <T color={p.danger} size={13} style={{ marginTop: 6, lineHeight: 19 }}>
                  We strongly advise against sending financial data to publicly hosted LLMs. Anything you send to {hostOf(ai.baseUrl)} leaves your device and
                  is governed by that company&apos;s retention and training policies, not ours. It may be logged, reviewed by humans, or kept indefinitely.
                </T>
                <T color={p.danger} size={13} style={{ marginTop: 6, lineHeight: 19 }}>
                  Safer: run a model locally with Ollama or LM Studio and point this at localhost or your LAN.
                </T>
                <View style={{ marginTop: 8 }}>
                  <ToggleRow
                    label="I understand the risk and still want to use a cloud model"
                    value={ai.cloudRiskAcknowledged}
                    onChange={(v) => updateAI({ cloudRiskAcknowledged: v })}
                  />
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: p.surfaceAlt, borderRadius: 12, padding: 12, marginVertical: 12, borderLeftWidth: 4, borderLeftColor: p.ok }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="local" size={16} color={p.ok} />
                  <T weight="700">Local endpoint</T>
                </View>
                <T size={12} muted style={{ marginTop: 4, lineHeight: 18 }}>
                  {hostOf(ai.baseUrl) || 'This host'} is on your own machine/network, so entries never leave it. On a phone, use your computer&apos;s LAN IP (e.g.
                  http://192.168.1.20:11434). For the web build, start Ollama with OLLAMA_ORIGINS=&quot;*&quot; so the browser may call it.
                </T>
              </View>
            )}

            <Field label="Endpoint URL" value={ai.baseUrl} onChangeText={(baseUrl) => updateAI({ baseUrl })} autoCapitalize="none" autoCorrect={false} />
            <Field label="Model" value={ai.model} onChangeText={(model) => updateAI({ model })} autoCapitalize="none" autoCorrect={false} />
            <Field
              label={`API key${ai.provider === 'ollama' || isLocalUrl(ai.baseUrl) ? ' (usually not needed locally)' : ''}`}
              value={ai.apiKey}
              onChangeText={(apiKey) => updateAI({ apiKey })}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!cloud || ai.cloudRiskAcknowledged}
              hint="Stored only on this device, inside the app's local storage. It is included in JSON backups only if you choose to."
            />
            <ToggleRow
              label="Use AI for unclear entries"
              hint="When the offline parser can't find an amount or category, ask the model before saving. You always confirm the result."
              value={ai.useForUnclearEntries}
              onChange={(v) => updateAI({ useForUnclearEntries: v })}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 }}>
              <Button label={testing ? 'Testing…' : 'Test connection'} kind="secondary" small onPress={test} disabled={testing || (cloud && !ai.cloudRiskAcknowledged)} />
            </View>
            {testResult ? (
              <T size={13} color={testResult.startsWith('Connected') ? p.ok : p.danger} style={{ marginTop: 8 }}>
                {testResult}
              </T>
            ) : null}
          </>
        ) : null}
      </Card>
    </>
  );
}

function hostOf(url: string) {
  return url.replace(/^https?:\/\//i, '').split('/')[0];
}

/* ------------------------------------------------------------------ data */

function DataSection() {
  const { data, replaceAll, wipe } = useStore();
  const [includeKey, setIncludeKey] = useState(false);

  const exportJSON = async () => {
    const copy = { ...data, settings: { ...data.settings, ai: { ...data.settings.ai, apiKey: includeKey ? data.settings.ai.apiKey : '' } } };
    await saveTextFile(`local-ledger-backup-${today()}.json`, JSON.stringify(copy, null, 2), 'application/json');
  };
  const exportCSV = () => saveTextFile(`local-ledger-transactions-${today()}.csv`, toCSV(data), 'text/csv');
  const importJSON = async () => {
    try {
      const text = await pickTextFile();
      if (!text) return;
      const next = sanitize(JSON.parse(text));
      const ok = await confirm(
        'Replace all data?',
        `Import ${next.transactions.length} transactions, ${next.categories.length} categories and ${next.rules.length} rules. This replaces everything currently in the app.`,
        'Replace',
        true,
      );
      if (!ok) return;
      if (!next.settings.ai.apiKey) next.settings.ai.apiKey = data.settings.ai.apiKey;
      replaceAll(next);
      notify('Backup restored', `${next.transactions.length} transactions imported.`);
    } catch (e: any) {
      notify('Import failed', e?.message ?? 'That file is not a valid backup.');
    }
  };
  const doWipe = async () => {
    if (await confirm('Erase everything?', 'All transactions, budgets, rules and settings on this device will be permanently deleted. Export a backup first if unsure.', 'Erase', true))
      wipe();
  };

  return (
    <>
      <SectionTitle>Backup & data</SectionTitle>
      <Card>
        <T size={13} muted style={{ marginBottom: 10, lineHeight: 19 }}>
          {data.transactions.length} transactions on this device. Backups are plain JSON files you own — store them wherever you like.
        </T>
        <ToggleRow label="Include AI API key in backup" value={includeKey} onChange={setIncludeKey} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <Button label="Export backup (.json)" onPress={exportJSON} />
          <Button label="Export CSV" kind="secondary" onPress={exportCSV} />
          <Button label="Import backup…" kind="secondary" onPress={importJSON} />
        </View>
        <Divider />
        <Button label="Erase all data" kind="danger" onPress={doWipe} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------- supporter */

function SupporterSection() {
  const p = useP();
  const { data, updateSettings, isSupporter } = useStore();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const redeem = () => {
    if (isValidSupporterCode(code)) {
      updateSettings({ supporterCode: normalizeCode(code) });
      setCode('');
      setErr('');
    } else setErr("That code doesn't look right — check for typos (it starts with LL-).");
  };
  return (
    <>
      <SectionTitle>Supporter perks</SectionTitle>
      <Card>
        {isSupporter ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="heart" size={18} color={p.accent} />
              <T weight="700">Thanks for supporting Local Ledger!</T>
            </View>
            <T size={13} muted style={{ marginTop: 4 }}>
              Supporter themes and badges are unlocked. Code {data.settings.supporterCode} is checked offline — nothing is sent anywhere.
            </T>
            <Button
              label="Remove code"
              kind="ghost"
              small
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
              onPress={() => {
                const t = data.settings.theme;
                const lockedTheme = t === 'custom' || (t !== 'system' && THEMES[t].supporter);
                updateSettings({
                  supporterCode: '',
                  theme: lockedTheme ? 'system' : t,
                  iconPack: ICON_PACKS[data.settings.iconPack].supporter ? 'icons' : data.settings.iconPack,
                  appIcon: 'coin',
                });
              }}
            />
          </>
        ) : (
          <>
            <T size={13} muted style={{ marginBottom: 10, lineHeight: 19 }}>
              Local Ledger is free with no ads or tracking. If it helps you, a coffee on Ko-fi keeps it going — supporters get a code that unlocks extra themes and
              badges, validated entirely offline.
            </T>
            <Field placeholder="LL-XXXX-XXXX" maxLength={24} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} onSubmitEditing={redeem} />
            {err ? (
              <T size={12} color={p.danger} style={{ marginTop: -6, marginBottom: 8 }}>
                {err}
              </T>
            ) : null}
            <Button label="Unlock" onPress={redeem} disabled={!code.trim()} style={{ alignSelf: 'flex-start' }} />
          </>
        )}
      </Card>
    </>
  );
}

export function KofiFooter() {
  const p = useP();
  return (
    <Pressable onPress={() => Linking.openURL(KOFI_URL)} style={{ alignItems: 'center', paddingVertical: 24 }} accessibilityRole="link">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <T size={12} muted>
          Made with care, offline.
        </T>
        <Icon name="coffee" size={14} color={p.accent} />
        <Text style={{ color: p.accent, fontWeight: '600', fontSize: 12 }}>Support on Ko-fi</Text>
      </View>
    </Pressable>
  );
}
