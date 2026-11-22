// Personnages : 3 emplacements avec sauvegardes totalement indépendantes.
// Chaque personnage possède son propre espace de clés localStorage
// (inventaire, succès, stats, mondes) + ses métadonnées (nom, temps de jeu,
// dernière connexion) stockées dans 'rpg2d_chars_v1'.
import { saveStats } from './state.js';

const SLOTS_KEY = 'rpg2d_chars_v1';
export const MAX_SLOTS = 3;

// mot de passe du panneau admin local — À PERSONNALISER
export const ADMIN_PASS = 'Gabriel1801';

let slots = [null, null, null]; // { name, created, lastPlayed, playtime }
// var (et non let) : storeKey() peut être appelé pendant l'évaluation des
// modules (cycle state.js <-> chars.js) avant cette ligne — undefined >= 0
// vaut false, donc la clé retombe sur le compartiment '_off' sans crash.
var active = -1;                // index du personnage chargé (-1 = écran sélection)
export let adminOK = false;     // session admin débloquée

function loadSlots() {
  try {
    const d = JSON.parse(localStorage.getItem(SLOTS_KEY));
    if (Array.isArray(d)) {
      for (let i = 0; i < MAX_SLOTS; i++) {
        const s = d[i];
        if (s && s.name) slots[i] = {
          name: String(s.name).slice(0, 14),
          created: s.created || Date.now(),
          lastPlayed: s.lastPlayed || 0,
          playtime: s.playtime || 0
        };
      }
    }
  } catch (e) {}
}
function saveSlots() {
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch (e) {}
}
loadSlots();

// clé de stockage préfixée par le personnage actif.
// Sans personnage sélectionné, les écritures vont dans un compartiment
// '_off' jamais lu : aucune donnée de jeu ne peut fuiter entre profils.
export function storeKey(base) {
  return `rpg2d_c${active >= 0 ? active : 'off'}_${base}`;
}
export function activeSlot() { return active; }
export function slotMeta(i) { return slots[i] || null; }
export function allSlots() { return slots; }

// ---------- TEMPS DE JEU ----------
let playAcc = 0, metaAcc = 0;
export function tickPlaytime(dt) {
  if (active < 0 || !slots[active]) return;
  slots[active].playtime += dt;
  playAcc += dt; metaAcc += dt;
  if (metaAcc >= 30) { metaAcc = 0; saveSlots(); } // autosave toutes les 30s
}
export function flushMeta() { saveSlots(); }
window.addEventListener('pagehide', () => { saveSlots(); saveStats(); });

// ---------- FORMATAGE ----------
export function fmtPlaytime(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}`;
  return `${m} min`;
}
export function fmtDate(ts) {
  if (!ts) return 'jamais';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ---------- RÉSUMÉ POUR LES CARTES ----------
// lit les stats du personnage SANS le charger (clé dédiée)
export function slotSummary(i) {
  const meta = slots[i];
  if (!meta) return null;
  let stats = {};
  try { stats = JSON.parse(localStorage.getItem(`rpg2d_c${i}_stats`)) || {}; } catch (e) {}
  return {
    name: meta.name, playtime: meta.playtime, lastPlayed: meta.lastPlayed,
    bestWave: stats.bestWave || 0, totalKills: stats.totalKills || 0,
    bestLevel: stats.bestLevel || 0, totalRuns: stats.runs || 0
  };
}

// ---------- CRÉATION / SÉLECTION / RESET ----------
export function createChar(i, name) {
  if (slots[i] || i < 0 || i >= MAX_SLOTS) return false;
  slots[i] = { name: name.slice(0, 14) || `Héros ${i + 1}`, created: Date.now(), lastPlayed: 0, playtime: 0 };
  saveSlots();
  return selectChar(i);
}
export function selectChar(i) {
  if (!slots[i] || i < 0 || i >= MAX_SLOTS) return false;
  active = i;
  slots[i].lastPlayed = Date.now();
  saveSlots();
  return true;
}
export function deselectChar() {
  if (active >= 0) { flushMeta(); saveStats(); }
  active = -1;
}
export function resetChar(i) {
  if (i < 0 || i >= MAX_SLOTS) return false;
  // efface TOUTES les données du personnage i (préfixe rpg2d_c{i}_)
  const p = `rpg2d_c${i}_`;
  const doomed = [];
  for (let k = 0; k < localStorage.length; k++) {
    const key = localStorage.key(k);
    if (key && key.startsWith(p)) doomed.push(key);
  }
  doomed.forEach(k => localStorage.removeItem(k));
  slots[i] = null;
  saveSlots();
  return true;
}

// ---------- ADMIN ----------
export function checkAdminPass(pw) {
  if (pw === ADMIN_PASS) { adminOK = true; return true; }
  return false;
}
export function adminLock() { adminOK = false; } // re-verrouille : le code sera redemandé
export function adminList() {
  return slots.map((s, i) => ({ slot: i, meta: s, summary: slotSummary(i) }));
}
export function adminWipeAll() {
  for (let i = 0; i < MAX_SLOTS; i++) resetChar(i);
}
