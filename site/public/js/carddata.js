// carddata.js — métadonnées des cosmétiques de la carte de joueur (miroir de js/cosmetics.js du jeu)
// Sert à rendre la carte sur /joueur/<pseudo> sans dupliquer les visuels canvas.
export const RAR_COL = { 'Commun': '#b0bec5', 'Rare': '#64b5f6', 'Épique': '#ba68c8', 'Légendaire': '#ffd54f', 'Mythique': '#ff7043' };

const P = (id, nom, icon, col, lv, rar) => ({ id, nom, icon, col, lv, rar, cat: 'portrait' });
const F = (id, nom, icon, col, lv, rar) => ({ id, nom, icon, col, lv, rar, cat: 'frame' });
const B = (id, nom, icon, col, lv, rar) => ({ id, nom, icon, col, lv, rar, cat: 'background' });
const T = (id, nom, icon, col, lv, rar) => ({ id, nom, icon, col, lv, rar, cat: 'title' });
const O = (id, nom, icon, col, lv, rar) => ({ id, nom, icon, col, lv, rar, cat: 'ornament' });

export const COSMETICS = [
  P('p_guerrier','Guerrier','🗡','#8d6e63',25,'Commun'), P('p_mage','Mage','🔮','#64b5f6',50,'Commun'),
  P('p_archer','Archer','🏹','#81c784',75,'Rare'), P('p_lutin','Lutin des bois','🌿','#aed581',100,'Rare'),
  P('p_necrom','Nécromancien','💀','#9575cd',125,'Épique'), P('p_chevalier','Chevalier doré','🛡','#ffd54f',150,'Épique'),
  P('p_demon','Démon déchu','😈','#e57373',175,'Épique'), P('p_dragon','Draconic','🐉','#ff8a65',200,'Légendaire'),
  P('p_ange','Être céleste','😇','#fff176',250,'Légendaire'), P('p_titan','Titan originel','⚡','#40c4ff',500,'Mythique'),
  P('p_chaman','Chaman des vents','🪶','#81c784',525,'Légendaire'), P('p_omen','Œil du Néant','👁‍🗨','#7c4dff',325,'Épique'),
  P('p_cyclope','Cyclope','👹','#ff5252',575,'Légendaire'), P('p_voidtouched','Marqué du Vide','🕸','#b388ff',725,'Légendaire'),
  P('p_genesis','Graine originelle','🧬','#69f0ae',875,'Mythique'),
  F('f_bois','Bois brut','🪵','#6d4c41',25,'Commun'), F('f_fer','Fer forgé','⚙','#78909c',50,'Commun'),
  F('f_argent','Argent massif','⬡','#e0e0e0',100,'Rare'), F('f_dor','Dor royal','👑','#ffd54f',175,'Épique'),
  F('f_glace','Glace éternelle','❄','#80d8ff',225,'Épique'), F('f_enfer','Braise infernale','🔥','#ff7043',275,'Épique'),
  F('f_void','Rune du Néant','🕳','#b388ff',400,'Légendaire'), F('f_eternel','Cadre éternel','✨','#fff59d',750,'Mythique'),
  F('f_tempete','Cadre des Tempêtes','🌪','#4fc3f7',375,'Épique'), F('f_star','Cadre stellaire','⭐','#ffd54f',625,'Légendaire'),
  F('f_obscur','Cadre obscur','🌑','#78909c',825,'Légendaire'), F('f_genese','Cadre de la Genèse','🌟','#fff59d',950,'Mythique'),
  B('b_terre','Terres Oubliées','🌿','#69f0ae',50,'Commun'), B('b_glace','Terre Gelée','🏔','#80d8ff',125,'Rare'),
  B('b_enfer','Les Enfers','🌋','#ff7043',200,'Épique'), B('b_egout','Égouts','🦠','#aeea00',300,'Épique'),
  B('b_espace','L\'Espace','🚀','#82b1ff',400,'Légendaire'), B('b_tempete','Royaume des Tempêtes','🌪','#4fc3f7',500,'Légendaire'),
  B('b_nuit','Nuit étoilée','🌌','#7c4dff',600,'Légendaire'), B('b_aurore','Aurore cosmique','🌈','#69f0ae',900,'Mythique'),
  B('b_cathedrale','Cathédrale céleste','⛪','#ffd54f',475,'Épique'), B('b_comete','Pluie de comètes','☄️','#ffab91',675,'Légendaire'),
  B('b_abysses','Abysses','🕳','#00e5ff',850,'Légendaire'), B('b_labyrinthe','Labyrinthe infini','🌀','#9575cd',775,'Légendaire'),
  T('t_aventurier','Aventurier','🗡','#b0bec5',25,'Commun'), T('t_chasseur','Chasseur de monstres','🎯','#81c784',75,'Commun'),
  T('t_tueur','Tueur de boss','👑','#ffd54f',125,'Rare'), T('t_explorateur','Explorateur','🧭','#4fc3f7',175,'Rare'),
  T('t_sage','Sage des runes','📜','#ba68c8',250,'Épique'), T('t_voyant','Voyant des ombres','👁','#9575cd',350,'Épique'),
  T('t_maitre','Maître des mondes','🌍','#ffd54f',450,'Légendaire'), T('t_immortel','Immortel','♾','#e0e0e0',650,'Légendaire'),
  T('t_divin','Élu des dieux','✨','#fff176',800,'Mythique'), T('t_transcendant','Transcendant','🌟','#ffea00',1000,'Mythique'),
  T('t_desastre','Héraut du Désastre','☄','#ff7043',550,'Légendaire'), T('t_originel','Origine du monde','🌍','#ffea00',875,'Mythique'),
  T('t_erudit','Érudit des runes','📚','#80cbc4',425,'Épique'), T('t_tempet','Seigneur des Tempêtes','🌩','#4fc3f7',475,'Épique'),
  O('o_rien','Aucun','·','#555',0,'Commun'), O('o_laniere','Lanière','🎀','#8d6e63',50,'Commun'),
  O('o_etoile','Étoile filante','⭐','#ffd54f',150,'Rare'), O('o_rune','Pierre runique','🔮','#9575cd',300,'Épique'),
  O('o_aile','Ailes d\'ambre','🪽','#ffb74d',450,'Légendaire'), O('o_couronne','Mini couronne','👑','#ffd54f',600,'Légendaire'),
  O('o_anneau','Anneau cosmique','💫','#82b1ff',800,'Mythique'), O('o_halo','Halo divin','😇','#fff176',975,'Mythique'),
  O('o_lune','Lune croissante','🌙','#b0bec5',425,'Rare'), O('o_comete','Comète prisonnière','☄','#ffab91',700,'Légendaire'),
  O('o_nova','Nova immortelle','💥','#ff5252',925,'Mythique'),
];
export const cosmeticById = id => COSMETICS.find(c => c.id === id) || null;

// fonds : dégradés CSS par id
export const BG_CSS = {
  b_terre:     ['#1c3a24', '#0d2013', '#69f0ae'],
  b_glace:     ['#16324a', '#0a1a2c', '#80d8ff'],
  b_enfer:     ['#3a1410', '#1c0806', '#ff7043'],
  b_egout:     ['#24300d', '#101803', '#aeea00'],
  b_espace:    ['#141c3a', '#080c1c', '#82b1ff'],
  b_tempete:   ['#0e2a3a', '#061420', '#4fc3f7'],
  b_nuit:      ['#1c1040', '#0a0620', '#7c4dff'],
  b_aurore:    ['#0f3a2a', '#051a12', '#69f0ae'],
};
export const FRAME_CSS = {
  f_bois:    ['#6d4c41', '#4e342e'], f_fer: ['#78909c', '#455a64'],
  f_argent:  ['#e8e8e8', '#9e9e9e'], f_dor: ['#ffd54f', '#b8860b'],
  f_glace:   ['#b3e5fc', '#4fc3f7'], f_enfer: ['#ff8a65', '#bf360c'],
  f_void:    ['#b388ff', '#4a148c'], f_eternel: ['#fff9c4', '#ffea00'],
};
// même courbe que le jeu : xpForLevel(l) = 50 * l^1.22
export const xpForLevel = l => Math.floor(50 * Math.pow(l, 1.22));
export const xpNeedFor = lvl => lvl >= 1000 ? 0 : xpForLevel(lvl);
