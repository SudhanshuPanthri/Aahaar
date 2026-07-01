/** Shared prompts, types, and response normalizers used by all AI providers. */
import type { ParsedItem } from '../estimate/resolve';

export const PARSE_SYSTEM = `You extract the foods, quantities, and units from a meal description (English or Hinglish).
Output ONLY JSON: {"items":[{"food":string,"quantity":number,"unit":string}],"unparsed":string[]}
- Do NOT estimate calories here. Extraction only.
- Normalize Hinglish/Hindi to common English food names (chawal->rice, anda->egg).
- Convert Hindi numbers: ek=1, do=2, teen=3, aadha/half=0.5, paav=0.25, dedh=1.5.
- unit ∈ [g, ml, katori, roti, piece, glass, cup, tbsp, tsp, plate, bowl, handful, serving]. Unstated → unit "serving".
- CRITICAL — quantity binding: a number applies ONLY to the single food that immediately follows it.
  Every other food defaults to quantity 1. NEVER copy one number onto several foods.
- Split into separate items only for genuinely distinct foods; keep a described dish as one food.
Examples:
  "5 eggs cheese toast" -> {"items":[{"food":"egg","quantity":5,"unit":"piece"},{"food":"cheese slice","quantity":1,"unit":"piece"},{"food":"toast","quantity":1,"unit":"piece"}],"unparsed":[]}
  "2 roti aur ek katori dal" -> {"items":[{"food":"roti","quantity":2,"unit":"roti"},{"food":"dal","quantity":1,"unit":"katori"}],"unparsed":[]}
  "chicken biryani" -> {"items":[{"food":"chicken biryani","quantity":1,"unit":"plate"}],"unparsed":[]}
Return only JSON.`;

export const ESTIMATE_SYSTEM = `You estimate nutrition for ONE described food portion, assuming typical Indian home preparation.
Return ONLY JSON: {"grams":number,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}
Values are for the WHOLE portion described (quantity × unit), not per 100g. Be realistic; no commentary.`;

export type AiNutrition = {
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function normalizeItems(out: any): ParsedItem[] {
  const items = Array.isArray(out?.items) ? out.items : [];
  return items
    .map((r: any) => {
      const food = typeof r?.food === 'string' ? r.food.trim() : '';
      if (!food) return null;
      const quantity = typeof r?.quantity === 'number' && r.quantity > 0 ? r.quantity : 1;
      const unit = typeof r?.unit === 'string' && r.unit.trim() ? r.unit.trim() : 'serving';
      return { food, quantity, unit } as ParsedItem;
    })
    .filter((x: ParsedItem | null): x is ParsedItem => x !== null);
}

export function normalizeNutrition(out: any): AiNutrition | null {
  if (out == null || typeof out.calories !== 'number') return null;
  return {
    grams: Number(out.grams) || 0,
    calories: Number(out.calories) || 0,
    protein_g: Number(out.protein_g) || 0,
    carbs_g: Number(out.carbs_g) || 0,
    fat_g: Number(out.fat_g) || 0,
  };
}
