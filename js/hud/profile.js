// js/hud/profile.js — panneau personnage haut-gauche : portrait, niveau,
// PV rouge, XP or, charge d'ultime. Barre de vie avec traînée de dégât
// et flash de soin — tout est relié aux vraies stats de G.player.
import { G, ctx, W, TAU, finalWave } from '../state.js';
import { roundRect } from '../utils.js';
import { curWorld } from '../world.js';
import { activeSlot, slotMeta } from '../chars.js';
import { HPAL, metalFrame, medBar, engraved, gem } from './frame.js';

const PW = 316, PH = 118, PX = 14, PY = 10;

// portrait de chevalier procédural (heaume + nasal + panache or)
function drawPortrait(cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  // fond : disque métal sombre
  const bg = ctx.createRadialGradient(0, -r * 0.3, r * 0.2, 0, 0, r);
  bg.addColorStop(0, '#4a4038'); bg.addColorStop(1, '#1c1712');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, TAU); ctx.clip();
  // heaume : dôme acier
  const hg = ctx.createLinearGradient(0, -r, 0, r * 0.4);
  hg.addColorStop(0, '#cfd6dd'); hg.addColorStop(0.55, '#8d97a3'); hg.addColorStop(1, '#4c565f');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-r * 0.82, r * 0.45);
  ctx.quadraticCurveTo(-r * 0.85, -r * 0.75, 0, -r * 0.85);
  ctx.quadraticCurveTo(r * 0.85, -r * 0.75, r * 0.82, r * 0.45);
  ctx.closePath(); ctx.fill();
  // nasal central
  ctx.fillStyle = '#39424b';
  ctx.fillRect(-r * 0.09, -r * 0.55, r * 0.18, r * 0.85);
  // fente oculaire : lueur du regard
  const eyeGlow = 0.65 + Math.sin(G.time * 2.4) * 0.2;
  ctx.fillStyle = `rgba(120,200,255,${eyeGlow})`;
  ctx.fillRect(-r * 0.62, -r * 0.18, r * 1.24, r * 0.14);
  // rivets du heaume
  ctx.fillStyle = HPAL.gold;
  for (const a of [-0.7, 0, 0.7]) {
    ctx.beginPath(); ctx.arc(Math.sin(a) * r * 0.78, r * 0.28 + Math.cos(a) * r * 0.2, 1.6, 0, TAU); ctx.fill();
  }
  // panache / cimier or
  ctx.fillStyle = HPAL.gold;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.quadraticCurveTo(r * 0.25, -r * 1.15, r * 0.12, -r * 0.98);
  ctx.quadraticCurveTo(0, -r * 1.12, -r * 0.12, -r * 0.98);
  ctx.quadraticCurveTo(-r * 0.25, -r * 1.15, 0, -r * 0.85);
  ctx.fill();
  ctx.restore();
  // anneau métallique + gemme de niveau
  ctx.strokeStyle = HPAL.goldLo; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r + 1.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = HPAL.gold; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, TAU); ctx.stroke();
  ctx.restore();
}

export function drawProfile() {
  const p = G.player;
  const hpFrac = Math.max(0, Math.min(1, p.hp / p.maxHp));
  const now = G.time || 0;

  // ---- suivi dégâts / soins : traînée + flash ----
  if (G._hudHp === undefined) { G._hudHp = hpFrac; G._hudGhost = hpFrac; G._hudHurt = -9; G._hudHeal = -9; }
  if (hpFrac < G._hudHp - 0.0005) G._hudHurt = now;          // dégâts
  else if (hpFrac > G._hudHp + 0.0005) G._hudHeal = now;     // soins
  // la traînée se résorbe lentement vers la vie réelle
  G._hudGhost += (hpFrac - G._hudGhost) * Math.min(1, 0.045);
  if (hpFrac > G._hudGhost) G._hudGhost = hpFrac;
  G._hudHp = hpFrac;
  const hurtA = Math.max(0, 1 - (now - G._hudHurt) / 0.7);
  const healA = Math.max(0, 1 - (now - G._hudHeal) / 0.9);

  // ---- cadre du panneau ----
  const lowHp = hpFrac <= 0.3;
  metalFrame(PX, PY, PW, PH, 10, { glow: lowHp ? 'rgba(224,64,81,0.5)' : null });
  // gemme de statut en haut à droite du cadre (rouge si PV bas, or sinon)
  gem(PX + PW - 16, PY + 12, 5, lowHp ? HPAL.redHi : HPAL.green, 0.4);

  // ---- portrait + niveau ----
  const pcx = PX + 52, pcy = PY + 52, pr = 34;
  drawPortrait(pcx, pcy, pr);
  // badge niveau sous le portrait
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(pcx - 24, pcy + pr + 3, 48, 15, 7); ctx.fill();
  ctx.strokeStyle = HPAL.goldLo; ctx.lineWidth = 1;
  roundRect(pcx - 24, pcy + pr + 3, 48, 15, 7); ctx.stroke();
  engraved(`NIV ${p.level}`, pcx, pcy + pr + 14, 10, HPAL.goldHi, 'center', 'Consolas, monospace');

  // ---- texte héros : nom de campagne / monde + stats rapides ----
  const bx = pcx + pr + 10; // x de départ du bloc droit
  const bw = PX + PW - 16 - bx;
  const heroName = (slotMeta(activeSlot()) || {}).name || 'HÉROS';
  engraved(heroName.toUpperCase(), bx, PY + 24, 13, HPAL.parch, 'left');
  ctx.font = '10px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(216,196,154,0.75)';
  const wdef = curWorld() && curWorld().def;
  const waveTxt = G.wave >= finalWave() ? 'VAGUE FINALE' : `Vague ${G.wave}`;
  const t = Math.floor(G.runTime || 0);
  const statLine = `${wdef ? wdef.name + ' · ' : ''}${waveTxt} · ${G.kills} kills · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  ctx.fillText(statLine, bx, PY + 38);

  // ---- barre PV (rouge profond) avec traînée de dégât ----
  const barX = bx, barW = bw, barY = PY + 46, barH = 17;
  medBar(barX, barY, barW, barH, hpFrac, hurtA > 0 ? G._hudGhost : null,
    lowHp ? '#e0606a' : HPAL.redHi, lowHp ? '#6e1420' : HPAL.red,
    { glow: lowHp && hpFrac > 0.02 ? '#ff5a6a' : null });
  engraved('PV', barX + 2, barY + barH - 3, 9, 'rgba(255,235,220,0.95)', 'left', 'Consolas, monospace');
  engraved(`${Math.ceil(p.hp)}/${p.maxHp}`, barX + barW - 4, barY + barH - 3, 10, '#ffe9e9', 'right', 'Consolas, monospace');

  // ---- barre XP (or fin) ----
  const xpY = barY + barH + 7;
  medBar(barX, xpY, barW, 8, p.xp / p.xpNext, null, '#f0d488', '#8a6a2f', { glow: '#d4a84b' });
  engraved(`+${p.xpNext - p.xp} XP`, barX + 2, xpY + 8.5, 8.5, 'rgba(240,212,136,0.9)', 'left', 'Consolas, monospace');

  // ---- barre d'ultime (bleu magique / couleur de l'ulti choisi) ----
  const uY = xpY + 15;
  const ultSel = G.stats.ultSel || 'nuke';
  const ultInfo = ultSel === 'glace' && G.stats.iceUlt
    ? { name: 'PLUIE DE GLACE', barA: '#b3e5fc', barB: '#0277bd', glow: '#0288d1', ready: '#81d4fa' }
    : ultSel === 'hell' && G.stats.hellUlt
      ? { name: 'TITAN DE FEU', barA: '#ffab91', barB: '#bf360c', glow: '#e64a19', ready: '#ff7043' }
      : { name: 'BOMBE ATOMIQUE', barA: '#ffcc80', barB: '#7a2e0e', glow: '#ff5722', ready: '#ff8a65' };
  const ultReady = p.ultCharge >= 100;
  medBar(barX, uY, barW, 13, p.ultCharge / 100, null, ultInfo.barA, ultInfo.barB,
    { glow: ultReady ? ultInfo.glow : null });
  engraved(`[F] ${ultInfo.name}`, barX + 3, uY + 10.5, 9, ultReady ? ultInfo.ready : 'rgba(232,217,176,0.85)', 'left', 'Georgia, serif');
  engraved(`${Math.floor(p.ultCharge)}%`, barX + barW - 4, uY + 10.5, 9.5, '#f5eeda', 'right', 'Consolas, monospace');
  if (ultReady) {
    ctx.globalAlpha = 0.65 + Math.sin(G.time * 6) * 0.35;
    engraved('PRÊT !', barX + barW / 2, uY - 3, 10, ultInfo.ready, 'center', 'Consolas, monospace');
    ctx.globalAlpha = 1;
  }

  // ---- flèches de feedback PV (bordure qui s'embrase) ----
  if (hurtA > 0) {
    ctx.save();
    ctx.globalAlpha = hurtA * 0.55;
    ctx.strokeStyle = '#ff3b4e'; ctx.lineWidth = 3;
    roundRect(PX + 1.5, PY + 1.5, PW - 3, PH - 3, 9); ctx.stroke();
    ctx.restore();
  } else if (healA > 0) {
    ctx.save();
    ctx.globalAlpha = healA * 0.4;
    ctx.strokeStyle = HPAL.greenHi; ctx.lineWidth = 2.5;
    roundRect(PX + 1.5, PY + 1.5, PW - 3, PH - 3, 9); ctx.stroke();
    ctx.restore();
  }
  // runes discrètes sous le panneau
  // (supprimées : la ligne info est déjà dense — runes sur le cadre via metalFrame)
}

// ---------- Bouton fioles (haut droite) — style parchemin/cuivre ----------
export function drawPotionButton() {
  const p = G.player;
  const bx = W - 150, by = 14, bw = 136, bh = 40;
  const hasPotions = p.potions > 0, full = p.potions >= p.maxPotions;
  const rim = full ? '#ff80ab' : hasPotions ? HPAL.gold : HPAL.steelD;
  // cadre métal miniature
  const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
  bg.addColorStop(0, '#4a2f3d'); bg.addColorStop(1, '#2c1a24');
  ctx.fillStyle = bg;
  roundRect(bx, by, bw, bh, 9); ctx.fill();
  ctx.strokeStyle = rim; ctx.lineWidth = full || hasPotions ? 2 : 1.2;
  if (hasPotions) { ctx.shadowColor = 'rgba(255,128,171,0.7)'; ctx.shadowBlur = 10; }
  roundRect(bx + 1, by + 1, bw - 2, bh - 2, 8); ctx.stroke();
  ctx.shadowBlur = 0;
  // fiole stylisée : corps + goulot + lueur du liquide
  const fx = bx + 24, fy = by + bh / 2;
  ctx.save();
  ctx.translate(fx, fy);
  if (hasPotions) { ctx.shadowColor = '#ff8fb3'; ctx.shadowBlur = 8; }
  ctx.fillStyle = hasPotions ? '#ff5f8f' : '#5a4a55';
  // goulot
  ctx.fillRect(-3, -14, 6, 5);
  // corps rond
  ctx.beginPath(); ctx.arc(0, 2, 10, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  // verre : reflet
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(-3, -1, 3.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 2, 10, 0, TAU); ctx.stroke();
  ctx.restore();
  engraved('FIOLES', bx + 42, by + 16, 10, '#ffb3cd', 'left', 'Consolas, monospace');
  engraved(`${p.potions}/${p.maxPotions}`, bx + 42, by + 32, 14, hasPotions ? '#fff' : '#8d7f8a', 'left', 'Consolas, monospace');
  // touche W
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(bx + bw - 32, by + 8, 24, 24, 6); ctx.fill();
  ctx.strokeStyle = rim; ctx.lineWidth = 1.2;
  roundRect(bx + bw - 32, by + 8, 24, 24, 6); ctx.stroke();
  engraved('W', bx + bw - 20, by + 25, 13, '#ffb3cd', 'center', 'Consolas, monospace');
  // cooldown
  if (p.potionCooldown > 0) {
    ctx.fillStyle = 'rgba(10,6,8,0.72)';
    roundRect(bx, by, bw, bh, 9); ctx.fill();
    engraved(`${p.potionCooldown.toFixed(1)}s`, bx + bw / 2, by + bh / 2 + 5, 14, '#ff9ebb', 'center', 'Consolas, monospace');
  }
}
