import { G, ctx, W, H, TAU, saveStats, finalWave } from './state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from './utils.js';
import { regenerateDecor } from './graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab } from './achievements.js';
import { ITEMS, MATS, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave } from './inventory.js';
import { spawnEnemy, spawnFinalBoss } from './enemies.js';
import { gainXp } from './player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart } from './world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm } from './audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from './chars.js';

// recharge inventaire / succès / stats / mondes pour le personnage actif
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
export function adminUnlocked() { return _adminOK; }

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
      if (id && getDur(G.inv, id) < 20) low.push(ITEMS[id].name);
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
  // nouvelle partie : monde de départ de la campagne choisie, carte régénérée
  G.worldIndex = campaignStart(G.campaign);
  regenerateWorld(G.worldIndex);
  // reset positions : spawn du monde courant
  const sp = curWorld().spawn;
  G.player.x = sp.x; G.player.y = sp.y;
  syncCamera(true);
  G.spawnTimer = 0.5;
  G.wavePause = 0;
  // applique les bonus de l'équipement (forge)
  G.equip = equipBonuses(G.inv, G.stats.bestLevel || 1);
  // PV de départ selon la campagne : 100 / 200 (Terre Gelée) / 300 (Enfers) / 400 (Égouts) / 500 (Espace)
  G.player.maxHp = (G.campaign === 4 ? 500 : G.campaign === 3 ? 400 : G.campaign === 2 ? 300 : G.campaign === 1 ? 200 : 100) + G.equip.hp;
  G.player.hp = G.player.maxHp;
  G.player.speed += G.equip.speed;
  G.player.maxPotions = 3 + G.equip.potions; // base 3 + gourde équipée (pas d'accumulation entre parties)
  // avertissement : équipement à moins de 20 % de durabilité = risque de casse en jeu
  G.achToast = null; G.warnToast = null;
  for (const slot in G.inv.equip) {
    const id = G.inv.equip[slot];
    if (id && getDur(G.inv, id) < 20) {
      G.warnToast = { name: `⚠️ ${ITEMS[id].name} : durabilité ${Math.floor(getDur(G.inv, id))} % — répare-le à la forge !`, t: 6 };
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

// Géométrie des boutons du menu (partagée avec le hit-test)
const MENU_X = 96, MENU_W = 300;
const MENU_ITEMS = [
  ['play', 'JOUER'], ['perso', 'HÉROS'], ['forge', 'FORGE'],
  ['tutoriel', 'TUTORIEL'], ['stats', 'STATISTIQUES'], ['ach', 'SUCCÈS']
];
function menuButtons() {
  const b = {};
  let y = 262;
  MENU_ITEMS.forEach(([k], i) => {
    const h = i === 0 ? 48 : 40;
    b[k] = { x: MENU_X, y, w: MENU_W, h };
    y += h + (i === 0 ? 10 : 4);
  });
  b.back = { x: W / 2 - 140, y: H / 2 + 245, w: 280, h: 54 };
  return b;
}

export function menuButtonAt(x, y) {
  const b = menuButtons();
  if (G.menuView === 'stats' || G.menuView === 'achievements') {
    return inR(b.back, x, y) ? 'back' : null;
  }
  for (const [k] of MENU_ITEMS) if (inR(b[k], x, y)) return k;
  return null;
}

const UI = 'Inter, sans-serif';
const SERIF = 'Cinzel, Georgia, serif';
const C_TEXT = '#efe8d6', C_MUTED = '#8f8a7e', C_GOLD = '#d4b062';

// fond commun des écrans de menu : voile sombre + poussières discrètes
function drawMenuBackdrop() {
  ctx.fillStyle = 'rgba(7,9,10,0.9)'; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createLinearGradient(0, 0, W, 0);
  vg.addColorStop(0, 'rgba(0,0,0,0.45)'); vg.addColorStop(0.6, 'rgba(0,0,0,0)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8d9a8';
  for (let i = 0; i < 22; i++) {
    const depth = (i % 4) * 0.01;
    const px = ((i * 173 + G.time * (4 + (i % 5) * 2)) % (W + 40) - 20) + (G.mouse.x - W / 2) * depth;
    const py = (i * 97) % H + Math.sin(G.time * 0.8 + i) * 8 + (G.mouse.y - H / 2) * depth * 0.6;
    ctx.globalAlpha = 0.04 + (i % 3) * 0.03;
    ctx.beginPath(); ctx.arc(px, py, 0.8 + (i % 3) * 0.6, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function overline(text, x, y, color = C_GOLD) {
  ctx.save();
  ctx.font = `600 11px ${UI}`; ctx.letterSpacing = '3px';
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}

function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12); ctx.stroke();
}

export function drawMenu() {
  drawMenuBackdrop();
  ctx.textAlign = 'center';

  // écrans secondaires : stats, succès, forge, personnages, admin
  if (G.menuView === 'stats') {
    drawStatsCard();
    return;
  }
  if (G.menuView === 'achievements') {
    drawAchievementsCard();
    return;
  }
  if (G.menuView === 'forge') {
    drawForgeView();
    return;
  }
  if (G.menuView === 'characters') {
    drawCharacters();
    return;
  }
  if (G.menuView === 'admin') {
    drawAdmin();
    return;
  }
  if (G.menuView === 'campaign') {
    drawCampaign();
    return;
  }

  // ==== colonne gauche : titre + navigation ====
  ctx.textAlign = 'left';
  overline('UN RPG 2D DE SURVIE', MENU_X, 118);
  ctx.save();
  ctx.font = `600 52px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = C_TEXT;
  ctx.fillText('LES TERRES', MENU_X - 3, 174);
  ctx.fillText('OUBLIÉES', MENU_X - 3, 228);
  ctx.restore();

  const b = menuButtons();
  MENU_ITEMS.forEach(([k, label], i) => drawNavItem(b[k], label, i === 0, k === 'ach' && unclaimedInTab(-1)));

  ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Entrée pour choisir votre campagne', MENU_X, H - 40);

  // ==== colonne droite : héros actif + contrôles ====
  const rx = 690, rw = 414;
  const meta = activeSlot() >= 0 ? slotMeta(activeSlot()) : null, s = G.stats;
  panel(rx, 96, rw, 84);
  overline('HÉROS ACTIF', rx + 24, 124, C_MUTED);
  ctx.font = `600 22px ${UI}`; ctx.fillStyle = C_TEXT;
  ctx.fillText(fitText(meta ? meta.name : 'Héros', 140), rx + 24, 156);
  const heroStats = [
    ['TEMPS', fmtPlaytime(meta ? meta.playtime : 0)],
    ['VAGUE', String(s.bestWave || 0)],
    ['ENNEMIS', String(s.totalKills || 0)]
  ];
  heroStats.forEach(([lab, val], i) => {
    const sx = rx + 184 + i * 78;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx - 14, 116, 1, 44);
    ctx.font = `600 10px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.save(); ctx.letterSpacing = '1px'; ctx.fillText(lab, sx, 128); ctx.restore();
    ctx.font = `600 16px ${UI}`; ctx.fillStyle = C_TEXT;
    ctx.fillText(fitText(val, 66), sx, 154);
  });

  // nom de l'ultime selon la sélection du héros (même logique que le HUD)
  const _us = G.stats.ultSel || 'nuke';
  const ultName = _us === 'glace' && G.stats.iceUlt ? 'Pluie de glace'
    : _us === 'hell' && G.stats.hellUlt ? 'Titan de feu' : 'Bombe atomique';
  const controls = [
    ['ZQSD', 'Se déplacer'],
    ['Clic gauche', 'Attaque principale'],
    ['Clic droit', 'Rotation (épée) · Dôme (lance)'],
    ['& / é', 'Changer de mode d\'arme'],
    ['F', `${ultName} (charge en tuant)`],
    ['W', 'Boire une fiole (+50 PV)']
  ];
  const cy = 196, ch = 300;
  panel(rx, cy, rw, ch);
  overline('CONTRÔLES', rx + 24, cy + 34, C_MUTED);
  controls.forEach((c, i) => {
    const ry = cy + 56 + i * 38;
    if (i) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(rx + 24, ry - 6, rw - 48, 1); }
    ctx.font = `600 12px ${UI}`;
    const kw = Math.max(28, ctx.measureText(c[0]).width + 18);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(rx + 24, ry + 2, kw, 24, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
    roundRect(rx + 24.5, ry + 2.5, kw - 1, 23, 6); ctx.stroke();
    ctx.fillStyle = C_TEXT; ctx.textAlign = 'center';
    ctx.fillText(c[0], rx + 24 + kw / 2, ry + 18);
    ctx.textAlign = 'left'; ctx.font = `14px ${UI}`; ctx.fillStyle = '#b5af9f';
    ctx.fillText(c[1], rx + 150, ry + 19);
  });
  ctx.font = `12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Mini-boss toutes les 3 vagues  ·  Boss toutes les 5 vagues', rx + 2, cy + ch + 28);
  ctx.textAlign = 'center';
}

// entrée de navigation du menu principal (liste verticale)
function drawNavItem(r, label, primary, badge) {
  const hov = inR(r, G.mouse.x, G.mouse.y);
  ctx.save();
  ctx.textAlign = 'left';
  if (primary) {
    ctx.fillStyle = hov ? '#e2c27a' : C_GOLD;
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.font = `700 15px ${UI}`; ctx.letterSpacing = '2px'; ctx.fillStyle = '#16130c';
    ctx.fillText(label, r.x + 20, r.y + r.h / 2 + 5);
    ctx.letterSpacing = '0px';
    ctx.font = `600 10px ${UI}`;
    const kw = ctx.measureText('ENTRÉE').width + 14;
    ctx.fillStyle = 'rgba(22,19,12,0.14)';
    roundRect(r.x + r.w - kw - 14, r.y + r.h / 2 - 10, kw, 20, 5); ctx.fill();
    ctx.fillStyle = 'rgba(22,19,12,0.7)';
    ctx.fillText('ENTRÉE', r.x + r.w - kw - 7, r.y + r.h / 2 + 4);
  } else {
    if (hov) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
      ctx.fillStyle = C_GOLD; ctx.fillRect(r.x, r.y + 10, 2, r.h - 20);
    }
    ctx.font = `600 14px ${UI}`; ctx.letterSpacing = '2px';
    ctx.fillStyle = hov ? C_TEXT : '#a39d8e';
    ctx.fillText(label, r.x + 20, r.y + r.h / 2 + 5);
    const lw = ctx.measureText(label).width;
    ctx.letterSpacing = '0px';
    if (badge) {
      ctx.fillStyle = C_GOLD;
      ctx.beginPath(); ctx.arc(r.x + 20 + lw + 8, r.y + r.h / 2, 3.5, 0, TAU); ctx.fill();
    }
    if (hov) {
      ctx.font = `500 16px ${UI}`; ctx.fillStyle = C_GOLD;
      ctx.textAlign = 'right';
      ctx.fillText('→', r.x + r.w - 16, r.y + r.h / 2 + 6);
    }
  }
  ctx.restore();
}

// bouton générique sobre (retour, pause, popups) : plein si primary, sinon contour
function drawMenuButton(r, label, c1, c2, primary) {
  const hov = inR(r, G.mouse.x, G.mouse.y);
  ctx.save();
  if (primary) {
    ctx.fillStyle = hexA(c1, hov ? 1 : 0.88);
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
  } else {
    ctx.fillStyle = hov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = hov ? hexA(c2, 0.7) : 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
    roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 10); ctx.stroke();
  }
  const fs = r.h < 50 ? 13 : 15;
  ctx.textAlign = 'center';
  ctx.font = `600 ${fs}px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = primary ? (c1 === C_GOLD ? '#16130c' : '#fff') : (hov ? C_TEXT : '#cfc8b6');
  ctx.fillText(label, r.x + r.w / 2 + 1, r.y + r.h / 2 + fs * 0.36);
  ctx.restore();
}

function drawStatsCard() {
  const s = G.stats;
  const cw = 540, ch = 470, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2 - 20;
  ctx.fillStyle = 'rgba(15,17,19,0.94)';
  roundRect(cx, cy, cw, ch, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1, 14); ctx.stroke();

  ctx.textAlign = 'center';
  overlineCentered('VOS MEILLEURS RECORDS', W / 2, cy + 40);
  ctx.save();
  ctx.fillStyle = C_TEXT; ctx.font = `600 28px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillText('STATISTIQUES', W / 2 + 1, cy + 76);
  ctx.restore();

  const fmtTime = t => {
    t = Math.floor(t);
    return `${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s`;
  };
  const rows = [
    ['Meilleure vague', s.bestWave || 0],
    ['Niveau max', s.bestLevel || 1],
    ['Ennemis vaincus (record)', s.bestKills || 0],
    ['Dégâts infligés (record)', Math.floor(s.bestDamage || 0)],
    ['Parties jouées', s.games || 0],
    ['Dégâts infligés (total)', Math.floor(s.totalDamage || 0)],
    ['Dégâts subis (total)', Math.floor(s.totalDamageTaken || 0)],
    ['Fioles bues (total)', s.totalPotions || 0],
    ['Boss vaincus (total)', s.totalBossKills || 0],
    ['Temps de jeu total', fmtTime(s.totalPlayTime || 0)]
  ];
  rows.forEach((r, i) => {
    const ry = cy + 118 + i * 33;
    if (i) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(cx + 40, ry - 21, cw - 80, 1); }
    ctx.textAlign = 'left'; ctx.fillStyle = C_MUTED; ctx.font = `14px ${UI}`;
    ctx.fillText(r[0], cx + 40, ry);
    ctx.textAlign = 'right'; ctx.fillStyle = C_TEXT; ctx.font = `600 15px ${UI}`;
    ctx.fillText(String(r[1]), cx + cw - 40, ry);
  });

  // bouton retour
  const b = menuButtons().back;
  drawMenuButton(b, '← RETOUR', '#455a64', '#90a4ae', false);
}

// grille des succès (partagée dessin / clic) — avec scroll et fiche détail
let achScroll = 0;
let achDetail = null;
let achTab = 0; // 0 = Terres Oubliées, 1 = Terre Gelée, 2 = Enfers, 3 = Égouts, 4 = Espace // id du succès ouvert en grand format
const ACH_COLS = 3, ACH_CELL_H = 44, ACH_GAP = 5;
const ACH_TAB_NAMES = ['🗺️ TERRES', '❄️ GLACÉE', '🔥 ENFERS', '🗑️ ÉGOUTS', '🛸 ESPACE'];

function achTabBtns() {
  const cw = 880, ch = 590, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  const bw = 160, gap = 12, y = cy + 80;
  const x0 = cx + (cw - (bw * 5 + gap * 4)) / 2;
  return [0, 1, 2, 3, 4].map(i => ({ i, x: x0 + i * (bw + gap), y, w: bw, h: 34 }));
}

function achCells() {
  const cw = 880, ch = 590, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  const list = achTabList(achTab);
  const cellW = (cw - 70) / ACH_COLS, gx = cx + 35, gy = cy + 128;
  const cells = list.map((a, i) => {
    const x = gx + (i % ACH_COLS) * cellW, y = gy + Math.floor(i / ACH_COLS) * (ACH_CELL_H + ACH_GAP) - achScroll;
    return {
      a, x, y, w: cellW - 8, h: ACH_CELL_H,
      btn: { x: x + cellW - 8 - 76, y: y + 12, w: 68, h: 20 }
    };
  });
  const rows = Math.ceil(list.length / ACH_COLS);
  const contentH = rows * ACH_CELL_H + (rows - 1) * ACH_GAP;
  const viewH = ch - 156;
  return {
    cx, cy, cw, ch, cells, viewH, list,
    view: { x: gx - 8, y: gy - 6, w: cw - 54, h: viewH },
    scrollMax: Math.max(0, contentH - viewH)
  };
}

export function achWheel(delta) {
  const { scrollMax } = achCells();
  achScroll = Math.max(0, Math.min(scrollMax, achScroll + delta * 0.45));
}

// fiche détail (modale) — géométrie partagée dessin / clic
function achDetailLayout() {
  const cw = 580, ch = 440, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  return {
    cx, cy, cw, ch,
    close: { x: cx + cw - 48, y: cy + 12, w: 36, h: 32 },
    claim: { x: cx + cw / 2 - 90, y: cy + ch - 78, w: 180, h: 42 }
  };
}

// tronque un texte avec ellipse pour tenir dans maxW (police courante conservée)
function fitText(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

export function achClickAt(x, y) {
  const b = menuButtons().back;
  // modale détail ouverte : elle intercepte tous les clics
  if (achDetail) {
    const L = achDetailLayout();
    if (inR(L.close, x, y)) { achDetail = null; return 'close'; }
    const a = ACHIEVEMENTS.find(v => v.id === achDetail);
    if (a && inR(L.claim, x, y)) {
      if (unlocked[a.id] && !isClaimed(a.id) && claimReward(a.id)) return 'claimed';
      return 'noop';
    }
    return 'noop';
  }
  if (inR(b, x, y)) { achDetail = null; return 'back'; }
  for (const t of achTabBtns()) {
    if (inR(t, x, y)) { achTab = t.i; achScroll = 0; achDetail = null; return 'tab'; }
  }
  for (const c of achCells().cells) {
    const ok = !!unlocked[c.a.id], claimed = isClaimed(c.a.id);
    if (!inR({ x: c.x, y: c.y, w: c.w, h: c.h }, x, y)) continue;
    // clic sur le bouton OBTENIR/RÉCOLTÉ → action directe, sinon fiche détail
    if (ok && inR(c.btn, x, y)) {
      if (!claimed && claimReward(c.a.id)) return 'claimed';
      return 'noop';
    }
    achDetail = c.a.id;
    return 'open';
  }
  return null;
}

// découpe un texte en lignes tenant dans maxW (police ctx courante)
function wrapLines(text, maxW) {
  const lines = []; let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// grande fiche d'un succès : icône, nom, rareté, objectif détaillé, récompense
function drawAchDetail() {
  const a = ACHIEVEMENTS.find(v => v.id === achDetail);
  if (!a) { achDetail = null; return; }
  const ok = !!unlocked[a.id], claimed = isClaimed(a.id);
  const { rarity, reward } = achInfo(a.id);
  const L = achDetailLayout();
  // voile + carte
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(14,12,8,0.97)';
  roundRect(L.cx, L.cy, L.cw, L.ch, 18); ctx.fill();
  ctx.strokeStyle = rarity.color; ctx.lineWidth = 2.5;
  roundRect(L.cx, L.cy, L.cw, L.ch, 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(L.cx + 5, L.cy + 5, L.cw - 10, L.ch - 10, 14); ctx.stroke();

  // icône géante + nom + rareté
  ctx.textAlign = 'center';
  ctx.font = '54px serif';
  ctx.fillText(a.icon, W / 2, L.cy + 88);
  ctx.font = 'bold 26px Inter, sans-serif';
  ctx.fillStyle = ok ? '#ffe9a3' : '#78909c';
  ctx.fillText(fitText(a.name, L.cw - 80), W / 2, L.cy + 132);
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillStyle = rarity.color;
  ctx.fillText('★ ' + rarity.label.toUpperCase(), W / 2, L.cy + 158);
  ctx.font = 'italic 14px Inter, sans-serif';
  ctx.fillStyle = ok ? (claimed ? '#69f0ae' : '#ffd740') : '#90a4ae';
  ctx.fillText(ok ? (claimed ? '✓ Récompense récoltée' : '✓ Débloqué — réclame ta récompense !') : '🔒 Pas encore débloqué', W / 2, L.cy + 184);

  // OBJECTIF : comment l'obtenir (description complète en plusieurs lignes)
  ctx.textAlign = 'left'; ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillStyle = '#ffd740';
  ctx.fillText('🎯 COMMENT L\'OBTENIR', L.cx + 42, L.cy + 224);
  ctx.font = '15px Inter, sans-serif';
  ctx.fillStyle = '#e8e0c8';
  const lines = wrapLines(a.desc, L.cw - 84);
  const descTop = L.cy + 248;
  lines.forEach((ln, i) => ctx.fillText(ln, L.cx + 42, descTop + i * 21));

  // RÉCOMPENSE
  const rw = Object.keys(reward).map(m => `${MATS[m].name} ×${reward[m]}`).join('  ·  ');
  const rwY = Math.max(descTop + lines.length * 21 + 14, L.cy + L.ch - 132);
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillStyle = '#ffd740';
  ctx.fillText('🎁 RÉCOMPENSE', L.cx + 42, rwY);
  ctx.font = '14px Consolas, monospace';
  ctx.fillStyle = ok ? '#ffe9a3' : '#78909c';
  ctx.fillText(fitText(rw, L.cw - 84), L.cx + 42, rwY + 22);

  // boutons : OBTENIR (si réclamable) + FERMER
  const claimable = ok && !claimed;
  if (claimable) {
    const cb = L.claim;
    ctx.fillStyle = 'rgba(76,175,80,0.6)';
    roundRect(cb.x, cb.y, cb.w, cb.h, 10); ctx.fill();
    ctx.strokeStyle = '#81c784'; ctx.lineWidth = 2;
    roundRect(cb.x, cb.y, cb.w, cb.h, 10); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★  OBTENIR  ★', cb.x + cb.w / 2, cb.y + 28);
  } else {
    ctx.font = 'italic 13px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = claimed ? '#69f0ae' : '#546e7a';
    ctx.fillText(claimed ? 'Récompense déjà récoltée ✓' : 'Verrouillé — continue à jouer !', W / 2, L.claim.y + 26);
  }
  const fb = L.close;
  ctx.fillStyle = 'rgba(69,90,100,0.8)';
  roundRect(fb.x, fb.y, fb.w, fb.h, 8); ctx.fill();
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.5;
  roundRect(fb.x, fb.y, fb.w, fb.h, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('✕', fb.x + fb.w / 2, fb.y + 22);
}

function drawAchievementsCard() {
  const { cx, cy, cw, ch, cells, view, scrollMax } = achCells();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(cx, cy, cw, ch, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.6)'; ctx.lineWidth = 2;
  roundRect(cx, cy, cw, ch, 16); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd740'; ctx.font = 'bold 30px Inter, sans-serif';
  ctx.fillText('SUCCÈS', W / 2, cy + 46);
  const done = achievementCount();
  ctx.fillStyle = '#80cbc4'; ctx.font = 'italic 15px Inter, sans-serif';
  ctx.fillText(`${done} / ${ACHIEVEMENTS.length} débloqués au total — molette pour défiler, clic pour les détails`, W / 2, cy + 68);

  // onglets par monde
  for (const t of achTabBtns()) {
    const on = achTab === t.i;
    const tabList = achTabList(t.i);
    const tabDone = tabList.filter(a => unlocked[a.id]).length;
    const pending = unclaimedInTab(t.i);
    ctx.fillStyle = on ? 'rgba(255,215,64,0.28)' : 'rgba(255,255,255,0.05)';
    roundRect(t.x, t.y, t.w, t.h, 10); ctx.fill();
    ctx.strokeStyle = on ? '#ffd740' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = on ? 2 : 1;
    roundRect(t.x, t.y, t.w, t.h, 10); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillStyle = on ? '#ffe9a3' : '#b0bec5';
    ctx.fillText(`${ACH_TAB_NAMES[t.i]}  (${tabDone}/${tabList.length})`, t.x + t.w / 2, t.y + 22);
    // pastille dorée si des récompenses sont réclamables dans cet onglet
    if (pending) {
      const px = t.x + t.w - 16, py = t.y + 10;
      const pulse = 0.7 + Math.sin(G.time * 6) * 0.3;
      ctx.fillStyle = `rgba(255,215,64,${pulse})`;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a5c00'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#3a2c00'; ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillText('!', px, py + 3.5);
    }
  }

  // grille 3 colonnes, rognée au viewport visible
  ctx.save();
  ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
  for (const c of cells) {
    const a = c.a, ok = !!unlocked[a.id], claimed = isClaimed(a.id);
    const claimable = ok && !claimed;
    const { rarity, reward } = achInfo(a.id);
    ctx.save();
    if (!ok) ctx.globalAlpha = 0.35;
    ctx.fillStyle = claimable ? 'rgba(105,240,174,0.10)' : claimed ? 'rgba(255,215,64,0.08)' : 'rgba(255,255,255,0.04)';
    roundRect(c.x, c.y, c.w, c.h, 9); ctx.fill();
    ctx.strokeStyle = claimable ? 'rgba(105,240,174,0.6)' : claimed ? 'rgba(255,215,64,0.45)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = claimable || claimed ? 1.5 : 1;
    roundRect(c.x, c.y, c.w, c.h, 9); ctx.stroke();
    // icône
    ctx.font = '18px serif'; ctx.textAlign = 'center';
    ctx.fillText(a.icon, c.x + 20, c.y + 29);
    // nom + rareté
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = claimable ? '#a5d6a7' : claimed ? '#ffe9a3' : '#78909c';
    const name = fitText(a.name, c.w - 150);
    ctx.fillText(name, c.x + 38, c.y + 16);
    const nameW = ctx.measureText(name).width;
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = rarity.color;
    ctx.fillText(rarity.label, c.x + 38 + nameW + 6, c.y + 16);
    // description
    ctx.font = '9px Inter, sans-serif';
    ctx.fillStyle = ok ? '#bdbdbd' : '#546e7a';
    ctx.fillText(fitText(a.desc, c.w - 120), c.x + 38, c.y + 28);
    // récompense / statut de récolte
    ctx.font = '9px Consolas, monospace';
    if (claimed) {
      ctx.fillStyle = '#ffd740';
      ctx.fillText('Récompense récoltée ✓', c.x + 38, c.y + 39);
    } else {
      const rw = Object.keys(reward).map(m => `${MATS[m].name} ×${reward[m]}`).join(' · ');
      ctx.fillStyle = claimable ? '#e0e0e0' : '#78909c';
      ctx.fillText(fitText('Récompense : ' + rw, c.w - 92), c.x + 38, c.y + 39);
    }
    // bouton OBTENIR / RÉCOLTÉ (succès débloqué uniquement)
    if (ok) {
      const b = c.btn;
      ctx.fillStyle = claimable ? 'rgba(76,175,80,0.55)' : 'rgba(255,255,255,0.07)';
      roundRect(b.x, b.y, b.w, b.h, 6); ctx.fill();
      ctx.strokeStyle = claimable ? '#81c784' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5; roundRect(b.x, b.y, b.w, b.h, 6); ctx.stroke();
      ctx.fillStyle = claimable ? '#fff' : '#ffd740';
      ctx.font = 'bold 9px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(claimable ? 'OBTENIR' : 'RÉCOLTÉ ✓', b.x + b.w / 2, b.y + 14);
    }
    ctx.restore();
  }
  ctx.restore(); // fin du clip de la grille

  // scrollbar verticale (à droite de la grille)
  if (scrollMax > 0) {
    const sx = view.x + view.w + 8, sy = view.y, sh = view.h;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(sx, sy, 7, sh, 4); ctx.fill();
    const thumbH = Math.max(28, sh * (view.h / (view.h + scrollMax)));
    const thumbY = sy + (sh - thumbH) * (achScroll / scrollMax);
    ctx.fillStyle = 'rgba(255,215,64,0.55)';
    roundRect(sx, thumbY, 7, thumbH, 4); ctx.fill();
  }

  const b = menuButtons().back;
  drawMenuButton(b, '← RETOUR', '#455a64', '#90a4ae', false);

  // fiche détail d'un succès par-dessus tout
  if (achDetail) drawAchDetail();
}

// ---------- FORGE & INVENTAIRE ----------
let forgeTab = 'craft'; // 'craft' | 'inv'
let forgeScroll = 0;    // scroll molette de l'onglet fourneau
let itemDetail = null;  // id de l'équipement ouvert en fiche détaillée

// hauteur totale / visible du contenu forge (pour borner le scroll)
function forgeScrollMax() {
  const L = forgeLayout();
  const visibleH = L.ch - 160;
  if (forgeTab === 'inv') return Math.max(0, invItems(L).totalH - visibleH);
  const rows = Math.ceil(Object.keys(ITEMS).length / 3);
  const totalH = rows * 104 + (rows - 1) * 8;
  return Math.max(0, totalH - visibleH);
}

export function forgeWheel(delta) {
  forgeScroll = Math.max(0, Math.min(forgeScrollMax(), forgeScroll + delta));
}

function forgeLayout() {
  const cw = 960, ch = 470;
  return { cx: W / 2 - cw / 2, cy: H / 2 - ch / 2, cw, ch };
}
function forgeTabs(L) {
  return {
    craft: { x: L.cx + 40, y: L.cy + 62, w: 190, h: 34 },
    inv:   { x: L.cx + 244, y: L.cy + 62, w: 190, h: 34 },
    hero:  { x: L.cx + 448, y: L.cy + 62, w: 190, h: 34 },
    back:  menuButtons().back
  };
}
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// bouton admin « don de matériaux » : visible à la forge uniquement si admin débloqué
function adminMatsBtn(L) { return { x: L.cx + L.cw - 176, y: L.cy + 34, w: 156, h: 30 }; }

// rects des recettes (partagé dessin / clic)
function craftCells(L) {
  const ids = Object.keys(ITEMS);
  const cellW = (L.cw - 60 - 24) / 3, cellH = 104;
  const x0 = L.cx + 30, y0 = L.cy + 112;
  return ids.map((id, i) => ({
    id,
    x: x0 + (i % 3) * (cellW + 12),
    y: y0 + Math.floor(i / 3) * (cellH + 8),
    w: cellW, h: cellH,
    btn: { x: x0 + (i % 3) * (cellW + 12) + cellW - 92, y: y0 + Math.floor(i / 3) * (cellH + 8) + cellH - 30, w: 78, h: 24 }
  }));
}

// inventaire : liste pleine largeur groupée par emplacement (scrollable)
function invItems(L) {
  const slots = [['weapon', '⚔️ ARME'], ['armor', '🛡️ ARMURE'], ['charm', '🧿 TALISMAN'], ['boots', '👢 BOTTES']];
  const x0 = L.cx + 30, w = L.cw - 60, y0 = L.cy + 146;
  const out = { headers: [], rows: [], totalH: 0 };
  let y = y0;
  for (const [slot, label] of slots) {
    const ids = Object.keys(ITEMS).filter(id => ITEMS[id].slot === slot && G.inv.items[id]);
    out.headers.push({ slot, label, y });
    y += 24;
    if (!ids.length) {
      out.rows.push({ empty: true, slot, x: x0, y, w, h: 30 });
      y += 38;
    }
    for (const id of ids) {
      out.rows.push({
        id, slot, x: x0, y, w, h: 54,
        btn: { x: x0 + w - 236, y: y + 12, w: 112, h: 30 },
        rbtn: { x: x0 + w - 116, y: y + 12, w: 100, h: 30 }
      });
      y += 60;
    }
    y += 12;
  }
  out.totalH = y - y0;
  return out;
}

// fiche équipement détaillée (modale) — géométrie partagée dessin / clic
function itemDetailLayout(dur) {
  const cw = 600, ch = 440, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  const by = cy + ch - 66;
  const two = dur < 100; // RÉPARER + ÉQUIPER côte à côte, sinon ÉQUIPER seul
  return {
    cx, cy, cw, ch,
    close: { x: cx + cw - 48, y: cy + 12, w: 36, h: 32 },
    equip: two ? { x: cx + cw - 275, y: by, w: 235, h: 42 }
               : { x: cx + cw / 2 - 140, y: by, w: 280, h: 42 },
    repair: { x: cx + 40, y: by, w: 235, h: 42 }
  };
}

const SLOT_LABEL = { weapon: '⚔️ ARME', armor: '🛡️ ARMURE', charm: '🧿 TALISMAN', boots: '👢 BOTTES' };

function drawItemDetail() {
  const id = itemDetail;
  const it = id && ITEMS[id];
  if (!it) { itemDetail = null; return; }
  const dur = getDur(G.inv, id);
  const broken = dur <= 0;
  const equipped = Object.values(G.inv.equip).includes(id);
  const rc = repairCost(G.inv, id);
  const L = itemDetailLayout(dur);
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(14,12,8,0.97)';
  roundRect(L.cx, L.cy, L.cw, L.ch, 18); ctx.fill();
  ctx.strokeStyle = broken ? '#ff5252' : '#5c6bc0'; ctx.lineWidth = 2.5;
  roundRect(L.cx, L.cy, L.cw, L.ch, 18); ctx.stroke();

  // grande icône + nom + emplacement
  drawItemIcon(it, W / 2, L.cy + 88, 40);
  ctx.textAlign = 'center';
  ctx.fillStyle = broken ? '#ff8a80' : '#ffe9a3'; ctx.font = 'bold 23px Inter, sans-serif';
  ctx.fillText(fitText(it.name, L.cw - 60), W / 2, L.cy + 152);
  ctx.fillStyle = '#90caf9'; ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillText(SLOT_LABEL[it.slot] || it.slot.toUpperCase(), W / 2, L.cy + 174);
  ctx.fillStyle = broken ? '#ff8a80' : '#69f0ae'; ctx.font = 'italic 13px Inter, sans-serif';
  ctx.fillText(broken ? '💥 CASSÉ — répare-le pour le rééquiper' : equipped ? '✓ Actuellement équipé' : 'Dans ton inventaire', W / 2, L.cy + 196);

  // les niveaux d'armes se suivent dans l'onglet Héros (épée / lance)

  // description + effet (max 5 lignes, le reste est tronqué avec « … »)
  ctx.textAlign = 'left'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
  ctx.fillText('📜 DESCRIPTION', L.cx + 42, L.cy + 226);
  ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#e8e0c8';
  let lines = wrapLines(it.desc, L.cw - 84);
  if (lines.length > 5) { lines = lines.slice(0, 5); lines[4] = fitText(lines[4] + '…', L.cw - 84); }
  lines.forEach((ln, i) => ctx.fillText(ln, L.cx + 42, L.cy + 247 + i * 18));

  // durabilité (position fixe : jamais dans les boutons)
  const dy = L.cy + 322;
  ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
  ctx.fillText('🔧 DURABILITÉ', L.cx + 42, dy);
  const dbx = L.cx + 42, dbw = L.cw - 84, dby = dy + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(dbx, dby, dbw, 12, 6); ctx.fill();
  const dc = dur > 50 ? '#69f0ae' : dur > 25 ? '#ffd740' : '#ff5252';
  if (dur > 0) { ctx.fillStyle = dc; roundRect(dbx, dby, dbw * dur / 100, 12, 6); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(broken ? 'CASSÉ' : `${Math.round(dur)} %`, dbx + dbw / 2, dby + 10);
  ctx.textAlign = 'left';

  // coût de réparation (une seule ligne, tronquée si besoin)
  ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
  ctx.fillText('💰 RÉPARATION', L.cx + 42, dy + 42);
  ctx.font = '12px Consolas, monospace';
  if (rc) {
    ctx.fillStyle = canRepair(G.inv, id) ? '#a5d6a7' : '#ef9a9a';
    ctx.fillText(fitText(Object.keys(rc).map(m => `${MATS[m].name} ×${rc[m]}`).join('  ·  '), L.cw - 240), L.cx + 140, dy + 42);
  } else {
    ctx.fillStyle = '#69f0ae';
    ctx.fillText(dur >= 100 ? 'Parfaite — aucune réparation nécessaire' : 'Matériaux insuffisants', L.cx + 140, dy + 42);
  }

  // boutons : RÉPARER + ÉQUIPER sur une seule rangée en bas
  if (dur < 100) {
    const okR = canRepair(G.inv, id);
    const rb = L.repair;
    ctx.fillStyle = okR ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.06)';
    roundRect(rb.x, rb.y, rb.w, rb.h, 9); ctx.fill();
    ctx.strokeStyle = okR ? '#ff9800' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
    roundRect(rb.x, rb.y, rb.w, rb.h, 9); ctx.stroke();
    ctx.fillStyle = okR ? '#ffe0b2' : '#78909c'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(okR ? '🔧  RÉPARER' : 'MATÉRIAUX INSUFFISANTS', rb.x + rb.w / 2, rb.y + 27);
  }
  const eb = L.equip;
  ctx.fillStyle = equipped ? 'rgba(255,215,64,0.3)' : broken ? 'rgba(255,82,82,0.2)' : 'rgba(92,107,192,0.55)';
  roundRect(eb.x, eb.y, eb.w, eb.h, 10); ctx.fill();
  ctx.strokeStyle = equipped ? '#ffd740' : broken ? '#ff5252' : '#9fa8da'; ctx.lineWidth = 2;
  roundRect(eb.x, eb.y, eb.w, eb.h, 10); ctx.stroke();
  ctx.fillStyle = equipped ? '#ffe9a3' : broken ? '#ff8a80' : '#fff'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(equipped ? '✓  ÉQUIPÉ' : broken ? 'CASSÉ — À RÉPARER' : 'ÉQUIPER', eb.x + eb.w / 2, eb.y + 27);
  const fb = L.close;
  ctx.fillStyle = 'rgba(69,90,100,0.8)';
  roundRect(fb.x, fb.y, fb.w, fb.h, 8); ctx.fill();
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.5;
  roundRect(fb.x, fb.y, fb.w, fb.h, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('✕', fb.x + fb.w / 2, fb.y + 22);
}

export function forgeClickAt(x, y) {
  const L = forgeLayout(), T = forgeTabs(L);
  // fiche équipement ouverte : elle intercepte tous les clics
  if (itemDetail) {
    const D = itemDetailLayout(getDur(G.inv, itemDetail));
    if (inR(D.close, x, y)) { itemDetail = null; return 'close'; }
    const id = itemDetail;
    if (inR(D.repair, x, y) && canRepair(G.inv, id)) {
      repairItem(G.inv, id);
      G.forgeAnim = { start: G.time, id, repair: true };
      sfxRepair();
      return 'repair';
    }
    if (inR(D.equip, x, y)) { toggleEquip(G.inv, id); sfxEquip(); return 'equip'; }
    return 'noop';
  }
  if (inR(T.back, x, y)) { itemDetail = null; return 'back'; }
  // don de matériaux : réservé à la forge + mode admin débloqué
  if (adminUnlocked() && inR(adminMatsBtn(L), x, y)) {
    for (const m in MATS) addMaterial(G.inv, m, 10);
    sfxCraft();
    return 'adminmats';
  }
  if (inR(T.craft, x, y)) { forgeTab = 'craft'; forgeScroll = 0; itemDetail = null; return 'tab'; }
  if (inR(T.inv, x, y)) { forgeTab = 'inv'; itemDetail = null; return 'tab'; }
  if (inR(T.hero, x, y)) { forgeTab = 'hero'; itemDetail = null; return 'tab'; }
  if (forgeTab === 'hero') {
    // choix de l'ultime
    const ub = ultBtns(L);
    if (inR(ub.nuke, x, y)) { G.stats.ultSel = 'nuke'; saveStats(); return 'ult'; }
    if (inR(ub.glace, x, y) && G.stats.iceUlt) { G.stats.ultSel = 'glace'; saveStats(); return 'ult'; }
    if (inR(ub.hell, x, y) && G.stats.hellUlt) { G.stats.ultSel = 'hell'; saveStats(); return 'ult'; }
    // clic sur une embase du personnage -> fiche de l'objet équipé (ou rien)
    for (const slot of ['weapon', 'armor', 'charm', 'boots']) {
      const r = heroSlots(L)[slot];
      const id = G.inv.equip[slot];
      if (id && inR(r, x, y)) { itemDetail = id; return 'open'; }
    }
    return null;
  }
  if (forgeTab === 'craft') {
    const sy = y + forgeScroll; // les cellules sont décalées par le scroll
    for (const c of craftCells(L)) {
      if (inR(c.btn, x, sy) && canCraft(G.inv, c.id)) {
        craft(G.inv, c.id);
        G.forgeAnim = { start: G.time, id: c.id }; // animation enclume + marteau
        sfxCraft();
        return 'craft';
      }
    }
  } else {
    const inv = invItems(L);
    const sy = y + forgeScroll; // contenu décalé par le scroll
    for (const r of inv.rows) {
      if (r.empty) continue;
      if (inR(r.rbtn, x, sy)) {
        if (canRepair(G.inv, r.id)) {
          repairItem(G.inv, r.id);
          G.forgeAnim = { start: G.time, id: r.id, repair: true }; // animation de réparation
          sfxRepair();
        }
        return 'repair';
      }
      if (inR(r.btn, x, sy)) { toggleEquip(G.inv, r.id); sfxEquip(); return 'equip'; }
      // clic sur la ligne (hors boutons) → fiche détaillée
      if (inR({ x: r.x, y: r.y, w: r.w, h: r.h }, x, sy)) { itemDetail = r.id; return 'open'; }
    }
  }
  return null;
}

function drawForgeView() {
  const L = forgeLayout(), T = forgeTabs(L);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(L.cx, L.cy, L.cw, L.ch, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.6)'; ctx.lineWidth = 2;
  roundRect(L.cx, L.cy, L.cw, L.ch, 16); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd740'; ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillText('⚒️  FORGE', W / 2, L.cy + 44);
  ctx.fillStyle = '#a89f7c'; ctx.font = 'italic 14px Inter, sans-serif';
  ctx.fillText('Forgez des équipements avec les matériaux des monstres', W / 2, L.cy + 62);

  // onglets
  for (const [key, label] of [['craft', '🔨 FORGER'], ['inv', '🎒 INVENTAIRE'], ['hero', '🧍 PERSONNAGE']]) {
    const r = T[key], active = forgeTab === key;
    ctx.fillStyle = active ? 'rgba(184,134,11,0.35)' : 'rgba(255,255,255,0.06)';
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = active ? '#ffd740' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = active ? 2 : 1;
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.fillStyle = active ? '#ffe9a3' : '#bdbdbd'; ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(label, r.x + r.w / 2, r.y + 23);
  }

  // bouton admin : don de matériaux (forge uniquement, admin débloqué)
  if (adminUnlocked()) {
    const mb = adminMatsBtn(L);
    const mhov = inR(mb, G.mouse.x, G.mouse.y);
    ctx.fillStyle = mhov ? 'rgba(239,83,80,0.55)' : 'rgba(239,83,80,0.22)';
    roundRect(mb.x, mb.y, mb.w, mb.h, 8); ctx.fill();
    ctx.strokeStyle = '#ef5350'; ctx.lineWidth = mhov ? 2 : 1.2;
    roundRect(mb.x, mb.y, mb.w, mb.h, 8); ctx.stroke();
    ctx.fillStyle = '#ffcdd2'; ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('🛠 +10 MATÉRIAUX', mb.x + mb.w / 2, mb.y + 20);
  }

  if (forgeTab === 'craft') drawForgeCraft(L);
  else if (forgeTab === 'inv') drawForgeInv(L);
  else drawHeroPaperdoll(L);
  if (itemDetail) drawItemDetail(); // fiche équipement par-dessus tout

  drawMenuButton(T.back, '← RETOUR', '#455a64', '#90a4ae', false);
  drawForgeAnim(L);
}

// animation de forge cinématique : halo de foyer, braises, enclume sur souche,
// lingot qui rougeoie, marteau avec traînée de mouvement, impacts étincelants
// et objet forgé qui matérialise avec une aura de rareté
function drawForgeAnim(L) {
  const fa = G.forgeAnim;
  if (!fa) return;
  const t = G.time - fa.start;
  if (t > 2.6) { G.forgeAnim = null; return; }
  const it = ITEMS[fa.id];
  const fadeOut = t > 2.15 ? (2.6 - t) / 0.45 : 1;
  const baseA = Math.min(1, t * 4) * fadeOut;
  const ax = W / 2, ay = L.cy + L.ch / 2 - 2;

  // cycle de frappe : ~0,62s par coup (montée / impact / récupération)
  const cyc = (t * 1.6) % 1;
  const impK = (cyc > 0.55 && cyc < 0.88) ? (cyc - 0.55) / 0.33 : -1; // 0->1 après l'impact

  ctx.save();
  ctx.globalAlpha = baseA;
  // micro-secousse locale à l'impact (le menu ne décroît pas G.screenShake)
  if (impK >= 0 && impK < 0.3) ctx.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);

  // ---- fond : plein écran sombre + halo de foyer vacillant ----
  ctx.fillStyle = 'rgba(8,5,2,0.88)';
  ctx.fillRect(0, 0, W, H);
  // scène agrandie pour que la forge occupe l'écran
  ctx.translate(W / 2, H / 2); ctx.scale(1.35, 1.35); ctx.translate(-W / 2, -H / 2);
  const flick = 0.7 + Math.sin(G.time * 9) * 0.12 + Math.sin(G.time * 23) * 0.1 + Math.sin(G.time * 47) * 0.06;
  const fg = ctx.createRadialGradient(ax, ay + 26, 10, ax, ay + 26, 260);
  fg.addColorStop(0, `rgba(255,130,40,${0.36 * flick})`);
  fg.addColorStop(0.55, `rgba(195,55,10,${0.14 * flick})`);
  fg.addColorStop(1, 'rgba(100,25,0,0)');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(ax, ay + 26, 260, 0, TAU); ctx.fill();

  // braises ascendantes
  for (let i = 0; i < 22; i++) {
    const sp = 14 + (i % 5) * 9;
    const yy = ay + 74 - ((G.time * sp + i * 61) % 165);
    const xx = ax - 150 + ((i * 53 + G.time * (7 + (i % 4) * 5)) % 300);
    ctx.globalAlpha = baseA * (0.16 + (i % 3) * 0.1);
    ctx.fillStyle = i % 3 === 0 ? '#ff7043' : (i % 3 === 1 ? '#ffab40' : '#ffd740');
    ctx.beginPath(); ctx.arc(xx, yy, 1 + (i % 3) * 0.8, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = baseA;

  // étincelles ambiantes : gerbes qui fusent depuis l'enclume en continu
  for (let i = 0; i < 18; i++) {
    const life = ((G.time * (0.7 + (i % 5) * 0.22) + i * 0.37) % 1);
    const sx = ax - 30 + Math.sin(i * 12.9 + G.time) * (30 + (i % 4) * 16);
    const sy = ay - 46 - life * (60 + (i % 3) * 30);
    const flick2 = 1 - life;
    ctx.globalAlpha = baseA * flick2 * (0.5 + (i % 2) * 0.4);
    ctx.fillStyle = i % 3 === 0 ? '#ffd740' : (i % 3 === 1 ? '#ff9800' : '#ff5722');
    ctx.beginPath(); ctx.arc(sx, sy, 1.6 + (i % 3) * 0.9, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = baseA;

  // ---- socle : table de forge + enclume sur souche ----
  ctx.fillStyle = '#3e2723';
  roundRect(ax - 95, ay + 50, 190, 15, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
  roundRect(ax - 95, ay + 50, 190, 15, 5); ctx.stroke();
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(ax - 14, ay + 28, 28, 24); // pied de l'enclume
  ctx.fillStyle = '#4e342e';
  roundRect(ax - 46, ay + 20, 92, 12, 4); ctx.fill(); // souche
  // corps de l'enclume (trapèze)
  const bodyG = ctx.createLinearGradient(ax - 70, ay - 24, ax + 70, ay + 8);
  bodyG.addColorStop(0, '#78909c'); bodyG.addColorStop(0.45, '#455a64'); bodyG.addColorStop(1, '#263238');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.moveTo(ax - 68, ay + 6); ctx.lineTo(ax - 46, ay - 24);
  ctx.lineTo(ax + 46, ay - 24); ctx.lineTo(ax + 68, ay + 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1c262b'; ctx.lineWidth = 2; ctx.stroke();
  // face de l'enclume (métal poli)
  const faceG = ctx.createLinearGradient(0, ay - 34, 0, ay - 20);
  faceG.addColorStop(0, '#eceff1'); faceG.addColorStop(0.5, '#b0bec5'); faceG.addColorStop(1, '#78909c');
  ctx.fillStyle = faceG;
  roundRect(ax - 76, ay - 36, 152, 13, 3); ctx.fill();
  ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.5;
  roundRect(ax - 76, ay - 36, 152, 13, 3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillRect(ax - 70, ay - 35, 140, 2.5); // reflet
  // corne gauche + talon droit
  ctx.fillStyle = '#546e7a';
  ctx.beginPath(); ctx.moveTo(ax - 76, ay - 30); ctx.quadraticCurveTo(ax - 108, ay - 38, ax - 98, ay - 18); ctx.lineTo(ax - 76, ay - 22); ctx.closePath(); ctx.fill();
  ctx.fillRect(ax + 62, ay - 30, 14, 11);

  // ---- lingot chauffé sur la face : rougeoie au fil de la forge ----
  const heat = Math.min(1, t / 1.85);
  const pulse = 1 + Math.sin(G.time * 12) * 0.06;
  const hr = Math.round((90 + heat * 165) * pulse), hg = Math.round((30 + heat * 170) * pulse), hb = Math.round(20 + heat * 60);
  const hotG = ctx.createRadialGradient(ax - 5, ay - 42, 2, ax - 5, ay - 42, 55);
  hotG.addColorStop(0, `rgba(255,${Math.round(140 + heat * 100)},50,${0.5 + heat * 0.35})`);
  hotG.addColorStop(1, 'rgba(255,90,0,0)');
  ctx.fillStyle = hotG;
  ctx.beginPath(); ctx.arc(ax - 5, ay - 42, 55, 0, TAU); ctx.fill();
  const metalG = ctx.createLinearGradient(ax - 34, ay - 46, ax + 30, ay - 33);
  metalG.addColorStop(0, `rgb(${hr},${hg},${hb})`);
  metalG.addColorStop(0.5, `rgb(${Math.min(255, hr + 70)},${Math.min(255, hg + 70)},${hb + 50})`);
  metalG.addColorStop(1, `rgb(${hr},${hg},${hb})`);
  ctx.fillStyle = metalG;
  ctx.beginPath();
  ctx.moveTo(ax - 36, ay - 46); ctx.lineTo(ax + 32, ay - 46);
  ctx.lineTo(ax + 26, ay - 34); ctx.lineTo(ax - 30, ay - 34);
  ctx.closePath(); ctx.fill();
  // stries de forge
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(ax + i * 10 - 2, ay - 45); ctx.lineTo(ax + i * 9, ay - 35); ctx.stroke();
  }

  // ---- impacts : onde de choc + gerbe d'étincelles + flash ----
  if (impK >= 0) {
    const k = impK, ix = ax - 8, iy = ay - 44;
    // flash de contact
    ctx.fillStyle = `rgba(255,245,200,${(1 - k) * 0.85})`;
    ctx.beginPath(); ctx.arc(ix, iy, 10 * (1 - k) + 3, 0, TAU); ctx.fill();
    // double anneau de choc
    ctx.strokeStyle = `rgba(255,220,140,${(1 - k) * 0.85})`;
    ctx.lineWidth = 3.5 * (1 - k) + 0.5;
    ctx.beginPath(); ctx.arc(ix, iy, 8 + k * 58, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,110,40,${(1 - k) * 0.55})`;
    ctx.lineWidth = 2 * (1 - k) + 0.5;
    ctx.beginPath(); ctx.arc(ix, iy, 5 + k * 40, 0, TAU); ctx.stroke();
    // gerbe d'étincelles
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + i * 0.7 + G.time * 2;
      const len = (10 + (i % 4) * 9) * (1 - k * 0.55);
      ctx.strokeStyle = `rgba(255,${Math.round(195 - k * 130)},${Math.round(60 - k * 30)},${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ix + Math.cos(a) * 7, iy + Math.sin(a) * 4);
      ctx.lineTo(ix + Math.cos(a) * (7 + len), iy + Math.sin(a) * (4 + len * 0.65));
      ctx.stroke();
    }
    // points chauds qui retombent
    ctx.fillStyle = `rgba(255,235,170,${(1 - k) * 0.95})`;
    for (let i = 0; i < 8; i++) {
      const dx = -14 + i * 4, dy = -6 + (i % 3) * 5;
      ctx.beginPath(); ctx.arc(ix + dx + k * 14, iy + dy + k * 10, 2.4 * (1 - k) + 0.4, 0, TAU); ctx.fill();
    }
  }

  // ---- marteau : traînée d'arc pendant la frappe ----
  const px = ax + 58, py = ay - 122;
  let ang;
  if (cyc < 0.42) ang = -0.5 - (cyc / 0.42) * 1.5;                    // -0,5 -> -2,0 (levé)
  else if (cyc < 0.55) { const k = (cyc - 0.42) / 0.13; ang = -2.0 + k * k * 2.7; } // frappe -> +0,7
  else ang = 0.7 - Math.min(1, (cyc - 0.55) / 0.45) * 1.2;           // récupération -> -0,5
  if (cyc >= 0.42 && cyc < 0.58) { // arc de mouvement
    ctx.strokeStyle = `rgba(255,205,130,${0.22 * (1 - (cyc - 0.42) / 0.16)})`;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(px, py, 108, -2.0, Math.min(ang, 0.7)); ctx.stroke();
  }
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  // manche
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 100); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,160,0.25)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(2, 6); ctx.lineTo(2, 96); ctx.stroke();
  // tête de marteau (face polie en BAS = côté qui frappe l'enclume)
  ctx.save();
  ctx.translate(0, 100);
  const headG = ctx.createLinearGradient(-30, -13, 30, 13);
  headG.addColorStop(0, '#37474f'); headG.addColorStop(0.5, '#546e7a'); headG.addColorStop(1, '#90a4ae');
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.moveTo(-32, -14); ctx.lineTo(32, -14); ctx.lineTo(25, 13); ctx.lineTo(-25, 13);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#263238'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#eceff1'; ctx.fillRect(-32, 9, 64, 5); // face polie (frappe vers le bas)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-30, -13, 60, 3); // dessus martelé
  ctx.restore();
  ctx.restore();

  // ---- titre + nom de l'objet ----
  const done = t > 1.85;
  const rep = !!fa.repair;
  ctx.textAlign = 'center';
  ctx.fillStyle = done ? '#69f0ae' : '#ffb74d';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText(done ? (rep ? '✓ ÉQUIPEMENT RÉPARÉ !' : '✓ OBJET FORGÉ !') : (rep ? 'RÉPARATION EN COURS…' : 'FORGE EN COURS…'), ax, L.cy + 42);
  if (it && !done) {
    ctx.fillStyle = '#ffe9a3'; ctx.font = 'italic 15px Inter, sans-serif';
    ctx.fillText(it.name, ax, L.cy + 66);
  }

  // ---- objet forgé : matérialisation au-dessus de l'enclume ----
  if (done && it) {
    const kt = Math.min(1, (t - 1.85) / 0.4);
    const iy = ay - 88 - kt * 34 + Math.sin(G.time * 2.2) * 4;
    const tier = itemTier(it);
    ctx.save();
    ctx.globalAlpha = baseA * kt;
    // aura de rareté
    ctx.globalAlpha = baseA * 0.4 * kt;
    ctx.fillStyle = tier;
    ctx.beginPath(); ctx.arc(ax, iy, 44 + kt * 14, 0, TAU); ctx.fill();
    ctx.globalAlpha = baseA * kt;
    // halo + icône
    const aura = ctx.createRadialGradient(ax, iy, 4, ax, iy, 60);
    aura.addColorStop(0, tier); aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = baseA * 0.3 * kt;
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(ax, iy, 60, 0, TAU); ctx.fill();
    ctx.globalAlpha = baseA * kt;
    drawItemIcon(it, ax, iy, 30);
    // étincelles ascendantes autour de l'objet
    for (let i = 0; i < 10; i++) {
      const yy = iy - 20 - ((G.time * (20 + i * 4) + i * 37) % 60);
      const xx = ax + Math.sin(G.time * 2 + i * 1.7) * (18 + i * 3);
      ctx.globalAlpha = baseA * kt * (0.5 - ((G.time * 0.5 + i) % 1) * 0.4);
      ctx.fillStyle = tier;
      ctx.beginPath(); ctx.arc(xx, yy, 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = baseA;
    ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(it.name, ax, L.cy + 66);
  }

  // ---- barre de progression ----
  if (!done) {
    const bw = 280, bx = ax - bw / 2, by = ay + 82;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(bx, by, bw, 10, 5); ctx.fill();
    const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, '#ff5722'); pg.addColorStop(1, '#ffd740');
    ctx.fillStyle = pg;
    roundRect(bx, by, bw * Math.min(1, t / 1.85), 10, 5); ctx.fill();
    // reflet animé
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    const sx = bx + ((G.time * 90) % (bw + 60)) - 30;
    ctx.beginPath(); ctx.ellipse(sx, by + 5, 16, 4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    roundRect(bx, by, bw, 10, 5); ctx.stroke();
  }
  ctx.restore();
}

function drawForgeCraft(L) {
  // zone de contenu scrollable (clip + décalage)
  const vx = L.cx + 8, vy = L.cy + 104, vw = L.cw - 16, vh = L.ch - 114;
  ctx.save();
  ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
  ctx.translate(0, -forgeScroll);
  for (const c of craftCells(L)) {
    const it = ITEMS[c.id], ok = canCraft(G.inv, c.id), owned = !!G.inv.items[c.id];
    ctx.fillStyle = owned ? 'rgba(105,240,174,0.08)' : 'rgba(255,255,255,0.04)';
    roundRect(c.x, c.y, c.w, c.h, 10); ctx.fill();
    ctx.strokeStyle = owned ? 'rgba(105,240,174,0.5)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    roundRect(c.x, c.y, c.w, c.h, 10); ctx.stroke();
    // icône + nom + desc (tuile d'équipement stylée)
    drawItemIcon(it, c.x + 34, c.y + c.h / 2, 17);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(it.name, c.x + 62, c.y + 24);
    ctx.fillStyle = '#9e9e9e'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText(it.desc, c.x + 62, c.y + 40);
    // coût en matériaux (vert si suffisant, rouge sinon)
    let cy = c.y + 58;
    ctx.font = '10px Consolas, monospace';
    for (const m in it.cost) {
      const have = G.inv.mats[m] || 0, need = it.cost[m];
      ctx.fillStyle = owned ? '#69f0ae' : have >= need ? '#a5d6a7' : '#ef9a9a';
      ctx.fillText(`${MATS[m].name} ${have}/${need}`, c.x + 62, cy);
      cy += 13;
    }
    // bouton FORGER / FORGÉ
    const b = c.btn;
    ctx.fillStyle = owned ? 'rgba(105,240,174,0.2)' : ok ? 'rgba(76,175,80,0.5)' : 'rgba(255,255,255,0.07)';
    roundRect(b.x, b.y, b.w, b.h, 6); ctx.fill();
    ctx.strokeStyle = owned ? '#69f0ae' : ok ? '#81c784' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5; roundRect(b.x, b.y, b.w, b.h, 6); ctx.stroke();
    ctx.fillStyle = owned ? '#69f0ae' : ok ? '#fff' : '#777';
    ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(owned ? 'FORGÉ ✓' : 'FORGER', b.x + b.w / 2, b.y + 17);
  }
  ctx.restore();
  // scrollbar à droite quand le contenu déborde
  const smax = forgeScrollMax();
  if (smax > 0) {
    const tx = L.cx + L.cw - 14, ty = vy, th = vh;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(tx, ty, 6, th, 3); ctx.fill();
    const thumbH = Math.max(24, th * (vh / (vh + smax)));
    const thumbY = ty + (th - thumbH) * (forgeScroll / smax);
    ctx.fillStyle = 'rgba(255,215,64,0.6)';
    roundRect(tx, thumbY, 6, thumbH, 3); ctx.fill();
  }
}

// ---------- PAPERDOLL : le héros vêtu de ses équipements ----------
// emplacements cliquables autour de la silhouette (partagé dessin / clic)
function heroSlots(L) {
  const hx = L.cx + L.cw / 2 - 20, hy = L.cy + L.ch / 2 + 26;
  // emplacements calés sur les parties du corps, bien dégagés du héros
  return {
    hx, hy,
    weapon: { x: hx + 78, y: hy - 32, w: 88, h: 64 },   // droite, hauteur torse
    armor:  { x: hx - 166, y: hy - 32, w: 88, h: 64 },  // gauche, hauteur torse
    charm:  { x: hx - 44, y: hy - 124, w: 88, h: 52 },  // centré au-dessus de la tête
    boots:  { x: hx - 44, y: hy + 92, w: 88, h: 50 }    // centré sous les pieds
  };
}

function drawHeroPaperdoll(L) {
  const S = heroSlots(L), hx = S.hx, hy = S.hy;
  // socle : plateforme dorée sous les pieds
  ctx.fillStyle = 'rgba(255,215,64,0.12)';
  ctx.beginPath(); ctx.ellipse(hx, hy + 80, 80, 11, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(hx, hy + 80, 80, 11, 0, 0, TAU); ctx.stroke();

  // ---- silhouette du héros (style chevaliier, plus grande que en jeu) ----
  ctx.save();
  ctx.translate(hx, hy);
  // bottes
  ctx.fillStyle = '#0d1b33';
  ctx.beginPath(); ctx.ellipse(-9, 62, 8, 11, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9, 62, 8, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(-17, 56, 16, 3); ctx.fillRect(1, 56, 16, 3);
  // jambes
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-14, 34, 10, 26); ctx.fillRect(4, 34, 10, 26);
  // torse : armure dégradé
  const bg = ctx.createLinearGradient(0, -30, 0, 40);
  bg.addColorStop(0, '#a8d0f0'); bg.addColorStop(0.5, '#4a7ec2'); bg.addColorStop(1, '#16386e');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, 8, 30, 34, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#0a2a55'; ctx.lineWidth = 2.5; ctx.stroke();
  // ceinture + boucle
  ctx.fillStyle = '#ffd740'; ctx.fillRect(-30, 26, 60, 5);
  ctx.fillStyle = '#b8860b'; ctx.fillRect(-4, 26, 8, 5);
  // tête
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(0, -32, 17, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2; ctx.stroke();
  // yeux
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-6, -33, 3.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -33, 3.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-6, -33, 1.7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -33, 1.7, 0, TAU); ctx.fill();
  // couronne
  ctx.fillStyle = '#ffd740'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1;
  ctx.fillRect(-11, -52, 22, 6); ctx.strokeRect(-11, -52, 22, 6);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 7 - 3, -52); ctx.lineTo(i * 7, -61); ctx.lineTo(i * 7 + 3, -52);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // épaulettes
  for (const s of [-1, 1]) {
    const px2 = s * 26, py2 = -14;
    const pg = ctx.createRadialGradient(px2 - 2, py2 - 2, 1, px2, py2, 9);
    pg.addColorStop(0, '#eceff1'); pg.addColorStop(1, '#78909c');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(px2, py2, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();

  // ---- emplacements : cadres cliquables avec l'objet équipé ----
  for (const slot of ['weapon', 'armor', 'charm', 'boots']) {
    const r = S[slot], id = G.inv.equip[slot], it = id && ITEMS[id];
    const eq = !!it;
    const dur = eq ? getDur(G.inv, id) : 100;
    const tier = eq ? itemTier(it) : '#ffd740'; // couleur de rareté de l'objet
    // cadre : teinté de la rareté quand l'emplacement est occupé
    ctx.fillStyle = eq ? 'rgba(255,215,64,0.10)' : 'rgba(255,255,255,0.04)';
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = eq ? tier : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = eq ? 2 : 1;
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.stroke();
    // étiquette du slot en haut du cadre
    ctx.fillStyle = eq ? tier : '#90caf9'; ctx.font = 'bold 9px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(SLOT_LABEL[slot], r.x + r.w / 2, r.y + 11);
    if (it) {
      // icône centrée, nom dessous, mini barre de durabilité en bas
      const icY = r.y + r.h * 0.44;
      drawItemIcon(it, r.x + r.w / 2, icY, 20);
      ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(fitText(it.name, r.w - 14), r.x + r.w / 2, r.y + r.h - 15);
      const bw2 = r.w - 22, bx2 = r.x + 11, by2 = r.y + r.h - 8;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(bx2, by2, bw2, 3, 2); ctx.fill();
      if (dur > 0) {
        ctx.fillStyle = dur > 50 ? '#69f0ae' : dur > 25 ? '#ffd740' : '#ff5252';
        roundRect(bx2, by2, bw2 * dur / 100, 3, 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#546e7a'; ctx.font = '20px serif';
      ctx.fillText('—', r.x + r.w / 2, r.y + r.h * 0.5 + 7);
      ctx.fillStyle = '#455a64'; ctx.font = 'italic 9px Inter, sans-serif';
      ctx.fillText('vide', r.x + r.w / 2, r.y + r.h - 15);
    }
  }
  // ---- progression ÉPÉE / LANCE : niveaux et XP (coins bas de la forge) ----
  drawModeCard(L.cx + 26, L.cy + L.ch - 106, 'epee', '⚔️', 'ÉPÉE', '#ffb74d');
  drawModeCard(L.cx + L.cw - 226, L.cy + L.ch - 106, 'lance', '🔱', 'LANCE', '#4fc3f7');
  // ---- choix de l'ULTIME (touche F en jeu) : en haut à droite ----
  drawUltSelect(L);
  // astuce
  ctx.fillStyle = '#78909c'; ctx.font = 'italic 12px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Clique sur un emplacement pour voir le détail de l\'équipement', W / 2, L.cy + L.ch - 14);
}

// ---------- SÉLECTEUR D'ULTIME (onglet Héros) ----------
// 'nuke' = bombe atomique (défaut) · 'glace' = Pluie de Glace (coffre du
// Souverain de Glace) · 'hell' = Colère Infernale (trône du Baron de l'Enfer).
// Le choix est sauvegardé par héros.
function ultBtns(L) {
  const x = L.cx + L.cw - 252, y = L.cy + 96;
  return {
    nuke:  { x, y, w: 232, h: 40 },
    glace: { x, y: y + 48, w: 232, h: 40 },
    hell:  { x, y: y + 96, w: 232, h: 40 }
  };
}
function drawUltSelect(L) {
  const sel = G.stats.ultSel || 'nuke';
  const iceOk = !!G.stats.iceUlt;
  const hellOk = !!G.stats.hellUlt;
  const ub = ultBtns(L);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd740'; ctx.font = 'bold 11px Inter, sans-serif';
  ctx.fillText('ULTIME — TOUCHE F', ub.nuke.x + ub.nuke.w / 2, ub.nuke.y - 8);
  const drawOne = (key, icon, label, sub, color, locked) => {
    const r = ub[key], on = sel === key && !locked;
    const hov = !locked && inR(r, G.mouse.x, G.mouse.y);
    ctx.globalAlpha = locked ? 0.45 : 1;
    ctx.fillStyle = on ? hexA(color, 0.4) : (hov ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)');
    roundRect(r.x, r.y, r.w, r.h, 9); ctx.fill();
    ctx.strokeStyle = on ? color : (hov ? '#fff' : 'rgba(255,255,255,0.22)');
    ctx.lineWidth = on ? 2.5 : 1.2;
    roundRect(r.x, r.y, r.w, r.h, 9); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = on ? '#fff' : locked ? '#78909c' : '#e0e0e0';
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(`${locked ? '🔒' : icon}  ${label}`, r.x + 12, r.y + 19);
    ctx.fillStyle = locked ? '#546e7a' : (on ? color : '#90a4ae'); ctx.font = '10px Inter, sans-serif';
    ctx.fillText(sub, r.x + 12, r.y + 34);
    if (on) { ctx.fillStyle = color; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('✓', r.x + r.w - 10, r.y + 19); }
    ctx.globalAlpha = 1; ctx.textAlign = 'center';
  };
  drawOne('nuke', '💣', 'BOMBE ATOMIQUE', 'B-2 + explosion nucléaire', '#ffd740', false);
  drawOne('glace', '❄️', 'PLUIE DE GLACE', iceOk ? 'pics gelés : ralenti + -50% dégâts ennemis' : 'coffre du Souverain de Glace', '#80d8ff', !iceOk);
  drawOne('hell', '🔥', 'TITAN DE FEU', hellOk ? 'titan 10 s : laser de feu dévastateur · charge lente' : 'trône du Baron de l\'Enfer', '#ff7043', !hellOk);
}

// carte de progression d'un type d'arme (épée / lance)
function drawModeCard(x, y, key, icon, label, color) {
  const info = modeInfo(G.inv, key);
  const w = 200, h = 78;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
  roundRect(x, y, w, h, 10); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.font = '17px serif'; ctx.fillText(icon, x + 12, y + 24);
  ctx.fillStyle = color; ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText(label, x + 38, y + 22);
  ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 15px Inter, sans-serif';
  ctx.fillText(`Niv. ${info.lvl}`, x + w - 78, y + 24);
  ctx.fillStyle = '#8d99ae'; ctx.font = '10px Inter, sans-serif';
  ctx.fillText(`+${Math.round((modeMult(G.inv, key) - 1) * 100)}% dégâts`, x + 38, y + 40);
  // barre d'XP vers le niveau suivant
  const bx = x + 12, bw = w - 24, by = y + 52;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(bx, by, bw, 7, 3.5); ctx.fill();
  ctx.fillStyle = color;
  roundRect(bx, by, bw * info.pct, 7, 3.5); ctx.fill();
  ctx.fillStyle = '#aab4c0'; ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(info.lvl >= MODE_MAX_LVL ? 'NIVEAU MAX' : `${Math.floor(info.xp).toLocaleString('fr-FR')} / ${info.need.toLocaleString('fr-FR')} XP`, x + w / 2, by + 18);
}

function drawForgeInv(L) {
  // compteurs de matériaux en haut
  let mx = L.cx + 30;
  ctx.font = 'bold 12px Consolas, monospace'; ctx.textAlign = 'left';
  for (const m in MATS) {
    const count = G.inv.mats[m] || 0;
    drawMatIcon(m, mx + 6, L.cy + 121, 6);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(`${MATS[m].name} ×${count}`, mx + 17, L.cy + 126);
    mx += ctx.measureText(`${MATS[m].name} ×${count}`).width + 36;
  }
  // liste pleine largeur scrollable, groupée par emplacement
  const inv = invItems(L);
  const vx = L.cx + 8, vy = L.cy + 142, vw = L.cw - 16, vh = L.ch - 158;
  ctx.save();
  ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
  ctx.translate(0, -forgeScroll);
  // en-têtes de slot
  for (const h of inv.headers) {
    ctx.fillStyle = '#ffd740'; ctx.font = 'bold 14px Georgia, serif'; ctx.textAlign = 'left';
    ctx.fillText(h.label, h.x, h.y + 4);
    ctx.strokeStyle = 'rgba(255,215,64,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(h.x, h.y + 12); ctx.lineTo(h.x + inv.rows.find(r => r.slot === h.slot && !r.empty)?.w || L.cw - 60, h.y + 12); ctx.stroke();
  }
  for (const r of inv.rows) {
    if (r.empty) {
      ctx.fillStyle = '#546e7a'; ctx.font = 'italic 12px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('— aucun objet forgé dans cet emplacement —', r.x + 10, r.y + 20);
      continue;
    }
    const it = ITEMS[r.id];
    const slot = r.slot;
    const eq = G.inv.equip[slot] === r.id;
    const dur = getDur(G.inv, r.id);
    const broken = dur <= 0;
    ctx.fillStyle = broken ? 'rgba(255,60,60,0.10)' : eq ? 'rgba(255,215,64,0.14)' : 'rgba(255,255,255,0.04)';
    roundRect(r.x, r.y, r.w, r.h - 6, 9); ctx.fill();
    ctx.strokeStyle = broken ? '#ff5252' : eq ? '#ffd740' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = broken || eq ? 2 : 1;
    roundRect(r.x, r.y, r.w, r.h - 6, 9); ctx.stroke();
    drawItemIcon(it, r.x + 30, r.y + 26, 19);
    ctx.textAlign = 'left';
    ctx.fillStyle = broken ? '#ff8a80' : eq ? '#ffe9a3' : '#e0e0e0'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(it.name + (broken ? '  💥' : eq ? '  ✓' : ''), r.x + 56, r.y + 20);
    ctx.fillStyle = '#9e9e9e'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText(fitText(it.desc, 420), r.x + 56, r.y + 37);
    // barre de durabilité + %
    const dbx = r.x + 56, dbw = 170, dby = r.y + 44;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(dbx, dby, dbw, 5, 2.5); ctx.fill();
    const dc = dur > 50 ? '#69f0ae' : dur > 25 ? '#ffd740' : '#ff5252';
    ctx.fillStyle = dc;
    if (dur > 0) { roundRect(dbx, dby, dbw * dur / 100, 5, 2.5); ctx.fill(); }
    ctx.fillStyle = broken ? '#ff8a80' : '#8d99ae'; ctx.font = 'bold 9px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(broken ? 'CASSÉ' : `${Math.round(dur)}%`, dbx + dbw + 8, dby + 5);
    // bouton RÉPARER (si usé) + coût
    const rb = r.rbtn;
    if (dur < 100) {
      const okR = canRepair(G.inv, r.id);
      ctx.fillStyle = okR ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.06)';
      roundRect(rb.x, rb.y, rb.w, rb.h, 8); ctx.fill();
      ctx.strokeStyle = okR ? '#ff9800' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
      roundRect(rb.x, rb.y, rb.w, rb.h, 8); ctx.stroke();
      ctx.fillStyle = okR ? '#ffe0b2' : '#78909c'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🔧 RÉPARER', rb.x + rb.w / 2, rb.y + rb.h / 2 + 4);
      // le coût de réparation est affiché dans la fiche détail (clic sur l'objet)
    }
    // bouton ÉQUIPER / ÉQUIPÉ / CASSÉ
    const b = r.btn;
    ctx.fillStyle = broken ? 'rgba(255,82,82,0.15)' : eq ? 'rgba(255,215,64,0.3)' : 'rgba(92,107,192,0.55)';
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = broken ? '#ff5252' : eq ? '#ffd740' : '#9fa8da'; ctx.lineWidth = 1.5;
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.stroke();
    ctx.fillStyle = broken ? '#ff8a80' : eq ? '#ffe9a3' : '#fff'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(broken ? 'CASSÉ' : eq ? 'ÉQUIPÉ ✓' : 'ÉQUIPER', b.x + b.w / 2, b.y + 20);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  // scrollbar
  const smax = forgeScrollMax();
  if (smax > 0) {
    const tx = L.cx + L.cw - 14, ty = vy, th = vh;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(tx, ty, 6, th, 3); ctx.fill();
    const thumbH = Math.max(24, th * (vh / (vh + smax)));
    const thumbY = ty + (th - thumbH) * (forgeScroll / smax);
    ctx.fillStyle = 'rgba(255,215,64,0.6)';
    roundRect(tx, thumbY, 6, thumbH, 3); ctx.fill();
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function fmtTime(t) {
  t = Math.floor(t);
  return `${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s`;
}

// ---------- PAUSE ----------
function pauseButtons() {
  const bh = 54, by = H / 2 + 70, gap = 20, bw = 270;
  const total = bw * 2 + gap;
  const x0 = W / 2 - total / 2;
  return {
    resume: { x: x0,            y: by, w: bw, h: bh },
    quit:   { x: x0 + bw + gap, y: by, w: bw, h: bh }
  };
}

export function pauseButtonAt(x, y) {
  const b = pauseButtons();
  for (const k of ['resume', 'quit']) {
    const r = b[k];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return k;
  }
  return null;
}

// lance le compte à rebours de 3s avant de reprendre (le jeu reste gelé)
export function requestResume() {
  if (G.resumeTimer <= 0) G.resumeTimer = 3;
}

export function drawPauseMenu() {
  ctx.fillStyle = 'rgba(4,8,12,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.font = '600 52px Inter, sans-serif';
  ctx.shadowColor = 'rgba(255,255,255,0.25)'; ctx.shadowBlur = 20;
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText('PAUSE', W / 2, H / 2 - 90);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 140, H / 2 - 66); ctx.lineTo(W / 2 + 140, H / 2 - 66); ctx.stroke();

  if (G.resumeTimer > 0) {
    // compte à rebours : le jeu reste gelé
    const n = Math.ceil(G.resumeTimer);
    ctx.font = 'bold 90px Inter, sans-serif';
    ctx.shadowColor = 'rgba(105,240,174,0.8)'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#69f0ae';
    ctx.fillText(String(n), W / 2, H / 2 + 40);
    ctx.shadowBlur = 0;
    ctx.font = 'italic 17px Inter, sans-serif'; ctx.fillStyle = '#a5d6a7';
    ctx.fillText('Reprise dans…', W / 2, H / 2 + 75);
    return;
  }

  ctx.font = '15px Inter, sans-serif'; ctx.fillStyle = '#90a4ae';
  ctx.fillText('Échap ou cliquez sur REPRENDRE — 3 secondes de gel avant de continuer', W / 2, H / 2 - 30);

  const b = pauseButtons();
  drawMenuButton(b.resume, 'REPRENDRE', '#4caf50', '#69f0ae', true);
  drawMenuButton(b.quit, 'MENU PRINCIPAL', '#455a64', '#90a4ae', false);
}

// ---------- GAME OVER ----------
// résumé loot/usure de la partie : matériaux gagnés + durabilité perdue
function runLootRows() {
  let mats = 0;
  for (const m in G.runMats) mats += G.runMats[m];
  let wear = 0;
  const worn = [];
  for (const id in G.runWear) {
    wear += G.runWear[id];
    if (G.runWear[id] > 0.5) worn.push(id);
  }
  worn.sort((a, b) => G.runWear[b] - G.runWear[a]);
  const names = worn.slice(0, 2).map(id => (ITEMS[id] ? ITEMS[id].name : id)).join(', ');
  // niveaux épée / lance (progression des types d'armes)
  const eL = modeInfo(G.inv, 'epee').lvl, lL = modeInfo(G.inv, 'lance').lvl;
  const wmodeXp = Math.round((G.lastWmodeXp ? (G.lastWmodeXp.epee || 0) + (G.lastWmodeXp.lance || 0) : 0));
  return {
    mats,
    wear,
    wmodeLabel: `⚔ Épée niv.${eL} · 🔱 Lance niv.${lL}`,
    wmodeXp,
    wearLabel: names ? `🛡 Usure : ${names}${worn.length > 2 ? '…' : ''}` : '🛡 Usure équipement'
  };
}
function goButtons() {
  const bh = 54, by = H / 2 + 140, gap = 20, bw = 270;
  const total = bw * 2 + gap;
  const x0 = W / 2 - total / 2;
  return {
    replay: { x: x0,            y: by, w: bw, h: bh },
    menu:   { x: x0 + bw + gap, y: by, w: bw, h: bh }
  };
}

export function gameOverButtonAt(x, y) {
  const b = goButtons();
  for (const k of ['replay', 'menu']) {
    const r = b[k];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return k;
  }
  return null;
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
    shieldT: 0, shieldCd: 0, switchLock: 0,
    alive: true, lastHurt: -99, potions: 0, maxPotions: 3, slowT: 0, potionCooldown: 0,
    poisonT: 0, poisonDps: 0, _titanMax: 0, handCd: 0, handUsed: false
  });
  G.enemies.length = 0; G.drops.length = 0; G.fireZones.length = 0; G.craters.length = 0; G.portals.length = 0;
  G.lightnings.length = 0; G.projectiles.length = 0;
  G.particles.length = 0; G.damageTexts.length = 0; G.rings.length = 0;
  G.attackQueued = false; G.spinQueued = false; G.ultQueued = false; G.shieldQueued = false; G.handQueued = false;
  G.spawnTimer = 0; G.wave = 1; G.waveKills = 0; G.waveTarget = 8; G.kills = 0;
  G.gameOver = false; G.resumeTimer = 0; G.cloudT = 0; G.screenFlash = 0; G.screenShake = 0;
  G.pendingVictory = false;
  G.bomber = null; G.mushroom = null;
  G.iceStorm = null; G.iceSpikes = []; G.skyIcicles = []; G.iceWalls = []; G.shockwaves = []; G.snowPatches = [];
  G.hellStorm = null; G.ashRain = 0; G.hellEruption = null; G.lasers.length = 0;
  G.hands.length = 0; G.volcanoes.length = 0;
  G.blizzard = 0; G.avalanche = null; G.eventT = 30; G.hellEventT = 26;
  G.sewerEventT = 24; G.spaceEventT = 24; G.acidRain = 0; G.voidStorm = 0;
  G.sewerGeyser = null; G.voidHole = null;
  G.acidZones.length = 0; G.blackHoles.length = 0;
  G.tutorial = null; G.lastInteract = null;
  G.deathT = 0; G.deathDir = 1;
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
  G.campaign = Math.min(4, G.campaign + 1);
  startGame();
}

// écran de victoire : le boss final de la vague 20 a été vaincu
export function drawVictory() {
  const p = G.player;
  // fond doré sombre + halo de fête
  ctx.fillStyle = 'rgba(30,22,4,0.85)'; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2 - 40, 60, W / 2, H / 2, H * 0.85);
  v.addColorStop(0, 'rgba(255,215,64,0.18)'); v.addColorStop(1, 'rgba(60,40,0,0.4)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  // titre doré pulsé
  const pulse = 1 + Math.sin(G.time * 3.5) * 0.05;
  ctx.save();
  ctx.translate(W / 2, H / 2 - 175);
  ctx.scale(pulse, pulse);
  const tg = ctx.createLinearGradient(-280, 0, 280, 0);
  tg.addColorStop(0, '#ffd740'); tg.addColorStop(0.5, '#fff59d'); tg.addColorStop(1, '#ff8f00');
  ctx.font = 'bold 72px Georgia, serif';
  ctx.shadowColor = 'rgba(255,215,64,0.9)'; ctx.shadowBlur = 40;
  ctx.fillStyle = tg;
  ctx.fillText('✦ VICTOIRE ✦', 0, 0);
  ctx.restore();
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillStyle = '#ffe9a3';
  const vicNames = ['Le Seigneur Oublié est vaincu — les Terres Oubliées sont libérées !',
    'Le Souverain de Glace est vaincu — la Terre Gelée est libérée !',
    'Le Baron de l\'Enfer est vaincu — les Enfers sont libérés !',
    'Le Tyran des Profondeurs est vaincu — les Égouts sont libérés !',
    'L\'Abomination Cosmique est vaincue — l\'Espace est libéré !'];
  ctx.fillText(vicNames[G.campaign] || vicNames[0], W / 2, H / 2 - 128);
  if (G.campaign === 1) {
    ctx.save();
    ctx.shadowColor = 'rgba(129,212,250,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#81d4fa'; ctx.font = 'bold 19px Inter, sans-serif';
    ctx.fillText('❄ COFFRE DÉBLOQUÉ : ULTIME « PLUIE DE GLACE » — choisis-la dans la forge (onglet Héros)', W / 2, H / 2 - 100);
    ctx.restore();
  }
  if (G.campaign === 2) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,112,67,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffab91'; ctx.font = 'bold 19px Inter, sans-serif';
    ctx.fillText('🔥 TRÔNE CONQUIS : ULTIME « TITAN DE FEU » — choisis-la dans la forge (onglet Héros)', W / 2, H / 2 - 100);
    ctx.restore();
  }
  if (G.campaign === 3) {
    ctx.save();
    ctx.shadowColor = 'rgba(174,234,0,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#dce775'; ctx.font = 'bold 19px Inter, sans-serif';
    ctx.fillText('☣ LES ÉGOUTS LIBÉRÉS — la prochaine campagne vous attend', W / 2, H / 2 - 100);
    ctx.restore();
  }
  if (G.campaign === 4) {
    ctx.save();
    ctx.shadowColor = 'rgba(179,157,219,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#e1bee7'; ctx.font = 'bold 19px Inter, sans-serif';
    ctx.fillText('🕳 LES ÉTOILES SAUVEES — la prochaine campagne vous attend', W / 2, H / 2 - 100);
    ctx.restore();
  }

  // carte récapitulative (même style que le game over)
  const loot = runLootRows();
  const cw = 460, ch = 185, cx = W / 2 - cw / 2, cy = H / 2 - 60;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(cx, cy, cw, ch, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.6)'; ctx.lineWidth = 2;
  roundRect(cx, cy, cw, ch, 14); ctx.stroke();
  const rows = [
    ['Vague atteinte', `FINALE (${G.wave})`, '#ff8a65', false],
    ['Niveau', p.level, '#40c4ff', false],
    ['Ennemis vaincus', G.kills, '#69f0ae', false],
    ['Dégâts infligés', Math.floor(G.dmgDealt), '#ffeb3b', false],
    ['Temps de survie', fmtTime(G.runTime), '#9575cd', false],
    ['📦 Matériaux gagnés', `+${loot.mats}`, '#ffd740', false],
    [loot.wmodeLabel, loot.wmodeXp > 0 ? `+${loot.wmodeXp} XP` : '—', '#ce93d8', false],
    [loot.wearLabel, loot.wear > 0 ? `-${loot.wear.toFixed(0)} %` : '—', '#ff8a65', false]
  ];
  ctx.font = '16px Inter, sans-serif';
  rows.forEach((r, i) => {
    const ry = cy + 24 + i * 17;
    ctx.textAlign = 'left'; ctx.fillStyle = '#bdbdbd';
    ctx.fillText(r[0], cx + 34, ry);
    ctx.textAlign = 'right'; ctx.fillStyle = r[2]; ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText(String(r[1]), cx + cw - 34, ry);
    ctx.font = '16px Inter, sans-serif';
  });

  // boutons REJOUER / MENU (même géométrie que le game over)
  // sur la victoire, le bouton devient « MONDE SUIVANT » s'il reste une campagne
  const b = goButtons();
  const hasNext = G.campaign < 4;
  drawMenuButton(b.replay, hasNext ? '▶  MONDE SUIVANT' : '↻  REJOUER',
    hasNext ? '#1565c0' : '#4caf50', hasNext ? '#64b5f6' : '#69f0ae', true);
  drawMenuButton(b.menu, '⌂  MENU', '#455a64', '#90a4ae', false);

  ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 14px Inter, sans-serif';
  ctx.globalAlpha = 0.6 + Math.sin(G.time * 4) * 0.4;
  ctx.fillText(hasNext ? 'R — Monde suivant' : 'R — Rejouer', W / 2, b.replay.y + b.replay.h + 26);
  ctx.globalAlpha = 1;
}

export function drawGameOver() {
  const p = G.player;
  // fond rouge sombre + vignette
  ctx.fillStyle = 'rgba(25,0,0,0.82)'; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, H * 0.8);
  v.addColorStop(0, 'rgba(120,0,0,0)'); v.addColorStop(1, 'rgba(90,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // titre pulsé avec glow
  const pulse = 1 + Math.sin(G.time * 5) * 0.06;
  ctx.save();
  ctx.translate(W / 2, H / 2 - 168);
  ctx.scale(pulse, pulse);
  const tg = ctx.createLinearGradient(-260, 0, 260, 0);
  tg.addColorStop(0, '#ff1744'); tg.addColorStop(0.5, '#ff5252'); tg.addColorStop(1, '#b71c1c');
  ctx.font = 'bold 64px Inter, sans-serif';
  ctx.shadowColor = 'rgba(255,30,30,0.9)'; ctx.shadowBlur = 35;
  ctx.fillStyle = tg;
  ctx.fillText('GAME OVER', 0, 0);
  ctx.restore();

  // filet décoratif
  ctx.strokeStyle = 'rgba(255,82,82,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - 180, H / 2 - 136); ctx.lineTo(W / 2 + 180, H / 2 - 136); ctx.stroke();
  ctx.fillStyle = '#ef9a9a'; ctx.font = 'italic 18px Inter, sans-serif';
  ctx.fillText('Le roi est tombé... mais les Terres Oubliées se souviendront de vous', W / 2, H / 2 - 110);

  // bandeau record : indique si la partie a battu des records
  const lr = G.lastRun || { any: false };
  const cy = H / 2 - 54;
  if (lr.any) {
    const labels = [];
    if (lr.wave) labels.push('VAGUE');
    if (lr.level) labels.push('NIVEAU');
    if (lr.kills) labels.push('ENNEMIS');
    if (lr.damage) labels.push('DÉGÂTS');
    ctx.save();
    ctx.shadowColor = 'rgba(255,215,64,0.9)'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffd740'; ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText(`★  NOUVEAU RECORD : ${labels.join(' · ')}  ★`, W / 2, cy - 12);
    ctx.restore();
  } else {
    ctx.fillStyle = '#78909c'; ctx.font = 'italic 15px Inter, sans-serif';
    ctx.fillText('Aucun record battu cette fois-ci', W / 2, cy - 12);
  }

  // carte récapitulative de la partie
  const loot = runLootRows();
  const cw = 460, ch = 185, cx = W / 2 - cw / 2; // cy déjà déclaré (bandeau record, même valeur)
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(cx, cy, cw, ch, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,82,82,0.5)'; ctx.lineWidth = 2;
  roundRect(cx, cy, cw, ch, 14); ctx.stroke();

  const rows = [
    ['Vague atteinte', G.wave, '#ff7043', lr.wave],
    ['Niveau', p.level, '#40c4ff', lr.level],
    ['Ennemis vaincus', G.kills, '#69f0ae', lr.kills],
    ['Dégâts infligés', Math.floor(G.dmgDealt), '#ffeb3b', lr.damage],
    ['Temps de survie', fmtTime(G.runTime), '#9575cd', false],
    ['📦 Matériaux gagnés', `+${loot.mats}`, '#ffd740', false],
    [loot.wmodeLabel, loot.wmodeXp > 0 ? `+${loot.wmodeXp} XP` : '—', '#ce93d8', false],
    [loot.wearLabel, loot.wear > 0 ? `-${loot.wear.toFixed(0)} %` : '—', '#ff8a65', false]
  ];
  ctx.font = '16px Inter, sans-serif';
  rows.forEach((r, i) => {
    const ry = cy + 24 + i * 17;
    ctx.textAlign = 'left'; ctx.fillStyle = '#bdbdbd';
    ctx.fillText(r[0], cx + 34, ry);
    ctx.textAlign = 'right'; ctx.fillStyle = r[2]; ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText(String(r[1]), cx + cw - 34, ry);
    if (r[3]) {
      ctx.fillStyle = '#ffd740'; ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText('★', cx + cw - 34 - ctx.measureText(String(r[1])).width - 14, ry);
    }
    ctx.font = '16px Inter, sans-serif';
  });

  // boutons REJOUER / MENU
  const b = goButtons();
  drawMenuButton(b.replay, '↻  REJOUER', '#4caf50', '#69f0ae', true);
  drawMenuButton(b.menu, '⌂  MENU', '#455a64', '#90a4ae', false);

  ctx.fillStyle = '#ff8a80'; ctx.font = 'bold 14px Inter, sans-serif';
  ctx.globalAlpha = 0.6 + Math.sin(G.time * 4) * 0.4;
  ctx.fillText('R — Rejouer', W / 2, b.replay.y + b.replay.h + 26);
  ctx.globalAlpha = 1;
}

// ==================== SÉLECTION DES PERSONNAGES ====================
// 3 emplacements : carte remplie = héros existant, carte vide = création
function charCards() {
  const cw = 350, ch = 425, gap = 30, y = 145;
  const total = cw * MAX_SLOTS + gap * (MAX_SLOTS - 1);
  const x0 = W / 2 - total / 2;
  return Array.from({ length: MAX_SLOTS }, (_, i) => ({
    x: x0 + i * (cw + gap), y, w: cw, h: ch,
    play:  { x: x0 + i * (cw + gap) + 30, y: y + ch - 66, w: 92, h: 40 },
    menu:  { x: x0 + i * (cw + gap) + 132, y: y + ch - 66, w: 92, h: 40 },
    reset: { x: x0 + i * (cw + gap) + 234, y: y + ch - 66, w: 86, h: 40 },
    gear: { x: W - 66, y: H - 66, w: 46, h: 46 }
  }));
}

export function charClickAt(x, y) {
  // modale de confirmation de reset prioritaire
  if (G.resetConfirm >= 0) {
    const m = resetModalRect();
    if (inR(m.no, x, y)) { G.resetConfirm = -1; return 'cancel'; }
    if (inR(m.yes, x, y)) {
      const i = G.resetConfirm; G.resetConfirm = -1;
      if (activeSlot() === i) deselectChar();
      resetChar(i); sfxClick(); return 'reset';
    }
    return 'modal';
  }
  // saisie du nom : clic = rien (la validation se fait au clavier)
  if (G.charInput) return 'input';
  const cards = charCards();
  for (let i = 0; i < MAX_SLOTS; i++) {
    const c = cards[i], meta = slotMeta(i);
    if (meta) {
      if (inR(c.play, x, y)) { pickCharacter(i); G.menuView = 'campaign'; G.campaignSel = G.campaign || 0; return 'play'; }
      if (inR(c.menu, x, y)) { pickCharacter(i); G.menuView = 'main'; return 'menu'; }
      if (inR(c.reset, x, y)) { G.resetConfirm = i; return 'askreset'; }
      // clic sur la carte (hors boutons) = sélection → menu principal
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        pickCharacter(i); G.menuView = 'main'; return 'select';
      }
    } else {
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        G.charInput = { slot: i, text: `ma survie ${i + 1}` }; return 'new';
      }
    }
  }
  if (inR(cards[0].gear, x, y)) {
    if (adminUnlocked()) { G.menuView = 'admin'; return 'admin'; }
    G.adminInput = { text: '' }; G.adminPwErr = false; return 'adminpw';
  }
  return null;
}

function resetModalRect() {
  const w = 460, h = 210, x = W / 2 - w / 2, y = H / 2 - h / 2;
  return {
    x, y, w, h,
    yes: { x: W / 2 - 170, y: y + h - 62, w: 150, h: 44 },
    no:  { x: W / 2 + 20,  y: y + h - 62, w: 150, h: 44 }
  };
}

function drawCharacters() {
  ctx.textAlign = 'center';

  // titre
  overlineCentered('SÉLECTION DU PERSONNAGE', W / 2, 48);
  ctx.save();
  ctx.font = `600 38px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = C_TEXT;
  ctx.fillText('CHOISISSEZ VOTRE HÉROS', W / 2, 90);
  ctx.restore();
  ctx.fillStyle = C_MUTED; ctx.font = `14px ${UI}`;
  ctx.fillText(`${MAX_SLOTS} emplacements — chaque héros possède sa propre sauvegarde`, W / 2, 118);

  const cards = charCards();
  for (let i = 0; i < MAX_SLOTS; i++) {
    const c = cards[i], meta = slotMeta(i);
    const hov = inR(c, G.mouse.x, G.mouse.y);
    // carte
    ctx.fillStyle = hov ? 'rgba(22,24,27,0.95)' : 'rgba(15,17,19,0.93)';
    roundRect(c.x, c.y, c.w, c.h, 14); ctx.fill();
    ctx.strokeStyle = hov ? 'rgba(212,176,98,0.6)' : 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    roundRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, 14); ctx.stroke();

    if (!meta) {
      // emplacement vide
      const mx = c.x + c.w / 2, my = c.y + c.h / 2 - 34;
      ctx.strokeStyle = hov ? C_GOLD : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my); ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my + 9); ctx.stroke();
      ctx.fillStyle = hov ? C_TEXT : '#a39d8e';
      ctx.font = `600 17px ${UI}`;
      ctx.fillText('Nouvelle aventure', mx, c.y + c.h / 2 + 22);
      ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
      ctx.fillText('Cliquez pour créer un héros', mx, c.y + c.h / 2 + 46);
      continue;
    }

    const s = slotSummary(i);
    const mx = c.x + c.w / 2;
    // monogramme du héros
    ctx.fillStyle = 'rgba(212,176,98,0.08)';
    ctx.beginPath(); ctx.arc(mx, c.y + 78, 36, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(212,176,98,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = C_GOLD; ctx.font = `600 30px ${SERIF}`;
    ctx.fillText((meta.name.trim()[0] || '?').toUpperCase(), mx, c.y + 89);
    // nom + badge "en cours" si c'est le personnage actif
    ctx.fillStyle = C_TEXT; ctx.font = `600 22px ${UI}`;
    ctx.fillText(fitText(meta.name, c.w - 48), mx, c.y + 150);
    if (activeSlot() === i) {
      ctx.font = `600 10px ${UI}`;
      const bw = 84;
      ctx.fillStyle = 'rgba(105,240,174,0.1)';
      roundRect(mx - bw / 2, c.y + 162, bw, 20, 10); ctx.fill();
      ctx.save(); ctx.letterSpacing = '1.5px';
      ctx.fillStyle = '#7ed9a8'; ctx.fillText('EN COURS', mx + 1, c.y + 176);
      ctx.restore();
    }
    // stats
    const rows = [
      ['Temps de jeu', fmtPlaytime(s.playtime)],
      ['Dernière connexion', fmtDate(s.lastPlayed)],
      ['Meilleure vague', s.bestWave || '—'],
      ['Ennemis vaincus', s.totalKills || '—'],
      ['Niveau max', s.bestLevel || '—'],
      ['Parties jouées', s.totalRuns || '—']
    ];
    rows.forEach((r, j) => {
      const ry = c.y + 214 + j * 25;
      if (j) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(c.x + 30, ry - 17, c.w - 60, 1); }
      ctx.textAlign = 'left'; ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
      ctx.fillText(r[0], c.x + 30, ry);
      ctx.textAlign = 'right'; ctx.font = `600 13px ${UI}`; ctx.fillStyle = C_TEXT;
      ctx.fillText(fitText(String(r[1]), 150), c.x + c.w - 30, ry);
    });
    ctx.textAlign = 'center';
    // boutons JOUER / MENU / RÉINITIALISER
    drawMiniButton(c.play, 'JOUER', C_GOLD, C_GOLD, true);
    drawMiniButton(c.menu, 'MENU', '#90a4ae', '#cfd8dc');
    drawMiniButton(c.reset, 'RESET', '#e57373', '#ef9a9a');
  }

  // entrée admin discrète (engrenage en bas à droite)
  const gear = cards[0].gear, ghov = inR(gear, G.mouse.x, G.mouse.y);
  ctx.fillStyle = ghov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
  roundRect(gear.x, gear.y, gear.w, gear.h, 10); ctx.fill();
  ctx.strokeStyle = ghov ? 'rgba(212,176,98,0.6)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  roundRect(gear.x + 0.5, gear.y + 0.5, gear.w - 1, gear.h - 1, 10); ctx.stroke();
  ctx.fillStyle = ghov ? C_GOLD : '#6f7378'; ctx.font = `20px ${UI}`;
  ctx.fillText('⚙', gear.x + gear.w / 2, gear.y + 30);

  // saisie du nom / modale reset / panneau mot de passe admin par-dessus
  if (G.charInput) drawNameInput();
  if (G.adminInput && !adminUnlocked()) drawAdminPwInput();
  if (G.resetConfirm >= 0) drawResetModal();
}

function overlineCentered(text, x, y, color = C_GOLD) {
  ctx.save(); ctx.textAlign = 'center';
  ctx.font = `600 11px ${UI}`; ctx.letterSpacing = '3px';
  ctx.fillStyle = color; ctx.fillText(text, x + 1.5, y);
  ctx.restore();
}

function drawMiniButton(r, label, c1, c2, primary) {
  const hov = inR(r, G.mouse.x, G.mouse.y);
  ctx.save();
  if (primary) {
    ctx.fillStyle = hexA(c1, hov ? 1 : 0.9);
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  } else {
    ctx.fillStyle = hexA(c1, hov ? 0.16 : 0.06);
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = hexA(c2, hov ? 0.6 : 0.25); ctx.lineWidth = 1;
    roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 8); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.font = `600 12px ${UI}`; ctx.letterSpacing = '1.5px';
  ctx.fillStyle = primary ? (c1 === C_GOLD ? '#16130c' : '#fff') : (hov ? '#fff' : hexA(c2, 0.95));
  ctx.fillText(label, r.x + r.w / 2 + 1, r.y + r.h / 2 + 4.5);
  ctx.restore();
}

function drawNameInput() {
  const inp = G.charInput, meta = slotMeta(inp.slot);
  const w = 480, h = 190, x = W / 2 - w / 2, y = H / 2 - h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8,14,10,0.97)';
  roundRect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2;
  roundRect(x, y, w, h, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd740'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('NOUVEAU HÉROS', W / 2, y + 42);
  ctx.fillStyle = '#a89f7c'; ctx.font = '14px Inter, sans-serif';
  ctx.fillText(`Emplacement ${inp.slot + 1} — tapez un nom (Entrée pour valider)`, W / 2, y + 68);
  // champ texte
  const fx = x + 40, fy = y + 88, fw = w - 80, fh = 44;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(fx, fy, fw, fh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
  roundRect(fx, fy, fw, fh, 8); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Inter, sans-serif';
  const shown = inp.text + (Math.floor(G.time * 2.5) % 2 === 0 ? '|' : ' ');
  ctx.fillText(shown || ' ', fx + 14, fy + 30);
  ctx.textAlign = 'center'; ctx.fillStyle = '#78909c'; ctx.font = '13px Inter, sans-serif';
  ctx.fillText('Échap pour annuler', W / 2, y + h - 18);
}

function drawAdminPwInput() {
  const inp = G.adminInput;
  const w = 440, h = 200, x = W / 2 - w / 2, y = H / 2 - h / 2;
  // tremblement rouge si le dernier mot de passe était incorrect
  const err = G.adminPwErr, shake = err ? Math.sin(G.time * 55) * 5 * Math.max(0, 1 - (G.time - G.adminPwErrT) / 0.6) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(shake, 0);
  ctx.fillStyle = 'rgba(14,8,8,0.97)';
  roundRect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = err ? '#ff1744' : '#ef5350'; ctx.lineWidth = 2;
  roundRect(x, y, w, h, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('⚠ ACCÈS ADMIN', W / 2, y + 44);
  ctx.fillStyle = '#a89f7c'; ctx.font = '14px Inter, sans-serif';
  ctx.fillText('Entrez le mot de passe administrateur', W / 2, y + 70);
  const fx = x + 40, fy = y + 88, fw = w - 80, fh = 40;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(fx, fy, fw, fh, 8); ctx.fill();
  ctx.strokeStyle = err ? '#ff1744' : 'rgba(239,83,80,0.6)'; ctx.lineWidth = 1.5;
  roundRect(fx, fy, fw, fh, 8); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Consolas, monospace';
  const dots = '•'.repeat(inp.text.length) + (Math.floor(G.time * 2.5) % 2 === 0 ? '|' : ' ');
  ctx.fillText(dots || ' ', fx + 14, fy + 28);
  if (err) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#ff5252'; ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('✕ MOT DE PASSE INCORRECT', W / 2, y + h - 42);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#78909c'; ctx.font = '13px Inter, sans-serif';
  ctx.fillText('Échap pour annuler', W / 2, y + h - 16);
  ctx.restore();
}

function drawResetModal() {
  const i = G.resetConfirm, meta = slotMeta(i);
  const m = resetModalRect();
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(16,6,6,0.97)';
  roundRect(m.x, m.y, m.w, m.h, 14); ctx.fill();
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 2;
  roundRect(m.x, m.y, m.w, m.h, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('RÉINITIALISER LE HÉROS ?', W / 2, m.y + 48);
  ctx.fillStyle = '#e0e0e0'; ctx.font = '15px Inter, sans-serif';
  ctx.fillText(`« ${meta ? meta.name : ''} » — toutes ses données seront`, W / 2, m.y + 82);
  ctx.fillText('définitivement effacées (inventaire, succès, mondes, stats).', W / 2, m.y + 106);
  ctx.fillStyle = '#ffb74d'; ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText('Cette action est irréversible.', W / 2, m.y + 132);
  drawMiniButton(m.no, 'ANNULER', '#455a64', '#90a4ae');
  drawMiniButton(m.yes, 'CONFIRMER', '#c62828', '#ef9a9a', true);
}

// ==================== PANNEAU ADMIN ====================
export function adminClickAt(x, y) {
  if (!adminUnlocked()) {
    if (G.adminInput) return 'input';
    return null;
  }
  const back = { x: 30, y: H - 60, w: 160, h: 40 };
  if (inR(back, x, y)) { G.menuView = 'characters'; return 'back'; }
  const wipe = { x: W - 260, y: H - 60, w: 230, h: 40 };
  if (inR(wipe, x, y)) {
    if (G.resetConfirm === 99) { adminWipeAll(); G.resetConfirm = -1; return 'wipe'; }
    G.resetConfirm = 99; return 'askwipe';
  }
  // reset individuel d'un slot
  for (let i = 0; i < MAX_SLOTS; i++) {
    const r = { x: W / 2 - 330, y: 330 + i * 78, w: 120, h: 36 };
    if (slotMeta(i) && inR(r, x, y)) {
      if (G.resetConfirm === i) { resetChar(i); G.resetConfirm = -1; return 'reset'; }
      G.resetConfirm = i; return 'askreset';
    }
  }
  if (G.resetConfirm >= 0) G.resetConfirm = -1; // clic ailleurs = annule la confirmation
  return null;
}

function drawAdmin() {
  ctx.fillStyle = 'rgba(8,4,4,0.96)'; ctx.fillRect(0, 0, W, H);
  // l'animation du cadenas joue D'ABORD : le panneau s'ouvre une fois terminée
  if (adminUnlocked()) {
    const at = G.time - G.adminUnlockT;
    if (at >= 0 && at < 1.4) { drawPadlockAnim(); return; }
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = '600 36px Inter, sans-serif';
  ctx.fillText('⚠ PANNEAU ADMIN', W / 2, 70);
  ctx.fillStyle = '#a89f7c'; ctx.font = '15px Inter, sans-serif';
  ctx.fillText('Gestion locale des personnages — données stockées sur cet appareil', W / 2, 100);

  if (!adminUnlocked()) {
    if (G.adminInput) drawAdminPwInput();
    return;
  }

  // en-tête du tableau
  ctx.textAlign = 'left'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.fillStyle = '#78909c';
  const cols = [60, 240, 200, 160, 140, 120];
  const heads = ['#', 'HÉROS', 'TEMPS DE JEU', 'DERNIÈRE CONNEXION', 'RECORDS', ''];
  let cx = W / 2 - 480;
  heads.forEach((h, i) => { ctx.fillText(h, cx, 145); cx += cols[i]; });
  ctx.strokeStyle = 'rgba(239,83,80,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 480, 155); ctx.lineTo(W / 2 + 480, 155); ctx.stroke();

  for (let i = 0; i < MAX_SLOTS; i++) {
    const meta = slotMeta(i), s = slotSummary(i);
    const ry = 195 + i * 78;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
    roundRect(W / 2 - 490, ry - 26, 980, 70, 8); ctx.fill();
    cx = W / 2 - 480;
    ctx.font = 'bold 16px Consolas, monospace'; ctx.fillStyle = '#90a4ae';
    ctx.fillText(String(i + 1), cx, ry + 6); cx += cols[0];
    if (!meta) {
      ctx.font = '16px Inter, sans-serif'; ctx.fillStyle = '#546e7a';
      ctx.fillText('— emplacement vide —', cx, ry + 6);
      continue;
    }
    ctx.font = 'bold 17px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
    ctx.fillText(meta.name, cx, ry + 6); cx += cols[1];
    ctx.font = '15px Inter, sans-serif'; ctx.fillStyle = '#e0e0e0';
    ctx.fillText(fmtPlaytime(s.playtime), cx, ry + 6); cx += cols[2];
    ctx.fillStyle = '#a89f7c';
    ctx.fillText(fmtDate(s.lastPlayed), cx, ry + 6); cx += cols[3];
    ctx.fillStyle = '#80cbc4';
    ctx.fillText(`Vague ${s.bestWave || 0} · ${s.totalKills || 0} kills`, cx, ry + 6); cx += cols[4];
    // bouton reset
    const confirming = G.resetConfirm === i;
    const rb = { x: cx, y: ry - 20, w: confirming ? 170 : 120, h: 36 };
    const hov = G.mouse.x >= rb.x && G.mouse.x <= rb.x + rb.w && G.mouse.y >= rb.y && G.mouse.y <= rb.y + rb.h;
    ctx.fillStyle = confirming ? 'rgba(183,28,28,0.85)' : (hov ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.15)');
    roundRect(rb.x, rb.y, rb.w, rb.h, 8); ctx.fill();
    ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1.5; roundRect(rb.x, rb.y, rb.w, rb.h, 8); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(confirming ? '⚠ CONFIRMER ?' : '🗑 RÉINITIALISER', rb.x + rb.w / 2, rb.y + 24);
  }

  // total + boutons
  const total = slots_playtime_total();
  ctx.textAlign = 'center'; ctx.fillStyle = '#78909c'; ctx.font = '14px Inter, sans-serif';
  ctx.fillText(`Temps de jeu cumulé sur l'appareil : ${fmtPlaytime(total)}`, W / 2, 500);

  // confirmation wipe global
  const wipe = { x: W - 260, y: H - 60, w: 230, h: 40 };
  const wipeConfirm = G.resetConfirm === 99;
  const whov = G.mouse.x >= wipe.x && G.mouse.x <= wipe.x + wipe.w && G.mouse.y >= wipe.y && G.mouse.y <= wipe.y + wipe.h;
  ctx.fillStyle = wipeConfirm ? 'rgba(183,28,28,0.9)' : (whov ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.15)');
  roundRect(wipe.x, wipe.y, wipe.w, wipe.h, 8); ctx.fill();
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1.5; roundRect(wipe.x, wipe.y, wipe.w, wipe.h, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText(wipeConfirm ? '⚠ TOUT EFFACER ?' : '☠ TOUT EFFACER', wipe.x + wipe.w / 2, wipe.y + 26);

  const back = { x: 30, y: H - 60, w: 160, h: 40 };
  const bhov = G.mouse.x >= back.x && G.mouse.x <= back.x + back.w && G.mouse.y >= back.y && G.mouse.y <= back.y + back.h;
  ctx.fillStyle = bhov ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)';
  roundRect(back.x, back.y, back.w, back.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; roundRect(back.x, back.y, back.w, back.h, 8); ctx.stroke();
  ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText('← PERSONNAGES', back.x + back.w / 2, back.y + 26);
  drawPadlockAnim(); // cadenas qui s'ouvre si le mot de passe vient d'être validé
}
function slots_playtime_total() {
  let t = 0;
  for (let i = 0; i < MAX_SLOTS; i++) { const m = slotMeta(i); if (m) t += m.playtime; }
  return t;
}

// ==================== MENU DE TRICHE ADMIN (EN JEU) ====================
// Accessible uniquement si le mot de passe admin a été validé (adminOK).
// Le jeu est mis en pause tant qu'il est ouvert (voir main.js).

const ADMIN_BASE = [
  // [id, label, catégorie]
  ['xp',        '⭐ +2 000 XP',        'ress'],
  ['level',     '🌟 +3 NIVEAUX',       'ress'],
  ['hp',        '❤️ PV COMPLETS',      'ress'],
  ['maxhp',     '❤️ +25 PV MAX',       'ress'],
  ['ult',       '☢️ ULTIME 100 %',      'ress'],
  ['potions',   '🧪 +10 FIOLES',       'ress'],
  ['god',       '😇 INVINCIBLE',       'ress'],
  ['wave',      '🏰 +1 VAGUE',         'monde'],
  ['skip',      '⏩ PASSER LA VAGUE',   'monde'],
  ['killall',   '💀 TOUT TUER',        'monde'],
  ['relock',    '🔒 REVERROUILLER',    'monde'],
];
// apparitions adaptées à la campagne en cours
const SPAWN_C0 = [
  ['spawn_slime',   '🟢 Slime',        'spawn'],
  ['spawn_bat',     '🟣 Chauve-souris','spawn'],
  ['spawn_spider',  '🕷️ Araignée',     'spawn'],
  ['spawn_witch',   '🧙 Sorcière',     'spawn'],
  ['spawn_brute',   '🟠 Brute',        'spawn'],
  ['spawn_golem',   '🪨 Golem',        'spawn'],
  ['spawn_boss',    '👹 BOSS',         'spawn'],
  ['spawn_final',   '👑 BOSS FINAL',   'spawn']
];
const SPAWN_C1 = [
  ['spawn_yeti',    '🐺 Yéti',               'spawn'],
  ['spawn_hunter',  '🏹 Chasseur Gelé',       'spawn'],
  ['spawn_crypt',   '👾 Créature des Grottes','spawn'],
  ['spawn_glacier', '🧊 Géant des Glaces',    'spawn'],
  ['spawn_alpha',   '👹 Alpha des Neiges',    'spawn'],
  ['spawn_bossglace','❄️ Boss de Glace',     'spawn'],
  ['spawn_bosscryo','🧊 Souveraine Cryo',     'spawn'],
  ['spawn_final',   '☄️ SOUVERAIN DE GLACE',  'spawn']
];
const SPAWN_C2 = [
  ['spawn_imp',      '😈 Diablotin',          'spawn'],
  ['spawn_hound',    '🐺 Mastiff des Enfers', 'spawn'],
  ['spawn_cultist',  '🕯️ Acolyte',           'spawn'],
  ['spawn_demon',    '👿 Démon',              'spawn'],
  ['spawn_golem_enf','🌋 Golem de Braise',    'spawn'],
  ['spawn_boss_enf', '😈 Démon Seigneur',     'spawn'],
  ['spawn_priest',   '🧛 Prêtre des Enfers',  'spawn'],
  ['spawn_final',    '🔥 LE BARON DE L\'ENFER','spawn']
];
const SPAWN_C3 = [
  ['spawn_rat',      '🐀 Rat Géant',          'spawn'],
  ['spawn_crapaud',  '🐸 Crapaud',            'spawn'],
  ['spawn_ver',      '🪱 Ver des Profondeurs','spawn'],
  ['spawn_vase',     '🫙 Vase Toxique',       'spawn'],
  ['spawn_chanter',  '🎵 Chanteur',           'spawn'],
  ['spawn_matr',     '👑 Matriarche',         'spawn'],
  ['spawn_bossegout','👑 Roi des Rats',       'spawn'],
  ['spawn_final',    '☣️ LE TYRAN DES PROFONDEURS','spawn']
];
const SPAWN_C4 = [
  ['spawn_alien',    '👽 Alien Rampant',      'spawn'],
  ['spawn_drone',    '🛸 Drone de Chasse',    'spawn'],
  ['spawn_tentacule','🦑 Tentacule',          'spawn'],
  ['spawn_cristal',  '💎 Cristal Vivant',     'spawn'],
  ['spawn_overlord', '👑 Dominator',          'spawn'],
  ['spawn_bossvoid', '🛸 Seigneur Stellaire', 'spawn'],
  ['spawn_bossv2',   '👾 Overlord',           'spawn'],
  ['spawn_final',    '🕳️ L\'ABOMINATION COSMIQUE','spawn']
];
function adminCheats() {
  return [...ADMIN_BASE, ...(G.campaign === 4 ? SPAWN_C4 : G.campaign === 3 ? SPAWN_C3 : G.campaign === 2 ? SPAWN_C2 : G.campaign === 1 ? SPAWN_C1 : SPAWN_C0)];
}
const SPAWN_TYPES = {
  spawn_slime: 'slime', spawn_bat: 'bat', spawn_spider: 'spider',
  spawn_witch: 'witch', spawn_brute: 'brute', spawn_golem: 'golem',
  spawn_yeti: 'yeti', spawn_hunter: 'hunter', spawn_crypt: 'crypt',
  spawn_glacier: 'glacier', spawn_alpha: 'alpha',
  spawn_bossglace: 'bossGlace', spawn_bosscryo: 'bossCryo',
  spawn_imp: 'imp', spawn_hound: 'hound', spawn_cultist: 'cultist',
  spawn_demon: 'demon', spawn_golem_enf: 'golemEnf',
  spawn_boss_enf: 'bossEnf', spawn_priest: 'priest',
  spawn_rat: 'rat', spawn_crapaud: 'crapaud', spawn_ver: 'ver',
  spawn_vase: 'vase', spawn_chanter: 'chanter', spawn_matr: 'matriarche',
  spawn_bossegout: 'bossEgout',
  spawn_alien: 'alien', spawn_drone: 'drone', spawn_tentacule: 'tentacule',
  spawn_cristal: 'cristal', spawn_overlord: 'overlord',
  spawn_bossvoid: 'bossVoid', spawn_bossv2: 'overlord'
};

function adminCheatRects() {
  // panneau centré : 3 colonnes de catégories
  const pw = 620, ph = 500, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
  const cheats = adminCheats();
  const cats = ['ress', 'monde', 'spawn'];
  const cols = cats.map((c, i) => ({ cat: c, x: px + 20 + i * ((pw - 40) / 3), w: (pw - 40) / 3 - 12 }));
  const btns = {};
  for (const c of cheats) {
    const col = cols.find(cc => cc.cat === (c[2] === 'ress' ? 'ress' : c[2] === 'monde' ? 'monde' : 'spawn'));
    const idx = cheats.filter(o => o[2] === c[2]).indexOf(c);
    const rowH = 40, top = py + 66;
    btns[c[0]] = { x: col.x + 6, y: top + idx * (rowH + 8), w: col.w - 12, h: rowH };
  }
  return { px, py, pw, ph, btns, close: { x: px + pw - 44, y: py + 10, w: 32, h: 32 } };
}

export function adminMenuClickAt(x, y) {
  const L = adminCheatRects();
  if (inR(L.close, x, y)) { G.adminMenu = false; return 'close'; }
  for (const c of adminCheats()) {
    if (inR(L.btns[c[0]], x, y)) { applyAdminCheat(c[0]); return c[0]; }
  }
  return 'inside';
}

function applyAdminCheat(id) {
  const p = G.player;
  switch (id) {
    case 'xp': gainXp(2000); break;
    case 'level': for (let i = 0; i < 3; i++) gainXp(p.xpNext); break;
    case 'hp': p.hp = p.maxHp; break;
    case 'maxhp': p.maxHp += 25; p.hp = p.maxHp; break;
    case 'ult': p.ultCharge = 100; break;
    case 'potions': p.potions = p.maxPotions; break;
    case 'god': G.godMode = !G.godMode; break;
    case 'wave':
      if (G.wave >= finalWave()) break; // pas au-delà de la vague finale
      G.wave++;
      G.waveKills = 0;
      G.waveTarget = 6 + G.wave * 2;
      G.wavePause = 2.5;
      break;
    case 'skip':
      // complète le quota de la vague en cours -> transition immédiate
      // (impossible à la vague finale : le boss doit être vaincu)
      if (G.wave < finalWave()) G.waveKills = G.waveTarget;
      break;
    case 'killall':
      for (const e of [...G.enemies]) { e.hp = 0; }
      break;
    case 'relock':
      adminLock(); // le mot de passe sera redemandé à la prochaine ouverture
      G.adminMenu = false;
      break;
    default:
      if (SPAWN_TYPES[id]) {
        for (let i = 0; i < 3; i++) spawnEnemy(SPAWN_TYPES[id]);
      } else if (id === 'spawn_boss') {
        spawnEnemy(G.campaign === 4 ? 'bossVoid' : G.campaign === 3 ? 'bossEgout' : G.campaign === 2 ? 'bossEnf' : G.campaign === 1 ? 'bossGlace' : 'boss'); // boss adapté à la campagne
      } else if (id === 'spawn_final') {
        spawnFinalBoss(); // le vrai boss final de la campagne
      }
  }
}

// ---------- bouton admin 🛠 (tout en haut à droite) ----------
export const ADMIN_BTN = { x: W - 96, y: 8, w: 88, h: 34 };
export function adminButtonAt(x, y) {
  const r = ADMIN_BTN;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
export function drawAdminButton() {
  const r = ADMIN_BTN;
  const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w &&
              G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
  const unlocked = adminUnlocked();
  ctx.save();
  ctx.fillStyle = G.adminMenu ? 'rgba(120,20,20,0.95)' : (unlocked ? (hov ? 'rgba(90,20,20,0.95)' : 'rgba(60,14,14,0.9)') : 'rgba(30,30,34,0.85)');
  ctx.strokeStyle = unlocked ? '#ef5350' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = (hov || G.adminMenu) ? 3 : 2;
  ctx.shadowColor = unlocked ? 'rgba(239,83,80,0.8)' : 'transparent';
  ctx.shadowBlur = hov ? 18 : 8;
  const rad = 10;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + rad);
  ctx.quadraticCurveTo(r.x, r.y, r.x + rad, r.y);
  ctx.lineTo(r.x + r.w - rad, r.y);
  ctx.quadraticCurveTo(r.x + r.w, r.y, r.x + r.w, r.y + rad);
  ctx.lineTo(r.x + r.w, r.y + r.h - rad);
  ctx.quadraticCurveTo(r.x + r.w, r.y + r.h, r.x + r.w - rad, r.y + r.h);
  ctx.lineTo(r.x + rad, r.y + r.h);
  ctx.quadraticCurveTo(r.x, r.y + r.h, r.x, r.y + r.h - rad);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.font = unlocked ? 'bold 15px Inter, sans-serif' : 'bold 12px Inter, sans-serif';
  ctx.fillStyle = unlocked ? '#ffcdd2' : '#78909c';
  ctx.fillText(unlocked ? '🛠 ADMIN' : '🔒 ADMIN', r.x + r.w / 2, r.y + r.h / 2 + 5);
  ctx.restore();
}

// animation du cadenas qui s'ouvre après un bon mot de passe admin (~1,4 s)
function drawPadlockAnim() {
  const t = G.time - G.adminUnlockT;
  if (t < 0 || t > 1.4) return;
  const cx = W / 2, cy = H / 2 - 60;
  const open = Math.min(1, t / 0.7);          // 0 -> 1 : le pêne se soulève
  const fade = t > 1.0 ? (1.4 - t) / 0.4 : 1; // fondu final
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(cx, cy);
  // halo
  const hg = ctx.createRadialGradient(0, 0, 10, 0, 0, 130);
  hg.addColorStop(0, `rgba(255,215,64,${0.35 * fade})`); hg.addColorStop(1, 'rgba(255,215,64,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, 0, 130, 0, TAU); ctx.fill();
  // anse (pêne) : pivote et se soulève
  ctx.save();
  ctx.translate(-16, -8);
  ctx.rotate(-open * 0.9);
  ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(16, -14, 16, Math.PI, 0); ctx.stroke();
  ctx.restore();
  // corps du cadenas
  ctx.fillStyle = '#ffd740';
  roundRect(-26, -8, 52, 44, 8); ctx.fill();
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2;
  roundRect(-26, -8, 52, 44, 8); ctx.stroke();
  // trou de serrure + reflet
  ctx.fillStyle = '#3e2723';
  ctx.beginPath(); ctx.arc(0, 8, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(-9, -2, 4, 0, TAU); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.shadowColor = 'rgba(255,215,64,0.9)'; ctx.shadowBlur = 16;
  ctx.fillText('🔓 ACCÈS AUTORISÉ', 0, 62);
  ctx.restore();
}

export function drawAdminMenu() {
  // saisie du mot de passe admin en jeu : prompt par-dessus le jeu (en pause)
  if (G.adminInput) { drawAdminPwInput(); return; }
  if (!G.adminMenu) return;
  // l'animation du cadenas joue D'ABORD : le panneau de triche s'ouvre après
  const at = G.time - G.adminUnlockT;
  if (at >= 0 && at < 1.4) { drawPadlockAnim(); return; }
  const L = adminCheatRects();
  // voile sombre mais transparent (le jeu est en pause derrière)
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(12,6,6,0.97)';
  roundRect(L.px, L.py, L.pw, L.ph, 14); ctx.fill();
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(239,83,80,0.5)'; ctx.shadowBlur = 16;
  roundRect(L.px, L.py, L.pw, L.ph, 14); ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('🛠 MENU ADMIN', W / 2, L.py + 36);
  ctx.fillStyle = '#78909c'; ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`Triche — ${G.campaign === 4 ? 'L\'ESPACE 🛸' : G.campaign === 3 ? 'LES ÉGOUTS 🗑️' : G.campaign === 2 ? 'LES ENFERS 🔥' : G.campaign === 1 ? 'LA TERRE GELÉE ❄️' : 'LES TERRES OUBLIÉES 🌿'} • jeu en pause • \` pour fermer`, W / 2, L.py + 56);

  // titres de colonnes (le premier bouton 'spawn' varie selon la campagne)
  const catTitles = { ress: '⚡ RESSOURCES', monde: '🌍 MONDE', spawn: '👾 APPARAÎTRE' };
  const firstSpawn = adminCheats().find(c => c[2] === 'spawn')[0];
  const colX = [L.btns.xp.x - 6, L.btns.wave.x - 6, L.btns[firstSpawn].x - 6];
  const colW = [L.btns.xp.w + 12, L.btns.wave.w + 12, L.btns[firstSpawn].w + 12];
  ['ress', 'monde', 'spawn'].forEach((c, i) => {
    ctx.fillStyle = '#ffd740'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(catTitles[c], colX[i] + colW[i] / 2, L.py + 84);
    ctx.strokeStyle = 'rgba(255,215,64,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(colX[i], L.py + 92); ctx.lineTo(colX[i] + colW[i], L.py + 92); ctx.stroke();
  });

  // boutons
  for (const c of adminCheats()) {
    const r = L.btns[c[0]];
    const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w && G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
    const active = (c[0] === 'god' && G.godMode);
    ctx.fillStyle = active ? 'rgba(76,175,80,0.55)' : (hov ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.14)');
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = active ? '#81c784' : (hov ? '#ff8a80' : 'rgba(239,83,80,0.5)');
    ctx.lineWidth = hov ? 2 : 1.2;
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.fillStyle = active ? '#c8e6c9' : '#fff';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(c[1] + (active ? ' ✓' : ''), r.x + r.w / 2, r.y + r.h / 2 + 5);
  }

  // bouton fermer
  const cl = L.close, chov = G.mouse.x >= cl.x && G.mouse.x <= cl.x + cl.w && G.mouse.y >= cl.y && G.mouse.y <= cl.y + cl.h;
  ctx.fillStyle = chov ? 'rgba(239,83,80,0.8)' : 'rgba(239,83,80,0.3)';
  roundRect(cl.x, cl.y, cl.w, cl.h, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillText('✕', cl.x + cl.w / 2, cl.y + 23);
  drawPadlockAnim(); // cadenas qui s'ouvre si le mot de passe vient d'être validé
}

// ==================== SÉLECTION DE CAMPAGNE (v2.0.0) ====================
// Grande carte : deux campagnes reliées par un chemin. La campagne 2
// (The Frozen Land) se débloque après avoir vaincu le boss final de la 1.

export function campaignUnlocked(c) {
  if (c === 0) return true;
  // chaque campagne se débloque en terminant la précédente
  return !!(G.stats.campaignDone && G.stats.campaignDone[c - 1]);
}

const CAMPAIGN_INFO = {
  0: {
    icon: '🌿', diff: '★ NORMAL', diffColor: '#69f0ae',
    desc: 'Les Terres Oubliées : plaines verdoyantes, ruines anciennes et la sombre tanière du Seigneur Oublié. Vainquez-le pour découvrir ce qui se cache au-delà.',
    boss: 'Seigneur Oublié', worlds: '2 mondes · 20 vagues'
  },
  1: {
    icon: '🏰', diff: '★★ MOYEN', diffColor: '#ffd740',
    desc: 'La Terre Gelée : une étendue enneigée hostile. Prédateurs des neiges, géants de glace, créatures des grottes et tempêtes mortelles. Le Souverain de Glace vous attend au sommet — et un coffre vous attend après lui.',
    boss: 'Souverain de Glace', worlds: '2 mondes · 25 vagues · boss exclusifs'
  },
  2: {
    icon: '🔥', diff: '★★★ DIFFICILE', diffColor: '#ff7043',
    desc: 'Les Enfers : un royaume de braise et de damnation. Diablotins, mâtifs enragés, acolytes, démons et golems de lave. Le Baron de l\'Enfer vous attend sur son trône de cendres — et un pouvoir infernal vous attend après lui.',
    boss: 'Le Baron de l\'Enfer', worlds: '2 mondes · 30 vagues · boss dès la vague 20'
  },
  3: {
    icon: '🗑️', diff: '★★★★ TRÈS DIFFICILE', diffColor: '#aeea00',
    desc: 'Les Égouts : les profondeurs putrides sous la ville. Rats géants, crapauds, vers des profondeurs, vases toxiques et chanters démoniaques. Le Tyran des Profondeurs règne sur les flots d\'acide.',
    boss: 'Le Tyran des Profondeurs', worlds: '2 mondes · 35 vagues · boss dès la vague 25'
  },
  4: {
    icon: '🛸', diff: '★★★★★ EXPERT', diffColor: '#b388ff',
    desc: 'L\'Espace : un avant-poste perdu à des années-lumière de la Terre. Aliens rampants, drones de chasse, tentacules stellaires et cristaux vivants. L\'Abomination Cosmique dévore les étoiles.',
    boss: 'L\'Abomination Cosmique', worlds: '2 mondes · 40 vagues · boss dès la vague 30'
  }
};

const CAMP_NAMES = ['LES TERRES OUBLIÉES', 'LA TERRE GELÉE', 'LES ENFERS', 'LES ÉGOUTS', 'L\'ESPACE'];
const CAMP_COLORS = ['76,175,80', '79,195,247', '255,87,34', '174,234,0', '179,157,219'];
const CAMP_TINTS = ['#1b3a24', '#123047', '#3a1408', '#1a2e00', '#170a2e'];
const CAMP_TEXT = ['#a5d6a7', '#b3e5fc', '#ffab91', '#dce775', '#e1bee7'];

function campaignNodes() {
  // 5 campagnes en zigzag : la carte s'élargit vers la droite
  return {
    0: { x: W / 2 - 520, y: 280, r: 58 },
    1: { x: W / 2 - 260, y: 205, r: 58 },
    2: { x: W / 2,      y: 280, r: 58 },
    3: { x: W / 2 + 260, y: 205, r: 58 },
    4: { x: W / 2 + 520, y: 280, r: 58 }
  };
}
// fiche détaillée + bouton jouer (géométrie partagée dessin / clic)
function campaignFiche() { return { x: W / 2 - 360, y: H / 2 + 92, w: 720, h: 148 }; }
function campaignPlayBtn() {
  const f = campaignFiche();
  return { x: f.x + f.w - 236, y: f.y + 52, w: 212, h: 44 };
}

export function campaignClickAt(x, y) {
  const N = campaignNodes();
  const back = { x: 30, y: H - 60, w: 160, h: 40 };
  if (inR(back, x, y)) { G.menuView = 'main'; return 'back'; }
  const play = campaignPlayBtn();
  if (inR(play, x, y)) {
    const c = G.campaignSel;
    if (c !== null && c !== undefined && campaignUnlocked(c)) {
      G.campaign = c;
      startGame(); // lance directement (popup durabilité possible par-dessus)
      return 'play';
    }
    return 'locked';
  }
  for (const c of [0, 1, 2, 3, 4]) {
    const n = N[c];
    if (Math.hypot(x - n.x, y - n.y) < n.r + 26) { G.campaignSel = c; return 'select'; }
  }
  return null;
}

function wrapText(text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); line = w; yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawCampaign() {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a1a12'); bg.addColorStop(0.5, '#081420'); bg.addColorStop(1, '#040a14');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd740'; ctx.font = '600 44px Inter, sans-serif';
  ctx.shadowColor = 'rgba(255,215,64,0.4)'; ctx.shadowBlur = 18;
  ctx.fillText('🗺️  CAMPAGNES', W / 2, 74);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#a89f7c'; ctx.font = 'italic 15px Inter, sans-serif';
  ctx.fillText('Choisissez votre terrain de chasse — chaque campagne a ses mondes, ses monstres et son boss', W / 2, 104);

  const N = campaignNodes();
  const sel = G.campaignSel === undefined ? null : G.campaignSel;

  // chemin pointillé animé reliant les cinq îles en chaîne
  const seg = (a, b) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 55;
    ctx.save();
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = -G.time * 30;
    ctx.strokeStyle = 'rgba(255,215,64,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
    ctx.restore();
    return { mx, my };
  };
  for (let i = 0; i < 4; i++) {
    const s = seg(N[i], N[i + 1]);
    if (campaignUnlocked(i + 1)) {
      ctx.fillStyle = '#ffd740'; ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText('✓', s.mx, s.my + 8);
    }
  }

  for (const c of [0, 1, 2, 3, 4]) {
    const n = N[c], info = CAMPAIGN_INFO[c], unlocked = campaignUnlocked(c);
    const isSel = sel === c;
    const hc = CAMP_COLORS[c];
    const hg = ctx.createRadialGradient(n.x, n.y, n.r * 0.4, n.x, n.y, n.r * 1.5);
    hg.addColorStop(0, `rgba(${hc},${isSel ? 0.4 : 0.18})`); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = unlocked ? CAMP_TINTS[c] : '#1a1a1e';
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = isSel ? '#ffd740' : (unlocked ? `rgba(${hc},0.7)` : 'rgba(255,255,255,0.15)');
    ctx.lineWidth = isSel ? 4 : 2;
    ctx.stroke();
    ctx.font = `${n.r * 0.6}px serif`;
    ctx.globalAlpha = unlocked ? 1 : 0.35;
    ctx.fillText(info.icon, n.x, n.y + n.r * 0.22);
    ctx.globalAlpha = 1;
    if (!unlocked) {
      ctx.font = '34px serif';
      ctx.fillText('🔒', n.x, n.y - n.r * 0.55);
      ctx.fillStyle = '#78909c'; ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(`TERMINER LA CAMPAGNE ${c}`, n.x, n.y + n.r + 22);
    }
    ctx.fillStyle = unlocked ? '#fff' : '#546e7a'; ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText(CAMP_NAMES[c], n.x, n.y - n.r - 14);
    ctx.fillStyle = unlocked ? info.diffColor : '#455a64'; ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(info.diff, n.x, n.y + n.r + (unlocked ? 40 : 42));
    if (isSel) {
      ctx.fillStyle = '#ffd740'; ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('▼ sélectionnée', n.x, n.y + n.r + 58);
    }
  }

  // fiche détaillée
  const c = sel === null ? 0 : sel;
  const info = CAMPAIGN_INFO[c], unlocked = campaignUnlocked(c);
  const f = campaignFiche();
  const fx = f.x, fy = f.y, fw = f.w, fh = f.h;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(fx, fy, fw, fh, 14); ctx.fill();
  ctx.strokeStyle = `rgba(${CAMP_COLORS[c]},0.6)`; ctx.lineWidth = 2;
  roundRect(fx, fy, fw, fh, 14); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = CAMP_TEXT[c]; ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillText(`${info.icon}  ${CAMP_NAMES[c]}`, fx + 26, fy + 34);
  ctx.fillStyle = info.diffColor; ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText(info.diff, fx + fw - 26 - ctx.measureText(info.diff).width, fy + 32);
  ctx.fillStyle = '#cfd8dc'; ctx.font = '14px Inter, sans-serif';
  wrapText(info.desc, fx + 26, fy + 62, fw - 320, 18);
  ctx.fillStyle = '#78909c'; ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`Boss final : ${info.boss}  ·  ${info.worlds}`, fx + 26, fy + fh - 14);

  const pb = campaignPlayBtn();
  ctx.save();
  if (!unlocked) ctx.globalAlpha = 0.55;
  ctx.fillStyle = unlocked ? 'rgba(76,175,80,0.85)' : 'rgba(80,80,80,0.6)';
  roundRect(pb.x, pb.y, pb.w, pb.h, 10); ctx.fill();
  ctx.strokeStyle = unlocked ? '#81c784' : '#546e7a'; ctx.lineWidth = 2;
  roundRect(pb.x, pb.y, pb.w, pb.h, 10); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(unlocked ? `▶  JOUER — CAMPAGNE ${c + 1}` : '🔒  CAMPAGNE VERROUILLÉE', pb.x + pb.w / 2, pb.y + 28);
  ctx.restore();
  const back = { x: 30, y: H - 60, w: 160, h: 40 };
  const bhov = inR(back, G.mouse.x, G.mouse.y);
  ctx.fillStyle = bhov ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)';
  roundRect(back.x, back.y, back.w, back.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
  roundRect(back.x, back.y, back.w, back.h, 8); ctx.stroke();
  ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('← MENU', back.x + back.w / 2, back.y + 26);
}
