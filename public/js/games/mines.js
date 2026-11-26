// Minenräumer: Minenfeld räumen – Zahlen zeigen, wie viele Minen in der Nähe liegen
import { sfx } from '../audio.js';

const N = 9, MINES = 10;

export default {
  id: 'mines', sticks: false, title: 'Minenräumer',
  help: `<p>Räume das Minenfeld! Decke alle Felder <b>ohne Mine</b> auf.</p>
  <p>Eine <b>Zahl</b> zeigt, wie viele Minen in den 8 Feldern rundherum liegen. Markiere Minen mit einer 🚩 <b>Flagge</b>.</p>
  <p><b>PC:</b> Linksklick aufdecken, Rechtsklick Flagge.<br><b>Handy:</b> Tippen aufdecken, <b>lange drücken</b> oder Flaggen-Knopf für Flaggen.</p>
  <p>Je schneller du fertig bist, desto mehr Punkte.</p>`,
  create(stage) {
    const S = { cells: [], first: true, over: false, won: false, boom: null, t: 0, flagMode: false, endT: 0, score: 0, revealed: 0 };
    for (let i = 0; i < N * N; i++) S.cells.push({ mine: false, open: false, flag: false, n: 0 });
    const hud = document.createElement('div');
    hud.innerHTML = '<button class="tbtn" style="right:16px;bottom:calc(20px + var(--safe-b));font-size:28px" title="Flaggen-Modus">🚩</button>';
    stage.hud.appendChild(hud);
    const fb = hud.querySelector('button');
    fb.addEventListener('click', () => { S.flagMode = !S.flagMode; fb.classList.toggle('on', S.flagMode); sfx.click(); });
    let cell = 40, gx = 0, gy = 0;
    const idx = (x, y) => y * N + x;
    const around = (x, y) => { const r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < N && ny < N) r.push([nx, ny]); } return r; };
    function place(sx, sy) {
      const safe = new Set([idx(sx, sy), ...around(sx, sy).map(([x, y]) => idx(x, y))]);
      let n = 0;
      while (n < MINES) { const i = Math.floor(Math.random() * N * N); if (safe.has(i) || S.cells[i].mine) continue; S.cells[i].mine = true; n++; }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) S.cells[idx(x, y)].n = around(x, y).filter(([a, b]) => S.cells[idx(a, b)].mine).length;
    }
    function open(x, y) {
      const c = S.cells[idx(x, y)];
      if (c.open || c.flag) return;
      if (S.first) { S.first = false; place(x, y); }
      c.open = true;
      if (c.mine) { S.boom = { x, y, t: 0 }; S.won = false; for (const d of S.cells) if (d.mine) d.open = true; sfx.boom(); return; }
      S.revealed++;
      if (c.n === 0) for (const [a, b] of around(x, y)) open(a, b);
    }
    function finishCheck() {
      if (!S.boom && S.revealed === N * N - MINES) {
        S.won = true; S.done = true;
        S.score = 1000 + Math.max(0, Math.round(2000 - S.t * 15));
        for (const d of S.cells) if (d.mine) d.flag = true;
        sfx.win();
      }
    }
    return {
      get over() { return S.over; }, get score() { return S.score; }, get won() { return S.won; },
      destroy() { hud.remove(); },
      update(dt) {
        if (S.over) return;
        if (S.boom || S.done) { S.endT += dt; if (S.boom) S.boom.t += dt; if (S.endT > 1.8) { if (S.boom) S.score = S.revealed * 10; S.over = true; } return; }
        if (!S.first) S.t += dt;
        for (const t of stage.taps) {
          const x = Math.floor((t.x - gx) / cell), y = Math.floor((t.y - gy) / cell);
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const c = S.cells[idx(x, y)];
          if (t.right || t.long || S.flagMode) { if (!c.open) { c.flag = !c.flag; sfx.click(); } }
          else if (c.open && c.n > 0) { // Zahl antippen: Nachbarn aufdecken, wenn genug Flaggen
            const nb = around(x, y);
            if (nb.filter(([a, b]) => S.cells[idx(a, b)].flag).length === c.n) for (const [a, b] of nb) open(a, b);
          } else { open(x, y); if (!S.boom) sfx.tick(); }
          finishCheck();
          if (S.boom) break;
        }
      },
      draw(g) {
        const w = stage.w, h = stage.h;
        g.fillStyle = '#2b3320'; g.fillRect(0, 0, w, h);
        cell = Math.floor(Math.min((w - 24) / N, (h - 150) / N, 64));
        gx = Math.floor((w - cell * N) / 2); gy = Math.floor(70 + (h - 150 - cell * N) / 2);
        const shake = S.boom && S.boom.t < 0.4 ? (Math.random() - 0.5) * 12 : 0;
        g.save(); g.translate(shake, shake);
        g.fillStyle = '#1b2014'; g.fillRect(gx - 6, gy - 6, cell * N + 12, cell * N + 12);
        const cols = ['', '#1f5fb0', '#2e7d32', '#c62828', '#6a1b9a', '#8d2b0b', '#00695c', '#222', '#555'];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const c = S.cells[idx(x, y)], px = gx + x * cell, py = gy + y * cell;
          if (!c.open) {
            g.fillStyle = (x + y) % 2 ? '#7a8f48' : '#728842'; g.fillRect(px, py, cell, cell);
            g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(px, py, cell, 3); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(px, py + cell - 3, cell, 3);
            if (c.flag) { g.fillStyle = '#5a3d1e'; g.fillRect(px + cell * 0.45, py + cell * 0.2, cell * 0.08, cell * 0.6); g.fillStyle = '#d9534f'; g.beginPath(); g.moveTo(px + cell * 0.53, py + cell * 0.2); g.lineTo(px + cell * 0.8, py + cell * 0.32); g.lineTo(px + cell * 0.53, py + cell * 0.45); g.fill(); }
          } else {
            g.fillStyle = (x + y) % 2 ? '#c8b07a' : '#bea671'; g.fillRect(px, py, cell, cell);
            if (c.mine) {
              const hit = S.boom && S.boom.x === x && S.boom.y === y;
              if (hit) { g.fillStyle = '#d9534f'; g.fillRect(px, py, cell, cell); }
              g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(px + cell / 2, py + cell / 2, cell * 0.26, 0, 7); g.fill();
              g.strokeStyle = '#2b2b2b'; g.lineWidth = cell * 0.07;
              for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4; g.beginPath(); g.moveTo(px + cell / 2 + Math.cos(an) * cell * 0.38, py + cell / 2 + Math.sin(an) * cell * 0.38); g.lineTo(px + cell / 2 - Math.cos(an) * cell * 0.38, py + cell / 2 - Math.sin(an) * cell * 0.38); g.stroke(); }
              g.fillStyle = '#eee'; g.beginPath(); g.arc(px + cell * 0.43, py + cell * 0.43, cell * 0.06, 0, 7); g.fill();
            } else if (c.n) { g.fillStyle = cols[c.n]; g.font = `${Math.floor(cell * 0.6)}px "Black Ops One", sans-serif`; g.textAlign = 'center'; g.fillText(c.n, px + cell / 2, py + cell * 0.72); }
          }
          g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
        }
        if (S.boom && S.boom.t < 0.8) { const t = S.boom.t / 0.8; g.fillStyle = `rgba(255,170,60,${1 - t})`; g.beginPath(); g.arc(gx + (S.boom.x + 0.5) * cell, gy + (S.boom.y + 0.5) * cell, cell * (0.5 + t * 3), 0, 7); g.fill(); }
        g.restore();
        const flags = S.cells.filter((c) => c.flag).length;
        g.font = '800 20px Barlow, sans-serif'; g.textAlign = 'center';
        const t = `⏱ ${Math.floor(S.t)} s   💣 ${MINES - flags}` + (S.flagMode ? '   🚩 FLAGGEN-MODUS' : '');
        const tw = g.measureText(t).width + 30;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(w / 2 - tw / 2, 10, tw, 36, 10); g.fill();
        g.fillStyle = '#fff'; g.fillText(t, w / 2, 35);
        if (S.done || S.boom) { g.font = `${Math.min(56, w / 9)}px "Black Ops One", sans-serif`; g.fillStyle = S.won ? '#f5d474' : '#ff8a80'; g.fillText(S.won ? 'GERÄUMT!' : 'BUMM!', w / 2, gy + cell * N / 2); }
      },
    };
  },
};
