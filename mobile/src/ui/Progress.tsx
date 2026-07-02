/** Reusable progress widgets: a thin bar and a labelled macro stat. */
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FONT, useTheme, type Palette } from './theme';

const FILL_TIMING = { duration: 450, easing: Easing.out(Easing.cubic) };

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

  // Starts at 0 so the bar grows into place on first mount, then eases to
  // each new value as the day's totals change.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(pct, FILL_TIMING);
  }, [pct, progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as const }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: over ? colors.danger : color }, fillStyle]} />
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
