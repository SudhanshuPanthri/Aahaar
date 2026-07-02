/**
 * Log tab — the core loop: type a meal → Estimate → review → Add to today.
 * Shows the TODAY card (progress vs goal) and today's logged items (with delete).
 * Self-contained: reads its own data from the DB on mount / after each change.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { type Estimate } from '../estimate/resolve';
import { parseMeal } from '../ai/parseMeal';
import { estimateMeal } from '../estimate/estimateMeal';
import {
  addLogItems,
  getDayTotals,
  getDayMeals,
  deleteMeal,
  deleteLogItem,
  updateLogItemQuantity,
  type DayTotals,
  type Meal,
} from '../db/log';
import { type Goal, type LogItem, type SavedMeal } from '../db/schema';
import { getActiveGoal } from '../db/profile';
import { getLoggingStreak } from '../db/stats';
import {
  saveMeal,
  saveMealFromLog,
  listSavedMeals,
  getSavedMealItems,
  markSavedMealUsed,
  deleteSavedMeal,
} from '../db/savedMeals';
import { ProgressBar, MacroStat } from '../ui/Progress';
import ManualEntry from './ManualEntry';
import PressableScale from '../ui/PressableScale';
import { FONT, useTheme, type Palette } from '../ui/theme';

/** "2" for whole numbers, "1.5" / "0.5" otherwise. */
const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : String(+q.toFixed(2)));

export default function LogScreen({ onEditGoal }: { onEditGoal: () => void }) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [via, setVia] = useState<'ai' | 'local' | 'cache' | null>(null);
  const [rows, setRows] = useState<Estimate[]>([]);

  const [goal, setGoal] = useState<Goal | null>(null);
  const [today, setToday] = useState<DayTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);

  function refresh() {
    setToday(getDayTotals());
    setMeals(getDayMeals());
    setGoal(getActiveGoal());
    setSaved(listSavedMeals());
    setStreak(getLoggingStreak());
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

  function onDeleteSaved(meal: SavedMeal) {
    Alert.alert('Remove saved meal?', `“${meal.name}” will be removed from your saved meals.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteSavedMeal(meal.id);
          setSaved(listSavedMeals());
        },
      },
    ]);
  }

  function onDeleteMeal(m: Meal) {
    Alert.alert('Delete this meal?', `“${m.title}” (${m.calories} kcal) will be removed from today's log.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMeal(m.key);
          refresh();
        },
      },
    ]);
  }

  /** Step an item's quantity: +1 / −1, with a 0.5 stop between 1 and nothing. */
  function onStepQty(it: LogItem, dir: 1 | -1) {
    const next = dir === 1 ? (it.quantity < 1 ? 1 : it.quantity + 1) : it.quantity > 1 ? it.quantity - 1 : 0.5;
    updateLogItemQuantity(it.id, next);
    refresh();
  }

  /** Remove one item from a logged meal (removing the last item removes the meal). */
  function onDeleteItem(id: number) {
    deleteLogItem(id);
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
          <View style={styles.todayLabelRow}>
            <Text style={styles.todayLabel}>TODAY</Text>
            {streak > 1 && (
              <Animated.View entering={ZoomIn.duration(200)} style={styles.streakBadge}>
                <Ionicons name="flame" size={12} color={colors.calories} />
                <Text style={styles.streakText}>{streak}-day streak</Text>
              </Animated.View>
            )}
          </View>
          {goal ? (
            <>
              <Text style={styles.todayCal}>
                {today.calories}
                <Text style={styles.todayGoal}> / {Math.round(goal.targetCalories)} kcal</Text>
                <Text style={today.calories > goal.targetCalories ? styles.todayOver : styles.todayLeft}>
                  {today.calories > goal.targetCalories
                    ? `  ${Math.round(today.calories - goal.targetCalories)} over`
                    : `  ${Math.round(goal.targetCalories - today.calories)} left`}
                </Text>
              </Text>
              <ProgressBar value={today.calories} goal={goal.targetCalories} color={colors.calories} />
              <View style={styles.macroGrid}>
                <MacroStat label="Protein" value={today.protein} goal={goal.targetProteinG} color={colors.protein} />
                <MacroStat label="Carbs" value={today.carbs} goal={goal.targetCarbsG} color={colors.carbs} />
                <MacroStat label="Fat" value={today.fat} goal={goal.targetFatG} color={colors.fat} />
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
          placeholderTextColor={colors.placeholder}
          keyboardAppearance={mode}
          multiline
        />
        <View style={styles.btnRow}>
          <PressableScale style={[styles.btn, { flex: 1 }, busy ? styles.btnDisabled : null]} onPress={onEstimate} disabled={busy}>
            <Text style={styles.btnText}>{busy ? 'Estimating…' : 'Estimate'}</Text>
          </PressableScale>
          {/* Manual entry: log with your own numbers (labels, packaged foods). */}
          <PressableScale style={styles.manualBtn} onPress={() => setManualOpen(true)}>
            <Ionicons name="create-outline" size={18} color={colors.calories} />
            <Text style={styles.manualText}>Manual</Text>
          </PressableScale>
        </View>
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
                <PressableScale style={styles.chipMain} onPress={() => onLogSaved(m)}>
                  <Text style={styles.chipName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.chipKcal}>{m.calories} kcal</Text>
                </PressableScale>
                <Pressable hitSlop={8} onPress={() => onDeleteSaved(m)}>
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
            <Animated.View entering={FadeInDown.duration(200)} style={styles.card}>
              <View style={styles.mealTitleRow}>
                <Text style={[styles.food, { flex: 1 }]}>{text.trim()}</Text>
                {/* Star = save this meal for one-tap re-logging later. */}
                <Pressable hitSlop={10} onPress={onSaveMeal} disabled={!canAdd || alreadySaved}>
                  <Ionicons
                    name={alreadySaved ? 'star' : 'star-outline'}
                    size={24}
                    color={!canAdd ? colors.disabled : colors.calories}
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
            </Animated.View>
          </>
        ) : meals.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>TODAY'S LOG</Text>
            {meals.map((m, i) => {
              const expanded = expandedKey === m.key;
              const showSlot = !!m.mealSlot && (i === 0 || meals[i - 1].mealSlot !== m.mealSlot);
              return (
                <Fragment key={m.key}>
                {showSlot && <Text style={styles.slotLabel}>{m.mealSlot!.toUpperCase()}</Text>}
                {/* Entering/exiting fades make add/delete feel smooth; the layout
                    transition animates the card's height on expand/collapse and
                    lets remaining cards slide up after a delete. */}
                <Animated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(150)}
                  layout={LinearTransition.duration(200)}
                  style={styles.card}
                >
                  <View style={styles.rowCard}>
                    {/* Tapping the meal expands it into editable items. */}
                    <Pressable style={{ flex: 1 }} onPress={() => setExpandedKey(expanded ? null : m.key)}>
                      <Text style={styles.food}>{m.title}</Text>
                      <Text style={styles.macros}>
                        {m.calories} kcal · P {m.protein} · C {m.carbs} · F {m.fat}
                      </Text>
                      {!expanded && m.itemCount > 1 && <Text style={styles.breakdown}>{m.itemSummary}</Text>}
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => onSaveLoggedMeal(m)} disabled={isSaved(m.title)}>
                      <Ionicons name={isSaved(m.title) ? 'star' : 'star-outline'} size={20} color={colors.calories} />
                    </Pressable>
                    <Pressable hitSlop={10} onPress={() => onDeleteMeal(m)}>
                      <Text style={styles.del}>✕</Text>
                    </Pressable>
                  </View>
                  {expanded && (
                    <Animated.View entering={FadeIn.duration(180)} style={styles.itemList}>
                      {m.items.map((it) => (
                        <View key={it.id} style={styles.itemRow}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {it.foodName} <Text style={styles.itemUnit}>({it.unit})</Text>
                          </Text>
                          <Text style={styles.itemKcal}>{Math.round(it.calories)} kcal</Text>
                          <Pressable hitSlop={6} onPress={() => onStepQty(it, -1)} disabled={it.quantity <= 0.5}>
                            <Ionicons
                              name="remove-circle-outline"
                              size={24}
                              color={it.quantity <= 0.5 ? colors.disabled : colors.calories}
                            />
                          </Pressable>
                          <Text style={styles.itemQty}>{fmtQty(it.quantity)}</Text>
                          <Pressable hitSlop={6} onPress={() => onStepQty(it, 1)}>
                            <Ionicons name="add-circle-outline" size={24} color={colors.calories} />
                          </Pressable>
                          <Pressable hitSlop={8} onPress={() => onDeleteItem(it.id)}>
                            <Ionicons name="trash-outline" size={18} color={colors.faint} />
                          </Pressable>
                        </View>
                      ))}
                      <Text style={styles.itemHint}>− / + adjusts quantity · calories & macros rescale</Text>
                    </Animated.View>
                  )}
                </Animated.View>
                </Fragment>
              );
            })}
          </>
        ) : (
          <Text style={[styles.dim, { textAlign: 'center', marginTop: 24 }]}>
            Nothing logged today. Type a meal and tap Estimate.
          </Text>
        )}
      </ScrollView>

      {showEstimate && (
        <View style={styles.footer}>
          <PressableScale style={[styles.addBtn, !canAdd ? styles.btnDisabled : null]} onPress={onAdd} disabled={!canAdd}>
            <Text style={styles.addBtnText}>Add to today · {total.cal} kcal</Text>
          </PressableScale>
        </View>
      )}

      <ManualEntry
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        onSave={(est) => {
          addLogItems([est], est.name);
          setManualOpen(false);
          refresh();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  screen: { flex: 1, paddingTop: 60, backgroundColor: c.bg },
  header: { paddingHorizontal: 20, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h1: { fontSize: 34, fontFamily: FONT.bold, color: c.ink, letterSpacing: -0.5 },
  editGoal: { fontSize: 14, fontFamily: FONT.semibold, color: c.calories },
  dim: { fontSize: 13, fontFamily: FONT.regular, color: c.mute },
  sectionLabel: { fontSize: 11, fontFamily: FONT.semibold, color: c.dim, letterSpacing: 1, marginBottom: 2 },

  todayCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 16, gap: 8,
    shadowColor: c.shadow, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  todayLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayLabel: { fontSize: 11, fontFamily: FONT.semibold, color: c.dim, letterSpacing: 1 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakText: { fontSize: 11, fontFamily: FONT.semibold, color: c.calories },
  todayLeft: { fontSize: 13, fontFamily: FONT.semibold, color: c.protein, letterSpacing: 0 },
  todayOver: { fontSize: 13, fontFamily: FONT.semibold, color: c.danger, letterSpacing: 0 },
  todayCal: { fontSize: 28, fontFamily: FONT.bold, color: c.ink, marginTop: 2, letterSpacing: -0.5 },
  todayGoal: { fontSize: 16, fontFamily: FONT.regular, color: c.dim, letterSpacing: 0 },
  todayMacros: { fontSize: 13, fontFamily: FONT.regular, color: c.sub, marginTop: 2 },
  macroGrid: { flexDirection: 'row', gap: 12, marginTop: 2 },

  input: {
    borderWidth: 1, borderColor: c.inputBorder, borderRadius: 12, padding: 14,
    fontSize: 16, fontFamily: FONT.regular, minHeight: 64, textAlignVertical: 'top',
    color: c.ink, backgroundColor: c.inputBg,
  },
  btnRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  btn: { backgroundColor: c.calories, borderRadius: 12, padding: 15, alignItems: 'center' },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1.5, borderColor: c.calories, borderRadius: 12, paddingHorizontal: 14,
  },
  manualText: { fontSize: 14, fontFamily: FONT.semibold, color: c.calories },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: c.onAccent, fontSize: 16, fontFamily: FONT.bold },

  list: { flex: 1, marginTop: 10 },
  listContent: { paddingHorizontal: 20, gap: 10, paddingBottom: 16 },
  card: {
    backgroundColor: c.card, borderRadius: 12, padding: 14,
    shadowColor: c.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  slotLabel: { fontSize: 10, fontFamily: FONT.semibold, color: c.dim, letterSpacing: 1.2, marginTop: 6, marginBottom: -4 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  food: { fontSize: 16, fontFamily: FONT.semibold, color: c.ink },
  mealTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  macros: { fontSize: 13, fontFamily: FONT.regular, color: c.sub, marginTop: 4 },
  mealTotal: { fontSize: 14, fontFamily: FONT.semibold, color: c.calories, marginTop: 4 },
  breakdown: { fontSize: 12, fontFamily: FONT.regular, color: c.dim, marginTop: 4 },
  del: { fontSize: 18, fontFamily: FONT.regular, color: c.faint, paddingHorizontal: 4 },

  itemList: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { flex: 1, fontSize: 14, fontFamily: FONT.regular, color: c.ink },
  itemUnit: { fontSize: 12, color: c.dim },
  itemKcal: { fontSize: 12, fontFamily: FONT.regular, color: c.sub, marginRight: 2 },
  itemQty: { minWidth: 28, textAlign: 'center', fontSize: 15, fontFamily: FONT.semibold, color: c.ink },
  itemHint: { fontSize: 11, fontFamily: FONT.regular, color: c.dim, marginTop: 2 },

  footer: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, gap: 10,
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg,
  },
  addBtn: { backgroundColor: c.protein, borderRadius: 12, padding: 15, alignItems: 'center' },
  addBtnText: { color: c.onAccent, fontSize: 16, fontFamily: FONT.bold },

  savedWrap: { paddingTop: 12, gap: 6 },
  savedLabel: { paddingHorizontal: 20, marginBottom: 0 },
  savedRow: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.card, borderRadius: 20, paddingLeft: 14, paddingRight: 10, paddingVertical: 8,
  },
  chipMain: { maxWidth: 180 },
  chipName: { fontSize: 14, fontFamily: FONT.semibold, color: c.ink },
  chipKcal: { fontSize: 11, fontFamily: FONT.regular, color: c.calories },
  chipDel: { fontSize: 13, fontFamily: FONT.regular, color: c.faint },
});
