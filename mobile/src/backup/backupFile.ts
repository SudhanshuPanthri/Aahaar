/**
 * Bridges the JSON backup (db/backup.ts) to the device filesystem + OS sheets.
 * Three intents, no accounts/SDKs — the OS mediates the user's own storage:
 *   - shareBackup(): open the share/save sheet (has "Save to Files"/Drive + share).
 *   - saveBackupToFolder(): Android only — user picks a folder, we write directly (no share).
 *   - importBackup(): pick a file via the OS document picker, read + restore.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { buildBackup, restoreBackup, type RestoreSummary } from '../db/backup';

/** A true no-share "Save to device" folder picker only exists on Android (SAF). */
export const canSaveToFolder = Platform.OS === 'android';

function backupPayload(now: Date): { fileName: string; json: string } {
  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return { fileName: `aahaar-backup-${stamp}.json`, json: JSON.stringify(buildBackup(now.toISOString()), null, 2) };
}

/** Open the OS share/save sheet (includes "Save to Files", Drive, and share targets). */
export async function shareBackup(now = new Date()): Promise<{ shared: boolean; fileName: string }> {
  const { fileName, json } = backupPayload(now);
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) return { shared: false, fileName };
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save or share your Aahaar backup',
    UTI: 'public.json',
  });
  return { shared: true, fileName };
}

/** Android: let the user pick a folder and write the backup there directly (no share). */
export async function saveBackupToFolder(now = new Date()): Promise<{ saved: boolean; fileName: string }> {
  const { fileName, json } = backupPayload(now);
  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return { saved: false, fileName };
  // SAF appends the extension from the mime type, so pass the base name.
  const base = fileName.replace(/\.json$/, '');
  const uri = await StorageAccessFramework.createFileAsync(perm.directoryUri, base, 'application/json');
  await StorageAccessFramework.writeAsStringAsync(uri, json);
  return { saved: true, fileName };
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
