// Gefecht 5 gegen 5 – gemeinsame Simulation (läuft im Multiplayer-Server, feste Schrittweite DT).
// Neu: größere Karte, 4 Waffen mit Magazin, Granaten, Medikits/Munition, Modus „Eroberung“, Bots mit Wegfindung.
export const DT = 0.05;
export const W = 80, H = 50;
export const TEAM_SIZE = 5;
export const COUNTDOWN = 3;
export const MODES = {
  tdm: { name: 'Team-Kampf', desc: 'Welches Team zuerst 30 Gegner ausschaltet', win: 30, time: 300 },
  conquest: { name: 'Eroberung', desc: 'Halte die Zonen A, B und C – 150 Punkte gewinnen', win: 150, time: 360 },
};
export const WEAPONS = [
  { id: 'rifle', name: 'Sturmgewehr', icon: '🔫', dmg: 13, cd: 0.13, speed: 34, life: 0.75, spread: 0.045, mag: 30, reload: 1.6, reserve: 150, kind: 0 },
  { id: 'mg', name: 'MG', icon: '⚙️', dmg: 10, cd: 0.075, speed: 32, life: 0.8, spread: 0.1, mag: 80, reload: 3.0, reserve: 160, kind: 0, slow: 0.72 },
  { id: 'sniper', name: 'Scharfschütze', icon: '🎯', dmg: 75, cd: 1.1, speed: 70, life: 0.7, spread: 0, mag: 5, reload: 2.2, reserve: 25, kind: 3 },
  { id: 'rocket', name: 'Panzerfaust', icon: '🚀', dmg: 70, cd: 1.0, speed: 20, life: 1.5, spread: 0, mag: 1, reload: 2.2, reserve: 6, kind: 2, tank: 210, splash: 2.6 },
];
export const S = { speed: 5.4, r: 0.45, hp: 100, respawn: 4, grenades: 2 };
export const T = { speed: 4, r: 1.3, hp: 650, turn: 2.2, tturn: 3.2, cd: 1.5, sspeed: 24, life: 1.2, direct: 85, directTank: 140, splash: 2.8, splashDmg: 60, respawn: 18 };
export const SOLDIER = S, TANK = T;
const GREN = { speed: 15, maxDist: 13, fuse: 0.6, radius: 3.4, dmg: 90 };

// ---------- Karte (punktsymmetrisch: (x,y) -> (W-x, H-y)) ----------
// [x, y, Breite, Höhe, Art] Art: wall (Beton), sand (Sandsäcke), crate (Kisten), house (Haus, hoch)
const HALF = [
  [9, 4, 1.2, 9, 'sand'], [9, 37, 1.2, 9, 'sand'], [9, 19, 1.2, 4, 'sand'],
  [14, 2, 7, 6, 'house'], [14, 42, 7, 6, 'house'],
  [24, 15, 1.2, 7, 'wall'], [24, 28, 1.2, 7, 'wall'],
  [18, 23.4, 3, 3, 'crate'], [28, 5, 2.6, 2.6, 'crate'], [28, 42, 2.6, 2.6, 'crate'],
  [17, 13, 4, 1.2, 'sand'], [17, 35.8, 4, 1.2, 'sand'],
  [30, 20, 1.2, 4, 'sand'], [33, 9, 5, 1.2, 'wall'], [33, 39.8, 5, 1.2, 'wall'],
];
const CENTER = [[37, 18, 6, 1.2, 'sand'], [37, 30.8, 6, 1.2, 'sand'], [39, 2, 2, 8, 'house'], [39, 40, 2, 8, 'house']];
const rects = [];
for (const [x, y, w, h, k] of HALF) { rects.push({ x, y, w, h, k }); rects.push({ x: W - x - w, y: H - y - h, w, h, k }); }
for (const [x, y, w, h, k] of CENTER) rects.push({ x, y, w, h, k });
export const RECTS = rects;
export const SPAWN_X = [3, W - 3];
const SPAWN_Y = [[15, 20, 25, 30, 35], [35, 30, 25, 20, 15]];
const TANK_SPAWN = [{ x: 6.5, y: 25, a: 0 }, { x: W - 6.5, y: 25, a: Math.PI }];
export const ZONES = [{ id: 'A', x: 21, y: 9.5 }, { id: 'B', x: 40, y: 25 }, { id: 'C', x: W - 21, y: H - 9.5 }];
export const ZONE_R = 4;
export const PICKUPS = [
  { k: 'med', x: 20, y: 31 }, { k: 'med', x: W - 20, y: H - 31 }, { k: 'med', x: 40, y: 12 }, { k: 'med', x: 40, y: 38 },
  { k: 'ammo', x: 13, y: 25 }, { k: 'ammo', x: W - 13, y: 25 }, { k: 'ammo', x: 32, y: 32 }, { k: 'ammo', x: W - 32, y: H - 32 },
];

const BOT_NAMES = ['Krüger', 'Novak', 'Brandt', 'Weber', 'Schulz', 'Ivanov', 'Rossi', 'Dubois', 'Jansen', 'Kowalski', 'Lindqvist', 'Moreau', 'Hartmann', 'Fischer', 'Becker', 'Petrov', 'Costa', 'Silva', 'Wagner', 'Keller'];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const turnTo = (a, b, max) => a + Math.max(-max, Math.min(max, angDiff(a, b)));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const r2 = (v) => Math.round(v * 100) / 100;

function segRect(x1, y1, x2, y2, r) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
export function lineOfSight(a, b) { for (const r of RECTS) if (segRect(a.x, a.y, b.x, b.y, r)) return false; return true; }
const inRect = (x, y, r, m = 0) => x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
export function blocked(x, y) { if (x < 0 || y < 0 || x > W || y > H) return true; for (const r of RECTS) if (inRect(x, y, r)) return true; return false; }

function collide(o, rad) {
  for (const r of RECTS) {
    const cx = Math.max(r.x, Math.min(o.x, r.x + r.w)), cy = Math.max(r.y, Math.min(o.y, r.y + r.h));
    const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
    if (d < rad) {
      if (d > 1e-6) { o.x = cx + (dx / d) * rad; o.y = cy + (dy / d) * rad; }
      else {
        const opts = [[o.x - r.x + rad, -1, 0], [r.x + r.w - o.x + rad, 1, 0], [o.y - r.y + rad, 0, -1], [r.y + r.h - o.y + rad, 0, 1]].sort((a, b) => a[0] - b[0]);
        o.x += opts[0][1] * opts[0][0]; o.y += opts[0][2] * opts[0][0];
      }
    }
  }
  o.x = Math.max(rad, Math.min(W - rad, o.x)); o.y = Math.max(rad, Math.min(H - rad, o.y));
}

// ---------- Wegfindung (A* auf einem 1-m-Raster) ----------
function makeGrid(margin) {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    if (cx < margin || cy < margin || cx > W - margin || cy > H - margin || RECTS.some((r) => inRect(cx, cy, r, margin))) g[y * W + x] = 1;
  }
  return g;
}
export const GRID_SOLDIER = makeGrid(S.r + 0.2);
const GRID_TANK = makeGrid(T.r + 0.2);
function nearestFree(grid, x, y) {
  let bx = Math.floor(x), by = Math.floor(y);
  if (bx >= 0 && by >= 0 && bx < W && by < H && !grid[by * W + bx]) return [bx, by];
  for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = bx + dx, ny = by + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H && !grid[ny * W + nx]) return [nx, ny];
  }
  return [bx, by];
}
export function findPath(grid, sx, sy, tx, ty) {
  const [ax, ay] = nearestFree(grid, sx, sy), [bx, by] = nearestFree(grid, tx, ty);
  const start = ay * W + ax, goal = by * W + bx;
  const gS = new Float32Array(W * H).fill(1e9), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  gS[start] = 0;
  const hf = (i) => { const x = i % W, y = (i / W) | 0, dx = Math.abs(x - bx), dy = Math.abs(y - by); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  // Prioritätswarteschlange (binärer Heap) über [f, Index]
  const heap = [];
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
  push(hf(start), start);
  let n = 0;
  while (heap.length && n++ < 4000) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (grid[ni] || closed[ni]) continue;
      if (dx && dy && (grid[cy * W + nx] || grid[ny * W + cx])) continue;
      const ng = gS[cur] + (dx && dy ? 1.414 : 1);
      if (ng < gS[ni]) { gS[ni] = ng; from[ni] = cur; push(ng + hf(ni), ni); }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;
  const path = [];
  for (let i = goal; i !== -1 && i !== start; i = from[i]) path.push({ x: (i % W) + 0.5, y: ((i / W) | 0) + 0.5 });
  path.reverse();
  // Wegpunkte ausdünnen: nur behalten, was nicht direkt sichtbar ist
  const out = [];
  let anchor = { x: sx, y: sy };
  for (let i = 0; i < path.length; i++) {
    const next = path[i + 1];
    if (!next || !clearLine(grid, anchor, next)) { out.push(path[i]); anchor = path[i]; }
  }
  return out;
}
function clearLine(grid, a, b) {
  const n = Math.ceil(dist(a, b) * 2);
  for (let i = 1; i <= n; i++) {
    const x = Math.floor(a.x + (b.x - a.x) * i / n), y = Math.floor(a.y + (b.y - a.y) * i / n);
    if (x < 0 || y < 0 || x >= W || y >= H || grid[y * W + x]) return false;
  }
  return true;
}

// ---------- Erzeugen ----------
// players: [{ name, key, skin, team }] – Bots füllen auf 5 gegen 5 auf.
export function createBattle(players = [], { seed = (Date.now() & 0xffffffff) >>> 0, mode = 'tdm', colors = ['#3f7fd0', '#d0453f'], timeLimit, winScore } = {}) {
  const rand = rng(seed);
  const M = MODES[mode] ? mode : 'tdm';
  const teams = [[], []];
  for (const p of players.slice(0, TEAM_SIZE * 2)) {
    let t = p.team === 0 || p.team === 1 ? p.team : (teams[0].length <= teams[1].length ? 0 : 1);
    if (teams[t].length >= TEAM_SIZE) t = 1 - t;
    teams[t].push(p);
  }
  const names = [...BOT_NAMES].sort(() => rand() - 0.5);
  const units = [];
  let id = 1;
  for (const team of [0, 1]) {
    for (let k = 0; k < TEAM_SIZE; k++) {
      const p = teams[team][k];
      const pref = k === 2 ? 0 : k === 1 ? 1 : k === 3 ? 2 : k === 4 ? 3 : 0;
      units.push({
        id: id++, team, slot: k, name: p ? String(p.name).slice(0, 16) : 'Bot ' + names.pop(), human: !!p, key: p ? p.key : null, skin: (p && p.skin) || 'oliv',
        x: SPAWN_X[team], y: SPAWN_Y[team][k], a: team === 0 ? 0 : Math.PI, vx: 0, vy: 0, hp: S.hp, alive: true, rt: 0, inv: 1.5, cd: 0, tank: -1,
        w: p ? 0 : pref, ammo: WEAPONS.map((wp) => ({ mag: wp.mag, res: wp.reserve })), rl: 0, g: S.grenades,
        kills: 0, deaths: 0, tk: 0, caps: 0, calm: 9, lastHitBy: 0,
        bot: { think: rand() * 0.3, mx: 0, my: 0, a: 0, f: false, u: false, gr: 0, strafe: rand() < 0.5 ? 1 : -1, strafeT: 1 + rand(), stuck: 0, detour: 0, dx: 0, dy: 0, px: 0, py: 0, path: null, pathT: 0, goal: null, skill: 0.07 + rand() * 0.09, tankist: k === 2, pref },
      });
    }
  }
  const tanks = TANK_SPAWN.map((s, team) => ({ team, x: s.x, y: s.y, a: s.a, ta: s.a, hp: T.hp, alive: true, rt: 0, driver: 0, cd: 0, skin: 'oliv' }));
  return {
    ph: 'count', mode: M, time: 0, cd: COUNTDOWN, tl: timeLimit || MODES[M].time, win: winScore || MODES[M].win, score: [0, 0], colors,
    units, tanks, bullets: [], nades: [], fx: [], rand, winner: null,
    pickups: PICKUPS.map((p) => ({ ...p, on: true, t: 0 })),
    zones: ZONES.map((z) => ({ ...z, p: 0, owner: -1 })), zoneTick: 0,
  };
}

export const unitById = (st, id) => st.units.find((u) => u.id === id);
const posOf = (st, u) => (u.tank >= 0 ? st.tanks[u.tank] : u);

function kill(st, victim, attacker, weapon) {
  victim.alive = false; victim.hp = 0; victim.rt = S.respawn; victim.deaths++;
  if (victim.tank >= 0) { st.tanks[victim.tank].driver = 0; victim.tank = -1; }
  if (attacker && attacker.team !== victim.team) {
    attacker.kills++; if (weapon === 'tank') attacker.tk++;
    if (st.mode === 'tdm') st.score[attacker.team]++;
  }
  st.fx.push({ k: 'kill', a: attacker ? attacker.id : 0, v: victim.id, w: weapon });
}
function damageUnit(st, u, amt, attacker, weapon) {
  if (!u.alive || u.inv > 0 || u.tank >= 0) return;
  amt = Math.round(amt);
  u.hp -= amt; u.calm = 0;
  if (attacker) st.fx.push({ k: 'dmg', a: attacker.id, v: u.id, d: amt });
  if (u.hp <= 0) kill(st, u, attacker, weapon);
}
function damageTank(st, t, amt, attacker, weapon) {
  if (!t.alive) return;
  amt = Math.round(amt);
  t.hp -= amt;
  if (attacker) st.fx.push({ k: 'dmg', a: attacker.id, tank: t.team, d: amt });
  if (t.hp <= 0) {
    t.alive = false; t.hp = 0; t.rt = T.respawn;
    st.fx.push({ k: 'tankboom', x: r2(t.x), y: r2(t.y) });
    if (t.driver) { const d = unitById(st, t.driver); d.inv = 0; d.tank = -1; t.driver = 0; d.x = t.x; d.y = t.y; kill(st, d, attacker, weapon); }
  }
}

function exitTank(st, u) {
  const t = st.tanks[u.tank];
  t.driver = 0; u.tank = -1;
  const side = t.a + Math.PI / 2;
  for (const off of [side, side + Math.PI, t.a + Math.PI, t.a]) {
    const x = t.x + Math.cos(off) * (T.r + 0.9), y = t.y + Math.sin(off) * (T.r + 0.9);
    if (!blocked(x, y)) { u.x = x; u.y = y; break; }
  }
  u.inv = 0.5;
  collide(u, S.r);
}
function tryUse(st, u) {
  if (!u.alive) return;
  if (u.tank >= 0) { exitTank(st, u); return; }
  const t = st.tanks[u.team];
  if (!t.alive || dist(t, u) > T.r + 1.5) return;
  if (t.driver) {
    const d = unitById(st, t.driver);
    if (d.human || !u.human) return;
    exitTank(st, d);
  }
  t.driver = u.id; u.tank = u.team; t.skin = u.skin; u.rl = 0;
  st.fx.push({ k: 'enter', id: u.id });
}

function fire(st, owner, x, y, a, wp) {
  const spread = (st.rand() - 0.5) * 2 * wp.spread;
  st.bullets.push({ x, y, vx: Math.cos(a + spread) * wp.speed, vy: Math.sin(a + spread) * wp.speed, life: wp.life, team: owner.team, owner: owner.id, kind: wp.kind, dmg: wp.dmg, tank: wp.tank || 0, splash: wp.splash || 0 });
  st.fx.push({ k: 'shot', id: owner.id, w: wp.kind });
}
function fireShell(st, owner, t) {
  st.bullets.push({ x: t.x + Math.cos(t.ta) * (T.r + 1), y: t.y + Math.sin(t.ta) * (T.r + 1), vx: Math.cos(t.ta) * T.sspeed, vy: Math.sin(t.ta) * T.sspeed, life: T.life, team: owner.team, owner: owner.id, kind: 1, dmg: T.direct, tank: T.directTank, splash: T.splash });
  st.fx.push({ k: 'cannon', id: owner.id, x: r2(t.x), y: r2(t.y) });
}

function explode(st, x, y, owner, radius, dmg, weapon) {
  st.fx.push({ k: 'boom', x: r2(x), y: r2(y), r: radius });
  for (const u of st.units) {
    if (!u.alive || u.tank >= 0 || (u.team === owner.team && u !== owner)) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < radius && lineOfSight({ x, y }, u)) damageUnit(st, u, (u === owner ? 0.3 : 1) * dmg * (1 - d / radius * 0.6), owner, weapon);
  }
  for (const t of st.tanks) {
    if (!t.alive || t.team === owner.team) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < radius + T.r) damageTank(st, t, 45 * (1 - Math.min(1, d / (radius + T.r))), owner, weapon);
  }
}

function throwGrenade(st, u, a, d) {
  if (u.g <= 0 || u.tank >= 0 || !u.alive) return;
  u.g--;
  d = Math.max(3, Math.min(GREN.maxDist, d || 9));
  const tx = Math.max(0.6, Math.min(W - 0.6, u.x + Math.cos(a) * d)), ty = Math.max(0.6, Math.min(H - 0.6, u.y + Math.sin(a) * d));
  st.nades.push({ x: u.x, y: u.y, sx: u.x, sy: u.y, tx, ty, t: 0, dur: d / GREN.speed, fuse: GREN.fuse, owner: u.id, team: u.team });
  st.fx.push({ k: 'throw', id: u.id });
}

function startReload(u) {
  const wp = WEAPONS[u.w], am = u.ammo[u.w];
  if (u.rl > 0 || am.mag >= wp.mag || am.res <= 0) return;
  u.rl = wp.reload;
}
function respawn(st, u) {
  u.alive = true; u.hp = S.hp; u.inv = 2; u.x = SPAWN_X[u.team]; u.y = SPAWN_Y[u.team][u.slot] + (st.rand() - 0.5) * 2; u.calm = 9;
  u.ammo = WEAPONS.map((wp) => ({ mag: wp.mag, res: wp.reserve })); u.g = S.grenades; u.rl = 0;
  if (!u.human) { u.w = u.bot.pref; u.bot.path = null; }
  st.fx.push({ k: 'spawn', id: u.id });
}

// ---------- Bots ----------
function botThink(st, u, dt) {
  const b = u.bot;
  const me = posOf(st, u);
  b.think -= dt;
  if (b.detour > 0) b.detour -= dt;
  if (b.think > 0) return;
  const interval = 0.2;
  b.think = interval;
  const moved = Math.hypot(me.x - b.px, me.y - b.py);
  if ((Math.abs(b.mx) + Math.abs(b.my)) > 0.3 && moved < 0.2) b.stuck += interval; else b.stuck = 0;
  b.px = me.x; b.py = me.y;
  if (b.stuck > 0.8 && b.detour <= 0) {
    const a = Math.atan2(b.my, b.mx) + (st.rand() < 0.5 ? 1 : -1) * (Math.PI / 2 + st.rand() * 0.6);
    b.dx = Math.cos(a); b.dy = Math.sin(a); b.detour = 0.7; b.stuck = 0; b.path = null;
  }
  b.u = false; b.f = false; b.gr = 0; b.r = false;
  const myTank = st.tanks[u.team];
  const inTank = u.tank >= 0;
  const grid = inTank ? GRID_TANK : GRID_SOLDIER;

  // Panzerfahrer steigt ein
  if (!inTank && b.tankist && myTank.alive && !myTank.driver && !st.units.some((o) => o.human && o.team === u.team && o.alive && o.tank < 0 && dist(o, myTank) < 6)) {
    if (dist(u, myTank) < T.r + 1.3) { b.u = true; return; }
    return goTo(st, u, myTank.x, myTank.y, grid);
  }
  // Waffe: Panzerfaust gegen Panzer, sonst bevorzugte Waffe, leer -> Gewehr
  const enemyTank = st.tanks[1 - u.team];
  let wantW = b.pref;
  if (b.pref === 3 && !(enemyTank.alive && enemyTank.driver && dist(me, enemyTank) < 26)) wantW = 0;
  if (u.ammo[wantW].mag + u.ammo[wantW].res <= 0) wantW = 0;
  if (!inTank && u.w !== wantW) { u.w = wantW; u.rl = 0; }

  // Ziel suchen
  let best = null, bestD = 1e9;
  for (const o of st.units) {
    if (!o.alive || o.team === u.team) continue;
    const p = posOf(st, o);
    const d = dist(me, p);
    if (d < 30 && d < bestD && lineOfSight(me, p)) { bestD = d; best = { p, o, d, tank: o.tank >= 0 }; }
  }
  const wp = WEAPONS[u.w];
  const range = inTank ? 24 : wp.speed * wp.life * 0.92;
  if (best && best.d < range + 6) {
    const sp = inTank ? T.sspeed : wp.speed;
    const lead = best.d / sp;
    const tx = best.p.x + (best.o.vx || 0) * lead, ty = best.p.y + (best.o.vy || 0) * lead;
    b.a = Math.atan2(ty - me.y, tx - me.x) + (st.rand() - 0.5) * b.skill * 2;
    if (best.d < range) b.f = inTank ? Math.abs(angDiff(myTank.ta, b.a)) < 0.2 : true;
    if (!inTank && u.g > 0 && best.d > 6 && best.d < 12 && !best.tank && st.rand() < 0.04) b.gr = best.d;
    if (!inTank && u.ammo[u.w].mag <= 0) b.r = true;
    b.strafeT -= interval;
    if (b.strafeT <= 0) { b.strafe = -b.strafe; b.strafeT = 0.8 + st.rand() * 1.4; }
    const ang = Math.atan2(best.p.y - me.y, best.p.x - me.x);
    const ideal = u.w === 2 ? 22 : inTank ? 12 : 11;
    let fwd = best.d > ideal + 3 ? 1 : best.d < ideal - 4 ? -0.8 : 0;
    const side = inTank ? 0 : b.strafe * 0.8;
    // in der Eroberung: nicht zu weit von der Zone weglaufen
    setMove(b, Math.cos(ang) * fwd - Math.sin(ang) * side, Math.sin(ang) * fwd + Math.cos(ang) * side);
    if (fwd > 0 && !lineOfSight(me, best.p)) goTo(st, u, best.p.x, best.p.y, grid);
    return;
  }
  b.a = Math.atan2(b.my, b.mx) || b.a;
  if (!inTank && u.ammo[u.w].mag < WEAPONS[u.w].mag * 0.5) b.r = true;
  // Kein Gegner in Sicht: Ziel wählen
  let gx, gy;
  if (!inTank && u.hp < 40) {
    const med = st.pickups.filter((p) => p.k === 'med' && p.on).sort((p, q) => dist(me, p) - dist(me, q))[0];
    if (med && dist(me, med) < 25) { gx = med.x; gy = med.y; } else { gx = SPAWN_X[u.team]; gy = SPAWN_Y[u.team][u.slot]; }
  } else if (st.mode === 'conquest') {
    const zs = st.zones.map((z, i) => ({ z, i, d: dist(me, z) + (z.owner === u.team && Math.abs(z.p) >= 1 ? 25 : 0) + (u.slot % 3 === i ? -8 : 0) }));
    zs.sort((a, c) => a.d - c.d);
    const z = zs[0].z;
    const ang = (u.id * 1.7) % (Math.PI * 2);
    gx = z.x + Math.cos(ang) * 2; gy = z.y + Math.sin(ang) * 2;
  } else {
    let near = null, nd = 1e9;
    for (const o of st.units) { if (!o.alive || o.team === u.team) continue; const p = posOf(st, o); const d = dist(me, p); if (d < nd) { nd = d; near = p; } }
    if (near) { gx = near.x; gy = near.y; } else { gx = SPAWN_X[1 - u.team]; gy = 25; }
  }
  goTo(st, u, gx, gy, grid);
}
function goTo(st, u, gx, gy, grid) {
  const b = u.bot, me = posOf(st, u);
  b.pathT -= 0.2;
  if (!b.path || b.pathT <= 0 || !b.goal || Math.hypot(b.goal.x - gx, b.goal.y - gy) > 3) {
    b.path = findPath(grid, me.x, me.y, gx, gy) || [];
    b.goal = { x: gx, y: gy }; b.pathT = 1.5 + st.rand();
  }
  while (b.path.length && Math.hypot(b.path[0].x - me.x, b.path[0].y - me.y) < 0.9) b.path.shift();
  const wpnt = b.path[0] || { x: gx, y: gy };
  setMove(b, wpnt.x - me.x, wpnt.y - me.y);
  if (!b.f) b.a = Math.atan2(wpnt.y - me.y, wpnt.x - me.x);
}
function setMove(b, x, y) { const l = Math.hypot(x, y); if (l < 0.3) { b.mx = 0; b.my = 0; } else { b.mx = x / l; b.my = y / l; } }
function botInput(u) {
  const b = u.bot;
  const base = { a: b.a, f: b.f, u: b.u, g: b.gr, gd: b.gr, r: b.r };
  return b.detour > 0 ? { ...base, mx: b.dx, my: b.dy } : { ...base, mx: b.mx, my: b.my };
}

// ---------- Ein Simulationsschritt ----------
// inputs: { [unitId]: { mx, my, a, f, u, w, r, g, gd } } – u/r/g werden einmal ausgewertet
export function step(st, inputs = {}) {
  const dt = DT;
  st.time += dt;
  if (st.ph === 'end') return;
  if (st.ph === 'count') {
    st.cd -= dt;
    for (const u of st.units) { const i = inputs[u.id]; if (u.human && i && Number.isFinite(i.a)) u.a = i.a; if (u.human && i && i.w >= 0 && i.w < 4) u.w = i.w; }
    if (st.cd <= 0) { st.ph = 'play'; st.fx.push({ k: 'go' }); }
    return;
  }
  st.tl -= dt;

  for (const u of st.units) {
    if (!u.alive) { u.rt -= dt; if (u.rt <= 0) respawn(st, u); continue; }
    let inp;
    if (u.human) inp = inputs[u.id] || { mx: 0, my: 0, a: u.a, f: false };
    else { botThink(st, u, dt); inp = botInput(u); }
    const mx = Math.max(-1, Math.min(1, +inp.mx || 0)), my = Math.max(-1, Math.min(1, +inp.my || 0));
    const a = Number.isFinite(+inp.a) ? +inp.a : u.a;
    if (inp.u) tryUse(st, u);
    if (u.tank < 0 && Number.isInteger(inp.w) && inp.w >= 0 && inp.w < 4 && inp.w !== u.w) { u.w = inp.w; u.rl = 0; u.cd = Math.max(u.cd, 0.25); }
    if (inp.r && u.tank < 0) startReload(u);
    if (inp.g && u.tank < 0) throwGrenade(st, u, a, +inp.gd || 9);
    u.inv = Math.max(0, u.inv - dt); u.cd -= dt; u.calm += dt;
    if (u.calm > 5 && u.hp < S.hp) u.hp = Math.min(S.hp, u.hp + 10 * dt);

    if (u.tank >= 0) {
      const t = st.tanks[u.tank];
      const l = Math.hypot(mx, my);
      let vx = 0, vy = 0;
      if (l > 0.2) {
        const want = Math.atan2(my, mx);
        t.a = turnTo(t.a, want, T.turn * dt);
        const f = Math.max(0, Math.cos(angDiff(t.a, want))) * Math.min(1, l);
        vx = Math.cos(t.a) * T.speed * f; vy = Math.sin(t.a) * T.speed * f;
      }
      t.x += vx * dt; t.y += vy * dt;
      collide(t, T.r);
      const o = st.tanks[1 - t.team];
      if (o.alive) { const d = dist(t, o); if (d < T.r * 2 && d > 1e-6) { const push = (T.r * 2 - d) / 2; t.x += (t.x - o.x) / d * push; t.y += (t.y - o.y) / d * push; collide(t, T.r); } }
      t.ta = turnTo(t.ta, a, T.tturn * dt);
      u.x = t.x; u.y = t.y; u.a = t.ta; u.vx = vx; u.vy = vy;
      t.cd -= dt;
      if (inp.f && t.cd <= 0) { t.cd = T.cd; fireShell(st, u, t); }
    } else {
      const wp = WEAPONS[u.w];
      const l = Math.hypot(mx, my);
      const k = (l > 1 ? 1 / l : 1) * S.speed * (inp.f && wp.slow ? wp.slow : 1);
      u.vx = mx * k; u.vy = my * k;
      u.x += u.vx * dt; u.y += u.vy * dt;
      collide(u, S.r);
      for (const t of st.tanks) {
        if (!t.alive) continue;
        const d = dist(u, t);
        if (d < T.r + S.r && d > 1e-6) { u.x = t.x + (u.x - t.x) / d * (T.r + S.r); u.y = t.y + (u.y - t.y) / d * (T.r + S.r); collide(u, S.r); }
      }
      u.a = a;
      const am = u.ammo[u.w];
      if (u.rl > 0) {
        u.rl -= dt;
        if (u.rl <= 0) { const n = Math.min(wp.mag - am.mag, am.res); am.mag += n; am.res -= n; u.rl = 0; st.fx.push({ k: 'reloaded', id: u.id }); }
      } else if (inp.f && u.cd <= 0) {
        if (am.mag > 0) { am.mag--; u.cd = wp.cd; u.inv = 0; fire(st, u, u.x + Math.cos(a) * 0.7, u.y + Math.sin(a) * 0.7, a, wp); if (am.mag === 0) startReload(u); }
        else { startReload(u); u.cd = 0.3; }
      }
      // Pickups
      for (const p of st.pickups) {
        if (!p.on || Math.hypot(p.x - u.x, p.y - u.y) > 1.1) continue;
        if (p.k === 'med' && u.hp < S.hp) { u.hp = Math.min(S.hp, u.hp + 60); p.on = false; p.t = 20; st.fx.push({ k: 'pick', id: u.id, p: 'med' }); }
        else if (p.k === 'ammo' && (u.ammo.some((x, i) => x.res < WEAPONS[i].reserve) || u.g < S.grenades)) { u.ammo.forEach((x, i) => { x.res = WEAPONS[i].reserve; }); u.g = S.grenades; p.on = false; p.t = 20; st.fx.push({ k: 'pick', id: u.id, p: 'ammo' }); }
      }
    }
  }
  for (const p of st.pickups) if (!p.on) { p.t -= dt; if (p.t <= 0) p.on = true; }
  for (const t of st.tanks) {
    if (t.alive) continue;
    t.rt -= dt;
    if (t.rt <= 0) { const s = TANK_SPAWN[t.team]; Object.assign(t, { alive: true, hp: T.hp, x: s.x, y: s.y, a: s.a, ta: s.a, driver: 0, cd: 0, skin: 'oliv' }); }
  }

  // Geschosse
  const next = [];
  for (const b of st.bullets) {
    const steps = b.kind === 3 ? 7 : 4;
    let hit = false;
    const owner = unitById(st, b.owner);
    const boom = b.kind === 1 || b.kind === 2;
    for (let s = 0; s < steps && !hit; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (blocked(b.x, b.y)) { hit = true; if (boom) explode(st, b.x, b.y, owner, b.splash, b.kind === 1 ? T.splashDmg : 55, b.kind === 1 ? 'tank' : 'rocket'); else st.fx.push({ k: 'spark', x: r2(b.x), y: r2(b.y) }); break; }
      for (const t of st.tanks) {
        if (!t.alive || t.team === b.team) continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) < T.r) {
          hit = true;
          if (boom) { damageTank(st, t, b.tank, owner, b.kind === 1 ? 'tank' : 'rocket'); explode(st, b.x, b.y, owner, b.splash, 40, b.kind === 1 ? 'tank' : 'rocket'); }
          else { damageTank(st, t, b.kind === 3 ? 20 : 3, owner, 'rifle'); st.fx.push({ k: 'spark', x: r2(b.x), y: r2(b.y) }); }
          break;
        }
      }
      if (hit) break;
      for (const u of st.units) {
        if (!u.alive || u.team === b.team || u.tank >= 0) continue;
        if (Math.hypot(u.x - b.x, u.y - b.y) < S.r + 0.12) {
          hit = true;
          if (boom) { damageUnit(st, u, b.dmg, owner, b.kind === 1 ? 'tank' : 'rocket'); explode(st, b.x, b.y, owner, b.splash, 40, b.kind === 1 ? 'tank' : 'rocket'); }
          else { damageUnit(st, u, b.dmg, owner, b.kind === 3 ? 'sniper' : 'rifle'); st.fx.push({ k: 'hit', x: r2(b.x), y: r2(b.y) }); }
          break;
        }
      }
    }
    b.life -= dt;
    if (!hit && b.life > 0) next.push(b);
    else if (!hit && boom) explode(st, b.x, b.y, owner, b.splash, b.kind === 1 ? T.splashDmg : 55, b.kind === 1 ? 'tank' : 'rocket');
  }
  st.bullets = next;

  // Granaten
  const nn = [];
  for (const g of st.nades) {
    g.t += dt;
    const p = Math.min(1, g.t / g.dur);
    const nx = g.sx + (g.tx - g.sx) * p, ny = g.sy + (g.ty - g.sy) * p;
    if (p < 1 && blocked(nx, ny)) { g.tx = g.x; g.ty = g.y; g.dur = g.t; } else { g.x = nx; g.y = ny; }
    if (g.t >= g.dur) { g.fuse -= dt; if (g.fuse <= 0) { const o = unitById(st, g.owner); explode(st, g.x, g.y, o, GREN.radius, GREN.dmg, 'grenade'); continue; } }
    nn.push(g);
  }
  st.nades = nn;

  // Eroberung
  if (st.mode === 'conquest') {
    for (const z of st.zones) {
      const n = [0, 0];
      for (const u of st.units) { if (!u.alive) continue; const p = posOf(st, u); if (Math.hypot(p.x - z.x, p.y - z.y) < ZONE_R) n[u.team]++; }
      z.contested = n[0] > 0 && n[1] > 0;
      if (z.contested || (!n[0] && !n[1])) continue;
      const team = n[0] ? 0 : 1, dir = team === 0 ? 1 : -1;
      const before = z.owner;
      z.p = Math.max(-1, Math.min(1, z.p + dir * Math.min(3, n[team]) * 0.12 * dt));
      if (z.p >= 1) z.owner = 0; else if (z.p <= -1) z.owner = 1; else if ((z.owner === 0 && z.p <= 0) || (z.owner === 1 && z.p >= 0)) z.owner = -1;
      if (z.owner !== before && z.owner >= 0) {
        st.fx.push({ k: 'cap', z: z.id, team: z.owner });
        for (const u of st.units) if (u.alive && u.team === z.owner && Math.hypot(posOf(st, u).x - z.x, posOf(st, u).y - z.y) < ZONE_R) u.caps++;
      }
    }
    st.zoneTick += dt;
    if (st.zoneTick >= 1) { st.zoneTick -= 1; for (const z of st.zones) if (z.owner >= 0) st.score[z.owner]++; }
  }

  if (st.score[0] >= st.win || st.score[1] >= st.win || st.tl <= 0) {
    st.ph = 'end'; st.tl = Math.max(0, st.tl);
    st.winner = st.score[0] === st.score[1] ? -1 : st.score[0] > st.score[1] ? 0 : 1;
    st.fx.push({ k: 'end', winner: st.winner });
  }
}

// Kompakter Zustand für das Netzwerk
export function snapshot(st) {
  const s = {
    ph: st.ph, tl: Math.ceil(st.tl), cd: Math.ceil(st.cd), sc: st.score,
    u: st.units.map((u) => [u.id, r2(u.x), r2(u.y), r2(u.a), Math.ceil(u.hp), (u.alive ? 1 : 0) | (u.tank >= 0 ? 2 : 0) | (u.inv > 0 ? 4 : 0) | (u.rl > 0 ? 8 : 0), u.alive ? 0 : Math.ceil(u.rt), u.w, u.ammo[u.w].mag, u.ammo[u.w].res, u.g]),
    k: st.tanks.map((t) => [r2(t.x), r2(t.y), r2(t.a), r2(t.ta), Math.ceil(t.hp), t.alive ? 1 : 0, t.driver, t.skin, Math.max(0, r2(t.cd))]),
    b: st.bullets.map((b) => [r2(b.x), r2(b.y), b.kind, r2(Math.atan2(b.vy, b.vx))]),
    n: st.nades.map((g) => [r2(g.x), r2(g.y), r2(g.t < g.dur ? Math.sin(Math.PI * g.t / g.dur) * 2 : 0)]),
    p: st.pickups.map((p) => (p.on ? 1 : 0)),
    z: st.mode === 'conquest' ? st.zones.map((z) => [Math.round(z.p * 100), z.owner, z.contested ? 1 : 0]) : null,
    fx: st.fx,
  };
  st.fx = [];
  return s;
}

export function roster(st) { return st.units.map((u) => ({ id: u.id, name: u.name, team: u.team, human: u.human, skin: u.skin })); }
export function results(st) {
  return {
    winner: st.winner, score: st.score, mode: st.mode, colors: st.colors,
    players: st.units.map((u) => ({ id: u.id, name: u.name, team: u.team, human: u.human, kills: u.kills, deaths: u.deaths, tk: u.tk, caps: u.caps })),
  };
}
export function outcomeFor(st, team) { return st.winner === -1 ? 'draw' : st.winner === team ? 'win' : 'loss'; }
