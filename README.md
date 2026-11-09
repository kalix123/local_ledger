# FinTrack

A privacy-first personal finance tracker that runs entirely on your phone. Type what you spent in plain English and FinTrack files it. There's no account, no cloud and no tracking, and it makes no network requests unless you turn on the optional AI.

Built with Expo / React Native. Android is the main target; it also runs in a web browser.

<p align="center"><img src="assets/logo.png" width="96" alt="FinTrack logo"></p>

## Features

- **Plain-English entry.** Type `spent 10.50 at WinCo on ice cream` or `got paid for work 135 plus 20 in tips` and press Enter. A rule-based parser ([src/parser.ts](src/parser.ts)) works out:
  - the amount, including sums like "135 plus 20"
  - income or expense
  - the merchant and category
  - a note
  - the date, from words like "yesterday", "last friday" or "11/2"
- **Monthly budgets** for each category, with progress bars and a pace marker that shows where steady spending would put you.
- **History** with search, filters and month-by-month browsing. It handles years of entries.
- **Basic and Advanced modes.** Advanced adds:
  - merchant rules
  - custom categories
  - a budget month that starts on any day, such as payday
  - JSON and CSV backups
  - optional AI
- **Optional bring-your-own AI** (Advanced): Ollama on your own computer, any OpenAI-compatible endpoint, or Anthropic. Cloud services show a privacy warning that must be accepted first. AI summaries send category totals only.
- **Icon styles**: vector icons by default, or Emoji for free.
- **Ko-fi supporter perks** ([ko-fi.com/cora_tealeaf](https://ko-fi.com/cora_tealeaf)): an offline supporter code unlocks:
  - extra themes
  - a Custom theme, built from your own four colours with readability checking
  - the Line and Bold icon packs
  - app badges

## Privacy

- All data is stored on the device: AsyncStorage on Android, `localStorage` on web.
- Icons, fonts and images are packed into the app, so nothing is downloaded at runtime.
- The only network requests are to an AI endpoint *you* configure, and only after you turn it on. The test suite fails if the app makes any other request.
- Backups are plain JSON files you own. AI API keys are left out of backups unless you choose to include them.

## Getting started

Requires Node 20 or later.

```bash
npm install
npm run web        # browser at http://localhost:8081
npm run android    # Expo Go on a phone, or an Android emulator
```

## Tests

```bash
npm test             # full Jest suite (jest-expo + React Native Testing Library)
npm run typecheck    # TypeScript
npx expo lint        # ESLint
```

The suite lives in [`__tests__/`](__tests__):

| File | Covers |
|---|---|
| `parser.test.ts` | Everyday phrases, amounts, dates (month and year boundaries, leap days), income vs expense, merchant rules, hostile input, slow-regex checks |
| `utils.test.ts` | Money formatting, budget cycles (every day of a year, DST, invalid start days), totals, CSV escaping and formula injection |
| `data.test.ts` | Backup validation against damaged or malicious files, chunked storage, migration, corrupted storage, 50,000-entry performance |
| `ai.test.ts` | Local vs cloud address detection, the privacy acknowledgement, handling of untrusted AI replies, no extra network requests |
| `supporter-theme.test.ts` | SHA-256 test vectors, supporter codes, theme readability, every icon in every pack |
| `app.test.tsx` | The full app driven like a user: adding entries, undo, restart, corrupted storage, 20,000 entries, supporter unlock, every screen |

## Supporter codes

The codes themselves are never in the app. [src/supporter.ts](src/supporter.ts) holds only a one-way SHA-256 fingerprint of each accepted code. A typed code unlocks the perks if its fingerprint matches.

```bash
npm run supporter-code                    # new random code + its hash
npm run supporter-code -- FT-ABCD-EFGH    # hash for a code you chose
```

Paste the printed hash into `SUPPORTER_CODE_HASHES` and give the code to supporters. To rotate a leaked code, add a new hash. Remove the old one only if you want to re-lock everyone who used it. Because the app works offline, someone determined could still patch the check out; this just stops anyone copying the code from the source.

## Building for release

Use [EAS Build](https://docs.expo.dev/build/introduction/) to build the app in the cloud:

```bash
npx eas-cli@latest build --platform android
```

- The Android package is `com.coratealeaf.fintrack` (in [app.json](app.json)). It can't be changed after the app is published on Google Play.
- Bump `version` in `app.json` for each store release.

## Project layout

```
App.tsx               app shell, tabs, error screen
src/parser.ts         plain-English → transaction
src/store.tsx         app state and actions
src/storage.ts        on-device persistence (chunked for Android's per-value limit)
src/sanitize.ts       validates anything loaded from disk or a backup
src/ai.ts             optional bring-your-own-key AI
src/theme.ts          palettes and the Custom theme
src/icons.tsx         one icon vocabulary, four looks
src/screens/          Home, History, Budgets, Settings
src/components/       quick entry, rows, editor, badge
scripts/              supporter codes, icon rendering
__tests__/            Jest suite
```

## Notes

- **Ollama from the web build** needs CORS: start it with `OLLAMA_ORIGINS="*"`. On a phone, use your computer's LAN IP instead of `localhost`.
- **Storage limits**: transactions are saved in chunks of 1,000, which avoids Android's ~2 MB limit on a single stored value. Android's default AsyncStorage database holds about 6 MB, roughly 20,000 transactions.
- **API keys** are kept in app storage, which is not encrypted. `expo-secure-store` would be the next step.
- **Icons**: regenerate the launcher icon, adaptive icon, splash and favicon with `npm install --no-save sharp@0.34.4 && node scripts/render-icons.js assets`.
- **App badge** changes the in-app icon only. Changing the Android launcher icon needs a config plugin and a development build.

## Support

FinTrack is free with no ads. If it helps you, you can [buy me a coffee on Ko-fi](https://ko-fi.com/cora_tealeaf).
