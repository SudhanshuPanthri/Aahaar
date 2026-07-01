/**
 * Calendar tab — a month grid showing per-day calories, coloured vs the goal.
 * Tap ‹ / › to change month. Purely local reads; no network.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDailyTotalsInRange } from '../db/stats';
import { todayLocalDate } from '../db/log';
import { getActiveGoal } from '../db/profile';
import { COLORS, FONT } from '../ui/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarScreen() {
  const today = todayLocalDate();
  const [y0, m0] = today.split('-').map(Number);
  const [cursor, setCursor] = useState({ year: y0, month: m0 }); // month is 1-based
  const goal = useMemo(() => getActiveGoal(), []);
  const target = goal?.targetCalories ?? 0;

  const { cells, monthTotal, loggedDays } = useMemo(() => {
    const { year, month } = cursor;
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

    const byDate = new Map<string, number>();
    let total = 0;
    for (const r of getDailyTotalsInRange(start, end)) {
      byDate.set(r.localDate, r.calories);
      total += r.calories;
    }

    const list: ({ day: number; date: string; kcal: number } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${pad(month)}-${pad(d)}`;
      list.push({ day: d, date, kcal: byDate.get(date) ?? 0 });
    }
    return { cells: list, monthTotal: total, loggedDays: byDate.size };
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  }

  /** Colour a day cell by how its intake compares to the goal. */
  function cellColor(kcal: number): string {
    if (kcal === 0) return 'transparent';
    if (target === 0) return COLORS.calories;
    if (kcal > target * 1.1) return COLORS.danger; // notably over
    if (kcal >= target * 0.9) return COLORS.protein; // on target
    return COLORS.carbs; // under
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Calendar</Text>

      <View style={styles.monthRow}>
        <Pressable hitSlop={12} onPress={() => shiftMonth(-1)}>
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.month}>
          {MONTHS[cursor.month - 1]} {cursor.year}
        </Text>
        <Pressable hitSlop={12} onPress={() => shiftMonth(1)}>
          <Text style={styles.nav}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {cells.map((c, i) =>
          c === null ? (
            <View key={`b${i}`} style={styles.cell} />
          ) : (
            <View key={c.date} style={[styles.cell, c.date === today && styles.todayCell]}>
              <View style={[styles.dot, { backgroundColor: cellColor(c.kcal) }]} />
              <Text style={[styles.dayNum, c.date === today && styles.todayNum]}>{c.day}</Text>
              {c.kcal > 0 && <Text style={styles.kcal}>{c.kcal}</Text>}
            </View>
          )
        )}
      </ScrollView>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {loggedDays > 0
            ? `${loggedDays} day(s) logged · ${monthTotal.toLocaleString()} kcal this month`
            : 'No meals logged this month yet.'}
        </Text>
        {target > 0 && (
          <View style={styles.legend}>
            <Legend color={COLORS.carbs} label="under" />
            <Legend color={COLORS.protein} label="on target" />
            <Legend color={COLORS.danger} label="over" />
          </View>
        )}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: COLORS.bg },
  h1: { fontSize: 34, fontFamily: FONT.bold, color: COLORS.ink, letterSpacing: -0.5 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  nav: { fontSize: 30, fontFamily: FONT.regular, color: COLORS.calories, paddingHorizontal: 8 },
  month: { fontSize: 18, fontFamily: FONT.semibold, color: COLORS.ink },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontFamily: FONT.semibold, color: COLORS.dim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  todayCell: { backgroundColor: COLORS.card, borderRadius: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayNum: { fontSize: 14, fontFamily: FONT.semibold, color: COLORS.ink },
  todayNum: { color: COLORS.calories },
  kcal: { fontSize: 9, fontFamily: FONT.regular, color: COLORS.dim },
  summary: { paddingVertical: 16, gap: 10 },
  summaryText: { fontSize: 13, fontFamily: FONT.regular, color: COLORS.sub, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: FONT.regular, color: COLORS.dim },
});
