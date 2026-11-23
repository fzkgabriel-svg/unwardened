import { G, saveStats } from './state.js';
import { addMaterial, loadInv, saveInv, ITEMS, MATS, DUR_MAX, durMaxOf } from './inventory.js';
import { storeKey } from './chars.js';

// Succès persistés par personnage (localStorage 'rpg2d_c{slot}_achievements')
const KEY = () => storeKey('achievements');
const load = () => { try { return JSON.parse(localStorage.getItem(KEY())) || {}; } catch (e) { return {}; } };
const save = o => { try { localStorage.setItem(KEY(), JSON.stringify(o)); } catch (e) {} };

export const unlocked = load();

// test(G, stats) : stats = statistiques cumulées, G = partie en cours
export const ACHIEVEMENTS = [
  // ---------- COMMUN : presque rien ----------
  { id: 'first_blood', icon: '🗡️', name: 'Premier sang',        desc: 'Tuer votre premier ennemi',                    t: (G, s) => (s.totalKills || 0) >= 1 },
  { id: 'wave_5',      icon: '🏰', name: 'Seigneur des ruines', desc: 'Atteindre la vague 5',                          t: (G) => G.wave >= 5 },
  { id: 'level_5',     icon: '⭐', name: 'Étoile montante',      desc: 'Atteindre le niveau 5',                         t: (G) => G.player.level >= 5 },
  { id: 'potion_10',   icon: '🧪', name: 'Apothicaire',         desc: 'Boire 10 fioles au total',                      t: (G, s) => (s.totalPotions || 0) >= 10 },
  // ---------- RARE : modeste ----------
  { id: 'wave_10',     icon: '🏰', name: 'Commandant',          desc: 'Atteindre la vague 10',                         t: (G) => G.wave >= 10 },
  { id: 'wave_15',     icon: '🏰', name: 'Roi des Terres',      desc: 'Atteindre la vague 15',                         t: (G) => G.wave >= 15 },
  { id: 'level_10',    icon: '🌟', name: 'Maître du realm',      desc: 'Atteindre le niveau 10',                        t: (G) => G.player.level >= 10 },
  { id: 'slayer_100',  icon: '⚔️', name: 'Pourfendeur',          desc: '100 ennemis vaincus au total',                  t: (G, s) => (s.totalKills || 0) >= 100 },
  { id: 'boss_1',      icon: '👹', name: 'Chasseur de boss',     desc: 'Vaincre un boss',                               t: (G, s) => (s.totalBossKills || 0) >= 1 },
  { id: 'dmg_10k',     icon: '🔥', name: 'Brasier',              desc: '10 000 dégâts infligés au total',               t: (G, s) => (s.totalDamage || 0) >= 10000 },
  { id: 'marathon_5',  icon: '⏳', name: 'Endurant',            desc: 'Survivre 5 minutes dans une partie',            t: (G) => G.runTime >= 300 },
  { id: 'night_owl',   icon: '🌙', name: 'Oeil de la nuit',      desc: 'Passer 2 minutes de nuit dans une partie',      t: (G) => G.nightTime >= 120, hidden: true },
  { id: 'exter_40',    icon: '🕷️', name: 'Exterminateur d\'araignées', desc: 'Tuer 40 araignées au total',             t: (G, s) => ((s.typeKills || {}).spider || 0) >= 40 },
  { id: 'iron',        icon: '🛡️', name: 'Cuirassé',            desc: 'Atteindre la vague 8 en subissant < 300 dégâts', t: (G) => G.wave >= 8 && G.dmgTaken < 300 },
  // ---------- ÉPIQUE : le bon compte de ressources ----------
  { id: 'wave_20',     icon: '👑', name: 'Souverain oublié',    desc: 'Atteindre la vague 20',                         t: (G) => G.wave >= 20 },
  { id: 'level_15',    icon: '🌟', name: 'Ascension',           desc: 'Atteindre le niveau 15 dans une partie',        t: (G) => G.player.level >= 15 },
  { id: 'slayer_750',  icon: '⚔️', name: 'Faucheuse',            desc: '750 ennemis vaincus au total',                  t: (G, s) => (s.totalKills || 0) >= 750 },
  { id: 'boss_5',      icon: '👹', name: 'Tueur de géants',      desc: 'Vaincre 5 boss au total',                       t: (G, s) => (s.totalBossKills || 0) >= 5 },
  { id: 'boss_10',     icon: '🐉', name: 'Dompteur de dragons',  desc: 'Vaincre 10 boss au total',                      t: (G, s) => (s.totalBossKills || 0) >= 10 },
  { id: 'dmg_75k',     icon: '☄️', name: 'Cataclysme',           desc: '75 000 dégâts infligés au total',               t: (G, s) => (s.totalDamage || 0) >= 75000, hidden: true },
  { id: 'potion_75',   icon: '⚗️', name: 'Maître alchimiste',    desc: 'Boire 75 fioles au total',                      t: (G, s) => (s.totalPotions || 0) >= 75 },
  { id: 'potion_100',  icon: '🧪', name: 'Distillateur',         desc: 'Boire 100 fioles au total',                     t: (G, s) => (s.totalPotions || 0) >= 100, hidden: true },
  { id: 'marathon_10', icon: '⌛', name: 'Éternel',              desc: 'Survivre 10 minutes dans une partie',           t: (G) => G.runTime >= 600, hidden: true },
  { id: 'witch_30',    icon: '🧙', name: 'Chasseuse de sorcières', desc: 'Tuer 30 sorcières au total',                t: (G, s) => ((s.typeKills || {}).witch || 0) >= 30 },
  { id: 'ult_1',       icon: '☢️', name: 'Apocalypse',          desc: 'Utiliser la bombe atomique',                    t: (G, s) => (s.ultsUsed || 0) >= 1 },
  { id: 'ult_5',       icon: '☢️', name: 'Annihilation',         desc: 'Utiliser la bombe atomique 5 fois',             t: (G, s) => (s.ultsUsed || 0) >= 5, hidden: true },
  // ---------- LÉGENDAIRE : très long, très récompensé ----------
  { id: 'wave_30',     icon: '🌌', name: 'Légende des Terres',   desc: 'Atteindre la vague 30',                         t: (G) => G.wave >= 30 },
  { id: 'slayer_1500', icon: '💀', name: 'Exterminateur',        desc: '1500 ennemis vaincus au total',                 t: (G, s) => (s.totalKills || 0) >= 1500, hidden: true },
  { id: 'boss_20',     icon: '👑', name: 'Seigneur des seigneurs', desc: 'Vaincre 20 boss au total',                    t: (G, s) => (s.totalBossKills || 0) >= 20, hidden: true },
  { id: 'dmg_100k',    icon: '🌋', name: 'Force de la nature',   desc: '100 000 dégâts infligés au total',              t: (G, s) => (s.totalDamage || 0) >= 100000 },
  { id: 'marathon_15', icon: '♾️', name: 'Immortel',             desc: 'Survivre 15 minutes dans une partie',           t: (G) => G.runTime >= 900 },
  { id: 'ult_10',      icon: '☢️', name: 'Génocide',             desc: 'Utiliser la bombe atomique 10 fois',            t: (G, s) => (s.ultsUsed || 0) >= 10 },
  { id: 'flawless',    icon: '🦾', name: 'Immunisé',            desc: 'Atteindre la vague 10 en subissant < 300 dégâts', t: (G) => G.wave >= 10 && G.dmgTaken < 300 },
  { id: 'speedrun',    icon: '⚡', name: 'Éclair',              desc: 'Atteindre la vague 20 en moins de 15 minutes', t: (G) => G.wave >= 20 && G.runTime <= 900 },
  // ---------- MONDE 2 : LA TERRE GELÉE (onglet 1) ----------
  { id: 'ice_wave_20', icon: '🏔️', name: 'Marcheur des neiges',  desc: 'Atteindre la vague 20 en Terre Gelée',          t: (G) => G.campaign === 1 && G.wave >= 20, tab: 1 },
  { id: 'ice_wave_25', icon: '👑', name: 'Le dégel',             desc: 'Atteindre la vague 25 en Terre Gelée (finale)', t: (G) => G.campaign === 1 && G.wave >= 25, tab: 1 },
  { id: 'ice_boss',    icon: '🧊', name: 'Brise-glace',          desc: 'Vaincre le Souverain de Glace',                  t: (G, s) => !!(s.campaignDone || {})[1], tab: 1 },
  { id: 'ice_chest',   icon: '❄️', name: 'Coffre des neiges',    desc: 'Ouvrir le coffre : Pluie de Glace débloquée',    t: (G, s) => !!s.iceUlt, tab: 1 },
  { id: 'ice_yeti_30', icon: '🐻', name: 'Chasse au yéti',       desc: 'Tuer 30 yétis au total',                          t: (G, s) => ((s.typeKills || {}).yeti || 0) >= 30, tab: 1 },
  { id: 'ice_hunter_20',icon:'🏹', name: 'Traqueur gelé',        desc: 'Tuer 20 chasseurs gelés au total',                t: (G, s) => ((s.typeKills || {}).hunter || 0) >= 20, tab: 1 },
  { id: 'ice_alpha_10',icon: '🐺', name: 'Meute décimée',        desc: 'Tuer 10 alphas des neiges au total',             t: (G, s) => ((s.typeKills || {}).alpha || 0) >= 10, tab: 1 },
  { id: 'ice_ult_3',   icon: '🌨️', name: 'Tempête maîtrisée',    desc: 'Utiliser la Pluie de Glace 3 fois',               t: (G, s) => (s.iceUlts || 0) >= 3, tab: 1 },
  { id: 'ice_flawless',icon: '🛡️', name: 'Pas un bleuet',        desc: 'Atteindre la vague 20 gelée en subissant < 800 dégâts', t: (G) => G.campaign === 1 && G.wave >= 20 && G.dmgTaken < 800, tab: 1 },
  { id: 'ice_marathon',icon: '⏳', name: 'Hivernal',             desc: 'Survivre 8 minutes en Terre Gelée',               t: (G) => G.campaign === 1 && G.runTime >= 480, tab: 1 },
  // ---------- MONDE 3 : LES ENFERS (onglet 2) ----------
  { id: 'hell_wave_20',icon: '🌋', name: 'Marcheur de braise',   desc: 'Atteindre la vague 20 en Enfer',                  t: (G) => G.campaign === 2 && G.wave >= 20, tab: 2 },
  { id: 'hell_wave_30',icon: '👑', name: 'La cendre domptée',     desc: 'Atteindre la vague 30 en Enfer (finale)',         t: (G) => G.campaign === 2 && G.wave >= 30, tab: 2 },
  { id: 'hell_boss',   icon: '😈', name: 'Exorciste',            desc: 'Vaincre le Baron de l\'Enfer',                     t: (G, s) => !!(s.campaignDone || {})[2], tab: 2 },
  { id: 'hell_throne', icon: '🔥', name: 'Trône conquis',        desc: 'Ouvrir le trône : TITAN DE FEU débloqué',          t: (G, s) => !!s.hellUlt, tab: 2 },
  { id: 'hell_imp_40', icon: '👺', name: 'Légion de diablotins', desc: 'Tuer 40 diablotins au total',                     t: (G, s) => ((s.typeKills || {}).imp || 0) >= 40, tab: 2 },
  { id: 'hell_demon_25',icon:'😈', name: 'Chasse aux démons',     desc: 'Tuer 25 démons au total',                          t: (G, s) => ((s.typeKills || {}).demon || 0) >= 25, tab: 2 },
  { id: 'hell_golem_15',icon:'🗿', name: 'Fonderie',              desc: 'Tuer 15 golems de braise au total',                t: (G, s) => ((s.typeKills || {}).golemEnf || 0) >= 15, tab: 2 },
  { id: 'hell_ult_3',  icon: '🔥', name: 'Colosse',               desc: 'Utiliser le TITAN DE FEU 3 fois',                  t: (G, s) => (s.hellUlts || 0) >= 3, tab: 2 },
  { id: 'hell_flawless',icon:'🛡️', name: 'Peau de dragon',        desc: 'Atteindre la vague 25 en Enfer en subissant < 1000 dégâts', t: (G) => G.campaign === 2 && G.wave >= 25 && G.dmgTaken < 1000, tab: 2 },
  { id: 'hell_marathon',icon:'⌛', name: 'Infernal',              desc: 'Survivre 10 minutes en Enfer',                     t: (G) => G.campaign === 2 && G.runTime >= 600, tab: 2 },
  // ---------- MONDE 4 : LES ÉGOUTS (onglet 3) ----------
  { id: 'sew_wave_25', icon: '🗑️', name: 'Descendeur des égouts', desc: 'Atteindre la vague 25 en Égouts',               t: (G) => G.campaign === 3 && G.wave >= 25, tab: 3 },
  { id: 'sew_wave_35', icon: '👑', name: 'Le fond des profondeurs', desc: 'Atteindre la vague 35 en Égouts (finale)',      t: (G) => G.campaign === 3 && G.wave >= 35, tab: 3 },
  { id: 'sew_boss',    icon: '🐀', name: 'Roi des rats vaincu',   desc: 'Vaincre le Tyran des Profondeurs',                t: (G, s) => !!(s.campaignDone || {})[3], tab: 3 },
  { id: 'sew_rat_40',  icon: '🐀', name: 'Exterminateur de rats', desc: 'Tuer 40 rats géants au total',                    t: (G, s) => ((s.typeKills || {}).rat || 0) >= 40, tab: 3 },
  { id: 'sew_crapaud_20',icon:'🐸',name: 'Chasseur de crapauds',  desc: 'Tuer 20 crapauds des égouts au total',            t: (G, s) => ((s.typeKills || {}).crapaud || 0) >= 20, tab: 3 },
  { id: 'sew_ver_15',  icon: '🪱', name: 'Fendeur de vers',       desc: 'Tuer 15 vers des profondeurs au total',           t: (G, s) => ((s.typeKills || {}).ver || 0) >= 15, tab: 3 },
  { id: 'sew_flawless',icon: '🛡️', name: 'Nez pincé',             desc: 'Atteindre la vague 30 en Égouts en subissant < 1200 dégâts', t: (G) => G.campaign === 3 && G.wave >= 30 && G.dmgTaken < 1200, tab: 3 },
  { id: 'sew_marathon',icon: '⏳', name: 'Souterrain',            desc: 'Survivre 10 minutes en Égouts',                   t: (G) => G.campaign === 3 && G.runTime >= 600, tab: 3 },
  // ---------- MONDE 5 : L'ESPACE (onglet 4) ----------
  { id: 'spa_wave_30', icon: '🛸', name: 'Pionnier stellaire',    desc: 'Atteindre la vague 30 en Espace',                 t: (G) => G.campaign === 4 && G.wave >= 30, tab: 4 },
  { id: 'spa_wave_40', icon: '👑', name: 'Le dernier horizon',    desc: 'Atteindre la vague 40 en Espace (finale)',         t: (G) => G.campaign === 4 && G.wave >= 40, tab: 4 },
  { id: 'spa_boss',    icon: '👽', name: 'Sauveur des étoiles',   desc: 'Vaincre l\'Abomination Cosmique',                 t: (G, s) => !!(s.campaignDone || {})[4], tab: 4 },
  { id: 'spa_alien_40',icon: '👽', name: 'Chasse aux aliens',     desc: 'Tuer 40 aliens rampants au total',                 t: (G, s) => ((s.typeKills || {}).alien || 0) >= 40, tab: 4 },
  { id: 'spa_drone_25',icon: '🛸', name: 'Intercepteur',          desc: 'Tuer 25 drones de chasse au total',                t: (G, s) => ((s.typeKills || {}).drone || 0) >= 25, tab: 4 },
  { id: 'spa_tentacule_15',icon:'🦑',name:'Lutte tentaculaire',  desc: 'Tuer 15 tentacules stellaires au total',           t: (G, s) => ((s.typeKills || {}).tentacule || 0) >= 15, tab: 4 },
  { id: 'spa_flawless',icon: '🛡️', name: 'Combinaison intacte',   desc: 'Atteindre la vague 35 en Espace en subissant < 1500 dégâts', t: (G) => G.campaign === 4 && G.wave >= 35 && G.dmgTaken < 1500, tab: 4 },
  { id: 'spa_marathon',icon: '⌛', name: 'Cosmonaute',            desc: 'Survivre 12 minutes en Espace',                    t: (G) => G.campaign === 4 && G.runTime >= 720, tab: 4 },
  // ---------- MONDE 6 : LE ROYAUME DES TEMPÊTES (onglet 5) ----------
  { id: 'sto_wave_30', icon: '🌬️', name: 'Marcheur des cimes',    desc: 'Atteindre la vague 30 en Royaume des Tempêtes',    t: (G) => G.campaign === 5 && G.wave >= 30, tab: 5 },
  { id: 'sto_wave_45', icon: '👑', name: 'L\'ultime rafale',      desc: 'Atteindre la vague 45 en Royaume des Tempêtes (finale)', t: (G) => G.campaign === 5 && G.wave >= 45, tab: 5 },
  { id: 'sto_boss',    icon: '🌪️', name: 'Dompteur du Souverain', desc: 'Vaincre le Souverain des Ouragans',                t: (G, s) => !!(s.campaignDone || {})[5], tab: 5 },
  { id: 'sto_courant_40',icon:'💨',name: 'Sillage du vent',       desc: 'Tuer 40 enfants du vent au total',                 t: (G, s) => ((s.typeKills || {}).courant || 0) >= 40, tab: 5 },
  { id: 'sto_esprit_25',icon:'👻', name: 'Apaisement',            desc: 'Tuer 25 esprits de la brise au total',             t: (G, s) => ((s.typeKills || {}).esprit || 0) >= 25, tab: 5 },
  { id: 'sto_gardien_15',icon:'🛡️',name: 'Briseur de tempêtes',   desc: 'Tuer 15 gardiens de la tempête au total',          t: (G, s) => ((s.typeKills || {}).gardien || 0) >= 15, tab: 5 },
  { id: 'sto_colosse_10',icon:'☁️',name: 'Perce-nuages',          desc: 'Tuer 10 colosses des nuages au total',             t: (G, s) => ((s.typeKills || {}).colosse || 0) >= 10, tab: 5 },
  { id: 'sto_pass2',   icon: '⚡', name: 'Second souffle',        desc: 'Débloquer le 2ᵉ emplacement de module passif',      t: (G) => !!((G.inv && G.inv.modules && G.inv.modules.pass2Unlocked) || (G.stats && G.stats.campaignDone && G.stats.campaignDone[5])), tab: 5 },
  { id: 'sto_flawless',icon: '🛡️', name: 'Ancrage céleste',       desc: 'Atteindre la vague 40 en Tempêtes en subissant < 1800 dégâts', t: (G) => G.campaign === 5 && G.wave >= 40 && G.dmgTaken < 1800, tab: 5 },
  { id: 'sto_marathon',icon: '⌛', name: 'Sentinelle des cimes',  desc: 'Survivre 12 minutes en Royaume des Tempêtes',      t: (G) => G.campaign === 5 && G.runTime >= 720, tab: 5 },
];

// rareté des succès : plus c'est rare, plus la récompense est précieuse
export const RARITY = {
  commun:     { label: 'Commun',     color: '#9e9e9e' },
  rare:       { label: 'Rare',       color: '#4fc3f7' },
  epique:     { label: 'Épique',     color: '#ba68c4' },
  legendaire: { label: 'Légendaire', color: '#ffd740' },
};

// récompenses en matériaux par succès : [rareté, {matériau: quantité}]
// quantités volontairement modestes : les succès sont un bonus, pas une ferme à matériaux
const REWARDS = {
  // commun : récompense symbolique
  first_blood: ['commun',    { cuir: 1 }],
  wave_5:      ['commun',    { cuir: 1, fer: 1 }],
  level_5:     ['commun',    { cuir: 1, fer: 1 }],
  potion_10:   ['commun',    { cuir: 1 }],
  // rare : modeste
  wave_10:     ['rare',      { fer: 2,  or: 1 }],
  wave_15:     ['rare',      { fer: 3,  or: 1, essence: 1 }],
  level_10:    ['rare',      { fer: 3,  essence: 1, or: 1 }],
  slayer_100:  ['rare',      { fer: 3,  cuir: 2, or: 1 }],
  boss_1:      ['rare',      { or: 2,  essence: 1 }],
  dmg_10k:     ['rare',      { fer: 3,  or: 1 }],
  marathon_5:  ['rare',      { essence: 2, fer: 2 }],
  night_owl:   ['rare',      { essence: 2, cristal: 1 }],
  exter_40:    ['rare',      { essence: 2, or: 1 }],
  iron:        ['rare',      { fer: 3,  cuir: 2 }],
  // épique : le bon compte
  wave_20:     ['epique',    { or: 4,  essence: 3, cristal: 2 }],
  level_15:    ['epique',    { or: 4,  essence: 3, cristal: 2 }],
  slayer_750:  ['epique',    { or: 4,  essence: 4, fer: 6 }],
  boss_5:      ['epique',    { or: 4,  essence: 3, cristal: 2 }],
  boss_10:     ['epique',    { or: 5,  essence: 4, cristal: 3 }],
  dmg_75k:     ['epique',    { or: 4,  essence: 3, cristal: 2 }],
  potion_75:   ['epique',    { essence: 4, or: 3 }],
  potion_100:  ['epique',    { essence: 5, or: 4, cristal: 1 }],
  marathon_10: ['epique',    { essence: 4, cristal: 3, or: 4 }],
  witch_30:    ['epique',    { essence: 4, cristal: 2, or: 3 }],
  ult_1:       ['epique',    { cristal: 3, essence: 3, or: 4 }],
  ult_5:       ['epique',    { cristal: 4, essence: 5, or: 5 }],
  // légendaire : très long, très récompensé
  wave_30:     ['legendaire',{ or: 8,  essence: 6, cristal: 4 }],
  slayer_1500: ['legendaire',{ or: 9,  essence: 8, cristal: 5 }],
  boss_20:     ['legendaire',{ or: 9,  essence: 7, cristal: 5 }],
  dmg_100k:    ['legendaire',{ or: 8,  essence: 7, cristal: 4 }],
  marathon_15: ['legendaire',{ or: 9,  essence: 8, cristal: 5 }],
  ult_10:      ['legendaire',{ cristal: 8, essence: 12, or: 12 }],
  flawless:    ['legendaire',{ or: 10, essence: 8, cristal: 6 }],
  speedrun:    ['legendaire',{ or: 10, essence: 9, cristal: 6 }],
  // monde 2 — La Terre Gelée
  ice_wave_20:  ['rare',      { cristal: 3, essence: 2, fer: 3 }],
  ice_wave_25:  ['epique',    { cristal: 5, essence: 4, or: 4 }],
  ice_boss:     ['epique',    { cristal: 4, essence: 4, or: 5 }],
  ice_chest:    ['rare',      { cristal: 3, essence: 3 }],
  ice_yeti_30:  ['rare',      { cristal: 3, fer: 4, cuir: 3 }],
  ice_hunter_20:['rare',      { cristal: 3, essence: 2, fer: 3 }],
  ice_alpha_10: ['rare',      { cristal: 3, essence: 3, or: 2 }],
  ice_ult_3:    ['epique',    { cristal: 5, essence: 4, or: 3 }],
  ice_flawless: ['legendaire',{ cristal: 8, essence: 7, or: 6 }],
  ice_marathon: ['epique',    { cristal: 4, essence: 4, or: 4 }],
  // monde 3 — Les Enfers
  hell_wave_20: ['rare',      { essence: 4, or: 3, fer: 4 }],
  hell_wave_30: ['epique',    { essence: 6, or: 6, cristal: 4 }],
  hell_boss:    ['epique',    { essence: 7, or: 6, cristal: 4 }],
  hell_throne:  ['epique',    { essence: 6, or: 6, cristal: 5 }],
  hell_imp_40:  ['rare',      { essence: 4, fer: 3, or: 2 }],
  hell_demon_25:['rare',      { essence: 4, or: 4, fer: 3 }],
  hell_golem_15:['rare',      { fer: 6, essence: 3, or: 2 }],
  hell_ult_3:   ['epique',    { essence: 6, or: 5, cristal: 4 }],
  hell_flawless:['legendaire',{ essence: 9, or: 8, cristal: 6 }],
  hell_marathon:['epique',    { essence: 5, or: 5, cristal: 4 }],
  // monde 4 — Les Égouts
  sew_wave_25:  ['rare',      { fer: 5, essence: 3, or: 3 }],
  sew_wave_35:  ['epique',    { fer: 6, essence: 5, or: 5 }],
  sew_boss:     ['epique',    { essence: 6, or: 6, fer: 6 }],
  sew_flood:    ['epique',    { essence: 6, or: 5, fer: 6 }],
  sew_rat_40:   ['rare',      { fer: 4, essence: 3, or: 2 }],
  sew_crapaud_20:['rare',     { fer: 4, essence: 3, or: 3 }],
  sew_ver_15:   ['rare',      { essence: 4, fer: 3, or: 2 }],
  sew_ult_3:    ['epique',    { essence: 6, or: 5, fer: 5 }],
  sew_flawless: ['legendaire',{ essence: 8, or: 8, fer: 8 }],
  sew_marathon: ['epique',    { essence: 5, or: 5, fer: 5 }],
  // monde 5 — L'Espace
  spa_wave_30:  ['rare',      { cristal: 5, essence: 4, or: 3 }],
  spa_wave_40:  ['epique',    { cristal: 7, essence: 6, or: 6 }],
  spa_boss:     ['epique',    { cristal: 7, essence: 6, or: 7 }],
  spa_hole:     ['epique',    { cristal: 6, essence: 6, or: 5 }],
  spa_alien_40: ['rare',      { cristal: 4, essence: 4, or: 3 }],
  spa_drone_25: ['rare',      { cristal: 4, essence: 3, fer: 3 }],
  spa_tentacule_15:['rare',   { cristal: 5, essence: 4, or: 3 }],
  spa_ult_3:    ['epique',    { cristal: 6, essence: 6, or: 5 }],
  spa_flawless: ['legendaire',{ cristal: 9, essence: 8, or: 8 }],
  spa_marathon: ['epique',    { cristal: 5, essence: 5, or: 5 }],
  // monde 6 — Le Royaume des Tempêtes
  sto_wave_30:  ['rare',      { cristal: 5, essence: 4, fer: 5 }],
  sto_wave_45:  ['epique',    { cristal: 8, essence: 7, or: 7 }],
  sto_boss:     ['epique',    { cristal: 8, essence: 7, or: 8 }],
  sto_courant_40:['rare',     { cristal: 4, essence: 4, fer: 4 }],
  sto_esprit_25:['rare',      { cristal: 4, essence: 5, or: 3 }],
  sto_gardien_15:['rare',     { cristal: 5, essence: 4, fer: 5 }],
  sto_colosse_10:['rare',     { cristal: 6, essence: 5, or: 4 }],
  sto_pass2:    ['legendaire',{ cristal: 10, essence: 10, or: 10 }],
  sto_flawless: ['legendaire',{ cristal: 9, essence: 9, or: 9 }],
  sto_marathon: ['epique',    { cristal: 6, essence: 6, or: 6 }],
};

// infos d'affichage (rareté + récompense) d'un succès
export function achInfo(id) {
  const [r, rw] = REWARDS[id] || ['commun', {}];
  return { rarity: RARITY[r], reward: rw };
}

// un succès est réclamé une seule fois ; l'ancien format 'true' compte comme non réclamé
export function isClaimed(id) {
  const u = unlocked[id];
  return !!u && (typeof u === 'object' ? !!u.claimed : false);
}

// attribue les matériaux de récompense (une seule fois par succès)
export function claimReward(id) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  const u = unlocked[id];
  if (!a || !u || isClaimed(id)) return false;
  const rw = (REWARDS[id] || [])[1] || {};
  for (const m in rw) addMaterial(G.inv, m, rw[m]);
  unlocked[id] = { claimed: true };
  save(unlocked);
  return true;
}

// stats effectives = cumulées (toutes parties) + compteurs de la partie en cours,
// pour que les succès se débloquent en direct pendant la run
function effStats() {
  const s = { ...G.stats };
  s.totalKills = (s.totalKills || 0) + (G.kills || 0);
  s.totalDamage = (s.totalDamage || 0) + (G.dmgDealt || 0);
  s.totalDamageTaken = (s.totalDamageTaken || 0) + (G.dmgTaken || 0);
  s.totalPotions = (s.totalPotions || 0) + (G.potionsUsed || 0);
  s.totalBossKills = (s.totalBossKills || 0) + (G.bossesKilled || 0);
  s.ultsUsed = (s.ultsUsed || 0) + (G.ultsUsed || 0);
  s.nukeUlts = (s.nukeUlts || 0) + (G.nukeUlts || 0);
  s.iceUlts = (s.iceUlts || 0) + (G.iceUlts || 0);
  s.hellUlts = (s.hellUlts || 0) + (G.hellUlts || 0);
  s.typeKills = { ...(s.typeKills || {}) };
  for (const k in (G.typeKills || {})) s.typeKills[k] = (s.typeKills[k] || 0) + G.typeKills[k];
  return s;
}

// vérifie tous les succès ; déverrouille + notification toast
export function checkAchievements() {
  if (G.tutorial) return; // le tutoriel ne débloque aucun succès
  const s = effStats();
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (!unlocked[a.id] && a.t(G, s)) {
      unlocked[a.id] = { claimed: false };
      changed = true;
      G.achToast = { name: a.name, icon: a.icon, t: 3.5 };
    }
  }
  if (changed) save(unlocked);
}

export function achievementCount() {
  return ACHIEVEMENTS.filter(a => unlocked[a.id]).length;
}

// les succès d'un onglet (0 = Terres Oubliées, 1 = Terre Gelée, 2 = Enfers)
export function achTabList(tab) {
  return ACHIEVEMENTS.filter(a => (a.tab || 0) === tab);
}

// vrai s'il reste des récompenses à réclamer dans l'onglet donné (-1 = tous)
export function unclaimedInTab(tab = -1) {
  return ACHIEVEMENTS.some(a =>
    (tab < 0 || (a.tab || 0) === tab) && unlocked[a.id] && !isClaimed(a.id));
}

// admin : débloque TOUT — toutes les campagnes, les ultimes et les succès
// (avec leurs récompenses en matériaux réclamées d'office)
export function adminUnlockAll() {
  // campagnes + ultimes + arc : sauvegardés même si une récompense échoue
  G.stats = G.stats || {};
  G.stats.campaignDone = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true };
  G.stats.iceUlt = true;
  G.stats.hellUlt = true;
  G.stats.bowUnlocked = true; // arc cinétique cosmique
  saveStats();
  // inventaire : chaque bloc est isolé pour qu'un échec n'annule pas le reste
  if (!G.inv) { try { G.inv = loadInv(); } catch (e) {} }
  if (G.inv) {
    try {
      // tous les objets forgés, durabilité pleine (visibles et équipables à la forge)
      G.inv.items = G.inv.items || {};
      G.inv.dur = G.inv.dur || {};
      for (const id in ITEMS) { G.inv.items[id] = ITEMS[id].conso ? 5 : true; G.inv.dur[id] = durMaxOf(id); }
      // stocks de matériaux complets (réparations, fabrications)
      G.inv.mats = G.inv.mats || {};
      for (const m in MATS) G.inv.mats[m] = Math.max(G.inv.mats[m] || 0, 999);
      // niveau max des 3 types d'armes (épée / lance / arc)
      G.inv.wmode = G.inv.wmode || {};
      for (const k of ['epee', 'lance', 'arc']) {
        const w = G.inv.wmode[k] = G.inv.wmode[k] || { xp: 0 };
        w.xp = Math.max(w.xp || 0, 1e9); // -> niveau 100 (MAX)
      }
      // 2ᵉ emplacement passif (récompense du Souverain des Ouragans)
      G.inv.modules = G.inv.modules || {};
      G.inv.modules.pass2Unlocked = true;
      saveInv(G.inv);
    } catch (e) {}
  }
  // succès + matériaux de récompense : chaque bloc est isolé pour qu'un échec n'annule pas le reste
  for (const a of ACHIEVEMENTS) {
    try {
      if (!unlocked[a.id]) unlocked[a.id] = { claimed: false };
      claimReward(a.id);
    } catch (e) {}
  }
  save(unlocked);
}
