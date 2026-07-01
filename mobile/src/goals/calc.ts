/**
 * Goal calculation — Mifflin–St Jeor BMR → TDEE → calorie target → macro split.
 * Pure functions only (no DB). Numbers here drive the `goal` row written at onboarding.
 *
 * Refs:
 *  - Mifflin-St Jeor (1990): most accurate predictive BMR equation for the general population.
 *  - Macro split is evidence-based defaults, not fixed %: protein per-kg, fat as %kcal, carbs = remainder.
 */

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';

export type GuidedInputs = {
  sex: Sex;
  age: number; // years
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goalType: GoalType;
};

export type MacroTargets = {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
};

/** Physical Activity Level multipliers applied to BMR to get TDEE. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // little/no exercise, desk job
  light: 1.375, // light exercise 1–3 days/wk
  moderate: 1.55, // moderate exercise 3–5 days/wk
  active: 1.725, // hard exercise 6–7 days/wk
  very_active: 1.9, // very hard exercise + physical job
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (desk job, little exercise)',
  light: 'Light (exercise 1–3 days/wk)',
  moderate: 'Moderate (exercise 3–5 days/wk)',
  active: 'Active (exercise 6–7 days/wk)',
  very_active: 'Very active (hard training + physical job)',
};

export const GOAL_LABELS: Record<GoalType, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight',
};

/** Mifflin–St Jeor Basal Metabolic Rate (kcal/day). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Total Daily Energy Expenditure = BMR × activity factor. */
export function tdee(inputs: Omit<GuidedInputs, 'goalType'>): number {
  return bmr(inputs.sex, inputs.weightKg, inputs.heightCm, inputs.age) * ACTIVITY_FACTORS[inputs.activity];
}

/** Adjust maintenance calories for the chosen goal (moderate, sustainable deltas). */
export function applyGoal(maintenance: number, goalType: GoalType): number {
  if (goalType === 'lose') return maintenance - 500; // ~0.45 kg/wk deficit
  if (goalType === 'gain') return maintenance + 350; // lean surplus
  return maintenance;
}

/**
 * Split target calories into macros.
 *  - Protein: 1.6 g/kg bodyweight (supports satiety + lean mass; good for a deficit).
 *  - Fat: 25% of calories (≥ minimum for hormones), 9 kcal/g.
 *  - Carbs: remaining calories, 4 kcal/g (floored at 0).
 */
export function macroSplit(targetCalories: number, weightKg: number): Omit<MacroTargets, 'targetCalories'> {
  const proteinG = Math.round(1.6 * weightKg);
  const fatG = Math.round((targetCalories * 0.25) / 9);
  const remaining = targetCalories - (proteinG * 4 + fatG * 9);
  const carbsG = Math.max(0, Math.round(remaining / 4));
  return { targetProteinG: proteinG, targetCarbsG: carbsG, targetFatG: fatG };
}

/** Full guided pipeline: inputs → calorie target + macros. */
export function computeGuidedGoal(inputs: GuidedInputs): MacroTargets {
  const maintenance = tdee(inputs);
  // Floor at a safe minimum so aggressive inputs never produce a dangerous target.
  const floor = inputs.sex === 'male' ? 1500 : 1200;
  const targetCalories = Math.max(floor, Math.round(applyGoal(maintenance, inputs.goalType) / 10) * 10);
  return { targetCalories, ...macroSplit(targetCalories, inputs.weightKg) };
}

/** Custom mode: derive macros from a user-entered calorie target + weight (for protein per-kg). */
export function macrosFromCalories(targetCalories: number, weightKg: number): MacroTargets {
  return { targetCalories: Math.round(targetCalories), ...macroSplit(targetCalories, weightKg) };
}
