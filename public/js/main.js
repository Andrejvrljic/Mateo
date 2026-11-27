// Kommando-Quiz – Oberfläche: Startbildschirm, Welten-Auswahl, 3D-Welt mit Druckplatten,
// Quiz, Quiz-Duell, Gefecht, Minispiele, Shop, Medaillen, Rangliste, Lexikon, Einstellungen, Admin
import { api, session, live } from './net.js';
import { $, $$, esc, fmt, toast } from './ui.js';
import { sfx, isMuted, setMuted } from './audio.js';
import { rankBadge, skinPreview } from './draw.js';
import { createStage } from './stage.js';
import { createWorld } from './world3d.js';
import { startBattle3d } from './battle3d.js';
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
let world = null;      // aktuelle 3D-Welt
let current = '';

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
  if (world && d.profile) world.setSkin(d.profile.skin);
}
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  sfx.click();
  const r = { home, settings, account, play, admin, world: returnToWorld };
  (r[b.dataset.go] || home)();
});
const backHome = '<button class="back" data-go="home">← Startbildschirm</button>';
const backWorld = '<button class="back" data-go="world">← Zurück in die Welt</button>';

// Live-Nachrichten, die überall ankommen
live.on((m) => {
  if (m.t === 'announce') { toast('📢 ' + m.text, 'gold'); sfx.coin(); }
  if (m.t === 'profile') { setData(m); if (current === 'home') home(); }
  if (m.t === 'kicked') { session.token = ''; toast('Dein Konto wurde gesperrt.', 'err'); setTimeout(() => location.reload(), 1500); }
});

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

// ================= Anmelden =================
function authView(mode = 'signup', msg = '') {
  current = 'auth';
  show(`<div class="auth">
    <div class="logo">KOMMANDO<span>QUIZ</span></div>
    <p class="tagline">Militär-Quiz · Minispiele · Gefecht 5 gegen 5 · 3D-Welt mit Freunden</p>
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
    live.close();
    sfx.right();
    home();
  });
}

// ================= Startbildschirm =================
async function claimDaily() {
  if (S.profile.daily.day === dayString()) return;
  const r = await api('POST', '/api/action', { type: 'daily' });
  if (r.status !== 200) return;
  setData(r.data);
  toast(`📅 Dienstantritt Tag ${r.data.result.streak}: +${r.data.result.coins} Münzen, +${r.data.result.xp} EP${r.data.result.joker ? ', +1 Joker' : ''}`, 'gold');
  announceExtras(r.data.result);
  if (current === 'home') home();
}

function home() {
  current = 'home';
  if (world) leaveWorld();
  const p = S.profile, r = rankInfo(p.xp), n = S.news || {};
  show(`<div class="start">
    <div class="logo">KOMMANDO<span>QUIZ</span></div>
    <div class="start-me">${rankBadge(r.i, 46)}<div><b>${esc(p.name)}</b><br><span class="rank">${r.name}</span></div><span class="spacer"></span><span class="pill gold">🪙 ${fmt(p.coins)}</span></div>
    ${n.maintenance ? `<div class="banner warn">🛠️ ${esc(n.maintenance.text)}</div>` : ''}
    ${n.motd ? `<div class="banner">📢 ${esc(n.motd)}</div>` : ''}
    <button class="btn gold play-btn" data-go="play">▶ SPIELEN</button>
    <div class="start-row"><button class="btn dark" data-go="settings">⚙️ Einstellungen</button><button class="btn dark" data-go="account">👤 Konto</button></div>
  </div>`);
  claimDaily();
}

function settings() {
  current = 'settings';
  const gfxLow = (() => { try { return localStorage.getItem('kq-gfx') === 'low'; } catch { return false; } })();
  show(`<div class="wrap" style="max-width:560px">${backHome}
    <div class="title-bar"><h2>⚙️ Einstellungen</h2></div>
    <div class="card list">
      <div class="li"><b>Ton</b><span class="spacer"></span><button class="btn small ${isMuted() ? 'dark' : ''}" id="sMute">${isMuted() ? '🔇 Aus' : '🔊 An'}</button></div>
      <div class="li"><b>Grafik</b><span class="spacer"></span><button class="btn small ${gfxLow ? 'dark' : ''}" data-gfx="high">Schön</button><button class="btn small ${gfxLow ? '' : 'dark'}" data-gfx="low">Schnell</button></div>
      <div class="li" style="flex-direction:column;align-items:flex-start"><b>Steuerung</b><span class="muted" style="font-size:14px">PC: <b>WASD</b> laufen · Maus ziehen = Kamera · Mausrad = Zoom · Leertaste = springen<br>Handy/Tablet: linker Daumen laufen · rechter Daumen Kamera / zielen</span></div>
    </div>
    ${S.account.admin ? '<button class="btn dark" data-go="admin" style="margin-top:14px">🛠️ Admin-Bereich</button>' : ''}
  </div>`);
  $('#sMute').addEventListener('click', () => { setMuted(!isMuted()); settings(); });
  $$('[data-gfx]').forEach((b) => b.addEventListener('click', () => { try { localStorage.setItem('kq-gfx', b.dataset.gfx); } catch { /* egal */ } settings(); }));
}

function account() {
  current = 'account';
  const p = S.profile, r = rankInfo(p.xp);
  show(`<div class="wrap" style="max-width:560px">${backHome}
    <div class="title-bar"><h2>👤 Konto</h2></div>
    <div class="card">
      <div class="row">${rankBadge(r.i)}<div><b style="font-size:20px">${esc(S.account.login)}</b><br><span class="muted">${r.name} · ${fmt(p.xp)} EP · Platz ${S.account.place}</span></div></div>
      <div class="xpbar"><i style="width:${Math.round(r.progress * 100)}%"></i></div>
      <div class="xptext">${r.next ? `Nächster Rang: ${r.nextName} bei ${fmt(r.next)} EP` : 'Höchster Rang!'}</div>
      <div class="rewards" style="justify-content:flex-start"><span class="pill gold">🪙 ${fmt(p.coins)}</span><span class="pill">🃏 ${p.jokers} Joker</span><span class="pill">🏅 ${p.medals.length} Medaillen</span><span class="pill">📅 ${p.daily.streak} Tage</span></div>
      <button class="btn red" id="aOut" style="margin-top:8px">Abmelden</button>
    </div>
    <p class="muted" style="font-size:14px">Shop, Medaillen, Rangliste und Lexikon findest du in der Welt – geh einfach auf die gelben Platten in der Mitte.</p>
  </div>`);
  $('#aOut').addEventListener('click', async () => { await api('POST', '/api/logout'); session.token = ''; live.close(); authView('login'); });
}

// ================= Welten-Auswahl =================
async function connectLive() {
  try { await live.connect(); return true; } catch (e) { toast(e.message || 'Keine Verbindung', 'err'); return false; }
}
async function play() {
  current = 'play';
  show(`<div class="wrap" style="max-width:760px">${backHome}
    <div class="title-bar"><h2>🌍 Welt auswählen</h2></div>
    <div class="section-h">SERVER – ZUSAMMEN SPIELEN</div>
    <div class="list" id="srvList"><p class="muted">Lade Server …</p></div>
    <div class="section-h">EIGENE WELTEN</div>
    <div class="grid">
      <button class="tile" id="wSolo"><span class="ic">🏕️</span><b>Eigene Welt</b><span>Allein spielen – nur du in der Kaserne</span></button>
      <div class="tile"><span class="ic">🔒</span><b>Server mit Code</b><span>Eigener Server – Freunde kommen mit dem Code rein</span><input class="field" id="wName" maxlength="24" placeholder="Name (z. B. Mateos Kaserne)"><button class="btn" id="wCreate">Erstellen</button></div>
      <div class="tile"><span class="ic">🔑</span><b>Mit Code beitreten</b><span>Code von deinem Freund</span><input class="field" id="wCode" maxlength="4" placeholder="CODE" style="text-transform:uppercase;letter-spacing:4px;font-weight:800"><button class="btn" id="wJoin">Beitreten</button></div>
    </div>
  </div>`);
  $('#wSolo').addEventListener('click', () => enterWorld({ solo: true }));
  $('#wCreate').addEventListener('click', () => enterWorld({ create: true, name: $('#wName').value.trim() }));
  $('#wJoin').addEventListener('click', () => { const c = $('#wCode').value.trim(); if (c.length === 4) enterWorld({ code: c }); else toast('Der Code hat 4 Zeichen.', 'err'); });
  if (!(await connectLive())) { $('#srvList').innerHTML = '<p class="muted">Keine Verbindung zum Server.</p>'; return; }
  const off = live.on((m) => {
    if (m.t !== 'worlds' || current !== 'play') return;
    off();
    $('#srvList').innerHTML = m.list.map((s) => `<button class="li srv" data-srv="${s.id}"><span style="font-size:26px">🌐</span><b>${esc(s.name)}</b><span class="spacer"></span><span class="pill">👥 ${s.players}/${s.max}</span><span class="btn small">Beitreten</span></button>`).join('');
    $$('[data-srv]').forEach((b) => b.addEventListener('click', () => enterWorld({ server: b.dataset.srv })));
  });
  live.send({ t: 'worlds' });
}

// ================= 3D-Welt =================
let worldOff = null;
async function enterWorld(msg) {
  if (!(await connectLive())) return;
  sfx.click();
  if (worldOff) worldOff();
  worldOff = live.on(onWorldMsg);
  live.send({ t: 'wjoin', ...msg });
}
function leaveWorld() {
  if (worldOff) { worldOff(); worldOff = null; }
  if (world) { world.destroy(); world = null; }
  live.send({ t: 'wleave' });
}
function onWorldMsg(m) {
  if (m.t === 'wjoined') {
    if (world) world.destroy();
    show('');
    current = 'world';
    world = createWorld({
      me: { key: m.you, name: S.profile.name, skin: S.profile.skin }, info: m.world, x: m.x, z: m.z,
      onMenu: worldMenu, onInfo: openInfo,
    });
    if (m.world.code) toast(`🔒 Dein Server-Code: ${m.world.code} – gib ihn deinen Freunden!`, 'gold');
  } else if (m.t === 'error' && !world) { toast(m.msg, 'err'); }
  else if (m.t === 'error') toast(m.msg, 'err');
  else if (m.t === 'wkicked') { toast(m.msg, 'err'); leaveWorld(); home(); }
  else if (m.t === 'closed') { if (world) { toast('Verbindung zum Server getrennt.', 'err'); leaveWorld(); home(); } }
  else if (m.t === 'launch') {
    hideWorld();
    if (m.game === 'quiz') soloQuiz(m.cat, m.n);
    else if (MINI[m.game]) playMini(MINI[m.game], m.group, m.players);
  } else if (m.t === 'qstart') { hideWorld(); duelMsg(m); }
  else if (['q', 'answered', 'reveal', 'qend'].includes(m.t)) duelMsg(m);
  else if (m.t === 'bstart') { hideWorld(); battle(m); }
  else if (m.t === 'gresult') groupResult(m);
}
function hideWorld() { if (world) world.hide(); current = 'game'; }
function returnToWorld() {
  if (screenCleanup) { try { screenCleanup(); } catch { /* egal */ } screenCleanup = null; }
  app.innerHTML = '';
  live.send({ t: 'back' });
  if (world) { world.show(); current = 'world'; } else home();
}
function worldMenu() {
  sfx.click();
  const o = world.stage.overlay(`<h2 style="text-align:center">☰ Menü</h2>
    <div class="list" style="margin-top:12px">
      <button class="btn" id="mBack">▶ Weiterspielen</button>
      <button class="btn dark" id="mSound">${isMuted() ? '🔇 Ton ist aus' : '🔊 Ton ist an'}</button>
      <button class="btn red" id="mLeave">Welt verlassen</button>
    </div>`);
  o.querySelector('#mBack').onclick = () => o.remove();
  o.querySelector('#mSound').onclick = () => { setMuted(!isMuted()); o.remove(); };
  o.querySelector('#mLeave').onclick = () => { leaveWorld(); home(); };
}
function openInfo(id) {
  hideWorld();
  ({ shop, ranks: leaderboard, medals, lexicon }[id] || returnToWorld)();
}

// ================= Solo-Quiz =================
async function soloQuiz(cat, n = 10) {
  const r = await api('POST', '/api/quiz/start', { cat, n });
  if (r.status !== 200) { toast(r.data.error || 'Fehler', 'err'); return returnToWorld(); }
  const { run, questions } = r.data;
  let jokers = r.data.jokers, i = 0, total = 0, timer = null, locked = false;
  const stop = () => clearInterval(timer);
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
    const t0 = performance.now(), bar = $('#qBar');
    stop();
    let lastSec = QUIZ_TIME;
    timer = setInterval(() => {
      const left = QUIZ_TIME - (performance.now() - t0) / 1000;
      bar.style.transform = `scaleX(${Math.max(0, left / QUIZ_TIME)})`;
      bar.style.backgroundPosition = `${(1 - left / QUIZ_TIME) * 100}% 0`;
      if (left < 5 && Math.ceil(left) < lastSec) { lastSec = Math.ceil(left); sfx.tick(); }
      if (left <= 0) { stop(); answer(-1); }
    }, 50);
    $('#qQuit').addEventListener('click', () => { stop(); returnToWorld(); });
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
    if (a.status !== 200) { toast(a.data.error || 'Fehler', 'err'); return returnToWorld(); }
    $(`.ans[data-k="${a.data.right}"]`).classList.add('right');
    if (!a.data.correct && c >= 0) $(`.ans[data-k="${c}"]`).classList.add('wrong');
    a.data.correct ? sfx.right() : sfx.wrong();
    total = a.data.total;
    $('#qFact').innerHTML = `<div class="fact">${a.data.correct ? `✅ Richtig! +${a.data.points} Punkte` : c < 0 ? '⏰ Zeit abgelaufen!' : '❌ Leider falsch.'}${a.data.fact ? `<br>💡 ${esc(a.data.fact)}` : ''}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="qNext">${a.data.done ? 'ERGEBNIS' : 'WEITER →'}</button></div>`;
    $('#qNext').addEventListener('click', () => { if (a.data.done) { setData(a.data); quizResult(a.data.reward); } else { i++; view(); } });
    $('#qNext').focus();
  }
  view();
}
function quizResult(res) {
  const grade = res.correct === res.total ? 'Ausgezeichnet!' : res.correct >= res.total * 0.7 ? 'Sehr gut!' : res.correct >= res.total * 0.4 ? 'Gut gemacht!' : 'Weiter üben, Soldat!';
  show(`<div class="wrap"><div class="quiz card">
    <div class="result-big"><div class="muted">${grade}</div><div class="num">${res.correct}/${res.total}</div><div>richtige Antworten · ${fmt(res.points)} Punkte</div></div>
    ${rewardHTML(res)}
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn gold big" data-go="world">Zurück in die Welt</button></div>
  </div></div>`);
  res.correct === res.total ? sfx.win() : sfx.coin();
}

// ================= Quiz-Duell (von der Druckplatte) =================
let duel = null;
function duelMsg(m) {
  if (m.t === 'qstart') {
    duel = { players: m.players, scores: Object.fromEntries(m.players.map((p) => [p.key, 0])), answered: new Set(), picked: -1, timer: null };
    show(`<div class="wrap"><div class="quiz"><div class="result-big"><div class="num">QUIZ-DUELL!</div><div>${m.n} Fragen · ${m.players.map((p) => esc(p.name)).join(' vs. ')}</div></div></div></div>`);
    sfx.win();
  } else if (m.t === 'q' && duel) {
    duel.answered = new Set(); duel.picked = -1;
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
    $('#qQuit').addEventListener('click', () => { live.send({ t: 'leave' }); duel = null; returnToWorld(); });
  } else if (m.t === 'answered' && duel) { duel.answered.add(m.key); chips(); }
  else if (m.t === 'reveal' && duel) {
    clearInterval(duel.timer);
    $$('.ans').forEach((x) => { x.disabled = true; });
    const r = $(`.ans[data-k="${m.right}"]`); if (r) r.classList.add('right');
    if (duel.picked >= 0 && duel.picked !== m.right) $(`.ans[data-k="${duel.picked}"]`)?.classList.add('wrong');
    duel.picked === m.right ? sfx.right() : sfx.wrong();
    for (const s of m.scores) duel.scores[s.key] = s.score;
    duel.answered = new Set();
    chips(m.scores);
    const f = $('#qFact'); if (f) f.innerHTML = m.fact ? `<div class="fact">💡 ${esc(m.fact)}</div>` : '';
  } else if (m.t === 'qend' && duel) {
    duel = null;
    setData(m);
    show(`<div class="wrap"><div class="quiz card">
      <h2 style="text-align:center">🏁 Ergebnis</h2>
      <div class="list" style="margin:14px 0">${m.ranking.map((p) => `<div class="li top${p.place} ${p.name === S.profile.name ? 'me' : ''}"><span class="pos">${p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : p.place === 3 ? '🥉' : p.place}</span><b>${esc(p.name)}</b><span class="spacer"></span><span class="muted">${p.correct} richtig</span><span class="val">${fmt(p.score)}</span></div>`).join('')}</div>
      ${m.reward ? `<p style="text-align:center;font-weight:800">${m.reward.won ? '🏆 Du hast das Duell gewonnen!' : `Platz ${m.reward.place}`}</p>` : ''}
      ${rewardHTML(m.reward)}
      <div class="row" style="justify-content:center"><button class="btn gold big" data-go="world">Zurück in die Welt</button></div>
    </div></div>`);
    m.reward && m.reward.won ? sfx.win() : sfx.coin();
    announceExtras(m.reward && { medals: [], rankUp: m.reward.rankUp });
  }
}
function chips(scores) {
  const el = $('#chips'); if (!el || !duel) return;
  el.innerHTML = duel.players.map((p) => {
    const s = scores && scores.find((x) => x.key === p.key);
    return `<span class="chip ${duel.answered.has(p.key) ? 'done' : ''}">👤 ${esc(p.name)} <span class="pts">${fmt(duel.scores[p.key] || 0)}</span>${s && s.pts ? ` <span style="color:#7fd17f">+${s.pts}</span>` : ''}${duel.answered.has(p.key) ? ' ✓' : ''}</span>`;
  }).join('');
}

// ================= Gefecht =================
function battle(m) {
  startBattle3d({
    roster: m.roster, you: m.you, mode: m.mode, colors: m.colors, win: m.win,
    onExit: (err) => { if (err) toast(err, 'err'); returnToWorld(); },
    onEnd: ({ reward, data, box }) => { setData(data); box.innerHTML = reward ? rewardHTML(reward) : ''; announceExtras(reward && { medals: [], rankUp: reward.rankUp }); },
  });
}

// ================= Minispiele =================
let miniBox = null;
function playMini(mod, group = null, players = []) {
  let game = null, ended = false, running = false;
  const stage = createStage({ sticks: mod.sticks, onExit: () => { if (game && game.destroy) game.destroy(); stage.destroy(); if (group) live.send({ t: 'gscore', group, score: 0 }); returnToWorld(); } });
  const begin = () => {
    if (game && game.destroy) game.destroy();
    game = mod.create(stage, { skin: S.profile.skin });
    ended = false; running = false;
    const o = stage.overlay(`<h2>${GAMES[mod.id].icon} ${GAMES[mod.id].name}</h2>
      ${group ? `<div class="banner">🏁 Wettkampf mit: <b>${players.map(esc).join(', ')}</b></div>` : ''}
      <div class="help">${mod.help}</div>
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
    const wasGroup = group;
    if (group) { live.send({ t: 'gscore', group, score }); group = null; }
    const o = stage.overlay(`<div class="result-big"><div class="muted">${GAMES[mod.id].name}</div><div class="num">${fmt(score)}</div><div>Punkte</div></div>
      <div id="gGroup">${wasGroup ? '<p class="muted" style="text-align:center">Warte auf die anderen …</p>' : ''}</div>
      <div id="gRew"><p class="muted" style="text-align:center">Wird gutgeschrieben …</p></div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn gold" id="gBack">Zurück in die Welt</button>${wasGroup ? '' : '<button class="btn dark" id="gAgain">Nochmal</button>'}</div>`);
    miniBox = o.querySelector('#gGroup');
    o.querySelector('#gBack').addEventListener('click', () => { miniBox = null; if (game.destroy) game.destroy(); stage.destroy(); returnToWorld(); });
    o.querySelector('#gAgain')?.addEventListener('click', () => { o.remove(); begin(); });
    const r = await api('POST', '/api/action', { type: 'game', game: mod.id, score, won: !!game.won });
    const box = o.querySelector('#gRew');
    if (r.status !== 200) { box.innerHTML = `<p class="muted" style="text-align:center">${esc(r.data.error || 'Keine Belohnung')}</p>`; return; }
    setData(r.data);
    box.innerHTML = (r.data.result.record ? '<div class="rankup">🏆 NEUER REKORD!</div>' : '') + rewardHTML(r.data.result);
    sfx.coin();
  }
  begin();
}
function groupResult(m) {
  const html = `<div class="list">${m.ranking.map((p, i) => `<div class="li top${i + 1}"><span class="pos">${p.score === null ? '…' : i + 1}</span><b>${esc(p.name)}</b><span class="spacer"></span><span class="val">${p.score === null ? 'spielt noch' : p.score < 0 ? 'aufgegeben' : fmt(p.score)}</span></div>`).join('')}</div>`;
  if (miniBox && document.body.contains(miniBox)) miniBox.innerHTML = `<h3 style="margin:8px 0">🏁 Wettkampf</h3>${html}`;
  else if (m.done) toast(`🏁 ${GAMES[m.game].name}: Sieger ist ${m.ranking[0].name} (${fmt(m.ranking[0].score)})`, 'gold');
}

// ================= Shop =================
function shop() {
  current = 'info';
  const p = S.profile;
  show(`<div class="wrap">${backWorld}
    <div class="title-bar"><h2>🎨 Shop</h2><span class="pill gold">🪙 ${fmt(p.coins)}</span></div>
    <div class="card row" style="margin-bottom:14px"><span style="font-size:36px">🃏</span><div class="spacer"><b>50:50-Joker</b><br><span class="muted">Entfernt im Quiz zwei falsche Antworten. Du hast ${p.jokers}.</span></div>
      <button class="btn gold" data-buy="joker" ${p.coins < JOKER_PRICE ? 'disabled' : ''}>🪙 ${JOKER_PRICE}</button></div>
    <h3 style="margin:8px 0 10px">Tarnmuster – dein Skin in der Welt und im Gefecht</h3>
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
  current = 'info';
  const p = S.profile;
  show(`<div class="wrap">${backWorld}
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
  current = 'info';
  const r = await api('GET', '/api/leaderboard?board=' + board);
  const top = r.data.top || [];
  show(`<div class="wrap">${backWorld}
    <div class="title-bar"><h2>🏆 Rangliste</h2>${board === 'xp' ? `<span class="pill">Dein Platz: ${S.account.place}</span>` : ''}</div>
    <div class="tabsbar">${Object.entries(BOARD_NAMES).map(([k, n]) => `<button data-b="${k}" class="${k === board ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="list">${top.length ? top.map((x, i) => `<div class="li top${i + 1} ${x.name === S.profile.name ? 'me' : ''}"><span class="pos">${i + 1}</span><b>${esc(x.name)}</b>${board === 'xp' ? `<span class="muted">${rankInfo(x.value).name}</span>` : ''}<span class="spacer"></span><span class="val">${fmt(x.value)}${board === 'xp' ? ' EP' : board === 'battle' ? ' Treffer' : ''}</span></div>`).join('') : '<p class="muted">Noch keine Einträge – sei der Erste!</p>'}</div>
  </div>`);
  $$('[data-b]').forEach((b) => b.addEventListener('click', () => leaderboard(b.dataset.b)));
}

// ================= Lexikon =================
function lexicon() {
  current = 'info';
  show(`<div class="wrap">${backWorld}
    <div class="title-bar"><h2>📖 Lexikon</h2></div>
    <div class="grid">${LEXICON.map((e) => `<div class="card lex"><div class="row"><span class="ic">${e.icon}</span><div><b style="font-family:var(--stencil);font-size:18px">${esc(e.name)}</b><br><span class="muted">${esc(e.type)} · ${esc(e.land)}</span></div></div>
      <dl>${e.facts.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl><div style="font-size:14px">${esc(e.text)}</div></div>`).join('')}</div>
  </div>`);
}

// ================= Admin =================
async function admin() {
  current = 'admin';
  if (!(await connectLive())) return;
  let req = 0;
  const pending = new Map();
  show(`<div class="wrap"><button class="back" data-go="settings">← Einstellungen</button>
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
  $$('[data-a]').forEach((b) => b.addEventListener('click', () => {
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
    pending.set(id, (m) => { const { t: _t, req: _r, ...rest } = m; out(rest); if (m.error) sfx.wrong(); else sfx.click(); });
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
