// Kleine Soundeffekte, direkt im Browser erzeugt (WebAudio)
let ctx = null, master = null, muted = false;
try { muted = localStorage.getItem('kq-mute') === '1'; } catch { /* egal */ }
function ac() {
  if (muted) return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const isMuted = () => muted;
export function setMuted(v) { muted = v; try { localStorage.setItem('kq-mute', v ? '1' : '0'); } catch { /* egal */ } }

function tone(freq, dur, type = 'square', vol = 0.4, slide = 0, delay = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, vol = 0.5, freq = 1200, delay = 0) {
  const c = ac(); if (!c) return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = c.currentTime + delay;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}
let lastShot = 0;
export const sfx = {
  click: () => tone(660, 0.06, 'square', 0.15),
  right: () => { tone(660, 0.12, 'triangle', 0.4); tone(990, 0.2, 'triangle', 0.4, 0, 0.1); },
  wrong: () => tone(180, 0.35, 'sawtooth', 0.3, -60),
  shot: () => { const n = performance.now(); if (n - lastShot < 40) return; lastShot = n; noise(0.08, 0.25, 3000); },
  cannon: () => { noise(0.35, 0.7, 900); tone(90, 0.3, 'sine', 0.5, -40); },
  boom: () => { noise(0.7, 0.8, 600); tone(60, 0.5, 'sine', 0.6, -30); },
  hit: () => tone(1200, 0.05, 'square', 0.12),
  pop: () => tone(500, 0.1, 'triangle', 0.3, 300),
  coin: () => { tone(988, 0.08, 'square', 0.2); tone(1319, 0.25, 'square', 0.2, 0, 0.08); },
  beep: (dur) => tone(700, dur, 'sine', 0.45),
  wind: () => noise(1.2, 0.15, 500),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.35, 0, i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, 0, i * 0.15)),
  tick: () => tone(1000, 0.03, 'square', 0.1),
};
