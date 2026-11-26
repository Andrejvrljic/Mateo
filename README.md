# 🎖️ Kommando-Quiz

Militär-Quiz mit Minispielen und Online-Multiplayer – im Browser, auf PC, Tablet und Handy.

**Spielen:** https://kommando-quiz.dinnerboneagg.workers.dev

## Was es gibt
- **Militär-Quiz** – über 150 Fragen in 6 Themen (Panzer, Luftwaffe, Marine, Ränge, Geschichte, Funk & Wissen), Zeitbonus, 50:50-Joker, Wissens-Infos
- **Quiz-Duell (online)** – schnelles Spiel oder privater Raum mit Code, Bots füllen auf
- **Gefecht 5 gegen 5 mit Panzern** – selbst laufen, zielen, schießen, in den Panzer steigen; offline gegen Bots oder online
- **Minispiele:** Panzer-Schießstand (Zielpuppen), Flugabwehr, Fallschirmsprung, Minenräumer, Morse-Funker
- **Fortschritt:** 19 Dienstgrade vom Rekrut bis zum General, Münzen, 20 Medaillen, Tagesbonus mit Serie
- **Shop** mit 10 Tarnmustern, **Ranglisten** für alles, **Lexikon**, **Admin-Bereich**

## Technik
- `public/` – Spielseite (HTML, CSS, JavaScript, Canvas), `public/shared/` – Logik für Browser und Server
- `server/` – API (`api.js`), Datenbank (`store.js`), Multiplayer (`hub.js`), lokaler Node-Server (`app.js`)
- `cloudflare/worker.js` – Worker (Seite + API) und Durable Object `HubDO` (Multiplayer über WebSocket), D1-Datenbank

## Lokal starten
```
npm install
npm start        # http://localhost:3000
npm test
```

## Veröffentlichen
Jeder Merge auf `main` veröffentlicht automatisch auf Cloudflare (`.github/workflows/cloudflare.yml`):
Tests → D1-Datenbank anlegen, falls nötig → `wrangler deploy` → Live-Test (Seite, Datenbank, Quiz-Duell, Gefecht) → Testkonten löschen.

Nötige Repository-Secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit, D1 Edit), `ADMIN_CODE`. Optional: `CLOUDFLARE_ACCOUNT_ID`.
