// Audio procédural (Web Audio API) : musique d'ambiance générative sombre
// + effets sonores d'interface. Aucun fichier audio requis.
// La musique est une nappe de pads sur une progression Am–F–Dm–E,
// une basse discrète et une mélodie éparse — générée en temps réel.
import { G, ctx, W, H } from './state.js';
import { roundRect } from './utils.js';

let AC = null;          // AudioContext (créé au premier geste utilisateur)
let master = null, musicBus = null, sfxBus = null, uiBus = null, ambGain = null, ambFilter = null;
const MUSIC_GAIN = 0.55;
let step = 0, nextT = 0, timer = null;
let curThemeKey = null; // thème musical actif (pour les transitions)
let lastState = null;   // état précédent (stingers victoire/défaite)
let voices = 0;         // voix SFX actives (plafond anti-saturation)
const MAX_VOICES = 56;

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
let masterVol = 85; // volume général 0-100 (persisté)
try { const v = _pv('rpg2d_master'); masterVol = Math.max(0, Math.min(100, v === null ? 85 : v)); } catch (e) {}
const masterGainFn = () => (masterVol / 100) * 0.9;
let uiVol = 80; // volume interface 0-100 (persisté)
try { const v = _pv('rpg2d_ui'); uiVol = Math.max(0, Math.min(100, v === null ? 80 : v)); } catch (e) {}
const uiGainFn = () => (uiVol / 100) * 0.9;
let uiOn = true; // interface activée (persisté)
try { uiOn = localStorage.getItem('rpg2d_ui_on') !== '0'; } catch (e) {}

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
      master.gain.value = masterGainFn();
      // compresseur de sortie : colle le mix et évite les saturations
      const comp = AC.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 22;
      comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
      master.connect(comp); comp.connect(AC.destination);
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
      // bus interface : clics, confirmations, boutique, succès
      uiBus = AC.createGain();
      uiBus.gain.value = uiOn ? uiGainFn() : 0;
      uiBus.connect(master);
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

// ---------- réglages général & interface ----------
export function masterVolLevel() { return masterVol; }
export function setMasterVol(v) {
  masterVol = Math.max(0, Math.min(100, Math.round(v)));
  try { localStorage.setItem('rpg2d_master', String(masterVol)); } catch (e) {}
  if (AC && master) master.gain.setTargetAtTime(masterGainFn(), AC.currentTime, 0.05);
}
export function uiVolLevel() { return uiVol; }
export function uiOnState() { return uiOn; }
export function setUiVol(v) {
  uiVol = Math.max(0, Math.min(100, Math.round(v)));
  try { localStorage.setItem('rpg2d_ui', String(uiVol)); } catch (e) {}
  if (AC && uiBus) uiBus.gain.setTargetAtTime(uiOn ? uiGainFn() : 0, AC.currentTime, 0.05);
}
export function toggleUi() {
  uiOn = !uiOn;
  try { localStorage.setItem('rpg2d_ui_on', uiOn ? '1' : '0'); } catch (e) {}
  if (AC && uiBus) uiBus.gain.setTargetAtTime(uiOn ? uiGainFn() : 0, AC.currentTime, 0.08);
  return uiOn;
}

// ---------- synthèse ----------
// quand la source s'arrête, toute sa chaîne est déconnectée des bus : sans ça
// chaque son laisse ses nœuds attachés au graphe -> fuite mémoire et moteur
// audio qui sature en longue session (micro-freezes aléatoires)
function killChain(src, ...nodes) {
  src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) {} } };
}
function tone(freq, t, dur, type, vol, dest, detune = 0) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.15, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || musicBus);
  o.start(t); o.stop(t + dur + 0.05);
  killChain(o, o, g);
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
      killChain(o, o, g, f);
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
  killChain(o, o, g, fl);
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
    killChain(o, o, g, fl);
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
  killChain(o, o, g, fl);
}
// flûte : sine clair avec vibrato
function flute(n, t, dur = 0.8, vol = 0.045) {
  const f = mtof(n);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.value = f;
  const lfo = AC.createOscillator(), lg = AC.createGain();
  lfo.frequency.value = 5.2; lg.gain.value = f * 0.006;
  lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
  lfo.onended = () => { try { lfo.disconnect(); lg.disconnect(); } catch (e) {} };
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + dur + 0.05);
  killChain(o, o, g);
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
    killChain(o, o, g, fl);
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
  killChain(o, o, g, fl);
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
  killChain(o, o, g);
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
  killChain(s, s, f, g);
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
  killChain(s, s, f, g);
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
  killChain(o, o, g);
  const s = AC.createBufferSource(); s.buffer = getNoise();
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5;
  const ng = AC.createGain();
  ng.gain.setValueAtTime(v * 0.35, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  s.connect(f); f.connect(ng); ng.connect(musicBus);
  s.start(t); s.stop(t + 0.06);
  killChain(s, s, f, ng);
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
  const seq = st === 'victory' ? null // la victoire a son sting dédié (sfxVictory)
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
      killChain(o, o, g, fl);
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

// ---------- sons d'interface (bus uiBus : volume « INTERFACE ») ----------
function uiReady() { return !!(AC && (uiBus || sfxBus || master)); }
const UIB = () => uiBus || sfxBus || master;
// survol : micro-clic feutré (beaucoup plus discret que le clic)
export function sfxHover() {
  if (!uiReady()) return;
  const t = ST();
  partial(t, jit(1500, 0.08), 0.05, 0.022, 'sine', UIB());
  nzSweep(t, 0.025, 0.012, 'highpass', 7000, 9000, 1, 0.001);
}
// clic : cliquet bois + pierre, deux micro-couches
export function sfxClick() {
  if (!uiReady()) return;
  const t = ST();
  const d = UIB();
  nzSweep(t, 0.035, 0.07, 'bandpass', jit(1900, 0.15), jit(1400, 0.15), 3.5, 0.001);
  oscA('triangle', jit(720, 0.1), jit(380, 0.1), t, 0.06, 0.055, 0.002, d);
  oscA('sine', jit(190, 0.08), 90, t, 0.05, 0.04, 0.001, d);
}
// refus : double coup sourd (action impossible, pas assez de mats…)
export function sfxDeny() {
  if (!uiReady()) return;
  const t = ST(); const d = UIB();
  oscA('sine', 150, 70, t, 0.14, 0.12, 0.004, d);
  nzSweep(t, 0.08, 0.06, 'lowpass', 500, 300, 1, 0.002);
  oscA('sine', 120, 60, t + 0.11, 0.12, 0.08, 0.004, d);
}
// changement d'onglet : glissement de parchemin
export function sfxTab() {
  if (!uiReady()) return;
  const t = ST();
  nzSweep(t, 0.13, 0.05, 'bandpass', jit(900, 0.1), jit(2300, 0.1), 0.9, 0.02);
  partial(t + 0.05, 880, 0.08, 0.018, 'sine', UIB());
}
// ouverture de menu : page qui se déploie + chime discret
export function sfxOpen() {
  if (!uiReady()) return;
  const t = ST(); const d = UIB();
  nzSweep(t, 0.22, 0.06, 'bandpass', 500, 1900, 0.8, 0.03);
  chime(t + 0.1, 1047, 0.4, 0.035, d);
}
// fermeture : version feutrée et descendante
export function sfxClose() {
  if (!uiReady()) return;
  const t = ST();
  nzSweep(t, 0.18, 0.05, 'bandpass', 1700, 600, 0.9, 0.01);
  partial(t + 0.04, 784, 0.3, 0.03, 'sine', UIB());
}
// confirmation : petite harpe — 3 notes cristallines en montant
export function sfxConfirm() {
  if (!uiReady()) return;
  const t = ST(); const d = UIB();
  [523, 659, 784].forEach((f, i) => {
    const t0 = t + i * 0.07;
    partial(t0, f, 0.34, 0.07, 'triangle', d);
    partial(t0, f * 2, 0.18, 0.03, 'sine', d);
  });
  nzSweep(t + 0.05, 0.3, 0.015, 'highpass', 6500, 8000, 1, 0.02);
}
// émeraude / matériau rare : scintillement cristallin
export function sfxGem() {
  if (!uiReady()) return;
  const t = ST(); const d = UIB();
  chime(t, jit(2093, 0.06), 0.5, 0.06, d);
  chime(t + 0.09, jit(3136, 0.06), 0.45, 0.045, d);
  nzSweep(t + 0.05, 0.35, 0.02, 'highpass', 7000, 10000, 1, 0.03);
}

// ---------- bouton RÉGLAGES + panneau (coin haut-droit) ----------
// une seule pastille ⚙ : les interrupteurs ON/OFF vivent dans le panneau
export const AUDIO_BTNS = {
  opt: { x: W - 158, y: 8, w: 150, h: 42 }
};
export function audioButtonAt(x, y) {
  for (const k in AUDIO_BTNS) {
    const r = AUDIO_BTNS[k];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return k;
  }
  return null;
}

// bouton ⚙ RÉGLAGES : pastille violet lumineuse, engrenage tournant,
// halo qui pulse doucement — bien visible dans le feu de l'action
export function drawMusicButton() {
  const r = AUDIO_BTNS.opt;
  const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w &&
              G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
  const open = !!G.audioOpen;
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 3.2); // respiration du halo
  ctx.save();
  // halo extérieur
  ctx.shadowColor = `rgba(180,138,224,${open ? 0.85 : 0.4 + pulse * 0.35})`;
  ctx.shadowBlur = open ? 26 : 12 + pulse * 12;
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, hov || open ? '#553d85' : '#3d2d63');
  g.addColorStop(1, '#221740');
  ctx.fillStyle = g;
  roundRect(r.x, r.y, r.w, r.h, 11); ctx.fill();
  ctx.shadowBlur = 0;
  // liseré animé
  ctx.strokeStyle = hov || open ? '#e2c4ff' : `rgba(196,150,255,${0.5 + pulse * 0.35})`;
  ctx.lineWidth = 1.5;
  roundRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5, 10); ctx.stroke();
  // reflet supérieur
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(r.x + 3, r.y + 2.5, r.w - 6, r.h * 0.36, 8); ctx.fill();
  // engrenage qui tourne doucement
  ctx.save();
  ctx.translate(r.x + 22, r.y + r.h / 2 + 1);
  ctx.rotate(G.time * 0.7);
  ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = open ? '#ffd740' : '#d9c2ff';
  ctx.fillText('⚙', 0, 0);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = '700 11.5px Inter, sans-serif'; ctx.letterSpacing = '1.6px';
  ctx.fillStyle = open ? '#ffd740' : '#efe4ff';
  ctx.fillText('RÉGLAGES', r.x + 38, r.y + r.h / 2 + 4);
  ctx.restore();
}

// ---------- panneau de réglages audio ----------
const AP_W = 500, AP_H = 540;
const apRect = () => ({ x: W / 2 - AP_W / 2, y: H / 2 - AP_H / 2, w: AP_W, h: AP_H });
// une ligne = { key, label, icon, color, getVol, setVol, getOn, toggle }
const AP_ROWS = [
  { key: 'master', label: 'VOLUME GÉNÉRAL', icon: '◉', color: '#e8d9a8',
    vol: () => masterVol, set: setMasterVol, on: () => masterVol > 0, tog: () => setMasterVol(masterVol > 0 ? 0 : 85) },
  { key: 'mus', label: 'MUSIQUE', icon: '♪', color: '#d4b062',
    vol: () => vol, set: setMusicVol, on: () => on, tog: toggleMusic },
  { key: 'sfx', label: 'EFFETS SONORES', icon: '✦', color: '#7fb8d6',
    vol: () => sfxVol, set: setSfxVol, on: () => sfxOn, tog: toggleSfx },
  { key: 'amb', label: 'AMBIANCES', icon: '≋', color: '#8fd0a0',
    vol: () => ambVol, set: setAmbVol, on: () => ambOn, tog: toggleAmb },
  { key: 'ui', label: 'INTERFACE', icon: '❖', color: '#d8a0c8',
    vol: () => uiVol, set: setUiVol, on: () => uiOn, tog: toggleUi }
];
// géométrie d'une ligne : label en haut, pastille ON/OFF à droite,
// curseur pleine largeur en dessous — aucune superposition possible
function apRowRect(i) {
  const r = apRect();
  return { x: r.x + 26, y: r.y + 76 + i * 80, w: r.w - 52, h: 66 };
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
let audDrag = -1; // index de la ligne en cours de drag (-1 = aucune)
export function audioPanelClickAt(x, y) {
  const hit = audioPanelAt(x, y);
  if (hit === 'close') { G.audioOpen = false; audDrag = -1; return 'close'; }
  if (hit === 'outside') { G.audioOpen = false; audDrag = -1; return 'close'; }
  if (hit && hit[0] === 't' && hit[3] >= '0') {
    AP_ROWS[+hit[3]].tog(); sfxClick(); return hit;
  }
  if (hit && hit[0] === 'v' && hit[3] >= '0') {
    audDrag = +hit[3];
    audioPanelDragAt(x, y); sfxClick(); return hit;
  }
  return hit;
}
// drag : met à jour le volume de la ligne saisie tant que le bouton est maintenu
export function audioPanelDragAt(x, y) {
  if (audDrag < 0) return false;
  const rr = apRowRect(audDrag), sl = apSliderRect(rr);
  const v = Math.max(0, Math.min(100, Math.round(((x - sl.x) / sl.w) * 100)));
  AP_ROWS[audDrag].set(v);
  return true;
}
export function audioPanelDragEnd() { audDrag = -1; }
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
function nz(t, dur, vol, type, freq, q = 1) {
  nzSweep(t, dur, vol, type, freq, freq, q, 0.002);
}
const ST = () => AC.currentTime;

// ---------- synthèse enrichie : couches, enveloppes, variations ----------
const jit = (x, a = 0.05) => x * (1 - a / 2 + Math.random() * a); // ±a de hauteur
function env(t, dur, vol, atk = 0.006) {
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(atk, dur * 0.4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}
// oscillateur avec attaque douce et compte de voix (anti-saturation)
function oscA(type, f0, f1, t, dur, vol, atk = 0.006, dest) {
  try {
    if (voices >= MAX_VOICES) return;
    const o = AC.createOscillator(), g = env(t, dur, vol, atk);
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur * 0.85);
    o.connect(g); g.connect(dest || sfxBus || master);
    voices++; o.onended = () => { voices--; try { o.disconnect(); g.disconnect(); } catch (e) {} };
    o.start(t); o.stop(t + dur + 0.08);
  } catch (e) {}
}
// bruit filtré avec balayage de fréquence (whooshes, risers, souffles)
function nzSweep(t, dur, vol, type, f0, f1, q = 1, atk = 0.004, dest) {
  try {
    if (voices >= MAX_VOICES) return;
    const s = AC.createBufferSource(); s.buffer = getNoise();
    const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.9);
    const g = env(t, dur, vol, atk);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus || master);
    voices++; s.onended = () => { voices--; try { s.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
    s.start(t); s.stop(t + dur + 0.08);
  } catch (e) {}
}
function osc(type, f0, f1, t, dur, vol) { oscA(type, f0, f1, t, dur, vol, 0.002); }
// crépitement : n micro-grains de bruit (feu, givre, étincelles)
function crackle(t, dur, n, vol, fMin = 2000, fMax = 8000, dest) {
  for (let i = 0; i < n; i++) {
    const tt = t + Math.random() * dur;
    const nd = dest || (sfxBus || master);
    try {
      if (voices >= MAX_VOICES) return;
      const s = AC.createBufferSource(); s.buffer = getNoise();
      const f = AC.createBiquadFilter(); f.type = 'highpass';
      f.frequency.value = jit(fMin + Math.random() * (fMax - fMin), 0.35);
      const g = AC.createGain();
      const dv = 0.015 + Math.random() * 0.02, vv = vol * (0.4 + Math.random() * 0.6);
      g.gain.setValueAtTime(vv, tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + dv);
      s.connect(f); f.connect(g); g.connect(nd);
      voices++; s.onended = () => { voices--; try { s.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
      s.start(tt); s.stop(tt + dv + 0.02);
    } catch (e) {}
  }
}
// partiel inharmonique : teinte les cloches, cristaux et métaux
function partial(t, f, dur, vol, type = 'sine', dest) {
  oscA(type, f, f, t, dur, vol, 0.004, dest);
}
// petite clochette : fondamentale + partiels brillants
function chime(t, base, dur = 0.5, vol = 0.06, dest) {
  partial(t, base, dur, vol, 'sine', dest);
  partial(t, base * 2.76, dur * 0.55, vol * 0.4, 'sine', dest);
  partial(t, base * 5.4, dur * 0.3, vol * 0.16, 'sine', dest);
}
// gong : fondamental grave + partiels inharmoniques + frappe
function gong(t, f, dur, vol, dest) {
  oscA('sine', f, f, t, dur, vol, 0.02, dest);
  oscA('sine', f * 1.48, f * 1.48, t, dur * 0.7, vol * 0.4, 0.02, dest);
  oscA('sine', f * 2.09, f * 2.09, t, dur * 0.45, vol * 0.25, 0.02, dest);
  nzSweep(t, 0.06, vol * 0.5, 'bandpass', f * 8, f * 4, 2, 0.002);
}
// pièce : ping métallique bref (deux partiels)
function coin(t, f, vol = 0.07, dest) {
  partial(t, f, 0.22, vol, 'square', dest);
  partial(t, f * 2.4, 0.1, vol * 0.5, 'sine', dest);
  nzSweep(t, 0.03, vol * 0.6, 'highpass', 6000, 9000, 1, 0.001);
}
// enclume : frappe métallique + queue de résonance
function anvil(t, f = 1900, vol = 0.16, dest) {
  nzSweep(t, 0.05, vol, 'bandpass', f * 0.8, f * 1.6, 3, 0.001);
  partial(t, f, 0.5, vol * 0.55, 'triangle', dest);
  partial(t, f * 2.76, 0.28, vol * 0.3, 'sine', dest);
  partial(t, f * 0.5, 0.4, vol * 0.3, 'sine', dest);
}
// le mix baisse la musique un instant : les impacts gardent la priorité
function duck(amount = 0.3, hold = 0.32) {
  if (!AC || !musicBus || !on) return;
  const now = AC.currentTime;
  try {
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setTargetAtTime(musicBus.gain.value * (1 - amount), now, 0.02);
    musicBus.gain.setTargetAtTime(volGain(), now + hold, 0.4);
  } catch (e) {}
}
// souffle granulaire : nappe de bruit dont le filtre oscille doucement
function gust(t, dur, vol, f0, f1, q = 0.8) {
  nzSweep(t, dur, vol, 'bandpass', f0, f1, q, dur * 0.3);
}

// frappe d'arme : whoosh d'acier + claquement de lame + queue métallique
export function sfxSlash() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.14, 0.2, 'bandpass', jit(2300, 0.15), jit(800, 0.15), 1.6, 0.004);
  oscA('sawtooth', jit(1300, 0.1), jit(240, 0.1), t, 0.07, 0.035, 0.002);
  partial(t + 0.03, jit(2600, 0.08), 0.16, 0.05, 'triangle');
  crackle(t, 0.08, 3, 0.03, 5000, 9000);
}
// estoc : souffle perçant + pointe métallique qui vibre
export function sfxThrust() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.1, 0.17, 'bandpass', jit(3400, 0.12), jit(5200, 0.12), 2.2, 0.002);
  oscA('sawtooth', jit(480, 0.08), jit(1500, 0.08), t, 0.1, 0.04, 0.003);
  partial(t + 0.02, jit(3100, 0.1), 0.18, 0.045, 'sine');
}
// rotation : double whoosh tourbillonnant + sifflement montant
export function sfxSpin() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.2, 0.13, 'bandpass', jit(700, 0.1), jit(2100, 0.1), 0.9, 0.02);
  nzSweep(t + 0.12, 0.18, 0.11, 'bandpass', jit(2000, 0.1), jit(600, 0.1), 1.1, 0.015);
  oscA('sine', jit(280, 0.1), jit(720, 0.1), t, 0.3, 0.035, 0.02);
}
// dôme : bulle cristalline — fondamental montant + chœur de partiels
export function sfxShield() {
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(400, 0.05), jit(1250, 0.05), t, 0.42, 0.065, 0.02);
  oscA('sine', jit(810, 0.05), jit(1650, 0.05), t + 0.05, 0.36, 0.04, 0.02);
  partial(t + 0.1, 1980, 0.3, 0.02);
  nzSweep(t, 0.3, 0.045, 'highpass', 5200, 6800, 1, 0.03);
}
// impact : corps + craquement + étincelle ; heavy = coup massif (boss, critiques)
export function sfxHit(heavy = false) {
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(heavy ? 170 : 200, 0.08), heavy ? 45 : 55, t, heavy ? 0.18 : 0.12, heavy ? 0.34 : 0.24, 0.003);
  nzSweep(t, heavy ? 0.1 : 0.055, heavy ? 0.2 : 0.13, 'highpass', jit(3200, 0.15), jit(5000, 0.15), 1, 0.001);
  nzSweep(t, heavy ? 0.14 : 0.07, heavy ? 0.13 : 0.07, 'bandpass', 900, 500, 1.2, 0.002);
  if (heavy) {
    partial(t + 0.02, jit(1150, 0.1), 0.2, 0.08, 'triangle');
    duck(0.18, 0.25);
  }
}
// le héros est touché : coup sourd + souffle de douleur
export function sfxHurt() {
  if (!sfxReady()) return; const t = ST();
  oscA('sawtooth', jit(150, 0.07), jit(55, 0.07), t, 0.24, 0.15, 0.004);
  nzSweep(t, 0.13, 0.1, 'lowpass', jit(750, 0.1), jit(350, 0.1), 1, 0.003);
  oscA('sine', 95, 50, t + 0.02, 0.2, 0.14, 0.004);
}
// mort de monstre : descente dramatique + poof ; 'boss'/'big' = plus grave et long
export function sfxDie(kind = '') {
  if (!sfxReady()) return; const t = ST();
  const big = kind === 'boss' || kind === 'big' || kind.includes('final');
  oscA('square', jit(big ? 300 : 320, 0.06), jit(big ? 55 : 70, 0.06), t, big ? 0.42 : 0.3, big ? 0.12 : 0.09, 0.004);
  nzSweep(t, big ? 0.3 : 0.2, big ? 0.13 : 0.09, 'bandpass', jit(950, 0.1), jit(280, 0.1), 1.1, 0.008);
  oscA('sine', jit(180, 0.06), jit(40, 0.06), t + 0.04, big ? 0.36 : 0.26, big ? 0.12 : 0.08, 0.01);
  if (big) { crackle(t + 0.1, 0.3, 6, 0.05, 900, 4000); duck(0.22, 0.4); }
}
// butin : deux notes brillantes + micro-scintillement
export function sfxPickup() {
  if (!sfxReady()) return; const t = ST();
  partial(t, jit(880, 0.04), 0.1, 0.08);
  partial(t + 0.07, jit(1318, 0.04), 0.14, 0.07);
  nzSweep(t + 0.04, 0.18, 0.02, 'highpass', 6800, 9000, 1, 0.015);
}
// fiole : gargouillis — 3 bulles montantes désaccordées
export function sfxPotion() {
  if (!sfxReady()) return; const t = ST();
  [jit(300, 0.1), jit(430, 0.1), jit(620, 0.1)].forEach((f, i) => {
    oscA('sine', f, f * jit(2.6, 0.15), t + i * 0.11, 0.14, 0.07 - i * 0.012, 0.01);
  });
  nzSweep(t + 0.3, 0.15, 0.03, 'bandpass', 1200, 2400, 1.4, 0.01);
}
// niveau supérieur : fanfare ascendante + queue de scintillements
export function sfxLevel() {
  if (!sfxReady()) return; const t = ST();
  [523, 659, 784, 1047].forEach((f, i) => {
    const t0 = t + i * 0.09;
    oscA('triangle', f, f, t0, 0.32, 0.09, 0.008);
    partial(t0, f * 2, 0.2, 0.03);
  });
  nzSweep(t + 0.3, 0.5, 0.03, 'highpass', 7000, 10000, 1, 0.05);
}
// forge : 3 coups d'enclume + grondement de forge + dernier ding harmonique
export function sfxCraft() {
  if (!uiReady()) return; const t = ST(); const d = UIB();
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.28;
    anvil(tt, jit(1800 + i * 260, 0.08), 0.17, d);
    oscA('sine', jit(140, 0.06), 55, tt, 0.09, 0.18, 0.002, d);
  }
  nzSweep(t + 0.8, 0.35, 0.05, 'lowpass', 900, 300, 1, 0.05, d);
  chime(t + 0.92, 1568, 0.55, 0.06, d);
}
// équipement : cliquet de boucle + froissement de cuir + note claire
export function sfxEquip() {
  if (!uiReady()) return; const t = ST(); const d = UIB();
  nzSweep(t, 0.045, 0.15, 'bandpass', jit(2600, 0.15), jit(3200, 0.15), 4, 0.001, d);
  oscA('triangle', jit(660, 0.05), jit(660, 0.05), t + 0.06, 0.14, 0.075, 0.004, d);
  nzSweep(t + 0.03, 0.12, 0.05, 'highpass', 5000, 7500, 1, 0.01, d);
  partial(t + 0.09, 1320, 0.2, 0.035, 'sine', d);
}
// réparation : limage granuleux + étincelles + montée de satisfaction
export function sfxRepair() {
  if (!uiReady()) return; const t = ST(); const d = UIB();
  for (let i = 0; i < 4; i++) {
    nzSweep(t + i * 0.17, 0.07, 0.11, 'highpass', jit(3600 + i * 400, 0.2), jit(5200 + i * 400, 0.2), 1.2, 0.002, d);
  }
  crackle(t + 0.5, 0.3, 7, 0.05, 4500, 9000, d);
  oscA('sine', jit(1100, 0.05), jit(1600, 0.05), t + 0.72, 0.3, 0.05, 0.02, d);
}
// équipement cassé : claquement sec + débris qui tombent
export function sfxBreak() {
  if (!uiReady()) return; const t = ST(); const d = UIB();
  nzSweep(t, 0.06, 0.22, 'bandpass', jit(850, 0.15), jit(400, 0.15), 2, 0.001, d);
  oscA('square', jit(230, 0.08), jit(50, 0.08), t, 0.2, 0.14, 0.003, d);
  crackle(t + 0.05, 0.25, 8, 0.06, 1200, 5500, d);
  oscA('sine', 110, 45, t + 0.03, 0.22, 0.15, 0.004, d);
}
// portail : montée scintillante + battement grave d'arrivée
export function sfxPortal() {
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(200, 0.05), jit(1650, 0.05), t, 0.75, 0.075, 0.05);
  nzSweep(t, 0.65, 0.05, 'highpass', jit(5500, 0.1), jit(8200, 0.1), 1, 0.04);
  chime(t + 0.55, 1568, 0.6, 0.045);
  oscA('sine', 90, 45, t + 0.6, 0.4, 0.1, 0.01);
}
// bombe : souffle → déflagration massive en couches + onde sourde
export function sfxNuke() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 1.7, 0.45, 'lowpass', jit(600, 0.1), 120, 0.8, 0.02);
  oscA('sine', jit(95, 0.05), 26, t, 1.5, 0.48, 0.01);
  nzSweep(t + 0.15, 0.85, 0.3, 'bandpass', jit(280, 0.1), jit(90, 0.1), 0.7, 0.01);
  crackle(t + 0.1, 1.1, 26, 0.09, 800, 6000);
  oscA('sawtooth', jit(160, 0.05), jit(35, 0.05), t + 0.05, 1.1, 0.12, 0.02);
  duck(0.4, 0.9);
}
// rugissement de boss : 3 couches de grondement + souffle + grognements
export function sfxBoss() {
  if (!sfxReady()) return; const t = ST();
  oscA('sawtooth', jit(72, 0.06), jit(46, 0.06), t, 0.95, 0.19, 0.02);
  oscA('sawtooth', jit(98, 0.06), jit(56, 0.06), t, 0.9, 0.13, 0.02);
  oscA('sawtooth', jit(50, 0.05), jit(32, 0.05), t, 1.2, 0.19, 0.02);
  oscA('square', jit(145, 0.06), jit(58, 0.06), t + 0.06, 0.75, 0.06, 0.02);
  nzSweep(t, 0.75, 0.15, 'lowpass', jit(420, 0.1), 220, 1, 0.01);
  nzSweep(t + 0.05, 0.6, 0.11, 'bandpass', jit(300, 0.1), jit(700, 0.1), 1.5, 0.01);
  crackle(t, 0.5, 8, 0.04, 700, 3000);
}
// rugissement du boss FINAL : immense, en deux temps (cri + grondement)
export function sfxBossRoar() {
  if (!sfxReady()) return; const t = ST();
  oscA('sawtooth', jit(56, 0.05), jit(30, 0.05), t, 1.7, 0.29, 0.03);
  oscA('sawtooth', jit(84, 0.05), jit(38, 0.05), t, 1.65, 0.19, 0.03);
  oscA('square', jit(38, 0.04), jit(21, 0.04), t, 1.8, 0.15, 0.03);
  oscA('sawtooth', jit(250, 0.06), jit(55, 0.06), t + 0.3, 1.15, 0.09, 0.05); // hurlement
  nzSweep(t, 1.5, 0.2, 'lowpass', jit(340, 0.08), 180, 1, 0.02);
  nzSweep(t + 0.08, 1.05, 0.14, 'bandpass', jit(500, 0.1), jit(250, 0.1), 1.1, 0.02);
  nzSweep(t + 0.2, 0.75, 0.09, 'highpass', jit(1800, 0.15), jit(3000, 0.15), 1, 0.02);
  crackle(t + 0.2, 1.0, 14, 0.05, 900, 4500);
  duck(0.35, 0.8);
}
// transition de phase : coup dramatique + grondement + descente sinistre
export function sfxPhase() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.5, 0.28, 'lowpass', jit(300, 0.08), 140, 1, 0.01);
  oscA('sine', jit(125, 0.05), jit(30, 0.05), t, 1.05, 0.4, 0.01);
  oscA('sawtooth', jit(195, 0.05), jit(42, 0.05), t + 0.05, 0.95, 0.17, 0.01);
  [311, 392, 466].forEach((f, i) => oscA('triangle', f, f * 0.5, t + 0.18 + i * 0.13, 0.55, 0.065, 0.01));
  nzSweep(t + 0.15, 0.85, 0.07, 'bandpass', jit(650, 0.1), jit(300, 0.1), 1.4, 0.01);
  duck(0.3, 0.6);
}
// effondrement du boss final : long grondement + débris propres à son univers
export function sfxBossDie(kind = '') {
  if (!sfxReady()) return; const t = ST();
  const k = kind || '';
  const ice = k.includes('Glace'), hell = k.includes('Enfer'), sewer = k.includes('Egout'),
    space = k.includes('Space'), storm = k.includes('Tempete');
  // corps commun : descente grave + fracas sourd
  oscA('sawtooth', jit(96, 0.05), jit(24, 0.05), t, 2.4, 0.28, 0.02);
  oscA('sine', jit(63, 0.04), jit(17, 0.04), t, 2.6, 0.34, 0.02);
  oscA('square', jit(50, 0.04), jit(19, 0.04), t + 0.1, 1.9, 0.11, 0.02);
  nzSweep(t, 2.1, 0.19, 'lowpass', jit(360, 0.08), 120, 1, 0.02);
  // craquements progressifs (tous les boss)
  for (let i = 0; i < 6; i++) nzSweep(t + 0.35 + i * 0.33, 0.1, 0.11, 'bandpass', jit(650 + i * 230, 0.15), jit(300 + i * 120, 0.15), 2.2, 0.002);
  // teinte de l'univers
  if (ice) { // éclats de cristal
    for (let i = 0; i < 7; i++) partial(t + 0.5 + i * 0.24, jit(1900 + i * 420, 0.1), 0.5, 0.035);
    nzSweep(t + 0.4, 1.6, 0.07, 'highpass', 3400, 5200, 1, 0.05);
  } else if (hell) { // braises
    crackle(t + 0.3, 1.8, 30, 0.08, 600, 5200);
    nzSweep(t + 0.5, 1.5, 0.1, 'lowpass', 700, 200, 0.9, 0.06);
  } else if (sewer) { // bulles et vase
    for (let i = 0; i < 6; i++) oscA('sine', jit(500 + i * 140, 0.15), jit(900 + i * 200, 0.15), t + 0.4 + i * 0.3, 0.22, 0.045, 0.02);
    nzSweep(t + 0.3, 1.7, 0.09, 'bandpass', 420, 180, 1.3, 0.05);
  } else if (space) { // résonances cosmiques
    for (let i = 0; i < 5; i++) partial(t + 0.4 + i * 0.3, jit(700 + i * 500, 0.08), 1.1, 0.03);
    nzSweep(t + 0.3, 1.8, 0.06, 'bandpass', 1400, 3200, 2.5, 0.08);
  } else if (storm) { // rafales
    for (let i = 0; i < 4; i++) gust(t + 0.3 + i * 0.45, 0.7, 0.1, jit(500, 0.15), jit(2400, 0.15), 0.9);
  } else { // pierre et ombre (Terres Oubliées)
    for (let i = 0; i < 6; i++) nzSweep(t + 0.3 + i * 0.3, 0.12, 0.1, 'lowpass', jit(500, 0.2), jit(150, 0.2), 1, 0.004);
    crackle(t + 0.2, 1.4, 12, 0.05, 400, 3200);
  }
  nzSweep(t + 1.9, 0.55, 0.13, 'lowpass', 210, 90, 1, 0.02);
  duck(0.4, 1.0);
}
// coup porté à un boss : impact lourd métallique + craquement
export function sfxBossHit() {
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(175, 0.06), jit(45, 0.06), t, 0.22, 0.3, 0.003);
  nzSweep(t, 0.1, 0.19, 'bandpass', jit(1750, 0.12), jit(1100, 0.12), 2, 0.001);
  oscA('triangle', jit(530, 0.06), jit(115, 0.06), t, 0.15, 0.085, 0.003);
  nzSweep(t + 0.02, 0.05, 0.09, 'highpass', jit(5200, 0.15), jit(6800, 0.15), 1, 0.001);
  duck(0.12, 0.2);
}
// attaque signature du boss final : identité sonore par élément
export function sfxBossAtk(kind) {
  if (!sfxReady()) return; const t = ST();
  if (kind === 'fire') { // souffle brûlant + grondement + crépitements
    nzSweep(t, 0.6, 0.24, 'lowpass', jit(700, 0.1), jit(300, 0.1), 0.9, 0.01);
    oscA('sawtooth', jit(215, 0.06), jit(55, 0.06), t, 0.6, 0.12, 0.005);
    nzSweep(t + 0.1, 0.45, 0.13, 'bandpass', jit(1500, 0.15), jit(700, 0.15), 0.9, 0.005);
    crackle(t, 0.5, 12, 0.07, 900, 6000);
  } else if (kind === 'ice') { // vent glacial + cristaux qui tintent
    nzSweep(t, 0.5, 0.19, 'highpass', jit(3400, 0.12), jit(5200, 0.12), 1, 0.008);
    oscA('sine', jit(1350, 0.08), jit(290, 0.08), t, 0.5, 0.085, 0.004);
    oscA('sine', jit(1980, 0.08), jit(720, 0.08), t + 0.05, 0.4, 0.045, 0.004);
    partial(t + 0.15, 2637, 0.5, 0.03);
    crackle(t, 0.4, 8, 0.05, 4000, 9000);
  } else if (kind === 'earth') { // grondement + roches qui se fendent
    nzSweep(t, 0.75, 0.28, 'lowpass', jit(280, 0.1), 120, 1, 0.008);
    oscA('sine', jit(88, 0.05), jit(30, 0.05), t, 0.75, 0.28, 0.005);
    nzSweep(t + 0.08, 0.55, 0.15, 'bandpass', jit(380, 0.12), jit(160, 0.12), 1.2, 0.005);
    crackle(t + 0.05, 0.5, 10, 0.07, 500, 2600);
  } else if (kind === 'acid') { // vase : bouillonnement + gouttes acides
    nzSweep(t, 0.65, 0.2, 'bandpass', jit(520, 0.1), jit(260, 0.1), 1.4, 0.01);
    oscA('sine', jit(145, 0.06), jit(58, 0.06), t, 0.65, 0.13, 0.005);
    oscA('sine', jit(950, 0.08), jit(1500, 0.08), t + 0.12, 0.32, 0.045, 0.01);
    nzSweep(t + 0.2, 0.45, 0.09, 'highpass', jit(2500, 0.15), jit(4000, 0.15), 1, 0.01);
    crackle(t + 0.15, 0.4, 6, 0.04, 2000, 6000);
  } else if (kind === 'storm') { // whoosh de tornade + claquement électrique
    gust(t, 0.75, 0.22, jit(650, 0.12), jit(2600, 0.12), 1.1);
    oscA('sawtooth', jit(95, 0.06), jit(38, 0.06), t, 0.75, 0.13, 0.005);
    nzSweep(t + 0.15, 0.55, 0.11, 'highpass', jit(2900, 0.15), jit(4800, 0.15), 1, 0.01);
    oscA('sine', jit(2300, 0.1), jit(600, 0.1), t + 0.2, 0.32, 0.035, 0.005);
    crackle(t + 0.1, 0.4, 8, 0.06, 3000, 8000);
  } else if (kind === 'void') { // sirène cosmique + marée gravitationnelle
    oscA('sine', jit(820, 0.06), jit(90, 0.06), t, 0.75, 0.15, 0.005);
    oscA('sine', jit(1250, 0.06), jit(155, 0.06), t + 0.05, 0.55, 0.07, 0.005);
    nzSweep(t, 0.6, 0.17, 'bandpass', jit(950, 0.15), jit(500, 0.15), 2.5, 0.005);
    nzSweep(t + 0.15, 0.35, 0.09, 'highpass', jit(4400, 0.15), jit(6500, 0.15), 1, 0.008);
    partial(t + 0.1, 1760, 0.5, 0.03);
  } else { // shadow / défaut : souffle sombre + grondement
    nzSweep(t, 0.55, 0.18, 'bandpass', jit(400, 0.12), jit(180, 0.12), 1, 0.008);
    oscA('square', jit(155, 0.07), jit(55, 0.07), t, 0.55, 0.1, 0.005);
    oscA('sawtooth', jit(310, 0.07), jit(85, 0.07), t + 0.08, 0.45, 0.055, 0.005);
    crackle(t, 0.35, 6, 0.04, 800, 3500);
  }
  duck(0.15, 0.3);
}
// nouvelle vague : annonce au cor + coup de gong grave
export function sfxWave() {
  if (!sfxReady()) return; const t = ST();
  gong(t, jit(196, 0.04), 1.1, 0.1);
  oscA('sawtooth', jit(294, 0.04), jit(294, 0.04), t + 0.05, 0.8, 0.045, 0.04);
  nzSweep(t, 0.35, 0.05, 'bandpass', jit(1300, 0.1), jit(800, 0.1), 2, 0.01);
}
// alerte : deux notes graves descendantes + claquement sourd
export function sfxWarn() {
  if (!sfxReady()) return; const t = ST();
  oscA('sawtooth', jit(335, 0.05), jit(160, 0.05), t, 0.55, 0.09, 0.005);
  oscA('sawtooth', jit(225, 0.05), jit(110, 0.05), t + 0.13, 0.6, 0.09, 0.005);
  nzSweep(t, 0.32, 0.045, 'lowpass', jit(750, 0.1), 350, 1, 0.005);
  oscA('sine', 80, 45, t + 0.1, 0.3, 0.08, 0.005);
}

// ---------- TITAN DE FEU : transformation, laser, main de feu, éruption ----------
// transformation : montée de feu + battements de cœur + crépitements
export function sfxHellTransform() {
  if (!sfxReady()) return; const t = ST();
  oscA('sawtooth', jit(60, 0.05), jit(220, 0.05), t, 0.9, 0.16, 0.05);
  oscA('sine', jit(90, 0.05), jit(45, 0.05), t + 0.55, 0.6, 0.22, 0.02);
  nzSweep(t + 0.2, 0.9, 0.14, 'lowpass', jit(500, 0.12), jit(1400, 0.12), 0.9, 0.06);
  crackle(t + 0.15, 0.9, 24, 0.08, 700, 5500);
  oscA('square', jit(180, 0.05), jit(60, 0.05), t + 0.1, 0.5, 0.07, 0.01);
  duck(0.3, 0.7);
}
// laser de feu : souffle + zap descendant + crépitements de brûlure
export function sfxFireLaser() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.22, 0.2, 'bandpass', jit(2800, 0.15), jit(900, 0.15), 1.4, 0.003);
  oscA('sawtooth', jit(950, 0.1), jit(160, 0.1), t, 0.2, 0.11, 0.002);
  oscA('square', jit(1900, 0.1), jit(300, 0.1), t, 0.12, 0.05, 0.001);
  crackle(t, 0.18, 8, 0.07, 1200, 7000);
  oscA('sine', 70, 40, t, 0.18, 0.14, 0.002);
}
// main de feu : whoosh enflammé + burst au lancement
export function sfxFireHand() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.4, 0.2, 'bandpass', jit(400, 0.12), jit(2200, 0.12), 1, 0.03);
  oscA('sawtooth', jit(140, 0.08), jit(480, 0.08), t + 0.1, 0.3, 0.09, 0.02);
  crackle(t + 0.15, 0.35, 16, 0.08, 800, 6000);
  oscA('sine', 85, 40, t + 0.2, 0.3, 0.18, 0.01);
}
// éruption volcanique : boom profond + projections de roche + sifflement
export function sfxVolcano() {
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(75, 0.05), jit(30, 0.05), t, 0.6, 0.34, 0.004);
  nzSweep(t, 0.65, 0.3, 'lowpass', jit(600, 0.1), 140, 0.9, 0.005);
  crackle(t + 0.05, 0.55, 20, 0.09, 500, 5000);
  nzSweep(t + 0.1, 0.5, 0.16, 'bandpass', jit(900, 0.15), jit(300, 0.15), 1, 0.01);
  duck(0.28, 0.5);
}
// fin de transformation : le feu s'éteint en soupir
export function sfxTitanEnd() {
  if (!sfxReady()) return; const t = ST();
  oscA('sawtooth', jit(200, 0.06), jit(50, 0.06), t, 0.8, 0.12, 0.02);
  nzSweep(t, 0.7, 0.11, 'lowpass', jit(900, 0.1), 250, 0.9, 0.03);
  crackle(t, 0.6, 14, 0.05, 600, 4500);
  oscA('sine', 120, 45, t + 0.15, 0.5, 0.1, 0.02);
}

// ---------- ULTIME : PLUIE DE GLACE (sound design en 4 couches) ----------
// activation : montée grave mystérieuse + cristaux qui tintent
export function sfxIceCharge() {
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(72, 0.05), jit(250, 0.05), t, 1.2, 0.1, 0.06);
  oscA('triangle', jit(145, 0.05), jit(490, 0.05), t + 0.1, 1.05, 0.045, 0.06);
  nzSweep(t, 1.05, 0.04, 'bandpass', jit(2300, 0.1), jit(3400, 0.1), 2.5, 0.08);
  [1568, 1976, 2637].forEach((f, i) => partial(t + 0.55 + i * 0.2, jit(f, 0.03), 0.34, 0.026));
}
// ouverture : déchirure lumineuse + accord de glace
export function sfxIceOpen() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.75, 0.12, 'bandpass', jit(1900, 0.1), jit(3200, 0.1), 0.8, 0.02);
  oscA('sawtooth', jit(285, 0.06), jit(990, 0.06), t, 0.65, 0.04, 0.01);
  [1047, 1319, 1568].forEach((f, i) => oscA('triangle', f, f, t + 0.12 + i * 0.09, 0.55, 0.037, 0.01));
  nzSweep(t + 0.1, 0.55, 0.045, 'highpass', jit(5400, 0.1), jit(7600, 0.1), 1, 0.02);
  chime(t + 0.3, 2093, 0.7, 0.03);
}
// tempête : vent glacial soutenu + grondement d'altitude (~8 s)
export function sfxIceStorm() {
  if (!sfxReady()) return; const t = ST();
  gust(t, 8.0, 0.08, jit(850, 0.05), jit(1150, 0.05), 0.55);
  nzSweep(t + 0.5, 7.0, 0.055, 'highpass', jit(3500, 0.08), jit(4200, 0.08), 1, 0.1);
  oscA('sine', jit(56, 0.04), jit(38, 0.04), t, 8.0, 0.065, 0.2);
  nzSweep(t + 1.2, 5.0, 0.035, 'bandpass', jit(520, 0.08), jit(380, 0.08), 0.8, 0.2);
  crackle(t + 0.4, 6.0, 30, 0.025, 5000, 9500);
}
// impact : craquement cristallin — pitch aléatoire contrôlé (anti-boucle)
export function sfxIceImpact(big = false) {
  if (!sfxReady()) return; const t = ST();
  const f = jit(1750 + Math.random() * 1400, 0.12);
  nzSweep(t, 0.05, big ? 0.12 : 0.065, 'highpass', jit(4300, 0.2), jit(6200, 0.2), 1, 0.001);
  oscA('sine', f, f * 0.55, t, 0.14, big ? 0.07 : 0.038, 0.002);
  oscA('sine', f * 1.5, f * 0.85, t + 0.025, 0.1, big ? 0.042 : 0.024, 0.002);
  partial(t + 0.04, f * 2.7, 0.2, big ? 0.03 : 0.015);
  if (big) { nzSweep(t, 0.24, 0.08, 'lowpass', 500, 200, 1, 0.004); oscA('sine', jit(125, 0.05), 45, t, 0.28, 0.075, 0.003); }
}
// fin : expiration glacée descendante + derniers tintements de cristal
export function sfxIceEnd() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 1.6, 0.1, 'highpass', jit(2700, 0.08), jit(1800, 0.08), 1, 0.06);
  oscA('sine', jit(1520, 0.05), jit(260, 0.05), t, 1.3, 0.05, 0.03);
  partial(t + 0.5, 2093, 0.65, 0.042);
  partial(t + 0.78, 3136, 0.55, 0.026);
  nzSweep(t + 0.3, 0.95, 0.035, 'bandpass', jit(720, 0.08), jit(420, 0.08), 0.7, 0.05);
}

// ---------- ARC CINÉTIQUE COSMIQUE ----------
export function sfxBowFire(power = 0.5) { // tir : zap cinétique montant, puissance = charge
  if (!sfxReady()) return; const t = ST();
  const p = Math.min(1, Math.max(0, power));
  oscA('sawtooth', jit(1450 + p * 850, 0.08), jit(180, 0.08), t, 0.15 + p * 0.1, 0.095 + p * 0.075, 0.002);
  nzSweep(t, 0.13 + p * 0.12, 0.095 + p * 0.095, 'bandpass', jit(3700 + p * 2300, 0.12), jit(1400 + p * 800, 0.12), 3, 0.002);
  oscA('square', jit(2800 + p * 1200, 0.1), jit(500, 0.1), t, 0.1 + p * 0.06, 0.035 + p * 0.03, 0.001);
  if (p > 0.55) {
    oscA('sine', jit(2300, 0.06), jit(3300, 0.06), t + 0.03, 0.2, 0.055, 0.005);
    nzSweep(t + 0.02, 0.11, 0.075, 'highpass', jit(6200, 0.15), jit(8400, 0.15), 1, 0.001);
  }
  if (p > 0.85) duck(0.15, 0.25);
}
export function sfxSingularity() { // SINGULARITÉ : compression gravitationnelle + explosion
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(62, 0.04), jit(250, 0.04), t, 0.55, 0.2, 0.03);
  oscA('sine', jit(92, 0.04), jit(30, 0.04), t + 0.45, 0.55, 0.23, 0.01);
  for (let i = 0; i < 4; i++) {
    oscA('sine', jit(950 + i * 380, 0.05), jit(1450 + i * 500, 0.05), t + 0.1 + i * 0.07, 0.45, 0.035, 0.01);
  }
  nzSweep(t + 0.47, 0.45, 0.15, 'lowpass', jit(950, 0.12), 300, 1, 0.005);
  nzSweep(t, 0.55, 0.045, 'highpass', jit(4200, 0.1), jit(6200, 0.1), 1, 0.02);
  duck(0.3, 0.5);
}

// ---------- SFX boutique / progression ----------
export function sfxBuy() { // achat : deux pièces + registre satisfaisant
  if (!uiReady()) return; const t = ST(); const d = UIB();
  coin(t, jit(1568, 0.04), 0.065, d);
  coin(t + 0.1, jit(2093, 0.04), 0.065, d);
  oscA('sine', jit(1050, 0.03), jit(1050, 0.03), t + 0.06, 0.22, 0.045, 0.01, d);
  nzSweep(t + 0.12, 0.25, 0.015, 'highpass', 7000, 9500, 1, 0.02, d);
}
export function sfxSell() { // vente : pièce grave + registre feutré
  if (!uiReady()) return; const t = ST(); const d = UIB();
  coin(t, jit(1319, 0.04), 0.055, d);
  oscA('sine', jit(660, 0.04), jit(660, 0.04), t + 0.11, 0.16, 0.055, 0.008, d);
  nzSweep(t + 0.08, 0.2, 0.03, 'bandpass', jit(1100, 0.1), jit(700, 0.1), 1.4, 0.01, d);
}
export function sfxUnlock() { // déblocage : arpège montant cristallin + halo
  if (!uiReady()) return; const t = ST(); const d = UIB();
  [784, 988, 1175, 1568].forEach((f, i) => {
    const t0 = t + i * 0.08;
    oscA('sine', jit(f, 0.02), jit(f, 0.02), t0, 0.42, 0.075, 0.008, d);
    partial(t0, f * 2.76, 0.3, 0.025, 'sine', d);
  });
  nzSweep(t + 0.1, 0.6, 0.035, 'highpass', jit(6200, 0.1), jit(9200, 0.1), 1, 0.05, d);
  chime(t + 0.42, 2637, 0.8, 0.035, d);
}
export function sfxAchievement() { // succès débloqué : fanfare dorée en cloches
  if (!uiReady()) return; const t = ST(); const d = UIB();
  [523, 659, 784, 1047, 1319].forEach((f, i) => {
    const t0 = t + i * 0.1;
    chime(t0, jit(f, 0.02), 0.6, 0.06, d);
  });
  gong(t + 0.5, jit(262, 0.03), 1.4, 0.06, d);
  nzSweep(t + 0.3, 0.7, 0.02, 'highpass', 7500, 10500, 1, 0.05, d);
}
// ---------- fin de campagne : sting triomphal sombre ----------
export function sfxVictory() {
  if (!sfxReady()) return; const t = ST();
  gong(t, jit(196, 0.03), 2.2, 0.12);
  [392, 523, 659, 784].forEach((f, i) => {
    const t0 = t + 0.15 + i * 0.16;
    oscA('sawtooth', f, f, t0, 0.9, 0.05, 0.03);
    oscA('sine', f * 2, f * 2, t0, 0.6, 0.03, 0.02);
  });
  nzSweep(t + 0.2, 1.6, 0.03, 'highpass', 6000, 9000, 1, 0.1);
  duck(0.2, 0.5);
}

// ---------- JUGEMENT DU GARDIEN ----------
// frappe du Jugement : whoosh métallique grave + tranchant cristallin + impact sourd
export function sfxJudgment() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.16, 0.14, 'bandpass', 900, jit(2600, 0.2), 2.2, 0.01);   // whoosh montant
  nz(t, 0.05, 0.10, 'highpass', 3800, 1);                              // claquement de lame
  oscA('triangle', jit(220, 0.06), 90, t, 0.14, 0.12, 0.004);          // corps grave de l'impact
  partial(t + 0.02, jit(1567, 0.04), 0.3, 0.045, 'sine');              // cristallin du fuller
  nzSweep(t + 0.03, 0.09, 0.07, 'lowpass', 900, 300, 1, 0.002);        // masse sourde
  duck(0.12, 0.18);
}
// concentration de Sentence ancestrale : montée cristalline grave qui s'épaissit
export function sfxSentenceCharge() {
  if (!sfxReady()) return; const t = ST();
  const DUR = 0.85;
  oscA('sine', 196, 784, t, DUR, 0.055, DUR * 0.55);                   // fondamentale montante
  oscA('triangle', 392, 1175, t, DUR, 0.03, DUR * 0.6);                // quinte au-dessus
  nzSweep(t, DUR, 0.045, 'bandpass', 800, 4200, 3, DUR * 0.5);         // souffle runique montant
  // runes qui s'allument : carillons échelonnés
  [523, 659, 784, 988].forEach((f, i) => {
    const tt = t + 0.12 + i * 0.16;
    partial(tt, f, 0.4, 0.035, 'sine');
    partial(tt, f * 2.01, 0.22, 0.014, 'sine');
  });
  // battement grave de la charge (comme un cœur qui s'accélère)
  for (let i = 0; i < 5; i++) {
    const tt = t + i * (0.12 + i * 0.015);
    oscA('sine', jit(98, 0.04), 60, tt, 0.1, 0.08 - i * 0.008, 0.003);
  }
}
// libération : gong ancestral + balayage d'onde + impact de choc runique
export function sfxSentenceRelease() {
  if (!sfxReady()) return; const t = ST();
  gong(t, jit(147, 0.03), 1.8, 0.14);                                  // gong grave du verdict
  nzSweep(t, 0.4, 0.16, 'bandpass', 500, 5200, 1.4, 0.02);             // onde qui balaie
  nzSweep(t + 0.05, 0.25, 0.11, 'highpass', 2500, 7000, 1, 0.01);      // éclats cristallins
  oscA('sine', jit(98, 0.04), 40, t, 0.5, 0.18, 0.005);                // sub grave de l'impact
  [587, 740, 880, 1175].forEach((f, i) => {
    const tt = t + 0.1 + i * 0.07;
    partial(tt, f, 0.7, 0.05, 'sine');
    partial(tt, f * 1.5, 0.4, 0.02, 'sine');
  });
  crackle(t + 0.08, 0.3, 12, 0.05, 3000, 9000);                        // crépitements de runes
  duck(0.28, 0.4);
}
// obtention du Jugement : révélation mémorable — grondement, arpège ascendant, halo
export function sfxGardienUnlock() {
  if (!sfxReady()) return; const t = ST();
  gong(t, jit(98, 0.03), 2.6, 0.16);                                   // gong ancestral grave
  oscA('sine', jit(65, 0.03), 130, t, 1.4, 0.10, 0.4);                 // montée sourde
  [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => {             // arpège montant
    const tt = t + 0.5 + i * 0.13;
    partial(tt, f, 0.9, 0.05, 'sine');
    partial(tt, f * 2, 0.5, 0.02, 'triangle');
  });
  nzSweep(t + 0.4, 1.8, 0.04, 'highpass', 4000, 9000, 1, 0.8);         // voile lumineux
  for (let i = 0; i < 8; i++) {                                        // cristaux qui se forment
    const tt = t + 1.2 + Math.random() * 1.2;
    partial(tt, jit(1200 + Math.random() * 2400, 0.08), 0.4, 0.03, 'sine');
  }
  duck(0.3, 0.9);
}

// ---------- Chanteur des Profondeurs : identité sonore des orbes soniques ----------
// concentration : deux notes jumelles qui montent + souffle filtré montant
export function sfxSonicCharge() {
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(196, 0.04), 392, t, 0.55, 0.09, 0.08, sfxBus);
  oscA('sine', jit(294, 0.04), 588, t + 0.06, 0.5, 0.06, 0.08, sfxBus);
  nzSweep(t, 0.5, 0.05, 'bandpass', 300, 2600, 2.5, 0.15);
  for (let i = 0; i < 3; i++) partial(t + 0.15 + i * 0.12, jit(880 + i * 220, 0.05), 0.3, 0.025, 'sine');
  duck(0.15, 0.3);
}
// projection : souffle compressé + claquement + clochette grave
export function sfxSonicShot() {
  if (!sfxReady()) return; const t = ST();
  nzSweep(t, 0.16, 0.16, 'bandpass', 260, 2200, 1.4);
  oscA('triangle', jit(540, 0.05), 190, t, 0.15, 0.11, 0.004, sfxBus);
  partial(t + 0.02, jit(1040, 0.06), 0.28, 0.05, 'sine');
  partial(t + 0.05, jit(520, 0.04), 0.3, 0.04, 'triangle');
  duck(0.12, 0.2);
}
// impact : nappe sourde + ping cristallin court
export function sfxSonicHit() {
  if (!sfxReady()) return; const t = ST();
  oscA('sine', jit(170, 0.05), 58, t, 0.18, 0.13, 0.004, sfxBus);
  nzSweep(t, 0.12, 0.09, 'lowpass', 1000, 180);
  partial(t + 0.03, jit(940, 0.06), 0.22, 0.04, 'sine');
  duck(0.08, 0.15);
}

// debug/test : contexte musical courant + intensité
export function audioDebug() {
  return { key: themeKey(), inten: +musicIntensity().toFixed(2), boss: bossActive(),
           themes: Object.keys(MUSIC_THEMES).length };
}
