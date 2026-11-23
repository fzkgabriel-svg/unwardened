// ---------- DIFFICULTÉS DE CAMPAGNE : NORMAL / DIFFICILE / EXPERT ----------
// Chaque niveau de campagne (les 6 mondes) se joue en trois difficultés.
//   NORMAL    : le niveau tel qu'il existe (vagues, ennemis, récompenses actuels)
//   DIFFICILE : +2 vagues, ennemis renforcés, récompenses ×1,5 — débloqué par le Normal
//   EXPERT    : +5 vagues (par rapport au Normal), élites + modificateurs de vague,
//               récompenses ×2 — débloqué par le Difficile
// La progression est sauvegardée par personnage dans stats.diffProg[c].
import { G, saveStats, finalWave } from './state.js';

export const DIFFS = [
  {
    id: 0, name: 'NORMAL', icon: '⚔', color: '#69f0ae', edge: '#2e7d52',
    waveBonus: 0, hp: 1.0, dmg: 1.0, spd: 1.0, loot: 1.0, xp: 1.0,
    foes: 'Ennemis standards', rew: 'Récompenses ×1',
    desc: 'Difficulté standard du niveau.',
    lock: null,
  },
  {
    id: 1, name: 'DIFFICILE', icon: '🔥', color: '#ff8a65', edge: '#a33c17',
    waveBonus: 2, hp: 1.18, dmg: 1.22, spd: 1.03, loot: 1.5, xp: 1.25,
    foes: '+2 vagues · ennemis renforcés', rew: 'Récompenses ×1,5',
    desc: 'Deux vagues supplémentaires, des monstres plus durs et des butins améliorés.',
    lock: 'Terminez le niveau en NORMAL',
  },
  {
    id: 2, name: 'EXPERT', icon: '👑', color: '#e1bee7', edge: '#6a3d9a',
    waveBonus: 5, hp: 1.35, dmg: 1.45, spd: 1.06, loot: 2.0, xp: 1.5,
    foes: '+5 vagues · élites & modificateurs', rew: 'Récompenses ×2',
    desc: 'Cinq vagues supplémentaires, des monstres élites et des vagues modifiées.',
    lock: 'Terminez le niveau en DIFFICILE',
  },
];

// ---------- progression par niveau ----------
// stats.diffProg[c] = { n, h, e (terminé), hu, eu (débloqué), bs[3] (scores), bt[3] (temps) }
export function diffProg(c) {
  const s = G.stats || {};
  s.diffProg = s.diffProg || {};
  let d = s.diffProg[c];
  if (!d) {
    d = s.diffProg[c] = { n: false, h: false, e: false, hu: false, eu: false, bs: [0, 0, 0], bt: [0, 0, 0] };
    // migration : les campagnes terminées avant la mise à jour comptent comme
    // un Normal validé et débloquent le Difficile correspondant
    if (s.campaignDone && s.campaignDone[c]) { d.n = true; d.hu = true; }
  }
  return d;
}

// une difficulté est lançable si le niveau l'exige : Normal toujours (le verrou
// du niveau lui-même est géré par campaignUnlocked), Difficile après le Normal,
// Expert après le Difficile — indépendamment pour chaque niveau.
export function diffPlayable(c, d) {
  const p = diffProg(c);
  if (d === 1) return !!p.n;
  if (d === 2) return !!p.h;
  return true;
}
// plus haute difficulté jamais débloquée (pour bornes et affichages)
export function diffUnlockedLevel(c) {
  const p = diffProg(c);
  return p.h ? 2 : p.n ? 1 : 0;
}

// victoire : enregistre la difficulté terminée, débloque la suivante,
// mémorise score/temps records. Retourne le nom de la difficulté débloquée.
export function recordDiffWin(c, d, score, timeSec) {
  const p = diffProg(c);
  if (d === 1) { p.h = true; p.eu = true; }
  else if (d === 2) p.e = true;
  else { p.n = true; p.hu = true; }
  if (score > (p.bs[d] || 0)) p.bs[d] = score;
  if (!p.bt[d] || timeSec < p.bt[d]) p.bt[d] = timeSec;
  // la campagne compte comme terminée dès qu'un niveau est gagné : la chaîne
  // de déblocage garantit que le Normal a été joué au préalable
  G.stats.campaignDone = G.stats.campaignDone || {};
  G.stats.campaignDone[c] = true;
  saveStats();
  G.diffJustUnlocked = d === 0 ? 'DIFFICILE' : d === 1 ? 'EXPERT' : null;
  return G.diffJustUnlocked;
}

// ---------- score de fin de partie ----------
export function runScore() {
  const p = G.player || {};
  return Math.round(
    (G.wave || 0) * 150 +
    (G.kills || 0) * 12 +
    (p.level || 1) * 100 +
    (G.bossesKilled || 0) * 400 +
    (G.dmgDealt || 0) / 40
  );
}

// ---------- modificateurs de vague (EXPERT uniquement) ----------
// appliqués au début de chaque vague non finale ; un seul à la fois.
export const WAVE_MODS = [
  { label: 'ESSAIM',    quota: 1.30, spawn: 0.8,  hp: 1.0,  dmg: 1.0,  spd: 1.0,  elite: 1.0 },
  { label: 'CROISADE',  quota: 1.0,  spawn: 1.0,  hp: 1.25, dmg: 1.10, spd: 1.0,  elite: 1.0 },
  { label: 'RUÉE',      quota: 1.0,  spawn: 1.0,  hp: 1.0,  dmg: 1.0,  spd: 1.22, elite: 1.0 },
  { label: 'CHASSEURS', quota: 1.15, spawn: 1.0,  hp: 1.0,  dmg: 1.0,  spd: 1.05, elite: 2.4 },
];
// la vague choisit son modificateur de façon déterministe et lisible
export function waveModFor(wave, difficulty) {
  if (difficulty !== 2 || wave >= finalWave()) return null;
  return WAVE_MODS[((wave % 4) + 4) % 4];
}
