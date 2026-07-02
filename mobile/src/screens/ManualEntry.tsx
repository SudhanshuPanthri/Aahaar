/**
 * Manual food entry — for foods the AI/DB can't resolve or when the user knows
 * the label values (packaged foods, restaurant menus). Calories/macros are for
 * the WHOLE entry (not per-100g); quantity is informational and still works
 * with the log's −/+ steppers (they rescale proportionally).
 */
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Estimate } from '../estimate/resolve';
import { FONT, useTheme, type Palette } from '../ui/theme';

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
    onSave({
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
    });
    reset();
  }

  function cancel() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
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

            <Pressable style={[styles.saveBtn, !canSave && styles.disabled]} onPress={save} disabled={!canSave}>
              <Text style={styles.saveText}>Add to today</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
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
