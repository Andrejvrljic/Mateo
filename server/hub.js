// Multiplayer-Server: Welten (öffentliche Server, eigene Welt, Server mit Code) mit Druckplatten,
// Quiz-Duell, Gefecht 5 gegen 5, Minispiel-Wettkämpfe – plus Admin-Befehle.
// Läuft unter Node (ws) und im Cloudflare Durable Object. Eine Verbindung braucht nur send(text) und close().
import { QUESTIONS, CATEGORIES, pickQuestions, shuffleAnswers, publicQuestion, answerPoints, QUIZ_TIME } from '../public/shared/questions.js';
import { applyDuel, applyBattle, rankInfo, GAMES } from '../public/shared/progress.js';
import { createBattle, step, snapshot, roster, results, outcomeFor, unitById, DT, TEAM_SIZE, MODES } from '../public/shared/battle.js';
import { STATIONS, stationById, PUBLIC_SERVERS, WORLD_MAX, BOUND, TEAM_COLORS, spawnPoint } from '../public/shared/world.js';
import { publicProfile } from './api.js';
import { isAdminName, checkCode, serverInfo } from './admin.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REVEAL_PAUSE = 3500;
const WORLD_TICK = 100; // ms
const MINI = ['range', 'aa', 'para', 'mines', 'morse'];

const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- Spielräume (aus einer Gruppe auf einer Druckplatte) ----------
class GameRoom {
  constructor(hub, kind, conns) {
    this.hub = hub; this.kind = kind;
    this.members = conns.map((c) => ({ key: c.accId, name: c.name, skin: c.skin, c }));
    for (const c of conns) { if (c.room) c.room.remove(c); c.room = this; }
    this.timers = new Set();
    hub.rooms.add(this);
  }
  later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); if (!this.dead) fn(); }, ms); this.timers.add(t); return t; }
  connected() { return this.members.filter((m) => m.c); }
  broadcast(msg) { for (const m of this.members) if (m.c) this.hub.send(m.c, msg); }
  remove(c) {
    const m = this.members.find((x) => x.c === c);
    if (!m) return;
    m.c = null; c.room = null;
    this.left(m);
    if (!this.connected().length) this.destroy();
  }
  left() {}
  destroy() {
    this.dead = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    if (this.loop) clearInterval(this.loop);
    for (const m of this.members) if (m.c && m.c.room === this) m.c.room = null;
    this.hub.rooms.delete(this);
  }
}

class QuizRoom extends GameRoom {
  constructor(hub, conns, cat, n = 10) { super(hub, 'quiz', conns); this.cat = CATEGORIES[cat] ? cat : 'mix'; this.n = n; this.start(); }
  start() {
    this.state = 'play';
    this.players = this.members.map((m) => ({ key: m.key, name: m.name, score: 0, correct: 0 }));
    this.qs = pickQuestions(this.cat, this.n).map((q) => ({ id: q.id, ...shuffleAnswers() }));
    this.i = -1;
    this.broadcast({ t: 'qstart', n: this.n, cat: this.cat, players: this.players.map((p) => ({ key: String(p.key), name: p.name })) });
    this.later(() => this.next(), 1500);
  }
  next() {
    this.i++;
    if (this.i >= this.qs.length) return this.finish();
    const x = this.qs[this.i];
    this.answers = new Map(); this.shown = Date.now(); this.revealed = false;
    this.broadcast({ t: 'q', i: this.i, n: this.qs.length, time: QUIZ_TIME, ...publicQuestion(QUESTIONS[x.id], x.order) });
    const i = this.i;
    this.later(() => { if (this.i === i) this.reveal(); }, QUIZ_TIME * 1000 + 300);
  }
  answer(key, i, c) {
    if (this.state !== 'play' || i !== this.i || this.revealed || this.answers.has(key)) return;
    const p = this.players.find((x) => x.key === key);
    if (!p) return;
    const x = this.qs[this.i];
    const correct = c === x.right;
    const pts = answerPoints(correct, (Date.now() - this.shown) / 1000);
    this.answers.set(key, { c, pts, correct });
    p.score += pts; if (correct) p.correct++;
    this.broadcast({ t: 'answered', key: String(key) });
    const waiting = this.players.filter((q) => !this.answers.has(q.key) && this.members.some((m) => m.key === q.key && m.c));
    if (!waiting.length) { const ii = this.i; this.later(() => { if (this.i === ii) this.reveal(); }, 600); }
  }
  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    const x = this.qs[this.i];
    this.broadcast({ t: 'reveal', i: this.i, right: x.right, fact: QUESTIONS[x.id].f || null, scores: this.players.map((p) => ({ key: String(p.key), name: p.name, score: p.score, pick: this.answers.get(p.key)?.c ?? -1, pts: this.answers.get(p.key)?.pts || 0 })) });
    this.later(() => this.next(), REVEAL_PAUSE);
  }
  async finish() {
    this.state = 'end';
    const ranking = [...this.players].sort((a, b) => b.score - a.score).map((p, k) => ({ key: String(p.key), name: p.name, score: p.score, correct: p.correct, place: k + 1 }));
    for (const r of ranking) {
      const m = this.members.find((x) => String(x.key) === r.key);
      const p = this.players.find((x) => String(x.key) === r.key);
      let reward = null, prof = null;
      try {
        const u = await this.hub.db.update(p.key, (pr) => applyDuel(pr, { correct: p.correct, total: this.qs.length, points: p.score, place: r.place, players: ranking.length }));
        if (u) { reward = u.r; await this.hub.db.setScore(p.key, 'quiz', p.score); prof = await publicProfile(this.hub.db, u.acc); }
      } catch (e) { console.error('Duell-Belohnung', e); }
      if (m && m.c) this.hub.send(m.c, { t: 'qend', ranking, reward, ...(prof || {}) });
    }
    this.later(() => this.destroy(), 500);
  }
}

class BattleRoom extends GameRoom {
  constructor(hub, conns, cfg) {
    super(hub, 'battle', conns);
    const colors = (cfg.colors || [0, 1]).map((i) => (TEAM_COLORS[i] || TEAM_COLORS[0]).c);
    this.st = createBattle(this.members.map((m) => ({ name: m.name, skin: m.skin, key: m.key, team: cfg.teams ? cfg.teams[m.key] : undefined })), { mode: cfg.mode, colors });
    this.unitOf = new Map(this.st.units.filter((u) => u.human).map((u) => [u.key, u.id]));
    this.inputs = {};
    const r = roster(this.st);
    for (const m of this.members) this.hub.send(m.c, { t: 'bstart', roster: r, you: this.unitOf.get(m.key), mode: this.st.mode, colors, win: this.st.win });
    this.loop = setInterval(() => this.tick(), DT * 1000);
  }
  input(c, m) {
    const id = this.unitOf.get(c.accId);
    if (!id || this.st.ph === 'end') return;
    const prev = this.inputs[id] || {};
    const w = Number.isInteger(m.w) && m.w >= 0 && m.w < 4 ? m.w : (prev.w ?? -1);
    this.inputs[id] = { mx: num(m.mx, -1, 1), my: num(m.my, -1, 1), a: num(m.a, -10, 10), f: !!m.f, w, u: !!m.u || !!prev.u, r: !!m.r || !!prev.r, g: !!m.g || !!prev.g, gd: num(m.gd, 0, 15, prev.gd || 9) };
  }
  tick() {
    step(this.st, this.inputs);
    for (const k in this.inputs) { const i = this.inputs[k]; i.u = false; i.r = false; i.g = false; }
    this.broadcast({ t: 's', ...snapshot(this.st) });
    if (this.st.ph === 'end') { clearInterval(this.loop); this.loop = null; this.finish(); }
  }
  left(m) {
    const u = unitById(this.st, this.unitOf.get(m.key));
    if (u) { u.human = false; delete this.inputs[u.id]; }
  }
  async finish() {
    const res = results(this.st);
    for (const m of this.members) {
      const u = unitById(this.st, this.unitOf.get(m.key));
      if (!u) continue;
      let reward = null, prof = null;
      try {
        const up = await this.hub.db.update(m.key, (p) => applyBattle(p, { outcome: outcomeFor(this.st, u.team), kills: u.kills, tankKills: u.tk }));
        if (up) { reward = up.r; await this.hub.db.setScore(m.key, 'battle', u.kills); prof = await publicProfile(this.hub.db, up.acc); }
      } catch (e) { console.error('Gefecht-Belohnung', e); }
      if (m.c) this.hub.send(m.c, { t: 'bend', results: res, you: u.id, reward, ...(prof || {}) });
    }
    this.later(() => this.destroy(), 500);
  }
}

// ---------- Welt ----------
class World {
  constructor(hub, { id, name, pub = false, solo = false }) {
    this.hub = hub; this.id = id; this.name = name; this.pub = pub; this.solo = solo;
    this.code = pub || solo ? null : id;
    this.players = new Map(); // key -> { c, key, name, skin, rank, x, z, ry, m, busy, n }
    this.plates = new Map();
    this.n = 0;
    this.emptySince = Date.now();
    this.dirty = true;
    this.loop = setInterval(() => this.tick(), WORLD_TICK);
  }
  info() { return { id: this.pub ? this.id : null, code: this.code, name: this.name, pub: this.pub, solo: this.solo, players: this.players.size, max: WORLD_MAX }; }
  add(c) {
    const old = this.players.get(c.accId);
    if (old && old.c !== c) { this.hub.send(old.c, { t: 'wkicked', msg: 'Du bist auf einem anderen Gerät in diese Welt gekommen.' }); old.c.world = null; }
    const sp = spawnPoint(this.n++);
    this.players.set(c.accId, { c, key: c.accId, name: c.name, skin: c.skin, rank: c.rankI, x: sp.x, z: sp.z, ry: 0, m: 0, busy: false });
    c.world = this;
    this.emptySince = 0;
    this.dirty = true;
    this.hub.send(c, { t: 'wjoined', world: this.info(), you: c.accId, x: sp.x, z: sp.z });
  }
  remove(c) {
    const p = this.players.get(c.accId);
    if (!p || p.c !== c) return;
    this.players.delete(c.accId);
    c.world = null;
    this.dirty = true;
    if (!this.players.size) {
      this.emptySince = Date.now();
      if (this.pub || this.solo) this.destroy();
    }
  }
  destroy() { clearInterval(this.loop); this.hub.worlds.delete(this.id); }
  pos(c, m) {
    const p = this.players.get(c.accId);
    if (!p || p.c !== c || p.busy) return;
    p.x = num(m.x, -BOUND, BOUND, p.x); p.z = num(m.z, -BOUND, BOUND, p.z); p.ry = num(m.ry, -100, 100, p.ry); p.m = m.m ? 1 : 0; p.j = m.j ? 1 : 0;
  }
  plate(id) {
    if (!this.plates.has(id)) this.plates.set(id, { members: [], cfg: { teams: {}, colors: [0, 1], mode: 'tdm', cat: 'mix', n: 10 } });
    return this.plates.get(id);
  }
  updatePlates() {
    for (const s of STATIONS) {
      if (s.kind !== 'game') continue;
      const on = [...this.players.values()].filter((p) => !p.busy && Math.hypot(p.x - s.x, p.z - s.z) <= s.r + 0.3).map((p) => p.key);
      const pl = this.plate(s.id);
      const before = pl.members.join(',');
      pl.members = pl.members.filter((k) => on.includes(k));
      for (const k of on) if (!pl.members.includes(k)) {
        pl.members.push(k);
        const n0 = pl.members.filter((x) => pl.cfg.teams[x] === 0).length, n1 = pl.members.filter((x) => pl.cfg.teams[x] === 1).length;
        if (pl.cfg.teams[k] !== 0 && pl.cfg.teams[k] !== 1) pl.cfg.teams[k] = n0 <= n1 ? 0 : 1;
      }
      if (!pl.members.length) pl.cfg = { teams: {}, colors: [0, 1], mode: 'tdm', cat: 'mix', n: 10 };
      if (before !== pl.members.join(',')) this.dirty = true;
    }
  }
  tick() {
    if (!this.players.size) {
      if (!this.pub && !this.solo && this.emptySince && Date.now() - this.emptySince > 10 * 60e3) this.destroy();
      return;
    }
    this.updatePlates();
    if (this.dirty) {
      this.dirty = false;
      const list = [...this.players.values()].map((p) => ({ key: p.key, name: p.name, skin: p.skin, rank: p.rank }));
      this.broadcast({ t: 'wplayers', list });
    }
    const plates = {};
    for (const [id, pl] of this.plates) if (pl.members.length) plates[id] = { m: pl.members, cfg: pl.cfg };
    this.broadcast({ t: 'w', p: [...this.players.values()].map((p) => [p.key, r2(p.x), r2(p.z), r2(p.ry), (p.m ? 1 : 0) | (p.busy ? 2 : 0) | (p.j ? 4 : 0)]), pl: plates });
  }
  broadcast(msg) { const t = JSON.stringify(msg); for (const p of this.players.values()) { try { p.c.sendFn(t); } catch { /* zu */ } } }
  isHost(c, id) { const pl = this.plates.get(id); return pl && pl.members[0] === c.accId; }
  plateCfg(c, m) {
    const s = stationById(m.plate);
    if (!s || s.kind !== 'game' || !this.isHost(c, s.id)) return;
    const pl = this.plate(s.id);
    if (m.teams && typeof m.teams === 'object') for (const k of pl.members) if (m.teams[k] === 0 || m.teams[k] === 1) pl.cfg.teams[k] = m.teams[k];
    if (Array.isArray(m.colors) && m.colors.length === 2) {
      const a = Math.trunc(num(m.colors[0], 0, TEAM_COLORS.length - 1)), b = Math.trunc(num(m.colors[1], 0, TEAM_COLORS.length - 1));
      if (a !== b) pl.cfg.colors = [a, b];
    }
    if (MODES[m.mode]) pl.cfg.mode = m.mode;
    if (CATEGORIES[m.cat]) pl.cfg.cat = m.cat;
    if (m.n) pl.cfg.n = Math.trunc(num(m.n, 3, 10, 10));
  }
  setBusy(keys, on) { for (const k of keys) { const p = this.players.get(k); if (p) { p.busy = on; if (on) { p.m = 0; } } } this.dirty = true; }
  plateStart(c, m) {
    const s = stationById(m.plate);
    if (!s || s.kind !== 'game' || !this.isHost(c, s.id)) return;
    const pl = this.plate(s.id);
    const conns = pl.members.map((k) => this.players.get(k)).filter(Boolean).map((p) => p.c);
    if (!conns.length) return;
    if (s.id === 'battle' && conns.length > TEAM_SIZE * 2) conns.length = TEAM_SIZE * 2;
    const keys = conns.map((x) => x.accId);
    this.setBusy(keys, true);
    pl.members = pl.members.filter((k) => !keys.includes(k));
    if (s.id === 'battle') new BattleRoom(this.hub, conns, pl.cfg);
    else if (s.id === 'quiz') {
      if (conns.length === 1) this.hub.send(c, { t: 'launch', game: 'quiz', cat: pl.cfg.cat, n: pl.cfg.n || 10 });
      else new QuizRoom(this.hub, conns, pl.cfg.cat, pl.cfg.n || 10);
    } else if (MINI.includes(s.id)) {
      const g = { id: this.hub.newCode() + Date.now().toString(36), game: s.id, keys, names: conns.map((x) => x.name), scores: new Map(), at: Date.now() };
      if (conns.length > 1) this.hub.groups.set(g.id, g);
      for (const x of conns) this.hub.send(x, { t: 'launch', game: s.id, group: conns.length > 1 ? g.id : null, players: g.names });
    }
  }
}

export class Hub {
  constructor(db) {
    this.db = db;
    this.conns = new Set();
    this.rooms = new Set();
    this.worlds = new Map();
    this.groups = new Map();
    this.adminFails = new Map();
    this.timer = setInterval(() => this.tick(), 5000);
  }
  newCode() {
    let code;
    do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); } while (this.worlds.has(code));
    return code;
  }
  connect(sendFn, closeFn = () => {}) {
    const c = { sendFn, closeFn, accId: null, login: null, name: null, room: null, world: null, chain: Promise.resolve(), n: 0, t: Date.now() };
    this.conns.add(c);
    this.send(c, { t: 'hello' });
    return c;
  }
  send(c, msg) { try { c.sendFn(JSON.stringify(msg)); } catch { /* Verbindung zu */ } }

  message(c, raw) {
    if (typeof raw !== 'string' || raw.length > 4096) return;
    const now = Date.now();
    if (now - c.t > 1000) { c.t = now; c.n = 0; }
    if (++c.n > 100) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    // schnelle Nachrichten ohne Warteschlange
    if (m.t === 'in') { if (c.room && c.room.kind === 'battle') c.room.input(c, m); return; }
    if (m.t === 'pos') { if (c.world) c.world.pos(c, m); return; }
    c.chain = c.chain.then(() => this.handle(c, m)).catch((e) => console.error('Nachricht', e));
  }
  close(c) {
    this.conns.delete(c);
    c.chain = c.chain.then(() => { if (c.room) c.room.remove(c); if (c.world) c.world.remove(c); this.groupLeft(c); }).catch(() => {});
  }

  online() { return new Set([...this.conns].filter((c) => c.accId).map((c) => c.accId)).size; }
  stats() {
    let quiz = 0, battle = 0;
    for (const r of this.rooms) r.kind === 'quiz' ? quiz++ : battle++;
    return { online: this.online(), worlds: this.worlds.size, rooms: { quiz, battle } };
  }
  tick() {
    const now = Date.now();
    for (const [id, g] of this.groups) if (now - g.at > 15 * 60e3) this.groups.delete(id);
  }
  worldList() {
    return PUBLIC_SERVERS.map((s) => ({ id: s.id, name: s.name, players: this.worlds.get(s.id)?.players.size || 0, max: WORLD_MAX }));
  }

  // Minispiel-Wettkampf: Punkte sammeln, Rangliste an alle schicken
  groupScore(c, m) {
    const g = this.groups.get(m.group);
    if (!g || !g.keys.includes(c.accId) || g.scores.has(c.accId)) return;
    g.scores.set(c.accId, Math.trunc(num(m.score, 0, GAMES[g.game]?.max || 1e5)));
    this.groupSend(g);
  }
  groupLeft(c) { for (const g of this.groups.values()) if (g.keys.includes(c.accId) && !g.scores.has(c.accId)) { g.scores.set(c.accId, -1); this.groupSend(g); } }
  groupSend(g) {
    const ranking = g.keys.map((k, i) => ({ name: g.names[i], score: g.scores.has(k) ? g.scores.get(k) : null })).sort((a, b) => (b.score ?? -2) - (a.score ?? -2));
    const done = g.scores.size >= g.keys.length;
    for (const x of this.conns) if (g.keys.includes(x.accId)) this.send(x, { t: 'gresult', game: g.game, ranking, done });
    if (done) this.groups.delete(g.id);
  }

  async handle(c, m) {
    if (m.t === 'ping') return this.send(c, { t: 'pong', at: m.at });
    if (m.t === 'auth') {
      const acc = await this.db.byToken(m.token);
      if (!acc) return this.send(c, { t: 'error', msg: 'Bitte melde dich an, um online zu spielen.' });
      c.accId = acc.id; c.login = acc.login; c.name = acc.profile.name; c.skin = acc.profile.skin; c.rankI = rankInfo(acc.profile.xp).i;
      return this.send(c, { t: 'auth', ok: true, name: c.name, online: this.online() });
    }
    if (!c.accId) return this.send(c, { t: 'error', msg: 'Bitte melde dich an, um online zu spielen.' });

    switch (m.t) {
      case 'worlds': return this.send(c, { t: 'worlds', list: this.worldList() });
      case 'wjoin': {
        const info = await serverInfo(this.db);
        if (info.maintenance && !isAdminName(c.login)) return this.send(c, { t: 'error', msg: info.maintenance.text });
        const acc = await this.db.account(c.accId);
        if (acc) { c.name = acc.profile.name; c.skin = acc.profile.skin; c.rankI = rankInfo(acc.profile.xp).i; }
        if (c.room) c.room.remove(c);
        if (c.world) c.world.remove(c);
        let w;
        if (m.server) {
          const s = PUBLIC_SERVERS.find((x) => x.id === m.server);
          if (!s) return this.send(c, { t: 'error', msg: 'Diesen Server gibt es nicht.' });
          w = this.worlds.get(s.id);
          if (!w) { w = new World(this, { id: s.id, name: s.name, pub: true }); this.worlds.set(s.id, w); }
        } else if (m.code) {
          w = this.worlds.get(String(m.code).toUpperCase().trim());
          if (!w || w.pub || w.solo) return this.send(c, { t: 'error', msg: 'Diesen Server-Code gibt es nicht.' });
        } else if (m.solo) {
          const id = 'solo-' + c.accId + '-' + Date.now().toString(36);
          w = new World(this, { id, name: 'Eigene Welt', solo: true });
          this.worlds.set(id, w);
        } else if (m.create) {
          const code = this.newCode();
          w = new World(this, { id: code, name: clean(m.name, 24) || `Server von ${c.name}` });
          this.worlds.set(code, w);
        } else return this.send(c, { t: 'error', msg: 'Welche Welt?' });
        if (w.players.size >= WORLD_MAX && !w.players.has(c.accId)) return this.send(c, { t: 'error', msg: 'Der Server ist voll.' });
        w.add(c);
        return;
      }
      case 'wleave': if (c.room) c.room.remove(c); if (c.world) c.world.remove(c); return this.send(c, { t: 'wleft' });
      case 'plateCfg': if (c.world) c.world.plateCfg(c, m); return;
      case 'plateStart': if (c.world) c.world.plateStart(c, m); return;
      case 'back': { // zurück aus einem Spiel in die Welt
        if (c.room) c.room.remove(c);
        const p = c.world && c.world.players.get(c.accId);
        if (p && p.c === c) {
          p.busy = false; c.world.dirty = true;
          const acc = await this.db.account(c.accId);
          if (acc) { p.skin = c.skin = acc.profile.skin; p.rank = c.rankI = rankInfo(acc.profile.xp).i; }
        }
        return;
      }
      case 'gscore': return this.groupScore(c, m);
      case 'ans': if (c.room && c.room.kind === 'quiz') c.room.answer(c.accId, m.i, Number.isInteger(m.c) ? m.c : -1); return;
      case 'leave': if (c.room) c.room.remove(c); return this.send(c, { t: 'left' });
      case 'admin': return this.admin(c, m);
    }
  }

  // ---------- Admin ----------
  async admin(c, m) {
    const reply = (data) => this.send(c, { t: 'adminRes', req: m.req, ...data });
    if (!isAdminName(c.login)) return reply({ error: 'Kein Admin-Konto.' });
    const fails = this.adminFails.get(c.accId) || 0;
    if (fails >= 5) return reply({ error: 'Zu viele falsche Codes – Admin-Bereich für eine Weile gesperrt.' });
    if (!checkCode(m.code)) { this.adminFails.set(c.accId, fails + 1); return reply({ error: 'Falscher Admin-Code.' }); }
    this.adminFails.delete(c.accId);
    const log = (action, detail) => this.db.logAdmin(c.login, action, detail);
    const target = async () => {
      const t = await this.db.byLogin(String(m.login || ''));
      if (!t) throw Object.assign(new Error(), { user: 'Diesen Benutzer gibt es nicht.' });
      return t;
    };
    const notify = async (id) => {
      const acc = await this.db.account(id);
      if (!acc) return;
      const prof = await publicProfile(this.db, acc);
      for (const x of this.conns) if (x.accId === id) this.send(x, { t: 'profile', ...prof });
    };
    const view = (t) => ({ login: t.login, xp: t.profile.xp, coins: t.profile.coins, jokers: t.profile.jokers, rank: rankInfo(t.profile.xp).name, medals: t.profile.medals.length, banned: !!t.banned, skins: t.profile.skins.length });
    try {
      switch (m.action) {
        case 'check': return reply({ ok: true, stats: { accounts: await this.db.accountCount(), ...this.stats() }, ...(await serverInfo(this.db)) });
        case 'overview': return reply({
          online: [...this.conns].filter((x) => x.accId).map((x) => ({ login: x.login, world: x.world ? x.world.name : '', game: x.room ? x.room.kind : '' })),
          worlds: [...this.worlds.values()].map((w) => ({ name: w.name, code: w.code, players: w.players.size, solo: w.solo })),
        });
        case 'search': return reply({ list: await this.db.searchAccounts(clean(m.q, 20)) });
        case 'player': return reply({ player: view(await target()) });
        case 'give': {
          const t = await target();
          const xp = Math.trunc(num(m.xp, -1e6, 1e6)), coins = Math.trunc(num(m.coins, -1e6, 1e6)), jokers = Math.trunc(num(m.jokers, -100, 100));
          const u = await this.db.update(t.id, (p) => { p.xp = Math.max(0, p.xp + xp); p.coins = Math.max(0, p.coins + coins); p.jokers = Math.max(0, p.jokers + jokers); });
          await log('give', `${t.login}: ${xp} EP, ${coins} Münzen, ${jokers} Joker`);
          await notify(t.id);
          return reply({ ok: true, player: view(u.acc) });
        }
        case 'motd': await this.db.setSetting('motd', clean(m.text, 200) || null); await log('motd', clean(m.text, 200)); return reply({ ok: true });
        case 'announce': {
          const text = clean(m.text, 200);
          if (!text) return reply({ error: 'Text fehlt.' });
          for (const x of this.conns) this.send(x, { t: 'announce', text, from: c.login });
          await log('announce', text);
          return reply({ ok: true });
        }
        case 'maintenance': {
          await this.db.setSetting('maintenance', m.on ? JSON.stringify({ on: true, text: clean(m.text, 200) }) : null);
          await log('maintenance', m.on ? 'an' : 'aus');
          return reply({ ok: true });
        }
        case 'ban': {
          const t = await target();
          if (isAdminName(t.login)) return reply({ error: 'Admins können nicht gesperrt werden.' });
          await this.db.setBan(t.id, !!m.on);
          if (m.on) for (const x of [...this.conns]) if (x.accId === t.id) { this.send(x, { t: 'kicked' }); x.closeFn(); }
          await log(m.on ? 'ban' : 'unban', t.login);
          return reply({ ok: true, player: view(await target()) });
        }
        case 'password': {
          const t = await target();
          const r = await this.db.setPassword(t.id, m.password);
          if (r.error) return reply({ error: r.error });
          await log('password', t.login);
          return reply({ ok: true });
        }
        case 'delete': {
          const t = await target();
          if (isAdminName(t.login)) return reply({ error: 'Admin-Konten können nicht gelöscht werden.' });
          for (const x of [...this.conns]) if (x.accId === t.id) { this.send(x, { t: 'kicked' }); x.closeFn(); }
          await this.db.deleteAccount(t.id);
          await log('delete', t.login);
          return reply({ ok: true, deleted: true });
        }
        case 'log': return reply({ log: await this.db.adminLog(40) });
      }
      return reply({ error: 'Unbekannte Aktion.' });
    } catch (e) {
      if (e.user) return reply({ error: e.user });
      throw e;
    }
  }

  shutdown() {
    clearInterval(this.timer);
    for (const r of [...this.rooms]) r.destroy();
    for (const w of [...this.worlds.values()]) w.destroy();
  }
}
