// Audio procédural (Web Audio API) : musique d'ambiance générative sombre
// + effets sonores d'interface. Aucun fichier audio requis.
// La musique est une nappe de pads sur une progression Am–F–Dm–E,
// une basse discrète et une mélodie éparse — générée en temps réel.
import { G, ctx, W, H } from './state.js';
import { roundRect } from './utils.js';

let AC = null;          // AudioContext (créé au premier geste utilisateur)
let master = null, musicBus = null, sfxBus = null, ambGain = null, ambFilter = null;
const MUSIC_GAIN = 0.55;
let step = 0, nextT = 0, timer = null;
let curThemeKey = null; // thème musical actif (pour les transitions)
let lastState = null;   // état précédent (stingers victoire/défaite)

let on = true;
try { on = localStorage.getItem('rpg2d_music') !== '0'; } catch (e) {}
const _pv = k => { const n = parseInt(localStorage.getItem(k), 10); return isNaN(n) ? null : n; };
let vol = 65; // volume musique 0-100 (persisté)
try { const v = _pv('rpg2d_vol'); vol = Math.max(0, Math.min(100, v === null ? 65 : v)); } catch (e) {}
const volGain = () => (vol / 100) * 0.9;
let sfxVol = 75; // volume effets 0-100 (persisté)
try { const v = _pv('rpg2d_sfx'); sfxVol = Math.max(0, Math.min(100, v === null ? 75 : v)); } catch (e) {}
const sfxGain = () => (sfxVol / 100) * 0.9;
let sfxOn = true; // effets sonores activés (persisté)
try { sfxOn = localStorage.getItem('rpg2d_sfx_on') !== '0'; } catch (e) {}
let ambVol = 60; // volume ambiances 0-100 (persisté)
try { const v = _pv('rpg2d_amb'); ambVol = Math.max(0, Math.min(100, v === null ? 60 : v)); } catch (e) {}
const ambGainFn = () => (ambVol / 100) * 0.5;
let ambOn = true; // ambiances activées (persisté)
try { ambOn = localStorage.getItem('rpg2d_amb_on') !== '0'; } catch (e) {}

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// ---------- THÈMES : un par contexte (menu, forge, boutique, 6 mondes, fins) ----------
// champs : chords (progression), beat (durée du temps), pad (timbre nappe),
// lead (instrument mélodique), bass (instrument de basse), drums (0/1/2 =
// intensité batterie max), amb (bruit d'ambiance : freq filtre + gain),
// bright (luminosité du filtre musique)
const MUSIC_THEMES = {
  menu: { // Menu principal : majestueux et mystérieux (Dm – Bb – F – C, ~96 BPM)
    chords: [[50, 62, 65, 69], [46, 58, 62, 65], [41, 53, 57, 60], [48, 60, 64, 67]],
    beat: 0.62, pad: 'sawtooth', lead: 'violin', bass: 'horn', drums: 0,
    amb: { f: 420, g: 0.014 }, bright: 1200
  },
  forge: { // Forge : calme, artisanale et feutrée (Gm – Eb – Bb – Dm, ~80 BPM)
    chords: [[43, 55, 58, 62], [39, 51, 55, 58], [46, 58, 62, 65], [38, 50, 53, 57]],
    beat: 0.72, pad: 'triangle', lead: 'flute', bass: 'cello', drums: 0,
    amb: { f: 300, g: 0.010 }, bright: 1000
  },
  shop: { // Boutique : médieval léger et agréable (C – G – Am – F, ~104 BPM)
    chords: [[48, 60, 64, 67], [43, 55, 59, 62], [45, 57, 60, 64], [41, 53, 57, 60]],
    beat: 0.58, pad: 'triangle', lead: 'flute', bass: 'cello', drums: 1,
    amb: { f: 500, g: 0.008 }, bright: 1800
  },
  victory: { // fanfare triomphale après un boss / une campagne (C – G – C – F, ~112 BPM)
    chords: [[48, 60, 64, 67], [43, 55, 59, 62], [48, 60, 64, 67], [41, 53, 57, 60]],
    beat: 0.54, pad: 'sawtooth', lead: 'violin', bass: 'horn', drums: 2,
    amb: { f: 600, g: 0.012 }, bright: 2400
  },
  defeat: { // marche funèbre lente et grave (Dm – Bb – Gm – A, ~66 BPM)
    chords: [[50, 62, 65, 69], [46, 58, 62, 65], [43, 55, 58, 62], [45, 57, 60, 64]],
    beat: 0.85, pad: 'sine', lead: 'cello', bass: 'cello', drums: 0,
    amb: { f: 250, g: 0.016 }, bright: 700
  },
  0: { // Les Terres Oubliées : mineur épique, ~115 BPM
    chords: [[45, 57, 60, 64], [41, 53, 57, 60], [38, 50, 53, 57], [40, 52, 55, 59]],
    beat: 0.52, pad: 'triangle', lead: 'violin', bass: 'cello', drums: 1,
    amb: { f: 380, g: 0.012 }, bright: 1500
  },
  1: { // La Terre Gelée : lent, nappes froides (Dm7 – Bb – Gm7 – Cmaj7)
    chords: [[50, 62, 65, 69], [46, 58, 62, 65], [43, 55, 58, 62], [48, 60, 64, 67]],
    beat: 0.62, pad: 'sine', lead: 'flute', bass: 'cello', drums: 0,
    amb: { f: 900, g: 0.018 }, bright: 1100
  },
  2: { // Les Enfers : phrygien sombre et rapide (Em7 – F – G7 – E, ~136 BPM)
    chords: [[40, 52, 55, 59], [41, 53, 57, 60], [43, 55, 59, 62], [40, 52, 56, 59]],
    beat: 0.44, pad: 'sawtooth', lead: 'violin', bass: 'taiko', drums: 2,
    amb: { f: 200, g: 0.014 }, bright: 900
  },
  3: { // Les Égouts : mineur boueux et visqueux (Dm – Bb – F – C, ~100 BPM)
    chords: [[38, 50, 53, 57], [34, 46, 50, 53], [41, 53, 57, 60], [48, 60, 64, 67]],
    beat: 0.60, pad: 'triangle', lead: 'cello', bass: 'cello', drums: 1,
    amb: { f: 260, g: 0.016 }, bright: 800
  },
  4: { // L'Espace : planant et mystérieux (Am9 – Fmaj7 – Cmaj7 – G, ~90 BPM)
    chords: [[45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [48, 60, 64, 67, 71], [43, 55, 59, 62, 67]],
    beat: 0.66, pad: 'sine', lead: 'bell', bass: 'horn', drums: 0,
    amb: { f: 1400, g: 0.010 }, bright: 2200
  },
  5: { // Les Tempêtes : mineur tourbillonnant et violent (Dm – Bb – F – C, ~128 BPM)
    chords: [[50, 62, 65, 69], [46, 58, 62, 65], [41, 53, 57, 60], [48, 60, 64, 67]],
    beat: 0.47, pad: 'sawtooth', lead: 'violin', bass: 'taiko', drums: 2,
    amb: { f: 1100, g: 0.020 }, bright: 2600
  }
};

// clé du thème courant : contexte d'écran > campagne > carte de campagne
function themeKey() {
  if (G.shopOpen) return 'shop';
  if (G.state === 'victory') return 'victory';
  if (G.state === 'gameover' || G.state === 'dying') return 'defeat';
  if (G.state === 'menu') {
    if (G.menuView === 'forge') return 'forge';
    if (G.menuView === 'campaign' && G.campaignSel !== undefined && G.campaignSel !== null) return G.campaignSel;
    return 'menu';
  }
  return G.campaign || 0; // playing / paused / intro : thème du monde
}
const theme = () => MUSIC_THEMES[themeKey()] || MUSIC_THEMES[0];
const beatLen = () => theme().beat;

// intensité de combat : 0 (ambiant) → 1 (meute + boss). Lissée pour éviter
// les sauts brutaux quand les vagues changent.
function musicIntensity() {
  const target = G.state === 'playing' || G.state === 'paused'
    ? Math.min(1, (G.enemies ? G.enemies.length : 0) / 14 + (G.enemies && G.enemies.some(e => e.isBoss) ? 0.35 : 0) + (G.wave || 1) / 80)
    : 0.12;
  G._musI = G._musI === undefined ? target : G._musI + (target - G._musI) * 0.12;
  return G._musI;
}
function bossActive() {
  return !!(G.enemies && G.enemies.some(e => e.isBoss));
}

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
      // bus ambiances : boucle de bruit filtré (vent, souffle, frimas...)
      ambGain = AC.createGain();
      ambGain.gain.value = ambOn ? ambGainFn() : 0;
      ambFilter = AC.createBiquadFilter();
      ambFilter.type = 'bandpass'; ambFilter.frequency.value = 400; ambFilter.Q.value = 0.6;
      const ambSrc = AC.createBufferSource();
      ambSrc.buffer = getNoise(); ambSrc.loop = true;
      ambSrc.connect(ambFilter); ambFilter.connect(ambGain); ambGain.connect(master);
      ambSrc.start();
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

// ---------- réglages ambiances ----------
export function ambVolLevel() { return ambVol; }
export function ambOnState() { return ambOn; }
export function setAmbVol(v) {
  ambVol = Math.max(0, Math.min(100, Math.round(v)));
  try { localStorage.setItem('rpg2d_amb', String(ambVol)); } catch (e) {}
  if (AC && ambGain) ambGain.gain.setTargetAtTime(ambOn ? ambGainFn() : 0, AC.currentTime, 0.1);
}
export function toggleAmb() {
  ambOn = !ambOn;
  try { localStorage.setItem('rpg2d_amb_on', ambOn ? '1' : '0'); } catch (e) {}
  if (AC && ambGain) ambGain.gain.setTargetAtTime(ambOn ? ambGainFn() : 0, AC.currentTime, 0.08);
  return ambOn;
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
  const dark = ['sine', 'triangle'].includes(type);
  const cutoff = dark ? 750 : 1400;
  for (const n of notes) {
    for (const det of [-6, 6]) {
      const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
      o.type = type || 'triangle'; o.frequency.value = mtof(n); o.detune.value = det;
      f.type = 'lowpass'; f.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.038, t + 1.6);
      g.gain.setValueAtTime(0.038, t + Math.max(0.1, dur - 1.5));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
}

// ---------- instruments à voix ----------
function voice(type, f, t, dur, vol, lp) {
  const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
  o.type = type; o.frequency.value = f;
  fl.type = 'lowpass'; fl.frequency.value = lp || 2400;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.12, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + dur + 0.05);
}
// violon : deux cordes désaccordées + vibrato léger
function violin(n, t, dur = 0.9, vol = 0.05) {
  const f = mtof(n);
  for (const det of [-4, 4]) {
    const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    fl.type = 'lowpass'; fl.frequency.value = 2600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol / 2, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
}
// violoncelle : fondamentale grave + harmonique douce
function cello(n, t, dur = 1.1, vol = 0.07) {
  voice('sawtooth', mtof(n), t, dur, vol, 600);
  voice('sine', mtof(n) * 2, t, dur * 0.8, vol * 0.4, 1200);
}
// cor : montée en puissance lente, timbre cuivré voilé
function horn(n, t, dur = 1.6, vol = 0.06) {
  const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = mtof(n);
  fl.type = 'lowpass'; fl.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + dur + 0.05);
}
// flûte : sine clair avec vibrato
function flute(n, t, dur = 0.8, vol = 0.045) {
  const f = mtof(n);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.value = f;
  const lfo = AC.createOscillator(), lg = AC.createGain();
  lfo.frequency.value = 5.2; lg.gain.value = f * 0.006;
  lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + dur + 0.05);
}
// chœur : nappe "ahh" — deux voix désaccordées, attaque très douce
function choir(n, t, dur = 2.6, vol = 0.028) {
  for (const det of [-8, 8]) {
    const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det;
    fl.type = 'lowpass'; fl.frequency.value = 950;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.1);
  }
}
// basse : fondamentale + quinte, profil par instrument
function bassNote(n, t, kind = 'cello') {
  if (kind === 'taiko') { taiko(t, 0.16); bassNote(n, t, 'cello'); return; }
  const f = mtof(n);
  const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
  o.type = kind === 'horn' ? 'sawtooth' : 'triangle';
  o.frequency.value = f;
  fl.type = 'lowpass'; fl.frequency.value = kind === 'horn' ? 500 : 380;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(kind === 'horn' ? 0.075 : 0.1, t + 0.09);
  g.gain.exponentialRampToValueAtTime(0.0001, t + beatLen() * 3.2);
  o.connect(fl); fl.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + beatLen() * 3.3);
  if (kind === 'cello') voice('sine', f * 1.5, t + beatLen() * 0.5, beatLen() * 2, 0.05, 400);
}

function pluck(n, t, dur = 0.55) {
  tone(mtof(n), t, dur, 'triangle', 0.055);
  tone(mtof(n) * 2, t, dur * 0.5, 'sine', 0.018);
}

function bell(n, t) {
  tone(mtof(n), t, 2.2, 'sine', 0.045);
  tone(mtof(n) * 2.76, t, 1.4, 'sine', 0.013);
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
// grosse caisse : sine qui chute 130 -> 42 Hz
function kick(t, big = false) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(big ? 150 : 130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(big ? 0.4 : 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + 0.26);
}
// charleston : bruit filtré très court sur les contretemps
function hat(t, open = false) {
  const s = AC.createBufferSource(); s.buffer = getNoise();
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = AC.createGain();
  g.gain.setValueAtTime(open ? 0.1 : 0.065, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.14 : 0.05));
  s.connect(f); f.connect(g); g.connect(musicBus);
  s.start(t); s.stop(t + (open ? 0.15 : 0.06));
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
  tone(190, t, 0.09, 'triangle', 0.065);
}
// grosse caisse de guerre (taiko) : membrane grave + claquement bois
function taiko(t, v = 0.2) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.16);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + 0.32);
  const s = AC.createBufferSource(); s.buffer = getNoise();
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5;
  const ng = AC.createGain();
  ng.gain.setValueAtTime(v * 0.35, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  s.connect(f); f.connect(ng); ng.connect(musicBus);
  s.start(t); s.stop(t + 0.06);
}

// ---------- orchestrateur de pas : couches par intensité ----------
const LEAD_VOICES = { violin, cello, horn, flute, bell: (n, t) => bell(n, t) };
function leadVoice(kind) { return LEAD_VOICES[kind] || violin; }

function playStep(s, t) {
  const bt = beatLen();
  const th = theme();
  const chord = th.chords[Math.floor(s / 8) % th.chords.length];
  const inBar = s % 8;
  const inten = musicIntensity();
  const boss = bossActive();
  const drumsLvl = Math.max(th.drums ? th.drums / 2 : 0, inten * 0.9); // 0..1

  // nappe d'accords : toujours présente, plus sombre/large en combat
  if (inBar === 0) {
    padChord(chord, t, bt * 8.6, th.pad);
    if (inten > 0.45 || boss) choir(chord[0] + 12, t + bt, bt * 7, 0.02 + inten * 0.02);
  }

  // ---- batterie : niveau suit l'intensité et le thème ----
  if (drumsLvl > 0.15) {
    const k = drumsLvl;
    if (inBar === 0 || (inBar === 4 && k > 0.4) || (boss && inBar === 6)) kick(t, boss);
    if (inBar === 2 || (inBar === 6 && k > 0.55)) snare(t);
    if (k > 0.3) hat(t + bt / 2, k > 0.7 && inBar === 7);
    if (k > 0.5 && inBar % 2 === 1) hat(t, false);
    if (boss || th.drums === 2) { // boss / thèmes guerriers : nappes de taiko
      if (inBar === 0 || inBar === 3 || inBar === 6) taiko(t + (inBar === 3 ? bt / 2 : 0), 0.14 + drumsLvl * 0.1);
    }
  }

  // ---- basse : toujours, plus présente en combat ----
  bassNote(chord[0], t, th.bass);
  if (inBar % 2 === 0 || inten > 0.4) bassNote(chord[0] - 12, t + bt / 2, th.bass);

  // ---- arpège : cycle les notes de l'accord, une note sur deux temps ----
  const arp = chord[(s * 7 + 3) % chord.length] + 24;
  if (s % 2 === 0) pluck(arp, t, 0.4);

  // ---- mélodie : densité croissante avec l'intensité ----
  const lv = leadVoice(th.lead);
  const h = (s * 2654435761) >>> 0;
  const density = 0.18 + inten * 0.55 + (boss ? 0.15 : 0);
  if (h % 100 < density * 100) {
    const n = chord[(h >> 6) % chord.length] + 24 + ((h >> 12) % 3 === 0 ? 12 : 0);
    const dur = th.lead === 'flute' ? 0.7 : 0.95;
    lv(n, t, dur, th.lead === 'bell' ? 0.9 : 1);
  }
  if (s % 32 === 16) bell(chord[2] + 24, t);
}

// fondu de transition quand le thème change (menu -> monde, combat -> calme...)
function transitionMusic() {
  const k = themeKey();
  if (curThemeKey === k) return;
  const first = curThemeKey === null;
  curThemeKey = k;
  if (!AC || !musicBus || first) return;
  // dip en V : le thème change pendant que le bus s'efface puis revient
  const now = AC.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(musicBus.gain.value, now);
  musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.22);
  musicBus.gain.setValueAtTime(0.0001, now + 0.3);
  musicBus.gain.setTargetAtTime(volGain(), now + 0.32, 0.5);
}

// stingers : fanfare de victoire / marche funèbre de défaite
function stinger() {
  const st = G.state;
  if (lastState === st) return;
  const was = lastState; lastState = st;
  if (!AC || !musicBus) return;
  const t = AC.currentTime + 0.15;
  const seq = st === 'victory' ? [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.46]]
            : st === 'gameover' ? [[392, 0], [330, 0.3], [262, 0.6], [196, 0.95]]
            : null;
  if (!seq) return;
  for (const [f, dt] of seq) {
    for (const det of [-5, 5]) {
      const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
      o.type = st === 'victory' ? 'sawtooth' : 'triangle';
      o.frequency.value = f; o.detune.value = det;
      fl.type = 'lowpass'; fl.frequency.value = st === 'victory' ? 3000 : 900;
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.linearRampToValueAtTime(st === 'victory' ? 0.05 : 0.07, t + dt + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + (st === 'victory' ? 0.9 : 1.6));
      o.connect(fl); fl.connect(g); g.connect(musicBus);
      o.start(t + dt); o.stop(t + dt + 2);
    }
  }
}

// ordonnanceur : planifie les temps forts à l'avance (précision ~200ms)
function scheduleBar() {
  if (!AC) return;
  transitionMusic();
  stinger();
  // ambiances : filtre et gain suivent le thème courant
  if (ambFilter && ambGain) {
    const a = theme().amb || { f: 400, g: 0.01 };
    ambFilter.frequency.setTargetAtTime(a.f, AC.currentTime, 0.8);
    ambGain.gain.setTargetAtTime(ambOn ? (a.g * ambVol / 60) : 0, AC.currentTime, 0.8);
  }
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

// ---------- boutons ON/OFF + panneau de réglages (coin haut-droit) ----------
// trois pastilles : MUSIQUE / EFFETS / ⚙ RÉGLAGES
export const AUDIO_BTNS = {
  mus: { x: W * 0.77, y: 8, w: 84, h: 30 },
  sfx: { x: W * 0.845, y: 8, w: 84, h: 30 },
  opt: { x: W * 0.92, y: 8, w: 84, h: 30 }
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
  drawAudioBtn(AUDIO_BTNS.opt, 'RÉGLAGES', !!G.audioOpen, '#b48ae0');
}

// ---------- panneau de réglages audio ----------
const AP_W = 480, AP_H = 340;
const apRect = () => ({ x: W / 2 - AP_W / 2, y: H / 2 - AP_H / 2, w: AP_W, h: AP_H });
// une ligne = { key, label, icon, color, getVol, setVol, getOn, toggle }
const AP_ROWS = [
  { key: 'mus', label: 'MUSIQUE', icon: '♪', color: '#d4b062',
    vol: () => vol, set: setMusicVol, on: () => on, tog: toggleMusic },
  { key: 'sfx', label: 'EFFETS SONORES', icon: '✦', color: '#7fb8d6',
    vol: () => sfxVol, set: setSfxVol, on: () => sfxOn, tog: toggleSfx },
  { key: 'amb', label: 'AMBIANCES', icon: '≋', color: '#8fd0a0',
    vol: () => ambVol, set: setAmbVol, on: () => ambOn, tog: toggleAmb }
];
// géométrie d'une ligne : label en haut, pastille ON/OFF à droite,
// curseur pleine largeur en dessous — aucune superposition possible
function apRowRect(i) {
  const r = apRect();
  return { x: r.x + 26, y: r.y + 76 + i * 74, w: r.w - 52, h: 62 };
}
function apSliderRect(rr) {
  return { x: rr.x + 12, y: rr.y + 40, w: rr.w - 24 };
}
function apTogRect(rr) {
  return { x: rr.x + rr.w - 62, y: rr.y + 6, w: 56, h: 26 };
}
export function audioPanelAt(x, y) {
  const r = apRect();
  if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return 'outside';
  const cx = r.x + r.w - 26, cy = r.y + 18;
  if (x >= cx - 9 && x <= cx + 9 && y >= cy - 9 && y <= cy + 9) return 'close';
  for (let i = 0; i < AP_ROWS.length; i++) {
    const rr = apRowRect(i);
    const tg = apTogRect(rr);
    if (x >= tg.x && x <= tg.x + tg.w && y >= tg.y && y <= tg.y + tg.h) return 'tog' + i;
    const sl = apSliderRect(rr);
    if (x >= sl.x - 4 && x <= sl.x + sl.w + 4 && y >= sl.y - 10 && y <= sl.y + 22) return 'vol' + i;
  }
  return 'inside';
}
export function audioPanelClickAt(x, y) {
  const hit = audioPanelAt(x, y);
  if (hit === 'close') { G.audioOpen = false; return 'close'; }
  if (hit === 'outside') { G.audioOpen = false; return 'close'; }
  if (hit && hit[0] === 't' && hit[4] >= '0') {
    AP_ROWS[+hit[4]].tog(); sfxClick(); return hit;
  }
  if (hit && hit[0] === 'v' && hit[3] >= '0') {
    const i = +hit[3], rr = apRowRect(i), sl = apSliderRect(rr);
    const v = Math.max(0, Math.min(100, Math.round(((x - sl.x) / sl.w) * 100)));
    AP_ROWS[i].set(v); sfxClick(); return hit;
  }
  return hit;
}
export function drawAudioPanel() {
  if (!G.audioOpen) return;
  const r = apRect();
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,12,0.85)'; ctx.fillRect(0, 0, W, H);
  // panneau
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, '#171a22'); g.addColorStop(1, '#0d0f16');
  ctx.fillStyle = g; roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(212,176,98,0.45)'; ctx.lineWidth = 1.5;
  roundRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5, 14); ctx.stroke();
  // titre
  ctx.textAlign = 'center';
  ctx.font = '700 19px Georgia, serif'; ctx.fillStyle = '#e8d9a8';
  ctx.fillText('⚙ RÉGLAGES AUDIO', W / 2, r.y + 36);
  ctx.font = 'italic 12px Georgia, serif'; ctx.fillStyle = 'rgba(232,217,176,0.55)';
  ctx.fillText('volume et activation de chaque catégorie — sauvegardé automatiquement', W / 2, r.y + 56);
  // lignes
  for (let i = 0; i < AP_ROWS.length; i++) {
    const row = AP_ROWS[i], rr = apRowRect(i);
    const hovRow = G.mouse.x >= rr.x && G.mouse.x <= rr.x + rr.w &&
                   G.mouse.y >= rr.y && G.mouse.y <= rr.y + rr.h;
    if (hovRow) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; roundRect(rr.x, rr.y, rr.w, rr.h, 10); ctx.fill(); }
    // icône + label (zone gauche, libre)
    ctx.textAlign = 'left';
    ctx.font = '18px sans-serif'; ctx.fillStyle = row.color;
    ctx.fillText(row.icon, rr.x + 12, rr.y + 28);
    ctx.font = '700 13px Inter, sans-serif'; ctx.fillStyle = '#e8e2d2';
    ctx.fillText(row.label, rr.x + 42, rr.y + 28);
    // pastille ON/OFF à droite
    const tg = apTogRect(rr), onv = row.on();
    ctx.fillStyle = onv ? 'rgba(60,140,90,0.35)' : 'rgba(90,40,40,0.3)';
    roundRect(tg.x, tg.y, tg.w, tg.h, 7); ctx.fill();
    ctx.strokeStyle = onv ? 'rgba(140,230,170,0.6)' : 'rgba(230,140,140,0.4)'; ctx.lineWidth = 1;
    roundRect(tg.x + 0.5, tg.y + 0.5, tg.w - 1, tg.h - 1, 7); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = '700 11px Inter, sans-serif';
    ctx.fillStyle = onv ? '#9fe8b8' : '#e89a9a';
    ctx.fillText(onv ? 'ON' : 'OFF', tg.x + tg.w / 2, tg.y + 17);
    // curseur pleine largeur
    const sl = apSliderRect(rr), v = row.vol() / 100;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(sl.x, sl.y, sl.w, 10, 5); ctx.fill();
    if (v > 0.01) {
      const fg = ctx.createLinearGradient(sl.x, 0, sl.x + sl.w * v, 0);
      fg.addColorStop(0, row.color); fg.addColorStop(1, '#ffffff');
      ctx.fillStyle = fg;
      roundRect(sl.x, sl.y, Math.max(10, sl.w * v), 10, 5); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sl.x + sl.w * v, sl.y + 5, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = row.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(sl.x + sl.w * v, sl.y + 5, 8, 0, Math.PI * 2); ctx.stroke();
    // pourcentage sous le curseur, aligné à droite
    ctx.textAlign = 'right'; ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(232,226,210,0.75)';
    ctx.fillText(row.vol() + '%', rr.x + rr.w, rr.y + 60);
  }
  // croix
  const cx = r.x + r.w - 26, cy = r.y + 18;
  ctx.strokeStyle = 'rgba(232,217,176,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy + 6);
  ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy + 6); ctx.stroke();
  ctx.restore();
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
  } else if (kind === 'storm') {
    // vent : whoosh montant + grondement de tornade + crépitement électrique
    nz(t, 0.7, 0.24, 'bandpass', 700, 1.1);
    osc('sawtooth', 90, 40, t, 0.7, 0.14);
    nz(t + 0.15, 0.5, 0.12, 'highpass', 2800);
    osc('sine', 2200, 600, t + 0.2, 0.3, 0.04);
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

// ---------- SFX boutique / progression ----------
export function sfxBuy() { // achat : deux pièces + registre satisfaisant
  if (!sfxReady()) return; const t = ST();
  osc('square', 1568, 1568, t, 0.08, 0.07);
  osc('square', 2093, 2093, t + 0.09, 0.14, 0.07);
  osc('sine', 1047, 1047, t + 0.05, 0.2, 0.05);
}
export function sfxUnlock() { // déblocage : arpège montant cristallin
  if (!sfxReady()) return; const t = ST();
  [784, 988, 1175, 1568].forEach((f, i) =>
    osc('sine', f, f, t + i * 0.08, 0.4, 0.08));
  nz(t + 0.1, 0.5, 0.04, 'highpass', 6000);
}
export function sfxAchievement() { // succès débloqué : petite fanfare dorée
  if (!sfxReady()) return; const t = ST();
  [523, 659, 784, 1047, 1319].forEach((f, i) =>
    osc('triangle', f, f, t + i * 0.1, 0.5, 0.09));
  osc('sine', 2093, 2093, t + 0.5, 0.6, 0.05);
}
export function sfxSell() { // vente : registre grave + pièce
  if (!sfxReady()) return; const t = ST();
  osc('sine', 660, 660, t, 0.12, 0.07);
  osc('square', 1319, 1319, t + 0.1, 0.1, 0.05);
}

// debug/test : contexte musical courant + intensité
export function audioDebug() {
  return { key: themeKey(), inten: +musicIntensity().toFixed(2), boss: bossActive(),
           themes: Object.keys(MUSIC_THEMES).length };
}
