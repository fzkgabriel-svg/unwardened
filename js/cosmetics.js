// js/cosmetics.js — catalogue des cosmétiques de la carte de joueur
// 5 catégories · 40 paliers de récompense (un cosmétique débloqué tous les 25 niveaux)
// Chaque cosmétique : { id, nom, icon, col (couleur rareté), lv (niveau requis), desc }
import { G } from './state.js';

export const RAR_COL = {
  'Commun': '#b0bec5', 'Rare': '#64b5f6', 'Épique': '#ba68c8',
  'Légendaire': '#ffd54f', 'Mythique': '#ff7043'
};

// ---------- portraits (avatar de la carte) ----------
export const PORTRAITS = [
  { id: 'p_guerrier',  nom: 'Guerrier',        icon: '🗡', col: '#8d6e63', lv: 25,   rar: 'Commun',    desc: 'L\'épée à la main, prêt pour la bataille.' },
  { id: 'p_mage',      nom: 'Mage',            icon: '🔮', col: '#64b5f6', lv: 50,   rar: 'Commun',    desc: 'Les arcanes brillent dans ses yeux.' },
  { id: 'p_archer',    nom: 'Archer',          icon: '🏹', col: '#81c784', lv: 75,   rar: 'Rare',      desc: 'Jamais il ne manque sa cible.' },
  { id: 'p_lutin',     nom: 'Lutin des bois',  icon: '🌿', col: '#aed581', lv: 100,  rar: 'Rare',      desc: 'Il connaît chaque sentier des forêts.' },
  { id: 'p_necrom',    nom: 'Nécromancien',    icon: '💀', col: '#9575cd', lv: 125,  rar: 'Épique',    desc: 'La mort est son alliée.' },
  { id: 'p_chevalier', nom: 'Chevalier doré',  icon: '🛡', col: '#ffd54f', lv: 150,  rar: 'Épique',    desc: 'Son armure chante au soleil.' },
  { id: 'p_demon',     nom: 'Démon déchu',     icon: '😈', col: '#e57373', lv: 175,  rar: 'Épique',    desc: 'Même les enfers le craignent.' },
  { id: 'p_dragon',    nom: 'Draconic',        icon: '🐉', col: '#ff8a65', lv: 200,  rar: 'Légendaire',desc: 'Le sang des anciens dragons coule en lui.' },
  { id: 'p_ange',      nom: 'Être céleste',    icon: '😇', col: '#fff176', lv: 250,  rar: 'Légendaire',desc: 'Une lueur divine l\'entoure.' },
  { id: 'p_titan',     nom: 'Titan originel',  icon: '⚡', col: '#40c4ff', lv: 500,  rar: 'Mythique',  desc: 'Forgé dans les premiers feux du monde.' },
  { id: 'p_chaman',    nom: 'Chaman des vents',icon: '🪶', col: '#81c784', lv: 525,  rar: 'Légendaire',desc: 'Les esprits murmurent à son oreille.' },
  { id: 'p_omen',      nom: 'Œil du Néant',    icon: '👁‍🗨', col: '#7c4dff', lv: 325,  rar: 'Épique',    desc: 'Il voit ce que le Néant cache.' },
  { id: 'p_cyclope',   nom: 'Cyclope',         icon: '👹', col: '#ff5252', lv: 575,  rar: 'Légendaire',desc: 'Un seul œil, une destinée unique.' },
  { id: 'p_voidtouched',nom:'Marqué du Vide',  icon: '🕸', col: '#b388ff', lv: 725,  rar: 'Légendaire',desc: 'Le Néant l\'a marqué de son sceau.' },
  { id: 'p_genesis',   nom: 'Graine originelle',icon:'🧬', col: '#69f0ae', lv: 875,  rar: 'Mythique',  desc: 'La première étincelle de la vie.' },
];

// ---------- cadres ----------
export const FRAMES = [
  { id: 'f_bois',      nom: 'Bois brut',       icon: '🪵', col: '#8d6e63', lv: 25,   rar: 'Commun',    desc: 'Simple et solide.' },
  { id: 'f_fer',       nom: 'Fer forgé',       icon: '⚙', col: '#90a4ae', lv: 50,   rar: 'Commun',    desc: 'Le métal des aventuriers.' },
  { id: 'f_argent',    nom: 'Argent massif',   icon: '⬡', col: '#e0e0e0', lv: 100,  rar: 'Rare',      desc: 'Élégant et résistant.' },
  { id: 'f_dor',       nom: 'Dor royal',       icon: '👑', col: '#ffd54f', lv: 175,  rar: 'Épique',    desc: 'La fierté des nobles.' },
  { id: 'f_glace',     nom: 'Glace éternelle', icon: '❄', col: '#80d8ff', lv: 225,  rar: 'Épique',    desc: 'Froid comme le Souverain de Glace.' },
  { id: 'f_enfer',     nom: 'Braise infernale',icon: '🔥', col: '#ff7043', lv: 275,  rar: 'Épique',    desc: 'Chaud comme le Baron de l\'Enfer.' },
  { id: 'f_void',      nom: 'Rune du Néant',   icon: '🕳', col: '#b388ff', lv: 400,  rar: 'Légendaire',desc: 'Elle murmure des secrets oubliés.' },
  { id: 'f_eternel',   nom: 'Cadre éternel',   icon: '✨', col: '#fff59d', lv: 750,  rar: 'Mythique',  desc: 'Il ne s\'éteint jamais.' },
  { id: 'f_tempete',   nom: 'Cadre des Tempêtes',icon:'🌪', col: '#4fc3f7', lv: 375,  rar: 'Épique',    desc: 'Il rugit comme le ciel.' },
  { id: 'f_star',      nom: 'Cadre stellaire', icon: '⭐', col: '#ffd54f', lv: 625,  rar: 'Légendaire',desc: 'Tressé d\'étoiles filantes.' },
  { id: 'f_obscur',    nom: 'Cadre obscur',    icon: '🌑', col: '#78909c', lv: 825,  rar: 'Légendaire',desc: 'Il absorbe la lumière.' },
  { id: 'f_genese',    nom: 'Cadre de la Genèse',icon:'🌟',col: '#fff59d', lv: 950,  rar: 'Mythique',  desc: 'Façonné par la première main.' },
];

// ---------- arrière-plans ----------
export const BACKGROUNDS = [
  { id: 'b_terre',     nom: 'Terres Oubliées', icon: '🌿', col: '#69f0ae', lv: 50,   rar: 'Commun',    desc: 'Les plaines verdoyantes du début.' },
  { id: 'b_glace',     nom: 'Terre Gelée',     icon: '🏔', col: '#80d8ff', lv: 125,  rar: 'Rare',      desc: 'Glaciers et montagnes enneigées.' },
  { id: 'b_enfer',     nom: 'Les Enfers',      icon: '🌋', col: '#ff7043', lv: 200,  rar: 'Épique',    desc: 'Braise et damnation.' },
  { id: 'b_egout',     nom: 'Égouts',          icon: '🦠', col: '#aeea00', lv: 300,  rar: 'Épique',    desc: 'Tunnels putrides et acide.' },
  { id: 'b_espace',    nom: 'L\'Espace',       icon: '🚀', col: '#82b1ff', lv: 400,  rar: 'Légendaire',desc: 'Un avant-poste perdu parmi les étoiles.' },
  { id: 'b_tempete',   nom: 'Royaume des Tempêtes', icon: '🌪', col: '#4fc3f7', lv: 500, rar: 'Légendaire',desc: 'Falaises au-dessus des nuages.' },
  { id: 'b_nuit',      nom: 'Nuit étoilée',    icon: '🌌', col: '#7c4dff', lv: 600,  rar: 'Légendaire',desc: 'Le ciel le plus profond.' },
  { id: 'b_aurore',    nom: 'Aurore cosmique', icon: '🌈', col: '#69f0ae', lv: 900,  rar: 'Mythique',  desc: 'Une lueur née du néant.' },
  { id: 'b_cathedrale',nom: 'Cathédrale céleste',icon:'⛪',col: '#ffd54f', lv: 475,  rar: 'Épique',    desc: 'Les vitraux chantent encore.' },
  { id: 'b_comete',    nom: 'Pluie de comètes',icon: '☄️', col: '#ffab91', lv: 675,  rar: 'Légendaire',desc: 'Le ciel pleut d\'étoiles.' },
  { id: 'b_abysses',   nom: 'Abysses',         icon: '🕳', col: '#00e5ff', lv: 850,  rar: 'Légendaire',desc: 'Plus profond que le Néant.' },
  { id: 'b_labyrinthe',nom: 'Labyrinthe infini',icon:'🌀',col: '#9575cd', lv: 775,  rar: 'Légendaire',desc: 'On n\'en sort jamais.' },
];

// ---------- titres ----------
export const TITLES = [
  { id: 't_aventurier',   nom: 'Aventurier',          icon: '🗡', col: '#b0bec5', lv: 25,  rar: 'Commun',    desc: 'Celui qui a tout quitté pour explorer.' },
  { id: 't_chasseur',     nom: 'Chasseur de monstres',icon: '🎯', col: '#81c784', lv: 75,  rar: 'Commun',    desc: 'La bête est traquée, jamais surprise.' },
  { id: 't_tueur',        nom: 'Tueur de boss',       icon: '👑', col: '#ffd54f', lv: 125, rar: 'Rare',      desc: 'Les rois des mondes tombent sous sa lame.' },
  { id: 't_explorateur',  nom: 'Explorateur',         icon: '🧭', col: '#4fc3f7', lv: 175, rar: 'Rare',      desc: 'Chaque carte a une case blanche.' },
  { id: 't_sage',         nom: 'Sage des runes',      icon: '📜', col: '#ba68c8', lv: 250, rar: 'Épique',    desc: 'Il lit les secrets du monde.' },
  { id: 't_voyant',       nom: 'Voyant des ombres',   icon: '👁', col: '#9575cd', lv: 350, rar: 'Épique',    desc: 'Il voit ce que les autres ignorent.' },
  { id: 't_maitre',       nom: 'Maître des mondes',   icon: '🌍', col: '#ffd54f', lv: 450, rar: 'Légendaire',desc: 'Six mondes se souviennent de lui.' },
  { id: 't_immortel',     nom: 'Immortel',            icon: '♾', col: '#e0e0e0', lv: 650, rar: 'Légendaire',desc: 'Les âges ne peuvent l\'atteindre.' },
  { id: 't_divin',        nom: 'Élu des dieux',       icon: '✨', col: '#fff176', lv: 800, rar: 'Mythique',  desc: 'Les dieux eux-mêmes le reconnaissent.' },
  { id: 't_transcendant', nom: 'Transcendant',        icon: '🌟', col: '#ffea00', lv: 1000,rar: 'Mythique',  desc: 'Il a dépassé les limites du monde. Le niveau ultime.' },
  { id: 't_desastre',     nom: 'Héraut du Désastre',  icon: '☄', col: '#ff7043', lv: 550,  rar: 'Légendaire',desc: 'La fin du monde le connaît par son nom.' },
  { id: 't_originel',     nom: 'Origine du monde',    icon: '🌍', col: '#ffea00', lv: 875,  rar: 'Mythique',  desc: 'Il était là quand tout commença.' },
  { id: 't_erudit',       nom: 'Érudit des runes',    icon: '📚', col: '#80cbc4', lv: 425,  rar: 'Épique',    desc: 'Chaque livre est un fragment du monde.' },
  { id: 't_tempet',       nom: 'Seigneur des Tempêtes',icon:'🌩', col: '#4fc3f7', lv: 475,  rar: 'Épique',    desc: 'Le ciel obéit à sa voix.' },
];

// ---------- ornements (déco de la carte) ----------
export const ORNAMENTS = [
  { id: 'o_rien',      nom: 'Aucun',            icon: '·',  col: '#555',    lv: 0,   rar: 'Commun',    desc: 'L\'élégance du minimalisme.' },
  { id: 'o_laniere',   nom: 'Lanière',          icon: '🎀', col: '#8d6e63', lv: 50,  rar: 'Commun',    desc: 'Un ruban discret mais fier.' },
  { id: 'o_etoile',    nom: 'Étoile filante',   icon: '⭐', col: '#ffd54f', lv: 150, rar: 'Rare',      desc: 'Elle porte les vœux des voyageurs.' },
  { id: 'o_rune',      nom: 'Pierre runique',   icon: '🔮', col: '#9575cd', lv: 300, rar: 'Épique',    desc: 'Elle pulse de pouvoir ancien.' },
  { id: 'o_aile',      nom: 'Ailes d\'ambre',   icon: '🪽', col: '#ffb74d', lv: 450, rar: 'Légendaire',desc: 'Les ailes du phénix.' },
  { id: 'o_couronne',  nom: 'Mini couronne',    icon: '👑', col: '#ffd54f', lv: 600, rar: 'Légendaire',desc: 'Pour les dignitaires du Néant.' },
  { id: 'o_anneau',    nom: 'Anneau cosmique',  icon: '💫', col: '#82b1ff', lv: 800, rar: 'Mythique',  desc: 'Un fragment d\'étoile morte.' },
  { id: 'o_halo',      nom: 'Halo divin',       icon: '😇', col: '#fff176', lv: 975, rar: 'Mythique',  desc: 'La marque des Transcendants.' },
  { id: 'o_lune',      nom: 'Lune croissante',  icon: '🌙', col: '#b0bec5', lv: 425, rar: 'Rare',      desc: 'Elle guide les pas des sages.' },
  { id: 'o_comete',    nom: 'Comète prisonnière',icon:'☄',  col: '#ffab91', lv: 700, rar: 'Légendaire',desc: 'Elle a choisi de rester.' },
  { id: 'o_nova',      nom: 'Nova immortelle',  icon: '💥', col: '#ff5252', lv: 925, rar: 'Mythique',  desc: 'Une étoile qui refuse de mourir.' },
];

export const COSMETIC_CATS = [
  { id: 'portrait',   nom: 'PORTRAITS',     icon: '🖼', list: PORTRAITS },
  { id: 'frame',      nom: 'CADRES',        icon: '🖼', list: FRAMES },
  { id: 'background', nom: 'ARRIÈRES-PLANS',icon: '🌄', list: BACKGROUNDS },
  { id: 'title',      nom: 'TITRES',        icon: '🏷', list: TITLES },
  { id: 'ornament',   nom: 'ORNEMENTS',     icon: '✨', list: ORNAMENTS },
];
export const ALL_COSMETICS = [...PORTRAITS, ...FRAMES, ...BACKGROUNDS, ...TITLES, ...ORNAMENTS];
export const cosmeticById = id => ALL_COSMETICS.find(c => c.id === id) || null;

// ---------- état du joueur ----------
export const MAX_LEVEL = 1000;
export const REWARD_EVERY = 25; // un cosmétique débloqué tous les 25 niveaux → 40 paliers

// niveau global : stats.glevel (1-1000) · stats.gxp = XP vers le niveau suivant
// stats.card = { portrait, frame, background, title, ornament } (ids équipés)
// stats.cardOwned = [ids des cosmétiques débloqués]
export function card() {
  G.stats = G.stats || {};
  G.stats.card = G.stats.card || {};
  G.stats.cardOwned = G.stats.cardOwned || [];
  return { owned: G.stats.cardOwned, eq: G.stats.card };
}
export function gLevel() { return Math.min(MAX_LEVEL, Math.max(1, G.stats.glevel || 1)); }
export function gXp() { return G.stats.gxp || 0; }
// courbe : chaque niveau demande un peu plus — ~×1,22 de croissance
export function xpForLevel(l) { return Math.floor(50 * Math.pow(l, 1.22)); }
export function gXpNeed() { const l = gLevel(); return l >= MAX_LEVEL ? 0 : xpForLevel(l); }
export function cosmeticUnlocked(id) {
  const c = cosmeticById(id);
  return !!c && (c.lv === 0 || gLevel() >= c.lv || card().owned.includes(id));
}
export function isOwned(id) { return card().owned.includes(id); }
export function equipCosmetic(cat, id) {
  const list = COSMETIC_CATS.find(c => c.id === cat);
  if (!list) return false;
  const item = list.list.find(c => c.id === id);
  if (!item || !cosmeticUnlocked(item.id)) return false;
  card().eq[cat === 'background' ? 'background' : cat === 'portrait' ? 'portrait' : cat === 'frame' ? 'frame' : cat === 'title' ? 'title' : 'ornament'] = id;
  return true;
}
export function resetCard() {
  G.stats.card = { portrait: null, frame: null, background: null, title: null, ornament: null };
}
// récompenses déjà obtenues : cosmétiques possédés
export function rewardsGot() { return card().owned.length; }
// prochain palier de récompense = prochain multiple de 25 au-dessus du niveau
export function nextReward() {
  const next = Math.ceil((gLevel() + 1) / REWARD_EVERY) * REWARD_EVERY;
  return Math.min(next, MAX_LEVEL);
}
// cosmétiques déblocables au niveau lvl donné (paliers ×25)
export function rewardsAtLevel(lvl) {
  return ALL_COSMETICS.filter(c => c.lv === lvl);
}
