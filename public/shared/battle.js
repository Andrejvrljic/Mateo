// Gefecht 5 gegen 5 mit Panzern – gemeinsame Simulation.
// Offline läuft sie im Browser, online im Multiplayer-Server (Durable Object). Feste Schrittweite DT.
export const DT = 0.05;
export const W = 64, H = 40;
export const WIN_KILLS = 20;
export const MATCH_TIME = 180;
export const COUNTDOWN = 3;
export const TEAM_SIZE = 5;
export const TEAM_NAMES = ['Team Blau', 'Team Rot'];

const S = { speed: 5.2, r: 0.45, hp: 100, cd: 0.16, bspeed: 30, dmg: 11, life: 0.75, spread: 0.05, respawn: 4 };
const T = { speed: 3.6, r: 1.25, hp: 600, turn: 2.2, tturn: 3.2, cd: 1.5, sspeed: 22, life: 1.1, direct: 80, directTank: 140, splash: 2.5, splashDmg: 55, respawn: 15 };
export const SOLDIER = S, TANK = T;

// Hindernisse der linken Hälfte [x, y, Breite, Höhe, Art] – die rechte Hälfte wird gespiegelt
const HALF = [
  [9, 6, 1.2, 7, 'sand'], [9, 27, 1.2, 7, 'sand'],
  [15, 14.8, 4, 1.2, 'wall'], [15, 24, 4, 1.2, 'wall'],
  [20, 3, 2, 6.5, 'wall'], [20, 30.5, 2, 6.5, 'wall'],
  [25, 11.5, 1.2, 5, 'sand'], [25, 23.5, 1.2, 5, 'sand'],
  [13, 33, 2.6, 2.6, 'crate'], [13, 4.4, 2.6, 2.6, 'crate'],
];
const CENTER = [[30, 17, 4, 6, 'wall'], [29, 2.2, 6, 1.2, 'sand'], [29, 36.6, 6, 1.2, 'sand']];
export const RECTS = [
  ...HALF.map(([x, y, w, h, k]) => ({ x, y, w, h, k })),
  ...HALF.map(([x, y, w, h, k]) => ({ x: W - x - w, y, w, h, k })),
  ...CENTER.map(([x, y, w, h, k]) => ({ x, y, w, h, k })),
];
export const SPAWN_X = [3, W - 3];
const SPAWN_Y = [12, 16, 20, 24, 28];
const TANK_SPAWN = [{ x: 6, y: 20, a: 0 }, { x: W - 6, y: 20, a: Math.PI }];

const BOT_NAMES = ['Krüger', 'Novak', 'Brandt', 'Weber', 'Schulz', 'Ivanov', 'Rossi', 'Dubois', 'Jansen', 'Kowalski', 'Lindqvist', 'Moreau', 'Hartmann', 'Fischer', 'Becker', 'Petrov', 'Costa', 'Silva', 'Wagner', 'Keller'];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const turnTo = (a, b, max) => { const d = angDiff(a, b); return a + Math.max(-max, Math.min(max, d)); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const r2 = (v) => Math.round(v * 100) / 100;

// Strecke (x1,y1)-(x2,y2) schneidet Rechteck?
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
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export function blocked(x, y) { if (x < 0 || y < 0 || x > W || y > H) return true; for (const r of RECTS) if (inRect(x, y, r)) return true; return false; }

// Kreis aus Hindernissen und Spielfeldrand schieben
function collide(o, rad) {
  for (const r of RECTS) {
    const cx = Math.max(r.x, Math.min(o.x, r.x + r.w)), cy = Math.max(r.y, Math.min(o.y, r.y + r.h));
    const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
    if (d < rad) {
      if (d > 1e-6) { o.x = cx + (dx / d) * rad; o.y = cy + (dy / d) * rad; }
      else { // Mittelpunkt im Rechteck: kürzester Weg hinaus
        const opts = [[o.x - r.x + rad, -1, 0], [r.x + r.w - o.x + rad, 1, 0], [o.y - r.y + rad, 0, -1], [r.y + r.h - o.y + rad, 0, 1]].sort((a, b) => a[0] - b[0]);
        o.x += opts[0][1] * opts[0][0]; o.y += opts[0][2] * opts[0][0];
      }
    }
  }
  o.x = Math.max(rad, Math.min(W - rad, o.x)); o.y = Math.max(rad, Math.min(H - rad, o.y));
}

// players: [{ name, human: true, skin, key }] – Bots füllen auf 5 gegen 5 auf.
export function createBattle(players = [], { seed = Date.now() & 0xffffffff, timeLimit = MATCH_TIME, winKills = WIN_KILLS } = {}) {
  const rand = rng(seed);
  const humans = players.slice(0, TEAM_SIZE * 2);
  const teams = [[], []];
  for (const p of humans) {
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
      const u = {
        id: id++, team, name: p ? String(p.name).slice(0, 16) : 'Bot ' + names.pop(), human: !!p, key: p ? p.key : null, skin: (p && p.skin) || 'oliv',
        x: SPAWN_X[team], y: SPAWN_Y[k], a: team === 0 ? 0 : Math.PI, hp: S.hp, alive: true, rt: 0, inv: 1.5, cd: 0, tank: -1,
        kills: 0, deaths: 0, tk: 0, calm: 9,
        bot: { think: rand() * 0.3, mx: 0, my: 0, a: 0, f: false, u: false, strafe: rand() < 0.5 ? 1 : -1, strafeT: 1 + rand(), stuck: 0, detour: 0, dx: 0, dy: 0, px: 0, py: 0, lane: SPAWN_Y[k], skill: 0.08 + rand() * 0.1, tankist: k === 2 },
      };
      units.push(u);
    }
  }
  const tanks = TANK_SPAWN.map((s, team) => ({ team, x: s.x, y: s.y, a: s.a, ta: s.a, hp: T.hp, alive: true, rt: 0, driver: 0, cd: 0, skin: 'oliv' }));
  return { ph: 'count', time: 0, cd: COUNTDOWN, tl: timeLimit, winKills, score: [0, 0], units, tanks, bullets: [], fx: [], rand, winner: null };
}

export const unitById = (st, id) => st.units.find((u) => u.id === id);
const posOf = (st, u) => (u.tank >= 0 ? st.tanks[u.tank] : u);

function kill(st, victim, attacker, weapon) {
  victim.alive = false; victim.hp = 0; victim.rt = S.respawn; victim.deaths++;
  if (victim.tank >= 0) { st.tanks[victim.tank].driver = 0; victim.tank = -1; }
  if (attacker && attacker.team !== victim.team) {
    attacker.kills++; if (weapon === 'tank') attacker.tk++;
    st.score[attacker.team]++;
  }
  st.fx.push({ k: 'kill', a: attacker ? attacker.id : 0, v: victim.id, w: weapon });
}

function damageUnit(st, u, amt, attacker, weapon) {
  if (!u.alive || u.inv > 0 || u.tank >= 0) return;
  u.hp -= amt; u.calm = 0;
  if (u.hp <= 0) kill(st, u, attacker, weapon);
}
function damageTank(st, t, amt, attacker, weapon) {
  if (!t.alive) return;
  t.hp -= amt;
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
    const x = t.x + Math.cos(off) * (T.r + 0.8), y = t.y + Math.sin(off) * (T.r + 0.8);
    if (!blocked(x, y)) { u.x = x; u.y = y; break; }
  }
  u.inv = 0.5;
  collide(u, S.r);
}

function tryUse(st, u) {
  if (!u.alive) return;
  if (u.tank >= 0) { exitTank(st, u); return; }
  const t = st.tanks[u.team];
  if (!t.alive || dist(t, u) > T.r + 1.4) return;
  if (t.driver) {
    const d = unitById(st, t.driver);
    if (d.human || !u.human) return; // Bots machen Menschen Platz
    exitTank(st, d);
  }
  t.driver = u.id; u.tank = u.team; t.skin = u.skin;
  st.fx.push({ k: 'enter', id: u.id });
}

function fireBullet(st, owner, x, y, a, kind) {
  const sp = kind ? T.sspeed : S.bspeed;
  const spread = kind ? 0 : (st.rand() - 0.5) * 2 * S.spread;
  st.bullets.push({ x, y, vx: Math.cos(a + spread) * sp, vy: Math.sin(a + spread) * sp, life: kind ? T.life : S.life, team: owner.team, owner: owner.id, kind });
  if (kind) st.fx.push({ k: 'shot', x: r2(x), y: r2(y) });
}

function explode(st, x, y, owner) {
  st.fx.push({ k: 'boom', x: r2(x), y: r2(y) });
  for (const u of st.units) {
    if (!u.alive || u.tank >= 0 || u.team === owner.team) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < T.splash) damageUnit(st, u, T.splashDmg * (1 - d / T.splash * 0.6), owner, 'tank');
  }
  for (const t of st.tanks) {
    if (!t.alive || t.team === owner.team) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < T.splash + T.r) damageTank(st, t, 40 * (1 - Math.min(1, d / (T.splash + T.r))), owner, 'tank');
  }
}

// ---------- Bots ----------
function botThink(st, u, dt) {
  const b = u.bot;
  const me = posOf(st, u);
  b.think -= dt;
  // festgefahren? -> kurz seitlich ausweichen
  if (b.detour > 0) b.detour -= dt;
  if (b.think > 0) return;
  const interval = 0.2;
  b.think = interval;
  const moved = Math.hypot(me.x - b.px, me.y - b.py);
  if ((Math.abs(b.mx) + Math.abs(b.my)) > 0.3 && moved < 0.25) b.stuck += interval; else b.stuck = 0;
  b.px = me.x; b.py = me.y;
  if (b.stuck > 0.6 && b.detour <= 0) {
    const a = Math.atan2(b.my, b.mx) + (st.rand() < 0.5 ? 1 : -1) * (Math.PI / 2 + st.rand() * 0.6);
    b.dx = Math.cos(a); b.dy = Math.sin(a); b.detour = 0.8; b.stuck = 0;
  }
  b.u = false; b.f = false;
  const myTank = st.tanks[u.team];
  const inTank = u.tank >= 0;

  // Panzerfahrer-Bot steigt ein, wenn der Panzer frei ist und kein Mensch in der Nähe
  if (!inTank && b.tankist && myTank.alive && !myTank.driver && !st.units.some((o) => o.human && o.team === u.team && o.alive && o.tank < 0 && dist(o, myTank) < 6)) {
    const d = dist(u, myTank);
    if (d < T.r + 1.2) { b.u = true; return; }
    if (d < 25) { setMove(b, myTank.x - u.x, myTank.y - u.y); b.a = Math.atan2(myTank.y - u.y, myTank.x - u.x); return; }
  }

  // Ziel suchen: sichtbare Gegner zuerst
  let best = null, bestD = 1e9, near = null, nearD = 1e9;
  for (const o of st.units) {
    if (!o.alive || o.team === u.team) continue;
    const p = posOf(st, o);
    const d = dist(me, p);
    if (d < nearD) { nearD = d; near = p; }
    if (d < 23 && d < bestD && lineOfSight(me, p)) { bestD = d; best = { p, o, d } }
  }
  const range = inTank ? 21 : 18;
  if (best) {
    const lead = best.d / (inTank ? T.sspeed : S.bspeed);
    const tx = best.p.x + (best.o.vx || 0) * lead, ty = best.p.y + (best.o.vy || 0) * lead;
    b.a = Math.atan2(ty - me.y, tx - me.x) + (st.rand() - 0.5) * b.skill * 2;
    if (best.d < range) b.f = inTank ? Math.abs(angDiff(myTank.ta, b.a)) < 0.2 : true;
    b.strafeT -= interval;
    if (b.strafeT <= 0) { b.strafe = -b.strafe; b.strafeT = 0.8 + st.rand() * 1.4; }
    const ang = Math.atan2(best.p.y - me.y, best.p.x - me.x);
    let fwd = best.d > 13 ? 1 : best.d < 7 ? -0.8 : 0;
    if (inTank) fwd = best.d > 12 ? 1 : best.d < 6 ? -0.5 : 0.1;
    const side = inTank ? 0 : b.strafe * 0.8;
    setMove(b, Math.cos(ang) * fwd - Math.sin(ang) * side, Math.sin(ang) * fwd + Math.cos(ang) * side);
  } else {
    // wenig Leben: zurück zur Basis
    let gx, gy;
    if (!inTank && u.hp < 35) { gx = SPAWN_X[u.team]; gy = b.lane; }
    else if (near) { gx = near.x; gy = near.y + (b.lane - 20) * 0.3; }
    else { gx = SPAWN_X[1 - u.team]; gy = b.lane; }
    setMove(b, gx - me.x, gy - me.y);
    b.a = Math.atan2(gy - me.y, gx - me.x);
  }
  // Mensch will den Panzer: Bot steigt aus, wenn ein Mensch daneben steht (über tryUse geregelt)
}
function setMove(b, x, y) { const l = Math.hypot(x, y); if (l < 0.3) { b.mx = 0; b.my = 0; } else { b.mx = x / l; b.my = y / l; } }

function botInput(u) {
  const b = u.bot;
  if (b.detour > 0) return { mx: b.dx, my: b.dy, a: b.a, f: b.f, u: b.u };
  return { mx: b.mx, my: b.my, a: b.a, f: b.f, u: b.u };
}

// ---------- Ein Simulationsschritt ----------
// inputs: { [unitId]: { mx, my, a, f, u } } – u (Ein-/Aussteigen) wird nur einmal ausgewertet
export function step(st, inputs = {}) {
  const dt = DT;
  st.time += dt;
  if (st.ph === 'end') return;
  if (st.ph === 'count') {
    st.cd -= dt;
    for (const u of st.units) { const i = inputs[u.id]; if (u.human && i && Number.isFinite(i.a)) u.a = i.a; }
    if (st.cd <= 0) { st.ph = 'play'; st.fx.push({ k: 'go' }); }
    return;
  }
  st.tl -= dt;

  for (const u of st.units) {
    if (!u.alive) {
      u.rt -= dt;
      if (u.rt <= 0) {
        u.alive = true; u.hp = S.hp; u.inv = 1.5; u.x = SPAWN_X[u.team]; u.y = SPAWN_Y[(u.id - 1) % TEAM_SIZE] + (st.rand() - 0.5) * 2; u.calm = 9;
        st.fx.push({ k: 'spawn', id: u.id });
      }
      continue;
    }
    let inp;
    if (u.human) inp = inputs[u.id] || { mx: 0, my: 0, a: u.a, f: false };
    else { botThink(st, u, dt); inp = botInput(u); }
    const mx = Math.max(-1, Math.min(1, +inp.mx || 0)), my = Math.max(-1, Math.min(1, +inp.my || 0));
    const a = Number.isFinite(+inp.a) ? +inp.a : u.a;
    if (inp.u) tryUse(st, u);
    u.inv = Math.max(0, u.inv - dt); u.cd -= dt; u.calm += dt;
    if (u.calm > 4 && u.hp < S.hp) u.hp = Math.min(S.hp, u.hp + 12 * dt);

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
      if (inp.f && t.cd <= 0) { t.cd = T.cd; fireBullet(st, u, t.x + Math.cos(t.ta) * (T.r + 0.9), t.y + Math.sin(t.ta) * (T.r + 0.9), t.ta, 1); }
    } else {
      const l = Math.hypot(mx, my);
      const k = l > 1 ? 1 / l : 1;
      u.vx = mx * k * S.speed; u.vy = my * k * S.speed;
      u.x += u.vx * dt; u.y += u.vy * dt;
      collide(u, S.r);
      for (const t of st.tanks) { // nicht durch Panzer laufen
        if (!t.alive) continue;
        const d = dist(u, t);
        if (d < T.r + S.r && d > 1e-6) { u.x = t.x + (u.x - t.x) / d * (T.r + S.r); u.y = t.y + (u.y - t.y) / d * (T.r + S.r); collide(u, S.r); }
      }
      u.a = a;
      if (inp.f && u.cd <= 0) { u.cd = S.cd; u.inv = 0; fireBullet(st, u, u.x + Math.cos(a) * 0.6, u.y + Math.sin(a) * 0.6, a, 0); }
    }
  }

  for (const t of st.tanks) {
    if (t.alive) continue;
    t.rt -= dt;
    if (t.rt <= 0) { const s = TANK_SPAWN[t.team]; Object.assign(t, { alive: true, hp: T.hp, x: s.x, y: s.y, a: s.a, ta: s.a, driver: 0, cd: 0, skin: 'oliv' }); }
  }

  // Geschosse
  const next = [];
  for (const b of st.bullets) {
    const steps = b.kind ? 3 : 4;
    let hit = false;
    const owner = unitById(st, b.owner);
    for (let s = 0; s < steps && !hit; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (blocked(b.x, b.y)) { hit = true; if (b.kind) explode(st, b.x, b.y, owner); else st.fx.push({ k: 'spark', x: r2(b.x), y: r2(b.y) }); break; }
      for (const t of st.tanks) {
        if (!t.alive || t.team === b.team) continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) < T.r) {
          hit = true;
          if (b.kind) { damageTank(st, t, T.directTank, owner, 'tank'); explode(st, b.x, b.y, owner); } else { damageTank(st, t, 3, owner, 'rifle'); st.fx.push({ k: 'spark', x: r2(b.x), y: r2(b.y) }); }
          break;
        }
      }
      if (hit) break;
      for (const u of st.units) {
        if (!u.alive || u.team === b.team || u.tank >= 0) continue;
        if (Math.hypot(u.x - b.x, u.y - b.y) < S.r + 0.1) {
          hit = true;
          if (b.kind) { damageUnit(st, u, T.direct, owner, 'tank'); explode(st, b.x, b.y, owner); } else { damageUnit(st, u, S.dmg, owner, 'rifle'); st.fx.push({ k: 'hit', x: r2(b.x), y: r2(b.y) }); }
          break;
        }
      }
    }
    b.life -= dt;
    if (!hit && b.life > 0) next.push(b);
    else if (!hit && b.kind) explode(st, b.x, b.y, owner);
  }
  st.bullets = next;

  // Ende?
  if (st.score[0] >= st.winKills || st.score[1] >= st.winKills || st.tl <= 0) {
    st.ph = 'end'; st.tl = Math.max(0, st.tl);
    st.winner = st.score[0] === st.score[1] ? -1 : st.score[0] > st.score[1] ? 0 : 1;
    st.fx.push({ k: 'end', winner: st.winner });
  }
}

// Kompakter Zustand für die Anzeige (und das Netzwerk)
export function snapshot(st) {
  const s = {
    ph: st.ph, tl: Math.ceil(st.tl), cd: Math.ceil(st.cd), sc: st.score,
    u: st.units.map((u) => [u.id, r2(u.x), r2(u.y), r2(u.a), Math.ceil(u.hp), (u.alive ? 1 : 0) | (u.tank >= 0 ? 2 : 0) | (u.inv > 0 ? 4 : 0), u.alive ? 0 : Math.ceil(u.rt)]),
    k: st.tanks.map((t) => [r2(t.x), r2(t.y), r2(t.a), r2(t.ta), Math.ceil(t.hp), t.alive ? 1 : 0, t.driver, t.skin, Math.max(0, r2(t.cd))]),
    b: st.bullets.map((b) => [r2(b.x), r2(b.y), b.kind, r2(Math.atan2(b.vy, b.vx))]),
    fx: st.fx,
  };
  st.fx = [];
  return s;
}

export function roster(st) { return st.units.map((u) => ({ id: u.id, name: u.name, team: u.team, human: u.human, skin: u.skin })); }

export function results(st) {
  return {
    winner: st.winner, score: st.score,
    players: st.units.map((u) => ({ id: u.id, name: u.name, team: u.team, human: u.human, kills: u.kills, deaths: u.deaths, tk: u.tk })),
  };
}

export function outcomeFor(st, team) { return st.winner === -1 ? 'draw' : st.winner === team ? 'win' : 'loss'; }
