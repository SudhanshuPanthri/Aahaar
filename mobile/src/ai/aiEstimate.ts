/** Provider-agnostic AI nutrition estimate: Ollama → OpenAI-compatible (primary) → Groq. */
import { ollamaAvailable, ollamaEstimate } from './ollama';
import { groqAvailable, groqEstimate } from './groq';
import { openaiCompatAvailable, openaiCompatEstimate } from './openaiCompat';
import type { AiNutrition } from './shared';

export const aiEstimateAvailable = ollamaAvailable || groqAvailable || openaiCompatAvailable;

export async function aiEstimate(food: string, quantity: number, unit: string): Promise<AiNutrition | null> {
  if (ollamaAvailable) {
    try {
      const r = await ollamaEstimate(food, quantity, unit);
      if (r) return r;
    } catch {
      // fall through
    }
  }
  if (openaiCompatAvailable) {
    try {
      const r = await openaiCompatEstimate(food, quantity, unit);
      if (r) return r;
    } catch {
      // fall through
    }
  }
  if (groqAvailable) {
    try {
      return await groqEstimate(food, quantity, unit);
    } catch {
      // fall through
    }
  }
  return null;
}
