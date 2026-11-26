// Morse-Funker: Morsezeichen hören/sehen und den richtigen Buchstaben finden
import { sfx } from '../audio.js';

export const MORSE = {
  A: '·–', B: '–···', C: '–·–·', D: '–··', E: '·', F: '··–·', G: '––·', H: '····', I: '··', J: '·–––', K: '–·–', L: '·–··', M: '––',
  N: '–·', O: '–––', P: '·––·', Q: '––·–', R: '·–·', S: '···', T: '–', U: '··–', V: '···–', W: '·––', X: '–··–', Y: '–·––', Z: '––··',
  1: '·––––', 2: '··–––', 3: '···––', 4: '····–', 5: '·····', 6: '–····', 7: '––···', 8: '–––··', 9: '––––·', 0: '–––––',
};
const EASY = 'ETIANMSO'.split(''), MID = 'ETIANMSURWDKGOHVLF'.split(''), ALL = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'];
const TIME = 60, DOT = 0.13;

export default {
  id: 'morse', sticks: false, title: 'Morse-Funker',
  help: `<p>Du bist Funker! Ein Morsezeichen wird <b>gesendet</b> (Licht und Ton). Finde den richtigen Buchstaben – so schnell du kannst. Du hast <b>60 Sekunden</b>.</p>
  <p>· = kurz &nbsp; – = lang. Die <b>Morsetabelle</b> unten hilft dir.</p>
  <p>Schnelle Antworten und Serien geben Bonuspunkte. Später kommen schwerere Buchstaben und Zahlen dazu.</p>`,
  create(stage) {
    const S = { time: TIME, score: 0, over: false, streak: 0, right: 0, round: null, playing: false, started: false };
    const box = document.createElement('div');
    box.className = 'morse';
    box.innerHTML = `<div class="row" style="justify-content:center;font-weight:800;font-size:18px"><span class="pill" id="mTime">⏱ 60</span><span class="pill gold" id="mScore">⭐ 0</span><span class="pill" id="mStreak">🔥 0</span></div>
      <div class="lamp" id="mLamp"></div><div class="code" id="mCode"></div>
      <button class="btn dark small" id="mAgain">🔁 Nochmal senden</button>
      <div class="mopts" id="mOpts"></div>
      <div class="mtable">${ALL.map((k) => `<div><b>${k}</b><span>${MORSE[k]}</span></div>`).join('')}</div>`;
    stage.hud.appendChild(box);
    stage.canvas.style.display = 'none';
    const lamp = box.querySelector('#mLamp'), code = box.querySelector('#mCode'), opts = box.querySelector('#mOpts');
    let timers = [];
    const clear = () => { timers.forEach(clearTimeout); timers = []; lamp.classList.remove('on'); };

    function play(letter) {
      clear();
      S.playing = true;
      code.textContent = '';
      let t = 0.15;
      const seq = MORSE[letter];
      [...seq].forEach((s, i) => {
        const d = s === '·' ? DOT : DOT * 3;
        timers.push(setTimeout(() => { lamp.classList.add('on'); sfx.beep(d); code.textContent = seq.slice(0, i + 1); }, t * 1000));
        timers.push(setTimeout(() => lamp.classList.remove('on'), (t + d) * 1000));
        t += d + DOT;
      });
      timers.push(setTimeout(() => { S.playing = false; }, t * 1000));
    }
    function next() {
      const pool = S.right < 6 ? EASY : S.right < 14 ? MID : ALL;
      let letter;
      do { letter = pool[Math.floor(Math.random() * pool.length)]; } while (S.round && letter === S.round.letter);
      const choices = new Set([letter]);
      while (choices.size < 4) choices.add(pool[Math.floor(Math.random() * pool.length)]);
      const list = [...choices].sort(() => Math.random() - 0.5);
      S.round = { letter, t: 0, done: false };
      opts.innerHTML = list.map((c) => `<button data-c="${c}">${c}</button>`).join('');
      for (const b of opts.querySelectorAll('button')) b.addEventListener('click', () => answer(b));
      play(letter);
    }
    function answer(b) {
      if (!S.round || S.round.done || S.over) return;
      S.round.done = true;
      const ok = b.dataset.c === S.round.letter;
      if (ok) {
        S.streak++; S.right++;
        const pts = 100 + Math.max(0, Math.round(100 - S.round.t * 15)) + Math.min(10, S.streak) * 10;
        S.score += pts; b.classList.add('right'); sfx.right();
      } else {
        S.streak = 0; b.classList.add('wrong'); sfx.wrong();
        opts.querySelector(`[data-c="${S.round.letter}"]`).classList.add('right');
        code.textContent = MORSE[S.round.letter];
      }
      box.querySelector('#mScore').textContent = '⭐ ' + S.score;
      box.querySelector('#mStreak').textContent = '🔥 ' + S.streak;
      timers.push(setTimeout(() => { if (!S.over) next(); }, ok ? 500 : 1300));
    }
    box.querySelector('#mAgain').addEventListener('click', () => { if (S.round && !S.round.done) play(S.round.letter); });
    return {
      get over() { return S.over; }, get score() { return S.score; },
      destroy() { clear(); box.remove(); stage.canvas.style.display = ''; },
      update(dt) {
        if (S.over) return;
        if (!S.started) { S.started = true; next(); }
        S.time -= dt;
        if (S.round && !S.round.done && !S.playing) S.round.t += dt;
        box.querySelector('#mTime').textContent = '⏱ ' + Math.max(0, Math.ceil(S.time));
        if (S.time <= 0) { S.over = true; clear(); }
      },
      draw() {},
    };
  },
};
