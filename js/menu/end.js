import { G, ctx, W, H, TAU, saveStats, finalWave } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { regenerateDecor } from '../graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from '../achievements.js';
import { ITEMS, MATS, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave, DUR_MAX, durMaxOf } from '../inventory.js';
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
  let wear = 0, wearPctSum = 0, wornCount = 0;
  const worn = [];
  for (const id in G.runWear) {
    wear += G.runWear[id];
    if (G.runWear[id] > 0.5) { worn.push(id); wearPctSum += G.runWear[id] / durMaxOf(id) * 100; wornCount++; }
  }
  const wearPct = wornCount ? wearPctSum / wornCount : 0; // % moyen de durabilité perdue par pièce
  worn.sort((a, b) => G.runWear[b] - G.runWear[a]);
  const names = worn.slice(0, 2).map(id => (ITEMS[id] ? ITEMS[id].name : id)).join(', ');
  // niveaux épée / lance (progression des types d'armes)
  const eL = modeInfo(G.inv, 'epee').lvl, lL = modeInfo(G.inv, 'lance').lvl;
  const wmodeXp = Math.round((G.lastWmodeXp ? (G.lastWmodeXp.epee || 0) + (G.lastWmodeXp.lance || 0) : 0));
  return {
    mats,
    wear,
    wearPct,
    wmodeLabel: `⚔ Épée niv.${eL} · 🔱 Lance niv.${lL}`,
    wmodeXp,
    wearLabel: names ? `🛡 Usure : ${names}${worn.length > 2 ? '…' : ''}` : '🛡 Usure équipement'
  };
}
function goButtons() {
  const bh = 54, by = H / 2 + 185, gap = 20, bw = 270; // descendu pour l'écran de mort 2.0
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

// ---------- VICTOIRE DE CAMPAGNE ----------
// Écran de fin de campagne : direction médiéval sombre et prestigieuse.
// Révélation échelonnée pilotée par G.vicT (titre -> stats -> récompenses -> boutons).
const VIC = [
  { world: 'Les Terres Oubliées', boss: 'SEIGNEUR OUBLIÉ', bossCol: '#e040fb',
    sub: 'La menace a été vaincue. Les Terres Oubliées respirent à nouveau.',
    col: '#e040fb', glow: 'rgba(224,64,251,',
    unlocks: [{ icon: '🌍', txt: 'Nouveau monde débloqué : The Frozen Land' }] },
  { world: 'The Frozen Land', boss: 'SOUVERAIN DE GLACE', bossCol: '#4fc3f7',
    sub: 'Le froid éternel se dissipe. La glace conserve votre nom.',
    col: '#4fc3f7', glow: 'rgba(79,195,247,',
    unlocks: [
      { icon: '❄', txt: 'Ultime « Pluie de Glace » débloquée — forge > Héros' },
      { icon: '🌍', txt: 'Nouveau monde débloqué : Les Enfers' }] },
  { world: 'Les Enfers', boss: 'BARON DE L\'ENFER', bossCol: '#ff7043',
    sub: 'Les braises s\'éteignent. Les Enfers ont perdu leur maître.',
    col: '#ff7043', glow: 'rgba(255,112,67,',
    unlocks: [
      { icon: '🔥', txt: 'Ultime « Titan de Feu » débloquée — forge > Héros' },
      { icon: '🌍', txt: 'Nouveau monde débloqué : Les Égouts' }] },
  { world: 'Les Égouts', boss: 'TYRAN DES PROFONDEURS', bossCol: '#aeea00',
    sub: 'La vase se calme. Les Égouts ne cacheront plus leurs secrets.',
    col: '#aeea00', glow: 'rgba(174,234,0,',
    unlocks: [{ icon: '🌍', txt: 'Nouveau monde débloqué : L\'Espace' }] },
  { world: 'L\'Espace', boss: 'ABOMINATION COSMIQUE', bossCol: '#b388ff',
    sub: 'Les étoiles sont sauvées. Le vide n\'a plus de maître.',
    col: '#b388ff', glow: 'rgba(179,136,255,',
    unlocks: [
      { icon: '🏹', txt: 'Arc cinétique cosmique débloqué — forge > Héros' },
      { icon: '🌍', txt: 'Nouveau monde débloqué : Royaume des Tempêtes' }] },
  { world: 'Royaume des Tempêtes', boss: 'SOUVERAIN DES OURAGANS', bossCol: '#80d8ff',
    sub: 'Les ouragans s\'apaisent. Le royaume des cieux est à vous.',
    col: '#80d8ff', glow: 'rgba(128,216,255,',
    unlocks: [
      { icon: '✦', txt: '2ᵉ emplacement passif débloqué — menu Modules' },
      { icon: '♾', txt: 'NG+ : la boucle recommence, plus forte que jamais' }] },
];

// boutons de l'écran de victoire : continuer / carte campagne / menu
function vicButtons() {
  const bw = 216, bh = 46, gap = 18, by = H - 66;
  const total = bw * 3 + gap * 2;
  const x0 = W / 2 - total / 2;
  return {
    next:     { x: x0,             y: by, w: bw, h: bh },
    campaign: { x: x0 + bw + gap,  y: by, w: bw, h: bh },
    menu:     { x: x0 + (bw + gap) * 2, y: by, w: bw, h: bh }
  };
}
export function victoryButtonAt(x, y) {
  const b = vicButtons();
  for (const k of ['next', 'campaign', 'menu']) {
    const r = b[k];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return k;
  }
  return null;
}

// poussière dorée mystique qui dérive derrière l'écran (déterministe)
function drawVicMotes(v, pal) {
  for (let i = 0; i < 42; i++) {
    const sp = 0.14 + (i % 6) * 0.04;
    const tt = (G.vicT * sp + i * 0.618) % 1;
    const mx = W / 2 + (((i * 0.7549) % 1) - 0.5) * W * 1.4 + Math.sin(G.vicT * 0.9 + i * 1.7) * 22 * tt;
    const my = H + 20 - tt * (H + 60);
    const a = Math.sin(tt * Math.PI) * (0.10 + 0.16 * v);
    ctx.fillStyle = pal.mote.replace('A', a.toFixed(3));
    ctx.beginPath(); ctx.arc(mx, my, 0.9 + (i % 3) * 0.7, 0, TAU); ctx.fill();
  }
}

export function drawVictory() {
  const p = G.player;
  const v = VIC[Math.min(5, Math.max(0, G.campaign || 0))];
  const vicT = G.vicT || 0;
  const eK = tt => 1 - Math.pow(1 - Math.min(1, Math.max(0, (vicT - tt) / 0.8)), 3); // easeOut par étape

  // ---- fond : nuit profonde + halo de l'univers + vignette ----
  ctx.fillStyle = 'rgba(5,4,8,0.94)'; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2 - 60, 60, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(10,8,14,0.5)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // halo coloré du monde vaincu, révélé en fondu
  const ha = 0.16 * eK(0.1);
  const hg = ctx.createRadialGradient(W / 2, H / 2 - 90, 20, W / 2, H / 2 - 90, 460);
  hg.addColorStop(0, v.glow + ha + ')'); hg.addColorStop(1, v.glow + '0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  // motes de l'univers
  const MOTES = [
    { mote: 'rgba(255,213,79,A)' },   // terre : or
    { mote: 'rgba(200,240,255,A)' },  // glace : givre
    { mote: 'rgba(255,150,80,A)' },   // enfer : braise
    { mote: 'rgba(210,240,140,A)' },  // égouts : vase lumineuse
    { mote: 'rgba(200,170,255,A)' },  // espace : cosmos
    { mote: 'rgba(190,230,255,A)' }   // tempête : vent glacé
  ];
  drawVicMotes(Math.min(1, vicT / 2), MOTES[Math.min(5, Math.max(0, G.campaign || 0))]);

  // ---- coins : ornements médiévaux ----
  const cornerF = (x, y, sx, sy, a) => {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.strokeStyle = 'rgba(212,176,98,0.4)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 9); ctx.lineTo(9, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(212,176,98,0.45)';
    ctx.save(); ctx.translate(16, 16); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    ctx.restore();
  };
  cornerF(26, 24, 1, 1, eK(0.1)); cornerF(W - 26, 24, -1, 1, eK(0.1));
  cornerF(26, H - 24, 1, -1, eK(0.1)); cornerF(W - 26, H - 24, -1, -1, eK(0.1));

  ctx.textAlign = 'center';

  // ---- surtitre + titre + sous-titre ----
  const k0 = eK(0.15);
  if (k0 > 0) {
    ctx.save(); ctx.globalAlpha = k0;
    overlineCentered(`LE MONDE DE ${v.world.toUpperCase()} EST SAUVE`, W / 2, 92, v.col);
    ctx.restore();
  }
  const k1 = eK(0.4);
  if (k1 > 0) {
    ctx.save();
    ctx.globalAlpha = k1;
    const pop = 0.92 + 0.08 * k1;
    ctx.translate(W / 2, 150); ctx.scale(pop, pop);
    const tg = ctx.createLinearGradient(-300, 0, 300, 0);
    tg.addColorStop(0, '#8a6a2f'); tg.addColorStop(0.5, '#f0d78c'); tg.addColorStop(1, '#8a6a2f');
    ctx.font = 'bold 54px Cinzel, Georgia, serif';
    ctx.shadowColor = v.glow + '0.55)'; ctx.shadowBlur = 26;
    ctx.fillStyle = tg;
    ctx.fillText('✦ CAMPAGNE TERMINÉE ✦', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
    // filet ornemental sous le titre
    ctx.save(); ctx.globalAlpha = k1 * 0.8;
    ctx.strokeStyle = 'rgba(212,176,98,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W / 2 - 250, 172); ctx.lineTo(W / 2 - 30, 172);
    ctx.moveTo(W / 2 + 30, 172); ctx.lineTo(W / 2 + 250, 172); ctx.stroke();
    ctx.fillStyle = 'rgba(212,176,98,0.55)';
    [[W / 2 - 22, 172], [W / 2 + 22, 172]].forEach(([dx, dy]) => {
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
    });
    ctx.restore();
  }
  const k2 = eK(0.8);
  if (k2 > 0) {
    ctx.save(); ctx.globalAlpha = k2;
    ctx.font = 'italic 17px Georgia, serif';
    ctx.fillStyle = '#cbbfa5';
    ctx.fillText(v.sub, W / 2, 200);
    // boss vaincu, dans sa couleur
    ctx.font = '600 12px Inter, sans-serif'; ctx.letterSpacing = '2px';
    ctx.fillStyle = v.bossCol;
    ctx.fillText(`BOSS VAINCU : ${v.boss}`, W / 2, 224);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  // ---- panneau chroniques (gauche) : statistiques réelles ----
  const loot = runLootRows();
  const lx = W / 2 - 500, lw = 470, ly = 246, lh = 236;
  const k3 = eK(1.1);
  if (k3 > 0) {
    ctx.save(); ctx.globalAlpha = k3; ctx.translate(0, (1 - k3) * 18);
    const pg = ctx.createLinearGradient(lx, ly, lx, ly + lh);
    pg.addColorStop(0, 'rgba(26,20,14,0.92)'); pg.addColorStop(1, 'rgba(14,11,8,0.94)');
    ctx.fillStyle = pg;
    roundRect(lx, ly, lw, lh, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(212,176,98,0.4)'; ctx.lineWidth = 1.4;
    roundRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1, 12); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,176,98,0.18)'; ctx.lineWidth = 1;
    roundRect(lx + 5.5, ly + 5.5, lw - 11, lh - 11, 9); ctx.stroke();
    overline('CHRONIQUES DE L\'EXPÉDITION', lx + lw / 2, ly + 24, 'rgba(212,176,98,0.9)');
    const rows = [
      ['Monde terminé', v.world, v.col],
      ['Vague atteinte', `FINALE (${G.wave})`, '#ff8a65'],
      ['Niveau du héros', `Nv. ${p.level}`, '#40c4ff'],
      ['Ennemis vaincus', G.kills.toLocaleString('fr-FR'), '#69f0ae'],
      ['Dégâts infligés', Math.floor(G.dmgDealt).toLocaleString('fr-FR'), '#ffeb3b'],
      ['Temps de campagne', fmtTime(G.runTime), '#9575cd'],
      ['📦 Matériaux gagnés', `+${loot.mats}`, '#ffd740'],
      [loot.wearLabel, loot.wear > 0 ? `−${loot.wear.toFixed(0)} %` : 'aucune', '#ff8a65']
    ];
    ctx.font = '14px Inter, sans-serif';
    rows.forEach((r, i) => {
      const ry = ly + 52 + i * 22;
      ctx.textAlign = 'left'; ctx.fillStyle = '#b8ac93';
      ctx.fillText(r[0], lx + 26, ry);
      ctx.textAlign = 'right'; ctx.fillStyle = r[2]; ctx.font = 'bold 14.5px Inter, sans-serif';
      ctx.fillText(String(r[1]), lx + lw - 26, ry);
      ctx.font = '14px Inter, sans-serif';
    });
    ctx.restore();
  }

  // ---- panneau récompenses (droite) : déblocages réels ----
  const rx = W / 2 + 30, rw = 470, ry2 = 246, rh = 236;
  const k4 = eK(1.5);
  if (k4 > 0) {
    ctx.save(); ctx.globalAlpha = k4; ctx.translate(0, (1 - k4) * 18);
    const pg = ctx.createLinearGradient(rx, ry2, rx, ry2 + rh);
    pg.addColorStop(0, 'rgba(24,26,20,0.92)'); pg.addColorStop(1, 'rgba(13,14,11,0.94)');
    ctx.fillStyle = pg;
    roundRect(rx, ry2, rw, rh, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(212,176,98,0.4)'; ctx.lineWidth = 1.4;
    roundRect(rx + 0.5, ry2 + 0.5, rw - 1, rh - 1, 12); ctx.stroke();
    overline('RÉCOMPENSES & DÉBLOQUÉS', rx + rw / 2, ry2 + 24, 'rgba(212,176,98,0.9)');
    // chaque récompense apparaît avec un léger décalage
    v.unlocks.forEach((u, i) => {
      const uk = Math.min(1, Math.max(0, (vicT - 1.9 - i * 0.45) / 0.6));
      if (uk <= 0) return;
      const uy = ry2 + 58 + i * 74;
      ctx.save(); ctx.globalAlpha = uk; ctx.translate(0, (1 - uk) * 10);
      // liseré doré animé sur la carte de récompense
      ctx.strokeStyle = `rgba(212,176,98,${0.35 + 0.2 * Math.sin(vicT * 2.4 + i)})`;
      ctx.lineWidth = 1;
      roundRect(rx + 20, uy, rw - 40, 58, 9); ctx.stroke();
      ctx.fillStyle = 'rgba(212,176,98,0.07)';
      roundRect(rx + 20, uy, rw - 40, 58, 9); ctx.fill();
      // icône dans un médaillon
      ctx.save();
      ctx.translate(rx + 52, uy + 29); ctx.scale(0.85 + 0.15 * uk, 0.85 + 0.15 * uk);
      ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.icon, 0, 0);
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.font = '600 13px Inter, sans-serif'; ctx.fillStyle = '#e8dfc8';
      // texte éventuellement sur 2 lignes
      const words = u.txt.split(' '); let line = '', ly2 = uy + 24;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > rw - 110 && line) { ctx.fillText(line, rx + 92, ly2); line = w; ly2 += 15; }
        else line = test;
      }
      if (line) ctx.fillText(line, rx + 92, ly2);
      ctx.font = '600 9px Inter, sans-serif'; ctx.letterSpacing = '2px';
      ctx.fillStyle = 'rgba(212,176,98,0.75)';
      ctx.fillText('✦ DÉBLOQUÉ ✦', rx + 92, uy + 46);
      ctx.letterSpacing = '0px';
      ctx.restore();
    });
    // mention du compteur de campagne
    ctx.save(); ctx.globalAlpha = Math.min(1, Math.max(0, (vicT - 2.6) / 0.5));
    ctx.font = 'italic 11.5px Georgia, serif'; ctx.fillStyle = '#9a8f78';
    ctx.fillText(G.campaign < 5 ? `${G.campaign + 1} / 6 campagnes conquises` : 'Toutes les campagnes sont conquises', rx + rw / 2, ry2 + rh - 18);
    ctx.restore();
    ctx.restore();
  }

  // ---- boutons ----
  const b = vicButtons();
  const hasNext = G.campaign < 5;
  const k5 = eK(2.4);
  if (k5 > 0) {
    ctx.save(); ctx.globalAlpha = k5;
    drawMenuButton(b.next, hasNext ? '▶  MONDE SUIVANT' : '↻  REJOUER', '#8a6a2f', '#f0d78c', true);
    drawMenuButton(b.campaign, '🗺  CAMPAGNE', '#3a3428', '#c9b896', false);
    drawMenuButton(b.menu, '⌂  MENU', '#2c2a26', '#a89f8c', false);
    ctx.restore();
  }
  const k6 = eK(2.9);
  if (k6 > 0) {
    ctx.save(); ctx.globalAlpha = k6 * (0.6 + Math.sin(G.time * 3) * 0.25);
    ctx.font = '600 11px Inter, sans-serif'; ctx.letterSpacing = '1.5px';
    ctx.fillStyle = '#b8ac93'; ctx.textAlign = 'center';
    ctx.fillText(hasNext ? 'R — Monde suivant · C — Carte campagne · Échap — Menu' : 'R — Rejouer · C — Carte campagne · Échap — Menu', W / 2, b.next.y + b.next.h + 24);
    ctx.letterSpacing = '0px'; ctx.restore();
  }
}

// ---------- GAME OVER 2.0 ----------
// Petites illustrations vectorielles discrètes (crâne, épée brisée, coins)
function drawSkullIcon(x, y, s = 1, col = '#cbb9a0') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = col;
  // dôme du crâne
  ctx.beginPath(); ctx.arc(0, -3, 10.5, Math.PI, 0); ctx.fill();
  ctx.fillRect(-10.5, -3, 21, 8.5); // mâchoire
  // front bombé
  ctx.beginPath(); ctx.arc(0, -8, 6.5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#17100c'; // orbites et cavité nasale
  ctx.beginPath(); ctx.arc(-4.4, -4, 2.9, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(4.4, -4, 2.9, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(-1.8, 0.5); ctx.lineTo(1.8, 0.5); ctx.closePath(); ctx.fill();
  // fissure funeste
  ctx.strokeStyle = col; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-5, -8); ctx.lineTo(-7.5, -5); ctx.stroke();
  ctx.restore();
}

function drawBrokenSword(x, y, s = 1, col = '#9aa7b8', ang = -0.55) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
  // lame brisée : le tiers supérieur a volé
  ctx.beginPath(); ctx.moveTo(-13, 9); ctx.lineTo(2, -9); ctx.stroke();
  // extrémité déchiquetée
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(5.5, -5); ctx.lineTo(8.5, -8); ctx.stroke();
  // garde
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-1.5, 1.5); ctx.lineTo(9, -1.5); ctx.stroke();
  // poignée + pommeau
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(-1.5, 1.5); ctx.lineTo(-8, 8); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(-9.5, 9.5, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}

function cornerFlourish(x, y, sx, sy) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
  ctx.strokeStyle = 'rgba(212,176,98,0.4)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 9); ctx.lineTo(9, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(212,176,98,0.45)';
  ctx.save(); ctx.translate(16, 16); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
  ctx.beginPath(); ctx.arc(34, 34, 2.2, 0, TAU); ctx.fill();
  ctx.restore();
}

// cendres qui montent : déterministes, discrètes, medium fantasy
function drawDeathEmbers() {
  for (let i = 0; i < 18; i++) {
    const speed = 0.22 + (i % 5) * 0.05;
    const t = (G.time * speed + i * 0.618) % 1;
    const ex = W / 2 + (((i * 0.7549) % 1) - 0.5) * W * 1.5 + Math.sin(G.time * 1.4 + i * 2.1) * 16 * t;
    const ey = H - 20 - t * (H * 0.82);
    const a = Math.sin(t * Math.PI) * 0.45;
    ctx.fillStyle = `rgba(255,${150 + (i % 3) * 28},70,${a})`;
    ctx.fillRect(ex, ey, 1.6 + (i % 3) * 0.5, 1.6 + (i % 3) * 0.5);
  }
}

export function drawGameOver() {
  const p = G.player;
  const di = G.deathInfo || {};
  const goT = G.goT || 0;
  const e1 = 1 - Math.pow(1 - Math.min(1, goT / 0.8), 3);          // intro globale
  const e2 = 1 - Math.pow(1 - Math.min(1, Math.max(0, goT - 0.25) / 0.5), 3); // titre
  const e3 = Math.min(1, Math.max(0, goT - 0.55) / 0.5);             // panneau
  const e4 = Math.min(1, Math.max(0, goT - 0.9) / 0.45);             // boutons

  // ---- fond : charbon profond + vignette sanglant sombre + profondeur ----
  ctx.fillStyle = 'rgba(7,5,8,0.94)'; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2 - 60, 60, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(60,10,10,0.28)'); vg.addColorStop(0.6, 'rgba(20,6,8,0.18)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // lueur funeste centrale très discrète
  const hg = ctx.createRadialGradient(W / 2, H / 2 - 130, 10, W / 2, H / 2 - 130, 340);
  hg.addColorStop(0, 'rgba(140,30,30,0.12)'); hg.addColorStop(1, 'rgba(140,30,30,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  drawDeathEmbers();

  // ---- coins : ornements médiévaux discrets ----
  ctx.save(); ctx.globalAlpha = e1 * 0.9;
  cornerFlourish(26, 24, 1, 1); cornerFlourish(W - 26, 24, -1, 1);
  cornerFlourish(26, H - 24, 1, -1); cornerFlourish(W - 26, H - 24, -1, -1);
  ctx.restore();

  ctx.textAlign = 'center';

  // ---- titre : crâne + épée brisée + « VOUS ÊTES MORT » ----
  ctx.save();
  ctx.globalAlpha = e1;
  drawSkullIcon(W / 2 - 150, 66, 1.15);
  drawBrokenSword(W / 2 + 152, 74, 1.1, '#8d99ae', -0.5);
  // filet ornemental sous les icônes
  ctx.strokeStyle = 'rgba(212,176,98,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 210, 96); ctx.lineTo(W / 2 - 30, 96);
  ctx.moveTo(W / 2 + 30, 96); ctx.lineTo(W / 2 + 210, 96); ctx.stroke();
  ctx.fillStyle = 'rgba(212,176,98,0.5)';
  ctx.save(); ctx.translate(W / 2 - 22, 96); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
  ctx.save(); ctx.translate(W / 2 + 22, 96); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = e2;
  ctx.translate(0, (1 - e2) * 16);
  overlineCentered('L\'ÂME S\'EN EST ALLÉE', W / 2, 122, '#a8503c');
  // titre : doré vieilli, serif élégant, léger glow sombre (pas de rouge criard)
  const tg = ctx.createLinearGradient(W / 2 - 260, 0, W / 2 + 260, 0);
  tg.addColorStop(0, '#8a6a2f'); tg.addColorStop(0.5, '#d4b062'); tg.addColorStop(1, '#8a6a2f');
  ctx.font = 'bold 54px Cinzel, Georgia, serif';
  ctx.shadowColor = 'rgba(160,40,40,0.35)'; ctx.shadowBlur = 18;
  ctx.fillStyle = tg;
  ctx.fillText('VOUS ÊTES MORT', W / 2, 168);
  ctx.shadowBlur = 0;
  // sous-titre immersif
  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillStyle = '#b8a98c';
  const subs = [
    'Les brumes des Terres Oubliées emportent un nouveau héros…',
    'Le froid du Royaume de Glace fige votre nom dans l\'éternité…',
    'Les Enfers réclament ce qui leur revient…',
    'Les Égouts avalent ceux qui s\'y aventurent sans gloire…',
    'Le vide spatial dissout jusqu\'aux plus braves…'
  ];
  ctx.fillText(subs[G.campaign] || subs[0], W / 2, 194);
  ctx.restore();

  // ---- panneau central élargi : bilan de la mort en 8 blocs + barre XP ----
  const lx = W / 2 - 330, lw = 660, ly = 202, lh = 272;
  ctx.save();
  ctx.globalAlpha = e3;
  // panneau parchemin sombre
  const pg = ctx.createLinearGradient(lx, ly, lx, ly + lh);
  pg.addColorStop(0, 'rgba(26,18,20,0.92)'); pg.addColorStop(1, 'rgba(14,10,12,0.94)');
  ctx.fillStyle = pg;
  roundRect(lx, ly, lw, lh, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(212,176,98,0.35)'; ctx.lineWidth = 1.4;
  roundRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,50,50,0.25)'; ctx.lineWidth = 1;
  roundRect(lx + 5.5, ly + 5.5, lw - 11, lh - 11, 9); ctx.stroke();
  // coins internes du panneau
  ctx.fillStyle = 'rgba(212,176,98,0.5)';
  [[lx + 10, ly + 10], [lx + lw - 10, ly + 10], [lx + 10, ly + lh - 10], [lx + lw - 10, ly + lh - 10]].forEach(([cx2, cy2]) => {
    ctx.save(); ctx.translate(cx2, cy2); ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -2, 4, 4); ctx.restore();
  });

  const loot = runLootRows();
  const blocks = [
    { icon: '💀', label: 'MAIN DE FATE', value: di.killer || 'Inconnu', color: di.killerColor || '#ff8a80', big: true },
    { icon: '🗺️', label: 'LIEU DE PERDITION', value: `${di.world || 'Inconnu'}${di.campaign ? ' · ' + di.campaign : ''}`, color: '#d4b062' },
    { icon: '⏱', label: 'TEMPS DE SURVIE', value: fmtTime(G.runTime), color: '#c9b8a0' },
    { icon: '⭐', label: 'NIVEAU & VAGUE', value: `Nv. ${p.level} · vag. ${G.wave}`, color: '#81d4fa' },
    { icon: '⚔️', label: 'ENNEMIS VAINCUS', value: G.kills.toLocaleString('fr-FR'), color: '#69f0ae' },
    { icon: '🛡', label: 'DÉGÂTS (INFLIGÉS / REÇUS)', value: `${Math.floor(G.dmgDealt).toLocaleString('fr-FR')} → ${Math.floor(G.dmgTaken).toLocaleString('fr-FR')}`, color: '#ffeb3b' },
    { icon: '📦', label: 'MATÉRIAUX GAGNÉS', value: `+${loot.mats}`, color: '#ffd740' },
    { icon: '🔧', label: 'USURE ÉQUIPEMENT', value: loot.wearPct > 0 ? `−${loot.wearPct.toFixed(0)} %` : 'aucune', color: '#ff8a65' }
  ];
  const bw2 = (lw - 44) / 2, bh2 = 40, bgap = 8, bx0 = lx + 16, by0 = ly + 18;
  blocks.forEach((b, i) => {
    const col = i % 2, row = (i / 2) | 0;
    const bx = bx0 + col * (bw2 + 12), by = by0 + row * (bh2 + bgap);
    const bi = Math.min(1, Math.max(0, (goT - 0.7 - i * 0.06) / 0.35));
    if (bi <= 0) return;
    ctx.save(); ctx.globalAlpha = e3 * bi;
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    roundRect(bx, by, bw2, bh2, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1;
    roundRect(bx, by, bw2, bh2, 7); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '13px serif';
    ctx.fillText(b.icon, bx + 10, by + bh2 / 2 + 5);
    ctx.fillStyle = '#8d8574'; ctx.font = `600 8.5px ${UI}`; ctx.letterSpacing = '1.5px';
    ctx.fillText(b.label, bx + 32, by + 13);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = b.color; ctx.font = `bold ${b.big ? 14 : 12.5}px ${UI}`;
    ctx.fillText(fitText(String(b.value), bw2 - 42), bx + 32, by + bh2 - 9);
    ctx.restore();
  });

  // barre XP des armes (large, dorée) : XP gagnée + niveaux actuels
  const xpy = by0 + 4 * (bh2 + bgap) + 4;
  const xpBi = Math.min(1, Math.max(0, (goT - 1.0) / 0.35));
  if (xpBi > 0) {
    ctx.save(); ctx.globalAlpha = e3 * xpBi;
    const xbw = lw - 32, xbx = lx + 16;
    const xg = ctx.createLinearGradient(xbx, xpy, xbx + xbw, xpy);
    xg.addColorStop(0, 'rgba(212,176,98,0.16)'); xg.addColorStop(1, 'rgba(212,176,98,0.05)');
    ctx.fillStyle = xg;
    roundRect(xbx, xpy, xbw, 32, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(212,176,98,0.4)'; ctx.lineWidth = 1;
    roundRect(xbx, xpy, xbw, 32, 7); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '13px serif';
    ctx.fillText('⚔️', xbx + 12, xpy + 22);
    ctx.fillStyle = '#8d8574'; ctx.font = `600 8.5px ${UI}`; ctx.letterSpacing = '1.5px';
    ctx.fillText('XP GAGNÉE SUR LES ARMES', xbx + 34, xpy + 11);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffd740'; ctx.font = `bold 12.5px ${UI}`;
    const xpTxt = loot.wmodeXp > 0 ? `+${loot.wmodeXp.toLocaleString('fr-FR')} XP` : '—';
    ctx.fillText(xpTxt, xbx + 34, xpy + 26);
    ctx.fillStyle = '#b8a98c'; ctx.font = `11px ${UI}`; ctx.textAlign = 'right';
    ctx.fillText(fitText(loot.wmodeLabel, xbw - 60), xbx + xbw - 12, xpy + 22);
    ctx.restore();
  }
  ctx.restore();

  // ---- bandeau record ----
  const lr = G.lastRun || { any: false };
  ctx.save(); ctx.globalAlpha = e3;
  ctx.textAlign = 'center';
  if (lr.any) {
    const labels = [];
    if (lr.wave) labels.push('VAGUE');
    if (lr.level) labels.push('NIVEAU');
    if (lr.kills) labels.push('ENNEMIS');
    if (lr.damage) labels.push('DÉGÂTS');
    ctx.shadowColor = 'rgba(255,215,64,0.7)'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd740'; ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(`★  NOUVEAU RECORD : ${labels.join(' · ')}  ★`, W / 2, 492);
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // ---- boutons RÉESSAYER / MENU ----
  ctx.save(); ctx.globalAlpha = e4;
  const b = goButtons();
  drawMenuButton(b.replay, '↻  RÉESSAYER', '#7f2d2d', '#ef9a9a', true);
  drawMenuButton(b.menu, '⌂  MENU PRINCIPAL', '#3a4150', '#90a4ae', false);
  // rappel clavier discret
  ctx.fillStyle = '#8d8574'; ctx.font = 'bold 12px Inter, sans-serif';
  ctx.globalAlpha = e4 * (0.55 + Math.sin(G.time * 4) * 0.25);
  ctx.fillText('R — Rejouer', W / 2, b.replay.y + b.replay.h + 24);
  ctx.restore();
}
