// 3D-Welt (Kaserne): herumlaufen mit eigenem Skin, andere Spieler sehen, Druckplatten für die Spiele.
import * as THREE from 'three';
import { createStage } from './stage.js';
import { makeSoldier, animateSoldier, makeTank, textSprite, emojiSprite, makeTree, makeBuilding, makeSandbags, makeCrate, mat } from './models3d.js';
import { STATIONS, BOXES, TREES, collideWorld, plateAt, BOUND, TEAM_COLORS } from '../shared/world.js';
import { RANKS } from '../shared/progress.js';
import { CATEGORIES } from '../shared/questions.js';
import { MODES } from '../shared/battle.js';
import { live } from './net.js';
import { esc } from './ui.js';
import { sfx } from './audio.js';

const SPEED = 6.5, GRAV = 22, JUMP = 8;
export const gfx = { get high() { try { return localStorage.getItem('kq-gfx') !== 'low'; } catch { return true; } } };

export function createWorld({ me, info, x, z, onMenu, onInfo }) {
  const stage = createStage({ sticks: true, webgl: true, onExit: () => onMenu(), stickLabels: ['LAUFEN', 'KAMERA'] });
  stage.root.querySelector('.exit').textContent = '☰';
  const high = gfx.high;
  const renderer = new THREE.WebGLRenderer({ canvas: stage.glCanvas, antialias: high, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1));
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9cc6e8');
  scene.fog = new THREE.Fog('#9cc6e8', 45, 110);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  stage.onResize = (w, h) => { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  stage.onResize(stage.w, stage.h);

  // Licht
  scene.add(new THREE.HemisphereLight('#dbeeff', '#4c5a32', 1.1));
  const sun = new THREE.DirectionalLight('#fff3d6', 1.6);
  sun.position.set(30, 50, 20);
  sun.castShadow = high;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  scene.add(sun, sun.target);

  // Boden
  const gc = document.createElement('canvas'); gc.width = gc.height = 256;
  const gx = gc.getContext('2d');
  gx.fillStyle = '#6a8a45'; gx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { gx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,200,.06)'; gx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3); }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(24, 24); gt.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // Wege von der Mitte zu den Stationen
  const roadMat = mat('#b9a77a');
  for (const s of STATIONS) {
    const len = Math.hypot(s.x, s.z);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(s.kind === 'game' ? 3 : 1.6, len), roadMat);
    road.rotation.x = -Math.PI / 2; road.rotation.z = -Math.atan2(s.x, -s.z);
    road.position.set(s.x / 2, 0.01, s.z / 2); road.receiveShadow = true; scene.add(road);
  }
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(10, 40), mat('#c2b088'));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.015; plaza.receiveShadow = true; scene.add(plaza);
  // Fahnenmast
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 9, 8), mat('#d0d4d8')); pole.position.y = 4.5; pole.castShadow = true; scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5, 8, 1), new THREE.MeshLambertMaterial({ color: '#e3b341', side: THREE.DoubleSide }));
  flag.position.set(1.25, 8, 0); scene.add(flag);
  const flagStar = emojiSprite('⭐', 1); flagStar.position.set(1.25, 8, 0.05); scene.add(flagStar);
  // Zaun
  const postMat = mat('#7a6a4a');
  for (let i = -BOUND; i <= BOUND; i += 4) for (const [px, pz] of [[i, -BOUND - 1], [i, BOUND + 1], [-BOUND - 1, i], [BOUND + 1, i]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), postMat); p.position.set(px, 0.7, pz); scene.add(p);
  }
  for (const [px, pz, w, d] of [[0, -BOUND - 1, BOUND * 2 + 2, 0.06], [0, BOUND + 1, BOUND * 2 + 2, 0.06], [-BOUND - 1, 0, 0.06, BOUND * 2 + 2], [BOUND + 1, 0, 0.06, BOUND * 2 + 2]]) {
    for (const y of [0.5, 1.1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), postMat); r.position.set(px, y, pz); scene.add(r); }
  }
  for (const t of TREES) { const tr = makeTree(t.s); tr.position.set(t.x, 0, t.z); scene.add(tr); }

  // Stationen
  const plates = new Map();
  for (const s of STATIONS) {
    const col = new THREE.Color(s.color);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, 0.16, 40), new THREE.MeshLambertMaterial({ color: '#3b4230', emissive: col, emissiveIntensity: 0.18 }));
    plate.position.set(s.x, 0.08, s.z); plate.receiveShadow = true; scene.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r - 0.15, 0.1, 6, 48), new THREE.MeshBasicMaterial({ color: col }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.18, s.z); scene.add(ring);
    const dd = Math.hypot(s.x, s.z) || 1, sx = s.x + s.x / dd * (s.r + 0.4), sz = s.z + s.z / dd * (s.r + 0.4);
    const iconY = s.kind === 'game' ? 4.6 : 3.4;
    const icon = emojiSprite(s.icon, s.kind === 'game' ? 2 : 1.3); icon.position.set(sx, iconY, sz); scene.add(icon);
    const label = textSprite(s.name, { size: s.kind === 'game' ? 0.75 : 0.55, color: s.color }); label.position.set(sx, iconY - 1.3, sz); scene.add(label);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, iconY - 1.8, 6), mat('#6b5a3a')); post.position.set(sx, (iconY - 1.8) / 2, sz); scene.add(post);
    plates.set(s.id, { s, plate, ring, icon, count: null, iconY, sx, sz });
    if (s.kind === 'info') {
      const kiosk = makeBuilding(2.2, 1.6, 2, '#d8cba5', '#9b3b2f'); kiosk.scale.setScalar(0.8);
      const d = Math.hypot(s.x, s.z); kiosk.position.set(s.x + s.x / d * 2.6, 0, s.z + s.z / d * 2.6); kiosk.rotation.y = Math.atan2(-s.x, -s.z); scene.add(kiosk);
    }
  }
  const blockers = [];
  for (const b of BOXES) {
    const grp = new THREE.Group();
    blockers.push(grp);
    const bld = makeBuilding(b.hw * 2, b.hd * 2, b.h, b.id === 'quiz' ? '#d9d0b0' : '#bdb497', b.id === 'battle' ? '#5c6640' : '#7a4a36');
    grp.add(bld);
    grp.position.set(b.x, 0, b.z); grp.rotation.y = -b.rot + Math.PI;
    scene.add(grp);
    const s = STATIONS.find((x) => x.id === b.id);
    const deco = new THREE.Group(); deco.position.set(s.x, 0, s.z); deco.rotation.y = Math.atan2(s.x, s.z); scene.add(deco);
    const side = (dx, dz, obj, ry = 0) => { obj.position.set(dx, obj.position.y, dz); obj.rotation.y = ry; deco.add(obj); };
    if (b.id === 'battle') { side(-6.5, 1, makeTank('oliv', '#3f7fd0'), 0.4); side(6.5, 1, makeTank('wueste', '#d0453f'), -0.4); side(0, -5.5, makeSandbags(6)); }
    if (b.id === 'range') { for (let i = -1; i <= 1; i++) { const d = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), mat('#6b4f2a')); post.position.y = 0.5; d.add(post); const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat('#d9b46a')); body.scale.y = 1.4; body.position.y = 1.4; d.add(body); const tgt = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), mat('#c0392b')); tgt.position.set(0, 1.4, 0.44); d.add(tgt); side(i * 2.2 + 5.5, 2 + i, d); } }
    if (b.id === 'aa') { const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 0.8, 10), mat('#4a5530')); base.position.y = 0.4; const gun = new THREE.Group(); gun.position.y = 1; for (const ox of [-0.25, 0.25]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), mat('#2b301f')); br.rotation.x = -0.9; br.position.set(ox, 0.9, 0.6); gun.add(br); } const gg = new THREE.Group(); gg.add(base, gun); side(5.5, 1, gg); }
    if (b.id === 'para') { const tower = new THREE.Group(); for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 7, 0.15), mat('#8a6a3a')); l.position.set(ox, 3.5, oz); tower.add(l); } const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 2.6), mat('#8a6a3a')); top.position.y = 7; tower.add(top); const chute = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#87a04c', { side: THREE.DoubleSide })); chute.position.set(3, 6, 0); tower.add(chute); side(-5.5, 1, tower); }
    if (b.id === 'mines') { for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), mat('#7a6a4a')); p.position.y = 0.5; side(4 + (i % 3) * 1.6, -1 + Math.floor(i / 3) * 3, p); } const sign = textSprite('⚠ MINEN', { size: 0.6, color: '#ffde59', bg: 'rgba(160,20,20,.85)' }); sign.position.y = 1.4; side(5.6, 0.5, sign); }
    if (b.id === 'morse') { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 9, 6), mat('#9aa0a6')); ant.position.y = 4.5; side(-5, 1, ant); const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 4), mat('#5d6b3a')); tent.position.y = 1.2; side(-5.5, -1.5, tent, Math.PI / 4); }
    if (b.id === 'quiz') { for (const ox of [-4, 4]) side(ox, 1, makeCrate(1)); }
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.4; const c = makeCrate(0.8); c.position.set(Math.cos(a) * 11.5, 0.4, Math.sin(a) * 11.5); c.rotation.y = a; if (!STATIONS.some((s) => Math.hypot(s.x - c.position.x, s.z - c.position.z) < s.r + 1.2)) scene.add(c); }

  // Spieler
  const others = new Map(); // key -> { obj, label, tx, tz, ry, flags, name }
  let players = [];
  let meObj = makeSoldier(me.skin, '#e3b341');
  scene.add(meObj);
  const meLabel = textSprite(me.name, { size: 0.42, color: '#f5d474' }); meLabel.position.y = 2.3; meObj.add(meLabel);
  const pos = { x, z, y: 0, vy: 0, ry: Math.atan2(-x, -z), moving: false };
  let yaw = Math.atan2(x, z), zoom = 11;
  let plateState = {};
  let worldInfo = info;

  function syncPlayers(list) {
    players = list;
    const keys = new Set(list.map((p) => p.key));
    for (const [k, o] of others) if (!keys.has(k)) { scene.remove(o.obj); others.delete(k); }
    for (const p of list) {
      if (p.key === me.key) continue;
      let o = others.get(p.key);
      if (o && (o.skin !== p.skin || o.name !== p.name)) { scene.remove(o.obj); others.delete(p.key); o = null; }
      if (!o) {
        const obj = makeSoldier(p.skin, '#5d6b3a');
        const label = textSprite(`${p.name} · ${RANKS[p.rank]?.[1] || ''}`, { size: 0.38 }); label.position.y = 2.3; obj.add(label);
        obj.position.set(0, -50, 0); scene.add(obj);
        o = { obj, label, tx: 0, tz: 0, ry: 0, flags: 0, skin: p.skin, name: p.name, fresh: true, y: 0 };
        others.set(p.key, o);
      }
    }
    hudInfo();
  }
  const nameOf = (k) => (k === me.key ? me.name : players.find((p) => p.key === k)?.name || '?');

  const off = live.on((m) => {
    if (m.t === 'wplayers') syncPlayers(m.list);
    else if (m.t === 'w') {
      plateState = m.pl || {};
      for (const [k, px, pz, ry, fl] of m.p) {
        const o = others.get(k);
        if (!o) continue;
        o.tx = px; o.tz = pz; o.ry = ry; o.flags = fl;
        if (o.fresh) { o.obj.position.set(px, 0, pz); o.fresh = false; }
      }
      renderPanel();
    }
  });

  // HUD
  stage.hud.insertAdjacentHTML('beforeend', `<div class="w-info" id="wInfo"></div>
    <div class="w-panel hidden" id="wPanel"></div>
    <button class="tbtn w-jump" id="wJump">⬆</button>
    <div class="hint" id="wHint" style="bottom:calc(14px + var(--safe-b))">PC: <b>WASD</b> laufen · <b>Maus ziehen</b> Kamera · <b>Leertaste</b> springen · Geh auf eine <b>Druckplatte</b>!</div>`);
  const $ = (id) => stage.hud.querySelector('#' + id);
  const hint = $('wHint');
  if (matchMedia('(hover: none)').matches) hint.innerHTML = 'Linker Daumen: <b>laufen</b> · Rechter Daumen: <b>Kamera drehen</b> · ⬆ springen · Geh auf eine <b>Druckplatte</b>!';
  hint.style.transition = 'opacity 1s';
  setTimeout(() => { hint.style.opacity = '0'; }, 9000);
  function hudInfo() {
    $('wInfo').innerHTML = `<b>${esc(worldInfo.name)}</b>${worldInfo.code ? ` · Code <span class="w-code">${esc(worldInfo.code)}</span>` : ''}${worldInfo.solo ? ' · allein' : ` · 👥 ${players.length}`}`;
  }
  hudInfo();
  $('wJump').addEventListener('pointerdown', (e) => { e.preventDefault(); jumpReq = true; });

  // Platten-Menü
  let panelKey = '', curPlate = null;
  const panel = $('wPanel');
  function renderPanel() {
    const s = curPlate;
    if (!s) { if (panelKey) { panel.classList.add('hidden'); panelKey = ''; } return; }
    const st = plateState[s.id] || { m: [], cfg: {} };
    const key = s.id + JSON.stringify(st) + players.map((p) => p.key + p.name).join();
    if (key === panelKey) return;
    panelKey = key;
    panel.classList.remove('hidden');
    if (s.kind === 'info') {
      panel.innerHTML = `<div class="w-ph"><span class="ic">${s.icon}</span><div><b>${esc(s.name)}</b><br><span class="muted">${esc(s.desc)}</span></div></div><button class="btn gold big" data-open="${s.id}" style="width:100%">ÖFFNEN</button>`;
      return;
    }
    const members = st.m || [];
    const host = members[0];
    const isHost = host === me.key;
    const cfg = st.cfg || {};
    let body = '';
    if (s.id === 'battle') {
      const colors = cfg.colors || [0, 1];
      const teamBtn = (k) => { const t = cfg.teams?.[k] ?? 0; const c = TEAM_COLORS[colors[t]]; return isHost ? `<button class="w-team" data-team="${k}" style="background:${c.c}">${esc(c.name)}</button>` : `<span class="w-team" style="background:${c.c}">${esc(c.name)}</span>`; };
      body += `<div class="w-sec">Modus</div><div class="row">${Object.entries(MODES).map(([k, mo]) => `<button class="btn small ${cfg.mode === k ? 'gold' : 'dark'}" data-mode="${k}" ${isHost ? '' : 'disabled'}>${mo.name}</button>`).join('')}</div><div class="muted" style="font-size:13px;margin-top:4px">${esc(MODES[cfg.mode || 'tdm'].desc)}</div>`;
      body += `<div class="w-sec">Teamfarben</div>` + [0, 1].map((t) => `<div class="row w-swatches"><span style="width:60px">Team ${t + 1}</span>${TEAM_COLORS.map((c, i) => `<button class="w-sw ${colors[t] === i ? 'on' : ''}" data-color="${t}:${i}" title="${c.name}" style="background:${c.c}" ${isHost && colors[1 - t] !== i ? '' : 'disabled'}></button>`).join('')}</div>`).join('');
      body += `<div class="w-sec">Spieler auf der Platte ${isHost ? '(tippe auf die Farbe zum Wechseln)' : ''}</div><div class="list">${members.map((k) => `<div class="li">${k === host ? '👑' : '👤'} <b>${esc(nameOf(k))}</b><span class="spacer"></span>${teamBtn(k)}</div>`).join('')}</div>`;
      body += `<div class="muted" style="font-size:13px;margin-top:6px">Freie Plätze werden mit Bots aufgefüllt (5 gegen 5).</div>`;
    } else {
      body += `<div class="w-sec">Spieler auf der Platte</div><div class="list">${members.map((k) => `<div class="li">${k === host ? '👑' : '👤'} <b>${esc(nameOf(k))}</b></div>`).join('')}</div>`;
      if (s.id === 'quiz') {
        body += `<div class="w-sec">Thema</div><select class="field" id="wCat" ${isHost ? '' : 'disabled'}>${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${cfg.cat === k ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}</select>
          <div class="row" style="margin-top:6px">${[5, 10].map((n) => `<button class="btn small ${(cfg.n || 10) === n ? 'gold' : 'dark'}" data-n="${n}" ${isHost ? '' : 'disabled'}>${n} Fragen</button>`).join('')}</div>
          <div class="muted" style="font-size:13px;margin-top:6px">${members.length > 1 ? '⚔️ Ihr seid mehrere – es wird ein Quiz-Duell!' : 'Allein: Solo-Quiz mit Joker. Zu mehreren: Quiz-Duell.'}</div>`;
      } else body += `<div class="muted" style="font-size:13px;margin-top:6px">${members.length > 1 ? '🏁 Alle auf der Platte spielen gleichzeitig – wer schafft die meisten Punkte?' : 'Hol Freunde auf die Platte für einen Wettkampf!'}</div>`;
    }
    panel.innerHTML = `<div class="w-ph"><span class="ic">${s.icon}</span><div><b>${esc(s.name)}</b><br><span class="muted">${esc(s.desc)}</span></div></div>${body}
      ${isHost ? `<button class="btn gold big w-start" id="wStart">▶ SPIELEN${members.length > 1 ? ` (${members.length} Spieler)` : ''}</button>` : `<p style="text-align:center;margin:10px 0 0">Warte, bis 👑 <b>${esc(nameOf(host))}</b> startet …</p>`}`;
  }
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !curPlate) return;
    const id = curPlate.id, cfg = (plateState[id] || {}).cfg || {};
    if (t.dataset.open) { sfx.click(); onInfo(t.dataset.open); return; }
    if (t.id === 'wStart') { sfx.click(); live.send({ t: 'plateStart', plate: id }); return; }
    if (t.dataset.mode) live.send({ t: 'plateCfg', plate: id, mode: t.dataset.mode });
    if (t.dataset.n) live.send({ t: 'plateCfg', plate: id, n: +t.dataset.n });
    if (t.dataset.color) { const [team, i] = t.dataset.color.split(':').map(Number); const colors = [...(cfg.colors || [0, 1])]; colors[team] = i; live.send({ t: 'plateCfg', plate: id, colors }); }
    if (t.dataset.team) { const k = +t.dataset.team; live.send({ t: 'plateCfg', plate: id, teams: { [k]: 1 - (cfg.teams?.[k] ?? 0) } }); }
    sfx.click();
  });
  panel.addEventListener('change', (e) => { if (e.target.id === 'wCat' && curPlate) live.send({ t: 'plateCfg', plate: curPlate.id, cat: e.target.value }); });

  // Schleife
  let sendT = 0, t = 0, jumpReq = false;
  const tmp = new THREE.Vector3(), head = new THREE.Vector3(), dir = new THREE.Vector3(), camRay = new THREE.Raycaster();
  stage.frame = (dt) => {
    t += dt;
    stage.g.clearRect(0, 0, stage.w, stage.h);
    // Kamera drehen
    if (stage.mouse.down && !stage.touch) yaw -= stage.mouse.dx * 0.006;
    if (stage.keys.has('q')) yaw += dt * 2.2;
    if (stage.keys.has('e')) yaw -= dt * 2.2;
    if (stage.aim.active) yaw -= stage.aim.x * dt * 2.6;
    zoom = Math.max(5, Math.min(20, zoom + stage.mouse.wheel * 1.2));
    // Laufen
    const mv = stage.moveVec();
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let vx = (fx * -mv.y + rx * mv.x) * SPEED, vz = (fz * -mv.y + rz * mv.x) * SPEED;
    pos.moving = Math.hypot(vx, vz) > 0.3;
    if (pos.moving) { const want = Math.atan2(vx, vz); let d = want - pos.ry; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; pos.ry += d * Math.min(1, dt * 12); }
    pos.x += vx * dt; pos.z += vz * dt;
    collideWorld(pos);
    if ((stage.wasPressed(' ') || jumpReq) && pos.y <= 0) pos.vy = JUMP;
    jumpReq = false;
    pos.vy -= GRAV * dt; pos.y = Math.max(0, pos.y + pos.vy * dt); if (pos.y === 0) pos.vy = 0;
    meObj.position.set(pos.x, pos.y, pos.z); meObj.rotation.y = pos.ry;
    animateSoldier(meObj, dt, pos.moving && pos.y === 0);
    // senden (10x pro Sekunde)
    sendT -= dt;
    if (sendT <= 0) { sendT = 0.1; live.send({ t: 'pos', x: Math.round(pos.x * 100) / 100, z: Math.round(pos.z * 100) / 100, ry: Math.round(pos.ry * 100) / 100, m: pos.moving ? 1 : 0, j: pos.y > 0.1 ? 1 : 0 }); }
    // andere Spieler
    for (const o of others.values()) {
      const p = o.obj.position;
      const k = Math.min(1, dt * 10);
      const moving = Math.hypot(o.tx - p.x, o.tz - p.z) > 0.05 || (o.flags & 1);
      p.x += (o.tx - p.x) * k; p.z += (o.tz - p.z) * k;
      o.y = (o.flags & 4) ? Math.min(1.2, o.y + dt * 6) : Math.max(0, o.y - dt * 6); p.y = o.y;
      let d = o.ry - o.obj.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; o.obj.rotation.y += d * k;
      animateSoldier(o.obj, dt, moving && !(o.flags & 2));
      const busy = !!(o.flags & 2);
      if (o.busy !== busy) { o.busy = busy; o.obj.traverse((c) => { if (c.material && c !== o.label) { c.material = c.material.clone(); c.material.transparent = busy; c.material.opacity = busy ? 0.35 : 1; } }); }
    }
    // Platten
    const s = plateAt(pos.x, pos.z);
    if (s !== curPlate) { curPlate = s; panelKey = ''; renderPanel(); if (s) sfx.pop(); }
    for (const [id, p] of plates) {
      const n = plateState[id]?.m?.length || 0;
      p.plate.material.emissiveIntensity = n ? 0.55 + Math.sin(t * 4) * 0.15 : 0.18;
      p.icon.position.y = p.iconY + Math.sin(t * 2 + p.s.x) * 0.15;
      if (p.count !== n) {
        p.count = n;
        if (p.badge) { scene.remove(p.badge); p.badge = null; }
        if (n) { p.badge = textSprite(`👥 ${n}`, { size: 0.5, color: '#fff', bg: 'rgba(200,60,50,.85)' }); p.badge.position.set(p.sx, p.iconY + 1.3, p.sz); scene.add(p.badge); }
      }
    }
    flag.geometry.attributes.position.array.forEach((_, i, arr) => { if (i % 3 === 2) { const vx2 = arr[i - 2]; arr[i] = Math.sin(t * 4 + vx2 * 2) * 0.15 * (vx2 + 1.2); } });
    flag.geometry.attributes.position.needsUpdate = true;
    // Kamera
    const camH = zoom * 0.55, dist = zoom;
    tmp.set(pos.x + Math.sin(yaw) * dist, pos.y + camH + 1, pos.z + Math.cos(yaw) * dist);
    // Kamera nicht in Gebäude rutschen lassen
    head.set(pos.x, pos.y + 1.6, pos.z);
    dir.subVectors(tmp, head); const full = dir.length(); dir.normalize();
    camRay.set(head, dir); camRay.far = full;
    const hits = camRay.intersectObjects(blockers, true);
    if (hits.length) { tmp.copy(head).addScaledVector(dir, Math.max(1.2, hits[0].distance - 0.6)); camera.position.copy(tmp); }
    else camera.position.lerp(tmp, Math.min(1, dt * 8));
    camera.lookAt(pos.x, pos.y + 1.4, pos.z);
    sun.position.set(pos.x + 30, 50, pos.z + 20); sun.target.position.set(pos.x, 0, pos.z);
    renderer.render(scene, camera);
    stage.drawSticks();
  };
  camera.position.set(pos.x + Math.sin(yaw) * zoom, 8, pos.z + Math.cos(yaw) * zoom);
  window.__kqWorld = { teleport(x2, z2) { pos.x = x2; pos.z = z2; }, get pos() { return { ...pos }; } }; // für automatische Tests

  return {
    stage,
    setInfo(i) { worldInfo = i; hudInfo(); },
    setSkin(skin) { if (!skin || skin === me.skin) return; me.skin = skin; const n = makeSoldier(skin, '#e3b341'); meObj.remove(meLabel); n.add(meLabel); scene.remove(meObj); meObj = n; scene.add(n); },
    hide() { stage.hide(); },
    show() { stage.show(); panelKey = ''; renderPanel(); },
    destroy() { off(); stage.destroy(); renderer.dispose(); },
  };
}
