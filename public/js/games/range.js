// Panzer-Schießstand: Panzer steuern und auf auftauchende Zielpuppen schießen
import { drawTank } from '../draw.js';
import { sfx } from '../audio.js';

const FW = 40, FH = 24, TIME = 60;
const KINDS = {
  normal: { pts: 100, life: 5, r: 0.7, col: '#d9b46a' },
  mover: { pts: 150, life: 6, r: 0.7, col: '#c9a35a' },
  small: { pts: 200, life: 4.5, r: 0.5, col: '#e0c27a' },
  gold: { pts: 400, life: 2.4, r: 0.7, col: '#f2c94c' },
  friend: { pts: -200, life: 4, r: 0.7, col: '#5b8fd6' },
};
const OBST = [{ x: 9, y: 8.5, r: 1.3 }, { x: 31, y: 6.5, r: 1.3 }, { x: 20, y: 10.5, r: 1.0 }, { x: 14, y: 4, r: 0.9 }, { x: 27, y: 12, r: 0.9 }];
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export default {
  id: 'range', sticks: true, title: 'Panzer-Schießstand',
  help: `<p>Fahre deinen Panzer und triff so viele <b>Zielpuppen</b> wie möglich – du hast <b>60 Sekunden</b>.</p>
  <p>🎯 Puppe 100 · 🏃 bewegte Puppe 150 · 🔹 kleine Puppe hinten 200 · ⭐ goldene Puppe 400<br>🔵 <b>Blaue Puppen sind eigene Leute – nicht treffen!</b> (−200)</p>
  <p>Treffer hintereinander geben einen <b>Combo-Bonus</b> bis ×5.</p>
  <p><b>PC:</b> <kbd>W A S D</kbd> fahren, Maus zielen, Klick oder <kbd>Leertaste</kbd> schießen.<br><b>Handy/Tablet:</b> linker Daumen fährt, rechter Daumen zielt und schießt.</p>`,
  create(stage, opts = {}) {
    const tank = { x: 20, y: 20.5, a: -Math.PI / 2, ta: -Math.PI / 2, cd: 0, recoil: 0 };
    const S = { time: TIME, score: 0, combo: 0, hits: 0, shots: 0, over: false, dummies: [], shells: [], fx: [], pops: [], spawn: 0.5, el: 0, shake: 0 };
    const skin = opts.skin || 'oliv';
    let k = 1, ox = 0, oy = 0;
    const toWorld = (x, y) => ({ x: (x - ox) / k, y: (y - oy) / k });

    function spawn() {
      const t = S.el / TIME;
      const r = Math.random();
      const kind = r < 0.1 ? 'gold' : r < 0.22 ? 'friend' : r < 0.42 ? 'mover' : r < 0.6 ? 'small' : 'normal';
      for (let tries = 0; tries < 20; tries++) {
        const x = 3 + Math.random() * 34, y = kind === 'small' ? 1.8 + Math.random() * 2.5 : 3 + Math.random() * 9.5;
        if (OBST.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 1.4)) continue;
        if (S.dummies.some((d) => Math.hypot(d.x - x, d.y - y) < 2)) continue;
        S.dummies.push({ x, y, kind, age: 0, life: KINDS[kind].life * (1 - t * 0.3), vx: kind === 'mover' ? (Math.random() < 0.5 ? -1 : 1) * (2 + t * 2) : 0, down: 0, hit: false });
        return;
      }
    }

    function fire() {
      if (tank.cd > 0) return;
      tank.cd = 0.7; tank.recoil = 1; S.shots++;
      const sx = tank.x + Math.cos(tank.ta) * 1.6, sy = tank.y + Math.sin(tank.ta) * 1.6;
      S.shells.push({ x: sx, y: sy, vx: Math.cos(tank.ta) * 30, vy: Math.sin(tank.ta) * 30, hit: false });
      S.fx.push({ k: 'flash', x: sx, y: sy, t: 0 });
      sfx.cannon();
    }

    function explode(x, y, sh) {
      S.fx.push({ k: 'boom', x, y, t: 0 });
      S.shake = 0.2;
      let got = 0;
      for (const d of S.dummies) {
        if (d.hit) continue;
        if (Math.hypot(d.x - x, d.y - y) < KINDS[d.kind].r + 0.9) {
          d.hit = true;
          const base = KINDS[d.kind].pts;
          if (base < 0) { S.score = Math.max(0, S.score + base); S.combo = 0; S.pops.push({ x: d.x, y: d.y, t: 0, text: '−200 Kamerad!', col: '#ff8a80' }); sfx.wrong(); }
          else {
            S.combo = Math.min(5, S.combo + 1); got++;
            const pts = base * S.combo;
            S.score += pts; S.hits++;
            S.pops.push({ x: d.x, y: d.y, t: 0, text: '+' + pts + (S.combo > 1 ? ` ×${S.combo}` : ''), col: d.kind === 'gold' ? '#f5d474' : '#fff' });
          }
        }
      }
      if (sh && !got && !S.dummies.some((d) => d.hit && Math.hypot(d.x - x, d.y - y) < 2)) S.combo = 0;
      sfx.boom();
    }

    return {
      get over() { return S.over; }, get score() { return S.score; },
      update(dt) {
        if (S.over) return;
        S.el += dt; S.time -= dt;
        if (S.time <= 0) { S.time = 0; S.over = true; return; }
        // Fahren
        const m = stage.moveVec();
        const l = Math.hypot(m.x, m.y);
        if (l > 0.2) {
          const want = Math.atan2(m.y, m.x);
          const d = angDiff(tank.a, want);
          tank.a += Math.max(-2.6 * dt, Math.min(2.6 * dt, d));
          const f = Math.max(0, Math.cos(angDiff(tank.a, want))) * Math.min(1, l);
          tank.x += Math.cos(tank.a) * 5 * f * dt; tank.y += Math.sin(tank.a) * 5 * f * dt;
        }
        tank.x = Math.max(2, Math.min(FW - 2, tank.x)); tank.y = Math.max(16, Math.min(FH - 1.5, tank.y));
        // Zielen
        let want = tank.ta, wantFire = false;
        if (stage.aim.active && stage.aim.mag > 0.25) { want = Math.atan2(stage.aim.y, stage.aim.x); wantFire = stage.aim.mag > 0.6; }
        else if (stage.mouse.active && !stage.touch) { const p = toWorld(stage.mouse.x, stage.mouse.y); want = Math.atan2(p.y - tank.y, p.x - tank.x); }
        const d = angDiff(tank.ta, want);
        tank.ta += Math.max(-5 * dt, Math.min(5 * dt, d));
        tank.cd = Math.max(0, tank.cd - dt); tank.recoil = Math.max(0, tank.recoil - dt * 4);
        if ((stage.mouse.down && !stage.touch) || stage.keys.has(' ') || (wantFire && Math.abs(d) < 0.1)) fire();
        // Puppen
        S.spawn -= dt;
        if (S.spawn <= 0 && S.dummies.filter((x) => !x.hit).length < 7) { spawn(); S.spawn = Math.max(0.55, 1.3 - 0.7 * (S.el / TIME)); }
        for (const p of S.dummies) {
          p.age += dt;
          if (p.vx && !p.hit) { p.x += p.vx * dt; if (p.x < 2 || p.x > FW - 2) p.vx = -p.vx; }
          if (p.hit || p.age > p.life) p.down += dt * 3;
        }
        S.dummies = S.dummies.filter((p) => p.down < 1);
        // Granaten
        for (const s of S.shells) {
          for (let i = 0; i < 3 && !s.hit; i++) {
            s.x += s.vx * dt / 3; s.y += s.vy * dt / 3;
            if (s.x < 0 || s.x > FW || s.y < 0 || s.y > FH) { s.hit = true; S.combo = 0; break; }
            if (OBST.some((o) => Math.hypot(o.x - s.x, o.y - s.y) < o.r)) { s.hit = true; explode(s.x, s.y, true); break; }
            if (S.dummies.some((p) => !p.hit && p.down === 0 && Math.hypot(p.x - s.x, p.y - s.y) < KINDS[p.kind].r + 0.2)) { s.hit = true; explode(s.x, s.y, true); }
          }
        }
        S.shells = S.shells.filter((s) => !s.hit);
        for (const f of S.fx) f.t += dt;
        S.fx = S.fx.filter((f) => f.t < 0.6);
        for (const p of S.pops) p.t += dt;
        S.pops = S.pops.filter((p) => p.t < 1);
        S.shake = Math.max(0, S.shake - dt);
      },
      draw(g) {
        const w = stage.w, h = stage.h;
        k = Math.min(w / FW, h / FH); ox = (w - FW * k) / 2; oy = (h - FH * k) / 2;
        g.fillStyle = '#3d4a2a'; g.fillRect(0, 0, w, h);
        g.save();
        if (S.shake) g.translate((Math.random() - 0.5) * S.shake * 30, (Math.random() - 0.5) * S.shake * 30);
        g.translate(ox, oy); g.scale(k, k);
        // Wiese + Fahrbereich
        const gr = g.createLinearGradient(0, 0, 0, FH);
        gr.addColorStop(0, '#5f7a3a'); gr.addColorStop(0.6, '#6f8a44'); gr.addColorStop(1, '#7b8f4a');
        g.fillStyle = gr; g.fillRect(0, 0, FW, FH);
        g.fillStyle = '#8a7a52'; g.fillRect(0, 15, FW, FH - 15);
        g.fillStyle = 'rgba(0,0,0,.08)';
        for (let i = 0; i < 40; i++) g.fillRect((i * 7.3) % FW, 15.3 + (i * 3.1) % 8, 1.4, 0.15);
        // Zaun / Schusslinie
        g.strokeStyle = '#e8e2c8'; g.lineWidth = 0.12; g.setLineDash([0.6, 0.4]);
        g.beginPath(); g.moveTo(0, 14.6); g.lineTo(FW, 14.6); g.stroke(); g.setLineDash([]);
        // Entfernungsmarken
        g.fillStyle = 'rgba(255,255,255,.25)'; g.font = '0.7px Barlow, sans-serif'; g.textAlign = 'left';
        for (const [y, t] of [[12.5, '50 m'], [8, '150 m'], [3.5, '300 m']]) { g.fillRect(0, y, 0.8, 0.08); g.fillText(t, 0.3, y - 0.2); }
        // Hindernisse (Heuballen)
        for (const o of OBST) {
          g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(o.x + 0.3, o.y + 0.4, o.r, o.r * 0.6, 0, 0, 7); g.fill();
          g.fillStyle = '#c9a74d'; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
          g.strokeStyle = '#9b7d2e'; g.lineWidth = 0.1; g.beginPath(); g.arc(o.x, o.y, o.r * 0.6, 0, 7); g.stroke(); g.beginPath(); g.arc(o.x, o.y, o.r * 0.25, 0, 7); g.stroke();
        }
        // Puppen (aufrecht, leicht schräg von vorne gesehen)
        const sorted = [...S.dummies].sort((a, b) => a.y - b.y);
        for (const p of sorted) {
          const K = KINDS[p.kind];
          const s = (p.kind === 'small' ? 0.7 : 1);
          const up = Math.min(1, p.age * 5) * (1 - p.down);
          g.save(); g.translate(p.x, p.y);
          g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 0.1, 0.7 * s, 0.25 * s, 0, 0, 7); g.fill();
          g.scale(s, s * up);
          g.fillStyle = '#6b4f2a'; g.fillRect(-0.08, -1.0, 0.16, 1.0);
          g.fillStyle = K.col; g.beginPath(); g.ellipse(0, -1.5, 0.55, 0.75, 0, 0, 7); g.fill();
          g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.06; g.stroke();
          g.beginPath(); g.arc(0, -2.45, 0.32, 0, 7); g.fill(); g.stroke();
          if (p.kind === 'friend') {
            g.fillStyle = '#fff'; g.fillRect(-0.32, -1.62, 0.64, 0.2); g.fillRect(-0.1, -1.84, 0.2, 0.64);
          } else {
            for (const [r, c] of [[0.42, '#fff'], [0.3, '#c0392b'], [0.17, '#fff'], [0.07, '#c0392b']]) { g.fillStyle = c; g.beginPath(); g.arc(0, -1.5, r, 0, 7); g.fill(); }
          }
          if (p.kind === 'gold') { g.fillStyle = '#fff6c4'; g.globalAlpha = 0.5 + 0.5 * Math.sin(p.age * 12); g.beginPath(); g.arc(0.5, -2.6, 0.12, 0, 7); g.fill(); g.globalAlpha = 1; }
          // Restzeit
          if (!p.hit) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-0.5, 0.25, 1, 0.12); g.fillStyle = p.kind === 'friend' ? '#5b8fd6' : '#f5d474'; g.fillRect(-0.5, 0.25, Math.max(0, 1 - p.age / p.life), 0.12); }
          g.restore();
        }
        // Granaten
        for (const s of S.shells) { g.fillStyle = '#222'; g.beginPath(); g.arc(s.x, s.y, 0.18, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,220,120,.5)'; g.lineWidth = 0.12; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); g.stroke(); }
        drawTank(g, tank.x, tank.y, tank.a, tank.ta, 3, skin, null, tank.recoil);
        // Effekte
        for (const f of S.fx) {
          const t = f.t / 0.6;
          if (f.k === 'flash') { g.fillStyle = `rgba(255,210,90,${1 - t * 2})`; g.beginPath(); g.arc(f.x, f.y, 0.6, 0, 7); g.fill(); }
          else {
            g.fillStyle = `rgba(255,170,60,${1 - t})`; g.beginPath(); g.arc(f.x, f.y, 0.4 + t * 1.6, 0, 7); g.fill();
            g.fillStyle = `rgba(60,55,50,${0.7 - t * 0.7})`; g.beginPath(); g.arc(f.x + 0.3, f.y - t, 0.3 + t * 1.2, 0, 7); g.fill();
          }
        }
        g.textAlign = 'center'; g.font = '800 0.9px Barlow, sans-serif';
        for (const p of S.pops) { g.globalAlpha = 1 - p.t; g.fillStyle = '#000'; g.fillText(p.text, p.x + 0.05, p.y - 3 - p.t * 1.5 + 0.05); g.fillStyle = p.col; g.fillText(p.text, p.x, p.y - 3 - p.t * 1.5); }
        g.globalAlpha = 1;
        // Ziellinie (PC)
        if (!stage.touch) { g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 0.06; g.setLineDash([0.4, 0.4]); g.beginPath(); g.moveTo(tank.x, tank.y); g.lineTo(tank.x + Math.cos(tank.ta) * 30, tank.y + Math.sin(tank.ta) * 30); g.stroke(); g.setLineDash([]); }
        g.restore();
        // HUD
        hudText(g, w, S);
        // Nachladen
        const bx = w / 2 - 60, by = h - 26;
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(bx, by, 120, 10);
        g.fillStyle = tank.cd > 0 ? '#c0392b' : '#87a04c'; g.fillRect(bx, by, 120 * (1 - tank.cd / 0.7), 10);
        stage.drawSticks();
      },
    };
  },
};

function hudText(g, w, S) {
  g.font = '800 20px Barlow, sans-serif'; g.textAlign = 'center';
  const t = `⏱ ${Math.ceil(S.time)}   ⭐ ${S.score}` + (S.combo > 1 ? `   COMBO ×${S.combo}` : '');
  const tw = g.measureText(t).width + 30;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(w / 2 - tw / 2, 10, tw, 36, 10); g.fill();
  g.fillStyle = S.time < 10 ? '#ff8a80' : '#fff'; g.fillText(t, w / 2, 35);
}
