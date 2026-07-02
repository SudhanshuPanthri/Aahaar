/**
 * Generates every app icon asset from the आ-monogram mark into mobile/assets/.
 * Run from brand/:  npm install && node generate-icons.mjs
 *
 * Outputs:
 *   icon.png                    1024² cream, mark centred (iOS + store)
 *   android-icon-foreground.png 1024² transparent, mark inside the 66% safe zone
 *   android-icon-monochrome.png 1024² transparent, white mark (themed icons)
 *   splash-icon.png             512²  transparent, saffron mark
 *   favicon.png                 64²   cream, mark
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'mobile', 'assets');

const SAFFRON = '#e07a3f';
const CREAM = '#fdf1e9';

/** The mark, parameterised by colour and rendered edge length in px. */
// The mark is brand/icon-mark.svg (आ over "haar"). Two-tone by default;
// pass a colour to flatten both paths (monochrome/themed assets).
import { readFileSync } from 'fs';
const markSvg = readFileSync(path.join(here, 'icon-mark.svg'), 'utf8');
const mark = (color, px) => {
  let svg = markSvg.replace('<svg ', `<svg width="${px}" height="${px}" `);
  if (color) svg = svg.replace(/fill="#e07a3f"/, `fill="${color}"`).replace(/fill="#1a1a1a"/, `fill="${color}"`);
  return Buffer.from(svg);
};

const canvas = (size, background) =>
  sharp({ create: { width: size, height: size, channels: 4, background } });

async function out(pipeline, name) {
  await pipeline.png().toFile(path.join(assets, name));
  console.log('wrote', name);
}

// iOS/store icon: cream ground, mark at ~62% (iOS rounds the corners itself).
await out(
  canvas(1024, CREAM).composite([{ input: mark(null, 634) }]),
  'icon.png'
);

// Adaptive foreground: keep the whole mark inside the central Ø66% circle
// (worst-case round mask). Mark half-diagonal ≈ 58/120 of the edge → 560px fits.
await out(
  canvas(1024, { r: 0, g: 0, b: 0, alpha: 0 }).composite([{ input: mark(null, 560) }]),
  'android-icon-foreground.png'
);

await out(
  canvas(1024, { r: 0, g: 0, b: 0, alpha: 0 }).composite([{ input: mark('#ffffff', 560) }]),
  'android-icon-monochrome.png'
);

// Splash: transparent, saffron mark (splash background colour lives in app.json).
await out(
  canvas(512, { r: 0, g: 0, b: 0, alpha: 0 }).composite([{ input: mark(null, 512) }]),
  'splash-icon.png'
);

await out(
  canvas(64, CREAM).composite([{ input: mark(null, 48) }]),
  'favicon.png'
);

console.log('done →', assets);
