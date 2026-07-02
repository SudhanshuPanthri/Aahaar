/**
 * Manual food entry — for foods the AI/DB can't resolve or when the user knows
 * the label values (packaged foods, restaurant menus). Calories/macros are for
 * the WHOLE entry (not per-100g); quantity is informational and still works
 * with the log's −/+ steppers (they rescale proportionally).
 */
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Estimate } from '../estimate/resolve';
import PressableScale from '../ui/PressableScale';
import { FONT, useTheme, type Palette } from '../ui/theme';

const SHEET_IN = { duration: 260, easing: Easing.out(Easing.cubic) };
const SHEET_OUT = { duration: 200, easing: Easing.in(Easing.cubic) };

export default function ManualEntry({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (estimate: Estimate) => void;
}) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height: winH } = useWindowDimensions();

  // 0 = hidden, 1 = fully open. Drives both the backdrop fade and the sheet
  // slide-up; a manual timing (not Modal's animationType) so we can also play
  // a graceful exit before actually closing.
  const openness = useSharedValue(0);
  useEffect(() => {
    if (visible) openness.value = withTiming(1, SHEET_IN);
    else openness.value = 0; // reset so the next open animates from hidden
  }, [visible, openness]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: openness.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - openness.value) * winH }] }));

  function animateClose(after: () => void) {
    openness.value = withTiming(0, SHEET_OUT, (finished) => {
      if (finished) runOnJS(after)();
    });
  }

  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const num = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const canSave = name.trim().length > 0 && num(kcal) > 0;

  function reset() {
    setName(''); setQty('1'); setUnit('serving'); setKcal(''); setProtein(''); setCarbs(''); setFat('');
  }

  function save() {
    if (!canSave) return;
    const estimate: Estimate = {
      name: name.trim(),
      quantity: num(qty) || 1,
      unit: unit.trim() || 'serving',
      grams: 0, // unknown — macros are entered directly, not derived per-100g
      calories: Math.round(num(kcal)),
      protein: +num(protein).toFixed(1),
      carbs: +num(carbs).toFixed(1),
      fat: +num(fat).toFixed(1),
      confidence: 'high',
      matched: true,
      estimatedBy: 'user',
    };
    animateClose(() => {
      onSave(estimate);
      reset();
    });
  }

  function cancel() {
    animateClose(() => {
      reset();
      onClose();
    });
  }

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={cancel}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>Manual entry</Text>
            <Text style={styles.sub}>Log a food with your own numbers — handy for packaged foods and labels.</Text>

            <Text style={styles.label}>FOOD NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. protein bar, office lunch thali"
              placeholderTextColor={colors.placeholder}
              keyboardAppearance={mode}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>QUANTITY</Text>
                <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="numeric" keyboardAppearance={mode} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>UNIT</Text>
                <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="serving / piece / katori" placeholderTextColor={colors.placeholder} keyboardAppearance={mode} />
              </View>
            </View>

            <Text style={styles.label}>CALORIES (kcal, total for this entry)</Text>
            <TextInput style={styles.input} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholder="e.g. 220" placeholderTextColor={colors.placeholder} keyboardAppearance={mode} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>PROTEIN g</Text>
                <TextInput style={styles.input} value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.placeholder} keyboardAppearance={mode} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>CARBS g</Text>
                <TextInput style={styles.input} value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.placeholder} keyboardAppearance={mode} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>FAT g</Text>
                <TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.placeholder} keyboardAppearance={mode} />
              </View>
            </View>

            <PressableScale style={[styles.saveBtn, !canSave ? styles.disabled : null]} onPress={save} disabled={!canSave}>
              <Text style={styles.saveText}>Add to today</Text>
            </PressableScale>
            <Pressable style={styles.cancelBtn} onPress={cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.overlay },
  sheet: { backgroundColor: c.sheet, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  content: { padding: 20, paddingBottom: 34, gap: 8 },
  title: { fontSize: 22, fontFamily: FONT.bold, color: c.ink, letterSpacing: -0.3 },
  sub: { fontSize: 13, fontFamily: FONT.regular, color: c.sub, marginBottom: 6 },
  label: { fontSize: 11, fontFamily: FONT.semibold, color: c.dim, letterSpacing: 1, marginTop: 6, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, fontFamily: FONT.regular, color: c.ink, backgroundColor: c.inputBg,
  },
  row: { flexDirection: 'row', gap: 10 },
  saveBtn: { backgroundColor: c.protein, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 14 },
  saveText: { color: c.onAccent, fontSize: 16, fontFamily: FONT.bold },
  disabled: { opacity: 0.5 },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancelText: { fontSize: 15, fontFamily: FONT.semibold, color: c.dim },
});
