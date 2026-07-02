/**
 * Builds brand/wordmark.svg — "आhaar" — from Noto Sans Devanagari Bold (आ)
 * + Noto Sans Bold (haar), sharing one baseline. Two paths with classes:
 *   .aa   → the Devanagari आ (accent colour)
 *   .haar → the Latin "haar" (ink colour)
 * Run: node make-wordmark.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import opentype from 'opentype.js';

const deva = opentype.parse(readFileSync('./fonts/NotoSansDevanagari-Bold.ttf').buffer);
const latin = opentype.parse(readFileSync('./fonts/NotoSans-Bold.ttf').buffer);

const SIZE = 100;
const TRACK = 2; // small gap between आ and haar

// Glyph-level path for आ: font.getPath() emits NaN control points for
// Devanagari (opentype.js GPOS quirk); glyph.getPath() is clean.
const aaGlyph = deva.charToGlyph('आ');
const aaPath = aaGlyph.getPath(0, 0, SIZE);
const aaAdv = (aaGlyph.advanceWidth / deva.unitsPerEm) * SIZE;
const haarPath = latin.getPath('haar', aaAdv + TRACK, 0, SIZE);

const boxes = [aaPath.getBoundingBox(), haarPath.getBoundingBox()];
const x1 = Math.min(...boxes.map((b) => b.x1)) - 4;
const y1 = Math.min(...boxes.map((b) => b.y1)) - 4;
const x2 = Math.max(...boxes.map((b) => b.x2)) + 4;
const y2 = Math.max(...boxes.map((b) => b.y2)) + 4;

const dAa = aaPath.toPathData(2);
const dHaar = haarPath.toPathData(2);
if ((dAa + dHaar).includes('NaN')) throw new Error('NaN in path data');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x1.toFixed(1)} ${y1.toFixed(1)} ${(x2 - x1).toFixed(1)} ${(y2 - y1).toFixed(1)}">
  <!-- Aahaar wordmark: आ (Noto Sans Devanagari Bold) + haar (Noto Sans Bold), SIL OFL 1.1.
       Regenerate with brand/make-wordmark.mjs. -->
  <path class="aa" fill="#e07a3f" d="${dAa}"/>
  <path class="haar" fill="#1a1a1a" d="${dHaar}"/>
</svg>
`;
writeFileSync('./wordmark.svg', svg);
console.log(`wordmark.svg ${(x2 - x1).toFixed(0)}×${(y2 - y1).toFixed(0)} viewBox, ${dAa.length + dHaar.length} path chars`);
