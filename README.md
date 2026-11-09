# Local Ledger

A privacy-first personal finance tracker that runs entirely on your phone. Type what you spent in plain English and Local Ledger files it. There's no account, no cloud and no tracking, and the Android app doesn't even have permission to use the internet.

> **Disclaimer:** Local Ledger's code and this README were written by Claude, Anthropic's AI assistant, and reviewed by me.

Built with Expo / React Native. Android is the main target; it also runs in a web browser.

<p align="center"><img src="assets/logo.png" width="96" alt="Local Ledger logo"></p>

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
- **Icon styles**: vector icons by default, or Emoji for free.
- **Ko-fi supporter perks** ([ko-fi.com/cora_tealeaf](https://ko-fi.com/cora_tealeaf)): an offline supporter code unlocks:
  - extra themes
  - a Custom theme, built from your own four colours with readability checking
  - the Line and Bold icon packs
  - app badges

## Privacy

- All data is stored on the device: AsyncStorage on Android, `localStorage` on web.
- Icons, fonts and images are packed into the app, so nothing is downloaded at runtime.
- The app makes no network requests at all, and release builds for Android don't request the `INTERNET` permission. The test suite fails if the app tries to make a request.
- The Ko-fi link opens in your browser; the app itself never connects.
- Backups are plain JSON files you own.

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
npm run lint         # ESLint
```

The suite lives in [`__tests__/`](__tests__):

| File | Covers |
|---|---|
| `parser.test.ts` | Everyday phrases, amounts, dates (month and year boundaries, leap days), income vs expense, merchant rules, hostile input, slow-regex checks |
| `utils.test.ts` | Money formatting, budget cycles (every day of a year, DST, invalid start days), totals, CSV escaping and formula injection |
| `data.test.ts` | Backup validation against damaged or malicious files, chunked storage, migration, corrupted storage, 50,000-entry performance |
| `supporter-theme.test.ts` | SHA-256 test vectors, supporter codes, theme readability, every icon in every pack |
| `app.test.tsx` | The full app driven like a user: adding entries, undo, restart, corrupted storage, 20,000 entries, supporter unlock, every screen |

## Supporter codes

The codes themselves are never in the app. [src/supporter.ts](src/supporter.ts) holds only a one-way SHA-256 fingerprint of each accepted code. A typed code unlocks the perks if its fingerprint matches.

```bash
npm run supporter-code                    # new random code + its hash
npm run supporter-code -- LL-ABCD-EFGH    # hash for a code you chose
```

Paste the printed hash into `SUPPORTER_CODE_HASHES` and give the code to supporters. To rotate a leaked code, add a new hash. Remove the old one only if you want to re-lock everyone who used it. Because the app works offline, someone determined could still patch the check out; this just stops anyone copying the code from the source.

## Building for release

[GitHub Actions](.github/workflows/android.yml) builds the APK on every push to `main` and on pull requests. It runs the tests, generates the Android project with `expo prebuild`, and compiles it with Gradle. The APK is attached to each run under **Actions → Android build → Artifacts**. You can also start a build by hand with **Run workflow**.

To publish a release:

1. Bump `version` **and** `android.versionCode` in `app.json`, and add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`.
2. Commit, then tag and push: `git tag v1.0.0 && git push origin v1.0.0`. The tag must match `version`, or the build fails.
3. The workflow creates a GitHub release with `local-ledger-<version>.apk` attached.

**Signing:** add these repository secrets under *Settings → Secrets and variables → Actions* to sign the APK with your release key: `ANDROID_KEYSTORE_BASE64` (the keystore file, base64-encoded), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Without them the APK is signed with the public debug key, which is fine for testing but not for publishing. Keep a backup of the keystore: Android only accepts updates signed with the same key.

The Android package is `com.coratealeaf.localledger` (in [app.json](app.json)). It can't be changed after the app is published.

### F-Droid

The repo is set up for [F-Droid](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/):

- GPL-3.0 licence and only FOSS dependencies (no Google Play Services, Firebase or analytics).
- `expo.autolinking.android.buildFromSource` in `package.json` makes Expo compile its Android modules from source instead of using the prebuilt `.aar` files that ship in `node_modules`.
- Unused permissions Expo adds by default are blocked in `app.json`, and [`plugins/withNoInternetInRelease.js`](plugins/withNoInternetInRelease.js) removes `INTERNET` from release builds, so the published app requests no permissions at all. Development builds keep `INTERNET` because they load code from the Metro dev server.
- Store text, icon, screenshots and changelogs are in [`fastlane/metadata/android/en-US`](fastlane/metadata/android/en-US). The icon comes from `scripts/render-icons.js`.

## Project layout

```
App.tsx               app shell, tabs, error screen
src/parser.ts         plain-English → transaction
src/store.tsx         app state and actions
src/storage.ts        on-device persistence (chunked for Android's per-value limit)
src/sanitize.ts       validates anything loaded from disk or a backup
src/theme.ts          palettes and the Custom theme
src/icons.tsx         one icon vocabulary, four looks
src/screens/          Home, History, Budgets, Settings
src/components/       quick entry, rows, editor, badge
scripts/              supporter codes, icon rendering
__tests__/            Jest suite
```

## Notes

- **Storage limits**: transactions are saved in chunks of 1,000, which avoids Android's ~2 MB limit on a single stored value. Android's default AsyncStorage database holds about 6 MB, roughly 20,000 transactions.
- **Icons**: regenerate the launcher icon, adaptive icon, splash and favicon with `npm install --no-save sharp@0.34.4 && node scripts/render-icons.js assets`.
- **App badge** changes the in-app icon only. Changing the Android launcher icon needs a config plugin and a development build.

## License

Copyright (C) 2026 Cora Tealeaf

Local Ledger is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).

## Support

Local Ledger is free with no ads. If it helps you, you can [buy me a coffee on Ko-fi](https://ko-fi.com/cora_tealeaf).
