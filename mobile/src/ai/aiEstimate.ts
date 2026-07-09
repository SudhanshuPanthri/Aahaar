/**
 * Provider-agnostic AI nutrition estimate:
 * cache → Worker proxy (production) → Ollama → OpenAI-compatible → Groq.
 * Validated results are cached so repeat foods never hit the network.
 */
import { ollamaAvailable, ollamaEstimate } from './ollama';
import { groqAvailable, groqEstimate } from './groq';
import { openaiCompatAvailable, openaiCompatEstimate } from './openaiCompat';
import { getCachedEstimate, putCachedEstimate } from '../db/parseCache';
import { normalizeNutrition, type AiNutrition } from './shared';

const PARSER_URL = process.env.EXPO_PUBLIC_PARSER_URL;

export const aiEstimateAvailable = !!PARSER_URL || ollamaAvailable || groqAvailable || openaiCompatAvailable;

/** Estimate via the Cloudflare Worker proxy (key lives server-side). */
async function workerEstimate(food: string, quantity: number, unit: string, timeoutMs = 15000): Promise<AiNutrition | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${PARSER_URL!.replace(/\/$/, '')}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food, quantity, unit }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`estimate proxy ${res.status}`);
    return normalizeNutrition(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Guardrails on raw model output (values are for the WHOLE portion, with
 * `grams` as the portion size). Returns null — treated upstream as unmatched,
 * never logged as zeros — when values are missing/NaN/negative or all zero.
 * Clamps implausible per-100g densities (kcal ≤ 900, protein ≤ 90,
 * carbs/fat ≤ 100 per 100 g), and when the model's kcal disagrees with 4-4-9
 * macro math by >25%, recomputes calories from the macros (macros are more
 * often right than the headline kcal). estimateMeal() already flags every AI
 * estimate confidence 'low'.
 */
export function validateAiNutrition(r: AiNutrition | null): AiNutrition | null {
  if (!r) return null;
  const vals = [r.grams, r.calories, r.protein_g, r.carbs_g, r.fat_g];
  if (vals.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return null;
  if (r.grams <= 0) return null; // no portion size → nothing usable
  if (r.calories <= 0 && r.protein_g + r.carbs_g + r.fat_g <= 0) return null; // all zeros

  // clamp per-100g density into plausible food ranges
  const f = r.grams / 100;
  let calories = Math.min(r.calories, 900 * f);
  const protein_g = Math.min(r.protein_g, 90 * f);
  const carbs_g = Math.min(r.carbs_g, 100 * f);
  const fat_g = Math.min(r.fat_g, 100 * f);

  // 4-4-9 reconciliation (skipped under 20 kcal, where the ratio is noise)
  const kcalFromMacros = 4 * protein_g + 4 * carbs_g + 9 * fat_g;
  if (calories <= 0 || (calories >= 20 && Math.abs(kcalFromMacros - calories) / calories > 0.25)) {
    calories = kcalFromMacros;
  }

  return { grams: r.grams, calories, protein_g, carbs_g, fat_g };
}

type Provider = { available: boolean; estimate: (f: string, q: number, u: string) => Promise<AiNutrition | null> };

export async function aiEstimate(food: string, quantity: number, unit: string): Promise<AiNutrition | null> {
  const cached = getCachedEstimate(food, quantity, unit);
  if (cached) return cached; // only validated results are ever cached

  const providers: Provider[] = [
    { available: !!PARSER_URL, estimate: workerEstimate },
    { available: ollamaAvailable, estimate: ollamaEstimate },
    { available: openaiCompatAvailable, estimate: openaiCompatEstimate },
    { available: groqAvailable, estimate: groqEstimate },
  ];
  for (const p of providers) {
    if (!p.available) continue;
    try {
      const r = validateAiNutrition(await p.estimate(food, quantity, unit));
      if (r) {
        putCachedEstimate(food, quantity, unit, r);
        return r;
      }
    } catch {
      // fall through to the next provider
    }
  }
  return null;
}
