import { G, ctx, W, H, TAU, saveStats, finalWave } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { regenerateDecor } from '../graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from '../achievements.js';
import { ITEMS, MATS, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave, modeKey, WEAPON_MODES, DUR_MAX, durMaxOf } from '../inventory.js';
import { spawnEnemy, spawnFinalBoss } from '../enemies.js';
import { gainXp } from '../player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart, campaignEnd } from '../world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm, sfxClick } from '../audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from '../chars.js';
import { inR, fitText, wrapLines, hexA, fmtTime, overline, panel, overlineCentered, drawMenuButton, drawAdminPwInput, menuButtons, menuButtonAt, adminUnlocked, campaignUnlocked, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, MENU_X, MENU_W, MENU_ITEMS } from './common.js';

export function reloadPersistence() {
  try {
    G.inv = loadInv();
    const b = equipBonuses(G.inv, (G.stats && G.stats.bestLevel || 1) || 1);
    for (const k in G.equip) delete G.equip[k];
    Object.assign(G.equip, { weaponMult: 1, armorReduce: 0, hp: 0, speed: 0, xp: 1, potions: 0, potionMult: 1, ultR: 1, ultBoss: 0, ...b });
  } catch (e) {}
  try {
    for (const k in unlocked) delete unlocked[k];
    const d = JSON.parse(localStorage.getItem(`rpg2d_c${activeSlot()}_achievements`));
    if (d) Object.assign(unlocked, d);
  } catch (e) {}
  try { G.stats = JSON.parse(localStorage.getItem(`rpg2d_c${activeSlot()}_stats`)) || {}; }
  catch (e) { G.stats = {}; }
  reloadWorlds();
}
// retour à l'écran de sélection des personnages
export function switchCharacter() {
  deselectChar();
  G.charInput = null; G.adminInput = null; G.resetConfirm = -1;
  G.menuView = 'characters';
}
// sélection + chargement complet d'un personnage (appelé par les clics)
export function pickCharacter(i) {
  if (!selectChar(i)) return false;
  reloadPersistence();
  return true;
}

export function startGame() {
  if (G.state !== 'menu') return;
  if (activeSlot() < 0) { G.menuView = 'characters'; return; } // il faut un héros
  // avertissement bloquant : équipement à moins de 20 % -> popup de confirmation
  if (!G._durBypass) {
    const low = [];
    for (const s in G.inv.equip) {
      const id = G.inv.equip[s];
      if (id && getDur(G.inv, id) < durMaxOf(id) * 0.2) low.push(ITEMS[id].name);
    }
    if (low.length) { G.durWarn = low; return; }
  }
  G._durBypass = false;
  // sécurité : une campagne exige la victoire dans la précédente (stats du personnage)
  if (G.campaign > 0 && !campaignUnlocked(G.campaign)) G.campaign = 0;
  G.state = 'intro'; // les nuages s'ouvrent pendant 3s, puis la partie commence
  G.menuView = 'main';
  G.tutorial = null; // une partie normale n'est jamais un tutoriel
  G.resumeTimer = 0;
  G.cloudT = 3;
  regenerateDecor(); // nouveau décor à chaque partie
  // reset compteurs de la partie
  G.dmgDealt = 0; G.dmgTaken = 0; G.potionsUsed = 0; G.bossesKilled = 0; G.runTime = 0;
  G.runMats = {}; G.runWear = {}; G.runWmode = {}; // résumé de fin de partie
  // nouvelle partie : monde de départ de la campagne choisie (monde sélectionné sur la carte), carte régénérée
  const wsel = (G.campaignWorlds && G.campaignWorlds[G.campaign]) || 0;
  G.worldIndex = Math.min(campaignStart(G.campaign) + wsel, campaignEnd(G.campaign) - 1);
  regenerateWorld(G.worldIndex);
  // reset positions : spawn du monde courant
  const sp = curWorld().spawn;
  G.player.x = sp.x; G.player.y = sp.y;
  syncCamera(true);
  G.spawnTimer = 0.5;
  G.wavePause = 0;
  // applique les bonus de l'équipement (forge)
  G.equip = equipBonuses(G.inv, G.stats.bestLevel || 1);
  // PV de départ selon la campagne : 100 / 200 / 300 / 400 / 500 / 600 (Tempêtes)
  G.player.maxHp = (G.campaign === 5 ? 600 : G.campaign === 4 ? 500 : G.campaign === 3 ? 400 : G.campaign === 2 ? 300 : G.campaign === 1 ? 200 : 100) + G.equip.hp + ((G.inv.buffs && G.inv.buffs.hp) || 0);
  G.player.hp = G.player.maxHp;
  G.player.speed += G.equip.speed;
  G.player.maxPotions = 3 + G.equip.potions + ((G.inv.buffs && G.inv.buffs.potions) || 0); // base 3 + gourde équipée + consommables (pas d'accumulation entre parties)
  // avertissement : équipement à moins de 20 % de durabilité = risque de casse en jeu
  G.achToast = null; G.warnToast = null;
  for (const slot in G.inv.equip) {
    const id = G.inv.equip[slot];
    const dmax = id ? durMaxOf(id) : DUR_MAX;
    const d = id ? getDur(G.inv, id) : dmax;
    if (id && d < dmax * 0.2) {
      G.warnToast = { name: `⚠️ ${ITEMS[id].name} : durabilité ${Math.round(d / dmax * 100)} % — répare-le à la forge !`, t: 6 };
      break;
    }
  }
}

// ---------- POPUP DURABILITÉ : bloque le lancement si équipement <20 % ----------
function durWarnLayout() {
  const w = 520, h = 240, x = W / 2 - w / 2, y = H / 2 - h / 2;
  return {
    x, y, w, h,
    launch: { x: x + 40, y: y + h - 64, w: w / 2 - 55, h: 46 },
    back:   { x: x + w / 2 + 15, y: y + h - 64, w: w / 2 - 55, h: 46 }
  };
}
export function durWarnClickAt(x, y) {
  if (!G.durWarn) return null;
  const L = durWarnLayout();
  if (inR(L.launch, x, y)) return 'launch';
  if (inR(L.back, x, y)) return 'menu';
  return 'inside';
}
export function durWarnAction(a) {
  if (a === 'launch') { G._durBypass = true; G.durWarn = null; startGame(); }
  else if (a === 'menu') { G.durWarn = null; G.menuView = 'forge'; } // retour à la forge pour réparer
  return a;
}
export function drawDurWarnPopup() {
  if (!G.durWarn) return;
  const L = durWarnLayout();
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  // carte rouge alert
  ctx.fillStyle = 'rgba(40,6,6,0.97)';
  roundRect(L.x, L.y, L.w, L.h, 14); ctx.fill();
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(239,83,80,0.7)'; ctx.shadowBlur = 20;
  roundRect(L.x, L.y, L.w, L.h, 14); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = 'bold 24px Inter, sans-serif';
  ctx.fillText('⚠ ÉQUIPEMENT ENDOMMAGÉ', W / 2, L.y + 48);
  ctx.fillStyle = '#e0e0e0'; ctx.font = '15px Inter, sans-serif';
  ctx.fillText('Ces équipements sont à moins de 20 % de durabilité :', W / 2, L.y + 80);
  ctx.fillStyle = '#ff8a80'; ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText(G.durWarn.join('  ·  '), W / 2, L.y + 106);
  ctx.fillStyle = '#a89f7c'; ctx.font = 'italic 13px Inter, sans-serif';
  ctx.fillText('Ils risquent de casser pendant la partie. Tu peux les réparer à la forge.', W / 2, L.y + 134);
  drawMenuButton(L.launch, 'LANCER QUAND MÊME', '#b71c1c', '#ef9a9a', true);
  drawMenuButton(L.back, 'ALLER À LA FORGE', '#455a64', '#90a4ae', false);
}

// Enregistre la performance de la partie terminée dans les stats persistantes
export function recordRun() {
  if (G.tutorial) return; // le tutoriel ne compte pas comme une partie
  const s = G.stats;
  checkAchievements(); // AVANT la fusion : effStats ajoute déjà les compteurs de la run (pas de double comptage)
  s.games = (s.games || 0) + 1;
  // détection des records AVANT mise à jour
  G.lastRun = {
    wave:   G.wave > (s.bestWave || 0),
    level:  G.player.level > (s.bestLevel || 1),
    kills:  G.kills > (s.bestKills || 0),
    damage: G.dmgDealt > (s.bestDamage || 0)
  };
  G.lastRun.any = G.lastRun.wave || G.lastRun.level || G.lastRun.kills || G.lastRun.damage;
  s.bestWave = Math.max(s.bestWave || 0, G.wave);
  s.bestLevel = Math.max(s.bestLevel || 1, G.player.level);
  s.bestKills = Math.max(s.bestKills || 0, G.kills);
  s.bestDamage = Math.max(s.bestDamage || 0, G.dmgDealt);
  // totaux cumulés sur toutes les parties
  s.totalDamage = (s.totalDamage || 0) + G.dmgDealt;
  s.totalDamageTaken = (s.totalDamageTaken || 0) + G.dmgTaken;
  s.totalPotions = (s.totalPotions || 0) + G.potionsUsed;
  s.totalBossKills = (s.totalBossKills || 0) + G.bossesKilled;
  s.totalPlayTime = (s.totalPlayTime || 0) + G.runTime;
  s.totalKills = (s.totalKills || 0) + G.kills;
  s.ultsUsed = (s.ultsUsed || 0) + G.ultsUsed;
  s.bestTime = Math.max(s.bestTime || 0, G.runTime);
  s.runs = (s.runs || 0) + 1; // nombre de parties du personnage
  s.typeKills = s.typeKills || {};
  for (const k in G.typeKills) s.typeKills[k] = (s.typeKills[k] || 0) + G.typeKills[k];
  // XP épée/lance : chaque type d'arme progresse avec les dégâts infligés
  G.lastWmodeXp = {};
  if (G.runWmode) for (const k in G.runWmode) {
    const xp = Math.round(G.runWmode[k]);
    if (xp <= 0) continue;
    addWmodeXp(G.inv, k, xp);
    G.lastWmodeXp[k] = xp;
  }
  saveStats();
}
// remet le jeu à zéro et retourne au menu principal
export function resetToMenu() {
  // fin du tutoriel : on restaure la vraie campagne, le vrai inventaire
  // et les vraies stats du personnage (le tutoriel jouait avec des copies)
  if (G._tutBackup) {
    G.campaign = G._tutBackup.campaign;
    G._tutBackup = null;
    setInvNoSave(false);
    reloadPersistence();
  }
  const p = G.player;
  const sp = curWorld().spawn;
  Object.assign(p, {
    x: sp.x, y: sp.y, speed: 2.1,
    hp: 100, maxHp: 100,
    attackDamage: 30, attackRange: 60, attackArc: Math.PI * 0.7, attackCooldown: 0,
    spinDamage: 70, spinRadius: 110, spinCooldown: 0, spinDuration: 0,
    ultCharge: 0, ultRadius: 400, ultActive: 0, ultAnim: 0,
    xp: 0, level: 1, xpNext: 50, attackMode: 1,
    shieldT: 0, shieldCd: 0, switchLock: 0, hitSlowT: 0,
    alive: true, lastHurt: -99, potions: 0, maxPotions: 3, slowT: 0, potionCooldown: 0,
    poisonT: 0, poisonDps: 0, _titanMax: 0, handCd: 0, handUsed: false
  });
  // chargement d'armes (menu Personnage) : la partie démarre avec la 1re arme choisie
  {
    const wl = (G.inv && G.inv.weapons && G.inv.weapons.length) ? G.inv.weapons : ['epee', 'lance'];
    p.attackMode = WEAPON_MODES[wl[0]] || 1;
  }
  G.enemies.length = 0; G.drops.length = 0; G.fireZones.length = 0; G.craters.length = 0; G.portals.length = 0;
  G.lightnings.length = 0; G.projectiles.length = 0;
  G.particles.length = 0; G.damageTexts.length = 0; G.rings.length = 0;
  G.attackQueued = false; G.attackHeld = false; G.spinQueued = false; G.ultQueued = false; G.shieldQueued = false; G.handQueued = false; G.singQueued = false;
  G.bowShots.length = 0; G.singZones.length = 0; G.bow = null; // arc cinétique : état propre
  G.spawnTimer = 0; G.wave = 1; G.waveKills = 0; G.waveTarget = 8; G.kills = 0;
  G.gameOver = false; G.resumeTimer = 0; G.cloudT = 0; G.screenFlash = 0; G.screenShake = 0;
  G.pendingVictory = false;
  G.bomber = null; G.mushroom = null;
  G.iceStorm = null; G.iceSpikes = []; G.skyIcicles = []; G.iceWalls = []; G.shockwaves = []; G.snowPatches = []; G.iceShards = []; G.iceDim = 0;
  G.hellStorm = null; G.ashRain = 0; G.hellEruption = null; G.lasers.length = 0;
  G.hands.length = 0; G.volcanoes.length = 0;
  G.blizzard = 0; G.avalanche = null; G.eventT = 30; G.hellEventT = 26;
  G.sewerEventT = 24; G.spaceEventT = 24; G.acidRain = 0; G.voidStorm = 0;
  G.sewerGeyser = null; G.voidHole = null;
  G.acidZones.length = 0; G.blackHoles.length = 0;
  G.tutorial = null; G.lastInteract = null;
  G.deathT = 0; G.deathDir = 1;
  G.lastKiller = null; G.deathInfo = null; G.goT = 0;
  G.dmgDealt = 0; G.dmgTaken = 0; G.potionsUsed = 0; G.bossesKilled = 0; G.runTime = 0;
  G.nightTime = 0; G.typeKills = {}; G.ultsUsed = 0; G.nukeUlts = 0; G.iceUlts = 0; G.hellUlts = 0;
  G.achToast = null; G.achT = 0;
  G.menuView = 'main';
  G.state = 'menu';
}

// recommence une partie directement depuis l'écran game over
export function playAgain() {
  resetToMenu();
  startGame();
}

// écran de victoire : enchaîne directement sur la campagne suivante
export function nextWorld() {
  resetToMenu();
  G.campaign = Math.min(5, G.campaign + 1);
  startGame();
}

