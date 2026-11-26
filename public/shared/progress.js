// Spielfortschritt: Ränge, Münzen, Shop (Tarnmuster), Joker, Medaillen, Minispiel-Belohnungen.
// Wird im Browser (Anzeige) und auf dem Server (verbindliche Berechnung) benutzt.

export const RANKS = [
  [0, 'Rekrut'], [100, 'Gefreiter'], [250, 'Obergefreiter'], [450, 'Hauptgefreiter'],
  [700, 'Unteroffizier'], [1000, 'Stabsunteroffizier'], [1400, 'Feldwebel'], [1900, 'Oberfeldwebel'], [2500, 'Hauptfeldwebel'],
  [3200, 'Leutnant'], [4000, 'Oberleutnant'], [5000, 'Hauptmann'],
  [6200, 'Major'], [7600, 'Oberstleutnant'], [9200, 'Oberst'],
  [11000, 'Brigadegeneral'], [13500, 'Generalmajor'], [16500, 'Generalleutnant'], [20000, 'General'],
];
// Gruppe für das Abzeichen: [Gruppe, Anzahl Symbole]
export const RANK_BADGE = [
  ['m', 0], ['m', 1], ['m', 2], ['m', 3],
  ['u', 1], ['u', 2], ['u', 3], ['u', 4], ['u', 5],
  ['o', 1], ['o', 2], ['o', 3],
  ['s', 1], ['s', 2], ['s', 3],
  ['g', 1], ['g', 2], ['g', 3], ['g', 4],
];

export function rankInfo(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
  const cur = RANKS[i][0], next = RANKS[i + 1] ? RANKS[i + 1][0] : null;
  return { i, name: RANKS[i][1], next, nextName: next ? RANKS[i + 1][1] : null, progress: next ? (xp - cur) / (next - cur) : 1 };
}

// Tarnmuster für Panzer und Soldaten
export const SKINS = {
  oliv: { name: 'Oliv', price: 0, colors: ['#5d6b3a', '#4a5530', '#717f48'] },
  wald: { name: 'Flecktarn', price: 150, colors: ['#4f5d31', '#2f3a22', '#7a6a3f'] },
  wueste: { name: 'Wüste', price: 200, colors: ['#c2a66b', '#a0844e', '#dcc48f'] },
  winter: { name: 'Winter', price: 250, colors: ['#e6ebef', '#aab4bd', '#ffffff'] },
  urban: { name: 'Stadt', price: 300, colors: ['#7d8288', '#55595e', '#a5aab0'] },
  marine: { name: 'Marine', price: 350, colors: ['#2f4b6e', '#1f3350', '#4c6d96'] },
  nacht: { name: 'Nacht', price: 450, colors: ['#26282b', '#141516', '#3c4045'] },
  digital: { name: 'Digital', price: 600, colors: ['#6b7a52', '#3f4a30', '#9aa37a'] },
  tiger: { name: 'Tiger', price: 900, colors: ['#d9822b', '#2a2118', '#f0a24a'] },
  gold: { name: 'Gold', price: 2500, colors: ['#d8b13a', '#a9852a', '#f7dc7a'] },
};
export const SKIN_ORDER = Object.keys(SKINS);
export const JOKER_PRICE = 40;

// Minispiele: max. Punkte (Schutz vor Schummeln), Mindestabstand zwischen zwei Belohnungen, Belohnung aus Punkten
export const GAMES = {
  battle: { name: 'Gefecht 5 gegen 5', icon: '🪖', max: 60, gap: 45 },
  range: { name: 'Panzer-Schießstand', icon: '🎯', max: 12000, gap: 40, xp: (s) => s / 40, coins: (s) => s / 60 },
  aa: { name: 'Flugabwehr', icon: '🛩️', max: 12000, gap: 40, xp: (s) => s / 40, coins: (s) => s / 60 },
  para: { name: 'Fallschirmsprung', icon: '🪂', max: 6000, gap: 25, xp: (s) => s / 30, coins: (s) => s / 45 },
  mines: { name: 'Minenräumer', icon: '💣', max: 3000, gap: 8, xp: (s) => s / 15, coins: (s) => s / 25 },
  morse: { name: 'Morse-Funker', icon: '📻', max: 6000, gap: 30, xp: (s) => s / 30, coins: (s) => s / 45 },
};
export const MINIGAMES = ['range', 'aa', 'para', 'mines', 'morse'];
const REWARD_CAP = { xp: 200, coins: 140 };

export const MEDALS = {
  first_quiz: { name: 'Erste Prüfung', desc: 'Spiele dein erstes Quiz', icon: '📝' },
  perfect: { name: 'Fehlerlos', desc: 'Alle Fragen eines Quiz richtig', icon: '💯' },
  brain100: { name: 'Schlauer Kopf', desc: '100 Fragen richtig beantwortet', icon: '🧠' },
  brain500: { name: 'Militär-Professor', desc: '500 Fragen richtig beantwortet', icon: '🎓' },
  duel_win: { name: 'Duell-Sieger', desc: 'Gewinne ein Online-Quiz-Duell', icon: '⚔️' },
  battle_win: { name: 'Sieg im Gefecht', desc: 'Gewinne ein Gefecht 5 gegen 5', icon: '🏆' },
  battle10: { name: 'Veteran', desc: 'Gewinne 10 Gefechte', icon: '🎖️' },
  kills100: { name: 'Scharfschütze', desc: '100 Gegner im Gefecht ausgeschaltet', icon: '🔭' },
  tank_ace: { name: 'Panzer-Ass', desc: '5 Gegner in einem Gefecht mit dem Panzer', icon: '🛡️' },
  range2000: { name: 'Zielsicher', desc: '2.000 Punkte am Panzer-Schießstand', icon: '🎯' },
  aa2000: { name: 'Himmelswächter', desc: '2.000 Punkte bei der Flugabwehr', icon: '🛩️' },
  para3000: { name: 'Punktlandung', desc: '3.000 Punkte beim Fallschirmsprung', icon: '🪂' },
  mines_win: { name: 'Minenräumer', desc: 'Räume ein ganzes Minenfeld', icon: '💣' },
  morse2000: { name: 'Funker', desc: '2.000 Punkte beim Morse-Funker', icon: '📻' },
  all_games: { name: 'Allrounder', desc: 'Spiele jedes Minispiel einmal', icon: '🌟' },
  rank_uffz: { name: 'Unteroffizier', desc: 'Erreiche den Rang Unteroffizier', icon: '🔰' },
  rank_lt: { name: 'Offizier', desc: 'Erreiche den Rang Leutnant', icon: '⭐' },
  rank_gen: { name: 'General', desc: 'Erreiche den Rang General', icon: '👑' },
  collector: { name: 'Sammler', desc: 'Besitze 5 Tarnmuster', icon: '🎨' },
  streak7: { name: 'Pflichtbewusst', desc: '7 Tage hintereinander zum Dienst', icon: '📅' },
};
export const MEDAL_ORDER = Object.keys(MEDALS);
export const MEDAL_COINS = 50;

const int = (v, lo, hi) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };

export function freshProfile() {
  return {
    name: 'Rekrut',
    xp: 0, coins: 100, jokers: 3,
    skins: ['oliv'], skin: 'oliv',
    medals: [],
    best: {},
    stats: { quizzes: 0, correct: 0, answered: 0, perfect: 0, duels: 0, duelWins: 0, battles: 0, battleWins: 0, kills: 0, games: {} },
    last: {},
    daily: { day: '', streak: 0 },
  };
}

// Repariert/ergänzt ein gespeichertes Profil
export function normalize(p) {
  const f = freshProfile();
  if (!p || typeof p !== 'object') return f;
  const out = { ...f, ...p };
  out.name = String(out.name || f.name).slice(0, 20);
  out.xp = int(out.xp, 0, 1e9); out.coins = int(out.coins, 0, 1e9); out.jokers = int(out.jokers, 0, 999);
  out.skins = Array.isArray(out.skins) ? [...new Set(out.skins.filter((s) => SKINS[s]))] : ['oliv'];
  if (!out.skins.includes('oliv')) out.skins.unshift('oliv');
  if (!out.skins.includes(out.skin)) out.skin = 'oliv';
  out.medals = Array.isArray(out.medals) ? [...new Set(out.medals.filter((m) => MEDALS[m]))] : [];
  out.best = typeof out.best === 'object' && out.best ? out.best : {};
  out.stats = { ...f.stats, ...(typeof out.stats === 'object' && out.stats ? out.stats : {}) };
  out.stats.games = typeof out.stats.games === 'object' && out.stats.games ? out.stats.games : {};
  out.last = typeof out.last === 'object' && out.last ? out.last : {};
  out.daily = { ...f.daily, ...(typeof out.daily === 'object' && out.daily ? out.daily : {}) };
  return out;
}

// Prüft Medaillen; neue Medaillen geben Münzen. Gibt die Liste neuer Medaillen zurück.
export function checkMedals(p, extra = {}) {
  const s = p.stats, have = new Set(p.medals), got = [];
  const give = (k, cond) => { if (cond && !have.has(k)) { have.add(k); p.medals.push(k); got.push(k); p.coins += MEDAL_COINS; } };
  give('first_quiz', s.quizzes >= 1);
  give('perfect', s.perfect >= 1);
  give('brain100', s.correct >= 100);
  give('brain500', s.correct >= 500);
  give('duel_win', s.duelWins >= 1);
  give('battle_win', s.battleWins >= 1);
  give('battle10', s.battleWins >= 10);
  give('kills100', s.kills >= 100);
  give('tank_ace', (p.best.tankKills || 0) >= 5);
  give('range2000', (p.best.range || 0) >= 2000);
  give('aa2000', (p.best.aa || 0) >= 2000);
  give('para3000', (p.best.para || 0) >= 3000);
  give('mines_win', (s.games.minesWon || 0) >= 1);
  give('morse2000', (p.best.morse || 0) >= 2000);
  give('all_games', MINIGAMES.every((g) => (s.games[g] || 0) >= 1) && s.battles >= 1);
  const r = rankInfo(p.xp).i;
  give('rank_uffz', r >= 4);
  give('rank_lt', r >= 9);
  give('rank_gen', r >= RANKS.length - 1);
  give('collector', p.skins.length >= 5);
  give('streak7', p.daily.streak >= 7);
  if (extra.silent) return got;
  return got;
}

function grant(p, xp, coins) {
  const before = rankInfo(p.xp).i;
  xp = Math.max(0, Math.round(xp)); coins = Math.max(0, Math.round(coins));
  p.xp += xp; p.coins += coins;
  const after = rankInfo(p.xp).i;
  return { xp, coins, rankUp: after > before ? RANKS[after][1] : null };
}

// Ergebnis eines Solo-Quiz (serverseitig ausgewertet)
export function applyQuiz(p, { correct, total, points }) {
  p.stats.quizzes++; p.stats.correct += correct; p.stats.answered += total;
  const perfect = total >= 5 && correct === total;
  if (perfect) p.stats.perfect++;
  if (points > (p.best.quiz || 0)) p.best.quiz = points;
  const r = grant(p, correct * 10 + (perfect ? 50 : 0), correct * 5 + (perfect ? 30 : 0));
  return { ...r, correct, total, points, perfect, medals: checkMedals(p) };
}

// Ergebnis eines Online-Quiz-Duells
export function applyDuel(p, { correct, total, points, place, players }) {
  p.stats.duels++; p.stats.correct += correct; p.stats.answered += total;
  const won = place === 1 && players > 1;
  if (won) p.stats.duelWins++;
  if (points > (p.best.quiz || 0)) p.best.quiz = points;
  const bonus = won ? 60 : place === 2 ? 25 : 10;
  const r = grant(p, correct * 10 + bonus, correct * 5 + Math.round(bonus / 2));
  return { ...r, correct, total, points, place, won, medals: checkMedals(p) };
}

// Ergebnis eines Gefechts (online vom Server, offline vom Client gemeldet und begrenzt)
export function applyBattle(p, { outcome, kills, tankKills = 0 }) {
  kills = int(kills, 0, GAMES.battle.max); tankKills = int(tankKills, 0, kills);
  p.stats.battles++; p.stats.kills += kills;
  if (outcome === 'win') p.stats.battleWins++;
  if (kills > (p.best.battle || 0)) p.best.battle = kills;
  if (tankKills > (p.best.tankKills || 0)) p.best.tankKills = tankKills;
  const base = outcome === 'win' ? [60, 40] : outcome === 'draw' ? [35, 25] : [20, 15];
  const r = grant(p, base[0] + kills * 5, base[1] + kills * 3);
  return { ...r, outcome, kills, medals: checkMedals(p) };
}

// Ergebnis eines Minispiels
export function applyGame(p, game, score, extra = {}) {
  const g = GAMES[game];
  if (!g || !g.xp) return null;
  score = int(score, 0, g.max);
  p.stats.games[game] = (p.stats.games[game] || 0) + 1;
  if (game === 'mines' && extra.won) p.stats.games.minesWon = (p.stats.games.minesWon || 0) + 1;
  const record = score > (p.best[game] || 0);
  if (record) p.best[game] = score;
  const r = grant(p, Math.min(REWARD_CAP.xp, g.xp(score)), Math.min(REWARD_CAP.coins, g.coins(score)));
  return { ...r, game, score, record, medals: checkMedals(p) };
}

export function dayString(t = Date.now()) { return new Date(t).toISOString().slice(0, 10); }

// Tägliche Belohnung (Dienstantritt)
export function claimDaily(p, now = Date.now()) {
  const today = dayString(now), yesterday = dayString(now - 864e5);
  if (p.daily.day === today) return null;
  p.daily.streak = p.daily.day === yesterday ? p.daily.streak + 1 : 1;
  p.daily.day = today;
  const coins = 40 + Math.min(6, p.daily.streak - 1) * 10;
  const r = grant(p, 20, coins);
  if (p.daily.streak % 3 === 0) p.jokers++;
  return { ...r, streak: p.daily.streak, joker: p.daily.streak % 3 === 0, medals: checkMedals(p) };
}

// Kaufen / Ausrüsten
export function runShop(p, action) {
  if (action.type === 'buy') {
    if (action.item === 'joker') {
      const n = int(action.count || 1, 1, 10);
      if (p.coins < JOKER_PRICE * n) return { error: 'Nicht genug Münzen.' };
      p.coins -= JOKER_PRICE * n; p.jokers += n;
      return { ok: true };
    }
    const s = SKINS[action.item];
    if (!s) return { error: 'Gibt es nicht.' };
    if (p.skins.includes(action.item)) return { error: 'Hast du schon.' };
    if (p.coins < s.price) return { error: 'Nicht genug Münzen.' };
    p.coins -= s.price; p.skins.push(action.item); p.skin = action.item;
    return { ok: true, medals: checkMedals(p) };
  }
  if (action.type === 'equip') {
    if (!p.skins.includes(action.item)) return { error: 'Noch nicht gekauft.' };
    p.skin = action.item;
    return { ok: true };
  }
  return { error: 'Unbekannte Aktion.' };
}
