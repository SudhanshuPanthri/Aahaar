/**
 * Builds brand/icon-mark.svg — the stacked app-icon lockup:
 * आ (large, saffron) over "haar" (smaller, ink), centred in a 120×120 viewBox.
 * Run: node make-icon-mark.mjs   (then node generate-icons.mjs)
 */
import { readFileSync, writeFileSync } from 'fs';
import opentype from 'opentype.js';

const deva = opentype.parse(readFileSync('./fonts/NotoSansDevanagari-Bold.ttf').buffer);
const latin = opentype.parse(readFileSync('./fonts/NotoSans-Bold.ttf').buffer);

// One-line lockup: आ + "haar" on a shared baseline (same layout as the
// wordmark), fitted as ONE unit into the 120 box so the pair stays aligned.
// Extract at size 100 — opentype.js emits NaN at small fractional sizes —
// and scale via a single SVG transform.
const SIZE = 100;
const TRACK = 2;
const aaGlyph = deva.charToGlyph('आ'); // glyph-level: font.getPath NaNs on Devanagari
const aaPath = aaGlyph.getPath(0, 0, SIZE);
const aaAdv = (aaGlyph.advanceWidth / deva.unitsPerEm) * SIZE;
const haarPath = latin.getPath('haar', aaAdv + TRACK, 0, SIZE);

const boxes = [aaPath.getBoundingBox(), haarPath.getBoundingBox()];
const x1 = Math.min(...boxes.map((b) => b.x1));
const y1 = Math.min(...boxes.map((b) => b.y1));
const x2 = Math.max(...boxes.map((b) => b.x2));
const y2 = Math.max(...boxes.map((b) => b.y2));

const s = 112 / (x2 - x1); // 112 usable units of the 120 box
const tx = 60 - s * ((x1 + x2) / 2);
const ty = 60 - s * ((y1 + y2) / 2);
const transform = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`;
const aa = { d: aaPath.toPathData(2), transform };
const haar = { d: haarPath.toPathData(2), transform };

const dAa = aa.d;
const dHaar = haar.d;
if ((dAa + dHaar).includes('NaN')) throw new Error('NaN in path data');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <!-- Aahaar app-icon lockup: आ over "haar" (Noto Sans Devanagari Bold +
       Noto Sans Bold, SIL OFL 1.1). Regenerate with brand/make-icon-mark.mjs. -->
  <path class="aa" fill="#e07a3f" transform="${aa.transform}" d="${dAa}"/>
  <path class="haar" fill="#1a1a1a" transform="${haar.transform}" d="${dHaar}"/>
</svg>
`;
writeFileSync('./icon-mark.svg', svg);
console.log('icon-mark.svg written');
