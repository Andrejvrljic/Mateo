// REST-API: Konten, Profil, Solo-Quiz, Minispiel-Belohnungen, Shop, Rangliste.
// Läuft gleich unter Node und auf Cloudflare (Worker + D1).
import { pickQuestions, shuffleAnswers, publicQuestion, answerPoints, QUESTIONS, CATEGORIES, QUIZ_TIME } from '../public/shared/questions.js';
import { applyQuiz, applyGame, applyBattle, claimDaily, runShop, GAMES } from '../public/shared/progress.js';
import { isAdminName, serverInfo } from './admin.js';
import { BOARDS } from './store.js';

const hits = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const h = hits.get(key) || { n: 0, t: now };
  if (now - h.t > windowMs) { h.n = 0; h.t = now; }
  h.n++; hits.set(key, h);
  if (hits.size > 5000) hits.clear();
  return h.n > max;
}

export async function publicProfile(db, acc) {
  return {
    profile: acc.profile,
    account: { login: acc.login, admin: isAdminName(acc.login), place: await db.rankOf(acc.profile.xp) },
  };
}

const FEEDBACK_GRACE = 2.5; // Sekunden, in denen der Client die Lösung zeigt

export async function handleApi(db, { method, path, query = {}, body = {}, token = '', ip = '?', stats = {} }) {
  const out = (status, data) => ({ status, data });
  if (limited('api:' + ip, 400, 60000)) return out(429, { error: 'Zu viele Anfragen – kurz warten.' });
  const auth = async () => {
    const acc = await db.byToken(token);
    if (!acc) throw Object.assign(new Error('auth'), { status: 401 });
    return acc;
  };

  try {
    switch (`${method} ${path}`) {
      case 'GET /api/health': {
        const accounts = await db.accountCount();
        return out(200, { ok: true, db: true, accounts, questions: QUESTIONS.length, ...stats });
      }
      case 'GET /api/news': return out(200, await serverInfo(db));
      case 'GET /api/leaderboard': {
        const board = BOARDS.includes(query.board) ? query.board : 'xp';
        return out(200, { board, top: await db.leaderboard(board, 50) });
      }
      case 'POST /api/signup': {
        if (limited('signup:' + ip, 60, 10 * 60000)) return out(429, { error: 'Zu viele neue Konten – später nochmal.' });
        const r = await db.createAccount(String(body.login || '').trim(), body.password);
        if (r.error) return out(400, { error: r.error });
        return out(200, { token: r.token, ...(await publicProfile(db, await db.account(r.id))), news: await serverInfo(db) });
      }
      case 'POST /api/login': {
        if (limited('login:' + ip, 15, 5 * 60000)) return out(429, { error: 'Zu viele Versuche – in ein paar Minuten nochmal.' });
        const r = await db.login(body.login, body.password);
        if (!r) return out(401, { error: 'Benutzername oder Passwort falsch.' });
        if (r.banned) return out(403, { error: 'Dieses Konto ist gesperrt.' });
        return out(200, { token: r.token, ...(await publicProfile(db, await db.account(r.id))), news: await serverInfo(db) });
      }
      case 'POST /api/logout': await db.logout(token); return out(200, { ok: true });
      case 'GET /api/me': {
        const acc = await auth();
        return out(200, { ...(await publicProfile(db, acc)), news: await serverInfo(db) });
      }

      // ---------- Belohnungen, Shop, Tagesbonus ----------
      case 'POST /api/action': {
        const acc = await auth();
        const p = acc.profile;
        let result;
        if (body.type === 'daily') {
          result = claimDaily(p);
          if (!result) return out(400, { error: 'Heute schon abgeholt.' });
        } else if (body.type === 'buy' || body.type === 'equip') {
          result = runShop(p, body);
          if (result.error) return out(400, { error: result.error });
        } else if (body.type === 'game' || body.type === 'battle') {
          const game = body.type === 'battle' ? 'battle' : body.game;
          const g = GAMES[game];
          if (!g) return out(400, { error: 'Unbekanntes Spiel.' });
          const now = Date.now();
          if (now - (p.last[game] || 0) < g.gap * 1000) return out(429, { error: 'Zu schnell – für diese Runde gibt es keine Belohnung.' });
          if (game === 'battle') {
            const outcome = ['win', 'loss', 'draw'].includes(body.outcome) ? body.outcome : 'loss';
            result = applyBattle(p, { outcome, kills: body.kills, tankKills: body.tankKills });
            await db.setScore(acc.id, 'battle', result.kills);
          } else {
            result = applyGame(p, game, body.score, { won: !!body.won });
            await db.setScore(acc.id, game, result.score);
          }
          p.last[game] = now;
        } else return out(400, { error: 'Aktion nicht möglich.' });
        await db.save(acc);
        return out(200, { result, ...(await publicProfile(db, acc)) });
      }

      // ---------- Solo-Quiz (Server kennt die Lösungen, der Browser nicht) ----------
      case 'POST /api/quiz/start': {
        const acc = await auth();
        const cat = CATEGORIES[body.cat] ? body.cat : 'mix';
        const n = Math.max(3, Math.min(15, Math.trunc(body.n) || 10));
        const qs = pickQuestions(cat, n).map((q) => ({ id: q.id, ...shuffleAnswers() }));
        const data = { cat, qs, answers: [], points: 0, correct: 0, t: Date.now(), jokers: [] };
        const run = await db.newRun(acc.id, data);
        return out(200, { run, cat, time: QUIZ_TIME, jokers: acc.profile.jokers, questions: qs.map((x) => publicQuestion(QUESTIONS[x.id], x.order)) });
      }
      case 'POST /api/quiz/answer': {
        const acc = await auth();
        const run = await db.getRun(body.run, acc.id);
        if (!run) return out(404, { error: 'Quiz nicht gefunden.' });
        const i = run.answers.length;
        if (body.i !== i || i >= run.qs.length) return out(400, { error: 'Falsche Frage.' });
        const c = Number.isInteger(body.c) && body.c >= 0 && body.c < 4 ? body.c : -1;
        const now = Date.now();
        const secs = (now - run.t) / 1000 - (i > 0 ? FEEDBACK_GRACE : 0);
        const x = run.qs[i];
        const correct = c === x.right;
        const pts = answerPoints(correct, secs);
        run.answers.push(c); run.points += pts; run.correct += correct ? 1 : 0; run.t = now;
        const q = QUESTIONS[x.id];
        const res = { correct, right: x.right, points: pts, total: run.points, fact: q.f || null };
        if (run.answers.length >= run.qs.length) {
          await db.deleteRun(body.run);
          res.done = true;
          res.reward = applyQuiz(acc.profile, { correct: run.correct, total: run.qs.length, points: run.points });
          await db.save(acc);
          await db.setScore(acc.id, 'quiz', run.points);
          Object.assign(res, await publicProfile(db, acc));
        } else await db.saveRun(body.run, run);
        return out(200, res);
      }
      case 'POST /api/quiz/joker': {
        const acc = await auth();
        const run = await db.getRun(body.run, acc.id);
        if (!run) return out(404, { error: 'Quiz nicht gefunden.' });
        const i = run.answers.length;
        if (body.i !== i || run.jokers.includes(i)) return out(400, { error: 'Joker nicht möglich.' });
        if (acc.profile.jokers < 1) return out(400, { error: 'Keine Joker mehr – im Shop gibt es neue.' });
        acc.profile.jokers--;
        run.jokers.push(i);
        const wrong = [0, 1, 2, 3].filter((k) => k !== run.qs[i].right).sort(() => Math.random() - 0.5).slice(0, 2);
        await db.save(acc); await db.saveRun(body.run, run);
        return out(200, { remove: wrong, jokers: acc.profile.jokers });
      }
    }
  } catch (e) {
    if (e.status === 401) return out(401, { error: 'Nicht angemeldet.' });
    throw e;
  }
  return out(404, { error: 'Unbekannt.' });
}
