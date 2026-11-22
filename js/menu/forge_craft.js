import { G, ctx, W, H, TAU, saveStats, finalWave } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { regenerateDecor } from '../graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from '../achievements.js';
import { ITEMS, MATS, ITEM_RARITY, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave, itemBonuses, DUR_MAX, durState, durMaxOf, damagedItems, repairAllCost } from '../inventory.js';
import { spawnEnemy, spawnFinalBoss } from '../enemies.js';
import { gainXp } from '../player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart } from '../world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm, sfxClick } from '../audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from '../chars.js';
import { inR, fitText, wrapLines, hexA, fmtTime, overline, panel, overlineCentered, drawMenuButton, drawAdminPwInput, menuButtons, menuButtonAt, adminUnlocked, campaignUnlocked, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, MENU_X, MENU_W, MENU_ITEMS } from './common.js';

import { craftTabs, craftZones, craftUI, forgeScroll, forgeScrollMax, upgradeCards, upgradeCost, upgradeXpGain, repairRows, repairAllBtn, repairRowBtn, SLOT_LABEL } from './forge_state.js';

// animation de forge cinématique : halo de foyer, braises, enclume sur souche,
// lingot qui rougeoie, marteau avec traînée de mouvement, impacts étincelants
// et objet forgé qui matérialise avec une aura de rareté
export function drawForgeAnim(L) {
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

// chip de catégorie forge (même style que les sous-onglets personnage)
function fchip(r, label, active, count) {
  const hov = inR(r, G.mouse.x, G.mouse.y);
  ctx.fillStyle = active ? 'rgba(255,215,64,0.22)' : hov ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
  roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  ctx.strokeStyle = active ? '#ffd740' : hov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.16)';
  ctx.lineWidth = active ? 2 : 1;
  roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
  ctx.fillStyle = active ? '#ffe9a3' : '#e8e0c8'; ctx.font = `bold 10.5px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(`${label} · ${count}`, r.x + r.w / 2, r.y + r.h / 2 + 4);
}

export function drawForgeCraft(L) {
  // ---------- chips de catégories ----------
  for (const t of craftTabs(L)) fchip(t.r, t.label, craftUI.cat === t.key, t.n);
  if (craftUI.cat === 'upgrade') { drawUpgradeTab(L); return; }
  if (craftUI.cat === 'repair') { drawRepairTab(L); return; }

  const Z = craftZones(L);
  const { lx, lw, cx2, cw2, rx, rw, y0, y1 } = Z;
  // ---------- GAUCHE : liste des recettes (scrollable) ----------
  ctx.save();
  ctx.beginPath(); ctx.rect(lx - 4, y0 - 6, lw + 8, y1 - y0 + 12); ctx.clip();
  for (const r of Z.rows) {
    const it = ITEMS[r.id];
    const ok = canCraft(G.inv, r.id), owned = !!G.inv.items[r.id];
    const sel = r.id === Z.selId;
    const tier = itemTier(it);
    ctx.fillStyle = sel ? hexA(tier, 0.20) : owned ? 'rgba(105,240,174,0.07)' : ok ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = sel ? tier : owned ? 'rgba(105,240,174,0.45)' : ok ? `rgba(255,215,64,${0.3 + 0.15 * Math.sin(G.time * 3 + r.x * 0.02)})` : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = sel ? 2 : 1.2;
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    drawItemIcon(it, r.x + 24, r.y + r.h / 2, 15);
    ctx.textAlign = 'left';
    ctx.fillStyle = owned ? '#69f0ae' : '#ffe9a3'; ctx.font = 'bold 11.5px Inter, sans-serif';
    ctx.fillText(fitText(it.name, lw - 60), r.x + 44, r.y + 18);
    ctx.fillStyle = tier; ctx.font = `9px Inter, sans-serif`;
    ctx.fillText(`${ITEM_RARITY[it.rar] || ''}${owned ? ' · possédé' : ''}`, r.x + 44, r.y + 33);
    // pastille état : ✓ok / ✗manque / ✓possédé
    ctx.textAlign = 'right'; ctx.font = `bold 10px Inter, sans-serif`;
    if (owned) ctx.fillStyle = '#69f0ae';
    else if (ok) ctx.fillStyle = '#81c784';
    else ctx.fillStyle = '#ef9a9a';
    ctx.fillText(owned ? '✓' : ok ? '◆' : '✗', r.x + r.w - 12, r.y + 20);
  }
  ctx.restore();
  // scrollbar liste
  const smax = forgeScrollMax();
  if (smax > 0) {
    const tx = lx + lw - 8, ty = y0, th = y1 - y0;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(tx, ty, 5, th, 2.5); ctx.fill();
    const thumbH = Math.max(20, th * (th / (th + smax)));
    const thumbY = ty + (th - thumbH) * (forgeScroll / smax);
    ctx.fillStyle = 'rgba(255,215,64,0.6)'; roundRect(tx, thumbY, 5, thumbH, 2.5); ctx.fill();
  }

  const it = Z.it;
  if (!it) {
    ctx.fillStyle = '#546e7a'; ctx.font = 'italic 13px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Aucune recette dans cette catégorie', cx2 + cw2 / 2, y0 + 40);
    return;
  }
  const id = Z.selId;
  const ok = canCraft(G.inv, id), owned = !!G.inv.items[id];
  const tier = itemTier(it);

  // ---------- CENTRE : aperçu de l'équipement sélectionné ----------
  panel(cx2, y0, cw2, y1 - y0);
  const px = cx2 + cw2 / 2;
  // halo de rareté
  const hg = ctx.createRadialGradient(px, y0 + 90, 10, px, y0 + 90, 90);
  hg.addColorStop(0, hexA(tier, 0.22)); hg.addColorStop(1, hexA(tier, 0));
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(px, y0 + 90, 90, 0, TAU); ctx.fill();
  drawItemIcon(it, px, y0 + 82, 34);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a3'; ctx.font = `bold 16px ${SERIF}`;
  ctx.fillText(fitText(it.name, cw2 - 30), px, y0 + 142);
  ctx.fillStyle = tier; ctx.font = `bold 11px Inter, sans-serif`;
  ctx.fillText(`◆ ${ITEM_RARITY[it.rar] || 'Objet forgé'}`, px, y0 + 160);
  // description
  ctx.fillStyle = '#9e9e9e'; ctx.font = `12px Inter, sans-serif`;
  const dLines = wrapLines(it.desc, cw2 - 50).slice(0, 3);
  dLines.forEach((ln, i) => ctx.fillText(ln, px, y0 + 186 + i * 17));
  // stats détaillées (bonus réels)
  const fxY = y0 + 250;
  ctx.fillStyle = '#ffd740'; ctx.font = `bold 11px Inter, sans-serif`; ctx.textAlign = 'left';
  ctx.fillText('BONUS APPLIQUÉS', cx2 + 24, fxY);
  const fxLines = itemFxLines(id);
  ctx.font = `11.5px Inter, sans-serif`; ctx.fillStyle = '#a5d6a7';
  fxLines.forEach((ln, i) => ctx.fillText(ln, cx2 + 24, fxY + 20 + i * 16));
  // emplacement
  ctx.fillStyle = '#90caf9'; ctx.font = `bold 10.5px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(SLOT_TXT[it.slot] || it.slot.toUpperCase(), px, y1 - 14);

  // ---------- DROITE : matériaux + coût + statut + fabrication ----------
  panel(rx, y0, rw, y1 - y0);
  const qx = rx + 18;
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffd740'; ctx.font = `bold 12px Inter, sans-serif`;
  ctx.fillText('MATÉRIAUX REQUIS', qx, y0 + 26);
  let my = y0 + 52;
  for (const m in it.cost) {
    const have = G.inv.mats[m] || 0, need = it.cost[m];
    const enough = have >= need;
    drawMatIcon(m, qx + 8, my - 4, 7);
    ctx.fillStyle = '#e8e0c8'; ctx.font = `12px Inter, sans-serif`;
    ctx.fillText(MATS[m].name, qx + 22, my);
    ctx.font = `bold 12px Consolas, monospace`; ctx.textAlign = 'right';
    ctx.fillStyle = owned ? '#69f0ae' : enough ? '#a5d6a7' : '#ef9a9a';
    ctx.fillText(`${have.toLocaleString('fr-FR')} / ${need}`, rx + rw - 18, my);
    ctx.textAlign = 'left';
    my += 26;
  }
  // statut + bouton
  const stY = y1 - 108;
  ctx.textAlign = 'center'; ctx.font = `bold 12px Inter, sans-serif`;
  if (owned) { ctx.fillStyle = '#69f0ae'; ctx.fillText('✓ DÉJÀ FORGÉ', rx + rw / 2, stY); }
  else if (ok) { ctx.fillStyle = '#81c784'; ctx.fillText('◆ FABRICATION POSSIBLE', rx + rw / 2, stY); }
  else { ctx.fillStyle = '#ef9a9a'; ctx.fillText('✗ MATÉRIAUX INSUFFISANTS', rx + rw / 2, stY); }
  const b = Z.craftBtn;
  ctx.fillStyle = owned ? 'rgba(105,240,174,0.2)' : ok ? 'rgba(76,175,80,0.55)' : 'rgba(255,255,255,0.07)';
  roundRect(b.x, b.y, b.w, b.h, 9); ctx.fill();
  ctx.strokeStyle = owned ? '#69f0ae' : ok ? '#81c784' : 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
  roundRect(b.x, b.y, b.w, b.h, 9); ctx.stroke();
  ctx.fillStyle = owned ? '#69f0ae' : ok ? '#fff' : '#777'; ctx.font = `bold 14px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(owned ? 'FORGÉ ✓' : ok ? '🔨  FORGER' : 'MATÉRIAUX MANQUANTS', b.x + b.w / 2, b.y + b.h / 2 + 5);
}

const SLOT_TXT = { weapon: '⚔️ EMPLACEMENT ARME', armor: '🛡️ EMPLACEMENT ARMURE', helm: '⛑️ EMPLACEMENT CASQUE', gloves: '🧤 EMPLACEMENT GANTS', charm: '🧿 EMPLACEMENT ACCESSOIRE', boots: '👢 EMPLACEMENT BOTTES', conso: '🧪 CONSOMMABLE' };

// lignes de bonus réelles d'un objet (miroir de FX dans inventory.js)
function itemFxLines(id) {
  const fx = itemBonuses(id);
  const out = [];
  const p = v => `+${Math.round(v * 100)} %`;
  if (fx.weaponMult) out.push(`⚔️ +${Math.round((fx.weaponMult - 1) * 100)} % de dégâts`);
  if (fx.armorReduce) out.push(`🛡️ -${Math.round(fx.armorReduce * 100)} % de dégâts subis`);
  if (fx.hp) out.push(`❤️ +${fx.hp} PV max`);
  if (fx.speed) out.push(`👟 +${fx.speed.toFixed(2)} vitesse`);
  if (fx.xp) out.push(`✨ +${Math.round((fx.xp - 1) * 100)} % d'XP`);
  if (fx.potions) out.push(`🧪 +${fx.potions} fiole${fx.potions > 1 ? 's' : ''} max`);
  if (fx.potionMult) out.push(`🍶 +${Math.round((fx.potionMult - 1) * 100)} % de soin`);
  if (fx.ultR) out.push(`💥 +${Math.round((fx.ultR - 1) * 100)} % rayon ultime`);
  if (fx.ultBoss) out.push(`👹 +${Math.round(fx.ultBoss * 100)} % dégâts boss (ult.)`);
  if (!out.length) out.push('Aucun bonus — objet_cosmétique');
  return out.slice(0, 5);
}

// ---------- AMÉLIORATIONS : niveau d'arme + achat d'XP aux matériaux ----------
function drawUpgradeTab(L) {
  const defs = [
    { key: 'epee', icon: '⚔️', label: 'ÉPÉE', color: '#ffb74d' },
    { key: 'lance', icon: '🔱', label: 'LANCE', color: '#4fc3f7' },
    { key: 'arc', icon: '🏹', label: 'ARC CINÉTIQUE', color: '#b388ff' }
  ];
  const y0 = L.cy + 142;
  ctx.fillStyle = C_MUTED; ctx.font = `italic 12px Inter, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText('Chaque amélioration ajoute 10 % de l\'XP nécessaire au niveau suivant — payable en Émeraudes uniquement.', L.cx + L.cw / 2, y0 - 14);
  for (const card of upgradeCards(L)) {
    const def = defs.find(d => d.key === card.key);
    const info = modeInfo(G.inv, card.key);
    const locked = card.key === 'arc' && !(G.stats && G.stats.bowUnlocked);
    const xpGain = upgradeXpGain(G.inv, card.key);
    const cost = upgradeCost(info.lvl, card.key);
    const canPay = Object.keys(cost).every(m => (G.inv.mats[m] || 0) >= cost[m]);
    const maxed = info.lvl >= 100;
    // carte
    ctx.fillStyle = locked ? 'rgba(20,16,40,0.55)' : 'rgba(255,255,255,0.05)';
    roundRect(card.x, card.y, card.w, card.h, 12); ctx.fill();
    ctx.strokeStyle = locked ? 'rgba(124,77,255,0.4)' : def.color; ctx.lineWidth = 1.6;
    roundRect(card.x, card.y, card.w, card.h, 12); ctx.stroke();
    ctx.globalAlpha = locked ? 0.55 : 1;
    ctx.textAlign = 'left'; ctx.font = `22px serif`;
    ctx.fillText(def.icon, card.x + 18, card.y + 36);
    ctx.fillStyle = def.color; ctx.font = `bold 16px Inter, sans-serif`;
    ctx.fillText(def.label, card.x + 52, card.y + 34);
    ctx.fillStyle = '#ffe9a3'; ctx.font = `bold 18px Consolas, monospace`; ctx.textAlign = 'right';
    ctx.fillText(locked ? '???' : `NIV ${info.lvl}`, card.x + card.w - 16, card.y + 36);
    // barre XP
    const bx = card.x + 18, bw = card.w - 36, by = card.y + 58;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(bx, by, bw, 10, 5); ctx.fill();
    ctx.fillStyle = def.color;
    roundRect(bx, by, bw * info.pct, 10, 5); ctx.fill();
    ctx.fillStyle = '#aab4c0'; ctx.font = `10px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(maxed ? 'NIVEAU MAX' : `${Math.floor(info.xp).toLocaleString('fr-FR')} / ${info.need.toLocaleString('fr-FR')} XP`, card.x + card.w / 2, by - 6);
    // coût
    ctx.textAlign = 'left'; ctx.font = `11.5px Consolas, monospace`;
    let cy = card.y + 92;
    for (const m in cost) {
      const have = G.inv.mats[m] || 0;
      ctx.fillStyle = have >= cost[m] ? '#a5d6a7' : '#ef9a9a';
      ctx.fillText(`${MATS[m].name} ${have}/${cost[m]}`, card.x + 18, cy);
      cy += 17;
    }
    ctx.fillStyle = '#8d99ae'; ctx.font = `10.5px Inter, sans-serif`;
    ctx.fillText(locked ? '🔒 Vaincre l\'Abomination Cosmique' : maxed ? 'Niveau maximum atteint' : `+${xpGain.toLocaleString('fr-FR')} XP par amélioration`, card.x + 18, cy + 2);
    // bouton
    const b = card.btn;
    const ok = !locked && !maxed && canPay;
    ctx.fillStyle = ok ? 'rgba(76,175,80,0.5)' : 'rgba(255,255,255,0.06)';
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = ok ? '#81c784' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.stroke();
    ctx.fillStyle = ok ? '#fff' : '#777'; ctx.font = `bold 12px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(locked ? '🔒 VERROUILLÉ' : maxed ? 'MAX' : ok ? '⬆ AMÉLIORER' : 'MATÉRIAUX', b.x + b.w / 2, b.y + b.h / 2 + 4);
    ctx.globalAlpha = 1;
  }
}


// ---------- RÉPARATION : équipements endommagés + réparation groupée ----------
const DUR_COL = { ok: '#69f0ae', warn: '#ffd740', crit: '#ff9800', broken: '#ff5252' };

function drawRepairTab(L) {
  const all = damagedItems(G.inv);
  const rows = repairRows(L);
  const total = repairAllCost(G.inv);
  const anyOk = all.some(id => canRepair(G.inv, id));

  // en-tête
  ctx.textAlign = 'left';
  ctx.fillStyle = C_GOLD; ctx.font = `bold 13px ${UI}`;
  ctx.fillText('🔧 RÉPARATION', L.cx + 30, L.cy + 142);
  ctx.fillStyle = C_MUTED; ctx.font = `italic 11px ${UI}`;
  ctx.fillText(all.length
    ? `${all.length} équipement${all.length > 1 ? 's' : ''} endommagé${all.length > 1 ? 's' : ''} — le coût suit l'usure (~50 % du prix de forge au total)`
    : 'Tous tes équipements sont en parfait état', L.cx + 30, L.cy + 160);

  // coût total à gauche du bouton « tout réparer »
  const ab = repairAllBtn(L);
  if (total) {
    ctx.textAlign = 'right'; ctx.font = `10.5px Consolas, monospace`;
    let tx = ab.x - 14;
    const parts = Object.keys(total).map(m => `${MATS[m].name} ×${total[m]}`);
    ctx.fillStyle = '#d4b062';
    ctx.fillText(fitText(parts.join('  ·  '), 300), tx, ab.y + ab.h / 2 + 4);
  }
  // bouton RÉPARER TOUT
  const okAll = anyOk;
  ctx.fillStyle = okAll ? 'rgba(255,140,0,0.35)' : 'rgba(255,255,255,0.05)';
  roundRect(ab.x, ab.y, ab.w, ab.h, 8); ctx.fill();
  ctx.strokeStyle = okAll ? '#ff9800' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
  roundRect(ab.x, ab.y, ab.w, ab.h, 8); ctx.stroke();
  ctx.fillStyle = okAll ? '#ffe0b2' : '#78909c'; ctx.font = `bold 12px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText(okAll ? '🔧  RÉPARER TOUT' : (all.length ? 'SOUS LES FERS' : 'RIEN À FAIRE'), ab.x + ab.w / 2, ab.y + ab.h / 2 + 4);

  if (!rows.length) {
    ctx.fillStyle = '#69f0ae'; ctx.font = `italic 13px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText('Aucun équipement à réparer — frappe et forge pour les user !', L.cx + L.cw / 2, L.cy + 300);
    return;
  }

  // liste scrollable (clip)
  const vy0 = L.cy + 174, vy1 = L.cy + L.ch - 10;
  ctx.save();
  ctx.beginPath(); ctx.rect(L.cx + 16, vy0, L.cw - 32, vy1 - vy0); ctx.clip();
  for (const row of rows) {
    const it = ITEMS[row.id];
    if (!it) continue;
    const dur = getDur(G.inv, row.id);
    const dmax = durMaxOf(row.id);
    const st = durState(dur, dmax);
    const col = DUR_COL[st];
    const hov = inR(row, G.mouse.x, G.mouse.y);
    // carte teintée par l'état
    ctx.fillStyle = st === 'broken' ? 'rgba(255,60,60,0.10)' : st === 'crit' ? 'rgba(255,140,0,0.10)'
      : st === 'warn' ? 'rgba(255,215,0,0.07)' : hov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.045)';
    roundRect(row.x, row.y, row.w, row.h, 9); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = st === 'ok' ? 1 : 1.8;
    roundRect(row.x, row.y, row.w, row.h, 9); ctx.stroke();
    const cy = row.y + row.h / 2;
    // icône
    drawItemIcon(it, row.x + 30, cy, 17);
    // nom + emplacement
    ctx.textAlign = 'left';
    ctx.fillStyle = st === 'broken' ? '#ff8a80' : '#ffe9a3'; ctx.font = `bold 13px ${UI}`;
    ctx.fillText(fitText(it.name + (st === 'broken' ? ' 💥' : ''), 240), row.x + 52, cy - 6);
    ctx.fillStyle = '#90a4ae'; ctx.font = `10px ${UI}`;
    ctx.fillText(SLOT_LABEL[it.slot] || it.slot.toUpperCase(), row.x + 52, cy + 12);
    // barre de durabilité + valeurs
    const bx = row.x + 300, bw = 190, by = cy - 7;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(bx - 1, by - 1, bw + 2, 12, 6); ctx.fill();
    ctx.fillStyle = col;
    if (dur > 0) roundRect(bx, by, bw * dur / dmax, 10, 5), ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 10px Consolas, monospace`; ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(dur)} / ${dmax}`, bx + bw / 2, by + 9);
    // coût en matériaux
    const rc = repairCost(G.inv, row.id);
    const okR = canRepair(G.inv, row.id);
    const rb = repairRowBtn(row);
    ctx.textAlign = 'left'; ctx.font = `10.5px Consolas, monospace`;
    let cxm = bx + bw + 16;
    const maxCostX = rb.x - 12; // ne pas dépasser le bouton
    for (const m in rc) {
      const have = G.inv.mats[m] || 0;
      const text = `${MATS[m].name} ${have}/${rc[m]}`;
      const w = ctx.measureText(text).width;
      if (cxm + w > maxCostX) break; // stop si ça chevauche le bouton
      ctx.fillStyle = have >= rc[m] ? '#a5d6a7' : '#ef9a9a';
      ctx.fillText(text, cxm, cy + 4);
      cxm += w + 12;
    }
    // bouton réparer
    ctx.fillStyle = okR ? 'rgba(76,175,80,0.4)' : 'rgba(255,255,255,0.06)';
    roundRect(rb.x, rb.y, rb.w, rb.h, 8); ctx.fill();
    ctx.strokeStyle = okR ? '#81c784' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.4;
    roundRect(rb.x, rb.y, rb.w, rb.h, 8); ctx.stroke();
    ctx.fillStyle = okR ? '#fff' : '#78909c'; ctx.font = `bold 11.5px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText(okR ? '🔧 RÉPARER' : 'MANQUE MATS', rb.x + rb.w / 2, rb.y + rb.h / 2 + 4);
  }
  ctx.restore();
  // scrollbar
  const smax = forgeScrollMax();
  if (smax > 0) {
    const tx = L.cx + L.cw - 22, ty = vy0, th = vy1 - vy0;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(tx, ty, 6, th, 3); ctx.fill();
    const thumbH = Math.max(24, th * (th / (th + smax)));
    const thumbY = ty + (th - thumbH) * (forgeScroll / smax);
    ctx.fillStyle = 'rgba(255,215,64,0.6)'; roundRect(tx, thumbY, 6, thumbH, 3); ctx.fill();
  }
}
