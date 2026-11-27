// 3D-Modelle aus einfachen Formen: Soldat (mit Skin), Panzer, Gebäude, Bäume, Schilder
import * as THREE from 'three';
import { camoCanvas } from './draw.js';

const texCache = new Map();
export function camoTexture(skin) {
  if (!texCache.has(skin)) {
    const t = new THREE.CanvasTexture(camoCanvas(skin));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(skin, t);
  }
  return texCache.get(skin);
}
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
export function camoMat(skin) {
  const key = 'camo:' + skin;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ map: camoTexture(skin) }));
  return matCache.get(key);
}
function box(w, h, d, material) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.castShadow = true; m.receiveShadow = true; return m; }

// Soldat, ca. 1,8 m groß. color = Weste/Teamfarbe
export function makeSoldier(skin = 'oliv', color = '#5d6b3a') {
  const g = new THREE.Group();
  const cm = camoMat(skin), vest = mat(color), skinM = mat('#e0b08a'), boot = mat('#2a2520'), gun = mat('#1c1d1a');
  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [leg, x] of [[legL, -0.13], [legR, 0.13]]) {
    leg.position.set(x, 0.85, 0);
    const l = box(0.2, 0.75, 0.22, cm); l.position.y = -0.38; leg.add(l);
    const b = box(0.22, 0.14, 0.3, boot); b.position.set(0, -0.78, 0.04); leg.add(b);
    g.add(leg);
  }
  const body = box(0.52, 0.62, 0.3, cm); body.position.y = 1.18; g.add(body);
  const v = box(0.55, 0.42, 0.33, vest); v.position.y = 1.22; g.add(v);
  const pack = box(0.38, 0.45, 0.18, mat('#4a4f3a')); pack.position.set(0, 1.2, -0.24); g.add(pack);
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [arm, x] of [[armL, -0.34], [armR, 0.34]]) {
    arm.position.set(x, 1.42, 0);
    const a = box(0.16, 0.55, 0.18, cm); a.position.y = -0.25; arm.add(a);
    const h = box(0.14, 0.12, 0.14, skinM); h.position.y = -0.56; arm.add(h);
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), skinM); head.position.y = 1.68; head.castShadow = true; g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cm); helmet.position.y = 1.72; helmet.scale.set(1, 0.85, 1.05); helmet.castShadow = true; g.add(helmet);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 16), cm); rim.position.y = 1.72; g.add(rim);
  const rifle = box(0.07, 0.1, 0.75, gun); rifle.position.set(0.18, 1.12, 0.32); g.add(rifle);
  g.userData = { legL, legR, armL, armR, rifle, phase: 0, body: [body, v], vestMat: v };
  return g;
}
export function setVest(soldier, color) { soldier.userData.vestMat.material = mat(color); }
export function animateSoldier(s, dt, moving, speed = 1) {
  const u = s.userData;
  u.phase += dt * (moving ? 9 * speed : 0);
  const k = moving ? Math.sin(u.phase) * 0.6 : 0;
  u.legL.rotation.x += (k - u.legL.rotation.x) * Math.min(1, dt * 12);
  u.legR.rotation.x += (-k - u.legR.rotation.x) * Math.min(1, dt * 12);
  u.armL.rotation.x += (-k * 0.7 - u.armL.rotation.x) * Math.min(1, dt * 12);
  u.armR.rotation.x += (-0.9 - u.armR.rotation.x) * Math.min(1, dt * 12); // hält das Gewehr
}

// Panzer: Länge ~ 2.9 m (passt zu Radius 1.3)
export function makeTank(skin = 'oliv', teamColor = null) {
  const g = new THREE.Group();
  const cm = camoMat(skin), dark = mat('#1d1f1a'), steel = mat('#2c2f28');
  const hull = box(1.9, 0.7, 3.0, cm); hull.position.y = 0.75; g.add(hull);
  const front = box(1.9, 0.35, 0.5, cm); front.position.set(0, 0.55, 1.6); front.rotation.x = 0.5; g.add(front);
  for (const x of [-1.05, 1.05]) {
    const tr = box(0.45, 0.65, 3.3, dark); tr.position.set(x, 0.38, 0); g.add(tr);
    for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.48, 12), steel); w.rotation.z = Math.PI / 2; w.position.set(x, 0.3, -1.3 + i * 0.52); g.add(w); }
  }
  if (teamColor) { const stripe = box(1.92, 0.12, 0.6, mat(teamColor)); stripe.position.set(0, 1.12, -1.1); g.add(stripe); }
  const turret = new THREE.Group(); turret.position.y = 1.1; g.add(turret);
  const tb = box(1.3, 0.5, 1.5, cm); tb.position.y = 0.25; turret.add(tb);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12), steel); hatch.position.set(0.25, 0.53, -0.2); turret.add(hatch);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.3, 0.7); turret.add(barrel);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.1, 10), steel); b.rotation.x = Math.PI / 2; b.position.z = 1.05; b.castShadow = true; barrel.add(b);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 10), dark); muzzle.rotation.x = Math.PI / 2; muzzle.position.z = 2.1; barrel.add(muzzle);
  if (teamColor) { const flag = box(0.04, 0.3, 0.45, mat(teamColor)); flag.position.set(-0.55, 0.9, -0.6); turret.add(flag); const pole = box(0.03, 0.8, 0.03, dark); pole.position.set(-0.55, 0.55, -0.4); turret.add(pole); }
  g.userData = { turret, barrel };
  return g;
}

// Text als Schild (Sprite)
export function textSprite(text, { size = 0.5, color = '#ffffff', bg = 'rgba(0,0,0,0.55)', font = '800 44px Barlow, sans-serif', pad = 14 } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = font;
  const w = Math.ceil(x.measureText(text).width) + pad * 2, h = 64;
  c.width = w; c.height = h;
  x.font = font;
  if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, w, h, 16); x.fill(); }
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(size * w / h, size, 1);
  s.renderOrder = 10;
  return s;
}
export function emojiSprite(emoji, size = 1.4) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.font = '100px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, 64, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(size, size, 1);
  return s;
}

export function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.4, 6), mat('#6b4a2b')); trunk.position.y = 0.7; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.3 - i * 0.3, 1.6, 7), mat(i % 2 ? '#3d6b33' : '#355e2c')); c.position.y = 1.6 + i * 0.75; c.castShadow = true; g.add(c); }
  g.scale.setScalar(scale);
  return g;
}

// Einfaches Gebäude mit Satteldach
export function makeBuilding(w, d, h, wall = '#c8bf9f', roof = '#6b4a3a') {
  const g = new THREE.Group();
  const b = box(w, h, d, mat(wall)); b.position.y = h / 2; g.add(b);
  const shape = new THREE.Shape(); shape.moveTo(-w / 2 - 0.3, 0); shape.lineTo(w / 2 + 0.3, 0); shape.lineTo(0, 1.6); shape.closePath();
  const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
  const r = new THREE.Mesh(rg, mat(roof)); r.position.set(0, h, -d / 2 - 0.3); r.castShadow = true; g.add(r);
  const door = box(1.2, 2.1, 0.1, mat('#4a3426')); door.position.set(0, 1.05, d / 2 + 0.02); g.add(door);
  for (const x of [-w / 3, w / 3]) { const win = box(0.9, 0.8, 0.08, mat('#8fb6d0')); win.position.set(x, h * 0.6, d / 2 + 0.03); g.add(win); }
  return g;
}
export function makeSandbags(len, h = 0.9, color = '#b59a63') {
  const g = new THREE.Group();
  const n = Math.max(1, Math.round(len / 0.7)), rows = Math.max(1, Math.round(h / 0.3));
  const geo = new THREE.CapsuleGeometry(0.17, 0.42, 3, 6);
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat(r % 2 ? '#a88d58' : color));
    m.rotation.z = Math.PI / 2; m.position.set(-len / 2 + (i + 0.5 + (r % 2) * 0.3) * len / n, 0.17 + r * 0.3, 0);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  return g;
}
export function makeCrate(s = 1) {
  const m = box(s, s, s, mat('#8a6136'));
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: '#4e3519' }));
  m.add(e);
  return m;
}
