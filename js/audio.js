// Audio procédural (Web Audio API) : musique d'ambiance générative sombre
// + effets sonores d'interface. Aucun fichier audio requis.
// La musique est une nappe de pads sur une progression Am–F–Dm–E,
// une basse discrète et une mélodie éparse — générée en temps réel.
import { G, ctx, W, H } from './state.js';
import { roundRect } from './utils.js';

let AC = null;          // AudioContext (créé au premier geste utilisateur)
let master = null, musicBus = null, sfxBus = null;
const MUSIC_GAIN = 0.55;
let step = 0, nextT = 0, timer = null;

let on = true;
try { on = localStorage.getItem('rpg2d_music') !== '0'; } catch (e) {}
let vol = 65; // volume musique 0-100 (persisté)
try { vol = Math.max(0, Math.min(100, parseInt(localStorage.getItem('rpg2d_vol') || '65') || 65)); } catch (e) {}
const volGain = () => (vol / 100) * 0.9;
let sfxVol = 75; // volume effets 0-100 (persisté)
try { sfxVol = Math.max(0, Math.min(100, parseInt(localStorage.getItem('rpg2d_sfx') || '75') || 75)); } catch (e) {}
const sfxGain = () => (sfxVol / 100) * 0.9;
let sfxOn = true; // effets sonores activés (persisté)
try { sfxOn = localStorage.getItem('rpg2d_sfx_on') !== '0'; } catch (e) {}

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
// musique par campagne : chaque monde a son thème (gamme, tempo, timbre des pads)
const MUSIC_THEMES = {
  0: { // Les Terres Oubliées : mineur épique, ~115 BPM
    chords: [[45, 57, 60, 64], [41, 53, 57, 60], [38, 50, 53, 57], [40, 52, 55, 59]],
    beat: 0.52, pad: 'triangle'
  },
  1: { // La Terre Gelée : plus lent, nappes froides (Dm7 – Bb – Gm7 – Cmaj7)
    chords: [[50, 62, 65, 69], [46, 58, 62, 65], [43, 55, 58, 62], [48, 60, 64, 67]],
    beat: 0.62, pad: 'sine'
  },
  2: { // Les Enfers : phrygien sombre et rapide (Em7 – F – G7 – E majeur, ~136 BPM)
    chords: [[40, 52, 55, 59], [41, 53, 57, 60], [43, 55, 59, 62], [40, 52, 56, 59]],
    beat: 0.44, pad: 'sawtooth'
  },
  3: { // Les Égouts : mineur boueux et visqueux (Dm – Bb – F – C, ~100 BPM)
    chords: [[38, 50, 53, 57], [34, 46, 50, 53], [41, 53, 57, 60], [48, 60, 64, 67]],
    beat: 0.60, pad: 'triangle'
  },
  4: { // L'Espace : planant et mystérieux (Am9 – Fmaj7 – Cmaj7 – G, ~90 BPM)
    chords: [[45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [48, 60, 64, 67, 71], [43, 55, 59, 62, 67]],
    beat: 0.66, pad: 'sine'
  }
};
const theme = () => MUSIC_THEMES[G.campaign] || MUSIC_THEMES[0];
const beatLen = () => theme().beat;

// ---------- moteur ----------
// à appeler sur chaque geste utilisateur (clic, touche) : les navigateurs
// exigent une interaction avant de jouer du son
export function ensureAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.85;
      master.connect(AC.destination);
      // bus musique : filtré pour un son feutré
      musicBus = AC.createGain();
      musicBus.gain.value = on ? volGain() : 0;
      const lp = AC.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = 0.4;
      musicBus.connect(lp); lp.connect(master);
      // bus effets : tous les SFX de jeu passent par ce volume
      sfxBus = AC.createGain();
      sfxBus.gain.value = sfxOn ? sfxGain() : 0;
      sfxBus.connect(master);
      nextT = AC.currentTime + 0.1;
      timer = setInterval(scheduleBar, 200);
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}

export function musicOn() { return on; }
export function musicVol() { return vol; }
export function sfxVolume() { return sfxVol; }
export function setSfxVol(v) {
  sfxVol = Math.max(0, Math.min(100, Math.round(v)));
  try { localStorage.setItem('rpg2d_sfx', String(sfxVol)); } catch (e) {}
  if (AC && sfxBus) sfxBus.gain.setTargetAtTime(sfxGain(), AC.currentTime, 0.05);
}
export function setMusicVol(v) {
  vol = Math.max(0, Math.min(100, Math.round(v)));
  try { localStorage.setItem('rpg2d_vol', String(vol)); } catch (e) {}
  if (AC && musicBus && on) musicBus.gain.setTargetAtTime(volGain(), AC.currentTime, 0.05);
}

export function sfxOnState() { return sfxOn; }
export function toggleSfx() {
  sfxOn = !sfxOn;
  try { localStorage.setItem('rpg2d_sfx_on', sfxOn ? '1' : '0'); } catch (e) {}
  if (AC && sfxBus) sfxBus.gain.setTargetAtTime(sfxOn ? sfxGain() : 0, AC.currentTime, 0.02);
  return sfxOn;
}

export function toggleMusic() {
  on = !on;
  try { localStorage.setItem('rpg2d_music', on ? '1' : '0'); } catch (e) {}
  // coupure immédiate : on écrête le bus musical (les notes déjà programmées
  // ne passent plus), et on le rétablit en douceur à la réactivation
  if (AC && musicBus) {
    musicBus.gain.cancelScheduledValues(AC.currentTime);
    musicBus.gain.setTargetAtTime(on ? volGain() : 0, AC.currentTime, on ? 0.15 : 0.015);
  }
  return on;
}

// ---------- synthèse ----------
function tone(freq, t, dur, type, vol, dest, detune = 0) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.15, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || musicBus);
  o.start(t); o.stop(t + dur + 0.05);
}

function padChord(notes, t, dur, type) {
  for (const n of notes) {
    for (const det of [-5, 5]) {
      const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
      o.type = type || 'triangle'; o.frequency.value = mtof(n); o.detune.value = det;
      f.type = 'lowpass'; f.frequency.value = 850;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.04, t + 1.5);
      g.gain.setValueAtTime(0.04, t + Math.max(0.1, dur - 1.4));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
}

function bassNote(n, t) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.value = mtof(n);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.11, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + beatLen() * 3.4);
  o.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + beatLen() * 3.5);
}

function pluck(n, t, dur = 0.55) {
  tone(mtof(n), t, dur, 'triangle', 0.06);
  tone(mtof(n) * 2, t, dur * 0.55, 'sine', 0.02);
}

function bell(n, t) {
  tone(mtof(n), t, 2.2, 'sine', 0.05);
  tone(mtof(n) * 2.76, t, 1.4, 'sine', 0.015);
}

let noiseBuf = null;
function getNoise() {
  if (!noiseBuf) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 1, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
// coup de grosse caisse : sine qui chute 130 -> 42 Hz
function kick(t) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + 0.26);
}
// charleston : bruit filtré très court sur les contretemps
function hat(t) {
  const s = AC.createBufferSource(); s.buffer = getNoise();
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.07, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  s.connect(f); f.connect(g); g.connect(musicBus);
  s.start(t); s.stop(t + 0.06);
}
// caisse claire : bruit medium + ton
function snare(t) {
  const s = AC.createBufferSource(); s.buffer = getNoise();
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  s.connect(f); f.connect(g); g.connect(musicBus);
  s.start(t); s.stop(t + 0.13);
  tone(190, t, 0.09, 'triangle', 0.07);
}

function playStep(s, t) {
  const bt = beatLen();
  const chord = theme().chords[Math.floor(s / 8) % theme().chords.length];
  const inBar = s % 8;
  if (inBar === 0) padChord(chord, t, bt * 8.6, theme().pad);
  // batterie : grosse caisse sur 1 et 3, caisse claire sur 2 et 4, charlestons en croches
  if (inBar === 0 || inBar === 4) kick(t);
  if (inBar === 2 || inBar === 6) snare(t);
  hat(t + bt / 2);
  // basse martelée : croche + noire -> pulse entraînant
  bassNote(chord[0], t);
  bassNote(chord[0] - 12, t + bt / 2);
  // arpège : cycle les notes de l'accord à l'octave sup, une note sur deux temps
  const arp = chord[(s * 7 + 3) % chord.length] + 24;
  if (s % 2 === 0) pluck(arp, t, 0.4);
  // mélodie éparse : notes du chord à l'octave supérieure, choix pseudo-aléatoire stable
  const h = (s * 2654435761) >>> 0;
  if (inBar % 2 === 0 && h % 100 < 30) {
    const n = chord[(h >> 6) % chord.length] + 24 + ((h >> 12) % 2) * 12;
    pluck(n, t);
  }
  if (s % 32 === 16) bell(chord[2] + 24, t);
}

// ordonnanceur : planifie les temps forts à l'avance (précision ~200ms)
function scheduleBar() {
  if (!AC) return;
  if (!on) { nextT = Math.max(nextT, AC.currentTime + 0.1); return; }
  const ahead = AC.currentTime + 0.55;
  if (nextT < AC.currentTime) nextT = AC.currentTime + 0.05;
  while (nextT < ahead) {
    try { playStep(step, nextT); } catch (e) {} // un pas raté ne doit jamais crasher le jeu
    nextT += beatLen();
    step++;
  }
}

// cliquetis d'interface (boutons du menu)
export function sfxClick() {
  if (!AC) return;
  try {
  const t = AC.currentTime;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(660, t);
  o.frequency.exponentialRampToValueAtTime(320, t + 0.09);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g); g.connect(sfxBus || master);
  o.start(t); o.stop(t + 0.12);
  } catch (e) {}
}

// petit arpège de confirmation (nouvelle partie, victoire…)
export function sfxConfirm() {
  if (!AC) return;
  try {
  const t = AC.currentTime;
  [523, 659, 784].forEach((f, i) => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = t + i * 0.07;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    o.connect(g); g.connect(sfxBus || master);
    o.start(t0); o.stop(t0 + 0.4);
  });
  } catch (e) {}
}

// ---------- boutons ON/OFF (coin haut-droit, toutes les interfaces) ----------
// deux pastilles empilées : MUSIQUE puis EFFETS
export const AUDIO_BTNS = {
  mus: { x: W * 0.77, y: 8, w: 84, h: 30 },
  sfx: { x: W * 0.845, y: 8, w: 84, h: 30 }
};
export function audioButtonAt(x, y) {
  for (const k in AUDIO_BTNS) {
    const r = AUDIO_BTNS[k];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return k;
  }
  return null;
}

function drawAudioBtn(r, label, active, color) {
  const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w &&
              G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
  ctx.save();
  ctx.fillStyle = hov ? 'rgba(30,32,36,0.9)' : 'rgba(12,14,16,0.75)';
  roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  ctx.strokeStyle = hov ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 8); ctx.stroke();
  ctx.fillStyle = active ? color : '#4a4e54';
  ctx.beginPath(); ctx.arc(r.x + 15, r.y + r.h / 2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = '600 10px Inter, sans-serif'; ctx.letterSpacing = '0.8px';
  ctx.fillStyle = active ? '#e8e2d2' : '#6f7378';
  ctx.fillText(label, r.x + 26, r.y + r.h / 2 + 3.5);
  ctx.restore();
}

export function drawMusicButton() {
  drawAudioBtn(AUDIO_BTNS.mus, 'MUSIQUE', on, '#d4b062');
  drawAudioBtn(AUDIO_BTNS.sfx, 'EFFETS', sfxOn, '#7fb8d6');
}

// ==================== EFFETS SONORES DE JEU ====================
// tous routés via sfxBus (volume "EFFETS" du panneau)
function sfxReady() { return !!(AC && sfxBus); }
function osc(type, f0, f1, t, dur, vol) {
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) {}
}
function nz(t, dur, vol, type, freq, q = 1) {
  try {
    const s = AC.createBufferSource(); s.buffer = getNoise();
    const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t); s.stop(t + dur + 0.05);
  } catch (e) {}
}
const ST = () => AC.currentTime;

export function sfxSlash() { // coup d'épée : whoosh + claquement d'acier
  if (!sfxReady()) return; const t = ST();
  nz(t, 0.16, 0.22, 'bandpass', 2400, 1.4);
  osc('square', 900, 300, t, 0.07, 0.05);
}
export function sfxThrust() { // estoc de lance : souffle + pointe métallique
  if (!sfxReady()) return; const t = ST();
  nz(t, 0.1, 0.18, 'bandpass', 3200, 2);
  osc('sawtooth', 500, 1400, t, 0.09, 0.05);
}
export function sfxSpin() { // rotation : grand whoosh tournoyant
  if (!sfxReady()) return; const t = ST();
  nz(t, 0.35, 0.16, 'bandpass', 1200, 0.8);
  osc('sine', 300, 700, t, 0.3, 0.04);
}
export function sfxShield() { // dôme : bulle cristalline montante
  if (!sfxReady()) return; const t = ST();
  osc('sine', 400, 1200, t, 0.4, 0.07);
  osc('sine', 800, 1600, t + 0.05, 0.35, 0.04);
  nz(t, 0.3, 0.05, 'highpass', 5000);
}
export function sfxHit() { // impact : thud sec + étincelle
  if (!sfxReady()) return; const t = ST();
  osc('sine', 200, 55, t, 0.12, 0.28);
  nz(t, 0.06, 0.15, 'highpass', 3000);
}
export function sfxHurt() { // le héros est touché : grondement grave
  if (!sfxReady()) return; const t = ST();
  osc('sawtooth', 160, 60, t, 0.25, 0.16);
  nz(t, 0.12, 0.1, 'lowpass', 700);
}
export function sfxDie() { // monstre tué : descente dramatique
  if (!sfxReady()) return; const t = ST();
  osc('square', 320, 70, t, 0.3, 0.1);
  nz(t, 0.2, 0.1, 'bandpass', 900, 1);
}
export function sfxPickup() { // butin : deux notes brillantes
  if (!sfxReady()) return; const t = ST();
  osc('sine', 880, 880, t, 0.09, 0.09);
  osc('sine', 1320, 1320, t + 0.07, 0.12, 0.08);
}
export function sfxPotion() { // fiole : gargouillis montant
  if (!sfxReady()) return; const t = ST();
  osc('sine', 300, 900, t, 0.35, 0.09);
  osc('sine', 450, 1350, t + 0.08, 0.3, 0.05);
}
export function sfxLevel() { // niveau supérieur : petite fanfare
  if (!sfxReady()) return; const t = ST();
  [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, f, t + i * 0.09, 0.3, 0.1));
}
export function sfxCraft() { // forge : 3 coups de marteau + ding final
  if (!sfxReady()) return; const t = ST();
  for (let i = 0; i < 3; i++) { nz(t + i * 0.28, 0.05, 0.2, 'bandpass', 1800, 3); osc('sine', 140, 60, t + i * 0.28, 0.08, 0.2); }
  osc('sine', 1568, 1568, t + 0.9, 0.5, 0.09);
}
export function sfxEquip() { // équipement : cliquet + accord
  if (!sfxReady()) return; const t = ST();
  nz(t, 0.05, 0.18, 'bandpass', 2500, 4);
  osc('triangle', 660, 660, t + 0.06, 0.15, 0.08);
}
export function sfxRepair() { // réparation : limage + étincelles
  if (!sfxReady()) return; const t = ST();
  for (let i = 0; i < 4; i++) nz(t + i * 0.18, 0.06, 0.14, 'highpass', 4000 + i * 500);
  osc('sine', 1200, 1600, t + 0.7, 0.3, 0.06);
}
export function sfxPortal() { // portail : montée scintillante
  if (!sfxReady()) return; const t = ST();
  osc('sine', 200, 1600, t, 0.7, 0.08);
  nz(t, 0.6, 0.05, 'highpass', 6000);
}
export function sfxNuke() { // bombe atomique : coup + explosion dévastatrice
  if (!sfxReady()) return; const t = ST();
  nz(t, 1.6, 0.5, 'lowpass', 500);
  osc('sine', 90, 28, t, 1.4, 0.5);
  nz(t + 0.15, 0.8, 0.3, 'bandpass', 250, 0.6);
}
export function sfxBoss() { // rugissement de boss : grondement sourd enrichi (3 couches)
  if (!sfxReady()) return; const t = ST();
  osc('sawtooth', 70, 45, t, 0.9, 0.2);
  osc('sawtooth', 95, 55, t, 0.9, 0.14);
  osc('sawtooth', 52, 34, t, 1.15, 0.2);   // sous-grave
  osc('square', 140, 60, t + 0.06, 0.7, 0.07);
  nz(t, 0.7, 0.16, 'lowpass', 400);
  nz(t + 0.05, 0.55, 0.11, 'bandpass', 280, 1.6);
  nz(t + 0.12, 0.4, 0.07, 'bandpass', 900, 2);
}
// rugissement du boss FINAL : immense, en deux temps (cri + grondement)
export function sfxBossRoar() {
  if (!sfxReady()) return; const t = ST();
  osc('sawtooth', 55, 30, t, 1.6, 0.3);
  osc('sawtooth', 82, 38, t, 1.6, 0.2);
  osc('square', 38, 22, t, 1.7, 0.16);
  osc('sawtooth', 240, 55, t + 0.3, 1.1, 0.09); // hurlement descendant
  nz(t, 1.4, 0.22, 'lowpass', 320);
  nz(t + 0.08, 1.0, 0.15, 'bandpass', 480, 1.1);
  nz(t + 0.2, 0.7, 0.1, 'highpass', 1800);
}
// transition de phase : coup dramatique + grondement + descente sinistre
export function sfxPhase() {
  if (!sfxReady()) return; const t = ST();
  nz(t, 0.45, 0.3, 'lowpass', 280);
  osc('sine', 120, 30, t, 1.0, 0.42);
  osc('sawtooth', 190, 42, t + 0.05, 0.9, 0.18);
  [311, 392, 466].forEach((f, i) => osc('triangle', f, f * 0.5, t + 0.18 + i * 0.13, 0.5, 0.07));
  nz(t + 0.15, 0.8, 0.08, 'bandpass', 600, 1.4);
}
// effondrement du boss final : long grondement + craquements de débris
export function sfxBossDie() {
  if (!sfxReady()) return; const t = ST();
  osc('sawtooth', 95, 24, t, 2.3, 0.3);
  osc('sine', 62, 18, t, 2.5, 0.36);
  osc('square', 48, 20, t + 0.1, 1.8, 0.12);
  nz(t, 2.0, 0.2, 'lowpass', 340);
  for (let i = 0; i < 6; i++) nz(t + 0.35 + i * 0.33, 0.09, 0.12, 'bandpass', 650 + i * 220, 2.2);
  nz(t + 1.9, 0.5, 0.14, 'lowpass', 200);
}
// attaque signature du boss final : 'fire' | 'ice' | 'shadow' | 'earth'
export function sfxBossAtk(kind) {
  if (!sfxReady()) return; const t = ST();
  if (kind === 'fire') {
    nz(t, 0.55, 0.26, 'lowpass', 620);
    osc('sawtooth', 210, 55, t, 0.55, 0.13);
    nz(t + 0.1, 0.4, 0.14, 'bandpass', 1400, 0.9);
  } else if (kind === 'ice') {
    nz(t, 0.45, 0.2, 'highpass', 3200);
    osc('sine', 1300, 280, t, 0.45, 0.09);
    osc('sine', 1950, 700, t + 0.05, 0.35, 0.05);
  } else if (kind === 'earth') {
    nz(t, 0.7, 0.3, 'lowpass', 260);
    osc('sine', 85, 30, t, 0.7, 0.3);
    nz(t + 0.08, 0.5, 0.16, 'bandpass', 350, 1.2);
  } else if (kind === 'acid') {
    // vase : bouillonnement grave + gouttes acides aiguës
    nz(t, 0.6, 0.22, 'bandpass', 500, 1.4);
    osc('sine', 140, 60, t, 0.6, 0.14);
    osc('sine', 900, 1400, t + 0.12, 0.3, 0.05);
    nz(t + 0.2, 0.4, 0.1, 'highpass', 2400);
  } else if (kind === 'void') {
    // trou noir : sirène descendante + claquement de marée
    osc('sine', 800, 90, t, 0.7, 0.16);
    osc('sine', 1200, 150, t + 0.05, 0.5, 0.08);
    nz(t, 0.55, 0.18, 'bandpass', 900, 2.5);
    nz(t + 0.15, 0.3, 0.1, 'highpass', 4200);
  } else { // shadow / défaut
    nz(t, 0.5, 0.2, 'bandpass', 380, 1);
    osc('square', 150, 55, t, 0.5, 0.11);
    osc('sawtooth', 300, 80, t + 0.08, 0.4, 0.06);
  }
}
// coup porté à un boss : impact lourd métallique + craquement
export function sfxBossHit() {
  if (!sfxReady()) return; const t = ST();
  osc('sine', 170, 45, t, 0.2, 0.32);
  nz(t, 0.09, 0.2, 'bandpass', 1700, 2);
  osc('triangle', 520, 110, t, 0.14, 0.09);
  nz(t + 0.02, 0.05, 0.1, 'highpass', 5000);
}
export function sfxBreak() { // équipement cassé : craquement
  if (!sfxReady()) return; const t = ST();
  nz(t, 0.15, 0.25, 'bandpass', 900, 2);
  osc('square', 220, 50, t, 0.2, 0.15);
}
export function sfxWave() { // nouvelle vague : gong grave
  if (!sfxReady()) return; const t = ST();
  osc('sine', 220, 220, t, 0.8, 0.12);
  osc('sine', 330, 330, t, 0.7, 0.07);
  nz(t, 0.3, 0.06, 'bandpass', 1200, 2);
}
export function sfxWarn() { // alerte : deux notes graves descendantes
  if (!sfxReady()) return; const t = ST();
  osc('sawtooth', 330, 160, t, 0.5, 0.1);
  osc('sawtooth', 220, 110, t + 0.12, 0.55, 0.1);
  nz(t, 0.3, 0.05, 'lowpass', 700, 1);
}

// ---------- ARC CINÉTIQUE COSMIQUE ----------
export function sfxBowFire(power = 0.5) { // tir : zap électronique montant, puissance = charge
  if (!sfxReady()) return; const t = ST();
  const p = Math.min(1, Math.max(0, power));
  // corps :-descente rapide type laser
  osc('sawtooth', 1400 + p * 900, 180, t, 0.14 + p * 0.1, 0.10 + p * 0.08);
  // sifflement d'énergie
  nz(t, 0.12 + p * 0.12, 0.10 + p * 0.10, 'bandpass', 3600 + p * 2400, 3);
  // clic cristallin en fin de charge
  if (p > 0.55) {
    osc('sine', 2200, 3200, t + 0.03, 0.18, 0.06);
    nz(t + 0.02, 0.1, 0.08, 'highpass', 6000);
  }
}
export function sfxSingularity() { // SINGULARITÉ : compression gravitationnelle + explosion
  if (!sfxReady()) return; const t = ST();
  // montée sub-grave de compression
  osc('sine', 60, 240, t, 0.5, 0.22);
  osc('sine', 90, 30, t + 0.42, 0.5, 0.24); // chute = implosion
  // shimmer cosmique
  for (let i = 0; i < 4; i++) {
    osc('sine', 900 + i * 380, 1400 + i * 500, t + 0.1 + i * 0.07, 0.4, 0.04);
  }
  nz(t + 0.45, 0.4, 0.16, 'lowpass', 900, 1); // boom sourd de la distorsion
  nz(t, 0.5, 0.05, 'highpass', 4000);
}
