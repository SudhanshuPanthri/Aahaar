/**
 * Full estimation for a parsed meal:
 *  1. Resolve each item against the local nutrition DB (accurate, DB-first).
 *  2. For items the DB can't match, ask the AI to estimate nutrition
 *     (long-tail coverage, flagged low-confidence + estimatedBy: 'ai').
 *
 * This keeps DB accuracy for known foods while letting the AI handle anything
 * else — so the app works for foods outside the seed list.
 */
import { resolveItem, type Estimate, type ParsedItem } from './resolve';
import { aiEstimate, aiEstimateAvailable } from '../ai/aiEstimate';

export async function estimateMeal(items: ParsedItem[]): Promise<Estimate[]> {
  const out: Estimate[] = [];
  for (const item of items) {
    const r = resolveItem(item);
    if (r.matched || !aiEstimateAvailable) {
      out.push(r);
      continue;
    }
    // DB miss + AI available → let the AI estimate this food's nutrition.
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
          confidence: 'low',
          matched: true,
          estimatedBy: 'ai',
        });
        continue;
      }
    } catch {
      // fall through to the unmatched result
    }
    out.push(r);
  }
  return out;
}
