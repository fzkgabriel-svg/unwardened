import { G, ctx, W, H, TAU, saveStats, finalWave } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { regenerateDecor } from '../graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from '../achievements.js';
import { ITEMS, MATS, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave } from '../inventory.js';
import { spawnEnemy, spawnFinalBoss } from '../enemies.js';
import { gainXp } from '../player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart } from '../world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm, sfxClick } from '../audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from '../chars.js';
import { inR, fitText, wrapLines, hexA, fmtTime, overline, panel, overlineCentered, drawMenuButton, drawAdminPwInput, menuButtons, menuButtonAt, adminUnlocked, campaignUnlocked, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, MENU_X, MENU_W, MENU_ITEMS } from './common.js';

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
