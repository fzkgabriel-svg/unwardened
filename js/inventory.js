// Inventaire : matériaux, objets craftés et équipement (persisté en localStorage)
import { storeKey } from './chars.js';

export const MATS = {
  cuir:    { name: 'Cuir',      color: '#a1887f' },
  fer:     { name: 'Fer',       color: '#90a4ae' },
  or:      { name: 'Or',        color: '#ffd740' },
  essence: { name: 'Essence',   color: '#ce93d8' },
  cristal: { name: 'Cristal',   color: '#4fc3f7' },
  emeraude:{ name: 'Émeraude',  color: '#2ecc71',
    desc: 'Pierre précieuse des Terres Oubliées. Sert à améliorer les armes dans la Forge.' },
};

// tables de drop par type d'ennemi (chance par matériau à chaque kill)
export const MATERIAL_DROPS = {
  slime:    { cuir: 0.10, fer: 0.025 },
  bat:      { cuir: 0.08, fer: 0.02 },
  spider:   { cuir: 0.06, fer: 0.025, essence: 0.04 },
  witch:    { cuir: 0.045, essence: 0.06, or: 0.025 },
  brute:    { fer: 0.08, cuir: 0.08, or: 0.025 },
  golem:    { fer: 0.10, cuir: 0.06, or: 0.03 },
  miniboss: { or: 0.08, fer: 0.12, essence: 0.05, cristal: 0.03, emeraude: 0.35 },
  boss:     { or: 0.15, cristal: 0.09, essence: 0.09, fer: 0.18, emeraude: 0.50 },
  bossFoudre:{ or: 0.15, cristal: 0.09, essence: 0.09, fer: 0.18, emeraude: 0.50 },
  bossGivre:{ or: 0.15, cristal: 0.09, essence: 0.09, fer: 0.18, emeraude: 0.50 },
  finalBoss:{ or: 0.6, cristal: 0.5, essence: 0.55, fer: 0.6, cuir: 0.4, emeraude: 0.95 },
  // The Frozen Land
  yeti:     { cuir: 0.10, fer: 0.05, cristal: 0.03 },
  glacier:  { cristal: 0.14, fer: 0.10, essence: 0.06 },
  crypt:    { essence: 0.12, cristal: 0.08, or: 0.03 },
  hunter:   { cuir: 0.08, fer: 0.04, cristal: 0.04 },
  alpha:    { cristal: 0.15, essence: 0.12, or: 0.06, fer: 0.10, emeraude: 0.15 },
  bossGlace:{ cristal: 0.30, essence: 0.25, or: 0.15, fer: 0.20, emeraude: 0.50 },
  bossCryo: { cristal: 0.32, essence: 0.28, or: 0.18, fer: 0.22, emeraude: 0.55 },
  finalBossGlace:{ cristal: 0.7, essence: 0.65, or: 0.6, fer: 0.6, cuir: 0.5, emeraude: 0.95 },
  // Les Enfers
  imp:      { fer: 0.08, essence: 0.05 },
  hound:    { cuir: 0.10, fer: 0.07, essence: 0.04 },
  cultist:  { essence: 0.14, or: 0.05 },
  demon:    { essence: 0.16, or: 0.07, fer: 0.10 },
  golemEnf: { fer: 0.16, or: 0.08, essence: 0.08 },
  bossEnf:  { or: 0.20, essence: 0.18, cristal: 0.12, fer: 0.24, emeraude: 0.55 },
  priest:   { essence: 0.18, or: 0.08, cristal: 0.06 },
  finalBossEnfer:{ or: 0.75, cristal: 0.65, essence: 0.8, fer: 0.7, cuir: 0.6, emeraude: 0.95 },
  // Les Égouts
  rat:      { cuir: 0.10, essence: 0.04 },
  vase:     { essence: 0.14, cristal: 0.05, fer: 0.06 },
  crapaud:  { cuir: 0.12, fer: 0.08, essence: 0.05 },
  ver:      { essence: 0.16, cristal: 0.08, or: 0.04 },
  chanter:  { essence: 0.15, or: 0.06, cristal: 0.05 },
  matriarche:{ essence: 0.20, cristal: 0.12, or: 0.08, fer: 0.12, emeraude: 0.20 },
  bossEgout:{ or: 0.22, essence: 0.20, cristal: 0.15, fer: 0.26, emeraude: 0.55 },
  finalBossEgout:{ or: 0.8, cristal: 0.7, essence: 0.9, fer: 0.8, cuir: 0.7, emeraude: 0.95 },
  // L'Espace
  alien:    { essence: 0.16, cristal: 0.08, or: 0.05 },
  drone:    { cristal: 0.10, fer: 0.08, essence: 0.05 },
  tentacule:{ essence: 0.18, cristal: 0.10, or: 0.06 },
  cristal:  { cristal: 0.18, essence: 0.12, fer: 0.10 },
  overlord: { cristal: 0.20, essence: 0.18, or: 0.10, fer: 0.14, emeraude: 0.20 },
  bossVoid: { or: 0.25, cristal: 0.25, essence: 0.22, fer: 0.30, emeraude: 0.60 },
  finalBossSpace:{ or: 0.9, cristal: 0.9, essence: 1.0, fer: 0.9, cuir: 0.8, emeraude: 1.0 },
  // Le Royaume des Tempêtes
  courant:  { fer: 0.06, cuir: 0.05, essence: 0.03 },
  rafale:   { cristal: 0.08, essence: 0.05, fer: 0.05 },
  esprit:   { essence: 0.14, cristal: 0.10, or: 0.05 },
  gardien:  { fer: 0.12, cristal: 0.10, essence: 0.07, cuir: 0.08 },
  colosse:  { cristal: 0.18, essence: 0.14, or: 0.10, fer: 0.16, emeraude: 0.20 },
  bossOuragan:{ or: 0.28, cristal: 0.28, essence: 0.25, fer: 0.32, emeraude: 0.60 },
  finalBossTempete:{ or: 1.0, cristal: 1.0, essence: 1.1, fer: 1.0, cuir: 0.9, emeraude: 1.0 },
};

// raretés des objets forgés (couleurs dans utils.itemTier)
export const ITEM_RARITY = {
  commun:    'Commun',
  rare:      'Rare',
  epique:    'Épique',
  legendaire:'Légendaire'
};

// objets craftables — slot : weapon (artefacts) / armor / helm / gloves / charm / boots / conso
// conso = consommable utilisable depuis l'inventaire (stackable, non équipable)
export const ITEMS = {
  // ---------- ARMES (artefactsWeapons du slot weapon) ----------
  talFer:    { slot: 'weapon', name: 'Talisman de Fer',     icon: '⚔️', desc: '+20% de dégâts',                 cost: { fer: 28, cuir: 18 },              rar: 'rare' },
  talOr:     { slot: 'weapon', name: 'Talisman d\'Or',      icon: '⚔️', desc: '+40% de dégâts',                 cost: { or: 34, fer: 70, essence: 22 },    rar: 'epique' },
  talEss:    { slot: 'weapon', name: 'Talisman d\'Essence', icon: '⚔️', desc: '+60% de dégâts',                 cost: { essence: 46, cristal: 28, or: 46 }, rar: 'legendaire' },
  ultBraise: { slot: 'weapon', name: 'Réceptacle de Braise',icon: '🔥', desc: 'Ultime : +20% rayon, boss +8%',   cost: { fer: 24, cuir: 16 },               rar: 'rare' },
  ultSage:   { slot: 'weapon', name: 'Réceptacle du Sage',  icon: '🔮', desc: 'Ultime : +40% rayon, boss +20%',  cost: { or: 34, essence: 26, fer: 60 },     rar: 'epique' },
  ultChaos:  { slot: 'weapon', name: 'Cœur du Cataclysme',  icon: '☢️', desc: 'Ultime : +65% rayon, boss +30%',  cost: { essence: 46, cristal: 28, or: 46 }, rar: 'legendaire' },
  // nouveaux artefacts-armas (monde 3-5)
  lameMarais:{ slot: 'weapon', name: 'Machette des Marais',  icon: '🗡️', desc: '+28% dégâts, +0,06 vitesse',     cost: { essence: 30, cristal: 14, fer: 30 }, rar: 'rare' },
  lanceCryo: { slot: 'weapon', name: 'Guisarme du Souverain',icon: '🔱', desc: '+32% dégâts, +15% XP',            cost: { cristal: 36, essence: 26, or: 20 },  rar: 'epique' },
  mailletGolem:{ slot: 'weapon', name: 'Marteau du Fondeur', icon: '🔨', desc: '+24% dégâts, +25 PV max',        cost: { fer: 55, essence: 20, cuir: 20 },   rar: 'rare' },
  dagueBaron:{ slot: 'weapon', name: 'Dague du Baron',       icon: '🗡️', desc: '+45% dégâts, +20% soins',        cost: { essence: 44, or: 38, fer: 40 },     rar: 'epique' },
  epeeSombre:{ slot: 'weapon', name: 'Espadon du Néant',     icon: '⚔️', desc: '+50% dégâts, boss +15%',         cost: { essence: 50, cristal: 30, or: 40 }, rar: 'epique' },
  arcConfins:{ slot: 'weapon', name: 'Arc des Confins',      icon: '🏹', desc: '+80% dégâts, +30% XP — légendaire', cost: { essence: 60, cristal: 40, or: 55 }, rar: 'legendaire' },
  sceptreOublie:{ slot: 'weapon', name: 'Sceptre du Roi Oublié',icon: '🔮', desc: '+85% dégâts, ultime +35%',    cost: { essence: 65, cristal: 45, or: 60 }, rar: 'legendaire' },
  // ---------- ARMURES ----------
  armCuir:   { slot: 'armor',  name: 'Cuirasse de Cuir',    icon: '🛡️', desc: '-15% de dégâts subis',           cost: { cuir: 46, fer: 14 },                rar: 'rare' },
  armFer:    { slot: 'armor',  name: 'Armure de Fer',       icon: '🛡️', desc: '-32% de dégâts subis',           cost: { fer: 74, cuir: 38 },                rar: 'epique' },
  armOr:     { slot: 'armor',  name: 'Armure Royale',       icon: '👑', desc: '-45% de dégâts subis',           cost: { or: 70, fer: 100, essence: 40 },    rar: 'legendaire' },
  armEmeraude:{ slot: 'armor', name: 'Cuirasse d\'Émeraude',icon: '🟢', desc: '-40% dégâts, +25 PV max',         cost: { cuir: 50, essence: 34, cristal: 18 }, rar: 'epique' },
  armEgout:  { slot: 'armor',  name: 'Cuirasse du Tyran',   icon: '🐸', desc: '-42% dégâts, +15% soins',        cost: { essence: 36, cristal: 20, cuir: 40 }, rar: 'rare' },
  armEspace: { slot: 'armor',  name: 'Carapace Stellaire',  icon: '👾', desc: '-58% dégâts, +0,08 vitesse',      cost: { essence: 60, cristal: 45, or: 50 },  rar: 'legendaire' },
  // ---------- CASQUES (nouveau slot) ----------
  helmFer:   { slot: 'helm',   name: 'Heaume de Fer',       icon: '⛑️', desc: '-12% dégâts, +20 PV max',         cost: { fer: 45, cuir: 25 },                rar: 'rare' },
  helmVide:  { slot: 'helm',   name: 'Couronne du Vide',    icon: '👑', desc: '-22% dégâts, +25% XP',            cost: { essence: 55, cristal: 40, or: 48 },  rar: 'legendaire' },
  // ---------- GANTS (nouveau slot) ----------
  gantsCuir: { slot: 'gloves', name: 'Gants de Cuir',       icon: '🧤', desc: '+10% de dégâts',                  cost: { cuir: 30, fer: 20 },                rar: 'rare' },
  gantsFondeur:{ slot: 'gloves', name: 'Gants du Fondeur',  icon: '🧤', desc: '+22% dégâts, ultime +15%',         cost: { fer: 50, essence: 30, or: 20 },     rar: 'epique' },
  // ---------- ACCESSOIRES (talisman) ----------
  amuGolem:  { slot: 'charm',  name: 'Amulette du Golem',   icon: '🧿', desc: '+40 PV max',                     cost: { cuir: 24, fer: 18, essence: 14 },   rar: 'rare' },
  courBoss:  { slot: 'charm',  name: 'Sagesse antique',     icon: '📿', desc: '+40% d\'XP gagnée',              cost: { essence: 40, cristal: 22, or: 34 },  rar: 'epique' },
  patSpider: { slot: 'charm',  name: 'Patte d\'araignée',   icon: '🕷️', desc: '+0,3 de vitesse',                cost: { essence: 40, cristal: 22 },         rar: 'rare' },
  gourdeBasse:{ slot: 'charm', name: 'Gourde usée',         icon: '🏺', desc: '+20% de soin',                    cost: { fer: 16, cuir: 12 },                rar: 'commun' },
  gourde:    { slot: 'charm',  name: 'Gourde du Herboriste',icon: '🍶', desc: '+1 fiole max, +35% de soin',      cost: { essence: 34, cristal: 20, or: 28 },  rar: 'rare' },
  gourdeHaute:{ slot: 'charm', name: 'Grande Gourde Sacrée',icon: '🏆', desc: '+2 fioles max, +55% de soin',     cost: { essence: 56, cristal: 34, or: 56 },  rar: 'epique' },
  anneauZéphyr:{ slot: 'charm',name: 'Anneau du Zéphyr',    icon: '💍', desc: '+0,30 vitesse, +10% XP',          cost: { essence: 32, cristal: 18, or: 12 },  rar: 'rare' },
  coeurNébuleux:{ slot: 'charm', name: 'Cœur Nébuleux',     icon: '💜', desc: '+1 fiole max, ultime +30%',       cost: { essence: 58, cristal: 38, or: 52 },  rar: 'legendaire' },
  // ---------- BOTTEES ----------
  bottCuir:   { slot: 'boots', name: 'Semelles de Cuir',    icon: '🥾', desc: '+0,12 de vitesse',                 cost: { cuir: 22 },                         rar: 'commun' },
  bottGolem:  { slot: 'boots', name: 'Sabots du Golem',     icon: '👞', desc: '+0,22 de vitesse',                 cost: { fer: 38, cuir: 26 },                rar: 'rare' },
  bottNuage:  { slot: 'boots', name: 'Bottes du Nuage',     icon: '☁️', desc: '+0,32 de vitesse',                 cost: { essence: 26, cristal: 16 },         rar: 'epique' },
  bottLievre: { slot: 'boots', name: 'Pattes du Lièvre',    icon: '🐇', desc: '+0,42 de vitesse',                 cost: { essence: 38, cristal: 22, or: 16 },  rar: 'epique' },
  bottSage:   { slot: 'boots', name: 'Bottes du Sage Errant',icon: '🥾',desc: '+0,26 vitesse, +15% de soin',      cost: { or: 32, essence: 28, fer: 32 },     rar: 'rare' },
  bottRelique:{ slot: 'boots', name: 'Relique-Oiseau',      icon: '🪽', desc: '+0,50 de vitesse — le summum',     cost: { essence: 52, cristal: 32, or: 46 },  rar: 'legendaire' },
  bottCrapaud:{ slot: 'boots', name: 'Pattes de Crapaud',   icon: '🐸', desc: '+0,34 vitesse, +20% soins',         cost: { essence: 30, cristal: 16, cuir: 26 }, rar: 'rare' },
  bottAntigrav:{ slot: 'boots', name: 'Bottes Antigravité', icon: '👢', desc: '+0,44 vitesse, +10% XP',            cost: { essence: 44, cristal: 28, or: 30 },  rar: 'epique' },
  // ---------- CONSOMMABLES (utilisables depuis l'inventaire, stackables) ----------
  ragoût:     { slot: 'conso', name: 'Ragoût du Chasseur',  icon: '🍖', desc: 'Consommer : +35 PV',               cost: { cuir: 18, essence: 12 },            rar: 'commun', conso: true },
  breuvage:   { slot: 'conso', name: 'Breuvage du Herboriste',icon: '🧪', desc: 'Consommer : +1 fiole',            cost: { essence: 16, cristal: 10 },         rar: 'rare', conso: true },
};

// effets des objets équipés
const FX = {
  talFer:    { weaponMult: 1.20 },
  talOr:     { weaponMult: 1.40 },
  talEss:    { weaponMult: 1.60 },
  ultBraise: { ultR: 1.20, ultBoss: 0.08 },
  ultSage:   { ultR: 1.40, ultBoss: 0.20 },
  ultChaos:  { ultR: 1.65, ultBoss: 0.30 },
  lameMarais:{ weaponMult: 1.28, speed: 0.06 },
  lanceCryo: { weaponMult: 1.32, xp: 1.15 },
  mailletGolem:{ weaponMult: 1.24, hp: 25 },
  dagueBaron:{ weaponMult: 1.45, potionMult: 1.20 },
  epeeSombre:{ weaponMult: 1.50, ultBoss: 0.15 },
  arcConfins:{ weaponMult: 1.80, xp: 1.30 },
  sceptreOublie:{ weaponMult: 1.85, ultR: 1.35 },
  armCuir:   { armorReduce: 0.15 },
  armFer:    { armorReduce: 0.32 },
  armOr:     { armorReduce: 0.45 },
  armEmeraude:{ armorReduce: 0.40, hp: 25 },
  armEgout:  { armorReduce: 0.42, potionMult: 1.15 },
  armEspace: { armorReduce: 0.58, speed: 0.08 },
  helmFer:   { armorReduce: 0.12, hp: 20 },
  helmVide:  { armorReduce: 0.22, xp: 1.25 },
  gantsCuir: { weaponMult: 1.10 },
  gantsFondeur:{ weaponMult: 1.22, ultR: 1.15 },
  amuGolem:  { hp: 40 },
  courBoss:  { xp: 1.40 },
  patSpider: { speed: 0.30 },
  gourdeBasse:{ potions: 0, potionMult: 1.20 },
  gourde:    { potions: 1, potionMult: 1.35 },
  gourdeHaute:{ potions: 2, potionMult: 1.55 },
  anneauZéphyr:{ speed: 0.30, xp: 1.10 },
  coeurNébuleux:{ potions: 1, ultR: 1.30 },
  bottCuir:   { speed: 0.12 },
  bottGolem:  { speed: 0.22 },
  bottNuage:  { speed: 0.32 },
  bottLievre: { speed: 0.42 },
  bottSage:   { speed: 0.26, potionMult: 1.15 },
  bottRelique:{ speed: 0.50 },
  bottCrapaud:{ speed: 0.34, potionMult: 1.20 },
  bottAntigrav:{ speed: 0.44, xp: 1.10 },
};

// v4 : une sauvegarde par personnage (préfixe rpg2d_c{slot}_)
const KEY = () => storeKey('inv_v3');
export function loadInv() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY()));
    if (d && d.mats && d.items && d.equip) {
      d.dur = d.dur || {}; d.wmode = d.wmode || {}; d.buffs = d.buffs || {}; d.weapons = d.weapons || ['epee', 'lance'];
      // migration durabilité : l'ancienne échelle 0-100 devient 0-DUR_MAX (×2)
      for (const k in d.dur) if (d.dur[k] > 0) d.dur[k] = Math.min(DUR_MAX, Math.round(d.dur[k] * (DUR_MAX / 100)));
      // migration rareté : les durées 0-200 passent à l'échelle de chaque rareté (une seule fois)
      if (!d.durV2) {
        d.durV2 = 1;
        for (const k in d.dur) if (d.dur[k] > 0 && d.dur[k] <= DUR_MAX) d.dur[k] = Math.round(d.dur[k] * durMaxOf(k) / DUR_MAX);
      }
      return d;
    }
  } catch (e) {}
  // reset complet : on efface toutes les anciennes sauvegardes d'inventaire
  for (const k of ['rpg2d_inv', 'rpg2d_inv_v2', 'rpg2d_inv_v3', KEY()]) {
    try { localStorage.removeItem(k); } catch (e) {}
  }
  const d = { mats: {}, items: {}, equip: {}, dur: {}, wmode: {}, buffs: {}, weapons: ['epee', 'lance'] };
  try { localStorage.setItem(KEY(), JSON.stringify(d)); } catch (e) {}
  return d;
}
export function saveInv(inv) { if (_noSave) return; try { localStorage.setItem(KEY(), JSON.stringify(inv)); } catch (e) {} }
// le tutoriel joue avec un inventaire jetable : rien n'est écrit sur disque
let _noSave = false;
export function setInvNoSave(v) { _noSave = !!v; }

export function addMaterial(inv, type, n = 1) {
  inv.mats[type] = (inv.mats[type] || 0) + n;
  saveInv(inv);
}

export function canCraft(inv, id) {
  const it = ITEMS[id];
  if (it.conso) return (inv.items[id] || 0) < 99; // les consommables s'empilent
  if (inv.items[id]) return false;
  for (const k in it.cost) if ((inv.mats[k] || 0) < it.cost[k]) return false;
  return true;
}

export function craft(inv, id) {
  if (!canCraft(inv, id)) return false;
  const it = ITEMS[id];
  for (const k in it.cost) inv.mats[k] -= it.cost[k];
  inv.items[id] = it.conso ? (inv.items[id] || 0) + 1 : true; // conso = compteur
  inv.dur = inv.dur || {};
  inv.dur[id] = durMaxOf(id); // tout objet forgé commence à durabilité maximale (selon rareté)
  saveInv(inv);
  return true;
}

export function toggleEquip(inv, id) {
  const it = ITEMS[id];
  if (it && it.conso) return false; // un consommable ne s'équipe pas
  // un objet cassé ne peut pas être ÉQUIPÉ, mais peut être retiré s'il l'est déjà
  if (getDur(inv, id) <= 0 && inv.equip[it.slot] !== id) return false;
  const slot = it.slot;
  inv.equip[slot] = inv.equip[slot] === id ? null : id;
  saveInv(inv);
  return true;
}

// consommer un objet 'conso' : effet permanent léger (inv.buffs)
export function useConsumable(inv, id) {
  const it = ITEMS[id];
  if (!it || !it.conso) return false;
  const n = inv.items[id] || 0;
  if (n <= 0) return false;
  if (--inv.items[id] <= 0) delete inv.items[id];
  inv.buffs = inv.buffs || {};
  if (id === 'ragoût') inv.buffs.hp = (inv.buffs.hp || 0) + 35;
  if (id === 'breuvage') inv.buffs.potions = (inv.buffs.potions || 0) + 1;
  saveInv(inv);
  return true;
}

// ---------- DURABILITÉ ----------
// inv.dur[id] = 0-durMaxOf(id), persisté avec l'inventaire ; absent = max
export const DUR_MAX = 200; // base commune — la rareté multiplie la durabilité
const RAR_DUR = { commun: 1, rare: 1.8, epique: 2.8, legendaire: 4 };
// durabilité max selon la rareté : commun 200 · rare 360 · épique 560 · légendaire 800
export function durMaxOf(id) {
  const r = ITEMS[id] && ITEMS[id].rar;
  return Math.round(DUR_MAX * (RAR_DUR[r] || 1));
}
export function getDur(inv, id) {
  return inv.dur && inv.dur[id] !== undefined ? inv.dur[id] : durMaxOf(id);
}
function setDur(inv, id, v) {
  inv.dur = inv.dur || {};
  inv.dur[id] = Math.max(0, Math.min(durMaxOf(id), v));
}
// couleur d'état d'une durabilité (partagée menus + HUD)
export function durState(d, max = DUR_MAX) { return d <= 0 ? 'broken' : d < max * 0.3 ? 'crit' : d < max * 0.6 ? 'warn' : 'ok'; }

// usure à chaque coup SUBI : l'armure trinque le plus, le casque et les gants moins.
// L'arme ne use plus ici : elle s'use à l'attaque (wearWeaponUse).
// Un objet à 0 % RESTE équipé mais ne donne plus aucun bonus (equipBonuses
// ignore dur <= 0) — il n'est ni perdu ni déséquippé : il faut le réparer.
const SLOT_WEAR = { armor: 3.0, helm: 2.2, gloves: 1.2, charm: 1.0, boots: 0.8 };
// les équipements s'usent 40 % moins vite (usure des slots et des armes)
const WEAR_MUL = 0.6;
export function wearEquipment(inv) {
  if (!inv || !inv.equip) return { broken: null, wear: {} };
  let broken = null;
  const wear = {};
  for (const slot in inv.equip) {
    const id = inv.equip[slot];
    if (!id || slot === 'weapon') continue; // l'arme use à l'attaque, pas en encaissant
    const d0 = getDur(inv, id);
    const d = d0 - SLOT_WEAR[slot] * WEAR_MUL * (0.75 + Math.random() * 0.5);
    const lost = d0 - Math.max(0, d);
    if (lost > 0) wear[id] = (wear[id] || 0) + lost;
    if (d <= 0) {
      if (d0 > 0) broken = broken || (ITEMS[id] ? ITEMS[id].name : id); // alerte seulement à la cassure
      setDur(inv, id, 0);
    } else setDur(inv, id, d);
  }
  saveInv(inv);
  return { broken, wear };
}

// usure de l'arme à chaque attaque : ~0,22 pt par coup de mêlée, 0,14 par trait d'arc.
// Retourne le nom de l'arme si elle vient de casser (transition >0 -> 0).
export function wearWeaponUse(inv, pts) {
  const id = inv && inv.equip ? inv.equip.weapon : null;
  if (!id) return null;
  const d0 = getDur(inv, id);
  const d = d0 - pts * WEAR_MUL * (0.8 + Math.random() * 0.4);
  if (d <= 0) {
    setDur(inv, id, 0);
    saveInv(inv);
    return d0 > 0 ? (ITEMS[id] ? ITEMS[id].name : id) : null;
  }
  setDur(inv, id, d);
  saveInv(inv);
  return null;
}

// ---------- RÉPARATION ----------
// coût quadratique en l'usure : frac = missing/dmax
//   presque neuf (5 %)  → ~0,2 % du coût de forge  (réparation quasi gratuite)
//   mi-usure   (50 %)  → ~22 % du coût de forge
//   cassé      (100 %) → ~90 % du coût de forge  (presque reforger)
// Plus l'équipement est endommagé, plus la réparation coûte cher.
export function repairCost(inv, id) {
  const dmax = durMaxOf(id);
  const missing = dmax - getDur(inv, id);
  if (missing <= 0) return null;
  const frac = missing / dmax;
  const cost = {};
  for (const m in ITEMS[id].cost) {
    cost[m] = Math.max(1, Math.ceil(ITEMS[id].cost[m] * frac * frac * 0.9));
  }
  return cost;
}
export function canRepair(inv, id) {
  const c = repairCost(inv, id);
  if (!c) return false;
  for (const m in c) if ((inv.mats[m] || 0) < c[m]) return false;
  return true;
}
export function repairItem(inv, id) {
  if (!canRepair(inv, id)) return false;
  const c = repairCost(inv, id);
  for (const m in c) inv.mats[m] -= c[m];
  setDur(inv, id, durMaxOf(id));
  saveInv(inv);
  return true;
}
// tous les équipements possédés endommagés (dur < max), cassés d'abord puis par usure
export function damagedItems(inv) {
  return Object.keys(inv.items || {})
    .filter(id => ITEMS[id] && !ITEMS[id].conso && getDur(inv, id) < durMaxOf(id))
    .sort((a, b) => getDur(inv, a) - getDur(inv, b));
}
// coût total pour tout réparer (null si rien à réparer)
export function repairAllCost(inv) {
  const ids = damagedItems(inv);
  if (!ids.length) return null;
  const cost = {};
  for (const id of ids) {
    const c = repairCost(inv, id);
    if (!c) continue;
    for (const m in c) cost[m] = (cost[m] || 0) + c[m];
  }
  return Object.keys(cost).length ? cost : null;
}
// répare tout ce qui est abordable ; retourne { repaired, skipped, cost }
export function repairAll(inv) {
  let repaired = 0;
  const cost = {};
  for (const id of damagedItems(inv)) {
    if (!canRepair(inv, id)) continue;
    const c = repairCost(inv, id);
    for (const m in c) { inv.mats[m] -= c[m]; cost[m] = (cost[m] || 0) + c[m]; }
    setDur(inv, id, durMaxOf(id));
    repaired++;
  }
  const skipped = damagedItems(inv).length;
  saveInv(inv);
  return { repaired, skipped, cost };
}

// ---------- PROGRESSION ÉPÉE / LANCE ----------
// inv.wmode['epee'|'lance'] = { xp } : XP gagnée avec chaque type d'arme
// (attaque de base + rotation pour l'épée, attaque + bouclier pour la lance).
// L'XP requise par niveau augmente fortement : 400 + 350 × niveau^1,5.
// Niveau 1→2 = 750 XP, 10→11 ≈ 11 500, 50→51 ≈ 124 000, 99→100 ≈ 345 000.
// Max 100 niveaux. Les dégâts suivent une courbe EXPONENTIELLE :
// multiplicateur de 1,0 au niv. 1 jusqu'à 3,0 (+200 % des dégâts de base) au niv. 100.
export const MODE_MAX_LVL = 100;
export const MODE_DMG_MAX = 3.0;   // multiplicateur max de dégâts au niveau 100 (+200 %)
const MODE_DMG_EXPO = 2.6;         // exponentielle : la progression s'accélère avec le niveau
export function modeNeed(lvl) { return Math.round(400 + 350 * Math.pow(lvl, 1.5)); }
export function modeKey(attackMode) { return attackMode === 3 ? 'lance' : attackMode === 5 ? 'arc' : attackMode === 7 ? 'gardien' : 'epee'; }
export function modeInfo(inv, key) {
  inv.wmode = inv.wmode || {};
  const total = (inv.wmode[key] && inv.wmode[key].xp) || 0;
  let lvl = 1, rem = total;
  while (lvl < MODE_MAX_LVL) {
    const need = modeNeed(lvl);
    if (rem < need) break;
    rem -= need; lvl++;
  }
  const need = lvl < MODE_MAX_LVL ? modeNeed(lvl) : 0;
  return { xp: rem, lvl, need, pct: need ? rem / need : 1 };
}
export function addWmodeXp(inv, key, xp) {
  if (!key || !xp) return;
  inv.wmode = inv.wmode || {};
  const w = inv.wmode[key] = inv.wmode[key] || { xp: 0 };
  w.xp = (w.xp || 0) + xp;
  saveInv(inv);
}
export function modeMult(inv, key) {
  // exponentielle sur la progression de niveau : 1,0 -> MODE_DMG_MAX (3,0) au niv. 100
  const t = (modeInfo(inv, key).lvl - 1) / (MODE_MAX_LVL - 1);
  return 1 + (MODE_DMG_MAX - 1) * (Math.exp(MODE_DMG_EXPO * t) - 1) / (Math.exp(MODE_DMG_EXPO) - 1);
}

// ---------- chargement d'armes : 2 emplacements (s1 = arme principale, s2 = secondaire) ----------
export const WEAPON_MODES = { epee: 1, lance: 3, arc: 5, gardien: 7 };
// loadout paresseux : migre l'ancien format tableau inv.weapons -> { s1, s2 }
// (les anciennes sauvegardes n'ont que inv.weapons = ['epee','lance'])
export function loadoutOf(inv) {
  if (inv && !inv.loadout) {
    const w = (inv.weapons && inv.weapons.length ? inv.weapons : ['epee', 'lance']).slice(0, 2);
    inv.loadout = { s1: w[0] || null, s2: w[1] || null };
  }
  return inv && inv.loadout ? inv.loadout : { s1: null, s2: null };
}
// clés d'armes équipées, dans l'ordre des emplacements
export function loadoutKeys(inv) {
  const l = loadoutOf(inv);
  return [l.s1, l.s2].filter(Boolean);
}
export function weaponAllowed(inv, key) {
  const keys = loadoutKeys(inv);
  if (!keys.length) return key === 'epee' || key === 'lance'; // jamais zéro arme : repli sur les de base
  return keys.includes(key);
}
// place `key` dans l'emplacement `slot` ('s1'|'s2') ; null = déséquiper.
// - une arme déjà dans l'autre emplacement est échangée (swap)
// - cliquer la zone d'une arme déjà en place la retire (si l'autre slot est occupé)
// - une arme déséquipée reste possédée : elle réapparaît dans la liste
// - au moins une arme doit rester équipée
export function setLoadoutSlot(inv, slot, key) {
  const l = loadoutOf(inv);
  const other = slot === 's1' ? 's2' : 's1';
  if (key != null && l[other] === key) {
    const tmp = l[slot]; l[slot] = key; l[other] = tmp; // échange les deux emplacements
  } else if (key != null) {
    if (l[slot] === key) { // déjà en place : second clic = retirer
      if (!l[other]) return false;
      l[slot] = null;
    } else {
      l[slot] = key; // remplace l'arme de l'emplacement (elle reste possédée)
    }
  } else { // déséquiper explicite
    if (!l[other]) return false;
    l[slot] = null;
  }
  if (!l.s1 && !l.s2) { l.s1 = 'epee'; return false; } // garde-fou : jamais zéro arme
  inv.weapons = [l.s1, l.s2].filter(Boolean); // synchro rétro-compatible
  saveInv(inv);
  return true;
}
// compat : ancien toggle binaire (utilisé par les anciens tests/exports)
export function toggleLoadoutWeapon(inv, key) {
  const l = loadoutOf(inv);
  if (l.s1 === key) return setLoadoutSlot(inv, 's1', null) && inv.weapons.slice();
  if (l.s2 === key) return setLoadoutSlot(inv, 's2', null) && inv.weapons.slice();
  if (!l.s1) { setLoadoutSlot(inv, 's1', key); return inv.weapons.slice(); }
  if (!l.s2) { setLoadoutSlot(inv, 's2', key); return inv.weapons.slice(); }
  return inv.weapons.slice(); // les deux emplacements sont pleins : pas d'action
}

// bonus dérivés de l'équipement actuel (level = niveau du personnage pour l'enchantement)
// bonus bruts d'un objet (pour affichage détaillé)
export function itemBonuses(id) { return FX[id] || {}; }

export function equipBonuses(inv, level) {
  const b = { weaponMult: 1, armorReduce: 0, hp: 0, speed: 0, xp: 1, potions: 0, potionMult: 1, ultR: 1, ultBoss: 0 };
  for (const slot in inv.equip) {
    const id = inv.equip[slot];
    if (!id || getDur(inv, id) <= 0) continue; // cassé = aucun bonus
    const fx = FX[id];
    if (!fx) continue;
    if (fx.weaponMult) b.weaponMult *= fx.weaponMult;
    if (fx.armorReduce) b.armorReduce += fx.armorReduce;
    if (fx.hp) b.hp += fx.hp;
    if (fx.speed) b.speed += fx.speed;
    if (fx.xp) b.xp *= fx.xp;
    if (fx.potions) b.potions += fx.potions;
    if (fx.potionMult) b.potionMult *= fx.potionMult;
    if (fx.ultR) b.ultR *= fx.ultR;
    if (fx.ultBoss) b.ultBoss += fx.ultBoss;
  }
  return b;
}
