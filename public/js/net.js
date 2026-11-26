// Verbindung zum Server: REST-API und WebSocket (Multiplayer)
const KEY = 'kq-token';
export const session = {
  get token() { try { return localStorage.getItem(KEY) || ''; } catch { return this._t || ''; } },
  set token(v) { this._t = v; try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* privat */ } },
};

export async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    return { status: 0, data: { error: 'Keine Verbindung zum Server.' } };
  }
  let data = {};
  try { data = await res.json(); } catch { data = { error: 'Serverfehler' }; }
  return { status: res.status, data };
}

// Eine WebSocket-Verbindung, die bei Bedarf aufgebaut wird
class Live {
  constructor() { this.ws = null; this.handlers = new Set(); this.ready = null; this.queue = []; }
  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  connect() {
    if (this.ws && this.ws.readyState <= 1) return this.ready;
    const url = location.origin.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(url);
    this.ready = new Promise((ok, fail) => {
      const to = setTimeout(() => fail(new Error('Zeitüberschreitung')), 8000);
      this.ws.addEventListener('open', () => { this.raw({ t: 'auth', token: session.token }); });
      this.ws.addEventListener('message', (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'auth') { clearTimeout(to); ok(m); }
        if (m.t === 'error' && !this.authed) { clearTimeout(to); fail(new Error(m.msg)); }
        if (m.t === 'auth') this.authed = true;
        for (const h of [...this.handlers]) h(m);
      });
      this.ws.addEventListener('close', () => { clearTimeout(to); this.authed = false; for (const h of [...this.handlers]) h({ t: 'closed' }); fail(new Error('Verbindung getrennt')); });
      this.ws.addEventListener('error', () => {});
    });
    this.ready.catch(() => {});
    return this.ready;
  }
  raw(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  send(m) { this.raw(m); }
  close() { if (this.ws) { try { this.ws.close(); } catch { /* egal */ } } this.ws = null; }
}
export const live = new Live();
