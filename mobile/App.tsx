import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
import { FONT, ThemeProvider, useTheme, type Palette } from './src/ui/theme';
import PressableScale from './src/ui/PressableScale';

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
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false); // true = opened via "Edit goal" (cancelable)
  const [tab, setTab] = useState<Tab>('log');
  const [dataEpoch, setDataEpoch] = useState(0); // bump to remount screens (e.g. after import)

  function openEditGoal() {
    setEditingGoal(true);
    setNeedsOnboarding(true);
  }
  function closeOnboarding() {
    setNeedsOnboarding(false);
    setEditingGoal(false);
  }

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

  const statusBar = <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;

  if (initError) {
    return (
      <View style={styles.center}>
        {statusBar}
        <Text style={styles.error}>DB error:{'\n'}{initError}</Text>
      </View>
    );
  }
  if (!ready || !fontsLoaded) {
    return (
      <View style={styles.center}>
        {statusBar}
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Onboarding / edit-goal takes over the whole screen. On return, tabs remount
  // (fresh DB reads), so an edited goal shows up immediately. When opened via
  // "Edit goal" it's cancelable; first-run onboarding must be completed.
  if (needsOnboarding) {
    return (
      <>
        {statusBar}
        <Onboarding onDone={closeOnboarding} onCancel={editingGoal ? closeOnboarding : undefined} />
      </>
    );
  }

  return (
    <View style={styles.root}>
      {statusBar}
      {/* Keyed on tab (+ dataEpoch) so switching tabs remounts the content
          with a quick fade + 12px slide-up. */}
      <Animated.View
        style={styles.body}
        key={`${tab}-${dataEpoch}`}
        entering={FadeInDown.duration(220).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
      >
        {tab === 'log' && <LogScreen onEditGoal={openEditGoal} />}
        {tab === 'calendar' && <CalendarScreen />}
        {tab === 'trends' && <TrendsScreen />}
        {tab === 'settings' && <SettingsScreen onEditGoal={openEditGoal} onImported={onImported} />}
      </Animated.View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <PressableScale key={t.key} style={styles.tabBtn} onPress={() => setTab(t.key)}>
              <Ionicons
                name={active ? t.iconActive : t.icon}
                size={23}
                color={active ? colors.calories : colors.tabIdle}
              />
              <Text style={[styles.tabLabel, active ? styles.tabActive : styles.tabInactive]}>{t.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    body: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: c.bg },
    error: { fontFamily: FONT.regular, color: c.danger, textAlign: 'center' },

    tabBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 8,
      paddingBottom: 24,
      backgroundColor: c.bg,
    },
    tabBtn: { flex: 1, alignItems: 'center', gap: 3 },
    tabLabel: { fontSize: 11, fontFamily: FONT.semibold },
    tabActive: { color: c.calories },
    tabInactive: { color: c.tabIdle },
  });
