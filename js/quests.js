// js/quests.js — quêtes quotidiennes : 3 missions par jour, récompenses en émeraudes
// Le tirage du jour est déterministe (seed = date) : identique pour tout le monde,
// et les compteurs quotidiens vivent dans stats.qday (reset automatique à minuit).
import { G, saveStats } from './state.js';
import { addMaterial } from './inventory.js';
import { sfxGem, sfxConfirm } from './audio.js';

function today() { return new Date().toLocaleDateString('en-CA'); } // YYYY-MM-DD local
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- compteurs du jour ----------
// stats.qday = { date:'YYYY-MM-DD', c:{kills,dmg,bosses,emerald,mats,mods,victories,potions,time}, mx:{wave,level} }
function qday() {
  G.stats = G.stats || {};
  const q = G.stats.qday = G.stats.qday || { date: '', c: {}, mx: {} };
  if (q.date !== today()) { q.date = today(); q.c = {}; q.mx = {}; q.claimed = []; }
  q.c = q.c || {}; q.mx = q.mx || {}; q.claimed = q.claimed || [];
  return q;
}
// incrémente un compteur (appélé depuis les événements de jeu)
export function qAdd(key, n = 1) {
  const c = qday().c;
  c[key] = (c[key] || 0) + n;
}
// mémorise un maximum (vague, niveau de héros)
export function qMax(key, v) {
  const mx = qday().mx;
  if ((mx[key] || 0) < v) mx[key] = v;
}

// ---------- catalogue des quêtes ----------
// metric : clé lue dans qday().c ou qday().mx · target : objectif
export const QPOOL = [
  { id: 'slayer',   icon: '⚔', label: 'Faucheuse',        desc: 'Tue 150 monstres',                 metric: 'kills',    c: true,  target: 150,   rew: 40 },
  { id: 'dmg',      icon: '💥', label: 'Ravage',           desc: 'Inflige 20 000 dégâts',            metric: 'dmg',      c: true,  target: 20000, rew: 60 },
  { id: 'boss',     icon: '👑', label: 'Chasseur de chefs',desc: 'Tue 3 boss ou mini-boss',         metric: 'bosses',   c: true,  target: 3,     rew: 80 },
  { id: 'wave10',   icon: '🌊', label: 'Survivant',        desc: 'Atteins la vague 10',             metric: 'wave',     c: false, target: 10,    rew: 50 },
  { id: 'wave20',   icon: '🌊', label: 'Inébranlable',     desc: 'Atteins la vague 20',             metric: 'wave',     c: false, target: 20,    rew: 120 },
  { id: 'emerald',  icon: '💚', label: 'Cueilleur',        desc: 'Gagne 8 émeraudes',                metric: 'emerald',  c: true,  target: 8,     rew: 70 },
  { id: 'mats',     icon: '⛏', label: 'Prospecteur',      desc: 'Gagne 25 matériaux',              metric: 'mats',     c: true,  target: 25,    rew: 50 },
  { id: 'mods',     icon: '⚙', label: 'Expert technique', desc: 'Utilise un module 5 fois',        metric: 'mods',     c: true,  target: 5,     rew: 60 },
  { id: 'victory',  icon: '🏆', label: 'Conquérant',       desc: 'Termine une campagne',            metric: 'victories',c: true,  target: 1,     rew: 150 },
  { id: 'time',     icon: '⏳', label: 'Endurance',        desc: 'Survis 5 minutes en jeu',         metric: 'time',     c: true,  target: 300,   rew: 40 },
  { id: 'potions',  icon: '🧪', label: 'Apothicaire',      desc: 'Bois 3 fioles',                   metric: 'potions',  c: true,  target: 3,     rew: 30 },
  { id: 'level',    icon: '⭐', label: 'Ascension',        desc: 'Atteins le niveau 8',             metric: 'level',    c: false, target: 8,     rew: 80 },
];
export const QUEST_DAY_COUNT = 3;

// les 3 quêtes du jour : tirage déterministe identique pour tous les joueurs
export function dailyQuests() {
  const d = new Date();
  const seed = hashStr(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  const rng = mulberry32(seed);
  const pool = [...QPOOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, QUEST_DAY_COUNT);
}

function curOf(q) {
  const day = qday();
  return (q.c ? day.c : day.mx)[q.metric] || 0;
}
// état d'une quête du jour : {q, cur, done, claimed}
export function questState(q) {
  const cur = curOf(q);
  return { q, cur: Math.min(cur, q.target), done: cur >= q.target, claimed: qday().claimed.includes(q.id) };
}
export function questsDoneToday() { return dailyQuests().filter(q => questState(q).done).length; }
export function questsClaimable() { return dailyQuests().some(q => { const s = questState(q); return s.done && !s.claimed; }); }
export function questsLeftToday() { return dailyQuests().filter(q => !questState(q).claimed).length; }

// temps restant avant minuit (pour l'affichage)
export function questCountdown() {
  const n = new Date();
  const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0);
  return Math.max(0, Math.floor((mid - n) / 1000));
}

// réclame la récompense d'une quête terminée : émeraudes dans l'inventaire
export function claimQuest(id) {
  const q = QPOOL.find(x => x.id === id);
  if (!q) return { ok: false, msg: 'Quête inconnue' };
  if (!dailyQuests().includes(q)) return { ok: false, msg: 'Pas une quête du jour' };
  const s = questState(q);
  if (!s.done) return { ok: false, msg: 'Objectif non atteint' };
  if (s.claimed) return { ok: false, msg: 'Déjà réclamée' };
  const day = qday();
  day.claimed.push(q.id);
  addMaterial(G.inv, 'emeraude', q.rew);
  G.runMats = G.runMats || {};
  G.runMats.emeraude = (G.runMats.emeraude || 0) + q.rew;
  saveStats();
  sfxGem(); sfxConfirm();
  return { ok: true, msg: `+${q.rew} émeraudes`, rew: q.rew };
}
