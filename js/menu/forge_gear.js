import { G, ctx, W, H, TAU, saveStats, finalWave } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { regenerateDecor } from '../graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from '../achievements.js';
import { ITEMS, MATS, ITEM_RARITY, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave } from '../inventory.js';
import { spawnEnemy, spawnFinalBoss } from '../enemies.js';
import { gainXp } from '../player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart } from '../world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm, sfxClick } from '../audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from '../chars.js';
import { inR, fitText, wrapLines, hexA, fmtTime, overline, panel, overlineCentered, drawMenuButton, drawAdminPwInput, menuButtons, menuButtonAt, adminUnlocked, campaignUnlocked, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, MENU_X, MENU_W, MENU_ITEMS } from './common.js';

import { invCells, invUI, invVisible, INV_CATS, forgeScroll, forgeScrollMax, itemDetail, forgeTab, heroColLayout, heroTabs, heroEquipRows, heroSkillCards, heroDoll, ultBtns, SLOT_LABEL, craftTabs, craftZones, craftUI, heroUI, upgradeCards, upgradeCost, upgradeXpGain } from './forge_state.js';

// ---------- ONGLET PERSONNAGE — refonte « Forge 2.0 » ----------
// 3 colonnes : PERSONNAGE + STATISTIQUES | mannequin + ÉQUIPEMENT | COMPÉTENCES
// bandeau bas : sélecteur d'ULTIME (gauche) + PROGRESSION (droite)

// en-tête de section : surtitre doré + filet
function secHead(text, x, y, w) {
  overline(text, x, y, C_GOLD);
  ctx.strokeStyle = 'rgba(212,176,98,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + w, y + 7); ctx.stroke();
}

// petit chip de sous-onglet (partagé dessin)
function chip(r, label, active, count) {
  const hov = inR(r, G.mouse.x, G.mouse.y);
  ctx.fillStyle = active ? 'rgba(255,215,64,0.22)' : hov ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
  roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  ctx.strokeStyle = active ? '#ffd740' : hov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.16)';
  ctx.lineWidth = active ? 2 : 1;
  roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
  ctx.fillStyle = active ? '#ffe9a3' : C_TEXT; ctx.font = `bold 11px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText(count !== undefined ? `${label} · ${count}` : label, r.x + r.w / 2, r.y + r.h / 2 + 4);
}

export function drawHeroPaperdoll(L) {
  const ht = heroTabs(L);
  chip(ht.apercu, 'APERÇU', heroUI.tab === 'apercu');
  chip(ht.stats, 'CARACTÉRISTIQUES', heroUI.tab === 'stats');
  if (heroUI.tab === 'stats') { drawHeroStatsTab(L); return; }
  const CL = heroColLayout(L);
  drawEquipList(L, CL.left);
  drawHeroCenter(L, CL);
  drawSkillsColumn(L, CL.right);
  drawBuffsNote(CL.right);
  drawUltStrip(L);
  drawProgressionStrip(L);
}

// ---------- ZONE GAUCHE : liste des 6 emplacements d'équipement ----------
function drawEquipList(L, col) {
  const rows = heroEquipRows(L);
  panel(col.x + 4, col.y, col.w - 8, col.h);
  secHead('ÉQUIPEMENT', col.x + 14, col.y + 16, col.w - 28);
  ctx.fillStyle = C_MUTED; ctx.font = `italic 10px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('clique une pièce pour son détail', col.x + 14, col.y + 32);
  rows.forEach(r => {
    const id = G.inv.equip[r.slot], it = id && ITEMS[id];
    const eq = !!it;
    const dur = eq ? getDur(G.inv, id) : 100;
    const broken = eq && dur <= 0;
    const tier = eq ? itemTier(it) : '#546e7a';
    const hov = inR(r, G.mouse.x, G.mouse.y);
    ctx.fillStyle = eq ? hexA(tier, 0.10) : hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)';
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = eq ? tier : hov ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = eq ? 1.6 : 1;
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.textAlign = 'left';
    if (it) {
      drawItemIcon(it, r.x + 24, r.y + r.h / 2, 15);
      ctx.fillStyle = broken ? '#ff8a80' : '#ffe9a3'; ctx.font = `bold 11.5px ${UI}`;
      ctx.fillText(fitText(it.name + (broken ? ' 💥' : ''), r.w - 70), r.x + 46, r.y + 17);
      ctx.fillStyle = tier; ctx.font = `9.5px ${UI}`;
      ctx.fillText(`${ITEM_RARITY[it.rar] || ''} · ${SLOT_LABEL[r.slot]}`, r.x + 46, r.y + 29);
      const dbx = r.x + 46, dbw = r.w - 56, dby = r.y + r.h - 8;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(dbx, dby, dbw, 4, 2); ctx.fill();
      const dc = dur > 50 ? '#69f0ae' : dur > 25 ? '#ffd740' : '#ff5252';
      if (dur > 0) { ctx.fillStyle = dc; roundRect(dbx, dby, dbw * dur / 100, 4, 2); ctx.fill(); }
    } else {
      ctx.fillStyle = '#546e7a'; ctx.font = '15px serif';
      ctx.fillText('—', r.x + 24, r.y + r.h / 2 + 5);
      ctx.fillStyle = '#455a64'; ctx.font = `italic 10.5px ${UI}`;
      ctx.fillText(`${SLOT_LABEL[r.slot]} : vide`, r.x + 46, r.y + r.h / 2 + 4);
    }
  });
}

// ---------- ZONE CENTRALE : mannequin + nom + niveau + records ----------
function drawHeroCenter(L, CL) {
  const D = heroDoll(L);
  const meta = slotMeta(activeSlot());
  const s = slotSummary(activeSlot()) || {};
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a3'; ctx.font = `bold 21px ${SERIF}`;
  ctx.fillText(fitText(meta ? meta.name : 'Héros sans nom', 320), D.x, D.y - 126);
  ctx.fillStyle = 'rgba(255,215,64,0.14)';
  roundRect(D.x - 62, D.y - 116, 124, 22, 11); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.45)'; ctx.lineWidth = 1;
  roundRect(D.x - 62, D.y - 116, 124, 22, 11); ctx.stroke();
  ctx.fillStyle = '#ffd740'; ctx.font = `bold 11px ${UI}`;
  ctx.fillText(`NIV. RECORD ${s.bestLevel || 1}`, D.x, D.y - 101);

  ctx.save();
  const hg = ctx.createRadialGradient(D.x, D.y - 20, 10, D.x, D.y - 20, 130);
  hg.addColorStop(0, 'rgba(255,215,64,0.10)'); hg.addColorStop(1, 'rgba(255,215,64,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(D.x, D.y - 20, 130, 0, TAU); ctx.fill();
  ctx.restore();
  drawDoll(D.x, D.y);

  // records en ligne sous le mannequin
  const recs = [
    ['📦', `${s.totalRuns || 0} parties`], ['🌊', `vag. ${s.bestWave || 0}`],
    ['💀', `${(s.totalKills || 0).toLocaleString('fr-FR')} kills`], ['⏱', fmtPlaytime(s.playtime || 0)]
  ];
  const rw = 120, gap = 10, rx0 = D.x - (recs.length * rw + (recs.length - 1) * gap) / 2;
  const ry = D.y + 104;
  recs.forEach((r, i) => {
    const rx = rx0 + i * (rw + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(rx, ry, rw, 32, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,64,0.25)'; ctx.lineWidth = 1;
    roundRect(rx, ry, rw, 32, 8); ctx.stroke();
    ctx.fillStyle = '#d4b062'; ctx.font = `12px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText(r[0], rx + 20, ry + 20);
    ctx.fillStyle = '#e8e0c8'; ctx.font = `bold 10.5px ${UI}`;
    ctx.fillText(fitText(String(r[1]), rw - 48), rx + rw / 2 + 8, ry + 20);
  });
}

// mannequin du héros (respiration discrète)
function drawDoll(hx, hy) {
  const br = 1 + Math.sin((G.time || 0) * 1.3) * 0.008;
  const bob = Math.sin((G.time || 0) * 1.3 + 1) * 2;
  ctx.save();
  ctx.translate(hx, hy + bob);
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
}

// ---------- COMPÉTENCES : cartes verticales des 3 types d'armes ----------
const SKILL_DEF = [
  { key: 'epee', icon: '⚔️', label: 'ÉPÉE', color: '#ffb74d', mode: 1 },
  { key: 'arc',  icon: '🏹', label: 'ARC',  color: '#b388ff', mode: 5 },
  { key: 'lance',icon: '🔱', label: 'LANCE',color: '#4fc3f7', mode: 3 }
];

function drawSkillsColumn(L, col) {
  const x = col.x + 14, w = col.w - 28;
  secHead('COMPÉTENCES', x, col.y + 20, w);
  ctx.fillStyle = C_MUTED; ctx.font = `italic 11px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('niveaux gagnés en combattant', x, col.y + 38);
  ctx.fillStyle = '#8d99ae'; ctx.font = `italic 10px ${UI}`;
  ctx.fillText('clique une carte pour l\'emporter — 2 armes max par partie', x, col.y + 50);
  const cards = heroSkillCards(L);
  for (const card of cards) {
    const sd = SKILL_DEF.find(d => d.key === card.key);
    const locked = sd.key === 'arc' && !(G.stats && G.stats.bowUnlocked);
    drawSkillCard(card.x, card.y, card.w, card.h, sd, locked);
  }
  // note de bas de colonne
  const yEnd = cards[cards.length - 1].y + cards[cards.length - 1].h;
  ctx.fillStyle = '#78909c'; ctx.font = `italic 10px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText('dégâts ×2 au niv. 100 (progression exponentielle)', x + w / 2, yEnd + 14);
}

function drawSkillCard(x, y, w, h, sd, locked) {
  const info = modeInfo(G.inv, sd.key);
  const hov = !locked && inR({ x, y, w, h }, G.mouse.x, G.mouse.y);
  const active = !locked && G.player.attackMode === sd.mode;
  const carried = !locked && (G.inv.weapons || []).includes(sd.key);
  ctx.fillStyle = locked ? 'rgba(20,16,40,0.55)' : (active ? hexA(sd.color, 0.16) : carried ? hexA(sd.color, 0.08) : hov ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)');
  roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = active ? sd.color : carried ? hexA(sd.color, 0.7) : (locked ? 'rgba(124,77,255,0.4)' : hov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)');
  ctx.lineWidth = active || carried ? 2 : 1;
  roundRect(x, y, w, h, 10); ctx.stroke();
  ctx.globalAlpha = locked || (!carried && !active) ? 0.55 : 1;
  // icône + nom + niveau
  ctx.textAlign = 'left'; ctx.font = `20px serif`;
  ctx.fillText(sd.icon, x + 12, y + 26);
  ctx.fillStyle = locked ? '#7c6aa8' : sd.color; ctx.font = `bold 14px ${UI}`;
  ctx.fillText(sd.label, x + 44, y + 24);
  ctx.fillStyle = locked ? '#5a5470' : '#ffe9a3'; ctx.font = `bold 15px Consolas, monospace`; ctx.textAlign = 'right';
  ctx.fillText(locked ? '???' : `NIV. ${info.lvl}`, x + w - 12, y + 25);
  ctx.fillStyle = locked ? '#5a5470' : '#8d99ae'; ctx.font = `10px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText(locked ? 'arme légendaire' : `+${Math.round((modeMult(G.inv, sd.key) - 1) * 100)} % de dégâts`, x + 44, y + 41);
  // badge d'état : EN COURS (arme active) > EMPORTÉE (chargement) > NON EMPORTÉE
  if (active || carried) {
    ctx.fillStyle = active ? sd.color : '#81c784'; ctx.font = `bold 9px ${UI}`; ctx.textAlign = 'right';
    ctx.fillText(active ? 'EN COURS' : 'EMPORTÉE', x + w - 12, y + 41);
  } else {
    ctx.fillStyle = '#546e7a'; ctx.font = `bold 9px ${UI}`; ctx.textAlign = 'right';
    ctx.fillText('NON EMPORTÉE', x + w - 12, y + 41);
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

// ---------- SOUS-ONGLET CARACTÉRISTIQUES : toutes les stats réelles ----------
function drawHeroStatsTab(L) {
  const CL = heroColLayout(L);
  const x = CL.ix + 10, w = CL.iw - 20, y = CL.iy + 6, h = CL.ih - 12;
  panel(CL.ix + 4, y, CL.iw - 8, h);
  secHead('CARACTÉRISTIQUES', x, y + 18, w);
  const b = equipBonuses(G.inv, 1);
  const buffs = G.inv.buffs || {};
  const baseHp = (G.campaign === 4 ? 500 : G.campaign === 3 ? 400 : G.campaign === 2 ? 300 : G.campaign === 1 ? 200 : 100);
  const maxHp = baseHp + b.hp + (buffs.hp || 0);
  const p = G.player || {};
  const modeKey = { 1: 'epee', 3: 'lance', 5: 'arc' }[p.attackMode] || 'epee';
  const wMult = b.weaponMult * modeMult(G.inv, modeKey);
  const rows = [
    { icon: '❤️', label: 'Points de vie', val: `${Math.round(p.hp ?? maxHp)} / ${maxHp}`, tip: `Base ${baseHp} + équipement ${b.hp > 0 ? '+' + b.hp : '0'}${buffs.hp ? ' + consommables +' + buffs.hp : ''}` },
    { icon: '⚔️', label: 'Dégâts de base', val: `${p.attackDamage ?? 30}`, tip: 'Dégâts d\'une attaque de base' },
    { icon: '🌀', label: 'Dégâts rotation', val: `${p.spinDamage ?? 70}`, tip: 'Dégâts du tourbillon' },
    { icon: '💥', label: 'Bonus dégâts', val: `+${Math.round((wMult - 1) * 100)} %`, tip: `Artefacts ${b.weaponMult > 1 ? '+' + Math.round((b.weaponMult - 1) * 100) + '%' : 'aucun'} × niveau arme ${modeKey} +${Math.round((modeMult(G.inv, modeKey) - 1) * 100)} %` },
    { icon: '🛡️', label: 'Défense', val: `-${Math.round(b.armorReduce * 100)} %`, tip: 'Réduction des dégâts subis (armure + casque)' },
    { icon: '👟', label: 'Vitesse', val: (p.speed ?? 3.4).toFixed(2), tip: `Déplacement en cases/sec (base +${b.speed.toFixed(2)} équipement)` },
    { icon: '✨', label: 'Bonus XP', val: `+${Math.round((b.xp - 1) * 100)} %`, tip: 'Expérience gagnée en plus' },
    { icon: '🍶', label: 'Efficacité soins', val: `+${Math.round((b.potionMult - 1) * 100)} %`, tip: 'Efficacité des fioles' },
    { icon: '🧪', label: 'Fioles max', val: `${3 + b.potions + (buffs.potions || 0)}`, tip: 'Base 3 + gourdes + consommables' },
    { icon: '💥', label: 'Rayon ultime', val: `+${Math.round((b.ultR - 1) * 100)} %`, tip: 'Portée de l\'ultime (touche F)' },
    { icon: '👹', label: 'Dégâts boss (ult.)', val: `+${Math.round(b.ultBoss * 100)} %`, tip: 'Dégâts bonus de l\'ultime sur les boss' }
  ];
  const cols = 2, cw = (w - 20) / cols, rh = 34, x0 = x + 10, y0 = y + 40;
  rows.forEach((r, i) => {
    const cx = x0 + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * rh;
    const hov = inR({ x: cx, y: cy - 14, w: cw - 10, h: rh }, G.mouse.x, G.mouse.y);
    if (hov) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(cx, cy - 14, cw - 10, rh, 7); ctx.fill(); }
    ctx.textAlign = 'left'; ctx.font = `13px ${UI}`;
    ctx.fillStyle = '#d4b062'; ctx.fillText(r.icon, cx + 4, cy + 2);
    ctx.fillStyle = C_TEXT; ctx.fillText(fitText(r.label, cw * 0.45), cx + 26, cy + 2);
    ctx.fillStyle = '#ffe9a3'; ctx.font = `bold 12.5px Consolas, monospace`; ctx.textAlign = 'right';
    ctx.fillText(r.val, cx + cw - 16, cy + 2);
    ctx.textAlign = 'left'; ctx.font = `italic 10px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText(fitText(r.tip, cw - 30), cx + 26, cy + 15);
  });
  // niveaux d'armes en bas
  const wy = y0 + Math.ceil(rows.length / cols) * rh + 8;
  secHead('NIVEAUX D\'ARMES', x + 10, wy, w - 20);
  const cw3 = (w - 40) / 3;
  SKILL_DEF.forEach((sd, i) => {
    const info = modeInfo(G.inv, sd.key);
    const locked = sd.key === 'arc' && !(G.stats && G.stats.bowUnlocked);
    const cx = x0 + i * cw3;
    ctx.fillStyle = locked ? 'rgba(20,16,40,0.5)' : 'rgba(255,255,255,0.05)';
    roundRect(cx, wy + 14, cw3 - 14, 44, 8); ctx.fill();
    ctx.strokeStyle = locked ? 'rgba(124,77,255,0.4)' : sd.color; ctx.lineWidth = 1.2;
    roundRect(cx, wy + 14, cw3 - 14, 44, 8); ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = `13px serif`;
    ctx.fillText(sd.icon, cx + 10, wy + 33);
    ctx.fillStyle = locked ? '#7c6aa8' : sd.color; ctx.font = `bold 11.5px ${UI}`;
    ctx.fillText(locked ? 'ARC VERROUILLÉ' : sd.label, cx + 32, wy + 30);
    ctx.fillStyle = '#ffe9a3'; ctx.font = `bold 11px Consolas, monospace`; ctx.textAlign = 'right';
    ctx.fillText(locked ? '🔒' : `NIV ${info.lvl} · +${Math.round((modeMult(G.inv, sd.key) - 1) * 100)}%`, cx + cw3 - 24, wy + 30);
    ctx.fillStyle = '#8d99ae'; ctx.font = `9.5px ${UI}`; ctx.textAlign = 'left';
    ctx.fillText(locked ? 'boss final du monde 9' : `+0,5 % dégâts / niveau — ${Math.floor(info.xp).toLocaleString('fr-FR')}/${info.need.toLocaleString('fr-FR')} XP`, cx + 32, wy + 45);
  });
}

// note des bonus permanents des consommables (sous les compétences)
function drawBuffsNote(col) {
  const buffs = G.inv.buffs || {};
  if (!buffs.hp && !buffs.potions) return;
  const y = col.y + col.h - 58;
  ctx.fillStyle = '#69f0ae'; ctx.font = `bold 10px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('BONUS CONSOMMABLES', col.x + 14, y);
  ctx.fillStyle = C_MUTED; ctx.font = `10px ${UI}`;
  let yy = y + 15;
  if (buffs.hp) { ctx.fillText(`+${buffs.hp} PV max`, col.x + 14, yy); yy += 14; }
  if (buffs.potions) { ctx.fillText(`+${buffs.potions} fiole max`, col.x + 14, yy); }
}

export function drawForgeInv(L) {
  const g = invCells(L);
  // ---------- onglets catégories ----------
  g.tabs.forEach(t => chip(t.r, t.label, invUI.cat === t.key, t.count));
  // ---------- barre d'outils : recherche + tri + rareté ----------
  const s = g.search;
  const focused = !!G.invQueryFocus;
  ctx.fillStyle = focused ? 'rgba(255,215,64,0.10)' : 'rgba(255,255,255,0.05)';
  roundRect(s.x, s.y, s.w, s.h, 8); ctx.fill();
  ctx.strokeStyle = focused ? '#ffd740' : 'rgba(255,255,255,0.22)'; ctx.lineWidth = focused ? 2 : 1;
  roundRect(s.x, s.y, s.w, s.h, 8); ctx.stroke();
  ctx.fillStyle = '#78909c'; ctx.font = `11px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('🔍', s.x + 10, s.y + 20);
  const q = G.invQuery || '';
  ctx.fillStyle = q ? C_TEXT : '#546e7a'; ctx.font = `12px ${UI}`;
  ctx.fillText(fitText(q || 'Rechercher un objet…', s.w - 24), s.x + 30, s.y + 20);
  if (focused && Math.floor((G.time || 0) * 2) % 2 === 0) {
    const tw = ctx.measureText(fitText(q, s.w - 40)).width;
    ctx.fillStyle = '#ffd740'; ctx.fillRect(s.x + 30 + Math.min(tw, s.w - 44), s.y + 8, 2, 16);
  }
  const sortNames = { name: '⇅ Tri : Nom', rar: '⇅ Tri : Rareté', slot: '⇅ Tri : Catégorie' };
  chip(g.sortBtn, sortNames[invUI.sort], false);
  const rarNames = { all: '◆ Toutes raretés', commun: '◆ Commun', rare: '◆ Rare', epique: '◆ Épique', legendaire: '◆ Légendaire' };
  chip(g.rarBtn, rarNames[invUI.rar], invUI.rar !== 'all');
  // compteur
  ctx.fillStyle = C_MUTED; ctx.font = `11px ${UI}`; ctx.textAlign = 'left';
  const nItems = invUI.cat === 'mats' ? Object.keys(MATS).length : invVisibleCount();
  ctx.fillText(`${nItems} élément${nItems > 1 ? 's' : ''}`, g.countTxt.x, g.countTxt.y);
  // ---------- grille (clip + scroll) ----------
  ctx.save();
  ctx.beginPath(); ctx.rect(g.view.x, g.view.y, g.view.w, g.view.h); ctx.clip();
  ctx.translate(0, -forgeScroll);
  if (invUI.cat === 'mats') {
    g.cells.forEach(c => drawMatCell(c));
  } else {
    g.cells.forEach(c => drawInvCell(c));
    if (!g.cells.length) {
      ctx.fillStyle = '#546e7a'; ctx.font = `italic 13px ${UI}`; ctx.textAlign = 'center';
      ctx.fillText(q ? 'Aucun objet ne correspond à la recherche' : 'Aucun objet dans cette catégorie', g.view.x + g.view.w / 2, g.view.y + 60);
    }
  }
  ctx.restore();
  // scrollbar
  const smax = forgeScrollMax();
  if (smax > 0) {
    const tx = g.view.x + g.view.w - 12, ty = g.view.y, th = g.view.h;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(tx, ty, 6, th, 3); ctx.fill();
    const thumbH = Math.max(24, th * (th / (th + smax)));
    const thumbY = ty + (th - thumbH) * (forgeScroll / smax);
    ctx.fillStyle = 'rgba(255,215,64,0.6)';
    roundRect(tx, thumbY, 6, thumbH, 3); ctx.fill();
  }
}

function invVisibleCount() { return invVisible().length; }

// cellule objet de la grille inventaire
function drawInvCell(c) {
  const it = ITEMS[c.id];
  if (!it) return;
  const tier = itemTier(it);
  const qty = it.conso ? (G.inv.items[c.id] || 0) : 0;
  const equipped = !it.conso && Object.values(G.inv.equip).includes(c.id);
  const dur = it.conso ? 100 : getDur(G.inv, c.id);
  const broken = dur <= 0;
  const hov = inR(c, G.mouse.x, G.mouse.y + forgeScroll);
  // fond teinté rareté + survol
  ctx.fillStyle = broken ? 'rgba(255,60,60,0.10)' : equipped ? hexA(tier, 0.16) : hov ? 'rgba(255,255,255,0.09)' : hexA(tier, 0.05);
  roundRect(c.x, c.y, c.w, c.h, 9); ctx.fill();
  ctx.strokeStyle = broken ? '#ff5252' : equipped ? tier : hov ? 'rgba(255,255,255,0.4)' : hexA(tier, 0.45);
  ctx.lineWidth = equipped || hov ? 2 : 1.2;
  roundRect(c.x, c.y, c.w, c.h, 9); ctx.stroke();
  // icône
  drawItemIcon(it, c.x + c.w / 2, c.y + 30, 20);
  // nom + rareté
  ctx.textAlign = 'center';
  ctx.fillStyle = broken ? '#ff8a80' : '#ffe9a3'; ctx.font = `bold 10.5px ${UI}`;
  ctx.fillText(fitText(it.name, c.w - 12), c.x + c.w / 2, c.y + 60);
  ctx.fillStyle = tier; ctx.font = `8.5px ${UI}`;
  ctx.fillText(ITEM_RARITY[it.rar] || '', c.x + c.w / 2, c.y + 73);
  // badges : quantité conso / équipé / cassé / durabilité
  if (it.conso) {
    ctx.fillStyle = '#b9f6ca'; ctx.font = `bold 11px Consolas, monospace`;
    ctx.fillText(`×${qty}`, c.x + c.w - 14, c.y + 16);
  } else if (equipped) {
    ctx.fillStyle = tier; ctx.font = `bold 10px ${UI}`;
    ctx.fillText('✓ ÉQUIPÉ', c.x + c.w / 2, c.y + 86);
  } else if (broken) {
    ctx.fillStyle = '#ff8a80'; ctx.font = `bold 9.5px ${UI}`;
    ctx.fillText('💥 CASSÉ', c.x + c.w / 2, c.y + 86);
  } else if (dur < 100) {
    ctx.fillStyle = '#8d99ae'; ctx.font = `9px ${UI}`;
    ctx.fillText(`${Math.round(dur)} %`, c.x + c.w / 2, c.y + 86);
  }
}

// cellule matériau (lecture seule : icône + nom + stock)
function drawMatCell(c) {
  const m = c.mat, info = MATS[m];
  const n = G.inv.mats[m] || 0;
  const hov = inR(c, G.mouse.x, G.mouse.y + forgeScroll);
  ctx.fillStyle = hov ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
  roundRect(c.x, c.y, c.w, c.h, 9); ctx.fill();
  ctx.strokeStyle = hov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.2;
  roundRect(c.x, c.y, c.w, c.h, 9); ctx.stroke();
  drawMatIcon(m, c.x + c.w / 2, c.y + 26, 12);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e0c8'; ctx.font = `bold 11.5px ${UI}`;
  ctx.fillText(info.name, c.x + c.w / 2, c.y + 56);
  ctx.fillStyle = '#ffd740'; ctx.font = `bold 15px Consolas, monospace`;
  ctx.fillText(`×${n.toLocaleString('fr-FR')}`, c.x + c.w / 2, c.y + 76);
}

