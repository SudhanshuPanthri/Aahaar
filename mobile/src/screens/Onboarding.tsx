/**
 * Onboarding / edit-goal screen.
 *  - Guided: demographics → Mifflin–St Jeor → calorie + macro target.
 *  - Custom: enter a calorie target directly; macros derived from it.
 * Writes `profile` + `weight_log` + `goal`, then calls onDone().
 *
 * Reused for "edit goal" — prefills from existing profile/weight/goal when present.
 */
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  computeGuidedGoal,
  macrosFromCalories,
  type ActivityLevel,
  type GoalType,
  type Sex,
} from '../goals/calc';
import { addWeight, getActiveGoal, getLatestWeight, getProfile, saveGoal, saveProfile } from '../db/profile';

const FONT = { regular: 'Inter_400Regular', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' };
const CURRENT_YEAR = new Date().getFullYear();

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const GOALS = Object.keys(GOAL_LABELS) as GoalType[];

type Mode = 'guided' | 'custom';

function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const existingProfile = getProfile();
  const existingGoal = getActiveGoal();
  const existingWeight = getLatestWeight();

  const [mode, setMode] = useState<Mode>((existingGoal?.mode as Mode) ?? 'guided');
  const [sex, setSex] = useState<Sex>((existingProfile?.sex as Sex) ?? 'male');
  const [age, setAge] = useState(existingProfile?.birthYear ? String(CURRENT_YEAR - existingProfile.birthYear) : '');
  const [height, setHeight] = useState(existingProfile?.heightCm ? String(existingProfile.heightCm) : '');
  const [weight, setWeight] = useState(existingWeight ? String(existingWeight) : '');
  const [activity, setActivity] = useState<ActivityLevel>((existingProfile?.activityLevel as ActivityLevel) ?? 'light');
  const [goalType, setGoalType] = useState<GoalType>((existingGoal?.goalType as GoalType) ?? 'maintain');
  const [customCalories, setCustomCalories] = useState(existingGoal ? String(Math.round(existingGoal.targetCalories)) : '');

  const isEdit = existingProfile != null && existingGoal != null;

  // Live preview of the computed target so the user sees the result before saving.
  const preview = useMemo(() => {
    const w = num(weight);
    if (mode === 'guided') {
      const a = num(age);
      const h = num(height);
      if (w <= 0 || a <= 0 || h <= 0) return null;
      return computeGuidedGoal({ sex, age: a, heightCm: h, weightKg: w, activity, goalType });
    }
    const cal = num(customCalories);
    if (cal <= 0) return null;
    // In custom mode weight is optional; fall back to 70 kg for the protein-per-kg heuristic.
    return macrosFromCalories(cal, w > 0 ? w : 70);
  }, [mode, sex, age, height, weight, activity, goalType, customCalories]);

  const canSave = preview != null && (mode === 'custom' || num(weight) > 0);

  function onSave() {
    if (!preview) return;
    const w = num(weight);

    if (mode === 'guided') {
      saveProfile({
        sex,
        birthYear: CURRENT_YEAR - num(age),
        heightCm: num(height),
        activityLevel: activity,
      });
      if (w > 0) addWeight(w);
      saveGoal(preview, 'guided', goalType);
    } else {
      // Custom: persist whatever demographics we have so the profile isn't empty.
      saveProfile({
        sex,
        birthYear: num(age) > 0 ? CURRENT_YEAR - num(age) : (existingProfile?.birthYear ?? 0) || CURRENT_YEAR - 30,
        heightCm: num(height) || existingProfile?.heightCm || 0,
        activityLevel: activity,
      });
      if (w > 0) addWeight(w);
      saveGoal(preview, 'custom', goalType);
    }
    onDone();
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>{isEdit ? 'Edit your goal' : 'Welcome to Aahaar'}</Text>
        <Text style={styles.sub}>
          {isEdit ? 'Update your details to recalculate your target.' : "Let's set a daily calorie & macro target."}
        </Text>

        {/* Mode toggle */}
        <View style={styles.segment}>
          {(['guided', 'custom'] as Mode[]).map((m) => (
            <Pressable key={m} style={[styles.segBtn, mode === m && styles.segBtnActive]} onPress={() => setMode(m)}>
              <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                {m === 'guided' ? 'Guided' : 'Custom'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'guided' ? (
          <>
            <Text style={styles.label}>Sex</Text>
            <Row>
              {(['male', 'female'] as Sex[]).map((s) => (
                <Pill key={s} active={sex === s} onPress={() => setSex(s)} label={s === 'male' ? 'Male' : 'Female'} />
              ))}
            </Row>

            <View style={styles.grid}>
              <Field label="Age" value={age} onChange={setAge} suffix="yrs" />
              <Field label="Height" value={height} onChange={setHeight} suffix="cm" />
              <Field label="Weight" value={weight} onChange={setWeight} suffix="kg" />
            </View>

            <Text style={styles.label}>Activity level</Text>
            {ACTIVITIES.map((a) => (
              <Pressable key={a} style={[styles.opt, activity === a && styles.optActive]} onPress={() => setActivity(a)}>
                <Text style={[styles.optText, activity === a && styles.optTextActive]}>{ACTIVITY_LABELS[a]}</Text>
              </Pressable>
            ))}

            <Text style={styles.label}>Goal</Text>
            <Row>
              {GOALS.map((g) => (
                <Pill key={g} active={goalType === g} onPress={() => setGoalType(g)} label={GOAL_LABELS[g]} />
              ))}
            </Row>
          </>
        ) : (
          <>
            <Field label="Daily calorie target" value={customCalories} onChange={setCustomCalories} suffix="kcal" />
            <Field label="Weight (optional, for protein target)" value={weight} onChange={setWeight} suffix="kg" />
            <Text style={styles.hint}>Macros are split as 1.6 g/kg protein, 25% fat, the rest carbs.</Text>
          </>
        )}

        {/* Live preview */}
        {preview && (
          <View style={styles.preview}>
            <Text style={styles.previewCal}>{preview.targetCalories} kcal / day</Text>
            <Text style={styles.previewMacros}>
              Protein {preview.targetProteinG}g · Carbs {preview.targetCarbsG}g · Fat {preview.targetFatG}g
            </Text>
          </View>
        )}

        <Pressable style={[styles.saveBtn, !canSave && styles.disabled]} onPress={onSave} disabled={!canSave}>
          <Text style={styles.saveText}>{isEdit ? 'Save changes' : 'Start tracking'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Small presentational helpers ──────────────────────────────────────── */

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Pill({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  suffix?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#bbb"
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 72, paddingBottom: 48, gap: 12 },
  h1: { fontSize: 30, fontFamily: FONT.bold, color: '#1a1a1a', letterSpacing: -0.5 },
  sub: { fontSize: 15, fontFamily: FONT.regular, color: '#666', marginBottom: 8 },
  label: { fontSize: 13, fontFamily: FONT.semibold, color: '#888', marginTop: 8 },
  hint: { fontSize: 12, fontFamily: FONT.regular, color: '#999', marginTop: 2 },

  segment: { flexDirection: 'row', backgroundColor: '#f0f0f2', borderRadius: 12, padding: 4, marginVertical: 4 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  segBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 15, fontFamily: FONT.semibold, color: '#888' },
  segTextActive: { color: '#1a1a1a' },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, fontFamily: FONT.semibold, color: '#1a1a1a' },
  suffix: { fontSize: 13, fontFamily: FONT.regular, color: '#999' },

  pill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#e07a3f', borderColor: '#e07a3f' },
  pillText: { fontSize: 14, fontFamily: FONT.semibold, color: '#555' },
  pillTextActive: { color: '#fff' },

  opt: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fafafa' },
  optActive: { borderColor: '#e07a3f', backgroundColor: '#fdf3ec' },
  optText: { fontSize: 14, fontFamily: FONT.regular, color: '#555' },
  optTextActive: { color: '#1a1a1a', fontFamily: FONT.semibold },

  preview: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 18, marginTop: 12 },
  previewCal: { fontSize: 24, fontFamily: FONT.bold, color: '#fff', letterSpacing: -0.4 },
  previewMacros: { fontSize: 14, fontFamily: FONT.regular, color: '#ccc', marginTop: 4 },

  saveBtn: { backgroundColor: '#e07a3f', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontSize: 16, fontFamily: FONT.bold },
  disabled: { opacity: 0.4 },
});
