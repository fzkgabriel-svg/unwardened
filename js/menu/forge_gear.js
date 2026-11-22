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

import { craftCells, forgeScroll, forgeScrollMax, itemDetail, forgeTab, invItems, heroSlots, ultBtns, SLOT_LABEL } from './forge_state.js';

// ---------- PAPERDOLL : le héros vêtu de ses équipements ----------
// emplacements cliquables autour de la silhouette (partagé dessin / clic)
export function drawHeroPaperdoll(L) {
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
export function drawUltSelect(L) {
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

export function drawForgeInv(L) {
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

