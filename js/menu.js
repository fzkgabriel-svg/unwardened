import { G, ctx, W, H, TAU, saveStats, finalWave } from './state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from './utils.js';
import { regenerateDecor } from './graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from './achievements.js';
import { ITEMS, MATS, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave } from './inventory.js';
import { spawnEnemy, spawnFinalBoss } from './enemies.js';
import { gainXp } from './player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart } from './world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm, sfxClick } from './audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from './chars.js';
import { inR, fitText, wrapLines, hexA, fmtTime, overline, panel, overlineCentered, drawMenuButton, drawAdminPwInput, menuButtons, menuButtonAt, adminUnlocked, campaignUnlocked, forgeUnlocked, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, MENU_X, MENU_W, MENU_ITEMS } from './menu/common.js';
import { drawAchievementsCard } from './menu/achv.js';
import { drawForgeView } from './menu/forge.js';
import { drawCharacters } from './menu/heros.js';
import { drawAdmin } from './menu/admin.js';
import { drawCampaign } from './menu/campaign.js';
import { drawModulesView } from './menu/modules.js';
import { drawQuestsView } from './menu/quests.js';
import { questsClaimable } from './quests.js';
import { modulesUnlocked } from './modules.js';
import { drawAccountCard, drawLeaderboardCard, openLeaderboard, acctClick, acctKey, lbClickAt, lbKey } from './menu/online.js';

// ré-exporte toute l'API publique des sous-modules (contrat inchangé pour input.js / main.js / tutorial.js)
export * from './menu/common.js';
export * from './menu/flow.js';
export * from './menu/forge.js';
export * from './menu/achv.js';
export * from './menu/heros.js';
export * from './menu/end.js';
export * from './menu/admin.js';
export * from './menu/campaign.js';
export * from './menu/modules.js';
export * from './menu/quests.js';
export * from './menu/online.js';

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
  if (G.menuView === 'modules') {
    drawModulesView();
    return;
  }
  if (G.menuView === 'quests') {
    drawQuestsView();
    return;
  }
  if (G.menuView === 'account') {
    drawAccountCard();
    return;
  }
  if (G.menuView === 'leaderboard') {
    drawLeaderboardCard();
    return;
  }

  // ==== colonne gauche : titre + navigation ====
  ctx.textAlign = 'left';
  overline('UN RPG 2D DE SURVIE', MENU_X, 118);
  ctx.save();
  ctx.font = `600 52px ${SERIF}`; ctx.letterSpacing = '3px';
  ctx.fillStyle = C_TEXT;
  ctx.fillText('UNWARDENED', MENU_X - 3, 196);
  ctx.restore();

  const b = menuButtons();
  MENU_ITEMS.forEach(([k, label], i) => {
    const locked = (k === 'modules' && !modulesUnlocked()) || (k === 'forge' && !forgeUnlocked());
    drawNavItem(b[k], locked ? `🔒 ${label}` : label, i === 0, (k === 'ach' && unclaimedInTab(-1)) || (k === 'quests' && questsClaimable()));
  });

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
    ['X', 'Module actif'],
    ['W', 'Boire une fiole (+50 PV)']
  ];
  const cy = 196, ch = 318;
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
  // boutons vers le site officiel et le Discord
  drawMenuButton(siteWebButton(), 'SITE WEB ↗', '#2e4a6b', '#9fc3e8', false);
  drawMenuButton(discordButton(), 'DISCORD ↗', '#3b4a8c', '#a8b8ff', false);
  ctx.textAlign = 'center';
}
// zone cliquable du bouton site web (partagée dessin/clic)
export function siteWebButton() {
  return { x: 690, y: 556, w: 414, h: 36 };
}
export function discordButton() {
  return { x: 690, y: 598, w: 414, h: 36 };
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

// boutons de la carte stats (partagés dessin/clic)
export function statsButtons() {
  const cw = 540, cx = W / 2 - cw / 2, cy = H / 2 - 255 - 20; // ch = 510
  return {
    lb: { x: cx + 40, y: cy + 442, w: 220, h: 38 },
    acct: { x: cx + 280, y: cy + 442, w: 220, h: 38 },
    back: menuButtons().back,
  };
}
function drawStatsCard() {
  const s = G.stats;
  const cw = 540, ch = 510, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2 - 20;
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

  // boutons : classement général + compte en ligne
  const sb = statsButtons();
  drawMenuButton(sb.lb, '🏆 CLASSEMENT GÉNÉRAL', '#8a6d1d', '#f0d98c', true);
  drawMenuButton(sb.acct, '☁ COMPTE / SYNCHRO', '#2e4a6b', '#9fc3e8', false);

  // bouton retour
  const b = menuButtons().back;
  drawMenuButton(b, '← RETOUR', '#455a64', '#90a4ae', false);
}
