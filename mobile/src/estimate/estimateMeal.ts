/**
 * Full estimation for a parsed meal — AI-first:
 *  1. Ask the AI for each item's nutrition (cached; per-100g × portion grams).
 *  2. If the AI is unreachable/unconfigured or returns nothing usable,
 *     fall back to the local nutrition DB (offline safety net).
 */
import { resolveItem, type Estimate, type ParsedItem } from './resolve';
import { aiEstimate, aiEstimateAvailable } from '../ai/aiEstimate';

export async function estimateMeal(items: ParsedItem[]): Promise<Estimate[]> {
  const out: Estimate[] = [];
  for (const item of items) {
    if (aiEstimateAvailable) {
      try {
        const est = await aiEstimate(item.food, item.quantity, item.unit);
        if (est) {
          out.push({
            name: item.food,
            quantity: item.quantity,
            unit: item.unit,
            grams: Math.round(est.grams),
            calories: Math.round(est.calories),
            protein: +est.protein_g.toFixed(1),
            carbs: +est.carbs_g.toFixed(1),
            fat: +est.fat_g.toFixed(1),
            confidence: 'medium',
            matched: true,
            estimatedBy: 'ai',
          });
          continue;
        }
      } catch {
        // fall through to the local DB
      }
    }
    out.push(resolveItem(item));
  }
  return out;
}
