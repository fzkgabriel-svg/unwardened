// État global partagé par tous les modules du jeu
import { loadInv } from './inventory.js';
import { storeKey } from './chars.js';

export const canvas = document.getElementById('game');
// supersampling x2 : le canvas logique reste 1200x640 mais le rendu est en 2400x1280
// -> graphismes nets même affichés en grand format dans le navigateur
const SS = 2;
canvas.width = 1200 * SS;
canvas.height = 640 * SS;
export const ctx = canvas.getContext('2d');
ctx.scale(SS, SS);
export const W = 1200, H = 640;
export const TAU = Math.PI * 2;
export const VERSION = '4.3.2';
export const FINAL_WAVE = 20; // vague du boss final (campagne 1) // incrémenter à chaque mise à jour du jeu
// vagues finales : campagne 2 -> 25, 3 -> 30, 4 (Égouts) -> 35, 5 (Espace) -> 40
export function finalWave() {
  return G.campaign === 5 ? 45 : G.campaign === 4 ? 40 : G.campaign === 3 ? 35 : G.campaign === 2 ? 30 : G.campaign === 1 ? 25 : FINAL_WAVE;
}

export const G = {
  state: 'menu', // menu | intro | playing | paused | dying | gameover | victory
  time: 0,

  // entrées
  keys: {},
  mouse: { x: W / 2, y: H / 2 },
  attackQueued: false,
  attackHeld: false,   // clic gauche maintenu (charge de l'arc cinétique)
  spinQueued: false,
  ultQueued: false,
  shieldQueued: false,
  singQueued: false,   // capacité SINGULARITÉ de l'arc (clic droit en mode arc)
  handQueued: false,  // main de feu du Titan de Feu (clic droit pendant la transformation)

  // monde procédural (coordonnées monde, caméra dans G.camX/G.camY)
  worldIndex: 0,
  camX: 0, camY: 0,

  // joueur
  player: {
    x: W / 2, y: H / 2, r: 15,
    speed: 2.1,
    hp: 100, maxHp: 100,
    attackDamage: 30, attackRange: 60, attackArc: Math.PI * 0.7, attackCooldown: 0,
    spinDamage: 70, spinRadius: 110, spinCooldown: 0, spinDuration: 0,
    ultCharge: 0, ultRadius: 400, ultActive: 0, ultAnim: 0,
    xp: 0, level: 1, xpNext: 50,
    attackMode: 1, // 1 = épée + rotation, 3 = bouclier + lance (tank)
    shieldT: 0, shieldCd: 0, // dôme de bouclier : -85% dégâts pendant 3s, recharge 10s
    handCd: 0,               // main de feu du titan : recharge 2,6 s
    handUsed: false,         // la main de feu n'est utilisable qu'UNE fois par transformation
    switchLock: 0, // 2s sans attaque après un changement d'arme
    alive: true, lastHurt: -99, potions: 0, maxPotions: 3, slowT: 0, hitSlowT: 0, potionCooldown: 0,
    poisonT: 0, poisonDps: 0 // poison de la sorcière : DoT 3s, plancher 15% PV
  },

  // monde
  enemies: [],
  drops: [],       // fioles par terre
  fireZones: [],   // zones de feu (bombe atomique)
  craters: [],     // cratères d'impact (bombe atomique, ~10 s)
  portals: [],     // portails d'apparition des monstres
  lightnings: [],  // frappes de foudre du Boss Foudre (téléscopées)
  projectiles: [], // projectiles de glace du Boss Givre
  bowShots: [],    // projectiles de l'arc cinétique (normal / chargé / singularité)
  singZones: [],   // zones de distorsion de la singularité {x,y,r,t,dur}
  particles: [],
  damageTexts: [],
  rings: [],
  bomber: null,    // cinématique de l'ultime : B-2 + bombe larguée
  mushroom: null,  // champignon nuageux de l'explosion ({x,y,t})
  iceStorm: null,  // ultime Pluie de Glace : {t, x, y, r, spawnT, age, finale, boomed} (ralentit + réduit les dégâts ennemis)
  iceDim: 0,       // assombrissement écran pendant la Pluie de Glace (0..1)
  hellStorm: null, // ultime Colère Infernale : {t, x, y, r, spawnT} (foyers de feu)
  iceSpikes: [],   // cristaux de glace en chute {x, ty, y, v, r, kind, rot, drift, mega}
  skyIcicles: [],  // stalactites géantes de la Pluie de Glace {x, y, ty, v, r, rot}
  iceShards: [],   // éclats de glace laissés au sol par les impacts {x, y, rot, s, life, maxLife}
  snowPatches: [], // sols enneigés laissés par la Pluie de Glace {x, y, r, life, maxLife}
  lasers: [],      // faisceaux de feu du Titan de Feu {x, y, angle, len, w, life, tick}
  hands: [],       // mains de feu en vol vers leur cible {x, y, tx, ty, t, dur}
  volcanoes: [],   // volcans éruptifs créés par les mains de feu {x, y, r, life, tick, eruptT, burst}
  acidZones: [],   // flaques d'acide (boss égouts / geysers) {x, y, r, life, maxLife, tick}
  blackHoles: [],  // trous noirs de l'ultime spatiale {x, y, r, life, maxLife, tick}
  iceWalls: [],    // murs de glace du Souverain {x, y, r, life} : obstacles temporaires
  shockwaves: [],  // ondes de choc au sol {x, y, r, maxR, speed, dmg, hit, color, slow}

  // progression / vague
  spawnTimer: 0,
  wave: 1,
  waveKills: 0,     // monstres tués dans la vague en cours
  waveTarget: 8,    // quota à atteindre pour passer à la vague suivante
  wavePause: 0,     // pause de 2,5s entre deux vagues
  kills: 0,

  // fin / effets d'écran
  gameOver: false,
  pendingVictory: false, // le boss final vient d'être vaincu -> cinématique de victoire
  adminNoCd: false, // admin : désactive tous les cooldowns du joueur
  tutorial: null,    // mode tutoriel en cours ({i,t,endT})
  lastInteract: null, // dernier type d'interaction (building/portal) — tutoriel
  deathT: 0,       // compte à rebours de la cinématique de mort
  deathDir: 1,     // sens de la chute du héros (-1 gauche, +1 droite)
  lastKiller: null, // dernier agresseur ayant touché le joueur (pour l'écran de mort)
  deathInfo: null,  // snapshot des infos de mort {killer, killerType, killerColor, world, campaign, wave}
  goT: 0,           // temps écoulé depuis l'apparition de l'écran de mort (animations)
  resumeTimer: 0, // compte à rebours avant reprise (pause)
  cloudT: 0,      // animation d'ouverture par les nuages au lancement
  screenFlash: 0,
  screenShake: 0,

  // compteurs de la partie en cours (fusionnés dans stats au game over)
  dmgDealt: 0, dmgTaken: 0, potionsUsed: 0, bossesKilled: 0, runTime: 0,
  nightTime: 0,      // temps passé la nuit (succès)
  typeKills: {},     // ennemis tués par type (succès)
  ultsUsed: 0,       // bombes atomiques utilisées (succès)
  nukeUlts: 0, iceUlts: 0, hellUlts: 0, // compteurs par type d'ultime (succès par monde)
  spinUsed: 0,       // attaques rotatives effectuées (tutoriel)
  shieldUsed: 0,     // dômes de bouclier utilisés (tutoriel)
  achToast: null,    // notification de succès débloqué
  warnToast: null,   // avertissement (ex. équipement presque cassé)
  volPanel: false,   // (legacy) ancien panneau de volume — plus utilisé
  adminMenu: false,  // menu de triche admin ouvert en jeu (met le jeu en pause)
  godMode: false,    // invincibilité administrateur
  runMats: {},       // matériaux gagnés pendant la partie en cours {type: n}
  runWear: {},       // durabilité perdue pendant la partie {itemId: %}
  adminPwErr: false, // dernier mot de passe admin incorrect
  adminPwErrT: 0,    // timestamp de l'erreur (pour le tremblement)
  adminUnlockT: -1,  // timestamp du déverrouillage (animation cadenas)

  // inventaire / forge (persisté)
  inv: loadInv(),    // { mats, items, equip }
  equip: { weaponMult: 1, armorReduce: 0, hp: 0, speed: 0, xp: 1, potions: 0, potionMult: 1, ultR: 1, ultBoss: 0 }, // bonus dérivés

  // menu
  menuView: 'characters', // characters | main | stats | achievements | forge | admin | campaign
  campaign: 0,     // campagne en cours : 0 = Terres Oubliées, 1 = Frozen Land, 2 = Les Enfers
  blizzard: 0,     // tempête de neige active (secondes restantes)
  eventT: 30,      // compte à rebours du prochain événement hivernal
  avalanche: null, // avalanche en cours {x, y, t} : télégraphe puis dégâts
  ashRain: 0,      // pluie de cendres active (secondes restantes, campagne 2)
  hellEruption: null, // éruption en cours {x, y, t, done} : télégraphe puis zone de feu
  hellEventT: 26,  // compte à rebours du prochain événement infernal
  sewerEventT: 24, // compte à rebours du prochain événement des égouts
  spaceEventT: 24, // compte à rebours du prochain événement spatial
  sewerGeyser: null, // geyser d'acide en télégraphe (campagne 3)
  voidHole: null,    // micro-trou noir en télégraphe (campagne 4)
  acidRain: 0,     // pluie acide active (secondes restantes, campagne 3)
  voidStorm: 0,    // tempête de void active (secondes restantes, campagne 4)
  stormEventT: 26, // compte à rebours du prochain événement des Tempêtes
  stormGale: 0,    // rafale globale active (secondes restantes, campagne 5)
  stormGaleDx: 1, stormGaleDy: 0, // direction de la rafale
  stormTornado: null, // tornade en cours {x, y, r, life, tick} (campagne 5)
  charInput: null,   // saisie du nom d'un nouveau personnage {slot, text}
  adminInput: null,  // saisie du mot de passe admin {text}
  resetConfirm: -1,  // slot en attente de confirmation de reset (-1 = aucune)
  durWarn: null,    // popup pré-partie : équipement <20% de durabilité [noms]
  campaignSel: 0,   // campagne sélectionnée sur la carte (0 à 4)

  // statistiques (persistées en localStorage, par personnage)
  stats: (() => {
    try { return JSON.parse(localStorage.getItem(storeKey('stats'))) || {}; }
    catch (e) { return {}; }
  })()
};

export function saveStats() {
  if (G.tutorial) return; // le tutoriel ne doit rien persister (faux personnage)
  try { localStorage.setItem(storeKey('stats'), JSON.stringify(G.stats)); } catch (e) {}
}
