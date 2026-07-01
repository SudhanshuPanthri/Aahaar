/**
 * Log tab — the core loop: type a meal → Estimate → review → Add to today.
 * Shows the TODAY card (progress vs goal) and today's logged items (with delete).
 * Self-contained: reads its own data from the DB on mount / after each change.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type Estimate } from '../estimate/resolve';
import { parseMeal } from '../ai/parseMeal';
import { estimateMeal } from '../estimate/estimateMeal';
import { addLogItems, getDayTotals, getDayMeals, deleteMeal, type DayTotals, type Meal } from '../db/log';
import { type Goal, type SavedMeal } from '../db/schema';
import { getActiveGoal } from '../db/profile';
import {
  saveMeal,
  saveMealFromLog,
  listSavedMeals,
  getSavedMealItems,
  markSavedMealUsed,
  deleteSavedMeal,
} from '../db/savedMeals';
import { ProgressBar, MacroStat } from '../ui/Progress';
import { COLORS, FONT } from '../ui/theme';

export default function LogScreen({ onEditGoal }: { onEditGoal: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [via, setVia] = useState<'ai' | 'local' | 'cache' | null>(null);
  const [rows, setRows] = useState<Estimate[]>([]);

  const [goal, setGoal] = useState<Goal | null>(null);
  const [today, setToday] = useState<DayTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  function refresh() {
    setToday(getDayTotals());
    setMeals(getDayMeals());
    setGoal(getActiveGoal());
    setSaved(listSavedMeals());
  }

  useEffect(refresh, []);

  async function onEstimate() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setJustSaved(false);
    try {
      const { items, via } = await parseMeal(text);
      setVia(via);
      setRows(await estimateMeal(items));
    } finally {
      setBusy(false);
    }
  }

  function onAdd() {
    const matched = rows.filter((r) => r.matched);
    if (matched.length === 0) return;
    addLogItems(matched, text);
    resetInput();
    refresh();
  }

  function resetInput() {
    setRows([]);
    setVia(null);
    setText('');
    setJustSaved(false);
  }

  /** Typing in the box; clearing it cancels a pending estimate → back to main screen. */
  function onChangeText(next: string) {
    setText(next);
    if (!next.trim()) {
      setRows([]);
      setVia(null);
      setJustSaved(false);
    }
  }

  /** Save the current estimate as a reusable named meal (no AI needed to re-log). */
  function onSaveMeal() {
    const matched = rows.filter((r) => r.matched);
    if (matched.length === 0) return;
    saveMeal(text.trim(), matched);
    setJustSaved(true);
    setSaved(listSavedMeals());
  }

  /** Log a saved meal directly — bypasses AI + resolver. */
  function onLogSaved(meal: SavedMeal) {
    const items = getSavedMealItems(meal);
    if (items.length === 0) return;
    addLogItems(items, meal.name);
    markSavedMealUsed(meal.id);
    refresh();
  }

  function onDeleteSaved(id: number) {
    deleteSavedMeal(id);
    setSaved(listSavedMeals());
  }

  function onDeleteMeal(loggedAt: string) {
    deleteMeal(loggedAt);
    refresh();
  }

  /** Save a meal that's already in today's log. */
  function onSaveLoggedMeal(m: Meal) {
    if (isSaved(m.title)) return;
    saveMealFromLog(m.title, m.key);
    setSaved(listSavedMeals());
  }

  const savedNames = new Set(saved.map((m) => m.name.trim().toLowerCase()));
  const isSaved = (name: string) => savedNames.has(name.trim().toLowerCase());
  const alreadySaved = justSaved || (!!text.trim() && isSaved(text));

  const total = rows.reduce(
    (s, r) => ({ cal: s.cal + r.calories, p: s.p + r.protein, c: s.c + r.carbs, f: s.f + r.fat }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );
  const canAdd = rows.some((r) => r.matched);
  const showEstimate = rows.length > 0;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.h1}>Aahaar</Text>
          <Pressable hitSlop={8} onPress={onEditGoal}>
            <Text style={styles.editGoal}>Edit goal</Text>
          </Pressable>
        </View>

        <View style={styles.todayCard}>
          <Text style={styles.todayLabel}>TODAY</Text>
          {goal ? (
            <>
              <Text style={styles.todayCal}>
                {today.calories}
                <Text style={styles.todayGoal}> / {Math.round(goal.targetCalories)} kcal</Text>
              </Text>
              <ProgressBar value={today.calories} goal={goal.targetCalories} color={COLORS.calories} />
              <View style={styles.macroGrid}>
                <MacroStat label="Protein" value={today.protein} goal={goal.targetProteinG} color={COLORS.protein} />
                <MacroStat label="Carbs" value={today.carbs} goal={goal.targetCarbsG} color={COLORS.carbs} />
                <MacroStat label="Fat" value={today.fat} goal={goal.targetFatG} color={COLORS.fat} />
              </View>
              <Text style={styles.todayMacros}>{today.count} item(s) logged</Text>
            </>
          ) : (
            <>
              <Text style={styles.todayCal}>{today.calories} kcal</Text>
              <Text style={styles.todayMacros}>
                P {today.protein}g · C {today.carbs}g · F {today.fat}g · {today.count} item(s)
              </Text>
            </>
          )}
        </View>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          placeholder="What did you eat? e.g. 2 roti aur ek katori dal"
          placeholderTextColor="#aaa"
          multiline
        />
        <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={onEstimate} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Estimating…' : 'Estimate'}</Text>
        </Pressable>
        {via && (
          <Text style={styles.dim}>
            parsed via {via === 'ai' ? 'AI' : via === 'cache' ? 'cache' : 'offline parser'} · {rows.length} item(s)
          </Text>
        )}
      </View>

      {!showEstimate && saved.length > 0 && (
        <View style={styles.savedWrap}>
          <Text style={[styles.sectionLabel, styles.savedLabel]}>SAVED MEALS · tap to log</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedRow}
            keyboardShouldPersistTaps="handled"
          >
            {saved.map((m) => (
              <View key={m.id} style={styles.chip}>
                <Pressable style={styles.chipMain} onPress={() => onLogSaved(m)}>
                  <Text style={styles.chipName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.chipKcal}>{m.calories} kcal</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => onDeleteSaved(m.id)}>
                  <Text style={styles.chipDel}>✕</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {showEstimate ? (
          <>
            <Text style={styles.sectionLabel}>THIS MEAL (not saved yet)</Text>
            {/* Lead with the meal the user typed + its total; breakdown is secondary. */}
            <View style={styles.card}>
              <View style={styles.mealTitleRow}>
                <Text style={[styles.food, { flex: 1 }]}>{text.trim()}</Text>
                {/* Star = save this meal for one-tap re-logging later. */}
                <Pressable hitSlop={10} onPress={onSaveMeal} disabled={!canAdd || alreadySaved}>
                  <Ionicons
                    name={alreadySaved ? 'star' : 'star-outline'}
                    size={24}
                    color={!canAdd ? '#ccc' : COLORS.calories}
                  />
                </Pressable>
              </View>
              <Text style={styles.mealTotal}>
                {total.cal} kcal · P {total.p.toFixed(0)} · C {total.c.toFixed(0)} · F {total.f.toFixed(0)}
              </Text>
              <Text style={styles.breakdown}>
                {rows.map((r) => `${r.name} ×${r.quantity}${r.matched ? '' : ' (no match)'}`).join(', ')}
              </Text>
              <Text style={styles.dim}>
                {alreadySaved ? 'Saved ★ — tap a chip anytime to re-log' : 'Tap ☆ to save this meal'}
                {rows.some((r) => r.estimatedBy === 'ai') ? ' · some items AI-estimated' : ''}
              </Text>
            </View>
          </>
        ) : meals.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>TODAY'S LOG</Text>
            {meals.map((m) => (
              <View key={m.key} style={[styles.card, styles.rowCard]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.food}>{m.title}</Text>
                  <Text style={styles.macros}>
                    {m.calories} kcal · P {m.protein} · C {m.carbs} · F {m.fat}
                    {m.mealSlot ? ` · ${m.mealSlot}` : ''}
                  </Text>
                  {m.itemCount > 1 && <Text style={styles.breakdown}>{m.itemSummary}</Text>}
                </View>
                <Pressable hitSlop={8} onPress={() => onSaveLoggedMeal(m)} disabled={isSaved(m.title)}>
                  <Ionicons name={isSaved(m.title) ? 'star' : 'star-outline'} size={20} color={COLORS.calories} />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => onDeleteMeal(m.key)}>
                  <Text style={styles.del}>✕</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : (
          <Text style={[styles.dim, { textAlign: 'center', marginTop: 24 }]}>
            Nothing logged today. Type a meal and tap Estimate.
          </Text>
        )}
      </ScrollView>

      {showEstimate && (
        <View style={styles.footer}>
          <Pressable style={[styles.addBtn, !canAdd && styles.btnDisabled]} onPress={onAdd} disabled={!canAdd}>
            <Text style={styles.addBtnText}>Add to today · {total.cal} kcal</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 60, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h1: { fontSize: 34, fontFamily: FONT.bold, color: COLORS.ink, letterSpacing: -0.5 },
  editGoal: { fontSize: 14, fontFamily: FONT.semibold, color: COLORS.calories },
  dim: { fontSize: 13, fontFamily: FONT.regular, color: '#888' },
  sectionLabel: { fontSize: 11, fontFamily: FONT.semibold, color: COLORS.dim, letterSpacing: 1, marginBottom: 2 },

  todayCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, gap: 8 },
  todayLabel: { fontSize: 11, fontFamily: FONT.semibold, color: COLORS.dim, letterSpacing: 1 },
  todayCal: { fontSize: 28, fontFamily: FONT.bold, color: COLORS.ink, marginTop: 2, letterSpacing: -0.5 },
  todayGoal: { fontSize: 16, fontFamily: FONT.regular, color: COLORS.dim, letterSpacing: 0 },
  todayMacros: { fontSize: 13, fontFamily: FONT.regular, color: COLORS.sub, marginTop: 2 },
  macroGrid: { flexDirection: 'row', gap: 12, marginTop: 2 },

  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14,
    fontSize: 16, fontFamily: FONT.regular, minHeight: 64, textAlignVertical: 'top',
    color: COLORS.ink, backgroundColor: '#fff',
  },
  btn: { backgroundColor: COLORS.calories, borderRadius: 12, padding: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontFamily: FONT.bold },

  list: { flex: 1, marginTop: 10 },
  listContent: { paddingHorizontal: 20, gap: 10, paddingBottom: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  food: { fontSize: 16, fontFamily: FONT.semibold, color: COLORS.ink },
  mealTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  macros: { fontSize: 13, fontFamily: FONT.regular, color: COLORS.sub, marginTop: 4 },
  mealTotal: { fontSize: 14, fontFamily: FONT.semibold, color: COLORS.calories, marginTop: 4 },
  breakdown: { fontSize: 12, fontFamily: FONT.regular, color: COLORS.dim, marginTop: 4 },
  del: { fontSize: 18, fontFamily: FONT.regular, color: '#bbb', paddingHorizontal: 4 },

  footer: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, gap: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#fff',
  },
  addBtn: { backgroundColor: COLORS.protein, borderRadius: 12, padding: 15, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontFamily: FONT.bold },

  savedWrap: { paddingTop: 12, gap: 6 },
  savedLabel: { paddingHorizontal: 20, marginBottom: 0 },
  savedRow: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, borderRadius: 20, paddingLeft: 14, paddingRight: 10, paddingVertical: 8,
  },
  chipMain: { maxWidth: 180 },
  chipName: { fontSize: 14, fontFamily: FONT.semibold, color: COLORS.ink },
  chipKcal: { fontSize: 11, fontFamily: FONT.regular, color: COLORS.calories },
  chipDel: { fontSize: 13, fontFamily: FONT.regular, color: '#bbb' },
});
