// Datenbank-Zugriff für Konten, Fortschritt, Quiz-Läufe und Ranglisten.
// Arbeitet mit Cloudflare D1 – oder lokal mit einer D1-kompatiblen Hülle um node:sqlite (siehe nodedb.js).
import { freshProfile, normalize } from '../public/shared/progress.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT NOT NULL UNIQUE COLLATE NOCASE, pass TEXT NOT NULL, name TEXT NOT NULL,
    profile TEXT NOT NULL, xp INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL)`,
  'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL, created INTEGER NOT NULL, last_used INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, account_id INTEGER NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS scores (account_id INTEGER NOT NULL, game TEXT NOT NULL, score INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (account_id, game))',
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS bans (account_id INTEGER PRIMARY KEY, created INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS admin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, admin TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_accounts_xp ON accounts(xp DESC)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game, score DESC)',
  'CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created)',
];

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function pbkdf2(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256));
}
async function hashPassword(pw) { const salt = randomHex(16); return `pbkdf2$${salt}$${await pbkdf2(pw, salt)}`; }
async function verifyPassword(pw, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || !salt || !hash) return false;
  const test = await pbkdf2(pw, salt);
  let diff = test.length ^ hash.length;
  for (let i = 0; i < Math.min(test.length, hash.length); i++) diff |= test.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export function checkLogin(login, password) {
  if (typeof login !== 'string' || !/^[A-Za-z0-9_äöüÄÖÜß.-]{3,20}$/.test(login)) return 'Benutzername: 3–20 Zeichen (Buchstaben, Zahlen, _ . -).';
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) return 'Passwort: mindestens 6 Zeichen.';
  return null;
}

const ready = new WeakMap();
export const BOARDS = ['xp', 'quiz', 'battle', 'range', 'aa', 'para', 'mines', 'morse'];

export class Store {
  constructor(d1) { this.d1 = d1; }

  async ready() {
    if (!ready.has(this.d1)) ready.set(this.d1, this.d1.batch(SCHEMA.map((s) => this.d1.prepare(s))).catch((e) => { ready.delete(this.d1); throw e; }));
    await ready.get(this.d1);
  }
  async q(sql, ...args) { await this.ready(); return this.d1.prepare(sql).bind(...args); }
  async first(sql, ...args) { return (await this.q(sql, ...args)).first(); }
  async all(sql, ...args) { return (await (await this.q(sql, ...args)).all()).results; }
  async run(sql, ...args) { return (await this.q(sql, ...args)).run(); }

  // ---------- Konten & Sitzungen ----------
  async createAccount(login, password) {
    const err = checkLogin(login, password);
    if (err) return { error: err };
    if (await this.first('SELECT id FROM accounts WHERE login = ?', login)) return { error: 'Dieser Benutzername ist schon vergeben.' };
    const p = freshProfile();
    p.name = login;
    const now = Date.now();
    const r = await this.run('INSERT INTO accounts (login, pass, name, profile, xp, created, updated) VALUES (?, ?, ?, ?, 0, ?, ?)', login, await hashPassword(password), login, JSON.stringify(p), now, now);
    const id = r.meta.last_row_id;
    return { id, token: await this.newSession(id) };
  }

  async newSession(id) {
    const token = randomHex(24), now = Date.now();
    await this.run('INSERT INTO sessions (token_hash, account_id, created, last_used) VALUES (?, ?, ?, ?)', await sha(token), id, now, now);
    return token;
  }

  async login(login, password) {
    if (typeof login !== 'string' || typeof password !== 'string') return null;
    const row = await this.first('SELECT id, pass FROM accounts WHERE login = ?', login.trim());
    if (!row || !(await verifyPassword(password, row.pass))) return null;
    if (await this.isBanned(row.id)) return { banned: true };
    return { id: row.id, token: await this.newSession(row.id) };
  }

  async byToken(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const h = await sha(token);
    const s = await this.first('SELECT account_id, last_used FROM sessions WHERE token_hash = ?', h);
    if (!s || (await this.isBanned(s.account_id))) return null;
    if (Date.now() - s.last_used > 60000) await this.run('UPDATE sessions SET last_used = ? WHERE token_hash = ?', Date.now(), h);
    return this.account(s.account_id);
  }

  async logout(token) { if (typeof token === 'string' && token) await this.run('DELETE FROM sessions WHERE token_hash = ?', await sha(token)); }

  async account(id) {
    const row = await this.first('SELECT id, login, profile, created FROM accounts WHERE id = ?', id);
    if (!row) return null;
    let p; try { p = JSON.parse(row.profile); } catch { p = null; }
    return { id: row.id, login: row.login, created: row.created, profile: normalize(p) };
  }

  async byLogin(login) {
    const row = typeof login === 'string' ? await this.first('SELECT id FROM accounts WHERE login = ?', login.trim()) : null;
    if (!row) return null;
    return { ...(await this.account(row.id)), banned: await this.isBanned(row.id) };
  }

  async save(acc) {
    const p = acc.profile;
    await this.run('UPDATE accounts SET name = ?, profile = ?, xp = ?, updated = ? WHERE id = ?', p.name, JSON.stringify(p), p.xp, Date.now(), acc.id);
  }

  // Lädt das Konto frisch, ändert es mit fn(profile) und speichert (für Belohnungen aus dem Multiplayer-Server)
  async update(id, fn) {
    const acc = await this.account(id);
    if (!acc) return null;
    const r = fn(acc.profile);
    await this.save(acc);
    return { acc, r };
  }

  async setScore(id, game, score) {
    await this.run(`INSERT INTO scores (account_id, game, score, at) VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, game) DO UPDATE SET score = excluded.score, at = excluded.at WHERE excluded.score > scores.score`, id, game, Math.trunc(score), Date.now());
  }

  async leaderboard(board = 'xp', n = 50) {
    if (board === 'xp') return this.all('SELECT name, xp AS value FROM accounts WHERE xp > 0 ORDER BY xp DESC, updated ASC LIMIT ?', n);
    return this.all('SELECT a.name AS name, s.score AS value FROM scores s JOIN accounts a ON a.id = s.account_id WHERE s.game = ? AND s.score > 0 ORDER BY s.score DESC, s.at ASC LIMIT ?', board, n);
  }
  async rankOf(xp) { return (await this.first('SELECT COUNT(*) + 1 AS r FROM accounts WHERE xp > ?', xp)).r; }
  async accountCount() { return (await this.first('SELECT COUNT(*) AS n FROM accounts')).n; }

  // ---------- Quiz-Läufe ----------
  async newRun(accId, data) {
    const id = randomHex(12);
    await this.run('INSERT INTO runs (id, account_id, data, created) VALUES (?, ?, ?, ?)', id, accId, JSON.stringify(data), Date.now());
    if (Math.random() < 0.1) await this.run('DELETE FROM runs WHERE created < ?', Date.now() - 864e5);
    return id;
  }
  async getRun(id, accId) {
    if (typeof id !== 'string' || id.length > 40) return null;
    const row = await this.first('SELECT data, created FROM runs WHERE id = ? AND account_id = ?', id, accId);
    if (!row || Date.now() - row.created > 3600e3) return null;
    return JSON.parse(row.data);
  }
  async saveRun(id, data) { await this.run('UPDATE runs SET data = ? WHERE id = ?', JSON.stringify(data), id); }
  async deleteRun(id) { await this.run('DELETE FROM runs WHERE id = ?', id); }

  // ---------- Einstellungen & Admin ----------
  async getSetting(key) { const r = await this.first('SELECT value FROM settings WHERE key = ?', key); return r ? r.value : null; }
  async setSetting(key, value) {
    if (value === null) await this.run('DELETE FROM settings WHERE key = ?', key);
    else await this.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));
  }
  async isBanned(id) { return !!(await this.first('SELECT 1 AS b FROM bans WHERE account_id = ?', id)); }
  async setBan(id, on) {
    if (on) { await this.run('INSERT OR IGNORE INTO bans (account_id, created) VALUES (?, ?)', id, Date.now()); await this.run('DELETE FROM sessions WHERE account_id = ?', id); }
    else await this.run('DELETE FROM bans WHERE account_id = ?', id);
  }
  async setPassword(id, password) {
    if (typeof password !== 'string' || password.length < 6 || password.length > 100) return { error: 'Passwort: mindestens 6 Zeichen.' };
    await this.run('UPDATE accounts SET pass = ?, updated = ? WHERE id = ?', await hashPassword(password), Date.now(), id);
    await this.run('DELETE FROM sessions WHERE account_id = ?', id);
    return { ok: true };
  }
  async deleteAccount(id) {
    await this.ready();
    await this.d1.batch([
      this.d1.prepare('DELETE FROM sessions WHERE account_id = ?').bind(id),
      this.d1.prepare('DELETE FROM runs WHERE account_id = ?').bind(id),
      this.d1.prepare('DELETE FROM scores WHERE account_id = ?').bind(id),
      this.d1.prepare('DELETE FROM bans WHERE account_id = ?').bind(id),
      this.d1.prepare('DELETE FROM accounts WHERE id = ?').bind(id),
    ]);
  }
  async searchAccounts(q, n = 15) {
    return this.all('SELECT login, xp FROM accounts WHERE login LIKE ? ORDER BY xp DESC LIMIT ?', String(q).replace(/[%_]/g, '') + '%', n);
  }
  async logAdmin(admin, action, detail) {
    await this.run('INSERT INTO admin_log (admin, action, detail, at) VALUES (?, ?, ?, ?)', String(admin), String(action), String(detail).slice(0, 300), Date.now());
  }
  async adminLog(n = 40) { return this.all('SELECT admin, action, detail, at FROM admin_log ORDER BY id DESC LIMIT ?', n); }
}
