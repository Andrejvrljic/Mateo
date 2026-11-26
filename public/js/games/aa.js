// Flugabwehr: Flak-Geschütz – Granaten explodieren genau dort, wo du hinklickst
import { sfx } from '../audio.js';

const VW = 160, VH = 90, TIME = 60, GUN = { x: 80, y: 82 };
const TYPES = {
  drone: { speed: 16, size: 3, pts: 50 },
  heli: { speed: 11, size: 5, pts: 100 },
  jet: { speed: 42, size: 5, pts: 150 },
  bomber: { speed: 9, size: 9, pts: 200 },
  balloon: { speed: 6, size: 5, pts: 300 },
};

export default {
  id: 'aa', sticks: false, title: 'Flugabwehr',
  help: `<p>Feindliche Drohnen, Hubschrauber, Jets und Bomber greifen an! Tippe oder klicke in den Himmel – deine <b>Flak-Granate explodiert genau an dieser Stelle</b>.</p>
  <p>🛸 Drohne 50 · 🚁 Hubschrauber 100 · ✈️ Jet 150 · 💣 Bomber 200 · 🎈 goldener Ballon 300</p>
  <p>Mehrere Ziele mit einer Explosion = <b>Mehrfach-Bonus</b>. Bomben kannst du auch abschießen (+30). Trifft eine Bombe dein Geschütz, verlierst du 150 Punkte.</p>
  <p><b>Tipp:</b> Schnelle Jets musst du <b>vorhalten</b> – ziele vor das Flugzeug!</p>`,
  create(stage) {
    const S = { time: TIME, el: 0, score: 0, over: false, planes: [], shells: [], bursts: [], bombs: [], pops: [], spawn: 0.8, cd: 0, aim: -Math.PI / 2, shake: 0, stun: 0 };
    const clouds = Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * VW, y: 5 + Math.random() * 40, s: 6 + Math.random() * 10, v: 1 + Math.random() * 2 + i * 0.1 }));
    let k = 1, ox = 0, oy = 0;
    const toWorld = (x, y) => ({ x: (x - ox) / k, y: (y - oy) / k });

    function spawn() {
      const t = S.el / TIME, r = Math.random();
      const type = r < 0.05 ? 'balloon' : r < 0.2 ? 'bomber' : r < 0.42 + t * 0.15 ? 'jet' : r < 0.65 ? 'heli' : 'drone';
      const dir = Math.random() < 0.5 ? 1 : -1;
      const T = TYPES[type];
      S.planes.push({ type, x: dir > 0 ? -12 : VW + 12, y: 8 + Math.random() * (type === 'bomber' ? 25 : 45), dir, v: T.speed * (1 + t * 0.4), age: Math.random() * 5, bombT: 1.5 + Math.random() * 2, dead: false });
    }
    function fire(tx, ty) {
      if (S.cd > 0 || S.stun > 0) return;
      if (ty > GUN.y - 4) ty = GUN.y - 4;
      S.cd = 0.4;
      const a = Math.atan2(ty - GUN.y, tx - GUN.x);
      S.aim = a;
      const d = Math.hypot(tx - GUN.x, ty - GUN.y);
      S.shells.push({ x: GUN.x + Math.cos(a) * 7, y: GUN.y + Math.sin(a) * 7, tx, ty, a, t: 0, dur: d / 150 });
      sfx.shot();
    }
    function burst(x, y) {
      S.bursts.push({ x, y, t: 0, kills: 0 });
      sfx.boom();
    }
    return {
      get over() { return S.over; }, get score() { return S.score; },
      update(dt) {
        if (S.over) return;
        S.el += dt; S.time -= dt;
        if (S.time <= 0) { S.time = 0; S.over = true; return; }
        S.cd = Math.max(0, S.cd - dt); S.stun = Math.max(0, S.stun - dt); S.shake = Math.max(0, S.shake - dt);
        if (stage.mouse.active) { const p = toWorld(stage.mouse.x, stage.mouse.y); if (p.y < GUN.y) S.aim = Math.atan2(p.y - GUN.y, p.x - GUN.x); }
        for (const t of stage.taps) { if (t.right) continue; const p = toWorld(t.x, t.y); fire(p.x, p.y); }
        if (stage.mouse.down && !stage.touch) { const p = toWorld(stage.mouse.x, stage.mouse.y); fire(p.x, p.y); }
        if (stage.keys.has(' ')) { const p = toWorld(stage.mouse.x, stage.mouse.y); fire(p.x, p.y); }
        S.spawn -= dt;
        if (S.spawn <= 0) { spawn(); S.spawn = Math.max(0.45, 1.1 - 0.6 * S.el / TIME) * (0.6 + Math.random() * 0.8); }
        for (const p of S.planes) {
          p.age += dt;
          p.x += p.dir * p.v * dt;
          if (p.type === 'heli') p.y += Math.sin(p.age * 2) * 3 * dt;
          if (p.type === 'balloon') p.y += Math.sin(p.age) * 1.5 * dt;
          if (p.type === 'bomber' && !p.dead) {
            p.bombT -= dt;
            if (p.bombT <= 0 && p.x > 15 && p.x < VW - 15) { p.bombT = 2.2 + Math.random() * 1.5; S.bombs.push({ x: p.x, y: p.y + 3, vx: p.dir * p.v, vy: 0 }); }
          }
        }
        S.planes = S.planes.filter((p) => !p.dead && p.x > -20 && p.x < VW + 20);
        for (const s of S.shells) { s.t += dt; if (s.t >= s.dur) { s.done = true; burst(s.tx, s.ty); } }
        S.shells = S.shells.filter((s) => !s.done);
        for (const b of S.bursts) {
          b.t += dt;
          if (b.t < 0.35) {
            const R = 7 * Math.min(1, b.t / 0.12 + 0.4);
            for (const p of S.planes) {
              if (p.dead) continue;
              if (Math.hypot(p.x - b.x, p.y - b.y) < R + TYPES[p.type].size * 0.6) {
                p.dead = true; b.kills++;
                const pts = TYPES[p.type].pts * b.kills;
                S.score += pts;
                S.pops.push({ x: p.x, y: p.y, t: 0, text: '+' + pts + (b.kills > 1 ? ` ×${b.kills}` : ''), col: p.type === 'balloon' ? '#f5d474' : '#fff' });
                S.wreck = S.wreck || []; S.wreck.push({ x: p.x, y: p.y, vx: p.dir * p.v * 0.4, vy: -4, type: p.type, dir: p.dir, rot: 0 });
              }
            }
            for (const bo of S.bombs) if (!bo.dead && Math.hypot(bo.x - b.x, bo.y - b.y) < R) { bo.dead = true; S.score += 30; S.pops.push({ x: bo.x, y: bo.y, t: 0, text: '+30', col: '#fff' }); }
          }
        }
        S.bursts = S.bursts.filter((b) => b.t < 1.2);
        for (const bo of S.bombs) {
          bo.vy += 30 * dt; bo.vx *= 0.99; bo.x += bo.vx * dt; bo.y += bo.vy * dt;
          if (bo.y >= GUN.y + 4 && !bo.dead) {
            bo.dead = true;
            S.bursts.push({ x: bo.x, y: GUN.y + 3, t: 0.35, kills: 0, ground: true });
            if (Math.abs(bo.x - GUN.x) < 10) { S.score = Math.max(0, S.score - 150); S.stun = 1; S.shake = 0.5; S.pops.push({ x: GUN.x, y: GUN.y - 10, t: 0, text: '−150 Treffer!', col: '#ff8a80' }); sfx.wrong(); }
            sfx.boom();
          }
        }
        S.bombs = S.bombs.filter((b) => !b.dead);
        for (const w of S.wreck || []) { w.vy += 25 * dt; w.x += w.vx * dt; w.y += w.vy * dt; w.rot += dt * 3; }
        S.wreck = (S.wreck || []).filter((w) => w.y < GUN.y + 6);
        for (const p of S.pops) p.t += dt;
        S.pops = S.pops.filter((p) => p.t < 1);
        for (const c of clouds) { c.x += c.v * dt; if (c.x > VW + 20) c.x = -20; }
      },
      draw(g) {
        const w = stage.w, h = stage.h;
        k = Math.min(w / VW, h / VH); ox = (w - VW * k) / 2; oy = (h - VH * k);
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#5f8fc9'); sky.addColorStop(0.7, '#a9c8e6'); sky.addColorStop(1, '#e8d9b0');
        g.fillStyle = sky; g.fillRect(0, 0, w, h);
        g.save();
        if (S.shake) g.translate((Math.random() - 0.5) * 20 * S.shake, (Math.random() - 0.5) * 20 * S.shake);
        g.translate(ox, oy); g.scale(k, k);
        g.fillStyle = 'rgba(255,255,255,.75)';
        for (const c of clouds) { g.beginPath(); g.ellipse(c.x, c.y, c.s, c.s * 0.4, 0, 0, 7); g.ellipse(c.x + c.s * 0.5, c.y - c.s * 0.2, c.s * 0.6, c.s * 0.35, 0, 0, 7); g.fill(); }
        // Hügel und Stadt
        g.fillStyle = '#7d9a63';
        g.beginPath(); g.moveTo(-200, VH); for (let x = -200; x <= VW + 200; x += 10) g.lineTo(x, 74 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13) * 1.5); g.lineTo(VW + 200, VH); g.fill();
        g.fillStyle = '#56644a';
        for (let i = 0; i < 14; i++) { const bx = 4 + i * 11.5, bh = 5 + ((i * 37) % 9); if (Math.abs(bx - GUN.x) < 12) continue; g.fillRect(bx, 80 - bh, 7, bh + 2); }
        g.fillStyle = '#4b5a33'; g.fillRect(-200, 80, VW + 400, 20);
        // Flugzeuge
        for (const p of S.planes) drawPlane(g, p);
        for (const wr of S.wreck || []) { g.save(); g.translate(wr.x, wr.y); g.rotate(wr.rot * wr.dir); g.globalAlpha = 0.8; drawPlane(g, { ...wr, x: 0, y: 0, age: 0 }, true); g.restore(); g.fillStyle = 'rgba(60,60,60,.4)'; g.beginPath(); g.arc(wr.x - wr.vx * 0.05, wr.y - 1, 1.5, 0, 7); g.fill(); }
        // Bomben
        for (const b of S.bombs) { g.save(); g.translate(b.x, b.y); g.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2); g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(0, 0, 0.8, 1.6, 0, 0, 7); g.fill(); g.fillRect(-0.9, -2.2, 1.8, 0.6); g.restore(); }
        // Granaten
        for (const s of S.shells) { const t = s.t / s.dur; const x = GUN.x + (s.tx - GUN.x) * t, y = GUN.y + (s.ty - GUN.y) * t; g.fillStyle = '#ffeb99'; g.beginPath(); g.arc(x, y, 0.6, 0, 7); g.fill(); }
        // Explosionen
        for (const b of S.bursts) {
          const t = b.t;
          if (t < 0.35) { g.fillStyle = `rgba(255,190,80,${1 - t / 0.35})`; g.beginPath(); g.arc(b.x, b.y, 7 * Math.min(1, t / 0.12 + 0.4), 0, 7); g.fill(); }
          g.fillStyle = `rgba(50,50,50,${Math.max(0, 0.6 - t * 0.5)})`;
          g.beginPath(); g.arc(b.x, b.y - t * 2, 3 + t * 4, 0, 7); g.arc(b.x + 2.5, b.y - t * 2 + 1, 2 + t * 3, 0, 7); g.fill();
        }
        // Geschütz
        g.fillStyle = '#3c4429'; g.beginPath(); g.moveTo(GUN.x - 9, GUN.y + 6); g.lineTo(GUN.x - 6, GUN.y); g.lineTo(GUN.x + 6, GUN.y); g.lineTo(GUN.x + 9, GUN.y + 6); g.fill();
        g.save(); g.translate(GUN.x, GUN.y); g.rotate(S.aim);
        g.fillStyle = S.stun > 0 ? '#7a2b2b' : '#2b301f';
        g.fillRect(0, -1.6, 9 - S.cd * 4, 1.1); g.fillRect(0, 0.5, 9 - S.cd * 4, 1.1);
        g.restore();
        g.fillStyle = '#5d6b3a'; g.beginPath(); g.arc(GUN.x, GUN.y, 3.2, Math.PI, 0); g.fill();
        // Zielkreuz
        if (stage.mouse.active && !stage.touch) {
          const p = toWorld(stage.mouse.x, stage.mouse.y);
          g.strokeStyle = S.cd > 0 ? 'rgba(255,80,80,.8)' : 'rgba(255,255,255,.9)'; g.lineWidth = 0.35;
          g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.moveTo(p.x - 5, p.y); g.lineTo(p.x - 1.5, p.y); g.moveTo(p.x + 1.5, p.y); g.lineTo(p.x + 5, p.y); g.moveTo(p.x, p.y - 5); g.lineTo(p.x, p.y - 1.5); g.moveTo(p.x, p.y + 1.5); g.lineTo(p.x, p.y + 5); g.stroke();
        }
        g.textAlign = 'center'; g.font = '800 3px Barlow, sans-serif';
        for (const p of S.pops) { g.globalAlpha = 1 - p.t; g.fillStyle = '#000'; g.fillText(p.text, p.x + 0.2, p.y - 4 - p.t * 4 + 0.2); g.fillStyle = p.col; g.fillText(p.text, p.x, p.y - 4 - p.t * 4); }
        g.globalAlpha = 1;
        g.restore();
        g.font = '800 20px Barlow, sans-serif'; g.textAlign = 'center';
        const t = `⏱ ${Math.ceil(S.time)}   ⭐ ${S.score}`;
        const tw = g.measureText(t).width + 30;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(w / 2 - tw / 2, 10, tw, 36, 10); g.fill();
        g.fillStyle = S.time < 10 ? '#ff8a80' : '#fff'; g.fillText(t, w / 2, 35);
      },
    };
  },
};

function drawPlane(g, p, wreck = false) {
  g.save(); g.translate(p.x, p.y); g.scale(p.dir, 1);
  const dark = wreck ? '#333' : '#3b4252';
  if (p.type === 'drone') {
    g.fillStyle = dark; g.fillRect(-2.5, -0.4, 5, 0.8); g.fillRect(-0.8, -0.8, 1.6, 1.6);
    g.fillStyle = 'rgba(40,40,40,.5)'; for (const x of [-2.5, 2.5]) { g.beginPath(); g.ellipse(x, -0.6, 1.4, 0.3, 0, 0, 7); g.fill(); }
    g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(0, 0.6, 0.3, 0, 7); g.fill();
  } else if (p.type === 'heli') {
    g.fillStyle = '#4a5530'; g.beginPath(); g.ellipse(0, 0, 3.2, 1.5, 0, 0, 7); g.fill();
    g.fillRect(-7, -0.4, 5, 0.8); g.fillRect(-7.4, -1.6, 0.8, 2);
    g.fillStyle = '#9fd0ff'; g.beginPath(); g.ellipse(1.8, -0.3, 1.2, 0.8, 0, 0, 7); g.fill();
    g.fillStyle = '#222'; g.fillRect(-0.2, -2.3, 0.4, 0.9);
    const r = Math.sin((p.age || 0) * 40) * 5;
    g.fillRect(-r, -2.5, r * 2 || 0.5, 0.35);
    g.fillRect(-2, 1.6, 4, 0.3);
  } else if (p.type === 'jet') {
    g.fillStyle = '#6b7380';
    g.beginPath(); g.moveTo(5, 0); g.lineTo(-4, -0.8); g.lineTo(-5, -2.6); g.lineTo(-3.5, -0.6); g.lineTo(-4, 0.8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(1, 0); g.lineTo(-2.5, 2.2); g.lineTo(-1.5, 0); g.fill();
    g.fillStyle = '#9fd0ff'; g.beginPath(); g.ellipse(2.5, -0.5, 1, 0.4, 0, 0, 7); g.fill();
    if (!wreck) { g.fillStyle = 'rgba(255,170,60,.8)'; g.beginPath(); g.moveTo(-4.5, -0.4); g.lineTo(-6.5 - Math.random(), 0); g.lineTo(-4.5, 0.4); g.fill(); }
  } else if (p.type === 'bomber') {
    g.fillStyle = '#545b47';
    g.beginPath(); g.ellipse(0, 0, 8, 1.5, 0, 0, 7); g.fill();
    g.fillRect(-1.5, -0.4, 3, 0.8);
    g.beginPath(); g.moveTo(1, 0); g.lineTo(-2, -4.5); g.lineTo(-3.5, -4.5); g.lineTo(-2, 0); g.fill();
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(-8, -3); g.lineTo(-8.8, -3); g.lineTo(-8, 0); g.fill();
    g.fillStyle = '#333'; for (const x of [-0.5, -2]) g.fillRect(x, -2.5, 1.2, 0.8);
  } else {
    g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(0, -1.5, 3.6, 0, 7); g.fill();
    g.strokeStyle = '#c99a2e'; g.lineWidth = 0.3; g.beginPath(); g.ellipse(0, -1.5, 1.4, 3.6, 0, 0, 7); g.stroke();
    g.strokeStyle = '#555'; g.lineWidth = 0.15; g.beginPath(); g.moveTo(-2, 1.2); g.lineTo(-0.7, 3.2); g.moveTo(2, 1.2); g.lineTo(0.7, 3.2); g.stroke();
    g.fillStyle = '#8a5a2b'; g.fillRect(-0.8, 3.2, 1.6, 1.2);
  }
  g.restore();
}
