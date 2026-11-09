/**
 * One icon vocabulary, several looks. Screens ask for a semantic name ("groceries", "calendar")
 * and the user's chosen pack decides how it is drawn:
 *   icons (default, free) → Ionicons outline
 *   emoji (free)          → emoji characters
 *   line  (supporter)     → Feather
 *   bold  (supporter)     → Material Community
 */
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text } from 'react-native';
import { useStore } from './store';
import { IconPackId } from './types';

//            semantic name      Ionicons                   Feather              Material Community           emoji
const TABLE = {
  // navigation + UI
  home:            ['home-outline',             'home',              'home-variant-outline',      '🏠'],
  history:         ['receipt-outline',          'list',              'receipt',                   '🧾'],
  budgets:         ['pie-chart-outline',        'pie-chart',         'chart-donut',               '🎯'],
  settings:        ['settings-outline',         'settings',          'cog-outline',               '⚙️'],
  edit:            ['create-outline',           'edit-3',            'pencil-outline',            '✏️'],
  enter:           ['return-down-back',         'corner-down-left',  'keyboard-return',           '↵'],
  calendar:        ['calendar-outline',         'calendar',          'calendar-blank-outline',    '📅'],
  lock:            ['lock-closed',              'lock',              'lock',                      '🔒'],
  warning:         ['warning',                  'alert-triangle',    'alert',                     '⚠️'],
  shield:          ['shield-checkmark-outline', 'shield',            'shield-check-outline',      '🛡️'],
  sparkle:         ['sparkles',                 'zap',               'creation',                  '✨'],
  check:           ['checkmark',                'check',             'check',                     '✓'],
  'checkbox-on':   ['checkbox',                 'check-square',      'checkbox-marked',           '☑'],
  'checkbox-off':  ['square-outline',           'square',            'checkbox-blank-outline',    '☐'],
  coffee:          ['cafe-outline',             'coffee',            'coffee-outline',            '☕'],
  local:           ['desktop-outline',          'monitor',           'monitor',                   '🏠'],
  cloud:           ['cloud-outline',            'cloud',             'cloud-outline',             '☁️'],
  heart:           ['heart',                    'heart',             'heart',                     '💛'],
  'chevron-left':  ['chevron-back',             'chevron-left',      'chevron-left',              '‹'],
  'chevron-right': ['chevron-forward',          'chevron-right',     'chevron-right',             '›'],
  'chevron-down':  ['chevron-down',             'chevron-down',      'chevron-down',              '▾'],
  expense:         ['arrow-up',                 'arrow-up-right',    'arrow-top-right',           '↑'],
  income:          ['arrow-down',               'arrow-down-left',   'arrow-bottom-left',         '↓'],
  store:           ['storefront-outline',       'map-pin',           'store-outline',             '🏪'],
  search:          ['search',                   'search',            'magnify',                   '🔍'],
  palette:         ['color-palette-outline',    'droplet',           'palette-outline',           '🎨'],
  data:            ['server-outline',           'database',          'database-outline',          '💾'],
  // categories
  groceries:       ['cart-outline',             'shopping-cart',     'cart-outline',              '🛒'],
  dining:          ['restaurant-outline',       'coffee',            'silverware-fork-knife',     '🍔'],
  transport:       ['car-outline',              'truck',             'car-outline',               '🚗'],
  housing:         ['bed-outline',              'home',              'home-city-outline',         '🏠'],
  utilities:       ['bulb-outline',             'zap',               'lightbulb-outline',         '💡'],
  shopping:        ['bag-handle-outline',       'shopping-bag',      'shopping-outline',          '🛍️'],
  entertainment:   ['game-controller-outline',  'film',              'gamepad-variant-outline',   '🎮'],
  health:          ['medkit-outline',           'activity',          'medical-bag',               '💊'],
  other:           ['cube-outline',             'box',               'package-variant',           '📦'],
  paycheck:        ['briefcase-outline',        'briefcase',         'briefcase-outline',         '💼'],
  side:            ['star-outline',             'star',              'star-outline',              '✨'],
  'other-income':  ['cash-outline',             'dollar-sign',       'cash',                      '💰'],
  tag:             ['pricetag-outline',         'tag',               'tag-outline',               '🏷️'],
  pet:             ['paw-outline',              'github',            'paw',                       '🐾'],
  gift:            ['gift-outline',             'gift',              'gift-outline',              '🎁'],
  education:       ['school-outline',           'book-open',         'school-outline',            '📚'],
  travel:          ['airplane-outline',         'navigation',        'airplane',                  '✈️'],
  phone:           ['phone-portrait-outline',   'smartphone',        'cellphone',                 '📱'],
  fitness:         ['barbell-outline',          'activity',          'dumbbell',                  '🏋️'],
  music:           ['musical-notes-outline',    'music',             'music',                     '🎵'],
  tools:           ['construct-outline',        'tool',              'wrench-outline',            '🔧'],
  kids:            ['happy-outline',            'smile',             'baby-face-outline',         '🧸'],
  // supporter badges
  leaf:            ['leaf-outline',             'feather',           'leaf',                      '🌿'],
  rocket:          ['rocket-outline',           'send',              'rocket-launch-outline',     '🚀'],
  gem:             ['diamond-outline',          'hexagon',           'diamond-stone',             '💎'],
  cat:             ['paw',                      'smile',             'cat',                       '🐈'],
} as const;

export type IconName = keyof typeof TABLE;
export const ICON_TABLE = TABLE as Record<IconName, readonly [string, string, string, string]>;

/** Icons a user can pick for their own categories. */
export const CATEGORY_ICON_CHOICES: IconName[] = [
  'tag', 'groceries', 'dining', 'coffee', 'transport', 'travel', 'housing', 'utilities', 'phone', 'shopping', 'gift',
  'entertainment', 'music', 'health', 'fitness', 'pet', 'kids', 'education', 'tools', 'paycheck', 'side', 'other-income',
];

export const ICON_PACKS: Record<IconPackId, { label: string; supporter: boolean }> = {
  icons: { label: 'Icons', supporter: false },
  emoji: { label: 'Emoji', supporter: false },
  line: { label: 'Line', supporter: true },
  bold: { label: 'Bold', supporter: true },
};

export function emojiFor(name: IconName): string {
  return ICON_TABLE[name]?.[3] ?? '🏷️';
}

export function isIconName(s: unknown): s is IconName {
  // hasOwnProperty, not `in`: "toString"/"constructor" must not count as icons.
  return typeof s === 'string' && Object.prototype.hasOwnProperty.call(TABLE, s);
}

/** A category's icon (uses the category's own emoji in emoji mode). */
export function CatIcon({ cat, size = 18, color }: { cat: { icon: string; emoji: string }; size?: number; color?: string }) {
  return <Icon name={isIconName(cat.icon) ? cat.icon : 'tag'} emoji={cat.emoji} size={size} color={color} />;
}

/** Draw a semantic icon in the user's pack. `emoji` overrides the emoji used in emoji mode (custom categories). */
export function Icon({ name, size = 18, color, emoji, pack }: { name: IconName; size?: number; color?: string; emoji?: string; pack?: IconPackId }) {
  const { data, palette, isSupporter } = useStore();
  let p = pack ?? data.settings.iconPack;
  // An explicit `pack` (e.g. the picker's previews) is always honoured; the saved setting falls back if locked.
  if (!pack && ICON_PACKS[p]?.supporter && !isSupporter) p = 'icons';
  const row = ICON_TABLE[name] ?? ICON_TABLE.tag;
  const c = color ?? palette.text;
  if (p === 'emoji') return <Text style={{ fontSize: size * 0.95, lineHeight: size * 1.15, textAlign: 'center' }}>{emoji || row[3]}</Text>;
  if (p === 'line') return <Feather name={row[1] as any} size={size} color={c} />;
  if (p === 'bold') return <MaterialCommunityIcons name={row[2] as any} size={size} color={c} />;
  return <Ionicons name={row[0] as any} size={size} color={c} />;
}
