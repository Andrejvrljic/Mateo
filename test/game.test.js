import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, CATEGORIES, pickQuestions, shuffleAnswers, answerPoints } from '../public/shared/questions.js';
import { freshProfile, normalize, applyQuiz, applyGame, applyBattle, claimDaily, runShop, rankInfo, RANKS, GAMES, MINIGAMES } from '../public/shared/progress.js';
import { createBattle, step, snapshot, results, lineOfSight, blocked, RECTS, W, H } from '../public/shared/battle.js';

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

test('Gefecht: Karte ist frei an den Startpunkten', () => {
  const st = createBattle([]);
  for (const u of st.units) assert.ok(!blocked(u.x, u.y), `Spawn ${u.x},${u.y}`);
  for (const t of st.tanks) assert.ok(!blocked(t.x, t.y));
  assert.ok(RECTS.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H));
  assert.equal(lineOfSight({ x: 1, y: 20 }, { x: 63, y: 20 }), false, 'Mitte ist blockiert');
});

test('Gefecht: Bots spielen ein ganzes Match zu Ende, Panzer werden benutzt', () => {
  for (const seed of [1, 2, 3]) {
    const st = createBattle([{ name: 'Mensch', human: true, key: 1 }], { seed });
    let n = 0, tankTicks = 0;
    while (st.ph !== 'end' && n < 5000) { step(st, {}); snapshot(st); n++; if (st.tanks.some((t) => t.driver)) tankTicks++; }
    assert.equal(st.ph, 'end', 'Match endet');
    assert.ok(st.score[0] + st.score[1] > 5, 'es wird gekämpft');
    assert.ok(tankTicks > 100, 'Panzer werden gefahren');
    const r = results(st);
    assert.equal(r.players.length, 10);
    assert.ok([0, 1, -1].includes(r.winner));
  }
});

test('Gefecht: Mensch steigt in den Panzer und wieder aus', () => {
  const st = createBattle([{ name: 'Ich', human: true, key: 1 }], { seed: 5 });
  const me = st.units.find((u) => u.human);
  while (st.ph === 'count') step(st, {});
  const t = st.tanks[me.team];
  me.x = t.x - 2; me.y = t.y;
  step(st, { [me.id]: { mx: 0, my: 0, a: 0, f: false, u: true } });
  assert.equal(me.tank, me.team, 'eingestiegen');
  assert.equal(t.driver, me.id);
  for (let i = 0; i < 20; i++) step(st, { [me.id]: { mx: 1, my: 0, a: 0, f: true } });
  assert.ok(t.x > 6.5, 'Panzer fährt');
  step(st, { [me.id]: { mx: 0, my: 0, a: 0, f: false, u: true } });
  assert.equal(me.tank, -1, 'ausgestiegen');
  assert.ok(!blocked(me.x, me.y));
});
