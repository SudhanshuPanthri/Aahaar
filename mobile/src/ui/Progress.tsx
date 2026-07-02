/** Reusable progress widgets: a thin bar and a labelled macro stat. */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FONT, useTheme, type Palette } from './theme';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

/** Horizontal progress bar for a value vs its goal (turns red when over goal). */
export function ProgressBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const over = goal > 0 && value > goal;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: over ? colors.danger : color }]} />
    </View>
  );
}

/** One macro's progress: label, value/goal, and a thin bar. */
export function MacroStat({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const styles = useStyles();
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    barTrack: { height: 6, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3 },
    macroStat: { flex: 1, gap: 4 },
    macroStatLabel: { fontSize: 11, fontFamily: FONT.semibold, color: c.dim },
    macroStatValue: { fontSize: 15, fontFamily: FONT.bold, color: c.ink },
    macroStatGoal: { fontSize: 12, fontFamily: FONT.regular, color: c.placeholder },
  });
