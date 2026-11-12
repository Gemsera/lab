// node make-config-2.mjs topologies.json worldareas.json [steam path]
// Writes config-2-graphs.json: every Labyrinth room's graph file, for the exporter's "files" list.
import fs from 'node:fs';
const [topoPath = 'topologies.json', areasPath = 'worldareas.json', steam] = process.argv.slice(2);
const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8'));
const areas = JSON.parse(fs.readFileSync(areasPath, 'utf8'));
const byRid = new Map(topo.map((t, i) => [t._rid ?? i, t]));
const files = new Set();
for (const a of areas) {
  if (!a.IsLabyrinthArea && !a.IsLabyrinthBossArea && !a.IsLabyrinthAirlock) continue;
  for (const k of a.TopologiesKeys ?? []) { const t = byRid.get(k); if (t?.DGRFile) files.add(t.DGRFile); }
}
const config = { steam: steam ?? 'C:/Program Files (x86)/Steam/steamapps/common/Path of Exile', files: [...files].sort() };
fs.writeFileSync('config-2-graphs.json', JSON.stringify(config, null, 2));
console.log(`${files.size} graph files -> config-2-graphs.json`);
