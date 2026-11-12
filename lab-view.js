// The map's logic, ported from Waypoint's LabyrinthDay.cs (LabTier, LabFeatures): room numbers, the shortest way
// to Izaro, where each door sits on its room's circle, what each room holds and Izaro's mechanics per fight.

/** A tier's rooms from the listing's room lines: numbered as the map reads, section by section, left to right, then
 *  top to bottom. */
export function makeTier(tier, name, roomLines) {
  const rooms = roomLines.map((r) => ({ index: r.index, area: r.area ?? null, name: r.name ?? null, doors: r.doors ?? null, slot: r.slot,
    place: r.place, x: r.x, y: r.y, links: r.links, secrets: r.secrets, izaro: r.izaro, number: 0 }))
    .sort((a, b) => a.index - b.index);
  let n = 1;
  for (const r of [...rooms].sort((a, b) => a.slot - b.slot || a.x - b.x || a.y - b.y)) r.number = n++;
  return { tier, name, rooms };
}

// The layout lists a connection on both of its rooms; one listed on a single room still counts both ways.
function neighbours(t, room) {
  const out = new Set(t.rooms[room].links.filter((l) => l >= 0 && l < t.rooms.length));
  for (const r of t.rooms) if (r.links.includes(room)) out.add(r.index);
  return [...out];
}

function distances(t, start) {
  const d = new Array(t.rooms.length).fill(-1);
  const queue = [start];
  d[start] = 0;
  while (queue.length) {
    const room = queue.shift();
    for (const next of neighbours(t, room)) if (d[next] < 0) { d[next] = d[room] + 1; queue.push(next); }
  }
  return d;
}

const key = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;

/** The rooms on a shortest way from the first room to the last (every one when several are as short), the
 *  connections between them (as "low-high" keys) and its length in rooms. */
export function shortestWay(t) {
  const rooms = new Set(), links = new Set();
  if (t.rooms.length === 0) return { rooms, links, length: 0 };
  const last = t.rooms.length - 1, from = distances(t, 0), to = distances(t, last), length = from[last];
  if (length < 0) return { rooms, links, length: 0 };
  for (let i = 0; i < t.rooms.length; i++) {
    if (from[i] < 0 || to[i] < 0 || from[i] + to[i] !== length) continue;
    rooms.add(i);
    for (const l of neighbours(t, i)) if (from[l] === from[i] + 1 && to[l] === to[i] - 1) links.add(key(i, l));
  }
  return { rooms, links, length: length + 1 };
}

const normalise = (deg) => ((deg % 360) + 360) % 360;

function angle(t, room, target) {
  if (target < 0 || target >= t.rooms.length) return null;
  const o = t.rooms[target];
  const dx = (o.slot - room.slot) * 4 + o.x - room.x, dy = o.y - room.y;
  return dx === 0 && dy === 0 ? null : normalise(Math.atan2(-dy, dx) * 180 / Math.PI);
}

/** Where each of a room's connections leaves its circle: room index → (neighbour → degrees, counter-clockwise from
 *  east). Each door faces the room it leads to on the map (sections left to right, north up); the way in from the
 *  Aspirants' Plaza is on the left, the way on to Izaro on the right. Doors less than 28° apart are spread so their
 *  dots never overlap. (Waypoint's lab window places them schematically instead, way in at 6 o'clock and the rest at
 *  10, 12 and 2; that disagreed with the real directions.) */
export function doorSides(t) {
  const sides = new Map();
  for (const room of t.rooms) {
    const doors = [...new Set(room.links.filter((l) => l < t.rooms.length))].map((to) => ({
      to, deg: to >= 0 ? angle(t, room, to) ?? 90 : room.index === 0 ? 180 : 0,
    })).sort((a, b) => a.deg - b.deg);
    for (let i = 1; i < doors.length; i++) if (doors[i].deg - doors[i - 1].deg < 28) doors[i].deg = doors[i - 1].deg + 28;
    if (doors.length > 1 && doors[0].deg + 360 - doors[doors.length - 1].deg < 28) doors[0].deg = normalise(doors[doors.length - 1].deg + 28);
    sides.set(room.index, new Map(doors.map((d) => [d.to, normalise(d.deg)])));
  }
  return sides;
}

// ---- What a room's secret is on the map (LabFeatures) ----
export const FEATURES = ['Argus', 'TrapGauntlet', 'EscortGauntlet', 'Puzzle', 'Darkshrine', 'SilverKey', 'SilverCache',
  'GoldKey', 'GoldDoor', 'Reliquary', 'SecretPassage'];

export function featureOf(id) {
  switch (id) {
    case 'Argus': return 'Argus';
    case 'Gauntlet': return 'TrapGauntlet';
    case 'Payload': return 'EscortGauntlet';
    case 'Puzzle': return 'Puzzle';
    case 'Hidden': return 'Darkshrine'; // on poelab.com's maps the Darkshrines are in exactly the rooms holding it
    case 'SilverKey': return 'SilverKey';
    case 'SilverDoorReward': return 'SilverCache';
    case 'GoldKey': return 'GoldKey';
    case 'GoldDoor': case 'GoldDoorModal': return 'GoldDoor';
    case 'Trinket': return 'Reliquary';
    case 'SecretPassage': return 'SecretPassage';
    default: return null;
  }
}

export const LABELS = { Argus: 'Argus', TrapGauntlet: 'Trap gauntlet', EscortGauntlet: 'Escort gauntlet',
  Puzzle: 'Switch puzzle', Darkshrine: 'Darkshrine', SilverKey: 'Silver key', SilverCache: 'Silver cache',
  GoldKey: 'Gold key', GoldDoor: 'Gold door', Reliquary: 'Forgotten Reliquary', SecretPassage: 'Secret passage' };

/** An Izaro mechanic's name from its Id (ChargeDisruptorsEndgame1 → Charge disruptors). */
export function mechanic(id) {
  let k = id.replace(/[0-9]+$/, '');
  for (const tier of ['Normal', 'Cruel', 'Merciless', 'Endgame']) if (k.endsWith(tier)) k = k.slice(0, -tier.length);
  return ({ Lieutenants: 'Lieutenants', Gargoyles: 'Gargoyles', PowerSymbols: 'Power symbols',
    ToggleStatues: 'Toggle statues', PowerPylons: 'Fonts', Elemental: 'Elemental orbs', Portals: 'Guardian portals',
    ChronoStatues: 'Chrono statues', Pedestals: 'Pedestals', ChargeDisruptors: 'Charge disruptors',
    BossFriend: 'A second boss' })[k] ?? k;
}

export const roomFeatures = (room) => [...new Set(room.secrets.map((s) => featureOf(s.id)).filter(Boolean))];

/** The map's numbers of the rooms holding a feature. */
export const holding = (t, feature) =>
  t.rooms.filter((r) => r.secrets.some((s) => featureOf(s.id) === feature)).map((r) => r.number).sort((a, b) => a - b);

/** Izaro's mechanics in each fight (1-3), in the order the rooms hold them. */
export const izaroFights = (t) => t.rooms.filter((r) => r.izaro > 0).sort((a, b) => a.izaro - b.izaro)
  .map((r) => ({ fight: r.izaro, room: r.number,
    mechanics: [...new Set(r.secrets.filter((s) => featureOf(s.id) === null).map((s) => mechanic(s.id)))] }));

// ---- A room's doors: where each leads and in which direction on the map ----
const COMPASS = ['East', 'North-east', 'North', 'North-west', 'West', 'South-west', 'South', 'South-east'];
const COMPASS_SHORT = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];

/** Each door of a room: the neighbour it leads to (-1: the Aspirants' Plaza from the first room, the way on to Izaro
 *  from the last), the neighbour's direction on the map (degrees counter-clockwise from east, as the map is drawn:
 *  sections left to right) and its compass point. Ordered clockwise from north. */
export function doorDirections(t, index) {
  const room = t.rooms[index];
  return [...new Set(room.links.filter((l) => l < t.rooms.length))].map((to) => {
    const deg = to >= 0 ? angle(t, room, to) ?? 90 : room.index === 0 ? 180 : 0;
    const sector = Math.round(deg / 45) % 8;
    return { to, deg, compass: COMPASS[sector], short: COMPASS_SHORT[sector], arrow: ARROWS[sector] };
  }).sort((a, b) => normalise(90 - a.deg) - normalise(90 - b.deg));
}

// ---- Where a room's exits are in game, on the minimap (from the room graph files; null when not known) ----
const SIDES = ['right', 'top-right', 'top', 'top-left', 'left', 'bottom-left', 'bottom', 'bottom-right'];

/** A room's exit to `to` on the minimap: degrees counter-clockwise from the right, the side's name and an arrow; null
 *  when the room's area isn't known or the area picks its room graph per run. */
export function exitSide(room, to) {
  if (!room.doors) return null;
  const i = room.links.indexOf(to), deg = i >= 0 ? room.doors[i] : -1;
  if (deg == null || deg < 0) return null;
  const s = Math.round(deg / 45) % 8;
  return { deg, side: SIDES[s], arrow: ARROWS[s] };
}

/** The shortest way step by step: the rooms (indexes) at each step from the first room; a step with several rooms
 *  has as-short alternatives. */
export function wayLayers(t) {
  const way = shortestWay(t), from = distances(t, 0), layers = [];
  for (const i of way.rooms) (layers[from[i]] ??= []).push(i);
  return layers.filter(Boolean).map((l) => l.sort((a, b) => t.rooms[a].number - t.rooms[b].number));
}

/** Keys and what they open: a gold key any gold door, a silver key any silver cache (by room numbers). */
export function keysAndDoors(t) {
  return [['gold', 'GoldKey', 'GoldDoor'], ['silver', 'SilverKey', 'SilverCache']]
    .map(([kind, key, door]) => ({ kind, keys: holding(t, key), doors: holding(t, door) }))
    .filter((p) => p.keys.length || p.doors.length);
}

/** The route as text to paste (Discord and the like). */
export function routeText(t, dateLabel) {
  const layers = wayLayers(t), way = shortestWay(t);
  const steps = layers.map((l) => l.map((i) => t.rooms[i].number).join('/')
    + (l.some((i) => t.rooms[i].izaro > 0) ? ' (Izaro)' : ''));
  const lines = [`${t.name} · ${dateLabel}`, `Shortest way (${way.length} rooms): ${steps.join(' → ')}`];
  const extra = [];
  for (const [f, one, many] of [['Darkshrine', 'Darkshrine', 'Darkshrines'], ['Argus', 'Argus', 'Argus'], ['Reliquary', 'Forgotten Reliquary', 'Forgotten Reliquary']]) {
    const n = holding(t, f);
    if (n.length) extra.push(`${n.length > 1 ? many : one}: ${n.join(', ')}`);
  }
  for (const p of keysAndDoors(t))
    extra.push(p.kind === 'gold' ? `Gold key ${p.keys.join(', ') || '—'} → gold door ${p.doors.join(', ') || '—'}`
      : `Silver keys ${p.keys.join(', ') || '—'} → caches ${p.doors.join(', ') || '—'}`);
  if (extra.length) lines.push(extra.join(' · '));
  const fights = izaroFights(t).map((f) => `${f.fight}: ${f.mechanics.join(', ') || '—'}`);
  if (fights.length) lines.push(`Izaro ${fights.join(' | ')}`);
  return lines.join('\n');
}
