// Multiplayer-Server: Online-Quiz-Duell und Online-Gefecht 5 gegen 5 – plus Admin-Befehle.
// Läuft unter Node (ws) und im Cloudflare Durable Object. Eine Verbindung braucht nur send(text) und close().
import { QUESTIONS, CATEGORIES, pickQuestions, shuffleAnswers, publicQuestion, answerPoints, QUIZ_TIME } from '../public/shared/questions.js';
import { applyDuel, applyBattle, rankInfo } from '../public/shared/progress.js';
import { createBattle, step, snapshot, roster, results, outcomeFor, unitById, DT, TEAM_SIZE } from '../public/shared/battle.js';
import { publicProfile, limited } from './api.js';
import { isAdminName, checkCode, serverInfo } from './admin.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const QUIZ_AUTO = 10, BATTLE_AUTO = 12; // Sekunden bis öffentliche Lobbys automatisch starten
const REVEAL_PAUSE = 3500;
const QUIZ_MAX = 8;
const QUIZ_BOTS = ['Bot Funker', 'Bot Kadett', 'Bot Pionier', 'Bot Lotse'];

const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

class Room {
  constructor(hub, kind, pub) {
    this.hub = hub; this.kind = kind; this.pub = pub;
    this.code = hub.newCode();
    this.state = 'lobby';
    this.members = []; // { key, name, skin, c }
    this.timers = new Set();
    this.autoAt = pub ? Date.now() + (kind === 'quiz' ? QUIZ_AUTO : BATTLE_AUTO) * 1000 : 0;
    this.created = Date.now();
  }
  later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); if (!this.dead) fn(); }, ms); this.timers.add(t); return t; }
  get hostKey() { return this.members.find((m) => m.c)?.key; }
  connected() { return this.members.filter((m) => m.c); }
  broadcast(msg) { for (const m of this.members) if (m.c) this.hub.send(m.c, msg); }
  full() { return this.members.length >= (this.kind === 'quiz' ? QUIZ_MAX : TEAM_SIZE * 2); }
  add(c) {
    this.members = this.members.filter((m) => m.key !== c.accId);
    this.members.push({ key: c.accId, name: c.name, skin: c.skin, c });
    c.room = this;
    this.sendLobby();
  }
  sendLobby() {
    if (this.state !== 'lobby') return;
    const host = this.hostKey;
    for (const m of this.members) {
      if (!m.c) continue;
      this.hub.send(m.c, {
        t: 'lobby', kind: this.kind, code: this.code, pub: this.pub, host: m.key === host, cat: this.cat,
        startIn: this.autoAt ? Math.max(0, Math.ceil((this.autoAt - Date.now()) / 1000)) : null,
        players: this.members.map((x, i) => ({ name: x.name, host: x.key === host, team: this.kind === 'battle' ? i % 2 : null })),
      });
    }
  }
  remove(c) {
    const m = this.members.find((x) => x.c === c);
    if (!m) return;
    if (this.state === 'lobby') this.members.splice(this.members.indexOf(m), 1);
    else { m.c = null; this.left(m); }
    c.room = null;
    if (!this.connected().length) this.destroy(); else this.sendLobby();
  }
  left() {}
  destroy() {
    this.dead = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    if (this.loop) clearInterval(this.loop);
    for (const m of this.members) if (m.c && m.c.room === this) m.c.room = null;
    this.hub.rooms.delete(this.code);
  }
}

// ---------- Quiz-Duell ----------
class QuizRoom extends Room {
  constructor(hub, pub, cat, n) { super(hub, 'quiz', pub); this.cat = CATEGORIES[cat] ? cat : 'mix'; this.n = n; }
  start() {
    if (this.state !== 'lobby') return;
    this.state = 'play';
    this.players = this.members.map((m) => ({ key: m.key, name: m.name, score: 0, correct: 0, bot: false }));
    if (this.players.length < 2) { // allein? Dann spielen Bots mit
      for (const name of QUIZ_BOTS.slice(0, 3)) this.players.push({ key: 'bot:' + name, name, score: 0, correct: 0, bot: true, skill: 0.45 + Math.random() * 0.3 });
    }
    this.qs = pickQuestions(this.cat, this.n).map((q) => ({ id: q.id, ...shuffleAnswers() }));
    this.i = -1;
    this.broadcast({ t: 'qstart', n: this.n, cat: this.cat, players: this.players.map((p) => ({ key: String(p.key), name: p.name, bot: p.bot })) });
    this.later(() => this.next(), 1500);
  }
  next() {
    this.i++;
    if (this.i >= this.qs.length) return this.finish();
    const x = this.qs[this.i];
    this.answers = new Map();
    this.shown = Date.now();
    this.revealed = false;
    this.broadcast({ t: 'q', i: this.i, n: this.qs.length, time: QUIZ_TIME, ...publicQuestion(QUESTIONS[x.id], x.order) });
    for (const p of this.players) {
      if (!p.bot) continue;
      const right = Math.random() < p.skill;
      const wrongs = [0, 1, 2, 3].filter((k) => k !== x.right);
      const pick = right ? x.right : wrongs[Math.floor(Math.random() * 3)];
      const i = this.i;
      this.later(() => this.answer(p.key, i, pick), 2500 + Math.random() * 9000);
    }
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
    const waiting = this.players.filter((q) => !this.answers.has(q.key) && (q.bot || this.members.some((m) => m.key === q.key && m.c)));
    if (!waiting.length) { const ii = this.i; this.later(() => { if (this.i === ii) this.reveal(); }, 600); }
  }
  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    const x = this.qs[this.i];
    this.broadcast({
      t: 'reveal', i: this.i, right: x.right, fact: QUESTIONS[x.id].f || null,
      scores: this.players.map((p) => ({ key: String(p.key), name: p.name, score: p.score, pick: this.answers.get(p.key)?.c ?? -1, pts: this.answers.get(p.key)?.pts || 0 })),
    });
    this.later(() => this.next(), REVEAL_PAUSE);
  }
  async finish() {
    this.state = 'end';
    const ranking = [...this.players].sort((a, b) => b.score - a.score).map((p, k) => ({ key: String(p.key), name: p.name, score: p.score, correct: p.correct, place: k + 1, bot: p.bot }));
    for (const r of ranking) {
      if (r.bot) continue;
      const m = this.members.find((x) => String(x.key) === r.key);
      const p = this.players.find((x) => String(x.key) === r.key);
      let reward = null, prof = null;
      try {
        const u = await this.hub.db.update(p.key, (prof) => applyDuel(prof, { correct: p.correct, total: this.qs.length, points: p.score, place: r.place, players: ranking.length }));
        if (u) { reward = u.r; await this.hub.db.setScore(p.key, 'quiz', p.score); prof = await publicProfile(this.hub.db, u.acc); }
      } catch (e) { console.error('Duell-Belohnung', e); }
      if (m && m.c) this.hub.send(m.c, { t: 'qend', ranking, reward, ...(prof || {}) });
    }
    this.later(() => this.destroy(), 1000);
  }
}

// ---------- Gefecht 5 gegen 5 ----------
class BattleRoom extends Room {
  constructor(hub, pub) { super(hub, 'battle', pub); }
  start() {
    if (this.state !== 'lobby') return;
    this.state = 'play';
    this.st = createBattle(this.members.map((m, i) => ({ name: m.name, human: true, skin: m.skin, key: m.key, team: i % 2 })));
    this.unitOf = new Map(this.st.units.filter((u) => u.human).map((u) => [u.key, u.id]));
    this.inputs = {};
    const r = roster(this.st);
    for (const m of this.members) if (m.c) this.hub.send(m.c, { t: 'bstart', roster: r, you: this.unitOf.get(m.key) });
    this.loop = setInterval(() => this.tick(), DT * 1000);
  }
  input(c, m) {
    if (this.state !== 'play') return;
    const id = this.unitOf.get(c.accId);
    if (!id) return;
    const prev = this.inputs[id];
    this.inputs[id] = { mx: num(m.mx, -1, 1), my: num(m.my, -1, 1), a: num(m.a, -10, 10), f: !!m.f, u: !!m.u || !!(prev && prev.u) };
  }
  tick() {
    step(this.st, this.inputs);
    for (const k in this.inputs) this.inputs[k].u = false;
    this.broadcast({ t: 's', ...snapshot(this.st) });
    if (this.st.ph === 'end') { clearInterval(this.loop); this.loop = null; this.finish(); }
  }
  left(m) { // Spieler weg: ein Bot übernimmt
    const id = this.unitOf && this.unitOf.get(m.key);
    const u = id && unitById(this.st, id);
    if (u) { u.human = false; delete this.inputs[id]; }
  }
  async finish() {
    this.state = 'end';
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
    this.later(() => this.destroy(), 1000);
  }
}

export class Hub {
  constructor(db) {
    this.db = db;
    this.conns = new Set();
    this.rooms = new Map();
    this.adminFails = new Map();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  newCode() {
    let code;
    do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); } while (this.rooms.has(code));
    return code;
  }

  connect(sendFn, closeFn = () => {}) {
    const c = { sendFn, closeFn, accId: null, login: null, name: null, room: null, chain: Promise.resolve(), n: 0, t: Date.now() };
    this.conns.add(c);
    this.send(c, { t: 'hello' });
    return c;
  }
  send(c, msg) { try { c.sendFn(JSON.stringify(msg)); } catch { /* Verbindung zu */ } }

  message(c, raw) {
    if (typeof raw !== 'string' || raw.length > 4096) return;
    // einfache Bremse: max. 80 Nachrichten pro Sekunde
    const now = Date.now();
    if (now - c.t > 1000) { c.t = now; c.n = 0; }
    if (++c.n > 80) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'in') { if (c.room && c.room.kind === 'battle') c.room.input(c, m); return; } // schnell, ohne Warteschlange
    c.chain = c.chain.then(() => this.handle(c, m)).catch((e) => console.error('Nachricht', e));
  }

  close(c) {
    this.conns.delete(c);
    c.chain = c.chain.then(() => { if (c.room) c.room.remove(c); }).catch(() => {});
  }

  online() { return new Set([...this.conns].filter((c) => c.accId).map((c) => c.accId)).size; }

  stats() {
    let quiz = 0, battle = 0;
    for (const r of this.rooms.values()) r.kind === 'quiz' ? quiz++ : battle++;
    return { online: this.online(), rooms: { quiz, battle } };
  }

  tick() {
    const now = Date.now();
    for (const r of [...this.rooms.values()]) {
      if (r.state !== 'lobby') continue;
      if (r.autoAt && now >= r.autoAt) r.start();
      else if (r.autoAt) r.sendLobby();
      else if (now - r.created > 30 * 60e3) r.destroy();
    }
  }

  async handle(c, m) {
    if (m.t === 'ping') return this.send(c, { t: 'pong', at: m.at });
    if (m.t === 'auth') {
      const acc = await this.db.byToken(m.token);
      if (!acc) return this.send(c, { t: 'error', msg: 'Bitte melde dich an, um online zu spielen.' });
      c.accId = acc.id; c.login = acc.login; c.name = acc.profile.name; c.skin = acc.profile.skin;
      c.rank = rankInfo(acc.profile.xp).name;
      return this.send(c, { t: 'auth', ok: true, name: c.name, online: this.online() });
    }
    if (!c.accId) return this.send(c, { t: 'error', msg: 'Bitte melde dich an, um online zu spielen.' });

    switch (m.t) {
      case 'join': {
        const kind = m.kind === 'battle' ? 'battle' : 'quiz';
        const info = await serverInfo(this.db);
        if (info.maintenance && !isAdminName(c.login)) return this.send(c, { t: 'error', msg: info.maintenance.text });
        const acc = await this.db.account(c.accId);
        if (acc) { c.name = acc.profile.name; c.skin = acc.profile.skin; }
        if (c.room) c.room.remove(c);
        let room;
        if (m.code) {
          room = this.rooms.get(String(m.code).toUpperCase().trim());
          if (!room || room.kind !== kind) return this.send(c, { t: 'error', msg: 'Diesen Raum-Code gibt es nicht.' });
          if (room.state !== 'lobby') return this.send(c, { t: 'error', msg: 'Das Spiel in diesem Raum läuft schon.' });
          if (room.full()) return this.send(c, { t: 'error', msg: 'Der Raum ist voll.' });
        } else if (m.create) {
          room = kind === 'quiz' ? new QuizRoom(this, false, m.cat, Math.trunc(num(m.n, 3, 10, 10))) : new BattleRoom(this, false);
          this.rooms.set(room.code, room);
        } else {
          room = [...this.rooms.values()].find((r) => r.pub && r.kind === kind && r.state === 'lobby' && !r.full());
          if (!room) { room = kind === 'quiz' ? new QuizRoom(this, true, 'mix', 10) : new BattleRoom(this, true); this.rooms.set(room.code, room); }
        }
        room.add(c);
        return;
      }
      case 'start': {
        const r = c.room;
        if (r && r.state === 'lobby' && r.hostKey === c.accId) r.start();
        return;
      }
      case 'ans': {
        const r = c.room;
        if (r && r.kind === 'quiz') r.answer(c.accId, m.i, Number.isInteger(m.c) ? m.c : -1);
        return;
      }
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
        case 'overview': return reply({ online: [...this.conns].filter((x) => x.accId).map((x) => ({ login: x.login, room: x.room ? `${x.room.kind} ${x.room.code}` : '' })), rooms: [...this.rooms.values()].map((r) => ({ code: r.code, kind: r.kind, state: r.state, players: r.members.length })) });
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
    for (const r of [...this.rooms.values()]) r.destroy();
  }
}

export { limited };
