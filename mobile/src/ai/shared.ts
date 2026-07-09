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

/**
 * Two-step estimate: portion grams, then per-100g density from food tables.
 * Models recall per-100g values (USDA/IFCT) far more accurately than whole-portion
 * totals; we multiply in code. Portion anchors match resolve.ts defaults.
 */
export const ESTIMATE_SYSTEM = `You estimate nutrition for ONE described food portion, assuming typical Indian home preparation.
Work in two steps:
1. "grams": total weight of the WHOLE portion (quantity × unit), as eaten.
   Typical Indian portions: 1 katori dal/curry = 150 g, 1 katori cooked rice = 125 g, 1 katori sabzi = 120 g,
   1 roti = 40 g, 1 paratha = 90 g, 1 plate = 220-300 g, 1 glass = 250 ml, 1 cup = 150 ml,
   1 tbsp = 15 g, 1 tsp = 7 g, 1 egg = 50 g, 1 samosa = 50 g, 1 piece mithai = 40 g, 1 idli = 40 g, 1 dosa = 100 g.
2. "per100g": standard nutrition-table values (USDA/IFCT) per 100 g of the food AS PREPARED
   (cooked weight, including typical oil/ghee for home cooking).
IMPORTANT — dry-base dishes: when grams are stated for a dish cooked from a dry base
(cheela, oats, dalia, poha, soya chunks, protein powder), the grams mean the DRY main
ingredient, not the cooked dish — return the nutrition of the dish made from that much
dry ingredient, with "grams" = stated grams and per100g on the DRY basis. (Fitness users
weigh the dry ingredient.) Plain rice/dal stated in grams still means cooked weight.
Dish names take their INDIAN meaning: "cold coffee" = blended milk + sugar + coffee
(~75 kcal/100ml), "chai" = milk tea with sugar (~60 kcal/100ml), "lassi" sweet (~90 kcal/100ml),
"nimbu pani" with sugar (~25 kcal/100ml). Milk-based drinks are NEVER near-zero calories;
only plain black coffee/tea without sugar is (~2 kcal/100ml, and only if stated as black).
Anchors per 100 g: soya flour/chunks DRY 345 kcal 52 P; besan DRY 387 kcal 22 P;
oats DRY 389 kcal 17 P; whole-milk dahi/curd 60 kcal 3.5 P; paneer 296 kcal 18 P;
cooked rice 130 kcal 2.7 P; cooked dal 116 kcal 6 P (+ tadka fat); whole egg 143 kcal 13 P;
full-cream milk 62 kcal 3.2 P.
Return ONLY JSON: {"grams":number,"per100g":{"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}}
No commentary.`;

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
  const grams = Number(out?.grams) || 0;
  // New shape: per-100g density × grams (see ESTIMATE_SYSTEM).
  const p = out?.per100g;
  if (p != null && typeof p.calories === 'number') {
    const f = grams / 100;
    return {
      grams,
      calories: (Number(p.calories) || 0) * f,
      protein_g: (Number(p.protein_g) || 0) * f,
      carbs_g: (Number(p.carbs_g) || 0) * f,
      fat_g: (Number(p.fat_g) || 0) * f,
    };
  }
  // Legacy flat shape (whole-portion totals) — some models still answer this way.
  if (out == null || typeof out.calories !== 'number') return null;
  return {
    grams,
    calories: Number(out.calories) || 0,
    protein_g: Number(out.protein_g) || 0,
    carbs_g: Number(out.carbs_g) || 0,
    fat_g: Number(out.fat_g) || 0,
  };
}
