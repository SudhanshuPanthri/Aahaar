/**
 * Settings tab — goal editing + local backup/restore.
 * Backup is account-free: export hands a JSON file to the OS share sheet; import
 * reads a file the user picks (from Drive / iCloud / Files) and restores it.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shareBackup, saveBackupToFolder, canSaveToFolder, importBackup } from '../backup/backupFile';
import { COLORS, FONT } from '../ui/theme';

export default function SettingsScreen({
  onEditGoal,
  onImported,
}: {
  onEditGoal: () => void;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState<null | 'export' | 'import'>(null);

  async function runShare() {
    setBusy('export');
    try {
      await shareBackup();
    } catch (e: any) {
      Alert.alert('Export failed', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  async function runSaveToFolder() {
    setBusy('export');
    try {
      const { saved, fileName } = await saveBackupToFolder();
      if (saved) Alert.alert('Backup saved', `Saved ${fileName} to the folder you chose.`);
    } catch (e: any) {
      Alert.alert('Save failed', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  function onExport() {
    if (busy) return;
    // Android can write straight to a chosen folder (no share). On iOS the share
    // sheet itself offers "Save to Files", so we open it directly.
    if (canSaveToFolder) {
      Alert.alert('Export backup', 'Save the backup to your device, or share it.', [
        { text: 'Save to device', onPress: runSaveToFolder },
        { text: 'Share…', onPress: runShare },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      runShare();
    }
  }

  function onImport() {
    if (busy) return;
    Alert.alert(
      'Import backup?',
      'This will REPLACE all current data (meals, goal, saved meals) with the contents of the backup file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file',
          style: 'destructive',
          onPress: async () => {
            setBusy('import');
            try {
              const summary = await importBackup();
              if (!summary) return; // cancelled
              onImported();
              Alert.alert(
                'Restore complete',
                `Restored ${summary.logItems} logged item(s), ${summary.savedMeals} saved meal(s), ${summary.goals} goal(s).`
              );
            } catch (e: any) {
              Alert.alert('Import failed', String(e?.message ?? e));
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Settings</Text>

      <Text style={styles.sectionLabel}>GOAL</Text>
      <Row icon="flag-outline" label="Edit goal & targets" onPress={onEditGoal} />

      <Text style={styles.sectionLabel}>BACKUP & RESTORE</Text>
      <Row
        icon="cloud-upload-outline"
        label="Export backup"
        sub={canSaveToFolder ? 'Save to a folder on your device, or share' : 'Use “Save to Files”, iCloud, Drive, or share'}
        onPress={onExport}
        loading={busy === 'export'}
      />
      <Row
        icon="cloud-download-outline"
        label="Import backup"
        sub="Restore from a backup file (replaces current data)"
        onPress={onImport}
        loading={busy === 'import'}
      />
      <Text style={styles.note}>
        Your data stays on this device. Backups use your own cloud storage — Aahaar never sees your account.
      </Text>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  sub,
  onPress,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={loading}>
      <Ionicons name={icon} size={22} color={COLORS.calories} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {loading ? <ActivityIndicator color={COLORS.calories} /> : <Ionicons name="chevron-forward" size={18} color="#c4c4c9" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  h1: { fontSize: 34, fontFamily: FONT.bold, color: COLORS.ink, letterSpacing: -0.5, marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontFamily: FONT.semibold, color: COLORS.dim, letterSpacing: 1, marginTop: 16, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card, borderRadius: 12, padding: 16,
  },
  rowLabel: { fontSize: 16, fontFamily: FONT.semibold, color: COLORS.ink },
  rowSub: { fontSize: 12, fontFamily: FONT.regular, color: COLORS.sub, marginTop: 2 },
  note: { fontSize: 12, fontFamily: FONT.regular, color: COLORS.dim, marginTop: 12, lineHeight: 17 },
});
