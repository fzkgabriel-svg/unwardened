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
