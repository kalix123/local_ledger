import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { TextInput } from 'react-native';
import App from '../App';
import { HISTORY_PAGE } from '../src/screens/HistoryScreen';
import { CHUNK_PREFIX, loadRaw, META_KEY, resetStorageCache, save } from '../src/storage';
import { sanitize } from '../src/sanitize';
import { AppData } from '../src/types';
import { makeData } from './helpers';

const fetchMock = global.fetch as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetStorageCache();
  fetchMock.mockClear();
});

afterEach(() => {
  // The whole app must work without a single network request.
  expect(fetchMock).not.toHaveBeenCalled();
});

async function renderApp() {
  await render(<App />);
  await screen.findByLabelText('Describe a transaction');
}

async function stored(): Promise<AppData> {
  // Let the debounced save run, then read what's actually on disk.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
  resetStorageCache();
  return sanitize((await loadRaw())!.data);
}

async function addEntry(text: string) {
  const input = screen.getByLabelText('Describe a transaction');
  await fireEvent.changeText(input, text);
  await fireEvent(input, 'submitEditing');
}

describe('first launch', () => {
  test('starts empty and offline', async () => {
    await renderApp();
    expect(screen.getByText(/Offline/)).toBeTruthy();
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  });
});

describe('quick entry', () => {
  test('adds a transaction from plain English and saves it', async () => {
    await renderApp();
    await addEntry('spent 10.50 at WinCo on ice cream');
    expect(await screen.findByText(/Logged \$10\.50 · Groceries/)).toBeTruthy();
    const d = await stored();
    expect(d.transactions).toHaveLength(1);
    expect(d.transactions[0]).toMatchObject({ amount: 10.5, merchant: 'WinCo', categoryId: 'groceries', note: 'ice cream', source: 'parser' });
  });

  test('income is added as income', async () => {
    await renderApp();
    await addEntry('just got paid for work 135 plus 20 in tips');
    expect(await screen.findByText(/Added income \$155\.00/)).toBeTruthy();
  });

  test('undo removes the entry and puts the text back', async () => {
    await renderApp();
    await addEntry('coffee 4');
    await fireEvent.press(await screen.findByText('Undo'));
    expect(screen.getByLabelText('Describe a transaction').props.value).toBe('coffee 4');
    expect((await stored()).transactions).toHaveLength(0);
  });

  test('entry without an amount asks for one instead of saving', async () => {
    await renderApp();
    await addEntry('bought a thing at the store');
    expect(await screen.findByPlaceholderText('Amount')).toBeTruthy();
    expect((await stored()).transactions).toHaveLength(0);
  });

  test('empty input does nothing', async () => {
    await renderApp();
    await addEntry('   ');
    expect((await stored()).transactions).toHaveLength(0);
  });

  test('100 rapid entries are all kept', async () => {
    await renderApp();
    for (let i = 1; i <= 100; i++) await addEntry(`snack ${i}`);
    const d = await stored();
    expect(d.transactions).toHaveLength(100);
    expect(d.transactions.reduce((s, t) => s + t.amount, 0)).toBe(5050);
  });
});

describe('persistence', () => {
  test('data survives an app restart', async () => {
    await renderApp();
    await addEntry('rent 1,250');
    await stored();
    await screen.unmount();
    resetStorageCache();
    await renderApp();
    expect((await screen.findAllByText('$1,250.00')).length).toBeGreaterThan(0);
  });

  test('an entry made right before the app closes is still saved', async () => {
    await renderApp();
    await addEntry('coffee 4');
    await screen.unmount(); // before the 250 ms save delay runs out
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    resetStorageCache();
    expect(sanitize((await loadRaw())!.data).transactions).toHaveLength(1);
  });

  test('corrupted storage shows a warning and is NOT overwritten', async () => {
    await AsyncStorage.setItem(META_KEY, '{"broken json');
    await renderApp();
    expect(await screen.findByText("Couldn't read your saved data")).toBeTruthy();
    await addEntry('coffee 4');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(await AsyncStorage.getItem(META_KEY)).toBe('{"broken json');
  });
});

describe('large data', () => {
  test('opens quickly with 20,000 transactions and pages the history', async () => {
    const big = makeData(20_000);
    await save(big);
    resetStorageCache();

    const t0 = Date.now();
    await renderApp();
    const loadMs = Date.now() - t0;
    expect(loadMs).toBeLessThan(5000);

    await fireEvent.press(screen.getByText('History'));
    await fireEvent.press(screen.getByText('All time'));
    expect(await screen.findByText(/20,000 entries/)).toBeTruthy();
    // Only one page of rows is mounted, with a button for the rest.
    expect(screen.getByText(`Show more (${(20_000 - HISTORY_PAGE).toLocaleString('en-US')} older)`)).toBeTruthy();
    await fireEvent.press(screen.getByText(/Show more/));
    expect(screen.getByText(`Show more (${(20_000 - 2 * HISTORY_PAGE).toLocaleString('en-US')} older)`)).toBeTruthy();
  });

  test('searching 20,000 transactions', async () => {
    await save(makeData(20_000));
    resetStorageCache();
    await renderApp();
    await fireEvent.press(screen.getByText('History'));
    await fireEvent.press(screen.getByText('All time'));
    const t0 = Date.now();
    await fireEvent.changeText(screen.getByPlaceholderText(/Search merchant/), 'starbucks');
    expect(Date.now() - t0).toBeLessThan(3000);
    const summary = await screen.findByText(/entries ·/);
    const n = Number(String(summary.props.children[0]).replace(/,/g, ''));
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(20_000);
  });

  test('adding to a large dataset only rewrites one chunk', async () => {
    await save(makeData(10_500));
    resetStorageCache();
    await renderApp();
    await stored(); // first save after load: nothing should change
    const setSpy = AsyncStorage.multiSet as jest.Mock;
    setSpy.mockClear();
    await addEntry('coffee 4');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    const keys = setSpy.mock.calls.flatMap((c) => c[0].map(([k]: [string]) => k));
    expect(keys.filter((k: string) => k.startsWith(CHUNK_PREFIX))).toHaveLength(1);
  });
});

describe('settings', () => {
  // The Jest TextInput mock puts focus() on the prototype, so every input shares this spy.
  const focusSpy = (TextInput as any).prototype.focus as jest.Mock;
  const afterFocusDelay = () => act(async () => { await new Promise((r) => setTimeout(r, 250)); });

  test('the entry box is focused on open by default', async () => {
    focusSpy.mockClear();
    await renderApp();
    await afterFocusDelay();
    expect(focusSpy).toHaveBeenCalled();
  });

  test('turning auto-focus off is saved and stops the focus', async () => {
    await renderApp();
    await fireEvent.press(screen.getByText('Settings'));
    await fireEvent(screen.getByLabelText('Open the keyboard on Home'), 'valueChange', false);
    expect((await stored()).settings.autoFocusEntry).toBe(false);

    focusSpy.mockClear();
    await fireEvent.press(screen.getByText('Home'));
    await afterFocusDelay();
    expect(focusSpy).not.toHaveBeenCalled();
  });

  test('the supporter code box sits near the top, above the keyboard', async () => {
    await renderApp();
    await fireEvent.press(screen.getByText('Settings'));
    const json = JSON.stringify(screen.toJSON());
    const box = json.indexOf('LL-XXXX-XXXX');
    expect(box).toBeGreaterThan(-1);
    expect(box).toBeLessThan(json.indexOf('Your data stays on this device'));
    expect(box).toBeLessThan(json.indexOf('Appearance'));
  });

  test('supporter code unlocks the Custom theme; a wrong one does not', async () => {
    await renderApp();
    await fireEvent.press(screen.getByText('Settings'));
    expect(screen.queryByText('Custom')).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText('LL-XXXX-XXXX'), 'FT-AAAA-BBBB');
    await fireEvent.press(screen.getByText('Unlock'));
    expect(await screen.findByText(/doesn't look right/)).toBeTruthy();
    expect(screen.queryByText('Custom')).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText('LL-XXXX-XXXX'), 'ft-vz58-8c53');
    await fireEvent.press(screen.getByText('Unlock'));
    expect(await screen.findByText('Thanks for supporting Local Ledger!')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
    expect((await stored()).settings.supporterCode).toBe('FT-VZ58-8C53');
  });

  test('every tab renders without crashing in basic and advanced mode', async () => {
    await save(makeData(500));
    resetStorageCache();
    await renderApp();
    for (const name of ['History', 'Budgets', 'Settings', 'Home']) {
      await fireEvent.press(screen.getAllByText(name).at(-1)!);
    }
    await fireEvent.press(screen.getAllByText('Settings').at(-1)!);
    await fireEvent.press(screen.getByText('Advanced'));
    for (const name of ['History', 'Budgets', 'Home', 'Settings']) {
      await fireEvent.press(screen.getAllByText(name).at(-1)!);
    }
    expect(screen.getByText('Export backup (.json)')).toBeTruthy();
  });
});
