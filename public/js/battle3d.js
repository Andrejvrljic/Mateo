// Gefecht 5 gegen 5 in 3D: Anzeige und Steuerung (Server schickt Zustände, wir schicken Eingaben)
import * as THREE from 'three';
import { createStage } from './stage.js';
import { makeSoldier, animateSoldier, makeTank, textSprite, makeSandbags, makeCrate, makeBuilding, mat } from './models3d.js';
import { RECTS, W, H, DT, WEAPONS, TANK, SOLDIER, ZONES, ZONE_R, PICKUPS, MODES } from '../shared/battle.js';
import { live } from './net.js';
import { esc } from './ui.js';
import { sfx } from './audio.js';
import { gfx } from './world3d.js';

const OX = -W / 2, OZ = -H / 2;
const P = (x, y, h = 0) => new THREE.Vector3(x + OX, h, y + OZ);

export function startBattle3d({ roster, you, mode, colors, win, onEnd, onExit }) {
  const stage = createStage({ sticks: true, webgl: true, onExit: () => { if (confirm('Gefecht wirklich verlassen? Ein Bot übernimmt deinen Platz.')) { cleanup(); onExit(); } } });
  const high = gfx.high;
  const renderer = new THREE.WebGLRenderer({ canvas: stage.glCanvas, antialias: high });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1));
  renderer.shadowMap.enabled = high; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9c9e0'); scene.fog = new THREE.Fog('#a9c9e0', 40, 90);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  stage.onResize = (w, h) => { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  stage.onResize(stage.w, stage.h);
  scene.add(new THREE.HemisphereLight('#e6f2ff', '#56653a', 1.15));
  const sun = new THREE.DirectionalLight('#fff1d0', 1.5);
  sun.position.set(20, 40, 15); sun.castShadow = high; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 35, bottom: -35, near: 1, far: 120 });
  scene.add(sun, sun.target);

  // Boden + Karte
  const gc = document.createElement('canvas'); gc.width = gc.height = 256;
  const gx = gc.getContext('2d'); gx.fillStyle = '#617b3b'; gx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { gx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,240,180,.05)'; gx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3); }
  for (let i = 0; i < 14; i++) { gx.fillStyle = 'rgba(120,95,55,.25)'; gx.beginPath(); gx.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 20, 6 + Math.random() * 10, Math.random(), 0, 7); gx.fill(); }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(10, 6); gt.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, H + 30), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  for (const t of [0, 1]) { const base = new THREE.Mesh(new THREE.PlaneGeometry(8, H), new THREE.MeshBasicMaterial({ color: colors[t], transparent: true, opacity: 0.16 })); base.rotation.x = -Math.PI / 2; base.position.copy(P(t ? W - 4 : 4, H / 2, 0.02)); scene.add(base); }
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.01, H)), new THREE.LineBasicMaterial({ color: '#2b3320' })); edge.position.y = 0.03; scene.add(edge);
  for (const r of RECTS) {
    const c = P(r.x + r.w / 2, r.y + r.h / 2);
    let m;
    if (r.k === 'wall') { m = new THREE.Mesh(new THREE.BoxGeometry(r.w, 2.4, r.h), mat('#9a9d95')); m.position.set(c.x, 1.2, c.z); m.castShadow = m.receiveShadow = true; }
    else if (r.k === 'sand') { m = makeSandbags(Math.max(r.w, r.h), 1.0); if (r.h > r.w) m.rotation.y = Math.PI / 2; m.position.copy(c); const n = Math.max(1, Math.round(Math.min(r.w, r.h) / 0.6)); for (let i = 1; i < n; i++) { const m2 = m.clone(); m2.position.add(r.h > r.w ? new THREE.Vector3(i * 0.5 - (n - 1) * 0.25, 0, 0) : new THREE.Vector3(0, 0, i * 0.5 - (n - 1) * 0.25)); scene.add(m2); } }
    else if (r.k === 'crate') { m = new THREE.Group(); const s = Math.min(r.w, r.h); for (const [dx, dz, y] of [[-0.25, -0.25, 0], [0.25, 0.25, 0], [0, 0, 1]]) { const cr = makeCrate(s * 0.55); cr.position.set(dx * s, s * 0.275 + y * s * 0.55, dz * s); m.add(cr); } m.position.copy(c); }
    else { m = makeBuilding(r.w, r.h, 3.2, '#b9b095', '#6b4a3a'); m.position.copy(c); }
    scene.add(m);
  }
  // Zonen
  const zoneObjs = [];
  if (mode === 'conquest') for (const z of ZONES) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(ZONE_R - 0.25, ZONE_R, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(P(z.x, z.y, 0.05)); scene.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(ZONE_R - 0.25, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12 }));
    fill.rotation.x = -Math.PI / 2; fill.position.copy(P(z.x, z.y, 0.04)); scene.add(fill);
    const letter = textSprite(z.id, { size: 1.6, color: '#fff', bg: 'rgba(0,0,0,.4)', font: '900 54px "Black Ops One", sans-serif' }); letter.position.copy(P(z.x, z.y, 4)); scene.add(letter);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), mat('#ddd')); pole.position.copy(P(z.x, z.y, 1.6)); scene.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshLambertMaterial({ color: '#fff', side: THREE.DoubleSide })); fl.position.copy(P(z.x + 0.6, z.y, 2.8)); scene.add(fl);
    zoneObjs.push({ ring, fill, fl });
  }
  // Pickups
  const pickObjs = PICKUPS.map((p) => {
    const g = new THREE.Group();
    if (p.k === 'med') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), mat('#f2f2f2')); g.add(b); const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.52), mat('#d0332c')); const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.52), mat('#d0332c')); g.add(c1, c2); }
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), mat('#56622f')); g.add(b); const s = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.52), mat('#e3b341')); g.add(s); }
    g.position.copy(P(p.x, p.y, 0.6)); scene.add(g);
    return g;
  });

  // Einheiten
  const rost = new Map(roster.map((r) => [r.id, r]));
  const myTeam = rost.get(you).team;
  const units = new Map();
  for (const r of roster) {
    const obj = makeSoldier(r.skin, colors[r.team]);
    const label = textSprite(r.name, { size: 0.34, color: r.id === you ? '#f5d474' : '#fff', bg: 'rgba(0,0,0,.45)' }); label.position.y = 2.25; obj.add(label);
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#000', opacity: 0.6, transparent: true, depthWrite: false })); bg.scale.set(1.1, 0.12, 1); bg.position.y = 2.0; obj.add(bg);
    const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: r.team === myTeam ? '#5cd65c' : '#ff5b5b', depthWrite: false })); fg.center.set(0, 0.5); fg.scale.set(1.06, 0.08, 1); fg.position.set(-0.53, 2.0, 0.01); obj.add(fg);
    if (r.id === you) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 32), new THREE.MeshBasicMaterial({ color: '#f5d474', side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; obj.add(ring); }
    scene.add(obj);
    units.set(r.id, { obj, fg, prev: null, cur: null });
  }
  const tanks = [0, 1].map((t) => ({ obj: null, skin: null, team: t }));
  function tankObj(i, skin) {
    const tk = tanks[i];
    if (tk.skin !== skin) { if (tk.obj) scene.remove(tk.obj); tk.obj = makeTank(skin, colors[i]); tk.skin = skin; scene.add(tk.obj); }
    return tk.obj;
  }
  // Geschoss-Pool
  const bulletGeo = new THREE.BoxGeometry(0.07, 0.07, 0.8), sniperGeo = new THREE.BoxGeometry(0.05, 0.05, 2.4), shellGeo = new THREE.SphereGeometry(0.2, 8, 6), rocketGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8);
  rocketGeo.rotateX(Math.PI / 2);
  const bMat = new THREE.MeshBasicMaterial({ color: '#ffe27a' }), sMat = new THREE.MeshBasicMaterial({ color: '#bff6ff' }), shMat = new THREE.MeshBasicMaterial({ color: '#222' }), rMat = new THREE.MeshBasicMaterial({ color: '#ff9a3c' });
  const pool = [];
  function bulletMesh(i, kind) {
    let m = pool[i];
    const geo = kind === 1 ? shellGeo : kind === 2 ? rocketGeo : kind === 3 ? sniperGeo : bulletGeo;
    const ma = kind === 1 ? shMat : kind === 2 ? rMat : kind === 3 ? sMat : bMat;
    if (!m) { m = new THREE.Mesh(geo, ma); pool[i] = m; scene.add(m); }
    m.geometry = geo; m.material = ma; m.visible = true;
    return m;
  }
  const nadePool = [];
  const fx = []; // { mesh, t, life, grow, kind }
  const boomGeo = new THREE.SphereGeometry(1, 16, 12);
  function addBoom(x, y, r = 2.6, big = false) {
    const fire = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 1 }));
    fire.position.copy(P(x, y, 0.6)); fire.scale.setScalar(0.3); scene.add(fire);
    fx.push({ mesh: fire, t: 0, life: big ? 0.9 : 0.55, grow: r * (big ? 1.3 : 0.9) });
    const smoke = new THREE.Mesh(boomGeo, new THREE.MeshLambertMaterial({ color: '#555', transparent: true, opacity: 0.7 }));
    smoke.position.copy(P(x, y, 1)); smoke.scale.setScalar(0.5); scene.add(smoke);
    fx.push({ mesh: smoke, t: 0, life: big ? 2 : 1.3, grow: r * 0.8, rise: 1.5 });
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 16), new THREE.MeshBasicMaterial({ color: '#1e1a14', transparent: true, opacity: 0.5 }));
    scorch.rotation.x = -Math.PI / 2; scorch.position.copy(P(x, y, 0.025)); scene.add(scorch);
    fx.push({ mesh: scorch, t: 0, life: 8, fade: true });
    const d = Math.hypot(x - myPos.x, y - myPos.y);
    if (d < 14) shake = Math.max(shake, (big ? 0.6 : 0.35) * (1 - d / 14));
  }
  function addSpark(x, y, color = '#fff2b0') {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true }));
    s.position.copy(P(x, y, 1.1)); scene.add(s);
    fx.push({ mesh: s, t: 0, life: 0.18, grow: 0.5 });
  }

  // HUD
  stage.hud.innerHTML = `<div class="hud-top"><span class="pill" id="bScore"></span><span class="pill" id="bTime"></span></div>
    <div class="b-zones" id="bZones"></div>
    <div class="feed" id="bFeed"></div><div class="hud-center"><div class="big-text" id="bBig"></div></div>
    <div class="b-vig" id="bVig"></div><div class="b-hit" id="bHit">✕</div>
    <div class="b-stats" id="bStats"></div>
    <div class="b-weapons" id="bWeap">${WEAPONS.map((w, i) => `<button data-w="${i}"><span>${w.icon}</span><small>${i + 1} ${w.name}</small><b id="bAm${i}"></b></button>`).join('')}</div>
    <div class="b-actions"><button class="tbtn" id="bNade">💣</button><button class="tbtn" id="bReload">🔄</button><button class="tbtn hidden" id="bUse">PANZER</button><button class="tbtn" id="bBoard">📋</button></div>
    <div class="overlay hidden" id="bBoardBox" style="pointer-events:none"></div>
    <div class="hint" id="bHint">PC: <b>WASD</b> laufen · <b>Maus</b> zielen + <b>Klick</b> schießen · <b>1–4</b> Waffe · <b>R</b> nachladen · <b>G</b> Granate · <b>E</b> Panzer · <b>Tab</b> Punkte</div>`;
  const $ = (id) => stage.hud.querySelector('#' + id);
  const hint = $('bHint'); if (matchMedia('(hover: none)').matches) hint.innerHTML = 'Linker Daumen: <b>laufen</b> · Rechter Daumen: <b>zielen + schießen</b> · Knöpfe: Waffe, Granate, Nachladen, Panzer'; hint.style.transition = 'opacity 1s'; setTimeout(() => { hint.style.opacity = '0'; }, 9000);
  const req = { u: false, r: false, g: false, w: -1, gd: 9 };
  let board = false;
  $('bWeap').addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-w]'); if (b) { e.preventDefault(); req.w = +b.dataset.w; sfx.click(); } });
  $('bNade').addEventListener('pointerdown', (e) => { e.preventDefault(); req.g = true; req.gd = 9; });
  $('bReload').addEventListener('pointerdown', (e) => { e.preventDefault(); req.r = true; });
  $('bUse').addEventListener('pointerdown', (e) => { e.preventDefault(); req.u = true; });
  $('bBoard').addEventListener('pointerdown', (e) => { e.preventDefault(); board = !board; });
  stage.canvas.style.cursor = 'crosshair';

  let prev = null, cur = null, curAt = 0, ended = false, shake = 0, hitT = 0, vig = 0, lastHp = 100;
  const feed = [];
  const myPos = { x: 0, y: 0 };
  let aimA = myTeam ? Math.PI : 0, curW = 0, zoom = 1;
  const nameOf = (id) => rost.get(id)?.name || '?';
  const teamOf = (id) => rost.get(id)?.team;
  const col = (t) => colors[t];

  const off = live.on((m) => {
    if (m.t === 's') {
      prev = cur || m; cur = m; curAt = performance.now();
      if (m.b.filter((b) => b[2] === 0 || b[2] === 3).length > prev.b.filter((b) => b[2] === 0 || b[2] === 3).length) sfx.shot();
      for (const f of m.fx || []) handleFx(f);
    } else if (m.t === 'bend') finish(m);
    else if (m.t === 'closed' && !ended) { cleanup(); onExit('Verbindung zum Server getrennt.'); }
  });
  function handleFx(f) {
    if (f.k === 'kill') {
      const w = { tank: '💥', rocket: '🚀', grenade: '💣', sniper: '🎯', rifle: '🔫' }[f.w] || '🔫';
      feed.unshift(`${f.a ? `<span style="color:${col(teamOf(f.a))}">${esc(nameOf(f.a))}</span> ${w} ` : '💀 '}<span style="color:${col(teamOf(f.v))}">${esc(nameOf(f.v))}</span>`);
      if (feed.length > 5) feed.pop();
      $('bFeed').innerHTML = feed.map((x) => `<div>${x}</div>`).join('');
      if (f.a === you) { sfx.coin(); big('AUSGESCHALTET!', 800, true); }
      if (f.v === you) sfx.lose();
    } else if (f.k === 'boom') { addBoom(f.x, f.y, f.r || 2.6); sfx.boom(); }
    else if (f.k === 'tankboom') { addBoom(f.x, f.y, 4, true); sfx.boom(); }
    else if (f.k === 'cannon') sfx.cannon();
    else if (f.k === 'hit') addSpark(f.x, f.y, '#ff4a4a');
    else if (f.k === 'spark') addSpark(f.x, f.y);
    else if (f.k === 'dmg' && f.a === you) { hitT = 0.15; sfx.hit(); }
    else if (f.k === 'go') { big('LOS!', 900); sfx.win(); }
    else if (f.k === 'cap') { big(`Zone ${f.z} erobert!`, 1200, true); sfx.coin(); }
    else if (f.k === 'pick' && f.id === you) { sfx.coin(); }
    else if (f.k === 'reloaded' && f.id === you) sfx.click();
    else if (f.k === 'enter' && f.id === you) sfx.pop();
  }
  let bigTimer = null;
  function big(text, ms, small) { const b = $('bBig'); b.textContent = text; b.style.fontSize = small ? 'clamp(22px,5vw,40px)' : ''; clearTimeout(bigTimer); if (ms) bigTimer = setTimeout(() => { b.textContent = ''; }, ms); }

  // Eingabe -> Server (20x pro Sekunde)
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  let fireTouch = false;
  const inputTimer = setInterval(() => {
    if (ended) return;
    const m = stage.moveVec();
    let f = false;
    if (stage.aim.active && stage.aim.mag > 0.2) { aimA = Math.atan2(stage.aim.y, stage.aim.x); f = stage.aim.mag > 0.45; }
    else if (!stage.touch && stage.mouse.active) {
      ndc.set(stage.mouse.x / stage.w * 2 - 1, -(stage.mouse.y / stage.h) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) { const tx = hit.x - OX, ty = hit.z - OZ; aimA = Math.atan2(ty - myPos.y, tx - myPos.x); req.gd = Math.hypot(tx - myPos.x, ty - myPos.y); }
      f = stage.mouse.down;
    }
    if (stage.keys.has(' ')) f = true;
    fireTouch = f;
    live.send({ t: 'in', mx: +m.x.toFixed(2), my: +m.y.toFixed(2), a: +aimA.toFixed(3), f, w: req.w, u: req.u, r: req.r, g: req.g, gd: +req.gd.toFixed(1) });
    req.u = req.r = req.g = false; req.w = -1;
  }, DT * 1000);

  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpA = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
  const camTarget = new THREE.Vector3();
  stage.frame = (dt, now) => {
    // Tasten
    for (let i = 0; i < 4; i++) if (stage.wasPressed(String(i + 1))) req.w = i;
    if (stage.mouse.wheel) { req.w = ((curW + stage.mouse.wheel) % 4 + 4) % 4; }
    if (stage.wasPressed('r')) req.r = true;
    if (stage.wasPressed('g')) req.g = true;
    if (stage.wasPressed('e', 'f')) req.u = true;
    const showBoard = stage.keys.has('tab') || board;
    if (!cur) { renderer.render(scene, camera); return; }
    const t = Math.min(1, (now - curAt) / (DT * 1000));
    // Einheiten
    for (let i = 0; i < cur.u.length; i++) {
      const u = cur.u[i], p = prev.u[i] && prev.u[i][0] === u[0] ? prev.u[i] : u;
      const o = units.get(u[0]);
      const jump = Math.hypot(u[1] - p[1], u[2] - p[2]) > 3;
      const x = jump ? u[1] : lerp(p[1], u[1], t), y = jump ? u[2] : lerp(p[2], u[2], t), a = lerpA(p[3], u[3], t);
      const alive = u[5] & 1, inTank = u[5] & 2;
      o.obj.visible = !!alive && !inTank;
      o.obj.position.copy(P(x, y));
      o.obj.rotation.y = Math.PI / 2 - a;
      animateSoldier(o.obj, dt, Math.hypot(u[1] - p[1], u[2] - p[2]) > 0.05);
      o.fg.scale.x = 1.06 * Math.max(0, u[4]) / SOLDIER.hp;
      if (u[0] === you) {
        myPos.x = x; myPos.y = y;
        curW = u[7];
        if (u[4] < lastHp && alive) vig = Math.min(1, vig + (lastHp - u[4]) / 40);
        lastHp = alive ? u[4] : 100;
        stats(u);
        if (!alive && !ended) big(`Wieder da in ${u[6]} s`, 0, true);
        else if ($('bBig').textContent.startsWith('Wieder')) big('', 0);
      }
    }
    // Panzer
    cur.k.forEach((k, i) => {
      const p = prev.k[i] || k, o = tankObj(i, k[7]);
      o.visible = !!k[5];
      o.position.copy(P(lerp(p[0], k[0], t), lerp(p[1], k[1], t)));
      o.rotation.y = Math.PI / 2 - lerpA(p[2], k[2], t);
      o.userData.turret.rotation.y = -(lerpA(p[3], k[3], t) - lerpA(p[2], k[2], t));
      o.userData.barrel.position.z = 0.7 - Math.max(0, (k[8] - (TANK.cd - 0.3)) / 0.3) * 0.4;
    });
    // Geschosse
    let bi = 0;
    for (const b of cur.b) { const m = bulletMesh(bi++, b[2]); m.position.copy(P(b[0], b[1], b[2] === 1 ? 1.5 : 1.15)); m.rotation.y = Math.PI / 2 - b[3]; }
    for (let i = bi; i < pool.length; i++) pool[i].visible = false;
    for (let i = 0; i < Math.max(cur.n.length, nadePool.length); i++) {
      if (!nadePool[i]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat('#2f3a22')); nadePool[i] = m; scene.add(m); }
      const g = cur.n[i];
      nadePool[i].visible = !!g;
      if (g) nadePool[i].position.copy(P(g[0], g[1], 0.2 + g[2]));
    }
    cur.p.forEach((on, i) => { const o = pickObjs[i]; o.visible = !!on; o.rotation.y += dt * 2; o.position.y = 0.6 + Math.sin(now / 300 + i) * 0.12; });
    if (cur.z) cur.z.forEach(([pr, owner, contested], i) => {
      const o = zoneObjs[i]; if (!o) return;
      const c = owner >= 0 ? colors[owner] : pr > 0 ? colors[0] : pr < 0 ? colors[1] : '#ffffff';
      o.ring.material.color.set(contested ? (Math.sin(now / 120) > 0 ? '#ffffff' : '#ff4040') : c);
      o.fill.material.color.set(c); o.fill.material.opacity = 0.06 + Math.abs(pr) / 100 * 0.16;
      o.fl.material.color.set(owner >= 0 ? colors[owner] : '#ffffff');
    });
    // Effekte
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt;
      const p = f.t / f.life;
      if (p >= 1) { scene.remove(f.mesh); fx.splice(i, 1); continue; }
      if (f.grow) f.mesh.scale.setScalar(0.3 + f.grow * Math.sqrt(p));
      if (f.rise) f.mesh.position.y += f.rise * dt;
      f.mesh.material.opacity = f.fade ? 0.5 * (1 - p) : (1 - p) * (f.rise ? 0.7 : 1);
    }
    // Kamera
    const me = cur.u.find((u) => u[0] === you);
    const inTank = me && (me[5] & 2);
    let fx2 = myPos.x, fy2 = myPos.y;
    if (inTank) { const k = cur.k[myTeam]; fx2 = k[0]; fy2 = k[1]; }
    const portrait = stage.h > stage.w;
    const camD = (inTank ? 1.25 : 1) * zoom * (portrait ? 1.35 : 1);
    camTarget.copy(P(fx2, fy2 + 12.5 * camD, 16 * camD));
    camera.position.lerp(camTarget, Math.min(1, dt * 6));
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.5); }
    camera.lookAt(P(fx2, fy2 + 0.8, 0));
    sun.position.copy(P(fx2 + 20, fy2 + 15, 40)); sun.target.position.copy(P(fx2, fy2, 0));
    renderer.render(scene, camera);
    // HUD
    $('bScore').innerHTML = `<span style="color:${colors[0]}">■ ${cur.sc[0]}</span>&nbsp;:&nbsp;<span style="color:${colors[1]}">${cur.sc[1]} ■</span> <span class="muted" style="font-size:12px">/${win}</span>`;
    $('bTime').textContent = `⏱ ${Math.floor(cur.tl / 60)}:${String(cur.tl % 60).padStart(2, '0')}`;
    if (cur.z) $('bZones').innerHTML = cur.z.map(([pr, owner, con], i) => `<span style="background:${owner >= 0 ? colors[owner] : '#555'};${con ? 'outline:2px solid #fff' : ''}">${ZONES[i].id}<i style="width:${Math.abs(pr)}%;background:${pr > 0 ? colors[0] : colors[1]}"></i></span>`).join('');
    if (cur.ph === 'count' && !ended) big(cur.cd > 0 ? String(cur.cd) : '', 0);
    const myTank = cur.k[myTeam];
    const near = me && (me[5] & 1) && myTank[5] && ((me[5] & 2) || Math.hypot(myTank[0] - myPos.x, myTank[1] - myPos.y) < TANK.r + 1.5);
    $('bUse').classList.toggle('hidden', !near);
    $('bUse').textContent = inTank ? 'RAUS' : 'PANZER';
    hitT = Math.max(0, hitT - dt); $('bHit').style.opacity = hitT > 0 ? 1 : 0;
    if (!stage.touch) { $('bHit').style.left = stage.mouse.x + 'px'; $('bHit').style.top = stage.mouse.y + 'px'; }
    vig = Math.max(0, vig - dt * 0.8); $('bVig').style.opacity = vig;
    const bb = $('bBoardBox');
    bb.classList.toggle('hidden', !showBoard || ended);
    if (showBoard && !ended) bb.innerHTML = `<div class="card">${boardHTML()}</div>`;
    minimap();
    stage.drawSticks();
  };
  function stats(u) {
    const w = WEAPONS[u[7]];
    $('bStats').innerHTML = `<span class="hpb"><i style="width:${Math.max(0, u[4])}%"></i></span> ❤ ${Math.max(0, u[4])} &nbsp; ${w.icon} ${u[5] & 8 ? '<span style="color:#f5d474">lädt…</span>' : `${u[8]}<small>/${u[9]}</small>`} &nbsp; 💣 ${u[10]}`;
    for (let i = 0; i < 4; i++) { const b = $('bWeap').children[i]; b.classList.toggle('on', i === u[7]); }
    $('bAm' + u[7]).textContent = u[8];
  }
  function boardHTML() {
    const rows = [0, 1].map((tm) => `<h3 style="color:${colors[tm]}">Team ${tm + 1} · ${cur ? cur.sc[tm] : 0}</h3><table class="res"><tr><th>Soldat</th><th>Treffer</th><th>Aus</th>${mode === 'conquest' ? '<th>Zonen</th>' : ''}</tr>${(lastRes || roster).filter((p) => p.team === tm).map((p) => `<tr class="${p.id === you ? 'me' : ''}"><td>${esc(p.name)}${p.human ? ' 👤' : ''}</td><td>${p.kills ?? '–'}</td><td>${p.deaths ?? '–'}</td>${mode === 'conquest' ? `<td>${p.caps ?? '–'}</td>` : ''}</tr>`).join('')}</table>`).join('');
    return `<h2 style="text-align:center">${MODES[mode].name}</h2>${rows}`;
  }
  let lastRes = null;
  function minimap() {
    const g = stage.g;
    g.clearRect(0, 0, stage.w, stage.h);
    const mw = Math.min(170, stage.w * (stage.touch ? 0.2 : 0.22)), mh = mw * H / W, mx = 64, my = 10;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(mx, my, mw, mh);
    g.fillStyle = 'rgba(255,255,255,.3)';
    for (const r of RECTS) g.fillRect(mx + r.x / W * mw, my + r.y / H * mh, Math.max(1, r.w / W * mw), Math.max(1, r.h / H * mh));
    if (cur.z) cur.z.forEach(([, owner], i) => { const z = ZONES[i]; g.strokeStyle = owner >= 0 ? colors[owner] : '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(mx + z.x / W * mw, my + z.y / H * mh, ZONE_R / W * mw, 0, 7); g.stroke(); });
    cur.k.forEach((k, i) => { if (!k[5]) return; g.fillStyle = colors[i]; g.fillRect(mx + k[0] / W * mw - 3, my + k[1] / H * mh - 3, 6, 6); });
    for (const u of cur.u) { if (!(u[5] & 1) || (u[5] & 2)) continue; const tm = teamOf(u[0]); if (tm !== myTeam && u[0] !== you) continue; g.fillStyle = u[0] === you ? '#f5d474' : colors[tm]; g.beginPath(); g.arc(mx + u[1] / W * mw, my + u[2] / H * mh, u[0] === you ? 3.5 : 2.2, 0, 7); g.fill(); }
  }

  function finish(m) {
    if (ended) return;
    ended = true;
    clearInterval(inputTimer);
    const res = m.results;
    lastRes = res.players;
    const meUnit = res.players.find((p) => p.id === you);
    const outcome = res.winner === -1 ? 'draw' : res.winner === meUnit.team ? 'win' : 'loss';
    big(outcome === 'win' ? 'SIEG!' : outcome === 'draw' ? 'UNENTSCHIEDEN' : 'NIEDERLAGE', 0);
    outcome === 'win' ? sfx.win() : sfx.lose();
    setTimeout(() => {
      $('bBig').textContent = '';
      $('bBoardBox').classList.add('hidden'); board = false;
      const o = stage.overlay(`<h2 style="text-align:center">${outcome === 'win' ? '🏆 SIEG' : outcome === 'draw' ? '🤝 UNENTSCHIEDEN' : '💀 NIEDERLAGE'}</h2>
        <p style="text-align:center;font-size:22px;font-weight:800"><span style="color:${colors[0]}">Team 1: ${res.score[0]}</span> : <span style="color:${colors[1]}">${res.score[1]} :Team 2</span></p>
        ${boardHTML()}<div id="bReward" style="margin-top:12px"></div>
        <div class="row" style="justify-content:center;margin-top:14px"><button class="btn gold big" id="bBack">Zurück in die Welt</button></div>`);
      o.querySelector('#bBack').onclick = () => { cleanup(); onExit(); };
      onEnd({ outcome, reward: m.reward, data: m, box: o.querySelector('#bReward') });
    }, 1800);
  }
  function cleanup() {
    clearInterval(inputTimer); off();
    if (!ended) live.send({ t: 'leave' });
    stage.destroy(); renderer.dispose();
  }
  return { cleanup };
}
