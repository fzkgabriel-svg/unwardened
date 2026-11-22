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

// grille des succès (partagée dessin / clic) — avec scroll et fiche détail
let achScroll = 0;
let achDetail = null;
let achTab = 0; // 0 = Terres Oubliées, 1 = Terre Gelée, 2 = Enfers, 3 = Égouts, 4 = Espace, 5 = Tempêtes // id du succès ouvert en grand format
const ACH_COLS = 3, ACH_CELL_H = 44, ACH_GAP = 5;
const ACH_TAB_NAMES = ['🗺️ TERRES', '❄️ GLACÉE', '🔥 ENFERS', '🗑️ ÉGOUTS', '🛸 ESPACE', '🌪️ TEMPÊTES'];

function achTabBtns() {
  const cw = 880, ch = 590, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  const bw = 132, gap = 10, y = cy + 80;
  const x0 = cx + (cw - (bw * 6 + gap * 5)) / 2;
  return [0, 1, 2, 3, 4, 5].map(i => ({ i, x: x0 + i * (bw + gap), y, w: bw, h: 34 }));
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

export function drawAchievementsCard() {
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

