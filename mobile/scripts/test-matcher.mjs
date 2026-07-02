// Unit tests for the pure food-match ranking in src/estimate/rank.ts.
// Run from mobile/:  node scripts/test-matcher.mjs
// No test framework; rank.ts is dependency-free TS, transpiled here with the
// project's own `typescript` package and evaluated as CommonJS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// -- load rank.ts ------------------------------------------------------------
const ts = require('typescript');
const src = fs.readFileSync(path.join(root, 'src', 'estimate', 'rank.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
const { rankFoodMatches } = mod.exports;

// -- candidate fixture from the real seed, mimicking resolveItem()'s SQL -----
const seed = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'seed_foods.json'), 'utf8'));

/** Same LIKE conditions as resolveItem(): name ⊇ q, aliases ⊇ q, or q ⊇ name. */
function collectCandidates(q) {
  return seed.foods
    .filter((f) => {
      const name = f.canonical_name.toLowerCase();
      const aliases = JSON.stringify((f.aliases ?? []).map((a) => a.toLowerCase()));
      return name.includes(q) || aliases.includes(q) || q.includes(name);
    })
    .map((f) => ({
      canonicalName: f.canonical_name,
      aliases: JSON.stringify((f.aliases ?? []).map((a) => a.toLowerCase())),
    }));
}

// -- assertions ---------------------------------------------------------------
let failed = 0;
function expectMatch(query, wantName, wantConfidence) {
  const best = rankFoodMatches(query, collectCandidates(query));
  const got = best ? best.candidate.canonicalName : '(no match)';
  const conf = best ? best.confidence : '-';
  const ok = got === wantName && (!wantConfidence || conf === wantConfidence);
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  "${query}" -> "${got}" [${conf}]` +
      (ok ? '' : `  (wanted "${wantName}"${wantConfidence ? ` [${wantConfidence}]` : ''})`)
  );
}

expectMatch('paneer', 'paneer', 'high'); // NOT "paneer butter masala"
expectMatch('dal', 'toor dal (cooked)', 'high'); // plain dal via alias, not dal makhani
expectMatch('aloo paratha', 'aloo paratha', 'high'); // not "paratha (plain)"
expectMatch('chai', 'chai (with milk and sugar)', 'high'); // via alias
expectMatch('egg', 'egg', 'high'); // not egg curry/bhurji/roll
expectMatch('gobi', 'aloo gobi'); // a gobi dish; shorter-name tiebreak
expectMatch('rice', 'rice (cooked, white)', 'high'); // via alias, not jeera rice
expectMatch('paratha', 'paratha (plain)', 'high'); // via alias
expectMatch('masala chai', 'chai (with milk and sugar)', 'high'); // exact alias
expectMatch('gulab jamun', 'gulab jamun', 'high');
expectMatch('paneer butter masala', 'paneer butter masala', 'high'); // full name still exact

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
