// node build.mjs [from yyyy-mm-dd] [days] → index.html: the page with the day layouts inlined (no game tables).
import fs from 'node:fs';
import { readTables, listing, seedOf } from './labyrinth.js';
import { makeTier, shortestWay, holding } from './lab-view.js';

const load = (n) => { try { return JSON.parse(fs.readFileSync(`tables/${n}.json`, 'utf8')); } catch { return undefined; } };
const T = readTables(Object.fromEntries(['labyrinths', 'labyrinthsection', 'labyrinthsectionlayout', 'labyrinthsecrets',
  'labyrinthareas', 'worldareas'].map((n) => [n, load(n)])));

// Each lab area's exits on the minimap (tables/labexits.json, from the room graphs' "entranceN" nodes: degrees
// counter-clockwise from the minimap's right). entranceN leads to the room's N-th link.
const EXITS = load('labexits') ?? {};
const today = new Date().toISOString().slice(0, 10);
const [from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), count = '396'] = process.argv.slice(2);
const ids = [], idOf = (id) => { let i = ids.indexOf(id); if (i < 0) { i = ids.length; ids.push(id); } return i; };
const tiers = T.labyrinths.map((l) => l.name);
const days = [];
for (let d = 0; d < +count; d++) {
  const lines = listing(T, seedOf(from) + d);
  const byTier = T.labyrinths.map(() => []);
  for (const r of lines.filter((l) => l.type === 'room')) {
    const room = [r.slot, r.place, r.x, r.y, r.links, r.secrets.map((s) => [idOf(s.id), s.number]), r.izaro];
    const ex = r.area ? EXITS[r.area] : null;
    const doors = ex ? r.links.map((_, n) => ex[n + 1] ?? -1) : null;
    if (r.name || doors) room.push(r.name ? idOf(r.name) : null);
    if (doors && doors.some((d) => d >= 0)) room.push(doors);
    byTier[r.tier - 1].push(room);
  }
  days.push(byTier);
}
const data = JSON.stringify({ from, tiers, ids, days });
const view = fs.readFileSync('lab-view.js', 'utf8').replace(/^export /gm, '');
// Link previews (Discord, Slack, X…): Open Graph and Twitter tags. Crawlers do not run scripts, so the description is
// fixed at build time: today's Eternal Labyrinth when this build's range holds today. Set SITE_URL (the page's
// public address, ending in /) for the absolute URL and image Discord needs; og.jpg goes next to index.html.
const site = (process.env.SITE_URL || '').replace(/\/?$/, '/').replace(/^\/$/, '');
const todaySeedNum = seedOf(today), di = todaySeedNum - seedOf(from);
let summary = 'Daily Labyrinth maps for all four tiers: the shortest way to Izaro, his mechanics, keys and doors, Darkshrines, gauntlets and puzzles.';
if (days[di]) {
  const lines = listing(T, todaySeedNum).filter((l) => l.type === 'room' && l.tier === 4);
  const t = makeTier(4, 'The Eternal Labyrinth', lines), w = shortestWay(t), ds = holding(t, 'Darkshrine');
  const when = new Date(todaySeedNum * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  summary = `${when} (UTC) Eternal Labyrinth: ${w.length} rooms to Izaro` + (ds.length ? `, Darkshrines in rooms ${ds.join(', ')}` : '')
    + '. Daily maps for all four tiers with the shortest way, Izaro, keys and Darkshrines.';
}
const attr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const meta = [
  ['name', 'description', summary], ['name', 'theme-color', '#cfac5e'],
  ['property', 'og:type', 'website'], ['property', 'og:site_name', 'Lab Layout of the Day'],
  ['property', 'og:title', 'Lab Layout of the Day'], ['property', 'og:description', summary],
  ['name', 'twitter:card', site ? 'summary_large_image' : 'summary'], ['name', 'twitter:title', 'Lab Layout of the Day'],
  ['name', 'twitter:description', summary],
  ...(site ? [['property', 'og:url', site], ['property', 'og:image', site + 'og.jpg'], ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'], ['property', 'og:image:alt', 'A Labyrinth map with the shortest way to Izaro in gold'],
    ['name', 'twitter:image', site + 'og.jpg']] : []),
].map(([k, n, v]) => `<meta ${k}="${n}" content="${attr(v)}">`).join('\n');
if (!site) console.log('SITE_URL not set: link previews get a title and description but no image or URL.');
const html = fs.readFileSync('template.html', 'utf8').replace('<!--META-->', () => meta)
  .replace('/*LAB_VIEW*/', () => view).replace('/*DATA*/', () => data);
fs.writeFileSync('index.html', html);
console.log(`index.html: ${days.length} days from ${from} (today ${today}), ${(html.length / 1024).toFixed(0)} KiB`);
