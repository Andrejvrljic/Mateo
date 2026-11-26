// Kleine Hülle um node:sqlite, die sich wie Cloudflare D1 verhält (prepare/bind/first/all/run/batch).
// So läuft dieselbe Datenbank-Logik (store.js) lokal, in den Tests und auf Cloudflare.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, args); }
  st() { return this.db.prepare(this.sql); }
  runSync() { const r = this.st().run(...this.args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; }
  async first() { return this.st().get(...this.args) ?? null; }
  async all() { return { results: this.st().all(...this.args) }; }
  async run() { return this.runSync(); }
}

export class NodeD1 {
  constructor(file = ':memory:') {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    if (file !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL');
  }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(stmts) {
    this.db.exec('BEGIN');
    try { const r = stmts.map((s) => s.runSync()); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  close() { this.db.close(); }
}
