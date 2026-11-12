// node lab-exits.mjs <files dir> topologies.json worldareas.json > exits.json
// For every Labyrinth area: its graph's size, allowed orientations, and where each "entranceN" node sits.
// entranceN leads to the room's N-th link in the day layout (N from 1), as LocalExile's LabyrinthDay.Exits.
import fs from 'node:fs';
import path from 'node:path';
const [dir = 'files', topoPath = 'topologies.json', areasPath = 'worldareas.json'] = process.argv.slice(2);
const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8'));
const areas = JSON.parse(fs.readFileSync(areasPath, 'utf8'));
const byRid = new Map(topo.map((t, i) => [t._rid ?? i, t]));

// The orientations column has no name in the schema, so it's read from the raw table (files/Data@Topologies.datc64):
// rows of fixed width after a u32 count; the [i32] list at +0x1c is a u64 count and a u64 offset into the data section.
function orientations() {
  const file = path.join(dir, 'Data@Topologies.datc64');
  if (!fs.existsSync(file)) return null;
  const b = fs.readFileSync(file), rows = b.readUInt32LE(0);
  const magic = b.indexOf(Buffer.alloc(8, 0xbb), 4);
  const width = (magic - 4) / rows, list = [];
  for (let r = 0; r < rows; r++) {
    const at = 4 + r * width, count = Number(b.readBigUInt64LE(at + 0x1c)), off = Number(b.readBigUInt64LE(at + 0x24));
    list.push(Array.from({ length: count }, (_, i) => b.readInt32LE(magic + off + 4 * i)));
  }
  return list;
}
const turns = orientations();

function decode(buf) { // graph files are UTF-16LE with a BOM, sometimes UTF-8
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  return buf.length > 1 && buf[1] === 0 ? buf.toString('utf16le') : buf.toString('utf8');
}
function tokens(line) { // as TerrainText.Tokenize: quoted strings and bare words
  const out = []; const re = /"([^"]*)"|(\S+)/g; let m;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? { text: m[1], quoted: true } : { text: m[2], quoted: false });
  return out;
}
const num = (t) => t && !t.quoted && /^-?\d+(\.\d+)?$/.test(t.text);
function parseGraph(text) { // as GraphFile.Parse
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  let w = 0, h = 0, nodes = 0, at = 0, master = '';
  for (; at < lines.length; at++) {
    const t = tokens(lines[at]); if (!t.length) continue;
    if (t[0].text === 'Size:') { w = +t[1].text; h = +t[2].text; }
    else if (t[0].text === 'MasterFile:') master = t[1].text;
    else if (t[0].text === 'Nodes:') nodes = +t[1].text;
    else if (t[0].text === 'Edges:') { at++; break; }
  }
  const list = [];
  for (; at < lines.length && list.length < nodes; at++) {
    const t = tokens(lines[at]);
    if (t.length < 6 || !num(t[0]) || !num(t[1]) || !num(t[2])) continue;
    const i = 3 + +t[2].text;
    if (i + 2 >= t.length || !t[i].quoted || t[i + 1].quoted || !num(t[i + 2])) continue;
    const n = +t[i + 2].text;
    const names = t.slice(i + 3, i + 3 + n).map((x) => x.text);
    list.push({ index: list.length, x: +t[0].text, y: +t[1].text, tag: t[i].text, rotation: t[i + 1].text, names });
  }
  return { w, h, master, nodes: list, parsed: list.length === nodes };
}

const out = {};
for (const a of areas) {
  if (!a.IsLabyrinthArea) continue;
  for (const k of a.TopologiesKeys ?? []) {
    const t = byRid.get(k); if (!t?.DGRFile) continue;
    const file = path.join(dir, t.DGRFile.replace(/\//g, '@'));
    if (!fs.existsSync(file)) { out[a.Id] = { graph: t.DGRFile, missing: true }; continue; }
    const g = parseGraph(decode(fs.readFileSync(file)));
    const entrances = {};
    for (const n of g.nodes) for (const name of n.names) {
      const m = /^entrance\s*(\d+)(-?disabled)?$/i.exec(name);
      if (m) entrances[m[1]] = { x: n.x, y: n.y, tag: n.tag, disabled: !!m[2] };
    }
    const xs = g.nodes.map((n) => n.x), ys = g.nodes.map((n) => n.y);
    out[a.Id] = { graph: t.DGRFile, size: [g.w, g.h], bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], orientations: turns ? turns[k] : 'unknown', parsed: g.parsed, entrances };
  }
}
process.stdout.write(JSON.stringify(out, null, 1));
