// Kommando-Quiz – Oberfläche: Anmeldung, Hauptquartier, Quiz, Quiz-Duell, Gefecht, Minispiele, Shop, Medaillen, Rangliste, Lexikon, Admin
import { api, session, live } from './net.js';
import { $, $$, esc, fmt, toast } from './ui.js';
import { sfx, isMuted, setMuted } from './audio.js';
import { rankBadge, skinPreview } from './draw.js';
import { createStage } from './stage.js';
import { startBattle } from './battleview.js';
import { CATEGORIES, QUIZ_TIME } from '../shared/questions.js';
import { rankInfo, SKINS, SKIN_ORDER, JOKER_PRICE, MEDALS, MEDAL_ORDER, GAMES, dayString } from '../shared/progress.js';
import { LEXICON } from '../shared/lexicon.js';
import range from './games/range.js';
import aa from './games/aa.js';
import para from './games/para.js';
import mines from './games/mines.js';
import morse from './games/morse.js';

const MINI = { range, aa, para, mines, morse };
const app = $('#app');
const S = { profile: null, account: null, news: null };
let screenCleanup = null;

function show(htmlStr, cleanup = null) {
  if (screenCleanup) { try { screenCleanup(); } catch { /* egal */ } }
  screenCleanup = cleanup;
  app.innerHTML = htmlStr;
  window.scrollTo(0, 0);
}
function setData(d) {
  if (d.profile) S.profile = d.profile;
  if (d.account) S.account = d.account;
  if (d.news) S.news = d.news;
}
const backBtn = (label = '← Hauptquartier') => `<button class="back" data-go="home">${label}</button>`;
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) { sfx.click(); go(b.dataset.go, b.dataset.arg); }
});

function go(where, arg) {
  const r = { home, quiz: quizMenu, duel: duelMenu, battle: battleMenu, shop, medals, ranks: leaderboard, lexicon, profile, admin };
  if (MINI[where]) return playMini(MINI[where]);
  (r[where] || home)(arg);
}

// Live-Nachrichten, die überall ankommen
live.on((m) => {
  if (m.t === 'announce') { toast('📢 ' + m.text, 'gold'); sfx.coin(); }
  if (m.t === 'profile') { setData(m); if (current === 'home') home(); }
  if (m.t === 'kicked') { session.token = ''; toast('Dein Konto wurde gesperrt.', 'err'); setTimeout(() => location.reload(), 1500); }
});
let current = '';

// ================= Anmelden =================
function authView(mode = 'signup', msg = '') {
  current = 'auth';
  show(`<div class="auth">
    <div class="logo">KOMMANDO<span>QUIZ</span></div>
    <p class="tagline">Militär-Quiz · Minispiele · Gefecht 5 gegen 5 mit Panzern</p>
    <div class="card">
      <div class="tabs"><button data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Konto erstellen</button><button data-m="login" class="${mode === 'login' ? 'on' : ''}">Anmelden</button></div>
      <form id="authForm" autocomplete="on">
        <label class="lbl" for="aUser">Benutzername</label>
        <input class="field" id="aUser" name="username" autocomplete="username" maxlength="20" placeholder="z. B. Mateo" autocapitalize="off" autocorrect="off" spellcheck="false">
        <label class="lbl" for="aPass">Passwort</label>
        <input class="field" id="aPass" name="password" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" placeholder="mindestens 6 Zeichen">
        ${mode === 'signup' ? '<label class="lbl" for="aPass2">Passwort wiederholen</label><input class="field" id="aPass2" type="password" autocomplete="new-password">' : ''}
        <button class="btn gold big" style="width:100%;margin-top:18px" type="submit">${mode === 'signup' ? 'ZUM DIENST MELDEN' : 'ANMELDEN'}</button>
        <div class="msg" id="aMsg">${esc(msg)}</div>
      </form>
    </div>
    <p class="muted" style="text-align:center;font-size:13px;margin-top:14px">Dein Fortschritt wird online gespeichert – du kannst dich auf jedem Gerät anmelden.</p>
  </div>`);
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => authView(b.dataset.m)));
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = $('#aUser').value.trim(), password = $('#aPass').value;
    const m = $('#aMsg');
    if (mode === 'signup' && password !== $('#aPass2').value) { m.textContent = 'Die Passwörter sind nicht gleich.'; return; }
    m.className = 'msg ok'; m.textContent = 'Einen Moment …';
    const r = await api('POST', mode === 'signup' ? '/api/signup' : '/api/login', { login, password });
    if (r.status !== 200) { m.className = 'msg'; m.textContent = r.data.error || 'Fehler'; return; }
    session.token = r.data.token;
    setData(r.data);
    sfx.right();
    home();
  });
}

// ================= Hauptquartier =================
function header() {
  const p = S.profile, r = rankInfo(p.xp);
  return `<div class="hq-head">
    ${rankBadge(r.i)}
    <div class="who"><div class="name">${esc(p.name)}</div><div class="rank">${r.name}${S.account.admin ? ' <span class="tag">Admin</span>' : ''}</div>
      <div class="xpbar"><i style="width:${Math.round(r.progress * 100)}%"></i></div>
      <div class="xptext">${fmt(p.xp)} EP${r.next ? ` · nächster Rang: ${r.nextName} bei ${fmt(r.next)} EP` : ' · höchster Rang!'}</div></div>
    <div class="row"><span class="pill gold" title="Münzen">🪙 ${fmt(p.coins)}</span><span class="pill" title="50:50-Joker">🃏 ${p.jokers}</span>
    <button class="pill" data-go="profile" style="cursor:pointer" title="Profil & Einstellungen">⚙️</button></div>
  </div>`;
}

function home() {
  current = 'home';
  const p = S.profile, n = S.news || {};
  const daily = p.daily.day !== dayString();
  const best = (g) => (p.best[g] ? `Rekord: ${fmt(p.best[g])}` : 'Noch nicht gespielt');
  show(`<div class="wrap">
    ${header()}
    ${n.maintenance ? `<div class="banner warn">🛠️ ${esc(n.maintenance.text)}</div>` : ''}
    ${n.motd ? `<div class="banner">📢 ${esc(n.motd)}</div>` : ''}
    ${daily ? `<div class="banner row" style="justify-content:space-between"><span>📅 <b>Dienstantritt!</b> Hol dir deine tägliche Belohnung${p.daily.streak ? ` (Serie: ${p.daily.streak} Tage)` : ''}.</span><button class="btn gold small" id="daily">Abholen</button></div>` : ''}
    <div class="grid">
      <button class="tile hero" data-go="quiz"><span class="ic">🎖️</span><b>Militär-Quiz</b><span>${Object.keys(CATEGORIES).length - 1} Themen · über 150 Fragen · Joker</span><span class="best">${p.best.quiz ? `Rekord: ${fmt(p.best.quiz)} Punkte` : 'Starte deine erste Prüfung!'}</span></button>
      <button class="tile online" data-go="duel"><span class="ic">⚔️</span><b>Quiz-Duell</b><span>Online gegen andere Spieler</span><span class="best">Siege: ${p.stats.duelWins}</span></button>
      <button class="tile online" data-go="battle"><span class="ic">🪖</span><b>Gefecht 5 gegen 5</b><span>Mit Panzer – selbst schießen! Offline oder online</span><span class="best">Siege: ${p.stats.battleWins} · Treffer: ${p.stats.kills}</span></button>
    </div>
    <div class="section-h">MINISPIELE</div>
    <div class="grid">
      ${['range', 'aa', 'para', 'mines', 'morse'].map((g) => `<button class="tile" data-go="${g}"><span class="ic">${GAMES[g].icon}</span><b>${GAMES[g].name}</b><span>${{ range: 'Panzer fahren und Zielpuppen treffen', aa: 'Drohnen und Flugzeuge abwehren', para: 'Im Ziel landen', mines: 'Das Minenfeld räumen', morse: 'Morsezeichen entschlüsseln' }[g]}</span><span class="best">${best(g)}</span></button>`).join('')}
    </div>
    <div class="section-h">KASERNE</div>
    <div class="grid small">
      <button class="tile" data-go="shop"><span class="ic">🎨</span><b>Shop</b><span>Tarnmuster & Joker</span></button>
      <button class="tile" data-go="medals"><span class="ic">🏅</span><b>Medaillen</b><span>${p.medals.length} / ${MEDAL_ORDER.length}</span></button>
      <button class="tile" data-go="ranks"><span class="ic">🏆</span><b>Rangliste</b><span>Die Besten</span></button>
      <button class="tile" data-go="lexicon"><span class="ic">📖</span><b>Lexikon</b><span>Fahrzeuge & Technik</span></button>
      ${S.account.admin ? '<button class="tile" data-go="admin"><span class="ic">🛠️</span><b>Admin</b><span>Verwaltung</span></button>' : ''}
    </div>
  </div>`);
  const d = $('#daily');
  if (d) d.addEventListener('click', async () => {
    const r = await api('POST', '/api/action', { type: 'daily' });
    if (r.status !== 200) return toast(r.data.error || 'Fehler', 'err');
    setData(r.data);
    sfx.coin();
    toast(`📅 Tag ${r.data.result.streak}: +${r.data.result.coins} Münzen, +${r.data.result.xp} EP${r.data.result.joker ? ', +1 Joker' : ''}`, 'gold');
    announceExtras(r.data.result);
    home();
  });
}

function announceExtras(res) {
  if (!res) return;
  if (res.rankUp) { toast(`⭐ Beförderung! Du bist jetzt ${res.rankUp}`, 'gold'); sfx.win(); }
  for (const m of res.medals || []) toast(`🏅 Neue Medaille: ${MEDALS[m].name} (+50 Münzen)`, 'gold');
}

function rewardHTML(res) {
  if (!res) return '';
  return `<div class="rewards"><span class="pill gold">+${res.xp} EP</span><span class="pill gold">+${res.coins} 🪙</span></div>
    ${res.rankUp ? `<div class="rankup">⭐ BEFÖRDERT ZUM ${esc(res.rankUp.toUpperCase())}! ⭐</div>` : ''}
    ${(res.medals || []).map((m) => `<div class="medal-new">${MEDALS[m].icon} Neue Medaille: ${MEDALS[m].name}</div>`).join('')}`;
}

// ================= Solo-Quiz =================
function quizMenu() {
  current = 'quiz';
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>🎖️ Militär-Quiz</h2><span class="pill">🃏 ${S.profile.jokers} Joker</span></div>
    <p class="muted">10 Fragen, je ${QUIZ_TIME} Sekunden. Je schneller du richtig antwortest, desto mehr Punkte. Mit dem 🃏 <b>50:50-Joker</b> verschwinden zwei falsche Antworten.</p>
    <div class="cats">${Object.entries(CATEGORIES).map(([k, c]) => `<button class="tile" data-cat="${k}"><span class="ic">${c.icon}</span><b>${c.name}</b></button>`).join('')}</div>
  </div>`);
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { sfx.click(); soloQuiz(b.dataset.cat); }));
}

async function soloQuiz(cat) {
  current = 'play';
  const r = await api('POST', '/api/quiz/start', { cat });
  if (r.status !== 200) return toast(r.data.error || 'Fehler', 'err');
  const { run, questions } = r.data;
  let jokers = r.data.jokers, i = 0, total = 0, correct = 0, timer = null, locked = false;
  const stop = () => { clearInterval(timer); };
  const view = () => {
    const q = questions[i];
    locked = false;
    show(`<div class="wrap"><div class="quiz">
      <div class="qhead"><button class="back" id="qQuit">✕ Abbrechen</button><span class="spacer"></span>
        <span class="pill">${CATEGORIES[q.cat].icon} Frage ${i + 1}/${questions.length}</span><span class="pill gold">⭐ ${fmt(total)}</span>
        <button class="btn small dark" id="qJoker" ${jokers < 1 ? 'disabled' : ''}>🃏 50:50 (${jokers})</button></div>
      <div class="timer"><i id="qBar"></i></div>
      <div class="question">${esc(q.q)}</div>
      <div class="answers">${q.a.map((a, k) => `<button class="ans" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(a)}</span></button>`).join('')}</div>
      <div id="qFact"></div>
    </div></div>`, stop);
    const t0 = performance.now();
    const bar = $('#qBar');
    stop();
    let lastSec = QUIZ_TIME;
    timer = setInterval(() => {
      const left = QUIZ_TIME - (performance.now() - t0) / 1000;
      bar.style.transform = `scaleX(${Math.max(0, left / QUIZ_TIME)})`;
      bar.style.backgroundPosition = `${(1 - left / QUIZ_TIME) * 100}% 0`;
      if (left < 5 && Math.ceil(left) < lastSec) { lastSec = Math.ceil(left); sfx.tick(); }
      if (left <= 0) { stop(); answer(-1); }
    }, 50);
    $('#qQuit').addEventListener('click', () => { stop(); quizMenu(); });
    $$('.ans').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.k)));
    $('#qJoker').addEventListener('click', async () => {
      if (locked) return;
      const j = await api('POST', '/api/quiz/joker', { run, i });
      if (j.status !== 200) return toast(j.data.error, 'err');
      jokers = j.data.jokers; S.profile.jokers = jokers;
      for (const k of j.data.remove) { const b = $(`.ans[data-k="${k}"]`); b.classList.add('gone'); b.disabled = true; }
      $('#qJoker').disabled = true;
      sfx.pop();
    });
  };
  async function answer(c) {
    if (locked) return;
    locked = true; stop();
    $$('.ans').forEach((b) => { b.disabled = true; });
    if (c >= 0) $(`.ans[data-k="${c}"]`).classList.add('picked');
    const a = await api('POST', '/api/quiz/answer', { run, i, c });
    if (a.status !== 200) { toast(a.data.error || 'Fehler', 'err'); return quizMenu(); }
    $(`.ans[data-k="${a.data.right}"]`).classList.add('right');
    if (!a.data.correct && c >= 0) $(`.ans[data-k="${c}"]`).classList.add('wrong');
    if (a.data.correct) { correct++; sfx.right(); } else sfx.wrong();
    total = a.data.total;
    $('#qFact').innerHTML = `<div class="fact">${a.data.correct ? `✅ Richtig! +${a.data.points} Punkte` : c < 0 ? '⏰ Zeit abgelaufen!' : '❌ Leider falsch.'}${a.data.fact ? `<br>💡 ${esc(a.data.fact)}` : ''}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="qNext">${a.data.done ? 'ERGEBNIS' : 'WEITER →'}</button></div>`;
    const nextFn = () => { if (a.data.done) { setData(a.data); quizResult(a.data.reward, cat); } else { i++; view(); } };
    $('#qNext').addEventListener('click', nextFn);
    $('#qNext').focus();
  }
  view();
}

function quizResult(res, cat) {
  current = 'result';
  const grade = res.correct === res.total ? 'Ausgezeichnet!' : res.correct >= res.total * 0.7 ? 'Sehr gut!' : res.correct >= res.total * 0.4 ? 'Gut gemacht!' : 'Weiter üben, Soldat!';
  show(`<div class="wrap"><div class="quiz card">
    <div class="result-big"><div class="muted">${grade}</div><div class="num">${res.correct}/${res.total}</div><div>richtige Antworten · ${fmt(res.points)} Punkte</div></div>
    ${rewardHTML(res)}
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn dark" data-go="home">Hauptquartier</button><button class="btn gold" id="again">Nochmal</button></div>
  </div></div>`);
  res.correct === res.total ? sfx.win() : sfx.coin();
  $('#again').addEventListener('click', () => soloQuiz(cat));
}

// ================= Online: gemeinsame Lobby =================
async function connectLive() {
  try { await live.connect(); return true; } catch (e) { toast(e.message || 'Keine Verbindung', 'err'); return false; }
}
function lobbyView(kind, onMsg) {
  return (m) => {
    if (m.t === 'lobby') {
      const isQuiz = kind === 'quiz';
      show(`<div class="wrap"><button class="back" id="lLeave">← Lobby verlassen</button>
        <div class="card" style="max-width:560px;margin:10px auto">
          <h2 style="text-align:center">${isQuiz ? '⚔️ Quiz-Duell' : '🪖 Gefecht 5 gegen 5'}</h2>
          ${m.pub ? `<p class="muted" style="text-align:center">Öffentliches Spiel – startet automatisch in <b>${m.startIn ?? '…'}</b> s</p>` : `<p class="muted" style="text-align:center">Raum-Code für deine Freunde:</p><div class="lobby-code">${esc(m.code)}</div>`}
          ${isQuiz && m.cat ? `<p style="text-align:center">${CATEGORIES[m.cat].icon} ${CATEGORIES[m.cat].name}</p>` : ''}
          <div class="list" style="margin:14px 0">${m.players.map((p) => `<div class="li"><span class="${p.team === null ? '' : 't' + p.team}">${p.team === null ? '👤' : p.team ? '🔴' : '🔵'} <b>${esc(p.name)}</b></span><span class="spacer"></span>${p.host ? '<span class="tag">Chef</span>' : ''}</div>`).join('')}</div>
          <p class="muted" style="font-size:14px;text-align:center">${isQuiz ? 'Allein? Dann spielen Bots mit.' : 'Freie Plätze werden mit Bots aufgefüllt.'}</p>
          ${m.host ? '<button class="btn gold big" id="lStart" style="width:100%">JETZT STARTEN</button>' : '<p style="text-align:center">Warte auf den Start …</p>'}
        </div></div>`, () => {});
      $('#lLeave').addEventListener('click', () => { live.send({ t: 'leave' }); unsubLobby(); kind === 'quiz' ? duelMenu() : battleMenu(); });
      const s = $('#lStart');
      if (s) s.addEventListener('click', () => { live.send({ t: 'start' }); s.disabled = true; });
    } else if (m.t === 'error') { toast(m.msg, 'err'); }
    else if (m.t === 'closed') { toast('Verbindung getrennt.', 'err'); unsubLobby(); home(); }
    onMsg(m);
  };
}
let unsubLobby = () => {};

// ================= Quiz-Duell =================
function duelMenu() {
  current = 'duel';
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>⚔️ Quiz-Duell</h2></div>
    <p class="muted">Alle bekommen die gleichen Fragen – wer schneller richtig antwortet, bekommt mehr Punkte. Platz 1 bekommt die größte Belohnung.</p>
    <div class="grid">
      <button class="tile hero" id="dQuick"><span class="ic">⚡</span><b>Schnelles Spiel</b><span>Mit anderen Spielern online – Bots füllen auf</span></button>
      <div class="tile"><span class="ic">🔒</span><b>Raum erstellen</b><span>Für dich und deine Freunde</span>
        <select class="field" id="dCat">${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.icon} ${c.name}</option>`).join('')}</select>
        <button class="btn" id="dCreate">Erstellen</button></div>
      <div class="tile"><span class="ic">🔑</span><b>Mit Code beitreten</b><input class="field" id="dCode" maxlength="4" placeholder="CODE" style="text-transform:uppercase;letter-spacing:4px;font-weight:800"><button class="btn" id="dJoin">Beitreten</button></div>
    </div></div>`);
  const join = async (msg) => {
    if (!(await connectLive())) return;
    unsubLobby();
    unsubLobby = live.on(lobbyView('quiz', duelMsg));
    live.send({ t: 'join', kind: 'quiz', ...msg });
  };
  $('#dQuick').addEventListener('click', () => join({}));
  $('#dCreate').addEventListener('click', () => join({ create: true, cat: $('#dCat').value, n: 10 }));
  $('#dJoin').addEventListener('click', () => { const c = $('#dCode').value.trim(); if (c.length === 4) join({ code: c }); else toast('Der Code hat 4 Zeichen.', 'err'); });
}

let duel = null;
function duelMsg(m) {
  if (m.t === 'qstart') {
    current = 'play';
    duel = { players: m.players, scores: Object.fromEntries(m.players.map((p) => [p.key, 0])), answered: new Set(), q: null, picked: -1, timer: null };
    show(`<div class="wrap"><div class="quiz"><div class="result-big"><div class="num">LOS!</div><div>${m.n} Fragen · ${m.players.length} Spieler</div></div></div></div>`);
    sfx.win();
  } else if (m.t === 'q') {
    duel.q = m; duel.answered = new Set(); duel.picked = -1;
    clearInterval(duel.timer);
    show(`<div class="wrap"><div class="quiz">
      <div class="qhead"><button class="back" id="qQuit">✕ Verlassen</button><span class="spacer"></span><span class="pill">${CATEGORIES[m.cat].icon} Frage ${m.i + 1}/${m.n}</span></div>
      <div class="chips" id="chips"></div>
      <div class="timer"><i id="qBar"></i></div>
      <div class="question">${esc(m.q)}</div>
      <div class="answers">${m.a.map((a, k) => `<button class="ans" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(a)}</span></button>`).join('')}</div>
      <div id="qFact"></div></div></div>`, () => clearInterval(duel && duel.timer));
    chips();
    const t0 = performance.now(), bar = $('#qBar');
    duel.timer = setInterval(() => { const left = m.time - (performance.now() - t0) / 1000; bar.style.transform = `scaleX(${Math.max(0, left / m.time)})`; bar.style.backgroundPosition = `${(1 - left / m.time) * 100}% 0`; if (left <= 0) clearInterval(duel.timer); }, 50);
    $$('.ans').forEach((b) => b.addEventListener('click', () => {
      if (duel.picked >= 0) return;
      duel.picked = +b.dataset.k; b.classList.add('picked');
      $$('.ans').forEach((x) => { x.disabled = true; });
      live.send({ t: 'ans', i: m.i, c: duel.picked });
      sfx.click();
    }));
    $('#qQuit').addEventListener('click', () => { live.send({ t: 'leave' }); unsubLobby(); duelMenu(); });
  } else if (m.t === 'answered') { duel.answered.add(m.key); chips(); }
  else if (m.t === 'reveal') {
    clearInterval(duel.timer);
    $$('.ans').forEach((x) => { x.disabled = true; });
    const r = $(`.ans[data-k="${m.right}"]`); if (r) r.classList.add('right');
    if (duel.picked >= 0 && duel.picked !== m.right) $(`.ans[data-k="${duel.picked}"]`).classList.add('wrong');
    duel.picked === m.right ? sfx.right() : sfx.wrong();
    for (const s of m.scores) duel.scores[s.key] = s.score;
    duel.answered = new Set();
    chips(m.scores);
    const f = $('#qFact'); if (f) f.innerHTML = m.fact ? `<div class="fact">💡 ${esc(m.fact)}</div>` : '';
  } else if (m.t === 'qend') {
    unsubLobby();
    setData(m);
    const me = S.account.login;
    show(`<div class="wrap"><div class="quiz card">
      <h2 style="text-align:center">🏁 Ergebnis</h2>
      <div class="list" style="margin:14px 0">${m.ranking.map((p) => `<div class="li top${p.place} ${p.name === S.profile.name && !p.bot ? 'me' : ''}"><span class="pos">${p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : p.place === 3 ? '🥉' : p.place}</span><b>${esc(p.name)}</b><span class="spacer"></span><span class="muted">${p.correct} richtig</span><span class="val">${fmt(p.score)}</span></div>`).join('')}</div>
      ${m.reward ? `<p style="text-align:center;font-weight:800">${m.reward.won ? '🏆 Du hast das Duell gewonnen!' : `Platz ${m.reward.place}`}</p>` : ''}
      ${rewardHTML(m.reward)}
      <div class="row" style="justify-content:center"><button class="btn dark" data-go="home">Hauptquartier</button><button class="btn gold" data-go="duel">Nochmal</button></div>
    </div></div>`);
    void me;
    m.reward && m.reward.won ? sfx.win() : sfx.coin();
    announceExtras(m.reward && { medals: [], rankUp: m.reward.rankUp });
  }
}
function chips(scores) {
  const el = $('#chips'); if (!el || !duel) return;
  el.innerHTML = duel.players.map((p) => {
    const s = scores && scores.find((x) => x.key === p.key);
    return `<span class="chip ${duel.answered.has(p.key) ? 'done' : ''}">${p.bot ? '🤖' : '👤'} ${esc(p.name)} <span class="pts">${fmt(duel.scores[p.key] || 0)}</span>${s && s.pts ? ` <span style="color:#7fd17f">+${s.pts}</span>` : ''}${duel.answered.has(p.key) ? ' ✓' : ''}</span>`;
  }).join('');
}

// ================= Gefecht =================
function battleMenu() {
  current = 'battle';
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>🪖 Gefecht 5 gegen 5</h2></div>
    <p class="muted">Zwei Teams mit je 5 Soldaten und einem <b>Panzer</b>. Lauf zum Panzer deines Teams und steig mit <b>E</b> (oder dem Panzer-Knopf) ein – dann schießt du mit der großen Kanone! Das Team, das zuerst ${20} Gegner ausschaltet, gewinnt (oder wer nach 3 Minuten vorne liegt).</p>
    <div class="grid">
      <button class="tile hero" id="bOff"><span class="ic">🤖</span><b>Training gegen Bots</b><span>Sofort losspielen – du und 4 Bots gegen 5 Bots</span></button>
      <button class="tile online" id="bQuick"><span class="ic">⚡</span><b>Schnelles Spiel</b><span>Online mit anderen Spielern</span></button>
      <button class="tile" id="bCreate"><span class="ic">🔒</span><b>Raum erstellen</b><span>Freunde mit Code einladen</span></button>
      <div class="tile"><span class="ic">🔑</span><b>Mit Code beitreten</b><input class="field" id="bCode" maxlength="4" placeholder="CODE" style="text-transform:uppercase;letter-spacing:4px;font-weight:800"><button class="btn" id="bJoin">Beitreten</button></div>
    </div>
    <div class="card help" style="margin-top:16px"><b>Steuerung</b><br>PC: <kbd>W A S D</kbd> laufen · Maus zielen · Klick/<kbd>Leertaste</kbd> schießen · <kbd>E</kbd> Panzer ein/aus<br>Handy/Tablet: linker Daumen laufen · rechter Daumen zielen und schießen · Panzer-Knopf</div>
  </div>`);
  $('#bOff').addEventListener('click', () => offlineBattle());
  const join = async (msg) => {
    if (!(await connectLive())) return;
    unsubLobby();
    unsubLobby = live.on(lobbyView('battle', (m) => { if (m.t === 'bstart') { unsubLobby(); onlineBattle(m); } }));
    live.send({ t: 'join', kind: 'battle', ...msg });
  };
  $('#bQuick').addEventListener('click', () => join({}));
  $('#bCreate').addEventListener('click', () => join({ create: true }));
  $('#bJoin').addEventListener('click', () => { const c = $('#bCode').value.trim(); if (c.length === 4) join({ code: c }); else toast('Der Code hat 4 Zeichen.', 'err'); });
}

function offlineBattle() {
  current = 'play';
  startBattle({
    mode: 'offline', name: S.profile.name, skin: S.profile.skin,
    onExit: () => home(), onAgain: () => offlineBattle(),
    onEnd: async ({ outcome, kills, tankKills, box }) => {
      box.innerHTML = '<p class="muted" style="text-align:center">Belohnung wird gutgeschrieben …</p>';
      const r = await api('POST', '/api/action', { type: 'battle', outcome, kills, tankKills });
      if (r.status !== 200) { box.innerHTML = `<p class="muted" style="text-align:center">${esc(r.data.error || 'Keine Belohnung')}</p>`; return; }
      setData(r.data);
      box.innerHTML = rewardHTML(r.data.result);
      announceExtras({ medals: [], rankUp: null });
    },
  });
}

function onlineBattle(m) {
  current = 'play';
  startBattle({
    mode: 'online', roster: m.roster, you: m.you,
    onExit: () => home(),
    onError: (msg) => { toast(msg, 'err'); home(); },
    onEnd: ({ reward, extra, box }) => { if (extra) setData(extra); box.innerHTML = reward ? rewardHTML(reward) : ''; },
  });
}

// ================= Minispiele =================
function playMini(mod) {
  current = 'play';
  let game = null, ended = false, running = false;
  const stage = createStage({ sticks: mod.sticks, onExit: () => { if (game && game.destroy) game.destroy(); stage.destroy(); home(); } });
  const begin = () => {
    if (game && game.destroy) game.destroy();
    game = mod.create(stage, { skin: S.profile.skin });
    ended = false; running = false;
    const o = stage.overlay(`<h2>${GAMES[mod.id].icon} ${GAMES[mod.id].name}</h2><div class="help">${mod.help}</div>
      ${S.profile.best[mod.id] ? `<p class="muted">Dein Rekord: <b>${fmt(S.profile.best[mod.id])}</b></p>` : ''}
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn gold big" id="gGo">LOS!</button></div>`);
    o.querySelector('#gGo').addEventListener('click', () => { o.remove(); running = true; sfx.click(); });
  };
  stage.frame = (dt) => {
    if (!game) return;
    if (running) game.update(dt);
    game.draw(stage.g);
    if (running && game.over && !ended) { ended = true; finish(); }
  };
  async function finish() {
    const score = Math.round(game.score);
    const o = stage.overlay(`<div class="result-big"><div class="muted">${GAMES[mod.id].name}</div><div class="num">${fmt(score)}</div><div>Punkte</div></div><div id="gRew"><p class="muted" style="text-align:center">Wird gutgeschrieben …</p></div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn dark" id="gBack">Hauptquartier</button><button class="btn gold" id="gAgain">Nochmal</button></div>`);
    o.querySelector('#gBack').addEventListener('click', () => { if (game.destroy) game.destroy(); stage.destroy(); home(); });
    o.querySelector('#gAgain').addEventListener('click', () => { o.remove(); begin(); });
    const r = await api('POST', '/api/action', { type: 'game', game: mod.id, score, won: !!game.won });
    const box = o.querySelector('#gRew');
    if (r.status !== 200) { box.innerHTML = `<p class="muted" style="text-align:center">${esc(r.data.error || 'Keine Belohnung')}</p>`; return; }
    setData(r.data);
    box.innerHTML = (r.data.result.record ? '<div class="rankup">🏆 NEUER REKORD!</div>' : '') + rewardHTML(r.data.result);
    sfx.coin();
  }
  begin();
}

// ================= Shop =================
function shop() {
  current = 'shop';
  const p = S.profile;
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>🎨 Shop</h2><span class="pill gold">🪙 ${fmt(p.coins)}</span></div>
    <div class="card row" style="margin-bottom:14px"><span style="font-size:36px">🃏</span><div class="spacer"><b>50:50-Joker</b><br><span class="muted">Entfernt im Quiz zwei falsche Antworten. Du hast ${p.jokers}.</span></div>
      <button class="btn gold" data-buy="joker" ${p.coins < JOKER_PRICE ? 'disabled' : ''}>🪙 ${JOKER_PRICE}</button></div>
    <h3 style="margin:8px 0 10px">Tarnmuster für Panzer und Helm</h3>
    <div class="grid small">${SKIN_ORDER.map((k) => {
      const s = SKINS[k], own = p.skins.includes(k), on = p.skin === k;
      return `<div class="tile item ${own ? 'owned' : ''} ${on ? 'on' : ''}"><canvas data-skin="${k}"></canvas><b>${s.name}</b>
        ${on ? '<span class="tag">Ausgerüstet</span>' : own ? `<button class="btn small" data-equip="${k}">Ausrüsten</button>` : `<button class="btn small gold" data-buy="${k}" ${p.coins < s.price ? 'disabled' : ''}>🪙 ${fmt(s.price)}</button>`}</div>`;
    }).join('')}</div></div>`);
  $$('canvas[data-skin]').forEach((c) => skinPreview(c, c.dataset.skin));
  $$('[data-buy]').forEach((b) => b.addEventListener('click', async () => {
    const r = await api('POST', '/api/action', { type: 'buy', item: b.dataset.buy });
    if (r.status !== 200) return toast(r.data.error, 'err');
    setData(r.data); sfx.coin(); announceExtras(r.data.result); shop();
  }));
  $$('[data-equip]').forEach((b) => b.addEventListener('click', async () => {
    const r = await api('POST', '/api/action', { type: 'equip', item: b.dataset.equip });
    if (r.status !== 200) return toast(r.data.error, 'err');
    setData(r.data); sfx.click(); shop();
  }));
}

// ================= Medaillen =================
function medals() {
  current = 'medals';
  const p = S.profile;
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>🏅 Medaillen</h2><span class="pill">${p.medals.length} / ${MEDAL_ORDER.length}</span></div>
    <p class="muted">Jede neue Medaille bringt 50 Münzen.</p>
    <div class="grid">${MEDAL_ORDER.map((k) => `<div class="card medal ${p.medals.includes(k) ? '' : 'locked'}"><div class="ic">${MEDALS[k].icon}</div><div><b>${MEDALS[k].name}</b><br><span class="muted">${MEDALS[k].desc}</span></div></div>`).join('')}</div>
    <h3 style="margin:22px 0 10px">Dienstakte</h3>
    <div class="card"><table class="res">
      <tr><td>Quiz gespielt</td><td>${p.stats.quizzes}</td></tr><tr><td>Fragen richtig</td><td>${p.stats.correct} von ${p.stats.answered}</td></tr>
      <tr><td>Quiz-Duelle (Siege)</td><td>${p.stats.duels} (${p.stats.duelWins})</td></tr><tr><td>Gefechte (Siege)</td><td>${p.stats.battles} (${p.stats.battleWins})</td></tr>
      <tr><td>Gegner ausgeschaltet</td><td>${p.stats.kills}</td></tr><tr><td>Tage in Folge</td><td>${p.daily.streak}</td></tr>
    </table></div></div>`);
}

// ================= Rangliste =================
const BOARD_NAMES = { xp: '⭐ Dienstgrad (EP)', quiz: '🎖️ Quiz', battle: '🪖 Gefecht', range: '🎯 Schießstand', aa: '🛩️ Flugabwehr', para: '🪂 Fallschirm', mines: '💣 Minen', morse: '📻 Morse' };
async function leaderboard(board = 'xp') {
  current = 'ranks';
  const r = await api('GET', '/api/leaderboard?board=' + board);
  const top = (r.data.top || []);
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>🏆 Rangliste</h2>${board === 'xp' ? `<span class="pill">Dein Platz: ${S.account.place}</span>` : ''}</div>
    <div class="tabsbar">${Object.entries(BOARD_NAMES).map(([k, n]) => `<button data-b="${k}" class="${k === board ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="list">${top.length ? top.map((x, i) => `<div class="li top${i + 1} ${x.name === S.profile.name ? 'me' : ''}"><span class="pos">${i + 1}</span><b>${esc(x.name)}</b>${board === 'xp' ? `<span class="muted">${rankInfo(x.value).name}</span>` : ''}<span class="spacer"></span><span class="val">${fmt(x.value)}${board === 'xp' ? ' EP' : board === 'battle' ? ' Treffer' : ''}</span></div>`).join('') : '<p class="muted">Noch keine Einträge – sei der Erste!</p>'}</div>
  </div>`);
  $$('[data-b]').forEach((b) => b.addEventListener('click', () => leaderboard(b.dataset.b)));
}

// ================= Lexikon =================
function lexicon() {
  current = 'lexicon';
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>📖 Lexikon</h2></div>
    <div class="grid">${LEXICON.map((e) => `<div class="card lex"><div class="row"><span class="ic">${e.icon}</span><div><b style="font-family:var(--stencil);font-size:18px">${esc(e.name)}</b><br><span class="muted">${esc(e.type)} · ${esc(e.land)}</span></div></div>
      <dl>${e.facts.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl><div style="font-size:14px">${esc(e.text)}</div></div>`).join('')}</div>
  </div>`);
}

// ================= Profil =================
function profile() {
  current = 'profile';
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>⚙️ Profil</h2></div>
    <div class="card">
      <p>Angemeldet als <b>${esc(S.account.login)}</b> · Rang ${rankInfo(S.profile.xp).name}</p>
      <div class="row"><button class="btn dark" id="pMute">${isMuted() ? '🔇 Ton an' : '🔊 Ton aus'}</button><button class="btn red" id="pOut">Abmelden</button></div>
    </div></div>`);
  $('#pMute').addEventListener('click', () => { setMuted(!isMuted()); profile(); });
  $('#pOut').addEventListener('click', async () => { await api('POST', '/api/logout'); session.token = ''; live.close(); authView('login'); });
}

// ================= Admin =================
function admin() {
  current = 'admin';
  let req = 0;
  const pending = new Map();
  show(`<div class="wrap">${backBtn()}
    <div class="title-bar"><h2>🛠️ Admin</h2></div>
    <div class="card"><label class="lbl">Admin-Code</label><input class="field" id="adCode" type="password" autocomplete="off">
      <div class="row" style="margin-top:10px"><button class="btn" data-a="check">Status</button><button class="btn dark" data-a="overview">Wer ist online?</button><button class="btn dark" data-a="log">Protokoll</button></div></div>
    <div class="grid" style="margin-top:12px">
      <div class="card"><h3>Spieler</h3><label class="lbl">Benutzername</label><input class="field" id="adLogin">
        <div class="row" style="margin-top:8px"><button class="btn small dark" data-a="player">Anzeigen</button><button class="btn small dark" data-a="search">Suchen</button></div>
        <label class="lbl">Geben (EP / Münzen / Joker)</label><div class="row"><input class="field" id="adXp" placeholder="EP" style="width:30%"><input class="field" id="adCoins" placeholder="Münzen" style="width:30%"><input class="field" id="adJok" placeholder="Joker" style="width:30%"></div>
        <div class="row" style="margin-top:8px"><button class="btn small gold" data-a="give">Geben</button><button class="btn small red" data-a="ban">Sperren</button><button class="btn small dark" data-a="unban">Entsperren</button></div>
        <label class="lbl">Neues Passwort</label><div class="row"><input class="field" id="adPw" style="flex:1"><button class="btn small" data-a="password">Setzen</button></div>
        <div class="row" style="margin-top:8px"><button class="btn small red" data-a="delete">Konto löschen</button></div></div>
      <div class="card"><h3>Server</h3><label class="lbl">Nachricht an alle (sofort)</label><input class="field" id="adText">
        <div class="row" style="margin-top:8px"><button class="btn small gold" data-a="announce">Senden</button><button class="btn small" data-a="motd">Als Nachricht des Tages</button></div>
        <div class="row" style="margin-top:8px"><button class="btn small red" data-a="mainton">Wartung an</button><button class="btn small dark" data-a="maintoff">Wartung aus</button></div></div>
    </div>
    <div class="card" style="margin-top:12px"><div class="admin-out" id="adOut">Code eingeben und „Status“ drücken.</div></div></div>`, () => unsub());
  const unsub = live.on((m) => { if (m.t === 'adminRes' && pending.has(m.req)) { pending.get(m.req)(m); pending.delete(m.req); } });
  const out = (x) => { $('#adOut').textContent = typeof x === 'string' ? x : JSON.stringify(x, null, 2); };
  $$('[data-a]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await connectLive())) return;
    const a = b.dataset.a, v = (id) => $(id).value.trim();
    const base = { code: $('#adCode').value, login: v('#adLogin') };
    const msg = {
      check: { action: 'check' }, overview: { action: 'overview' }, log: { action: 'log' },
      player: { action: 'player' }, search: { action: 'search', q: v('#adLogin') },
      give: { action: 'give', xp: +v('#adXp') || 0, coins: +v('#adCoins') || 0, jokers: +v('#adJok') || 0 },
      ban: { action: 'ban', on: true }, unban: { action: 'ban', on: false }, password: { action: 'password', password: v('#adPw') },
      delete: { action: 'delete' }, announce: { action: 'announce', text: v('#adText') }, motd: { action: 'motd', text: v('#adText') },
      mainton: { action: 'maintenance', on: true, text: v('#adText') }, maintoff: { action: 'maintenance', on: false },
    }[a];
    if (a === 'delete' && !confirm(`Konto „${base.login}“ wirklich für immer löschen?`)) return;
    const id = ++req;
    pending.set(id, (m) => { const { t, req: _r, ...rest } = m; out(rest); if (m.error) sfx.wrong(); else sfx.click(); });
    live.send({ t: 'admin', req: id, ...base, ...msg });
  }));
}

// ================= Start =================
async function boot() {
  if (!session.token) return authView('signup');
  const r = await api('GET', '/api/me');
  if (r.status === 200) { setData(r.data); home(); }
  else if (r.status === 0) { app.innerHTML = `<div class="boot">KOMMANDO-QUIZ<small>Keine Verbindung zum Server. <a href="" style="color:var(--gold)">Nochmal versuchen</a></small></div>`; }
  else { session.token = ''; authView('login'); }
}
boot();
