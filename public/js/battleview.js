// Gefecht 5 gegen 5: Anzeige und Steuerung – offline (Simulation im Browser) oder online (Server-Snapshots)
import { createStage } from './stage.js';
import { createBattle, step, snapshot, roster as getRoster, results, outcomeFor, unitById, RECTS, W, H, DT, TEAM_NAMES, SOLDIER, TANK, WIN_KILLS } from '../shared/battle.js';
import { drawTank, drawSoldier } from './draw.js';
import { sfx } from './audio.js';
import { live } from './net.js';
import { esc } from './ui.js';

const TEAM_COL = ['#4f8fd9', '#d9534f'];
const TEAM_DARK = ['#2c5a96', '#963431'];

let groundPat = null;
function ground(g) {
  if (!groundPat) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#5e7438'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.04)'; x.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 1 + Math.random() * 2); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(110,90,50,.18)'; x.beginPath(); x.ellipse(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 10, 3 + Math.random() * 6, Math.random(), 0, 7); x.fill(); }
    groundPat = g.createPattern(c, 'repeat');
  }
  return groundPat;
}

// opts: { mode: 'offline'|'online', name, skin, roster, you, onEnd(result), onExit() }
export function startBattle(opts) {
  const stage = createStage({ sticks: true, onExit: () => { cleanup(); opts.onExit(); } });
  const hud = stage.hud;
  hud.innerHTML = `<div class="hud-top"><span class="pill" id="bScore"></span><span class="pill" id="bTime"></span></div>
    <div class="feed" id="bFeed"></div><div class="hud-center"><div class="big-text" id="bBig"></div></div>
    <button class="tbtn hidden" id="bUse" style="right:24px;bottom:calc(190px + var(--safe-b))">PANZER</button>
    <div class="hint" id="bHint">PC: <b>WASD</b> laufen · <b>Maus</b> zielen · <b>Klick</b> schießen · <b>E</b> in den Panzer</div>`;
  const $ = (id) => hud.querySelector('#' + id);
  const useBtn = $('bUse');
  let usePressed = false;
  useBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); usePressed = true; });
  setTimeout(() => { const h = $('bHint'); if (h) h.style.opacity = '0'; }, 7000);
  $('bHint').style.transition = 'opacity 1s';

  let rost = opts.roster, you = opts.you, st = null, unsub = null, inputTimer = null, ended = false;
  let prev = null, cur = null, curAt = 0;
  const fxList = [], feed = [];

  function pushSnap(s) {
    prev = cur; cur = s; curAt = performance.now();
    if (!prev) prev = s;
    if (s.b.filter((b) => !b[2]).length > prev.b.filter((b) => !b[2]).length) sfx.shot();
    for (const f of s.fx || []) handleFx(f);
  }

  if (opts.mode === 'offline') {
    st = createBattle([{ name: opts.name, human: true, skin: opts.skin, key: 'me', team: 0 }]);
    rost = getRoster(st);
    you = st.units.find((u) => u.human).id;
    pushSnap(snapshot(st));
  } else {
    unsub = live.on((m) => {
      if (m.t === 's') pushSnap(m);
      else if (m.t === 'bend') finish(m.results, m.reward, m);
      else if (m.t === 'closed' && !ended) { cleanup(); opts.onError?.('Verbindung zum Server getrennt.'); }
    });
    inputTimer = setInterval(() => { const i = readInput(); live.send({ t: 'in', ...i }); }, DT * 1000);
  }
  const nameOf = (id) => (rost.find((r) => r.id === id) || {}).name || '?';
  const teamOf = (id) => (rost.find((r) => r.id === id) || {}).team;
  const myTeam = teamOf(you);

  function handleFx(f) {
    if (f.k === 'kill') {
      const killer = f.a ? nameOf(f.a) : '';
      feed.unshift({ html: `${f.a ? `<span class="t${teamOf(f.a)}">${esc(killer)}</span> ${f.w === 'tank' ? '💥' : '🔫'} ` : '💀 '}<span class="t${teamOf(f.v)}">${esc(nameOf(f.v))}</span>`, t: performance.now() });
      if (feed.length > 5) feed.pop();
      if (f.a === you) sfx.hit();
      renderFeed();
    } else if (f.k === 'boom' || f.k === 'tankboom') { fxList.push({ ...f, t: 0, big: f.k === 'tankboom' }); sfx.boom(); }
    else if (f.k === 'shot') { fxList.push({ ...f, t: 0 }); sfx.cannon(); }
    else if (f.k === 'hit' || f.k === 'spark') fxList.push({ ...f, t: 0 });
    else if (f.k === 'go') { big('LOS!', 900); sfx.win(); }
    else if (f.k === 'enter' && f.id === you) sfx.pop();
  }
  function renderFeed() { $('bFeed').innerHTML = feed.map((f) => `<div>${f.html}</div>`).join(''); }
  let bigTimer = null;
  function big(text, ms) { const b = $('bBig'); b.textContent = text; clearTimeout(bigTimer); if (ms) bigTimer = setTimeout(() => { b.textContent = ''; }, ms); }

  // Eingabe -> { mx, my, a, f, u }
  let lastAim = myTeam === 1 ? Math.PI : 0;
  function myPos() {
    if (!cur) return { x: 0, y: 0 };
    const u = cur.u.find((x) => x[0] === you);
    return u ? { x: u[1], y: u[2] } : { x: 0, y: 0 };
  }
  function readInput() {
    const m = stage.moveVec();
    let fire = false;
    if (stage.aim.active && stage.aim.mag > 0.2) { lastAim = Math.atan2(stage.aim.y, stage.aim.x); fire = stage.aim.mag > 0.45; }
    else if (stage.mouse.active && !stage.touch && cam) {
      const p = myPos();
      lastAim = Math.atan2((stage.mouse.y - cam.oy) / cam.k - p.y, (stage.mouse.x - cam.ox) / cam.k - p.x);
      fire = stage.mouse.down;
    }
    if (stage.keys.has(' ')) fire = true;
    const u = usePressed || stage.wasPressed('e', 'f');
    usePressed = false;
    return { mx: m.x, my: m.y, a: lastAim, f: fire, u };
  }

  let acc = 0, pendingUse = false, cam = null, touchHint = false;
  stage.frame = (dt, now) => {
    if (opts.mode === 'offline' && st && !ended) {
      const inp = readInput();
      if (inp.u) pendingUse = true;
      acc += dt;
      while (acc >= DT) {
        acc -= DT;
        step(st, { [you]: { ...inp, u: pendingUse } });
        pendingUse = false;
        pushSnap(snapshot(st));
        if (st.ph === 'end') { finish(results(st), null); break; }
      }
    } else if (opts.mode === 'online') {
      if (stage.wasPressed('e', 'f')) usePressed = true;
    }
    if (stage.touch && !touchHint) { touchHint = true; const hh = $('bHint'); if (hh) hh.innerHTML = 'Linker Daumen: <b>laufen</b> · Rechter Daumen: <b>zielen + schießen</b> · Panzer-Knopf erscheint am Panzer'; }
    draw(dt, now);
  };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpAng(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }

  function draw(dt, now) {
    const g = stage.g, w = stage.w, h = stage.h;
    if (!cur) { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); return; }
    const t = Math.min(1, (now - curAt) / (DT * 1000));
    const units = cur.u.map((u) => { const p = prev.u.find((x) => x[0] === u[0]) || u; const jump = Math.hypot(u[1] - p[1], u[2] - p[2]) > 3; return { id: u[0], x: jump ? u[1] : lerp(p[1], u[1], t), y: jump ? u[2] : lerp(p[2], u[2], t), a: lerpAng(p[3], u[3], t), hp: u[4], alive: u[5] & 1, inTank: u[5] & 2, inv: u[5] & 4, rt: u[6] }; });
    const tanks = cur.k.map((k, i) => { const p = prev.k[i] || k; const jump = Math.hypot(k[0] - p[0], k[1] - p[1]) > 3; return { team: i, x: jump ? k[0] : lerp(p[0], k[0], t), y: jump ? k[1] : lerp(p[1], k[1], t), a: lerpAng(p[2], k[2], t), ta: lerpAng(p[3], k[3], t), hp: k[4], alive: k[5], driver: k[6], skin: k[7], cd: k[8] }; });
    const me = units.find((u) => u.id === you) || units[0];
    const k = Math.sqrt(w * h / 600);
    let cx = me.x, cy = me.y;
    const vw = w / k, vh = h / k;
    cx = vw >= W ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, cx));
    cy = vh >= H ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, cy));
    cam = { k, ox: w / 2 - cx * k, oy: h / 2 - cy * k };
    g.fillStyle = '#2d3a1f'; g.fillRect(0, 0, w, h);
    g.save();
    g.translate(cam.ox, cam.oy); g.scale(k, k);
    // Boden
    g.save(); g.scale(1 / 12, 1 / 12); g.fillStyle = ground(g); g.fillRect(0, 0, W * 12, H * 12); g.restore();
    // Basen
    for (const tm of [0, 1]) { g.fillStyle = tm ? 'rgba(217,83,79,.13)' : 'rgba(79,143,217,.13)'; g.fillRect(tm ? W - 8 : 0, 0, 8, H); }
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.3; g.strokeRect(0, 0, W, H);
    // Hindernisse
    for (const r of RECTS) drawRect(g, r);
    // Panzer
    for (const tk of tanks) {
      if (!tk.alive) { g.fillStyle = 'rgba(20,20,20,.55)'; g.beginPath(); g.arc(tk.x, tk.y, 1.4, 0, 7); g.fill(); continue; }
      const recoil = Math.max(0, (tk.cd - (TANK.cd - 0.3)) / 0.3);
      drawTank(g, tk.x, tk.y, tk.a, tk.ta, TANK.r * 2.2, tk.skin, TEAM_COL[tk.team], recoil);
      bar(g, tk.x, tk.y - 2, 2.4, tk.hp / TANK.hp, tk.team === myTeam ? '#5cb85c' : '#d9534f');
    }
    // Soldaten
    for (const u of units) {
      if (!u.alive || u.inTank) continue;
      const team = teamOf(u.id);
      const shot = cur.b.some((b) => !b[2] && Math.hypot(b[0] - u.x, b[1] - u.y) < 1.1);
      g.globalAlpha = u.inv ? 0.55 + 0.3 * Math.sin(now / 60) : 1;
      drawSoldier(g, u.x, u.y, u.a, SOLDIER.r, team === 0 ? TEAM_COL[0] : TEAM_COL[1], (rost.find((r) => r.id === u.id) || {}).skin || 'oliv', shot);
      g.globalAlpha = 1;
      if (u.id === you) { g.strokeStyle = '#f5d474'; g.lineWidth = 0.08; g.beginPath(); g.arc(u.x, u.y, 0.75, 0, 7); g.stroke(); }
      bar(g, u.x, u.y - 0.95, 1.1, u.hp / SOLDIER.hp, team === myTeam ? '#5cb85c' : '#d9534f');
      g.font = '800 0.42px Barlow, sans-serif'; g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(nameOf(u.id), u.x + 0.03, u.y - 1.17);
      g.fillStyle = u.id === you ? '#f5d474' : '#fff'; g.fillText(nameOf(u.id), u.x, u.y - 1.2);
    }
    // Geschosse
    for (const b of cur.b) {
      if (b[2]) { g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(b[0], b[1], 0.22, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,200,100,.6)'; g.lineWidth = 0.14; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - Math.cos(b[3]) * 1.2, b[1] - Math.sin(b[3]) * 1.2); g.stroke(); }
      else { g.strokeStyle = '#ffe27a'; g.lineWidth = 0.1; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - Math.cos(b[3]) * 0.7, b[1] - Math.sin(b[3]) * 0.7); g.stroke(); }
    }
    // Effekte
    for (const f of fxList) {
      f.t += dt;
      if (f.k === 'boom' || f.k === 'tankboom') {
        const life = f.big ? 1.2 : 0.7, p = f.t / life, R = f.big ? 3.2 : 2.2;
        g.fillStyle = `rgba(255,${150 + 80 * (1 - p)},60,${Math.max(0, 1 - p * 1.4)})`; g.beginPath(); g.arc(f.x, f.y, R * (0.3 + p), 0, 7); g.fill();
        g.fillStyle = `rgba(50,48,45,${Math.max(0, 0.6 - p * 0.6)})`; g.beginPath(); g.arc(f.x + 0.4, f.y - p, R * 0.6 * (0.5 + p), 0, 7); g.fill();
        g.fillStyle = `rgba(30,25,20,${Math.max(0, 0.3 - p * 0.1)})`; g.beginPath(); g.arc(f.x, f.y, R * 0.5, 0, 7); g.fill();
      } else if (f.k === 'shot') { g.fillStyle = `rgba(255,220,120,${Math.max(0, 1 - f.t * 6)})`; g.beginPath(); g.arc(f.x, f.y, 0.7, 0, 7); g.fill(); }
      else { g.fillStyle = f.k === 'hit' ? `rgba(220,40,40,${Math.max(0, 1 - f.t * 5)})` : `rgba(255,240,180,${Math.max(0, 1 - f.t * 6)})`; g.beginPath(); g.arc(f.x, f.y, 0.25 + f.t, 0, 7); g.fill(); }
    }
    for (let i = fxList.length - 1; i >= 0; i--) if (fxList[i].t > 1.3) fxList.splice(i, 1);
    g.restore();

    // HUD
    const sc = cur.sc;
    $('bScore').innerHTML = `<span class="t0">BLAU ${sc[0]}</span>&nbsp;:&nbsp;<span class="t1">${sc[1]} ROT</span> <span class="muted" style="font-size:12px">/${WIN_KILLS}</span>`;
    $('bTime').textContent = `⏱ ${Math.floor(cur.tl / 60)}:${String(cur.tl % 60).padStart(2, '0')}`;
    if (cur.ph === 'count' && !ended) big(cur.cd > 0 ? String(cur.cd) : '', 0);
    else if (!me.alive && !ended) big(`Wieder da in ${me.rt}`, 0);
    else if (!ended && $('bBig').textContent.startsWith('Wieder')) big('', 0);
    // Panzer-Knopf / Hinweis
    const myTank = tanks[myTeam];
    const near = me.alive && myTank.alive && (me.inTank || (Math.hypot(myTank.x - me.x, myTank.y - me.y) < TANK.r + 1.4 && !(myTank.driver && myTank.driver !== you && (rost.find((r) => r.id === myTank.driver) || {}).human)));
    useBtn.classList.toggle('hidden', !near);
    useBtn.textContent = me.inTank ? 'AUS-STEIGEN' : 'PANZER (E)';
    useBtn.classList.toggle('on', !!me.inTank);
    if (near && !stage.touch && !me.inTank) { g.font = '800 16px Barlow, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#f5d474'; g.fillText('E drücken: in den Panzer steigen', w / 2, h - 30); }
    // Minikarte
    const mw = Math.min(170, w * (stage.touch ? 0.17 : 0.28)), mh = mw * H / W, mx = 64, my = 10 + (parseInt(getComputedStyle(document.body).getPropertyValue('--safe-t')) || 0);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(mx, my, mw, mh);
    g.fillStyle = 'rgba(255,255,255,.25)';
    for (const r of RECTS) g.fillRect(mx + r.x / W * mw, my + r.y / H * mh, Math.max(1, r.w / W * mw), Math.max(1, r.h / H * mh));
    for (const tk of tanks) if (tk.alive) { g.fillStyle = TEAM_COL[tk.team]; g.fillRect(mx + tk.x / W * mw - 3, my + tk.y / H * mh - 3, 6, 6); }
    for (const u of units) { if (!u.alive || u.inTank) continue; g.fillStyle = u.id === you ? '#f5d474' : TEAM_COL[teamOf(u.id)]; g.beginPath(); g.arc(mx + u.x / W * mw, my + u.y / H * mh, u.id === you ? 3 : 2, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.strokeRect(mx + (cx - vw / 2) / W * mw, my + (cy - vh / 2) / H * mh, vw / W * mw, vh / H * mh);
    stage.drawSticks();
  }

  function finish(res, reward, extra) {
    if (ended) return;
    ended = true;
    clearInterval(inputTimer);
    const meUnit = res.players.find((p) => p.id === you);
    const outcome = res.winner === -1 ? 'draw' : res.winner === meUnit.team ? 'win' : 'loss';
    big(outcome === 'win' ? 'SIEG!' : outcome === 'draw' ? 'UNENTSCHIEDEN' : 'NIEDERLAGE', 0);
    outcome === 'win' ? sfx.win() : sfx.lose();
    setTimeout(() => {
      $('bBig').textContent = '';
      const rows = [...res.players].sort((a, b) => a.team - b.team || b.kills - a.kills).map((p) => `<tr class="${p.id === you ? 'me' : ''}"><td class="t${p.team}">${esc(p.name)}${p.human ? ' 👤' : ''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.tk}</td></tr>`).join('');
      const o = stage.overlay(`<h2 style="text-align:center">${outcome === 'win' ? '🏆 SIEG' : outcome === 'draw' ? '🤝 UNENTSCHIEDEN' : '💀 NIEDERLAGE'}</h2>
        <p style="text-align:center;font-size:22px;font-weight:800"><span class="t0">${TEAM_NAMES[0]} ${res.score[0]}</span> : <span class="t1">${res.score[1]} ${TEAM_NAMES[1]}</span></p>
        <table class="res"><tr><th>Soldat</th><th>Treffer</th><th>Ausgeschieden</th><th>mit Panzer</th></tr>${rows}</table>
        <div id="bReward" style="margin-top:12px"></div>
        <div class="row" style="justify-content:center;margin-top:14px"><button class="btn dark" id="bBack">Zum Hauptquartier</button>${opts.mode === 'offline' ? '<button class="btn gold" id="bAgain">Nochmal</button>' : ''}</div>`);
      o.querySelector('#bBack').onclick = () => { cleanup(); opts.onExit(); };
      const again = o.querySelector('#bAgain');
      if (again) again.onclick = () => { cleanup(); opts.onAgain(); };
      opts.onEnd({ outcome, kills: meUnit.kills, tankKills: meUnit.tk, reward, extra, box: o.querySelector('#bReward') });
    }, 1800);
  }

  function cleanup() {
    clearInterval(inputTimer);
    if (unsub) unsub();
    if (opts.mode === 'online') live.send({ t: 'leave' });
    stage.destroy();
  }
  return { cleanup };
}

function bar(g, x, y, wd, p, col) {
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - wd / 2, y, wd, 0.16);
  g.fillStyle = col; g.fillRect(x - wd / 2, y, wd * Math.max(0, Math.min(1, p)), 0.16);
}

function drawRect(g, r) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(r.x + 0.25, r.y + 0.3, r.w, r.h);
  if (r.k === 'wall') {
    g.fillStyle = '#8b8e86'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = '#a3a69d'; g.fillRect(r.x, r.y, r.w, 0.25);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.06;
    for (let yy = r.y + 1; yy < r.y + r.h; yy += 1) { g.beginPath(); g.moveTo(r.x, yy); g.lineTo(r.x + r.w, yy); g.stroke(); }
    g.strokeRect(r.x, r.y, r.w, r.h);
  } else if (r.k === 'sand') {
    g.fillStyle = '#b59a63'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = '#c9ae74';
    const horiz = r.w > r.h;
    const n = Math.round((horiz ? r.w : r.h) / 0.8);
    for (let i = 0; i < n; i++) {
      const px = horiz ? r.x + (i + 0.5) * r.w / n : r.x + r.w / 2, py = horiz ? r.y + r.h / 2 : r.y + (i + 0.5) * r.h / n;
      g.beginPath(); g.ellipse(px, py, horiz ? r.w / n * 0.48 : r.w * 0.48, horiz ? r.h * 0.45 : r.h / n * 0.48, 0, 0, 7); g.fill();
    }
  } else {
    g.fillStyle = '#8a6136'; g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#5e3f1f'; g.lineWidth = 0.15; g.strokeRect(r.x + 0.1, r.y + 0.1, r.w - 0.2, r.h - 0.2);
    g.beginPath(); g.moveTo(r.x + 0.1, r.y + 0.1); g.lineTo(r.x + r.w - 0.1, r.y + r.h - 0.1); g.moveTo(r.x + r.w - 0.1, r.y + 0.1); g.lineTo(r.x + 0.1, r.y + r.h - 0.1); g.stroke();
  }
}

export { outcomeFor, unitById };
