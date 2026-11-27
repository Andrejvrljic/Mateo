import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, CATEGORIES, pickQuestions, shuffleAnswers, answerPoints } from '../public/shared/questions.js';
import { freshProfile, normalize, applyQuiz, applyGame, applyBattle, claimDaily, runShop, rankInfo, RANKS, GAMES, MINIGAMES } from '../public/shared/progress.js';
import { createBattle, step, snapshot, results, blocked, findPath, GRID_SOLDIER, RECTS, ZONES, PICKUPS, MODES, W, H } from '../public/shared/battle.js';
import { STATIONS, BOXES, TREES, collideWorld, plateAt, spawnPoint } from '../public/shared/world.js';

test('Fragen sind vollständig und eindeutig', () => {
  assert.ok(QUESTIONS.length >= 140);
  const seen = new Set();
  for (const q of QUESTIONS) {
    assert.ok(CATEGORIES[q.cat], q.q);
    assert.equal(q.a.length, 4, q.q);
    assert.equal(new Set(q.a).size, 4, 'doppelte Antwort: ' + q.q);
    assert.ok(!seen.has(q.q), 'doppelte Frage: ' + q.q);
    seen.add(q.q);
  }
  for (const c of Object.keys(CATEGORIES)) if (c !== 'mix') assert.ok(pickQuestions(c, 10).length === 10, c);
  const s = shuffleAnswers();
  assert.equal(s.order[s.right], 0);
  assert.equal(answerPoints(false, 1), 0);
  assert.ok(answerPoints(true, 1) > answerPoints(true, 15));
});

test('Ränge und Belohnungen', () => {
  assert.equal(rankInfo(0).name, 'Rekrut');
  assert.equal(rankInfo(1400).name, 'Feldwebel');
  assert.equal(rankInfo(999999).name, 'General');
  assert.equal(RANKS.length, 19);
  const p = freshProfile();
  const q = applyQuiz(p, { correct: 10, total: 10, points: 1500 });
  assert.equal(q.perfect, true);
  assert.equal(p.xp, 150);
  assert.ok(p.medals.includes('perfect') && p.medals.includes('first_quiz'));
  assert.equal(q.rankUp, 'Gefreiter');
  for (const g of MINIGAMES) assert.ok(applyGame(p, g, 1000, { won: true }));
  applyBattle(p, { outcome: 'win', kills: 3 });
  assert.ok(p.medals.includes('all_games') && p.medals.includes('mines_win'));
  assert.equal(applyGame(p, 'range', 1e9).score, GAMES.range.max);
  const day = Date.UTC(2026, 0, 10);
  assert.equal(claimDaily(p, day).streak, 1);
  assert.equal(claimDaily(p, day + 1000), null);
  assert.equal(claimDaily(p, day + 864e5).streak, 2);
  p.coins = 200;
  assert.ok(runShop(p, { type: 'buy', item: 'wald' }).ok);
  assert.equal(p.skin, 'wald');
  assert.ok(runShop(p, { type: 'buy', item: 'gold' }).error);
  assert.ok(runShop(p, { type: 'equip', item: 'oliv' }).ok);
  const n = normalize({ xp: -5, skins: ['quatsch'], skin: 'gold' });
  assert.equal(n.xp, 0); assert.deepEqual(n.skins, ['oliv']); assert.equal(n.skin, 'oliv');
});

test('Gefecht: Karte – Startpunkte frei, alles erreichbar', () => {
  const st = createBattle([]);
  for (const u of st.units) assert.ok(!blocked(u.x, u.y), `Spawn ${u.x},${u.y}`);
  for (const t of st.tanks) assert.ok(!blocked(t.x, t.y));
  for (const p of [...ZONES, ...PICKUPS]) { assert.ok(!blocked(p.x, p.y), JSON.stringify(p)); assert.ok(findPath(GRID_SOLDIER, 3, 25, p.x, p.y), 'erreichbar ' + JSON.stringify(p)); }
  assert.ok(RECTS.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H));
  assert.ok(findPath(GRID_SOLDIER, 3, 25, 77, 25).length > 0);
});

for (const mode of ['tdm', 'conquest']) {
  test(`Gefecht (${MODES[mode].name}): Bots spielen ein ganzes Match, nutzen Panzer, Waffen und Pickups`, () => {
    const st = createBattle([{ name: 'Mensch', key: 1 }], { seed: 7, mode });
    let n = 0, tank = 0; const seen = new Set();
    while (st.ph !== 'end' && n < 9000) { step(st, {}); n++; if (st.tanks.some((t) => t.driver)) tank++; for (const f of snapshot(st).fx) seen.add(f.k === 'shot' ? 'shot' + f.w : f.k); }
    assert.equal(st.ph, 'end');
    assert.ok(Math.max(...st.score) >= MODES[mode].win || st.tl <= 0);
    assert.ok(tank > 100, 'Panzer werden gefahren');
    for (const k of ['shot0', 'shot2', 'cannon', 'kill', 'dmg']) assert.ok(seen.has(k), k);
    if (mode === 'conquest') assert.ok(seen.has('cap'), 'Zonen werden erobert');
    assert.equal(results(st).players.length, 10);
  });
}

test('Gefecht: Mensch – Panzer, Waffenwechsel, Nachladen, Granate, Medikit', () => {
  const st = createBattle([{ name: 'Ich', key: 1, team: 0 }], { seed: 5, colors: ['#111', '#222'] });
  const me = st.units.find((u) => u.human);
  assert.deepEqual(st.colors, ['#111', '#222']);
  while (st.ph === 'count') step(st, {});
  const t = st.tanks[0];
  me.x = t.x - 2.2; me.y = t.y;
  step(st, { [me.id]: { mx: 0, my: 0, a: 0, u: true } });
  assert.equal(me.tank, 0, 'eingestiegen');
  for (let i = 0; i < 20; i++) step(st, { [me.id]: { mx: 1, my: 0, a: 0, f: true } });
  assert.ok(t.x > 7.5, 'Panzer fährt');
  step(st, { [me.id]: { mx: 0, my: 0, a: 0, u: true } });
  assert.equal(me.tank, -1, 'ausgestiegen');
  step(st, { [me.id]: { mx: 0, my: 0, a: 0, w: 2 } });
  assert.equal(me.w, 2, 'Scharfschütze');
  me.inv = 0; me.x = 5; me.y = 25;
  for (let i = 0; i < 6; i++) { me.cd = 0; step(st, { [me.id]: { mx: 0, my: 0, a: Math.PI, f: true } }); }
  assert.ok(me.rl > 0 || me.ammo[2].mag < 5, 'geschossen / lädt nach');
  const g0 = me.g;
  step(st, { [me.id]: { mx: 0, my: 0, a: 0, g: true, gd: 8 } });
  assert.equal(me.g, g0 - 1, 'Granate geworfen');
  assert.equal(st.nades.length, 1);
  const med = st.pickups.find((p) => p.k === 'med');
  me.hp = 30; me.calm = 0; me.x = med.x; me.y = med.y;
  step(st, { [me.id]: { mx: 0, my: 0, a: 0 } });
  assert.ok(me.hp >= 85 && !med.on, 'Medikit genommen');
});

test('Welt: Druckplatten liegen frei, Start in der Mitte, Kollision mit Gebäuden', () => {
  for (const s of STATIONS) {
    const p = collideWorld({ x: s.x, z: s.z });
    assert.ok(Math.hypot(p.x - s.x, p.z - s.z) < 0.01, 'Platte frei: ' + s.id);
    assert.equal(plateAt(s.x, s.z).id, s.id);
  }
  for (let i = 0; i < 20; i++) { const sp = spawnPoint(i); assert.equal(plateAt(sp.x, sp.z), null); }
  const b = BOXES[0];
  const p = collideWorld({ x: b.x, z: b.z });
  assert.ok(Math.hypot(p.x - b.x, p.z - b.z) > 2, 'aus dem Gebäude geschoben');
  assert.ok(TREES.length > 30);
});
