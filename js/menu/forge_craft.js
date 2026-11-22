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

import { craftCells, forgeScroll, forgeScrollMax, itemDetail, forgeTab, invItems, heroSlots, ultBtns } from './forge_state.js';

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

export function drawForgeCraft(L) {
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

