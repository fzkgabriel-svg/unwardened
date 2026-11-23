// ---------- PROGRESSION & REJOUABILITÉ ----------
// Le NG+ (boucle de difficulté automatique après la campagne 5) a été retiré :
// il est remplacé par les difficultés par niveau (Normal/Difficile/Expert,
// voir js/difficulty.js), qui sont l'unique système de difficulté de la campagne.
// Reste le défi quotidien : chaque jour un modifier aléatoire (seed = date).
import { G } from './state.js';

// ---------- DÉFI DU JOUR ----------
// chaque entrée : modificateurs cumulés sur G.mods {enemyMult, speedMult,
// xpMult, lootMult, noPotions} + nom/desc pour le toast de lancement.
export const CHALLENGES = [
  { id: 'famine',    icon: '🥫', name: 'JOUR DE FAMINE',      desc: 'Aucune fiole : pas de soins, que la rage !',
    mods: { noPotions: true, enemyMult: 1.0,  lootMult: 1.3 } },
  { id: 'onslaught', icon: '⚔️', name: 'ASSAUT',             desc: 'Ennemis +30 % de PV/dégâts, butin +50 %',
    mods: { enemyMult: 1.3, lootMult: 1.5 } },
  { id: 'bounty',    icon: '💰', name: 'BAONNE PEINE',       desc: 'Butin ×2 (émeraudes, matériaux, XP)',
    mods: { enemyMult: 1.0,  lootMult: 2.0, xpMult: 2.0 } },
  { id: 'haste',     icon: '💨', name: 'COURSE-Poursuite',   desc: 'Ennemis +25 % de vitesse, PV/dégâts +10 %',
    mods: { enemyMult: 1.1, speedMult: 1.25 } },
  { id: 'elite',     icon: '👑', name: 'CHASSE AU TRÉSOR',   desc: 'Ennemis +15 %, mais chaque kill paie ×3 en XP',
    mods: { enemyMult: 1.15, xpMult: 3.0 } },
  { id: 'storm2',    icon: '🌪️', name: 'CŒUR DE TEMPÊTE',    desc: 'Ennemis +20 %, butin +25 %, XP +25 %',
    mods: { enemyMult: 1.2, lootMult: 1.25, xpMult: 1.25 } },
];
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function todayChallenge() {
  const d = new Date();
  const seed = hashStr(`challenge-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  return CHALLENGES[seed % CHALLENGES.length];
}

// ---------- CONSTRUCTION DES MODIFICATEURS DE PARTIE ----------
// appelé au lancement (startGame) : combine NG+ + défi du jour.
export function buildMods() {
  const ch = todayChallenge();
  const m = {
    enemyMult: 1, speedMult: 1, xpMult: 1, lootMult: 1,
    noPotions: false, ng: 0, challenge: ch.id,
  };
  const cm = ch.mods || {};
  for (const k of ['enemyMult', 'speedMult', 'xpMult', 'lootMult']) if (cm[k]) m[k] *= cm[k];
  if (cm.noPotions) m.noPotions = true;
  G.mods = m;
  return m;
}
// libellé court pour le HUD / la fiche campagne
export function modsLabel() {
  const m = G.mods || {};
  const parts = [];
  const ch = CHALLENGES.find(c => c.id === m.challenge);
  if (ch) parts.push(`${ch.icon} ${ch.name}`);
  return parts.join(' · ');
}
