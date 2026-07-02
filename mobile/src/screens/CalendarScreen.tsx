/**
 * Calendar tab — a month grid showing per-day calories, coloured vs the goal.
 * Tap ‹ / › to change month; tap a day to see the meals logged that day.
 * Purely local reads; no network.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDailyTotalsInRange } from '../db/stats';
import { getDayMeals, todayLocalDate } from '../db/log';
import { getActiveGoal } from '../db/profile';
import { FONT, useTheme, type Palette } from '../ui/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const today = todayLocalDate();
  const [y0, m0] = today.split('-').map(Number);
  const [cursor, setCursor] = useState({ year: y0, month: m0 }); // month is 1-based
  const [selected, setSelected] = useState<string | null>(null); // "YYYY-MM-DD"
  const goal = useMemo(() => getActiveGoal(), []);
  const target = goal?.targetCalories ?? 0;

  const selectedMeals = useMemo(() => (selected ? getDayMeals(selected) : []), [selected]);

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
    setSelected(null);
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
    if (target === 0) return colors.calories;
    if (kcal > target * 1.1) return colors.danger; // notably over
    if (kcal >= target * 0.9) return colors.protein; // on target
    return colors.carbs; // under
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {cells.map((c, i) =>
            c === null ? (
              <View key={`b${i}`} style={styles.cell} />
            ) : (
              <Pressable
                key={c.date}
                style={[
                  styles.cell,
                  c.date === today && styles.todayCell,
                  c.date === selected && styles.selectedCell,
                ]}
                onPress={() => setSelected((s) => (s === c.date ? null : c.date))}
              >
                <View style={[styles.dot, { backgroundColor: cellColor(c.kcal) }]} />
                <Text style={[styles.dayNum, c.date === today && styles.todayNum]}>{c.day}</Text>
                {c.kcal > 0 && <Text style={styles.kcal}>{c.kcal}</Text>}
              </Pressable>
            )
          )}
        </View>

        {selected && (
          <View style={styles.dayPanel}>
            <Text style={styles.dayPanelTitle}>
              {selected === today ? 'TODAY' : selected} ·{' '}
              {selectedMeals.length > 0
                ? `${Math.round(selectedMeals.reduce((s, m) => s + m.calories, 0))} kcal`
                : 'nothing logged'}
            </Text>
            {selectedMeals.map((m) => (
              <View key={m.key} style={styles.mealCard}>
                <Text style={styles.mealTitle}>{m.title}</Text>
                <Text style={styles.mealMacros}>
                  {m.calories} kcal · P {m.protein} · C {m.carbs} · F {m.fat}
                  {m.mealSlot ? ` · ${m.mealSlot}` : ''}
                </Text>
                {m.itemCount > 1 && <Text style={styles.mealBreakdown}>{m.itemSummary}</Text>}
              </View>
            ))}
          </View>
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
            <Legend color={colors.carbs} label="under" styles={styles} />
            <Legend color={colors.protein} label="on target" styles={styles} />
            <Legend color={colors.danger} label="over" styles={styles} />
          </View>
        )}
      </View>
    </View>
  );
}

function Legend({ color, label, styles }: { color: string; label: string; styles: Styles }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  screen: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: c.bg },
  h1: { fontSize: 34, fontFamily: FONT.bold, color: c.ink, letterSpacing: -0.5 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  nav: { fontSize: 30, fontFamily: FONT.regular, color: c.calories, paddingHorizontal: 8 },
  month: { fontSize: 18, fontFamily: FONT.semibold, color: c.ink },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontFamily: FONT.semibold, color: c.dim },
  scrollContent: { paddingTop: 6, paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  todayCell: { backgroundColor: c.card, borderRadius: 10 },
  selectedCell: { borderWidth: 1.5, borderColor: c.calories, borderRadius: 10 },

  dayPanel: { marginTop: 12, gap: 8 },
  dayPanelTitle: { fontSize: 11, fontFamily: FONT.semibold, color: c.dim, letterSpacing: 1 },
  mealCard: { backgroundColor: c.card, borderRadius: 12, padding: 12 },
  mealTitle: { fontSize: 15, fontFamily: FONT.semibold, color: c.ink },
  mealMacros: { fontSize: 12, fontFamily: FONT.regular, color: c.sub, marginTop: 3 },
  mealBreakdown: { fontSize: 11, fontFamily: FONT.regular, color: c.dim, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayNum: { fontSize: 14, fontFamily: FONT.semibold, color: c.ink },
  todayNum: { color: c.calories },
  kcal: { fontSize: 9, fontFamily: FONT.regular, color: c.dim },
  summary: { paddingVertical: 16, gap: 10 },
  summaryText: { fontSize: 13, fontFamily: FONT.regular, color: c.sub, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: FONT.regular, color: c.dim },
});

type Styles = ReturnType<typeof makeStyles>;
