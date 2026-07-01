import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { initDb } from './src/db/init';
import { hasCompletedOnboarding } from './src/db/profile';
import Onboarding from './src/screens/Onboarding';
import LogScreen from './src/screens/LogScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import TrendsScreen from './src/screens/TrendsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { COLORS, FONT } from './src/ui/theme';

// Keep the native splash visible until fonts + DB init finish (avoids a blank flash).
// (setOptions/fade is a dev-build-only nicety and warns in Expo Go, so we skip it.)
SplashScreen.preventAutoHideAsync();

type IonName = keyof typeof Ionicons.glyphMap;
type Tab = 'log' | 'calendar' | 'trends' | 'settings';
const TABS: { key: Tab; label: string; icon: IonName; iconActive: IonName }[] = [
  { key: 'log', label: 'Log', icon: 'restaurant-outline', iconActive: 'restaurant' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { key: 'trends', label: 'Trends', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tab, setTab] = useState<Tab>('log');
  const [dataEpoch, setDataEpoch] = useState(0); // bump to remount screens (e.g. after import)

  // After a backup import, re-check onboarding and force screens to re-read the DB.
  function onImported() {
    setNeedsOnboarding(!hasCompletedOnboarding());
    setDataEpoch((n) => n + 1);
    setTab('log');
  }

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        setNeedsOnboarding(!hasCompletedOnboarding());
        setReady(true);
      } catch (e: any) {
        setInitError(String(e?.message ?? e));
      }
    })();
  }, []);

  // Dismiss the native splash once the app is actually ready to draw.
  useEffect(() => {
    if ((ready || initError) && fontsLoaded) SplashScreen.hideAsync();
  }, [ready, initError, fontsLoaded]);

  if (initError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>DB error:{'\n'}{initError}</Text>
      </View>
    );
  }
  if (!ready || !fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Onboarding / edit-goal takes over the whole screen. On return, tabs remount
  // (fresh DB reads), so an edited goal shows up immediately.
  if (needsOnboarding) {
    return <Onboarding onDone={() => setNeedsOnboarding(false)} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="auto" />
      <View style={styles.body} key={dataEpoch}>
        {tab === 'log' && <LogScreen onEditGoal={() => setNeedsOnboarding(true)} />}
        {tab === 'calendar' && <CalendarScreen />}
        {tab === 'trends' && <TrendsScreen />}
        {tab === 'settings' && (
          <SettingsScreen onEditGoal={() => setNeedsOnboarding(true)} onImported={onImported} />
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={styles.tabBtn} onPress={() => setTab(t.key)}>
              <Ionicons
                name={active ? t.iconActive : t.icon}
                size={23}
                color={active ? COLORS.calories : '#9a9a9f'}
              />
              <Text style={[styles.tabLabel, active ? styles.tabActive : styles.tabInactive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: COLORS.bg },
  error: { fontFamily: FONT.regular, color: COLORS.danger, textAlign: 'center' },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontFamily: FONT.semibold },
  tabActive: { color: COLORS.calories },
  tabInactive: { color: '#9a9a9f' },
});
