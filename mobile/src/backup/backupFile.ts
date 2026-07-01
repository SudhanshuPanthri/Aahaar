/**
 * Bridges the JSON backup (db/backup.ts) to the device's filesystem + OS sheets.
 *  - export: write a JSON file, then open the share/save sheet (Drive, iCloud/Files…).
 *  - import: pick a file via the OS document picker, read + restore it.
 * No auth, no cloud SDK — the OS mediates the user's own storage.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { buildBackup, restoreBackup, type RestoreSummary } from '../db/backup';

/** Build the backup file and hand it to the OS share/save sheet. */
export async function exportBackup(now = new Date()): Promise<{ shared: boolean; fileName: string }> {
  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const fileName = `aahaar-backup-${stamp}.json`;
  const json = JSON.stringify(buildBackup(now.toISOString()), null, 2);

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) {
    // Rare (some emulators). File is still written to the cache dir.
    return { shared: false, fileName };
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your Aahaar backup',
    UTI: 'public.json',
  });
  return { shared: true, fileName };
}

/** Pick a backup file and restore it. Returns null if the user cancels. */
export async function importBackup(): Promise<RestoreSummary | null> {
  const res = await DocumentPicker.getDocumentAsync({
    // Some providers report JSON as octet-stream; accept broadly, validate on parse.
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;

  const picked = new File(res.assets[0].uri);
  const text = picked.textSync();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  return restoreBackup(parsed);
}
