// Kommando-Quiz auf Cloudflare: Der Worker liefert das Spiel aus und beantwortet die API (D1-Datenbank),
// ein Durable Object betreibt den Multiplayer (Quiz-Duell, Gefecht 5 gegen 5) über WebSocket.
import { handleApi } from '../server/api.js';
import { Hub } from '../server/hub.js';
import { Store } from '../server/store.js';
import { configureAdmin } from '../server/admin.js';

const adminFromEnv = (env) => configureAdmin({ names: env.ADMIN_NAMES || 'Dinnerboneagg', code: env.ADMIN_CODE || '' });
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export class HubDO {
  constructor(state, env) {
    adminFromEnv(env);
    this.hub = new Hub(new Store(env.DB));
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/stats') return json(200, this.hub.stats());
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Nur WebSocket', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const c = this.hub.connect((text) => server.send(text), () => { try { server.close(1000, 'kick'); } catch { /* schon zu */ } });
    server.addEventListener('message', (e) => this.hub.message(c, typeof e.data === 'string' ? e.data : ''));
    server.addEventListener('close', () => this.hub.close(c));
    server.addEventListener('error', () => this.hub.close(c));
    return new Response(null, { status: 101, webSocket: client });
  }
}

const hubStub = (env) => env.HUB.get(env.HUB.idFromName('hub'));

export default {
  async fetch(request, env) {
    adminFromEnv(env);
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') === 'websocket') return hubStub(env).fetch(request);
    if (url.pathname.startsWith('/api/')) {
      try {
        let body = {};
        if (request.method === 'POST') {
          const text = await request.text();
          if (text.length > 64 * 1024) return json(413, { error: 'Zu groß.' });
          try { body = JSON.parse(text || '{}'); } catch { return json(400, { error: 'Ungültige Anfrage.' }); }
        }
        let stats = { version: env.VERSION || 'dev' };
        if (url.pathname === '/api/health') {
          try { stats = { ...stats, ...(await (await hubStub(env).fetch('https://hub/stats')).json()), multiplayer: true }; } catch { stats.multiplayer = false; }
        }
        const r = await handleApi(new Store(env.DB), {
          method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body,
          token: (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''),
          ip: request.headers.get('cf-connecting-ip') || '?', stats,
        });
        return json(r.status, r.data);
      } catch (e) {
        console.error(e);
        return json(500, { error: 'Serverfehler' });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
