import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../server/app.js';

// TEST_URL=https://… prüft den laufenden Server (Live-Test auf Cloudflare), sonst startet ein lokaler Testserver.
// Testkonten beginnen mit „kqtest“ und werden nach dem Live-Test vom Workflow wieder gelöscht.
let app, base, wsBase;
before(async () => {
  if (process.env.TEST_URL) base = process.env.TEST_URL.replace(/\/$/, '');
  else {
    process.env.ADMIN_NAMES = '3fach3';
    process.env.ADMIN_CODE = 'TestCode123';
    app = await startServer({ port: 0, dbPath: ':memory:', quiet: true });
    base = `http://127.0.0.1:${app.port}`;
  }
  wsBase = base.replace(/^http/, 'ws');
});
const sockets = [];
after(async () => {
  for (const ws of sockets) { try { ws.terminate(); } catch { /* egal */ } }
  if (app) await app.close();
});

const rnd = () => Math.random().toString(36).slice(2, 9);
const newLogin = () => 'kqtest' + rnd();

async function api(method, url, body, token) {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}
async function signup() {
  const login = newLogin();
  const r = await api('POST', '/api/signup', { login, password: 'geheim123' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { login, token: r.data.token, data: r.data };
}

async function socket() {
  const ws = new WebSocket(wsBase);
  sockets.push(ws);
  const msgs = [], waiters = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    msgs.push(m);
    for (const w of [...waiters]) if (w.fn(m)) { waiters.splice(waiters.indexOf(w), 1); w.ok(m); }
  });
  await new Promise((ok, fail) => { ws.on('open', ok); ws.on('error', fail); });
  return {
    ws, msgs,
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (fn, ms = 8000) => new Promise((ok, fail) => {
      const hit = msgs.find(fn);
      if (hit) { msgs.splice(msgs.indexOf(hit), 1); return ok(hit); }
      const w = { fn, ok: (m) => { clearTimeout(t); msgs.splice(msgs.indexOf(m), 1); ok(m); } };
      const t = setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); fail(new Error('Zeitüberschreitung')); }, ms);
      waiters.push(w);
    }),
    close: () => ws.close(),
  };
}
async function authed(token) {
  const s = await socket();
  s.send({ t: 'auth', token });
  await s.wait((m) => m.t === 'auth');
  return s;
}

test('Spielseite wird ausgeliefert', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Kommando-Quiz/);
  for (const f of ['/js/main.js', '/js/world3d.js', '/js/battle3d.js', '/vendor/three.module.js', '/shared/battle.js', '/shared/world.js', '/style.css']) assert.equal((await fetch(base + f)).status, 200, f);
});

test('Datenbank ist erreichbar', async () => {
  const h = await api('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.data.db, true);
  assert.ok(h.data.questions > 100);
  assert.ok('worlds' in h.data, 'Multiplayer-Server läuft mit dem aktuellen Code (Welten)');
  assert.equal((await api('GET', '/api/leaderboard?board=xp')).status, 200);
});

test('Ohne Konto: keine Aktionen und kein Online-Spiel', async () => {
  assert.equal((await api('POST', '/api/action', { type: 'daily' })).status, 401);
  assert.equal((await api('POST', '/api/quiz/start', {})).status, 401);
  const s = await socket();
  s.send({ t: 'wjoin', server: 'alpha' });
  assert.match((await s.wait((m) => m.t === 'error')).msg, /melde dich an/);
  s.close();
});

test('Konto erstellen, anmelden, Tagesbonus, Shop', async () => {
  const { login, token, data } = await signup();
  assert.equal(data.account.login, login);
  assert.equal(data.profile.coins, 100);
  assert.equal((await api('POST', '/api/signup', { login, password: 'anderes1' })).status, 400, 'Name doppelt');
  assert.equal((await api('POST', '/api/signup', { login: 'ab', password: 'geheim123' })).status, 400, 'Name zu kurz');
  assert.equal((await api('POST', '/api/login', { login, password: 'falsch!!' })).status, 401);
  const li = await api('POST', '/api/login', { login: login.toUpperCase(), password: 'geheim123' });
  assert.equal(li.status, 200);

  const d = await api('POST', '/api/action', { type: 'daily' }, token);
  assert.equal(d.status, 200);
  assert.equal(d.data.profile.coins, 140);
  assert.equal((await api('POST', '/api/action', { type: 'daily' }, token)).status, 400, 'nur einmal am Tag');

  const buy = await api('POST', '/api/action', { type: 'buy', item: 'wald' }, token);
  assert.equal(buy.status, 400, 'zu teuer');
  const j = await api('POST', '/api/action', { type: 'buy', item: 'joker' }, token);
  assert.equal(j.data.profile.jokers, 4);
  const me = await api('GET', '/api/me', null, li.data.token);
  assert.equal(me.data.profile.jokers, 4, 'gleicher Fortschritt auf dem zweiten Gerät');
});

test('Solo-Quiz: Server wertet aus, Joker, Belohnung', async () => {
  const { token } = await signup();
  const s = await api('POST', '/api/quiz/start', { cat: 'panzer', n: 5 }, token);
  assert.equal(s.status, 200);
  assert.equal(s.data.questions.length, 5);
  assert.ok(s.data.questions.every((q) => q.cat === 'panzer' && q.a.length === 4 && !('right' in q)));
  const jk = await api('POST', '/api/quiz/joker', { run: s.data.run, i: 0 }, token);
  assert.equal(jk.data.remove.length, 2);
  assert.equal(jk.data.jokers, 2);
  let correct = 0, last;
  for (let i = 0; i < 5; i++) {
    const pick = i === 0 ? [0, 1, 2, 3].find((k) => !jk.data.remove.includes(k)) : 0;
    last = await api('POST', '/api/quiz/answer', { run: s.data.run, i, c: pick }, token);
    assert.equal(last.status, 200, JSON.stringify(last.data));
    if (last.data.correct) correct++;
    assert.ok(last.data.right >= 0 && last.data.right < 4);
  }
  assert.equal(last.data.done, true);
  assert.equal(last.data.reward.correct, correct);
  assert.equal(last.data.profile.stats.quizzes, 1);
  assert.ok(last.data.profile.medals.includes('first_quiz'));
  assert.equal((await api('POST', '/api/quiz/answer', { run: s.data.run, i: 5, c: 0 }, token)).status, 404, 'Lauf ist beendet');
});

test('Minispiele: Belohnung, Begrenzung, Bestenliste', async () => {
  const { token, login } = await signup();
  const r = await api('POST', '/api/action', { type: 'game', game: 'range', score: 999999 }, token);
  assert.equal(r.status, 200);
  assert.equal(r.data.result.score, 12000, 'Punkte werden begrenzt');
  assert.equal(r.data.profile.best.range, 12000);
  assert.equal((await api('POST', '/api/action', { type: 'game', game: 'range', score: 100 }, token)).status, 429, 'zu schnell');
  const b = await api('POST', '/api/action', { type: 'battle', outcome: 'win', kills: 7, tankKills: 5 }, token);
  assert.equal(b.status, 200);
  assert.ok(b.data.profile.medals.includes('battle_win') && b.data.profile.medals.includes('tank_ace'));
  const lb = await api('GET', '/api/leaderboard?board=range');
  assert.ok(lb.data.top.some((x) => x.name === login && x.value === 12000));
});

const STA = { battle: { x: 23, z: -13 }, quiz: { x: 0, z: -22 }, range: { x: 27, z: 10 } };
// Wie das echte Spiel: Positionen laufend senden (10x pro Sekunde), bis alle auf der Platte stehen
async function onPlate(socks, plate, n) {
  const p = STA[plate];
  let on = 1; // der erste Spieler geht zuerst drauf (wird Chef), dann die anderen
  const send = () => socks.slice(0, on).forEach((s, i) => s.send({ t: 'pos', x: p.x + i * 0.5, z: p.z, ry: 0, m: 0 }));
  send();
  const iv = setInterval(send, 100);
  try {
    await socks[0].wait((m) => m.t === 'w' && m.pl[plate] && m.pl[plate].m.length === 1, 12000);
    on = socks.length;
    return await socks[0].wait((m) => m.t === 'w' && m.pl[plate] && m.pl[plate].m.length === n, 12000);
  } finally { clearInterval(iv); }
}
async function twoInWorld(server = 'alpha') {
  const A = await signup(), B = await signup();
  const a = await authed(A.token), b = await authed(B.token);
  a.send({ t: 'wjoin', server }); b.send({ t: 'wjoin', server });
  const ja = await a.wait((m) => m.t === 'wjoined'); const jb = await b.wait((m) => m.t === 'wjoined');
  return { A, B, a, b, ka: ja.you, kb: jb.you };
}

test('Welten: Serverliste, gemeinsamer Server, Spieler sehen sich laufen', async () => {
  const { a, b, ka, kb } = await twoInWorld('bravo');
  a.send({ t: 'worlds' });
  const wl = await a.wait((m) => m.t === 'worlds');
  assert.equal(wl.list.length, 3);
  assert.ok(wl.list.find((w) => w.id === 'bravo').players >= 2);
  await b.wait((m) => m.t === 'wplayers' && m.list.some((p) => p.key === ka) && m.list.some((p) => p.key === kb));
  const iv = setInterval(() => a.send({ t: 'pos', x: 5, z: 7, ry: 1, m: 1 }), 100);
  const seen = await b.wait((m) => m.t === 'w' && m.p.some((p) => p[0] === ka && p[1] === 5 && p[2] === 7), 12000).finally(() => clearInterval(iv));
  assert.ok(seen);
  a.send({ t: 'wleave' }); await a.wait((m) => m.t === 'wleft');
  a.close(); b.close();
});

test('Welten: eigene Welt allein und Server mit Code', async () => {
  const A = await signup(), B = await signup();
  const a = await authed(A.token), b = await authed(B.token);
  a.send({ t: 'wjoin', solo: true });
  const solo = await a.wait((m) => m.t === 'wjoined');
  assert.equal(solo.world.solo, true);
  assert.equal(solo.world.code, null);
  a.send({ t: 'wjoin', create: true, name: 'Kaserne Test' });
  const priv = await a.wait((m) => m.t === 'wjoined');
  assert.equal(priv.world.code.length, 4);
  assert.equal(priv.world.name, 'Kaserne Test');
  b.send({ t: 'wjoin', code: 'ZZZZ' });
  assert.match((await b.wait((m) => m.t === 'error')).msg, /Code/);
  b.send({ t: 'wjoin', code: priv.world.code.toLowerCase() });
  const jb = await b.wait((m) => m.t === 'wjoined');
  assert.equal(jb.world.code, priv.world.code);
  await a.wait((m) => m.t === 'wplayers' && m.list.length === 2);
  a.close(); b.close();
});

test('Druckplatte Gefecht: Chef stellt Teams, Farben und Modus ein und startet', async () => {
  const { a, b, ka, kb } = await twoInWorld();
  const w = await onPlate([a, b], 'battle', 2);
  assert.equal(w.pl.battle.m[0], ka, 'wer zuerst drauf ist, ist Chef');
  a.send({ t: 'plateCfg', plate: 'battle', teams: { [ka]: 1, [kb]: 1 }, colors: [2, 3], mode: 'conquest' });
  await a.wait((m) => m.t === 'w' && m.pl.battle && m.pl.battle.cfg.mode === 'conquest');
  b.send({ t: 'plateStart', plate: 'battle' }); // kein Chef -> nichts
  a.send({ t: 'plateStart', plate: 'battle' });
  const sa = await a.wait((m) => m.t === 'bstart');
  const sb = await b.wait((m) => m.t === 'bstart');
  assert.equal(sa.mode, 'conquest');
  assert.deepEqual(sa.colors, ['#3fa14a', '#e0b12f']);
  assert.equal(sa.roster.length, 10);
  assert.equal(sa.roster.find((p) => p.id === sa.you).team, 1);
  assert.equal(sb.roster.find((p) => p.id === sb.you).team, 1, 'beide im selben Team');
  const first = await a.wait((m) => m.t === 's');
  assert.equal(first.z.length, 3, 'Zonen A, B, C');
  const busy = await b.wait((m) => m.t === 'w' && (m.p.find((p) => p[0] === ka)[4] & 2));
  assert.ok(busy, 'in der Welt als „im Spiel“ markiert');
  const x0 = first.u.find((u) => u[0] === sa.you);
  await a.wait((m) => m.t === 's' && m.ph === 'play', 6000);
  const iv = setInterval(() => a.send({ t: 'in', mx: 0, my: 1, a: 0, f: true, w: 1 }), 50);
  await new Promise((r) => setTimeout(r, 900));
  clearInterval(iv);
  a.msgs.length = 0;
  const later = (await a.wait((m) => m.t === 's')).u.find((u) => u[0] === sa.you);
  assert.ok(Math.abs(later[2] - x0[2]) > 1, 'Spieler hat sich bewegt');
  assert.equal(later[7], 1, 'Waffe gewechselt (MG)');
  a.send({ t: 'back' }); b.send({ t: 'back' });
  await b.wait((m) => m.t === 'w' && !(m.p.find((p) => p[0] === ka)[4] & 2));
  a.close(); b.close();
});

test('Druckplatte Quiz: zu zweit wird es ein Quiz-Duell', async () => {
  const { a, b } = await twoInWorld('charlie');
  await onPlate([a, b], 'quiz', 2);
  a.send({ t: 'plateCfg', plate: 'quiz', cat: 'see', n: 3 });
  await a.wait((m) => m.t === 'w' && m.pl.quiz && m.pl.quiz.cfg.n === 3);
  a.send({ t: 'plateStart', plate: 'quiz' });
  const st = await b.wait((m) => m.t === 'qstart');
  assert.equal(st.players.length, 2);
  assert.equal(st.cat, 'see');
  for (let i = 0; i < 3; i++) {
    await a.wait((m) => m.t === 'q' && m.i === i); await b.wait((m) => m.t === 'q' && m.i === i);
    a.send({ t: 'ans', i, c: 0 }); b.send({ t: 'ans', i, c: 1 });
    assert.equal((await a.wait((m) => m.t === 'reveal' && m.i === i)).scores.length, 2);
  }
  const ea = await a.wait((m) => m.t === 'qend', 10000);
  assert.ok(ea.reward && ea.reward.xp > 0, 'Belohnung in der Datenbank');
  assert.equal(ea.profile.stats.duels, 1);
  a.close(); b.close();
});

test('Druckplatte Minispiel: Wettkampf mit gemeinsamer Rangliste', async () => {
  const { a, b } = await twoInWorld('charlie');
  await onPlate([a, b], 'range', 2);
  a.send({ t: 'plateStart', plate: 'range' });
  const la = await a.wait((m) => m.t === 'launch'); const lb = await b.wait((m) => m.t === 'launch');
  assert.equal(la.game, 'range');
  assert.equal(la.group, lb.group);
  a.send({ t: 'gscore', group: la.group, score: 900 });
  b.send({ t: 'gscore', group: lb.group, score: 1200 });
  const r = await a.wait((m) => m.t === 'gresult' && m.done);
  assert.equal(r.ranking[0].score, 1200);
  a.close(); b.close();
});

// Nur lokal: der echte Admin-Code ist geheim
test('Admin: nur mit Admin-Konto und Code', { skip: !!process.env.TEST_URL }, async () => {
  const adm = await api('POST', '/api/signup', { login: '3fach3', password: 'geheim123' });
  assert.equal(adm.status, 200);
  assert.equal(adm.data.account.admin, true);
  const P = await signup();
  const a = await authed(adm.data.token), p = await authed(P.token);
  let req = 0;
  const admin = async (sock, m) => { const id = ++req; sock.send({ t: 'admin', req: id, ...m }); return sock.wait((x) => x.t === 'adminRes' && x.req === id); };
  assert.match((await admin(p, { code: 'TestCode123', action: 'check' })).error, /Kein Admin/);
  assert.match((await admin(a, { code: 'falsch', action: 'check' })).error, /Falscher/);
  const chk = await admin(a, { code: 'TestCode123', action: 'check' });
  assert.ok(chk.stats.accounts >= 2);
  const give = await admin(a, { code: 'TestCode123', action: 'give', login: P.login, coins: 500, xp: 1500, jokers: 2 });
  assert.equal(give.player.coins, 600);
  assert.equal(give.player.rank, 'Feldwebel');
  await p.wait((m) => m.t === 'profile');
  await admin(a, { code: 'TestCode123', action: 'announce', text: 'Achtung, Übung!' });
  assert.equal((await p.wait((m) => m.t === 'announce')).text, 'Achtung, Übung!');
  await admin(a, { code: 'TestCode123', action: 'motd', text: 'Willkommen!' });
  assert.equal((await api('GET', '/api/news')).data.motd, 'Willkommen!');
  await admin(a, { code: 'TestCode123', action: 'maintenance', on: true, text: 'Kurze Pause' });
  p.send({ t: 'wjoin', server: 'alpha' });
  assert.match((await p.wait((m) => m.t === 'error')).msg, /Kurze Pause/);
  await admin(a, { code: 'TestCode123', action: 'maintenance', on: false });
  await admin(a, { code: 'TestCode123', action: 'ban', login: P.login, on: true });
  await p.wait((m) => m.t === 'kicked');
  assert.equal((await api('POST', '/api/login', { login: P.login, password: 'geheim123' })).status, 403);
  await admin(a, { code: 'TestCode123', action: 'ban', login: P.login, on: false });
  assert.equal((await api('POST', '/api/login', { login: P.login, password: 'geheim123' })).status, 200);
  assert.ok((await admin(a, { code: 'TestCode123', action: 'delete', login: P.login })).deleted);
  assert.equal((await api('POST', '/api/login', { login: P.login, password: 'geheim123' })).status, 401);
  assert.ok((await admin(a, { code: 'TestCode123', action: 'log' })).log.length >= 5);
  a.close();
});
