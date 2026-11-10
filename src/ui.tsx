import React from 'react';
import { Pressable, StyleProp, Switch, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { CatIcon, Icon, IconName } from './icons';
import { useStore } from './store';

export function useP() {
  return useStore().palette;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useP();
  return (
    <View style={[{ backgroundColor: p.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}

export function T({
  children,
  muted,
  size = 15,
  weight = '400',
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  muted?: boolean;
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const p = useP();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: color ?? (muted ? p.textMuted : p.text), fontSize: size, fontWeight: weight }, style]}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
      <T size={13} weight="700" muted style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {children}
      </T>
      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useP();
  const bg = kind === 'primary' ? p.accent : kind === 'danger' ? p.dangerBg : kind === 'secondary' ? p.surfaceAlt : 'transparent';
  const fg = kind === 'primary' ? p.accentText : kind === 'danger' ? p.danger : kind === 'ghost' ? p.accent : p.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: small ? 7 : 11,
          paddingHorizontal: small ? 12 : 16,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13 : 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
  icon,
  cat,
  trailing,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IconName;
  cat?: { icon: string; emoji: string };
  trailing?: IconName;
}) {
  const p = useP();
  const fg = active ? p.accentText : (color ?? p.text);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 6,
        paddingHorizontal: 11,
        borderRadius: 999,
        backgroundColor: active ? p.accent : p.surfaceAlt,
        borderWidth: 1,
        borderColor: active ? p.accent : p.border,
        opacity: pressed ? 0.7 : 1,
        marginRight: 6,
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      })}
    >
      {cat ? <CatIcon cat={cat} size={14} color={fg} /> : icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      {trailing ? <Icon name={trailing} size={12} color={fg} /> : null}
    </Pressable>
  );
}

export function ProgressBar({ value, max, height = 8, paceAt }: { value: number; max: number; height?: number; paceAt?: number }) {
  const p = useP();
  const ratio = max > 0 ? value / max : 0;
  const color = ratio >= 1 ? p.danger : ratio >= 0.8 ? p.warn : p.ok;
  return (
    <View style={{ height, borderRadius: height, backgroundColor: p.surfaceAlt, overflow: 'hidden', position: 'relative' }}>
      <View style={{ width: `${Math.min(ratio, 1) * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
      {paceAt !== undefined && paceAt > 0 && paceAt < 1 ? (
        <View style={{ position: 'absolute', left: `${paceAt * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: p.textMuted, opacity: 0.6 }} />
      ) : null}
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string; hint?: string }) {
  const p = useP();
  const { label, hint, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <T size={13} weight="600" style={{ marginBottom: 6 }}>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={p.textMuted}
        {...rest}
        style={[
          {
            backgroundColor: p.surfaceAlt,
            color: p.text,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            borderWidth: 1,
            borderColor: p.border,
            opacity: rest.editable === false ? 0.5 : 1,
          },
          style,
        ]}
      />
      {hint ? (
        <T size={12} muted style={{ marginTop: 5 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const p = useP();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T weight="600">{label}</T>
        {hint ? (
          <T size={12} muted style={{ marginTop: 2 }}>
            {hint}
          </T>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: p.accent, false: p.border }}
        thumbColor="#fff"
        {...({ activeThumbColor: '#fff' } as object)}
      />
    </View>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const p = useP();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: p.surfaceAlt, borderRadius: 12, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: active ? p.surface : 'transparent' }}
          >
            <Text style={{ color: active ? p.text : p.textMuted, fontWeight: '600', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Category icon + name, used anywhere a category is listed. */
export function CatLabel({ cat, weight = '600', flex, width }: { cat: { icon: string; emoji: string; name: string }; weight?: TextStyle['fontWeight']; flex?: boolean; width?: number }) {
  const p = useP();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, ...(flex ? { flex: 1 } : {}), ...(width ? { width } : {}) }}>
      <CatIcon cat={cat} size={16} color={p.accent} />
      <T weight={weight} numberOfLines={1} style={{ flexShrink: 1 }}>
        {cat.name}
      </T>
    </View>
  );
}

export function Divider() {
  const p = useP();
  return <View style={{ height: 1, backgroundColor: p.border, marginVertical: 8 }} />;
}
