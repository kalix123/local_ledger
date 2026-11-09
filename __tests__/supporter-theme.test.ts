import { isValidSupporterCode, normalizeCode, sha256Hex, SUPPORTER_CODE_HASHES } from '../src/supporter';
import { APP_ICONS, contrast, customPalette, DEFAULT_CUSTOM_THEME, HEX_RE, mix, resolvePalette, THEMES } from '../src/theme';
import { ICON_PACKS, ICON_TABLE, isIconName, CATEGORY_ICON_CHOICES } from '../src/icons';
import { DEFAULT_CATEGORIES } from '../src/defaults';
import { CustomTheme } from '../src/types';

describe('supporter codes', () => {
  test.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    // 56 bytes: padding spills into a second block
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['localledger-supporter-v2:FT-VZ58-8C53', 'a5dcf5e90d35ad58a75f2309c762f15e1447ff758c091f2c23086d958dab2395'],
    ['localledger-supporter-v2:LL-ZPGD-JRXX-53G7', '6077a9b3655b224f242efcd14e7a7f840fbde2ac1a3a7a8e8366e866d09d140e'],
  ])('sha256(%p)', (input, hash) => {
    expect(sha256Hex(input)).toBe(hash);
  });

  test('sha256 of a million characters (published test vector)', () => {
    expect(sha256Hex('a'.repeat(1_000_000))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  test('sha256 handles non-ASCII as UTF-8', () => {
    // node: crypto.createHash('sha256').update('héllo 💰').digest('hex')
    expect(sha256Hex('héllo 💰')).toBe('574f8fdfeff1af855bcc22a7fef235ad5246e9322aa5ef9a3d0730ec2ca3e211');
  });

  test('the shipped codes unlock, however they are typed', () => {
    for (const c of ['LL-ZPGD-JRXX-53G7', 'll-zpgd-jrxx-53g7', '  LL-ZPGD-JRXX-53G7  ', 'LL-ZPGD -JRXX-53G7'.replace(' ', '')]) expect(isValidSupporterCode(c)).toBe(true);
  });

  test('the code given out before the rename (FT-) still unlocks', () => {
    for (const c of ['FT-VZ58-8C53', 'ft-vz58-8c53']) expect(isValidSupporterCode(c)).toBe(true);
  });

  test.each(['', 'FT-VZ58-8C54', 'LL-VZ58-8C53', 'LL-ZPGD-JRXX-53G8', 'XX-ZPGD-JRXX-53G7', 'FT-VZ58', 'VZ58-8C53', 'FT-AAAA-BBBB', 'FT-VZ58-8C53-XXXX', '6077a9b3655b224f242efcd14e7a7f840fbde2ac1a3a7a8e8366e866d09d140e', 'x'.repeat(10000)])(
    'rejects %p',
    (c) => {
      expect(isValidSupporterCode(c)).toBe(false);
    },
  );

  test('the code itself does not appear in the shipped hashes', () => {
    expect(SUPPORTER_CODE_HASHES.join()).not.toMatch(/(FT|LL)-/);
    for (const h of SUPPORTER_CODE_HASHES) expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test('normalizeCode', () => {
    expect(normalizeCode(' ll-ab cd-efgh ')).toBe('LL-ABCD-EFGH');
  });
});

describe('themes', () => {
  test('every built-in palette is readable (text vs background ≥ 4.5:1)', () => {
    for (const [id, t] of Object.entries(THEMES)) {
      expect([id, contrast(t.palette.text, t.palette.bg) >= 4.5]).toEqual([id, true]);
      expect([id, contrast(t.palette.text, t.palette.surface) >= 4.5]).toEqual([id, true]);
    }
  });

  test('supporter themes are refused without a code', () => {
    for (const [id, t] of Object.entries(THEMES)) {
      const p = resolvePalette(id as any, false, false);
      if (t.supporter) expect(p).not.toBe(t.palette);
      else expect(p).toBe(t.palette);
    }
    expect(resolvePalette('custom', false, false, { bg: '#FF0000', surface: '#FF0000', text: '#FF0000', accent: '#FF0000' }).bg).not.toBe('#FF0000');
  });

  test('system follows the device', () => {
    expect(resolvePalette('system', true, false).dark).toBe(true);
    expect(resolvePalette('system', false, false).dark).toBe(false);
  });

  test('an unknown theme id falls back instead of crashing', () => {
    expect(() => resolvePalette('neon' as any, false, true)).not.toThrow();
    expect(resolvePalette('neon' as any, false, true).bg).toMatch(/^#/);
  });

  test('custom palette derives every colour as valid hex', () => {
    const p = customPalette(DEFAULT_CUSTOM_THEME);
    for (const k of ['bg', 'surface', 'surfaceAlt', 'border', 'text', 'textMuted', 'accent', 'accentText'] as const) expect(p[k]).toMatch(HEX_RE);
  });

  test('custom palette survives junk input', () => {
    const junk: CustomTheme = { bg: 'red', surface: '', text: '#12', accent: 'javascript:alert(1)' };
    const p = customPalette(junk);
    for (const k of ['bg', 'surface', 'text', 'accent'] as const) expect(p[k]).toMatch(HEX_RE);
    expect(customPalette(undefined as any).bg).toMatch(HEX_RE);
  });

  test('button text picks the more readable of black/white', () => {
    expect(customPalette({ ...DEFAULT_CUSTOM_THEME, accent: '#FFFF00' }).accentText).toBe('#111111');
    expect(customPalette({ ...DEFAULT_CUSTOM_THEME, accent: '#000080' }).accentText).toBe('#FFFFFF');
  });

  test('light vs dark detection', () => {
    expect(customPalette({ ...DEFAULT_CUSTOM_THEME, bg: '#FFFFFF' }).dark).toBe(false);
    expect(customPalette({ ...DEFAULT_CUSTOM_THEME, bg: '#000000' }).dark).toBe(true);
  });

  test('colour helpers', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#123456', '#ABCDEF', 0)).toBe('#123456');
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1);
  });
});

describe('icons', () => {
  test('every default category and badge has an icon', () => {
    for (const c of DEFAULT_CATEGORIES) expect([c.id, isIconName(c.icon)]).toEqual([c.id, true]);
    for (const id of Object.keys(APP_ICONS)) if (id !== 'coin') expect(isIconName(id)).toBe(true);
    for (const id of CATEGORY_ICON_CHOICES) expect(isIconName(id)).toBe(true);
  });

  test('every icon exists in every pack', () => {
    const glyphs = [
      require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'),
      require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json'),
      require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'),
    ];
    for (const [name, row] of Object.entries(ICON_TABLE)) {
      glyphs.forEach((map, i) => expect([name, i, row[i] in map]).toEqual([name, i, true]));
      expect(row[3].length).toBeGreaterThan(0);
    }
  });

  test('free packs stay free', () => {
    expect(ICON_PACKS.icons.supporter).toBe(false);
    expect(ICON_PACKS.emoji.supporter).toBe(false);
  });

  test('isIconName rejects non-icons', () => {
    for (const x of ['', 'nope', null, undefined, 5, {}, 'constructor', '__proto__', 'toString']) expect(isIconName(x)).toBe(false);
  });
});
