import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform, Share } from 'react-native';

/** Cross-platform confirm (RN's Alert is a no-op on web). */
export function confirm(title: string, message: string, okLabel = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export function notify(title: string, message = '') {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** Save a text file. Web: browser download. Android: system share sheet (save to Drive/Files, email to self, …). */
export async function saveTextFile(filename: string, content: string, mime: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  // Write a real file and share it. Passing the text through the share sheet directly breaks for
  // big backups (Android's ~1 MB binder limit), which is exactly when a backup matters most.
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: filename, UTI: mime === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json' });
  } else {
    await Share.share({ title: filename, message: content.length < 200_000 ? content : `Saved to ${file.uri}` });
  }
}

/** Let the user pick a backup file and return its text, or null if cancelled. */
export async function pickTextFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: File };
  if (Platform.OS === 'web' && asset.file) return await asset.file.text();
  return await new File(asset.uri).text();
}
