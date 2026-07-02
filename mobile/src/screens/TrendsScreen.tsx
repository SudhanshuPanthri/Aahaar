/**
 * Trends tab — rolling averages (7 / 30 day) and a last-7-days calorie bar chart.
 * Averaged over days that had entries (see getAverages).
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAverages, getDailyTotalsInRange, getLoggingStreak, shiftLocalDate } from '../db/stats';
import { todayLocalDate } from '../db/log';
import { getActiveGoal } from '../db/profile';
import { FONT, useTheme, type Palette } from '../ui/theme';

const WINDOWS = [7, 30] as const;
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function TrendsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [win, setWin] = useState<(typeof WINDOWS)[number]>(7);
  const goal = useMemo(() => getActiveGoal(), []);
  const avg = useMemo(() => getAverages(win), [win]);

  // Last 7 days as a simple bar chart (always 7 bars, gaps included).
  const week = useMemo(() => {
    const end = todayLocalDate();
    const start = shiftLocalDate(end, -6);
    const byDate = new Map(getDailyTotalsInRange(start, end).map((r) => [r.localDate, r.calories]));
    const days: { date: string; kcal: number; dow: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = shiftLocalDate(end, -i);
      const [y, m, d] = date.split('-').map(Number);
      days.push({ date, kcal: byDate.get(date) ?? 0, dow: DOW[new Date(y, m - 1, d).getDay()] });
    }
    return days;
  }, []);

  const maxKcal = Math.max(goal?.targetCalories ?? 0, ...week.map((d) => d.kcal), 1);
  const target = goal?.targetCalories ?? 0;

  const streak = useMemo(() => getLoggingStreak(), []);
  // Logged days in the window that landed at/under the calorie goal (5% grace).
  const withinGoalDays = useMemo(() => {
    if (target <= 0) return 0;
    const end = todayLocalDate();
    return getDailyTotalsInRange(shiftLocalDate(end, -(win - 1)), end).filter((r) => r.calories <= target * 1.05)
      .length;
  }, [win, target]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Trends</Text>

      {/* Window toggle */}
      <View style={styles.segment}>
        {WINDOWS.map((w) => (
          <Pressable key={w} style={[styles.segBtn, win === w && styles.segBtnActive]} onPress={() => setWin(w)}>
            <Text style={[styles.segText, win === w && styles.segTextActive]}>Last {w} days</Text>
          </Pressable>
        ))}
      </View>

      {avg.activeDays === 0 ? (
        <Text style={styles.empty}>No data in this window yet. Log some meals to see trends.</Text>
      ) : (
        <>
          <View style={styles.tileRow}>
            <View style={styles.tile}>
              <Ionicons name="flame" size={18} color={colors.calories} />
              <Text style={styles.tileVal}>{streak}</Text>
              <Text style={styles.tileLabel}>day streak</Text>
            </View>
            {target > 0 && (
              <View style={styles.tile}>
                <Ionicons name="checkmark-circle" size={18} color={colors.protein} />
                <Text style={styles.tileVal}>{withinGoalDays}</Text>
                <Text style={styles.tileLabel}>days within goal</Text>
              </View>
            )}
          </View>

          <View style={styles.avgCard}>
            <Text style={styles.avgLabel}>AVG / LOGGED DAY</Text>
            <Text style={styles.avgCal}>{avg.avgCalories.toLocaleString()} kcal</Text>
            <Text style={styles.avgMacros}>
              Protein {avg.avgProtein}g · Carbs {avg.avgCarbs}g · Fat {avg.avgFat}g
            </Text>
            <Text style={styles.avgSub}>
              {avg.activeDays} of {avg.windowDays} days logged
              {target > 0 ? ` · goal ${Math.round(target)} kcal` : ''}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>LAST 7 DAYS</Text>
          <View style={styles.chart}>
            {week.map((d) => {
              const h = Math.round((d.kcal / maxKcal) * 100);
              const over = target > 0 && d.kcal > target;
              return (
                <View key={d.date} style={styles.barCol}>
                  <Text style={styles.barVal}>{d.kcal > 0 ? d.kcal : ''}</Text>
                  <View style={styles.barSpace}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${h}%`, backgroundColor: d.kcal === 0 ? colors.track : over ? colors.danger : colors.calories },
                      ]}
                    />
                  </View>
                  <Text style={styles.barDow}>{d.dow}</Text>
                </View>
              );
            })}
          </View>
          {target > 0 && <Text style={styles.hint}>Bars turn red on days above your {Math.round(target)} kcal goal.</Text>}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  h1: { fontSize: 34, fontFamily: FONT.bold, color: c.ink, letterSpacing: -0.5 },
  sectionLabel: { fontSize: 11, fontFamily: FONT.semibold, color: c.dim, letterSpacing: 1, marginTop: 8 },
  empty: { fontSize: 14, fontFamily: FONT.regular, color: c.dim, textAlign: 'center', marginTop: 40 },

  segment: { flexDirection: 'row', backgroundColor: c.segmentBg, borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  segBtnActive: { backgroundColor: c.segmentActive, shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 14, fontFamily: FONT.semibold, color: c.mute },
  segTextActive: { color: c.ink },

  tileRow: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14,
  },
  tileVal: { fontSize: 20, fontFamily: FONT.bold, color: c.ink },
  tileLabel: { flexShrink: 1, fontSize: 12, fontFamily: FONT.regular, color: c.dim },

  avgCard: { backgroundColor: c.card, borderRadius: 14, padding: 18, gap: 4 },
  avgLabel: { fontSize: 11, fontFamily: FONT.semibold, color: c.dim, letterSpacing: 1 },
  avgCal: { fontSize: 28, fontFamily: FONT.bold, color: c.ink, letterSpacing: -0.5 },
  avgMacros: { fontSize: 14, fontFamily: FONT.regular, color: c.sub },
  avgSub: { fontSize: 12, fontFamily: FONT.regular, color: c.dim, marginTop: 4 },

  chart: { flexDirection: 'row', height: 160, alignItems: 'flex-end', justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barVal: { fontSize: 9, fontFamily: FONT.regular, color: c.dim, height: 12 },
  barSpace: { flex: 1, width: '55%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, minHeight: 2 },
  barDow: { fontSize: 11, fontFamily: FONT.regular, color: c.dim, marginTop: 4 },
  hint: { fontSize: 12, fontFamily: FONT.regular, color: c.dim },
});
