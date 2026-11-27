// Vollbild-Spielfläche: Canvas, Spielschleife, Eingabe (Tastatur, Maus, Touch mit zwei virtuellen Sticks)
export function createStage({ sticks = false, onExit, webgl = false, stickLabels = ['BEWEGEN', 'ZIELEN + FEUER'] } = {}) {
  const root = document.createElement('div');
  root.className = 'stage';
  root.innerHTML = (webgl ? '<canvas class="gl"></canvas>' : '') + '<canvas class="c2d"></canvas><div class="hud"></div><button class="exit" title="Beenden">✕</button>';
  document.body.appendChild(root);
  const canvas = root.querySelector('canvas.c2d');
  const glCanvas = root.querySelector('canvas.gl');
  const hud = root.querySelector('.hud');
  const g = canvas.getContext('2d');
  const st = {
    root, canvas, glCanvas, hud, g, paused: false, w: 0, h: 0, dpr: 1, sticksOn: sticks, touch: false,
    keys: new Set(), pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, active: false, dx: 0, dy: 0, wheel: 0 },
    taps: [], // { x, y, long, right }
    move: { x: 0, y: 0, active: false, ox: 0, oy: 0, id: null },
    aim: { x: 0, y: 0, mag: 0, active: false, ox: 0, oy: 0, id: null },
    frame: null, alive: true,
  };

  function resize() {
    st.dpr = Math.min(2, window.devicePixelRatio || 1);
    st.w = root.clientWidth; st.h = root.clientHeight;
    canvas.width = Math.round(st.w * st.dpr); canvas.height = Math.round(st.h * st.dpr);
    if (st.onResize) st.onResize(st.w, st.h);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(root);

  const kd = (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
    if (!st.keys.has(k)) st.pressed.add(k);
    st.keys.add(k);
    if (k === 'escape') exit();
  };
  const ku = (e) => st.keys.delete(e.key.toLowerCase());
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  const blur = () => { st.keys.clear(); st.mouse.down = false; };
  window.addEventListener('blur', blur);

  const STICK_R = 60;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const longTimers = new Map();
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.mouse.wheel += Math.sign(e.deltaY); }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    canvas.setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      st.touch = true;
      if (st.sticksOn) {
        const left = p.x < st.w / 2;
        const s = left ? st.move : st.aim;
        if (s.id === null) { s.id = e.pointerId; s.ox = p.x; s.oy = p.y; s.x = 0; s.y = 0; s.mag = 0; s.active = true; }
        return;
      }
      const t = { x: p.x, y: p.y, long: false, id: e.pointerId };
      longTimers.set(e.pointerId, setTimeout(() => { t.long = true; st.taps.push({ ...t, long: true }); longTimers.delete(e.pointerId); }, 420));
      st.mouse.x = p.x; st.mouse.y = p.y; st.mouse.down = true; st.mouse.active = true;
      return;
    }
    st.mouse.x = p.x; st.mouse.y = p.y; st.mouse.active = true;
    if (e.button === 2) st.taps.push({ x: p.x, y: p.y, right: true });
    else { st.mouse.down = true; st.taps.push({ x: p.x, y: p.y }); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    for (const s of [st.move, st.aim]) {
      if (s.id !== e.pointerId) continue;
      let dx = p.x - s.ox, dy = p.y - s.oy;
      const l = Math.hypot(dx, dy);
      if (l > STICK_R) { s.ox += dx / l * (l - STICK_R); s.oy += dy / l * (l - STICK_R); dx = p.x - s.ox; dy = p.y - s.oy; }
      s.x = dx / STICK_R; s.y = dy / STICK_R; s.mag = Math.min(1, Math.hypot(s.x, s.y));
      return;
    }
    st.mouse.dx += p.x - st.mouse.x; st.mouse.dy += p.y - st.mouse.y;
    st.mouse.x = p.x; st.mouse.y = p.y; st.mouse.active = true;
  });
  const up = (e) => {
    for (const s of [st.move, st.aim]) if (s.id === e.pointerId) { s.id = null; s.active = false; s.x = s.y = 0; s.mag = 0; }
    if (longTimers.has(e.pointerId)) {
      clearTimeout(longTimers.get(e.pointerId)); longTimers.delete(e.pointerId);
      const p = pos(e);
      st.taps.push({ x: p.x, y: p.y });
    }
    if (e.pointerType !== 'touch' || !st.sticksOn) st.mouse.down = false;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // Tastatur-Bewegung (WASD / Pfeile) zusammen mit dem linken Stick
  st.moveVec = () => {
    let x = 0, y = 0;
    if (st.keys.has('a') || st.keys.has('arrowleft')) x -= 1;
    if (st.keys.has('d') || st.keys.has('arrowright')) x += 1;
    if (st.keys.has('w') || st.keys.has('arrowup')) y -= 1;
    if (st.keys.has('s') || st.keys.has('arrowdown')) y += 1;
    if (st.move.active) { x = st.move.x; y = st.move.y; }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  };
  st.wasPressed = (...ks) => ks.some((k) => st.pressed.has(k));

  st.drawSticks = () => {
    if (!st.sticksOn || !st.touch) return;
    const g2 = g;
    for (const [s, label] of [[st.move, stickLabels[0]], [st.aim, stickLabels[1]]]) {
      const isLeft = s === st.move;
      const ox = s.active ? s.ox : (isLeft ? 90 : st.w - 90), oy = s.active ? s.oy : st.h - 100;
      g2.globalAlpha = s.active ? 0.5 : 0.22;
      g2.fillStyle = '#000'; g2.beginPath(); g2.arc(ox, oy, STICK_R, 0, Math.PI * 2); g2.fill();
      g2.strokeStyle = '#fff'; g2.lineWidth = 3; g2.stroke();
      g2.fillStyle = isLeft ? '#cfd8bf' : '#f5d474';
      g2.beginPath(); g2.arc(ox + s.x * STICK_R, oy + s.y * STICK_R, 26, 0, Math.PI * 2); g2.fill();
      if (!s.active) { g2.globalAlpha = 0.6; g2.fillStyle = '#fff'; g2.font = '800 11px Barlow, sans-serif'; g2.textAlign = 'center'; g2.fillText(label, ox, oy + STICK_R + 16); }
      g2.globalAlpha = 1;
    }
  };

  let last = performance.now();
  function loop(now) {
    if (!st.alive) return;
    if (st.paused) { last = now; requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    if (st.frame) st.frame(dt, now);
    st.pressed.clear();
    st.taps.length = 0;
    st.mouse.dx = 0; st.mouse.dy = 0; st.mouse.wheel = 0;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function exit() { if (onExit) onExit(); else destroy(); }
  root.querySelector('.exit').addEventListener('click', exit);

  function destroy() {
    if (!st.alive) return;
    st.alive = false;
    ro.disconnect();
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    window.removeEventListener('blur', blur);
    root.remove();
  }
  st.destroy = destroy;
  st.hide = () => { st.paused = true; root.style.display = 'none'; st.keys.clear(); st.mouse.down = false; for (const s of [st.move, st.aim]) { s.id = null; s.active = false; s.x = s.y = 0; s.mag = 0; } };
  st.show = () => { st.paused = false; root.style.display = ''; resize(); };

  // Overlay-Karte (Hilfe, Ergebnis)
  st.overlay = (inner) => {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="card">${inner}</div>`;
    root.appendChild(o);
    return o;
  };
  return st;
}
