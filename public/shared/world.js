// Die 3D-Welt (Kaserne): Stationen mit Druckplatten, Gebäude, Bäume, Kollision.
// Wird im Browser (Anzeige, Laufen) und auf dem Server (wer steht auf welcher Platte) benutzt.
export const WORLD_SIZE = 96; // von -48 bis 48
export const BOUND = 46;
export const PLAYER_R = 0.45;
export const WORLD_MAX = 20; // Spieler pro Server
export const PUBLIC_SERVERS = [
  { id: 'alpha', name: 'Server Alpha' },
  { id: 'bravo', name: 'Server Bravo' },
  { id: 'charlie', name: 'Server Charlie' },
];

// kind: 'game' = Druckplatte für ein Spiel (Gruppe, Chef startet), 'info' = Platte öffnet ein Menü
const RAW = [
  { id: 'quiz', kind: 'game', name: 'Quiz-Zentrum', icon: '🎖️', x: 0, z: -22, r: 3.2, color: '#e3b341', desc: 'Allein: Solo-Quiz · Zu mehreren: Quiz-Duell' },
  { id: 'battle', kind: 'game', name: 'Gefecht 5 gegen 5', icon: '🪖', x: 23, z: -13, r: 4.2, color: '#d9534f', desc: 'Teams, Farben und Modus stellt der Chef ein' },
  { id: 'range', kind: 'game', name: 'Panzer-Schießstand', icon: '🎯', x: 27, z: 10, r: 3, color: '#87a04c', desc: 'Zielpuppen treffen' },
  { id: 'aa', kind: 'game', name: 'Flugabwehr', icon: '🛩️', x: 12, z: 26, r: 3, color: '#4f8fd9', desc: 'Drohnen und Flugzeuge abwehren' },
  { id: 'para', kind: 'game', name: 'Fallschirmsprung', icon: '🪂', x: -12, z: 26, r: 3, color: '#9b59b6', desc: 'Im Ziel landen' },
  { id: 'mines', kind: 'game', name: 'Minenräumer', icon: '💣', x: -27, z: 10, r: 3, color: '#e67e22', desc: 'Das Minenfeld räumen' },
  { id: 'morse', kind: 'game', name: 'Morse-Funker', icon: '📻', x: -23, z: -13, r: 3, color: '#16a085', desc: 'Morsezeichen entschlüsseln' },
  { id: 'shop', kind: 'info', name: 'Shop', icon: '🎨', x: 7, z: 5, r: 1.5, color: '#f5d474', desc: 'Tarnmuster und Joker' },
  { id: 'ranks', kind: 'info', name: 'Rangliste', icon: '🏆', x: -7, z: 5, r: 1.5, color: '#f5d474', desc: 'Die Besten' },
  { id: 'medals', kind: 'info', name: 'Medaillen', icon: '🏅', x: 7, z: -6, r: 1.5, color: '#f5d474', desc: 'Deine Auszeichnungen' },
  { id: 'lexicon', kind: 'info', name: 'Lexikon', icon: '📖', x: -7, z: -6, r: 1.5, color: '#f5d474', desc: 'Fahrzeuge und Technik' },
];

// Gebäude hinter jeder Spiel-Station (von der Mitte weg)
export const STATIONS = RAW.map((s) => {
  const d = Math.hypot(s.x, s.z) || 1, ux = s.x / d, uz = s.z / d;
  const off = s.kind === 'game' ? s.r + 5.5 : 0;
  return { ...s, bx: s.x + ux * off, bz: s.z + uz * off, rot: Math.atan2(ux, uz) };
});
export const stationById = (id) => STATIONS.find((s) => s.id === id);

// Hindernisse: Rechtecke (Mittelpunkt, halbe Breite/Tiefe) – Gebäude der Spiel-Stationen
export const BOXES = STATIONS.filter((s) => s.kind === 'game').map((s) => ({ x: s.bx, z: s.bz, hw: s.id === 'battle' ? 5 : 4, hd: s.id === 'battle' ? 4 : 3, rot: s.rot, h: s.id === 'quiz' ? 6 : 4.5, id: s.id }));
// Fahnenmast in der Mitte
export const POLES = [{ x: 0, z: 0, r: 0.5 }];

// Bäume (feste Positionen, weit weg von Stationen und Wegen)
function rnd(seed) { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; }
export const TREES = (() => {
  const r = rnd(4242), out = [];
  for (let i = 0; i < 400 && out.length < 70; i++) {
    const x = (r() - 0.5) * 90, z = (r() - 0.5) * 90;
    if (Math.hypot(x, z) < 14) continue;
    if (STATIONS.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 6 || Math.hypot(s.bx - x, s.bz - z) < 8)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 4)) continue;
    out.push({ x, z, r: 0.6, s: 0.8 + r() * 0.6 });
  }
  return out;
})();

// Punkt in gedrehtes Rechteck-Koordinatensystem
function local(b, x, z) {
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot), dx = x - b.x, dz = z - b.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
function world(b, lx, lz) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return { x: b.x + lx * c - lz * s, z: b.z + lx * s + lz * c };
}

// Schiebt eine Position aus allen Hindernissen (Kreis gegen Rechtecke/Kreise)
export function collideWorld(p, r = PLAYER_R) {
  for (const b of BOXES) {
    const l = local(b, p.x, p.z);
    const cx = Math.max(-b.hw, Math.min(b.hw, l.x)), cz = Math.max(-b.hd, Math.min(b.hd, l.z));
    let dx = l.x - cx, dz = l.z - cz, d = Math.hypot(dx, dz);
    if (d < r) {
      if (d < 1e-6) { // innen: kürzester Weg hinaus
        const opts = [[b.hw - l.x, 1, 0], [l.x + b.hw, -1, 0], [b.hd - l.z, 0, 1], [l.z + b.hd, 0, -1]].sort((a, c) => a[0] - c[0]);
        l.x += opts[0][1] * (opts[0][0] + r); l.z += opts[0][2] * (opts[0][0] + r);
      } else { l.x = cx + dx / d * r; l.z = cz + dz / d * r; }
      const w = world(b, l.x, l.z); p.x = w.x; p.z = w.z;
    }
  }
  for (const t of [...TREES, ...POLES]) {
    const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz), m = r + t.r;
    if (d < m && d > 1e-6) { p.x = t.x + dx / d * m; p.z = t.z + dz / d * m; }
  }
  p.x = Math.max(-BOUND, Math.min(BOUND, p.x)); p.z = Math.max(-BOUND, Math.min(BOUND, p.z));
  return p;
}

export function plateAt(x, z) {
  for (const s of STATIONS) if (Math.hypot(s.x - x, s.z - z) <= s.r) return s;
  return null;
}

export function spawnPoint(i = 0) {
  const a = i * 2.39996, d = 3 + (i % 5);
  return { x: Math.cos(a) * d, z: Math.sin(a) * d };
}

// Teamfarben, die der Chef im Gefecht auswählen kann
export const TEAM_COLORS = [
  { name: 'Blau', c: '#3f7fd0' }, { name: 'Rot', c: '#d0453f' }, { name: 'Grün', c: '#3fa14a' }, { name: 'Gelb', c: '#e0b12f' },
  { name: 'Lila', c: '#8e4fc0' }, { name: 'Orange', c: '#e0782a' }, { name: 'Schwarz', c: '#2d3136' }, { name: 'Weiß', c: '#e6e6e6' },
];
