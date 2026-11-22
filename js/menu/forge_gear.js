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

import { craftCells, forgeScroll, forgeScrollMax, itemDetail, forgeTab, invItems, heroSlots, heroColLayout, ultBtns, SLOT_LABEL } from './forge_state.js';

// ---------- ONGLET PERSONNAGE — refonte « Forge 2.0 » ----------
// 3 colonnes : PERSONNAGE + STATISTIQUES | mannequin + ÉQUIPEMENT | COMPÉTENCES
// bandeau bas : sélecteur d'ULTIME (gauche) + PROGRESSION (droite)

// en-tête de section : surtitre doré + filet
function secHead(text, x, y, w) {
  overline(text, x, y, C_GOLD);
  ctx.strokeStyle = 'rgba(212,176,98,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + w, y + 7); ctx.stroke();
}

export function drawHeroPaperdoll(L) {
  const CL = heroColLayout(L);
  drawHeroIdentity(CL.left);
  drawHeroStats(CL.left);
  drawEquipCenter(L, CL);
  drawSkillsColumn(CL.right);
  drawUltStrip(L);
  drawProgressionStrip(L);
}

// ---------- PERSONNAGE : nom, niveau record, historique ----------
function drawHeroIdentity(col) {
  const x = col.x + 14, w = col.w - 28;
  // sous-panneau PERSONNAGE
  panel(col.x + 6, col.y + 6, col.w - 12, 148);
  secHead('PERSONNAGE', x, col.y + 22, w);
  const meta = slotMeta(activeSlot());
  const s = slotSummary(activeSlot()) || {};
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe9a3'; ctx.font = `bold 21px ${SERIF}`;
  ctx.fillText(fitText(meta ? meta.name : 'Héros sans nom', w), x, col.y + 52);
  // badge niveau record
  const lvl = s.bestLevel || 1;
  ctx.fillStyle = 'rgba(255,215,64,0.14)';
  roundRect(x, col.y + 62, 108, 24, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.45)'; ctx.lineWidth = 1;
  roundRect(x, col.y + 62, 108, 24, 12); ctx.stroke();
  ctx.fillStyle = '#ffd740'; ctx.font = `bold 12px ${UI}`;
  ctx.fillText(`NIV. RECORD ${lvl}`, x + 54, col.y + 78);
  // historique : 2 colonnes × 3 lignes
  const rows = [
    ['📦', 'Parties', `${s.totalRuns || 0}`],
    ['🌊', 'Vague record', `${s.bestWave || 0}`],
    ['💀', 'Éliminations', `${(s.totalKills || 0).toLocaleString('fr-FR')}`],
    ['⏱', 'Temps de jeu', fmtPlaytime(s.playtime || 0)],
    ['🗺', 'Campagnes', `${Object.values(G.stats.campaignDone || {}).filter(Boolean).length}/5`]
  ];
  ctx.font = `11px ${UI}`;
  rows.forEach((r, i) => {
    const rx = x + (i % 2) * (w / 2), ry = col.y + 102 + Math.floor(i / 2) * 20;
    ctx.fillStyle = '#d4b062'; ctx.fillText(r[0], rx, ry);
    ctx.fillStyle = C_MUTED; ctx.fillText(r[1], rx + 18, ry);
    ctx.fillStyle = C_TEXT; ctx.font = `bold 11px ${UI}`;
    ctx.fillText(r[2], rx + 18 + ctx.measureText(r[1]).width + 8, ry);
    ctx.font = `11px ${UI}`;
  });
}

// ---------- STATISTIQUES : bonus dérivés de l'équipement, infobulles au survol ----------
function drawHeroStats(col) {
  const x = col.x + 14, w = col.w - 28;
  const py = col.y + 162;
  panel(col.x + 6, py, col.w - 12, col.h - 168);
  secHead('STATISTIQUES', x, py + 16, w);
  const b = equipBonuses(G.inv, 1);
  const rows = [];
  if (b.weaponMult > 1.001) rows.push({ icon: '⚔️', label: 'Dégâts', val: `+${Math.round((b.weaponMult - 1) * 100)} %`, tip: 'Multiplicateur de dégâts de toutes tes attaques' });
  if (b.armorReduce > 0) rows.push({ icon: '🛡️', label: 'Défense', val: `-${Math.round(b.armorReduce * 100)} %`, tip: 'Réduction des dégâts subis' });
  if (b.hp > 0) rows.push({ icon: '❤️', label: 'PV max', val: `+${b.hp}`, tip: 'Points de vie supplémentaires' });
  if (b.speed > 0) rows.push({ icon: '👟', label: 'Vitesse', val: `+${b.speed.toFixed(2)}`, tip: 'Vitesse de déplacement en plus' });
  if (b.xp > 1.001) rows.push({ icon: '✨', label: 'XP', val: `+${Math.round((b.xp - 1) * 100)} %`, tip: 'Expérience gagnée en plus' });
  if (b.potions > 0) rows.push({ icon: '🧪', label: 'Fioles', val: `+${b.potions}`, tip: 'Fioles supplémentaires' });
  if (b.potionMult > 1.001) rows.push({ icon: '🍶', label: 'Soins', val: `+${Math.round((b.potionMult - 1) * 100)} %`, tip: 'Efficacité des fioles' });
  if (b.ultR > 1.001) rows.push({ icon: '💥', label: 'Rayon ultime', val: `+${Math.round((b.ultR - 1) * 100)} %`, tip: 'Portée de ton ultime' });
  if (b.ultBoss > 0) rows.push({ icon: '👹', label: 'Boss', val: `+${Math.round(b.ultBoss * 100)} %`, tip: 'Dégâts bonus infligés aux boss' });
  if (!rows.length) rows.push({ icon: '—', label: 'Bonus', val: 'aucun', tip: 'Équipe des objets forgés pour gagner des bonus', dim: true });
  // grille 2 colonnes
  const cellW = w / 2, rh = 22;
  let hovTip = null;
  rows.forEach((r, i) => {
    const cx = x + (i % 2) * cellW, cy = py + 36 + Math.floor(i / 2) * rh;
    const cell = { x: cx, y: cy - 13, w: cellW - 8, h: rh };
    const hov = inR(cell, G.mouse.x, G.mouse.y);
    if (hov) hovTip = { r, x: cx, y: cy };
    if (hov) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(cell.x, cell.y, cell.w, cell.h, 6); ctx.fill(); }
    ctx.textAlign = 'left'; ctx.font = `12px ${UI}`;
    ctx.fillStyle = r.dim ? C_MUTED : '#d4b062'; ctx.fillText(r.icon, cx + 2, cy + 4);
    ctx.fillStyle = r.dim ? C_MUTED : C_TEXT; ctx.fillText(r.label, cx + 20, cy + 4);
    ctx.fillStyle = r.dim ? C_MUTED : '#ffe9a3'; ctx.font = `bold 11px Consolas, monospace`; ctx.textAlign = 'right';
    ctx.fillText(r.val, cx + cellW - 14, cy + 4);
  });
  // infobulle au survol
  if (hovTip) {
    const r = hovTip.r;
    ctx.font = `11px ${UI}`;
    const tw = ctx.measureText(r.tip).width;
    const bx = Math.min(Math.max(G.mouse.x + 14, 8), W - tw - 30);
    const by = G.mouse.y - 30;
    ctx.fillStyle = 'rgba(20,16,8,0.95)';
    roundRect(bx, by, tw + 18, 24, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(212,176,98,0.5)'; ctx.lineWidth = 1;
    roundRect(bx, by, tw + 18, 24, 7); ctx.stroke();
    ctx.fillStyle = '#efe8d6'; ctx.textAlign = 'left';
    ctx.fillText(r.tip, bx + 9, by + 16);
  }
}

// ---------- CENTRE : mannequin + emplacements d'équipement ----------
function drawEquipCenter(L, CL) {
  const top = CL.iy + 4;
  // en-tête de section au-dessus du mannequin
  secHead('ÉQUIPEMENT', CL.dcx - 110, top, 220);
  // positions partagées avec les clics (forge_state.heroSlots)
  const S2 = heroSlots(L);
  // halo doré doux derrière le mannequin
  ctx.save();
  const hg = ctx.createRadialGradient(S2.hx, S2.hy - 10, 10, S2.hx, S2.hy - 10, 130);
  hg.addColorStop(0, 'rgba(255,215,64,0.10)'); hg.addColorStop(1, 'rgba(255,215,64,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(S2.hx, S2.hy - 10, 130, 0, TAU); ctx.fill();
  ctx.restore();

  // ---- silhouette du héros (respiration discrète) ----
  const br = 1 + Math.sin((G.time || 0) * 1.3) * 0.008;
  const bob = Math.sin((G.time || 0) * 1.3 + 1) * 2;
  ctx.save();
  ctx.translate(S2.hx, S2.hy + bob);
  ctx.scale(br, br);
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
  let hovSlot = null;
  for (const slot of ['weapon', 'armor', 'charm', 'boots']) {
    const r = S2[slot], id = G.inv.equip[slot], it = id && ITEMS[id];
    const eq = !!it;
    const dur = eq ? getDur(G.inv, id) : 100;
    const tier = eq ? itemTier(it) : '#ffd740';
    const hov = inR(r, G.mouse.x, G.mouse.y);
    if (hov) hovSlot = { slot, it, r };
    // halo de rareté pulsant pour les objets équipés non communs
    if (eq && hov) {
      ctx.save();
      ctx.shadowColor = tier; ctx.shadowBlur = 14;
      ctx.strokeStyle = tier; ctx.lineWidth = 2.5;
      roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 12); ctx.stroke();
      ctx.restore();
    }
    // cadre : teinté de la rareté quand l'emplacement est occupé
    ctx.fillStyle = eq ? 'rgba(255,215,64,0.10)' : 'rgba(255,255,255,0.04)';
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = eq ? tier : (hov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)');
    ctx.lineWidth = eq ? 2 : 1;
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.stroke();
    // étiquette du slot en haut du cadre
    ctx.fillStyle = eq ? tier : '#90caf9'; ctx.font = 'bold 9px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(SLOT_LABEL[slot], r.x + r.w / 2, r.y + 11);
    if (it) {
      // icône centrée, nom dessous, mini barre de durabilité en bas
      const icY = r.y + r.h * 0.42;
      drawItemIcon(it, r.x + r.w / 2, icY, 19);
      ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.fillText(fitText(it.name, r.w - 12), r.x + r.w / 2, r.y + r.h - 22);
      const bw2 = r.w - 20, bx2 = r.x + 10, by2 = r.y + r.h - 12;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(bx2, by2, bw2, 3.5, 2); ctx.fill();
      if (dur > 0) {
        ctx.fillStyle = dur > 50 ? '#69f0ae' : dur > 25 ? '#ffd740' : '#ff5252';
        roundRect(bx2, by2, bw2 * dur / 100, 3.5, 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#546e7a'; ctx.font = '20px serif';
      ctx.fillText('—', r.x + r.w / 2, r.y + r.h * 0.5 + 6);
      ctx.fillStyle = '#455a64'; ctx.font = 'italic 9px Inter, sans-serif';
      ctx.fillText('vide', r.x + r.w / 2, r.y + r.h - 14);
    }
  }
  // infobulle : description de l'objet survolé (effet + rareté)
  if (hovSlot && hovSlot.it) {
    const it = hovSlot.it, tier = itemTier(it);
    const tip = `${it.name} — ${it.desc}`;
    ctx.font = `11px ${UI}`;
    const tw = ctx.measureText(tip).width;
    const bx = Math.min(Math.max(G.mouse.x + 14, 8), W - tw - 34);
    const by = Math.max(8, G.mouse.y - 34);
    ctx.fillStyle = 'rgba(20,16,8,0.95)';
    roundRect(bx, by, tw + 20, 26, 7); ctx.fill();
    ctx.strokeStyle = tier; ctx.lineWidth = 1.2;
    roundRect(bx, by, tw + 20, 26, 7); ctx.stroke();
    ctx.fillStyle = '#efe8d6'; ctx.textAlign = 'left';
    ctx.fillText(tip, bx + 10, by + 17);
  }
  // astuce discrète sous le mannequin
  ctx.fillStyle = '#78909c'; ctx.font = 'italic 11px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('clique un emplacement pour voir le détail', S2.hx, S2.hy + 140);
}

// ---------- COMPÉTENCES : cartes verticales des 3 types d'armes ----------
const SKILL_DEF = [
  { key: 'epee', icon: '⚔️', label: 'ÉPÉE', color: '#ffb74d', mode: 1 },
  { key: 'arc',  icon: '🏹', label: 'ARC',  color: '#b388ff', mode: 5 },
  { key: 'lance',icon: '🔱', label: 'LANCE',color: '#4fc3f7', mode: 3 }
];

function drawSkillsColumn(col) {
  const x = col.x + 14, w = col.w - 28;
  secHead('COMPÉTENCES', x, col.y + 20, w);
  ctx.fillStyle = C_MUTED; ctx.font = `italic 11px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('niveaux gagnés en combattant', x, col.y + 38);
  const cw = w, ch = 68, gap = 10;
  let y = col.y + 50;
  for (const sd of SKILL_DEF) {
    const locked = sd.key === 'arc' && !(G.stats && G.stats.bowUnlocked);
    drawSkillCard(x, y, cw, ch, sd, locked);
    y += ch + gap;
  }
  // note de bas de colonne
  ctx.fillStyle = '#78909c'; ctx.font = `italic 10px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText('chaque niveau : +0,5 % de dégâts', x + w / 2, y + 12);
}

function drawSkillCard(x, y, w, h, sd, locked) {
  const info = modeInfo(G.inv, sd.key);
  const hov = !locked && inR({ x, y, w, h }, G.mouse.x, G.mouse.y);
  const active = !locked && G.player.attackMode === sd.mode;
  ctx.fillStyle = locked ? 'rgba(20,16,40,0.55)' : (active ? hexA(sd.color, 0.16) : hov ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)');
  roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = active ? sd.color : (locked ? 'rgba(124,77,255,0.4)' : hov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)');
  ctx.lineWidth = active ? 2 : 1;
  roundRect(x, y, w, h, 10); ctx.stroke();
  ctx.globalAlpha = locked ? 0.55 : 1;
  // icône + nom + niveau
  ctx.textAlign = 'left'; ctx.font = `20px serif`;
  ctx.fillText(sd.icon, x + 12, y + 26);
  ctx.fillStyle = locked ? '#7c6aa8' : sd.color; ctx.font = `bold 14px ${UI}`;
  ctx.fillText(sd.label, x + 44, y + 24);
  ctx.fillStyle = locked ? '#5a5470' : '#ffe9a3'; ctx.font = `bold 15px Consolas, monospace`; ctx.textAlign = 'right';
  ctx.fillText(locked ? '???' : `NIV. ${info.lvl}`, x + w - 12, y + 25);
  ctx.fillStyle = locked ? '#5a5470' : '#8d99ae'; ctx.font = `10px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText(locked ? 'arme légendaire' : `+${Math.round((modeMult(G.inv, sd.key) - 1) * 100)} % de dégâts`, x + 44, y + 41);
  // badge « en cours » si c'est l'arme sélectionnée en jeu
  if (active) {
    ctx.fillStyle = sd.color; ctx.font = `bold 9px ${UI}`; ctx.textAlign = 'right';
    ctx.fillText('EN COURS', x + w - 12, y + 41);
  }
  if (locked) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(x, y, w, h, 10); ctx.fill();
    ctx.fillStyle = '#b388ff'; ctx.font = `bold 10px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText('🔒 VAINCRE L\'ABOMINATION COSMIQUE', x + w / 2, y + h - 12);
    ctx.globalAlpha = 1; return;
  }
  // barre d'XP
  const bx = x + 12, bw = w - 24, by = y + h - 14;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(bx, by, bw, 5, 2.5); ctx.fill();
  ctx.fillStyle = sd.color;
  roundRect(bx, by, bw * info.pct, 5, 2.5); ctx.fill();
  ctx.fillStyle = '#aab4c0'; ctx.font = `8.5px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText(info.lvl >= MODE_MAX_LVL ? 'NIVEAU MAX' : `${Math.floor(info.xp).toLocaleString('fr-FR')} / ${info.need.toLocaleString('fr-FR')} XP`, x + w / 2, by - 3);
  ctx.globalAlpha = 1;
}

// ---------- bandeau bas : ULTIME (gauche) + PROGRESSION (droite) ----------
function drawUltStrip(L) {
  const ub = ultBtns(L);
  const y = ub.nuke.y;
  // label
  ctx.fillStyle = C_GOLD; ctx.font = `bold 10px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('ULTIME · F', ub.nuke.x, y - 6);
  const sel = G.stats.ultSel || 'nuke';
  const iceOk = !!G.stats.iceUlt, hellOk = !!G.stats.hellUlt;
  const defs = [
    { k: 'nuke', r: ub.nuke, icon: '💣', label: 'BOMBE ATOMIQUE', sub: 'B-2 nucléaire', color: '#ffd740', locked: false },
    { k: 'glace', r: ub.glace, icon: '❄️', label: 'PLUIE DE GLACE', sub: iceOk ? 'pics : ralenti + -50 % dégâts' : 'coffre du Souverain', color: '#80d8ff', locked: !iceOk },
    { k: 'hell', r: ub.hell, icon: '🔥', label: 'TITAN DE FEU', sub: hellOk ? 'titan laser 10 s' : 'trône du Baron', color: '#ff7043', locked: !hellOk }
  ];
  for (const d of defs) {
    const on = sel === d.k && !d.locked;
    const hov = !d.locked && inR(d.r, G.mouse.x, G.mouse.y);
    ctx.globalAlpha = d.locked ? 0.45 : 1;
    ctx.fillStyle = on ? hexA(d.color, 0.35) : (hov ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)');
    roundRect(d.r.x, d.r.y, d.r.w, d.r.h, 8); ctx.fill();
    ctx.strokeStyle = on ? d.color : (hov ? '#fff' : 'rgba(255,255,255,0.2)');
    ctx.lineWidth = on ? 2 : 1;
    roundRect(d.r.x, d.r.y, d.r.w, d.r.h, 8); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = on ? '#fff' : d.locked ? '#78909c' : '#e0e0e0';
    ctx.font = `bold 12px ${UI}`;
    ctx.fillText(`${d.locked ? '🔒' : d.icon} ${d.label}`, d.r.x + 10, d.r.y + 15);
    ctx.fillStyle = d.locked ? '#546e7a' : (on ? d.color : '#90a4ae');
    ctx.font = `9px ${UI}`;
    ctx.fillText(fitText(d.sub, d.r.w - 14), d.r.x + 10, d.r.y + 28);
    if (on) { ctx.fillStyle = d.color; ctx.font = `bold 11px ${UI}`; ctx.textAlign = 'right'; ctx.fillText('✓', d.r.x + d.r.w - 8, d.r.y + 15); }
    ctx.globalAlpha = 1;
  }
}

function drawProgressionStrip(L) {
  const s = slotSummary(activeSlot()) || {};
  const done = Object.values(G.stats.campaignDone || {}).filter(Boolean).length;
  const ach = `${achievementCount()}/${ACHIEVEMENTS.length}`;
  const txt = `🏆 ${ach} succès · 🗺️ ${done}/5 campagnes · 🌊 vag. ${s.bestWave || 0} · 💀 ${(s.totalKills || 0).toLocaleString('fr-FR')} · ⏱ ${fmtPlaytime(s.playtime || 0)}`;
  const x = L.cx + L.cw - 20;
  ctx.textAlign = 'right'; ctx.font = `bold 11px ${UI}`; ctx.fillStyle = '#c9b98a';
  ctx.fillText(fitText(txt, 330), x, L.cy + L.ch - 30);
  ctx.fillStyle = C_MUTED; ctx.font = `9px ${UI}`;
  ctx.fillText('PROGRESSION', x, L.cy + L.ch - 42);
  ctx.textAlign = 'left';
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

