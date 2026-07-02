/**
 * Settings tab — appearance (theme + accent), goal editing, local backup/restore.
 * Backup is account-free: export hands a JSON file to the OS share sheet; import
 * reads a file the user picks (from Drive / iCloud / Files) and restores it.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shareBackup, saveBackupToFolder, canSaveToFolder, importBackup } from '../backup/backupFile';
import { ACCENTS, ACCENT_NAMES, FONT, useTheme, type Palette, type ThemePref } from '../ui/theme';

const THEME_OPTIONS: { key: ThemePref; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function SettingsScreen({
  onEditGoal,
  onImported,
}: {
  onEditGoal: () => void;
  onImported: () => void;
}) {
  const { colors, mode, pref, setPref, accent, setAccent } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

      <Text style={styles.sectionLabel}>APPEARANCE</Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map((o) => (
          <Pressable
            key={o.key}
            style={[styles.segBtn, pref === o.key && styles.segBtnActive]}
            onPress={() => setPref(o.key)}
          >
            <Text style={[styles.segText, pref === o.key && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>ACCENT</Text>
      <View style={styles.accentRow}>
        {ACCENT_NAMES.map((name) => {
          const selected = accent === name;
          const fill = mode === 'dark' ? ACCENTS[name].dark : ACCENTS[name].light;
          return (
            <Pressable
              key={name}
              onPress={() => setAccent(name)}
              hitSlop={4}
              style={[styles.swatchRing, selected && styles.swatchRingActive]}
            >
              <View style={[styles.swatch, { backgroundColor: fill }]}>
                {selected && <Ionicons name="checkmark" size={16} color={colors.onAccent} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>GOAL</Text>
      <Row icon="flag-outline" label="Edit goal & targets" onPress={onEditGoal} colors={colors} styles={styles} />

      <Text style={styles.sectionLabel}>BACKUP & RESTORE</Text>
      <Row
        icon="cloud-upload-outline"
        label="Export backup"
        sub={canSaveToFolder ? 'Save to a folder on your device, or share' : 'Use “Save to Files”, iCloud, Drive, or share'}
        onPress={onExport}
        loading={busy === 'export'}
        colors={colors}
        styles={styles}
      />
      <Row
        icon="cloud-download-outline"
        label="Import backup"
        sub="Restore from a backup file (replaces current data)"
        onPress={onImport}
        loading={busy === 'import'}
        colors={colors}
        styles={styles}
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
  colors,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress: () => void;
  loading?: boolean;
  colors: Palette;
  styles: Styles;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={loading}>
      <Ionicons name={icon} size={22} color={colors.calories} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.calories} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
      )}
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  h1: { fontSize: 34, fontFamily: FONT.bold, color: c.ink, letterSpacing: -0.5, marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontFamily: FONT.semibold, color: c.dim, letterSpacing: 1, marginTop: 16, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: c.card, borderRadius: 12, padding: 16,
  },
  rowLabel: { fontSize: 16, fontFamily: FONT.semibold, color: c.ink },
  rowSub: { fontSize: 12, fontFamily: FONT.regular, color: c.sub, marginTop: 2 },
  note: { fontSize: 12, fontFamily: FONT.regular, color: c.dim, marginTop: 12, lineHeight: 17 },

  segment: { flexDirection: 'row', backgroundColor: c.segmentBg, borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  segBtnActive: { backgroundColor: c.segmentActive, shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 14, fontFamily: FONT.semibold, color: c.mute },
  segTextActive: { color: c.ink },

  accentRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  swatchRing: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchRingActive: { borderColor: c.ink },
  swatch: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

type Styles = ReturnType<typeof makeStyles>;
