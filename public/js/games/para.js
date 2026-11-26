// Fallschirmsprung: im richtigen Moment abspringen, steuern, Schirm öffnen, im Ziel landen
import { sfx } from '../audio.js';

const JUMPS = 5, ALT = 700;

export default {
  id: 'para', sticks: false, title: 'Fallschirmsprung',
  help: `<p>Du bist Fallschirmjäger! Spring aus dem Flugzeug und lande möglichst genau in der <b>Mitte des Ziels</b>. Du hast <b>5 Sprünge</b>.</p>
  <p>1. <b>Abspringen</b> – achte auf die Karte oben, wo das Ziel liegt.<br>2. Im freien Fall <b>steuern</b> und ⭐ Sterne sammeln (+50).<br>3. <b>Schirm öffnen</b> – nicht zu spät! Unter 60 m ist es zu spät.<br>4. Der <b>Wind</b> treibt dich ab – halte dagegen.</p>
  <p><b>PC:</b> <kbd>Leertaste</kbd> springen / Schirm öffnen, <kbd>←</kbd> <kbd>→</kbd> steuern.<br><b>Handy:</b> Knöpfe unten.</p>`,
  create(stage) {
    const S = { jump: 0, score: 0, over: false, results: [] };
    let J = null;
    const hud = document.createElement('div');
    hud.innerHTML = `<button class="tbtn" data-k="l" style="left:16px;bottom:calc(20px + var(--safe-b))">◀</button>
      <button class="tbtn" data-k="go" style="left:50%;transform:translateX(-50%);bottom:calc(16px + var(--safe-b));width:110px;height:110px;font-size:16px">SPRINGEN</button>
      <button class="tbtn" data-k="r" style="right:16px;bottom:calc(20px + var(--safe-b))">▶</button>`;
    stage.hud.appendChild(hud);
    const btn = { l: false, r: false, go: false };
    for (const b of hud.querySelectorAll('button')) {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (k === 'go') btn.go = true; else btn[k] = true; });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (k !== 'go') btn[k] = false; });
    }
    const goBtn = hud.querySelector('[data-k=go]');

    function newJump() {
      const target = 220 + Math.random() * 240;
      const wind = (Math.random() - 0.5) * 12;
      const stars = Array.from({ length: 6 }, (_, i) => ({ x: target + (Math.random() - 0.5) * 120, h: 120 + i * 90 + Math.random() * 40, got: false }));
      J = { ph: 'plane', px: -150, x: 0, h: ALT, vx: 0, vy: 0, target, wind, stars, chute: false, t: 0, msg: '', pts: 0, starPts: 0, chuteT: 0 };
    }
    newJump();

    function land() {
      const d = Math.abs(J.x - J.target);
      let pts = 0, msg;
      if (!J.chute || J.vy > 25) { msg = J.chute ? 'Harte Landung! Schirm zu spät geöffnet' : 'Schirm nicht geöffnet!'; pts = 0; sfx.wrong(); }
      else {
        pts = Math.max(0, Math.round(1000 - d * 12));
        if (J.vy < 15) pts += 100;
        msg = d < 3 ? 'VOLLTREFFER!' : d < 10 ? 'Sehr gut!' : d < 30 ? 'Gut gelandet' : d < 80 ? 'Daneben gelandet' : 'Weit weg vom Ziel';
        if (d < 10) sfx.win(); else sfx.pop();
      }
      pts += J.starPts;
      J.pts = pts; J.msg = msg; J.ph = 'landed'; J.t = 0; J.dist = d;
      S.score += pts;
      S.results.push(pts);
    }

    return {
      get over() { return S.over; }, get score() { return S.score; },
      destroy() { hud.remove(); },
      update(dt) {
        if (S.over) return;
        const go = btn.go || stage.wasPressed(' ', 'enter') || (stage.taps.length && !stage.touch && stage.taps.some((t) => !t.right));
        btn.go = false;
        const steer = (stage.keys.has('arrowleft') || stage.keys.has('a') || btn.l ? -1 : 0) + (stage.keys.has('arrowright') || stage.keys.has('d') || btn.r ? 1 : 0);
        J.t += dt;
        if (J.ph === 'plane') {
          J.px += 45 * dt;
          if (go || J.px > 700) { J.ph = 'fall'; J.x = J.px; J.vx = 45; J.vy = 0; sfx.wind(); }
        } else if (J.ph === 'fall' || J.ph === 'chute') {
          if (J.ph === 'fall') {
            J.vy = Math.min(75, J.vy + 28 * dt);
            const want = J.wind * 0.4 + steer * 14;
            J.vx += (want - J.vx) * Math.min(1, 0.9 * dt);
            if (go) { J.ph = 'chute'; J.chute = true; J.chuteT = 0; sfx.pop(); }
          } else {
            J.chuteT += dt;
            J.vy += (12 - J.vy) * Math.min(1, 2.2 * dt);
            const want = J.wind + steer * 9;
            J.vx += (want - J.vx) * Math.min(1, 1.6 * dt);
          }
          J.x += J.vx * dt; J.h -= J.vy * dt;
          for (const s of J.stars) if (!s.got && Math.abs(s.x - J.x) < 7 && Math.abs(s.h - J.h) < 7) { s.got = true; J.starPts += 50; sfx.coin(); }
          if (J.h <= 0) { J.h = 0; land(); }
        } else if (J.ph === 'landed') {
          if (J.t > 2.2 || (J.t > 0.6 && go)) {
            S.jump++;
            if (S.jump >= JUMPS) { S.over = true; return; }
            newJump();
          }
        }
        goBtn.textContent = J.ph === 'plane' ? 'SPRINGEN' : J.ph === 'fall' ? 'SCHIRM' : J.ph === 'chute' ? 'SCHIRM ✓' : 'WEITER';
      },
      draw(g) {
        const w = stage.w, h = stage.h;
        const k = h / 170; // Pixel pro Meter
        const fx = J.ph === 'plane' ? J.px : J.x, fh = J.ph === 'plane' ? ALT : J.h;
        const camH = Math.max(70, fh);
        const sx = (x) => w / 2 + (x - fx) * k, sy = (hh) => h * 0.55 - (hh - camH) * k;
        // Himmel (dunkler weiter oben)
        const top = Math.min(1, camH / ALT);
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, `rgb(${70 - top * 30},${120 - top * 40},${190 - top * 30})`); sky.addColorStop(1, '#bcd7ee');
        g.fillStyle = sky; g.fillRect(0, 0, w, h);
        // Wolken
        g.fillStyle = 'rgba(255,255,255,.7)';
        for (let i = 0; i < 16; i++) {
          const cx = ((i * 137) % 900) - 200, ch = 150 + ((i * 53) % 520);
          const x = sx(cx + J.target - 300), y = sy(ch);
          if (y < -60 || y > h + 60) continue;
          g.beginPath(); g.ellipse(x, y, 60, 18, 0, 0, 7); g.ellipse(x + 30, y - 8, 40, 14, 0, 0, 7); g.fill();
        }
        // Boden
        const gy = sy(0);
        if (gy < h + 10) {
          g.fillStyle = '#6f8a44'; g.fillRect(0, gy, w, h - gy + 10);
          g.fillStyle = '#5d7538'; for (let i = -10; i < 30; i++) { const x = sx(J.target + i * 40 - 400); g.fillRect(x, gy, 18, 4); }
          const tx = sx(J.target);
          for (const [r, c] of [[30, '#e8e2c8'], [15, '#d9534f'], [5, '#f5f5f5']]) { g.fillStyle = c; g.beginPath(); g.ellipse(tx, gy + 2, r * k, Math.max(2, r * k * 0.18), 0, 0, 7); g.fill(); }
          g.fillStyle = '#d9534f'; g.beginPath(); g.ellipse(tx, gy + 2, 1.5 * k, 1.5 * k * 0.25, 0, 0, 7); g.fill();
          // Windsack
          const wx = sx(J.target + 45);
          g.strokeStyle = '#ddd'; g.lineWidth = 3; g.beginPath(); g.moveTo(wx, gy); g.lineTo(wx, gy - 6 * k); g.stroke();
          g.fillStyle = '#ff7a2f'; g.beginPath(); g.moveTo(wx, gy - 6 * k); g.lineTo(wx + Math.sign(J.wind || 1) * Math.min(1, Math.abs(J.wind) / 6) * 4 * k, gy - 5.5 * k); g.lineTo(wx, gy - 5 * k); g.fill();
        }
        // Sterne
        g.font = `${Math.max(16, 5 * k)}px sans-serif`; g.textAlign = 'center';
        for (const s of J.stars) if (!s.got) g.fillText('⭐', sx(s.x), sy(s.h) + 6);
        // Flugzeug
        const planeX = J.ph === 'plane' ? J.px : J.px + J.t * 45;
        drawPlane(g, sx(planeX), sy(ALT + 12), k);
        // Springer
        if (J.ph !== 'plane') drawJumper(g, sx(J.x), sy(J.h), k, J.chute, J.ph === 'landed', J.vx, J.chuteT);
        // HUD: Karte oben
        const mapW = Math.min(420, w - 120), mx = (w - mapW) / 2, my = 56;
        g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.roundRect(mx, my, mapW, 26, 8); g.fill();
        const mapX = (x) => mx + 10 + (Math.max(-150, Math.min(700, x)) + 150) / 850 * (mapW - 20);
        g.fillStyle = '#d9534f'; g.fillRect(mapX(J.target) - 4, my + 6, 8, 14);
        g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.fillText(J.ph === 'plane' ? '✈' : '🪂', mapX(fx), my + 19);
        // Höhenmesser + Wind
        g.textAlign = 'left'; g.font = '800 16px Barlow, sans-serif';
        const info = `Höhe ${Math.round(fh)} m   Wind ${J.wind > 0 ? '→' : '←'} ${Math.abs(J.wind).toFixed(1)} m/s`;
        g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.roundRect(w / 2 - 150, my + 32, 300, 26, 8); g.fill();
        g.fillStyle = J.ph === 'fall' && J.h < 150 ? '#ff8a80' : '#fff'; g.textAlign = 'center'; g.fillText(info, w / 2, my + 51);
        g.font = '800 20px Barlow, sans-serif';
        const t = `Sprung ${Math.min(JUMPS, S.jump + 1)}/${JUMPS}   ⭐ ${S.score}`;
        const tw = g.measureText(t).width + 30;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(w / 2 - tw / 2, 10, tw, 36, 10); g.fill();
        g.fillStyle = '#fff'; g.fillText(t, w / 2, 35);
        if (J.ph === 'fall' && J.h < 200) { g.font = `900 ${Math.min(48, w / 12)}px "Black Ops One", sans-serif`; g.fillStyle = J.h < 90 ? '#ff5b5b' : '#f5d474'; g.fillText('SCHIRM ÖFFNEN!', w / 2, h * 0.3); }
        if (J.ph === 'landed') {
          g.font = `${Math.min(46, w / 12)}px "Black Ops One", sans-serif`; g.fillStyle = J.pts > 0 ? '#f5d474' : '#ff8a80';
          g.fillText(J.msg, w / 2, h * 0.3);
          g.font = '800 24px Barlow, sans-serif'; g.fillStyle = '#fff';
          g.fillText(`+${J.pts} Punkte` + (J.dist !== undefined && J.chute && J.vy <= 25 ? `  (${J.dist.toFixed(1)} m vom Ziel)` : ''), w / 2, h * 0.3 + 40);
        }
        if (J.ph === 'plane') { g.font = '800 18px Barlow, sans-serif'; g.fillStyle = '#fff'; g.fillText('Spring ab, wenn du denkst, dass du das rote Ziel erreichst!', w / 2, h * 0.3); }
      },
    };
  },
};

function drawPlane(g, x, y, k) {
  const s = Math.max(1, k / 3);
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#5d6b3a';
  g.beginPath(); g.ellipse(0, 0, 26, 5, 0, 0, 7); g.fill();
  g.fillRect(-5, -2, 10, 3);
  g.beginPath(); g.moveTo(-20, -2); g.lineTo(-28, -12); g.lineTo(-24, -12); g.lineTo(-14, -2); g.fill();
  g.fillStyle = '#4a5530'; g.fillRect(-12, -1.5, 30, 3);
  g.fillStyle = '#2a2d26'; for (const ex of [-6, 6]) g.fillRect(ex - 2, 1, 4, 4);
  g.fillStyle = '#9fd0ff'; g.fillRect(18, -3, 5, 2);
  g.restore();
}

function drawJumper(g, x, y, k, chute, landed, vx, ct) {
  const s = Math.max(1.4, k / 2.2);
  g.save(); g.translate(x, y); g.scale(s, s);
  if (chute && !landed) {
    const open = Math.min(1, ct * 3);
    g.strokeStyle = '#ccc'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(0, -4); g.lineTo(-14 * open, -22); g.moveTo(0, -4); g.lineTo(14 * open, -22); g.moveTo(0, -4); g.lineTo(0, -24); g.stroke();
    g.fillStyle = '#6b7d3e'; g.beginPath(); g.ellipse(0, -24, 16 * open, 7, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#87a04c'; for (let i = -2; i <= 2; i += 2) { g.beginPath(); g.ellipse(i * 4 * open, -24, 2.5 * open, 7, 0, Math.PI, 0); g.fill(); }
  }
  g.fillStyle = '#3b4426';
  if (!chute && !landed) {
    g.rotate(Math.max(-0.5, Math.min(0.5, vx / 60)));
    g.fillRect(-6, -1, 12, 2.4); g.fillRect(-1.5, -3, 3, 8); g.fillRect(-4, 4, 2, 4); g.fillRect(2, 4, 2, 4);
  } else {
    g.fillRect(-1.6, -4, 3.2, 7); g.fillRect(-1.6, 3, 1.3, 4); g.fillRect(0.3, 3, 1.3, 4); g.fillRect(-3, -3, 1.5, 4); g.fillRect(1.5, -3, 1.5, 4);
  }
  g.fillStyle = '#2f3a22'; g.beginPath(); g.arc(0, -5, 2, 0, 7); g.fill();
  g.restore();
}
