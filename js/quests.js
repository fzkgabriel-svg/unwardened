// js/quests.js — quêtes quotidiennes (durcies) + hebdomadaires (coffres à modules)
// Le tirage est déterministe (seed = date / semaine ISO) : identique pour tous.
// Compteurs dans stats.qday (reset minuit) et stats.qweek (reset lundi minuit).
import { G, saveStats } from './state.js';
import { addMaterial } from './inventory.js';
import { ownModule, modState, MODULES, MOD_IDS } from './modules.js';
import { sfxGem, sfxConfirm, sfxVictory } from './audio.js';

function today() { return new Date().toLocaleDateString('en-CA'); } // YYYY-MM-DD local
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// lundi de la semaine courante (clé de reset hebdo, minuit heure locale)
function mondayOfWeek() {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - dow);
  return d.toLocaleDateString('en-CA');
}
// temps restant avant le prochain lundi minuit
export function weekCountdown() {
  const n = new Date();
  const mon = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const dow = (mon.getDay() + 6) % 7;
  mon.setDate(mon.getDate() - dow + 7); // prochain lundi
  mon.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((mon - n) / 1000));
}

// ---------- compteurs du jour + de la semaine ----------
// stats.qday = { date:'YYYY-MM-DD', c:{...}, mx:{wave,level} }
// stats.qweek = { week:'YYYY-MM-DD'(lundi), c:{...}, mx:{...} } — mêmes métriques, cumul hebdo
function qday() {
  G.stats = G.stats || {};
  const q = G.stats.qday = G.stats.qday || { date: '', c: {}, mx: {}, wl: [] };
  if (q.date !== today()) { q.date = today(); q.c = {}; q.mx = {}; q.claimed = []; q.wl = []; }
  q.c = q.c || {}; q.mx = q.mx || {}; q.claimed = q.claimed || []; q.wl = q.wl || [];
  return q;
}
function qweek() {
  G.stats = G.stats || {};
  const q = G.stats.qweek = G.stats.qweek || { week: '', c: {}, mx: {}, wl: [] };
  const wk = mondayOfWeek();
  if (q.week !== wk) { q.week = wk; q.c = {}; q.mx = {}; q.claimed = []; q.wl = []; }
  q.c = q.c || {}; q.mx = q.mx || {}; q.claimed = q.claimed || []; q.wl = q.wl || [];
  return q;
}
// incrémente un compteur (jour + semaine) — appelé depuis les événements de jeu
export function qAdd(key, n = 1) {
  const c = qday().c; c[key] = (c[key] || 0) + n;
  const w = qweek().c; w[key] = (w[key] || 0) + n;
}
// victoire dans un monde distinct : ne compte qu'une fois par campagne et par période
export function qWinWorld(campaign) {
  for (const q of [qday(), qweek()]) {
    if (!q.wl.includes(campaign)) { q.wl.push(campaign); q.c.worlds = (q.c.worlds || 0) + 1; }
  }
}
// mémorise un maximum (jour + semaine)
export function qMax(key, v) {
  const mx = qday().mx; if ((mx[key] || 0) < v) mx[key] = v;
  const wm = qweek().mx; if ((wm[key] || 0) < v) wm[key] = v;
}

// ---------- catalogue des quêtes ----------
// metric/c : clé + compteur (c=true → cumul, false → max) · target : objectif
// metric2/c2/target2 (optionnel) : seconde condition — les deux doivent être remplies
export const QPOOL = [
  { id: 'slayer',   icon: '⚔', label: 'Faucheuse',        desc: 'Tue 300 monstres',                    metric: 'kills',    c: true,  target: 300,   rew: 30 },
  { id: 'dmg',      icon: '💥', label: 'Ravage',           desc: 'Inflige 80 000 dégâts',               metric: 'dmg',      c: true,  target: 80000, rew: 45 },
  { id: 'boss',     icon: '👑', label: 'Chasseur de chefs',desc: 'Tue 8 boss ou mini-boss',            metric: 'bosses',   c: true,  target: 8,     rew: 60 },
  { id: 'wave10',   icon: '🌊', label: 'Survivant',        desc: 'Atteins la vague 16',                metric: 'wave',     c: false, target: 16,    rew: 40 },
  { id: 'wave20',   icon: '🌊', label: 'Inébranlable',     desc: 'Atteins la vague 30',                metric: 'wave',     c: false, target: 30,    rew: 90 },
  { id: 'emerald',  icon: '💚', label: 'Cueilleur',        desc: 'Gagne 15 émeraudes',                  metric: 'emerald',  c: true,  target: 15,    rew: 50 },
  { id: 'mats',     icon: '⛏', label: 'Prospecteur',      desc: 'Gagne 60 matériaux',                 metric: 'mats',     c: true,  target: 60,    rew: 40 },
  { id: 'mods',     icon: '⚙', label: 'Expert technique', desc: 'Utilise un module 12 fois',          metric: 'mods',     c: true,  target: 12,    rew: 45 },
  { id: 'victory',  icon: '🏆', label: 'Conquérant',       desc: 'Termine une campagne',               metric: 'victories',c: true,  target: 1,     rew: 100 },
  { id: 'time',     icon: '⏳', label: 'Endurance',        desc: 'Survis 10 minutes en jeu',           metric: 'time',     c: true,  target: 600,   rew: 35 },
  { id: 'potions',  icon: '🧪', label: 'Apothicaire',      desc: 'Bois 6 fioles',                      metric: 'potions',  c: true,  target: 6,     rew: 25 },
  { id: 'level',    icon: '⭐', label: 'Ascension',        desc: 'Atteins le niveau 15',               metric: 'level',    c: false, target: 15,    rew: 60 },
  // --- quêtes composées / à mécanique ---
  { id: 'ult',      icon: '☄', label: 'Destructeur',       desc: 'Déchaîne ton ultime 10 fois',        metric: 'ult',      c: true,  target: 10,    rew: 55 },
  { id: 'craft',    icon: '🔨', label: 'Artisan',          desc: 'Forge 4 objets à la forge',         metric: 'craft',    c: true,  target: 4,     rew: 50 },
  { id: 'dist',     icon: '👣', label: 'Marcheur',         desc: 'Parcours 1 200 mètres',              metric: 'dist',     c: true,  target: 1200,  rew: 45 },
  { id: 'combo1',   icon: '⚡', label: 'Double pression',  desc: 'Vague 18 + 150 monstres',            metric: 'wave',     c: false, target: 18, metric2: 'kills', c2: true, target2: 150, rew: 75 },
  { id: 'combo2',   icon: '🔥', label: 'Roi du jour',      desc: '800 émeraudes… non : 80 000 dégâts + vague 20', metric: 'dmg', c: true, target: 80000, metric2: 'wave', c2: false, target2: 20, rew: 85 },
  { id: 'flawless', icon: '🛡', label: 'Sans faille',      desc: 'Termine une campagne sans mourir',   metric: 'flawless', c: true,  target: 1,     rew: 120 },
];
export const QUEST_DAY_COUNT = 3;

// ---------- quêtes hebdomadaires : 3 par semaine, reset lundi minuit ----------
// Récompense : un COFFRE qui s'ouvre en animation et donne un module au hasard.
export const WQPOOL = [
  { id: 'w_slayer',  icon: '⚔', label: 'Faucheur impitoyable', desc: 'Tue 4 000 monstres',            metric: 'kills',    c: true,  target: 4000 },
  { id: 'w_dmg',     icon: '💥', label: 'Cataclysme',           desc: 'Inflige 900 000 dégâts',         metric: 'dmg',      c: true,  target: 900000 },
  { id: 'w_boss',    icon: '👑', label: 'Pourfendeur de rois',  desc: 'Tue 30 boss ou mini-boss',      metric: 'bosses',   c: true,  target: 30 },
  { id: 'w_wave',    icon: '🌊', label: 'Inarrêtable',          desc: 'Atteins la vague 45',           metric: 'wave',     c: false, target: 45 },
  { id: 'w_emerald', icon: '💚', label: 'Fortune verte',        desc: 'Gagne 120 émeraudes',           metric: 'emerald',  c: true,  target: 120 },
  { id: 'w_mats',    icon: '⛏', label: 'Mine inépuisable',     desc: 'Gagne 600 matériaux',           metric: 'mats',     c: true,  target: 600 },
  { id: 'w_mods',    icon: '⚙', label: 'Savant des modules',   desc: 'Utilise un module 90 fois',     metric: 'mods',     c: true,  target: 90 },
  { id: 'w_victory', icon: '🏆', label: 'Conquérant des mondes',desc:'Termine 3 royaumes différents',  metric: 'worlds',   c: true,  target: 3 },
  { id: 'w_time',    icon: '⏳', label: 'Marathonien',          desc: 'Cumule 4 heures de jeu',        metric: 'time',     c: true,  target: 14400 },
  { id: 'w_level',   icon: '⭐', label: 'Ascension suprême',    desc: 'Atteins le niveau 40',          metric: 'level',    c: false, target: 40 },
  // --- quêtes hebdo à mécanique ---
  { id: 'w_ult',     icon: '☄', label: 'Anéantisseur',         desc: 'Déchaîne ton ultime 60 fois',   metric: 'ult',      c: true,  target: 60 },
  { id: 'w_craft',   icon: '🔨', label: 'Maître artisan',      desc: 'Forge 20 objets',               metric: 'craft',    c: true,  target: 20 },
  { id: 'w_dist',    icon: '👣', label: 'Pionnier',            desc: 'Parcours 6 000 mètres',         metric: 'dist',     c: true,  target: 6000 },
  { id: 'w_flawless',icon: '🛡', label: 'Immaculé',            desc: '2 campagnes sans aucune mort',  metric: 'flawless', c: true,  target: 2 },
  { id: 'w_combo',   icon: '⚡', label: 'Tempête parfaite',     desc: 'Vague 40 + 1 000 monstres',     metric: 'wave',     c: false, target: 40, metric2: 'kills', c2: true, target2: 1000 },
];
export const QUEST_WEEK_COUNT = 3;

// les 3 quêtes de la semaine : tirage déterministe identique pour tous les joueurs
export function weeklyQuests() {
  const seed = hashStr('W' + mondayOfWeek());
  const rng = mulberry32(seed);
  const pool = [...WQPOOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, QUEST_WEEK_COUNT);
}

// les 3 quêtes du jour : tirage déterministe identique pour tous les joueurs
export function dailyQuests() {
  const d = new Date();
  const seed = hashStr(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  const rng = mulberry32(seed);
  const pool = [...QPOOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, QUEST_DAY_COUNT);
}

function curOfDay(q) {
  const day = qday();
  return (q.c ? day.c : day.mx)[q.metric] || 0;
}
function cur2OfDay(q) {
  const day = qday();
  return (q.c2 ? day.c : day.mx)[q.metric2] || 0;
}
// état d'une quête du jour : {q, cur, cur2, done, claimed}
export function questState(q) {
  const cur = curOfDay(q);
  const day = qday();
  const done1 = cur >= q.target;
  const cur2 = q.metric2 ? cur2OfDay(q) : null;
  const done = done1 && (!q.metric2 || cur2 >= q.target2);
  return { q, cur: Math.min(cur, q.target), cur2: cur2 === null ? null : Math.min(cur2, q.target2),
    done, claimed: day.claimed.includes(q.id) };
}
export function questsDoneToday() { return dailyQuests().filter(q => questState(q).done).length; }
export function questsClaimable() { return dailyQuests().some(q => { const s = questState(q); return s.done && !s.claimed; }); }
export function questsLeftToday() { return dailyQuests().filter(q => !questState(q).claimed).length; }

// ---------- état des quêtes hebdomadaires ----------
function curOfWeek(q) {
  const wk = qweek();
  return (q.c ? wk.c : wk.mx)[q.metric] || 0;
}
function cur2OfWeek(q) {
  const wk = qweek();
  return (q.c2 ? wk.c : wk.mx)[q.metric2] || 0;
}
export function weeklyQuestState(q) {
  const cur = curOfWeek(q);
  const wk = qweek();
  const done1 = cur >= q.target;
  const cur2 = q.metric2 ? cur2OfWeek(q) : null;
  const done = done1 && (!q.metric2 || cur2 >= q.target2);
  return { q, cur: Math.min(cur, q.target), cur2: cur2 === null ? null : Math.min(cur2, q.target2),
    done, claimed: wk.claimed.includes(q.id) };
}
export function weeklyClaimable() { return weeklyQuests().some(q => { const s = weeklyQuestState(q); return s.done && !s.claimed; }); }
export function weeklyDone() { return weeklyQuests().filter(q => weeklyQuestState(q).done).length; }

// module aléatoire pour le coffre : préfère les non possédés
function rollChestModule() {
  const owned = modState(G.inv).owned;
  const fresh = MOD_IDS.filter(id => !owned.includes(id));
  const pool = fresh.length ? fresh : MOD_IDS;
  return pool[(Math.random() * pool.length) | 0];
}

// réclame une quête hebdo : ouvre un coffre → module aléatoire + animation
export function claimWeekly(id) {
  const q = WQPOOL.find(x => x.id === id);
  if (!q) return { ok: false, msg: 'Quête inconnue' };
  if (!weeklyQuests().includes(q)) return { ok: false, msg: 'Pas une quête de la semaine' };
  const s = weeklyQuestState(q);
  if (!s.done) return { ok: false, msg: 'Objectif non atteint' };
  if (s.claimed) return { ok: false, msg: 'Déjà réclamée' };
  const wk = qweek();
  wk.claimed.push(q.id);
  const modId = rollChestModule();
  const mod = MODULES[modId];
  const isNew = ownModule(G.inv, modId);
  // animation du coffre (dessinée par le HUD) — le module est déjà ajouté
  G.chestFx = { icon: mod.icon, name: mod.name, col: mod.col, rar: mod.rar, until: G.time + 3.0, isNew };
  saveStats();
  sfxVictory(); sfxConfirm();
  return { ok: true, msg: `Coffre : ${mod.name} !`, mod: modId };
}

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
