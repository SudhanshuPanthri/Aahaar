/**
 * Extracts the आ glyph outline from Noto Sans Devanagari Bold (OFL) and writes
 * brand/logo.svg — a 120×120 viewBox with the glyph path centred.
 * Run: node extract-glyph.mjs   (then node generate-icons.mjs)
 */
import { readFileSync, writeFileSync } from 'fs';
import opentype from 'opentype.js';

const font = opentype.parse(readFileSync('./fonts/NotoSansDevanagari-Bold.ttf').buffer);
const glyph = font.charToGlyph('आ');

// Measure at a reference size, then re-draw at the fitted size with the pen
// offset so the glyph lands centred — no command mutation.
const REF = 100;
const bb = glyph.getPath(0, 0, REF).getBoundingBox();
const w = bb.x2 - bb.x1;
const h = bb.y2 - bb.y1;
const size = REF * (86 / Math.max(w, h)); // 86 usable units in the 120 box
const s = size / REF;
const penX = (120 - w * s) / 2 - bb.x1 * s;
const penY = (120 - h * s) / 2 - bb.y1 * s;
const d = glyph.getPath(penX, penY, size).toPathData(2);
if (d.includes('NaN')) throw new Error('NaN in path data');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <!-- Aahaar brand mark: आ from Noto Sans Devanagari Bold (SIL OFL 1.1).
       Regenerate with brand/extract-glyph.mjs; assets with generate-icons.mjs. -->
  <path fill="#e07a3f" d="${d}"/>
</svg>
`;
writeFileSync('./logo.svg', svg);
console.log(`glyph ${w.toFixed(0)}×${h.toFixed(0)} @${REF} → logo.svg (${d.length} path chars)`);
