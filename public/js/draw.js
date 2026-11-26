// Gemeinsame Zeichenfunktionen: Panzer, Soldaten, Rangabzeichen, Tarnmuster
import { SKINS, RANK_BADGE } from '../shared/progress.js';

const camoCache = new Map();
// Tarnmuster als wiederholbares Muster
export function camo(g, skin) {
  const key = skin;
  if (!camoCache.has(key)) {
    const s = SKINS[skin] || SKINS.oliv;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = s.colors[0]; x.fillRect(0, 0, 64, 64);
    let seed = [...skin].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    if (skin === 'digital') {
      for (let i = 0; i < 90; i++) { x.fillStyle = s.colors[1 + (i % 2)]; x.fillRect(Math.floor(r() * 16) * 4, Math.floor(r() * 16) * 4, 4 + Math.floor(r() * 2) * 4, 4); }
    } else if (skin === 'tiger') {
      x.strokeStyle = s.colors[1]; x.lineWidth = 5;
      for (let i = -64; i < 64; i += 14) { x.beginPath(); x.moveTo(i, 0); x.quadraticCurveTo(i + 20, 32, i + 6, 64); x.stroke(); }
    } else if (skin !== 'oliv') {
      for (let i = 0; i < 14; i++) {
        x.fillStyle = s.colors[1 + (i % 2)];
        x.beginPath();
        const cx = r() * 64, cy = r() * 64, rr = 5 + r() * 9;
        for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, d = rr * (0.6 + r() * 0.6); x.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
        x.fill();
      }
    }
    camoCache.set(key, c);
  }
  return g.createPattern(camoCache.get(key), 'repeat');
}

// Panzer von oben. Größe s = Länge der Wanne. teamColor optional (Markierung)
export function drawTank(g, x, y, a, ta, s, skin = 'oliv', teamColor = null, recoil = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  const L = s, Wd = s * 0.72;
  // Ketten
  g.fillStyle = '#1e211b';
  g.fillRect(-L / 2, -Wd / 2, L, Wd * 0.24);
  g.fillRect(-L / 2, Wd / 2 - Wd * 0.24, L, Wd * 0.24);
  g.fillStyle = '#3a3d35';
  for (let i = 0; i < 9; i++) { const px = -L / 2 + (i + 0.5) * L / 9; g.fillRect(px - L * 0.02, -Wd / 2, L * 0.04, Wd * 0.24); g.fillRect(px - L * 0.02, Wd / 2 - Wd * 0.24, L * 0.04, Wd * 0.24); }
  // Wanne
  const pat = camo(g, skin);
  g.fillStyle = pat;
  g.save(); g.scale(s / 40, s / 40);
  g.fillRect(-20 * 0.92, -Wd / 2 * 40 / s * 0.78, 40 * 0.92, Wd * 40 / s * 0.78);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = s * 0.03;
  g.strokeRect(-L * 0.46, -Wd * 0.39, L * 0.92, Wd * 0.78);
  if (teamColor) { g.fillStyle = teamColor; g.fillRect(-L * 0.46, -Wd * 0.39, L * 0.08, Wd * 0.78); }
  g.restore();
  // Turm
  g.save();
  g.translate(x, y);
  g.rotate(ta);
  g.fillStyle = '#2a2d26';
  g.fillRect(s * 0.1 - recoil * s * 0.12, -s * 0.045, s * 0.62, s * 0.09);
  g.fillStyle = '#1a1c17';
  g.fillRect(s * 0.62 - recoil * s * 0.12, -s * 0.06, s * 0.1, s * 0.12);
  g.fillStyle = pat;
  g.save(); g.scale(s / 40, s / 40);
  g.beginPath(); g.ellipse(-2, 0, 11, 9.5, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = s * 0.03;
  g.beginPath(); g.ellipse(-s * 0.05, 0, s * 0.275, s * 0.24, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.arc(-s * 0.1, -s * 0.08, s * 0.07, 0, Math.PI * 2); g.fill();
  if (teamColor) { g.fillStyle = teamColor; g.beginPath(); g.arc(-s * 0.12, s * 0.09, s * 0.05, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

// Soldat von oben, r = Radius
export function drawSoldier(g, x, y, a, r, color, skin = 'oliv', flash = false) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  // Gewehr
  g.fillStyle = '#1b1d18';
  g.fillRect(r * 0.2, r * 0.25, r * 1.6, r * 0.28);
  if (flash) { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(r * 1.95, r * 0.39, r * 0.4, 0, Math.PI * 2); g.fill(); }
  // Schultern
  g.fillStyle = color;
  g.beginPath(); g.ellipse(0, 0, r * 0.75, r * 1.05, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = r * 0.12; g.stroke();
  // Helm
  g.fillStyle = camo(g, skin);
  g.save(); g.scale(r / 8, r / 8); g.beginPath(); g.arc(0.5, 0, 6.2, 0, Math.PI * 2); g.fill(); g.restore();
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = r * 0.1;
  g.beginPath(); g.arc(r * 0.06, 0, r * 0.78, 0, Math.PI * 2); g.stroke();
  g.restore();
}

// Rangabzeichen als SVG
export function rankBadge(i, size = 58) {
  const [grp, n] = RANK_BADGE[i] || ['m', 0];
  const bg = grp === 'g' ? '#7a1f1f' : '#2c3522';
  const gold = '#e3b341', silver = '#d5dbe0';
  let inner = '';
  const star = (cx, cy, r, col) => {
    let d = '';
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; d += `${k ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`; }
    return `<path d="${d}Z" fill="${col}"/>`;
  };
  if (grp === 'm') {
    for (let k = 0; k < n; k++) inner += `<path d="M14 ${40 - k * 9}l18-10 18 10" stroke="${silver}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    if (!n) inner = `<circle cx="32" cy="32" r="6" fill="${silver}" opacity=".7"/>`;
  } else if (grp === 'u') {
    inner = `<path d="M10 18h44" stroke="${gold}" stroke-width="5"/>`;
    for (let k = 0; k < n; k++) inner += `<path d="M14 ${48 - k * 7}l18-8 18 8" stroke="${gold}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  } else {
    const col = grp === 'o' ? silver : gold;
    if (grp !== 'o') inner += `<path d="M14 50 Q32 40 50 50" stroke="${gold}" stroke-width="4" fill="none"/>`;
    const pos = n === 1 ? [[32, 30]] : n === 2 ? [[22, 30], [42, 30]] : n === 3 ? [[18, 34], [32, 22], [46, 34]] : [[18, 22], [46, 22], [18, 40], [46, 40]];
    for (const [cx, cy] of pos) inner += star(cx, cy, n >= 3 ? 8 : 10, col);
  }
  return `<svg class="badge" width="${size}" height="${size}" viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="12" fill="${bg}" stroke="#55623f" stroke-width="3"/>${inner}</svg>`;
}

// Vorschau eines Tarnmusters (für den Shop)
export function skinPreview(canvas, skin) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 120 * dpr; canvas.height = 90 * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = '#55663a'; g.fillRect(0, 0, 120, 90);
  drawTank(g, 60, 45, -0.35, -0.5, 70, skin);
}
