/** Reusable progress widgets: a thin bar and a labelled macro stat. */
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT } from './theme';

/** Horizontal progress bar for a value vs its goal (turns red when over goal). */
export function ProgressBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const over = goal > 0 && value > goal;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: over ? COLORS.danger : color }]} />
    </View>
  );
}

/** One macro's progress: label, value/goal, and a thin bar. */
export function MacroStat({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  return (
    <View style={styles.macroStat}>
      <Text style={styles.macroStatLabel}>{label}</Text>
      <Text style={styles.macroStatValue}>
        {Math.round(value)}
        <Text style={styles.macroStatGoal}>/{Math.round(goal)}g</Text>
      </Text>
      <ProgressBar value={value} goal={goal} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  barTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.track, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  macroStat: { flex: 1, gap: 4 },
  macroStatLabel: { fontSize: 11, fontFamily: FONT.semibold, color: COLORS.dim },
  macroStatValue: { fontSize: 15, fontFamily: FONT.bold, color: COLORS.ink },
  macroStatGoal: { fontSize: 12, fontFamily: FONT.regular, color: '#aaa' },
});
