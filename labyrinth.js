// The day's Labyrinth layout, ported from LocalExile's LabyrinthLayout.cs / LabyrinthDay.cs
// (src/GameServer.Data/Terrain/Generation, src/GameServer.Gateway/World). It reads the tables as poe-dat-viewer
// exports them (JSON, unnamed columns as UnknownN); each column below notes the byte offset the C# reads.

// ---- The client's small generator (TinyMt.cs) ----
const MAT1 = 0x8f7011ee, MAT2 = 0xfc78ff1f, TMAT = 0x3793fdff;

class TinyMt {
  constructor(seed) {
    const s = [seed >>> 0, MAT1, MAT2, TMAT];
    for (let i = 1; i < 8; i++) {
      const p = s[(i - 1) & 3];
      s[i & 3] = (s[i & 3] ^ ((i + Math.imul(0x6c078965, (p ^ (p >>> 30)) >>> 0)) >>> 0)) >>> 0;
    }
    [this.s0, this.s1, this.s2, this.s3] = s;
    for (let i = 0; i < 8; i++) this.next();
  }

  next() {
    let x = ((this.s0 & 0x7fffffff) ^ this.s1 ^ this.s2) >>> 0;
    const y = (this.s3 ^ (this.s3 << 1)) >>> 0;
    x = ((x >>> 1) ^ x ^ y) >>> 0;
    const s1 = this.s1;
    this.s0 = s1;
    this.s1 = ((-(x & 1) & MAT1) ^ this.s2) >>> 0;
    this.s2 = ((-(x & 1) & MAT2) ^ (x << 10) ^ y) >>> 0;
    this.s3 = x;
    const t = ((this.s2 >>> 8) + s1) >>> 0;
    return ((-(t & 1) & TMAT) ^ t ^ x) >>> 0;
  }

  pick(n) {
    if (n <= 1) return 0;
    const MAX = 0xffffffff;
    let v;
    do v = this.next();
    while (Math.floor(MAX / n) <= Math.floor(v / n) && MAX % n !== n - 1);
    return v % n;
  }
}

const u32 = (v) => v >>> 0;
const mul = (a, b) => Math.imul(a, b) >>> 0;
// A 32-bit float as C# prints it: the shortest decimal that reads back as the same float.
const f32 = (v) => { const f = Math.fround(v); for (let p = 1; p <= 9; p++) { const d = +f.toPrecision(p); if (Math.fround(d) === f) return d; } return f; };
const ref = (v) => (v === null || v === undefined ? -1 : v);

/** The seed of a UTC day: its number since 1970 (LabyrinthDay.SeedOf). */
export function seedOf(date /* 'yyyy-mm-dd' */) {
  return Math.round(Date.parse(date + 'T00:00:00Z') / 86400000);
}

// ---- The tables, by the columns the generator reads ----
export function readTables(t) {
  return {
    labyrinths: t.labyrinths.map((r) => ({
      tier: r.Tier, name: r.Name,
      slots: r.Unknown7,       // +0x40 sections
      maximum: r.Unknown9,     // +0x54 random secrets per slot, most
      minimum: r.Unknown10,    // +0x64 random secrets per slot, least
    })),
    sections: t.labyrinthsection.map((r) => ({
      id: r.Id,
      group: ref(r.ExclusionGroup), // +0x08
      tierMin: r.Unknown3,          // +0x18
      tierMax: r.Unknown4,          // +0x1c
      slotMin: r.Unknown5,          // +0x20
      slotMax: r.Unknown6,          // +0x24
    })),
    layouts: t.labyrinthsectionlayout.map((r) => ({
      section: ref(r.LabyrinthSectionKey), // +0x00
      place: r.Unknown2,                   // +0x10
      links: r.LabyrinthSectionLayoutKeys, // +0x14
      secret0: ref(r.LabyrinthSecretsKey0),// +0x24
      secret1: ref(r.LabyrinthSecretsKey1),// +0x34
      areas: ref(r.LabyrinthAreasKey),     // +0x44
      x: f32(r.Float0), y: f32(r.Float1),            // +0x54, +0x58
    })),
    secrets: t.labyrinthsecrets.map((r) => ({
      id: r.Id, name: r.Name,
      additional: r.Unknown3,  // +0x10 companions
      weight: r.Unknown4,      // +0x20
      placement: r.Unknown5,   // +0x24
      span: r.Unknown9,        // +0x58
      endRoom: r.Unknown11,    // +0x6c
      passage: r.Unknown12,    // +0x6d
      uses: r.Unknown13,       // +0x6e
      tierMin: r.LabyrinthTierMinimum, // +0x8d
      tierMax: r.LabyrinthTierMaximum, // +0x91
      spread: r.Unknown21,     // +0x95
    })),
    // LabyrinthAreas: Normal/Cruel/Merciless/Endgame WorldAreas lists; optional (only the room's area pick needs it).
    areas: t.labyrinthareas?.map((r) => [r.Normal_WorldAreasKeys, r.Cruel_WorldAreasKeys,
      r.Merciless_WorldAreasKeys, r.Endgame_WorldAreasKeys]) ?? null,
    worldAreas: t.worldareas?.map((r) => ({ id: r.Id, name: r.Name })) ?? null,
  };
}

// ---- The layout (LabyrinthLayout.cs) ----
export function buildLayout(T, seed, difficulty) {
  seed = u32(seed);
  const lab = T.labyrinths.find((l) => l.tier === difficulty);
  if (!lab) throw new Error('Invalid difficulty number!');
  const nodes = [], sections = [], first = [], last = [], used = new Map();
  let draws = 0x2e3, number = 0;

  const draw = (n) => {
    draws = mul(draws, 0x1f7);
    return n < 2 ? 0 : new TinyMt(u32(mul(u32(difficulty + mul(draws, 4)), 0x13d) + seed)).pick(n);
  };
  const link = (from, to) => {
    if (nodes[from].links.length >= 5) throw new Error('Too many connections to LabyrinthNode');
    nodes[from].links.push(to);
  };
  const free = (n) => n.secret1 < 0 || n.secret2 < 0;
  const uses = (s) => used.get(s) ?? 0;
  const assign = (i, secret, num) => {
    const n = nodes[i];
    if (n.secret1 < 0) { n.secret1 = secret; n.number1 = num; }
    else if (n.secret2 < 0) { n.secret2 = secret; n.number2 = num; }
  };
  const pickNode = (from, to, secret, exclude) => {
    const c = [];
    for (let i = from; i < to; i++) if (free(nodes[i]) && nodes[i].secret1 !== secret && i !== exclude) c.push(i);
    return c.length === 0 ? -1 : c[draw(c.length)];
  };
  const bag = () => ({ entries: [], total: 0 });
  const add = (b, s, w) => { b.entries.push([s, w]); b.total += w; };
  const copy = (b) => { const c = bag(); for (const [s, w] of b.entries) add(c, s, w); return c; };
  const take = (b) => {
    draw(b.total);
    let r = draw(b.total), i = 0;
    while (i < b.entries.length - 1 && r >= b.entries[i][1]) { r -= b.entries[i][1]; i++; }
    const [s, w] = b.entries[i];
    b.entries.splice(i, 1);
    b.total -= w;
    return s;
  };
  const S = T.secrets;

  // PickSections: one LabyrinthSection per slot.
  for (let slot = 0; slot < lab.slots; slot++) {
    const c = [];
    for (let r = 1; r < T.sections.length; r++) {
      const s = T.sections[r];
      if (s.slotMin > slot + 1 || slot + 1 > s.slotMax) continue;
      if (s.tierMin > lab.tier || lab.tier > s.tierMax) continue;
      if (s.group < 0 ? sections.includes(r) : sections.some((p) => T.sections[p].group === s.group)) continue;
      c.push(r);
    }
    if (c.length === 0) throw new Error('No LabyrinthSections could be used!');
    sections.push(c[new TinyMt(u32(seed + 0x11 + mul(lab.tier + slot * 4, 0x13d))).pick(c.length)]);
  }

  // BuildNodes: each section's layout rows by place.
  for (let slot = 0; slot < sections.length; slot++) {
    const rows = T.layouts.map((l, r) => r).filter((r) => T.layouts[r].section === sections[slot])
      .sort((a, b) => T.layouts[a].place - T.layouts[b].place || a - b);
    if (rows.length === 0) throw new Error(`LabyrinthSection ${sections[slot]} has no layout rows`);
    first[slot] = nodes.length;
    for (const r of rows) nodes.push({ row: r, section: sections[slot], place: T.layouts[r].place, links: [],
      secret1: -1, secret2: -1, number1: 0, number2: 0, sectionEnd: 0 });
    last[slot] = nodes.length - 1;
    nodes[nodes.length - 1].sectionEnd = slot + 1;
  }

  // Connect.
  link(0, -1);
  for (let slot = 1; slot < sections.length; slot++) link(first[slot], last[slot - 1]);
  for (let i = 0; i < nodes.length; i++) {
    const place = T.layouts[nodes[i].row].place;
    for (const other of T.layouts[nodes[i].row].links) {
      const op = T.layouts[other].place;
      if (op !== 0) link(i, op - place + i);
    }
  }
  for (let slot = 0; slot + 1 < sections.length; slot++) link(last[slot], first[slot + 1]);
  link(nodes.length - 1, -1);

  const deadEnd = (node, companion) => {
    const c = [];
    for (let i = node + 1; i < last[last.length - 1]; i++)
      if (free(nodes[i]) && nodes[i].secret1 !== companion && nodes[i].links.length === 1) c.push(i);
    return c.length === 0 ? -1 : c[draw(c.length)];
  };

  const placeLinked = (slot, secret) => {
    const placement = S[secret].placement;
    const node = pickNode(first[slot], last[slot] - (placement === 1 ? 1 : 0), secret, -1);
    if (node < 0) return false;
    const lastSlot = sections.length - 1;
    for (const companion of S[secret].additional) {
      let at = placement === 1 ? pickNode(node + 1, last[slot], companion, node)
        : placement === 2 ? pickNode(first[slot + 1], last[slot + 1], companion, node)
        : placement === 3 ? (nodes[last[slot]].secret2 < 0 ? last[slot] : -2)
        : placement === 4 ? pickNode(first[lastSlot], last[lastSlot], companion, node)
        : placement === 5 ? deadEnd(node, companion)
        : -1;
      if (at === -2) return false;
      if (at < 0) {
        if (placement === 1 || placement === 3) return false;
        at = pickNode(node + 1, last[lastSlot], companion, node);
        if (at < 0) return false;
      }
      assign(node, secret, number);
      assign(at, companion, number);
      if (S[secret].passage) { link(node, at); link(at, node); }
    }
    return true;
  };

  // PlaceSecrets.
  number = nodes.length * 2 + 0x11;
  const random = bag(), endRoom = bag(), spread = bag();
  for (let s = 0; s < S.length; s++) {
    const w = S[s].weight;
    if (w === 0 || difficulty < S[s].tierMin || S[s].tierMax < difficulty) continue;
    if (S[s].endRoom) { add(endRoom, s, w); continue; }
    add(random, s, w);
    if (S[s].spread && S[s].additional.length === 0 && S[s].span === 1) add(spread, s, w);
  }
  // The layout rows' own secrets.
  for (let slot = 0; slot < sections.length; slot++)
    for (let i = first[slot]; i <= last[slot]; i++)
      for (const secret of [T.layouts[nodes[i].row].secret0, T.layouts[nodes[i].row].secret1]) {
        if (secret < 0) continue;
        used.set(secret, uses(secret) + 1);
        if (S[secret].additional.length === 0) assign(i, secret, number);
        else placeLinked(slot, secret);
        number += S[secret].span;
      }
  // An end-room secret on each section's last node but the final one.
  for (let slot = 0; slot + 1 < sections.length; slot++) {
    if (endRoom.entries.length === 0) continue;
    const secret = take(endRoom);
    assign(last[slot], secret, number);
    number += S[secret].span;
  }
  // Their companions on every later section's last node, with the same number.
  for (let slot = 0; slot + 1 < sections.length; slot++) {
    const end = nodes[last[slot]];
    if (end.secret1 < 0 || S[end.secret1].additional.length === 0) continue;
    const companion = S[end.secret1].additional[0];
    for (let later = slot + 1; later < sections.length; later++) assign(last[later], companion, end.number1);
  }
  // Two spread secrets anywhere but the first section's last node.
  for (let pass = 0; pass < 2; pass++)
    while (spread.entries.length > 0) {
      const secret = take(spread), span = S[secret].span;
      if (span + number >= 0x61 || uses(secret) >= S[secret].uses) continue;
      const node = pickNode(0, nodes.length, secret, last[0]);
      if (node < 0) continue;
      assign(node, secret, number);
      if (S[secret].uses > 1) add(spread, secret, S[secret].weight);
      number += span;
      used.set(secret, uses(secret) + 1);
      break;
    }
  // The day's random secrets, per slot.
  for (let slot = 0; slot < sections.length; slot++) {
    const count = lab.minimum[slot] + draw(lab.maximum[slot] - lab.minimum[slot] + 1);
    const b = copy(random);
    for (let k = 0; k < count; k++)
      while (b.entries.length > 0) {
        const secret = take(b), span = S[secret].span;
        if (span + number >= 0x61) continue;
        const placement = S[secret].placement;
        if (placement === 2 ? slot + 1 >= sections.length : placement === 3 && nodes[last[slot]].secret2 >= 0) continue;
        if (uses(secret) >= S[secret].uses) continue;
        if (S[secret].additional.length === 0) {
          const node = pickNode(first[slot], last[slot], secret, -1);
          if (node < 0) continue;
          assign(node, secret, number);
        } else if (!placeLinked(slot, secret)) continue;
        if (S[secret].uses > 1) add(b, secret, S[secret].weight);
        number += span;
        used.set(secret, uses(secret) + 1);
        break;
      }
  }

  // The official server's area pick (LabyrinthLayout.AreaPick).
  const areaPick = (node, count) => new TinyMt(u32(mul(u32(difficulty + mul(node.row, 4)), 0x13d) + seed)).pick(count);
  return { seed, difficulty, nodes, sections, areaPick };
}

// ---- The Gateway's `labyrinth` listing (LabyrinthDay.Listing): one object per line ----
export function listing(T, seed, dated = true) {
  const out = [];
  const head = { type: 'day', seed };
  if (dated) head.date = new Date(seed * 86400000).toISOString().slice(0, 10);
  out.push(head);
  for (const lab of T.labyrinths) {
    const day = buildLayout(T, seed, lab.tier);
    out.push({ type: 'tier', tier: lab.tier, name: lab.name });
    day.nodes.forEach((n, i) => {
      const l = T.layouts[n.row];
      let area = null, name = null;
      if (T.areas && l.areas >= 0) {
        const choices = T.areas[l.areas]?.[lab.tier - 1] ?? [];
        if (choices.length > 0) {
          const wa = T.worldAreas?.[choices[day.areaPick(n, choices.length)]];
          area = wa?.id ?? null;
          name = wa?.name ?? null;
        }
      }
      const secrets = [];
      if (n.secret1 >= 0) secrets.push({ id: T.secrets[n.secret1].id, name: T.secrets[n.secret1].name, number: n.number1 });
      if (n.secret2 >= 0) secrets.push({ id: T.secrets[n.secret2].id, name: T.secrets[n.secret2].name, number: n.number2 });
      out.push({ type: 'room', tier: lab.tier, index: i, area, name, slot: day.sections.indexOf(n.section),
        place: n.place, x: l.x, y: l.y, links: n.links, secrets, izaro: n.sectionEnd });
    });
  }
  return out;
}
