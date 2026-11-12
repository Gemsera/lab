// node gen.mjs 2026-11-08 365 → out/yyyy-mm-dd.jsonl (the Gateway's listing format)
import fs from 'node:fs';
import { readTables, listing, seedOf } from './labyrinth.js';
const load = (n) => { try { return JSON.parse(fs.readFileSync(`tables/${n}.json`, 'utf8')); } catch { return undefined; } };
const T = readTables(Object.fromEntries(['labyrinths','labyrinthsection','labyrinthsectionlayout','labyrinthsecrets','labyrinthareas','worldareas'].map(n => [n, load(n)])));
const [start = new Date().toISOString().slice(0, 10), days = '1'] = process.argv.slice(2);
fs.mkdirSync('out', { recursive: true });
const s0 = seedOf(start);
for (let d = 0; d < +days; d++) {
  const lines = listing(T, s0 + d);
  fs.writeFileSync(`out/${lines[0].date}.jsonl`, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
}
console.log(`wrote ${days} day(s) from ${start}`);
