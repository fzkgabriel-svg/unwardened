import { G, ctx, W, H, TAU, saveStats, finalWave } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { regenerateDecor } from '../graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from '../achievements.js';
import { ITEMS, MATS, ITEM_RARITY, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave, loadoutOf, DUR_MAX, durState, durMaxOf } from '../inventory.js';
import { spawnEnemy, spawnFinalBoss } from '../enemies.js';
import { gainXp } from '../player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart } from '../world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm, sfxClick } from '../audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from '../chars.js';
import { inR, fitText, wrapLines, hexA, fmtTime, overline, panel, overlineCentered, drawMenuButton, drawAdminPwInput, menuButtons, menuButtonAt, adminUnlocked, campaignUnlocked, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, MENU_X, MENU_W, MENU_ITEMS } from './common.js';

import { invCells, invUI, invVisible, INV_CATS, forgeScroll, forgeScrollMax, itemDetail, weaponDetail, weaponDetailLayout, forgeTab, heroColLayout, heroTabs, heroEquipRows, heroSkillCards, heroDoll, ultBtns, SLOT_LABEL, craftTabs, craftZones, craftUI, heroUI, upgradeCards, upgradeCost, upgradeXpGain } from './forge_state.js';

// ---------- ONGLET PERSONNAGE — refonte « Forge 2.0 » ----------
// 3 colonnes : PERSONNAGE + STATISTIQUES | mannequin + ÉQUIPEMENT | COMPÉTENCES
// bandeau bas : sélecteur d'ULTIME (gauche) + PROGRESSION (droite)

// en-tête de section : surtitre doré + filet
function secHead(text, x, y, w, align = 'left') {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = align;
  overline(text, x, y, C_GOLD);
  ctx.strokeStyle = 'rgba(212,176,98,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + w, y + 7); ctx.stroke();
  ctx.textAlign = prevAlign;
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
  drawUltStrip(L);
  drawBuffsNote(L);
  drawProgressionStrip(L);
}

// ---------- ZONE GAUCHE : liste des 6 emplacements d'équipement ----------
function drawEquipList(L, col) {
  const rows = heroEquipRows(L);
  panel(col.x + 4, col.y, col.w - 8, col.h);
  secHead('ÉQUIPEMENT', col.x + col.w / 2, col.y + 16, col.w - 28, 'center');
  rows.forEach(r => {
    const id = G.inv.equip[r.slot], it = id && ITEMS[id];
    const eq = !!it;
    const dur = eq ? getDur(G.inv, id) : durMaxOf(id);
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
      drawItemIcon(it, r.x + 26, r.y + r.h / 2, 16);
      ctx.fillStyle = broken ? '#ff8a80' : '#ffe9a3'; ctx.font = `bold 12px ${UI}`;
      ctx.fillText(fitText(it.name + (broken ? ' 💥' : ''), r.w - 76), r.x + 50, r.y + 20);
      ctx.fillStyle = tier; ctx.font = `9.5px ${UI}`;
      ctx.fillText(`${ITEM_RARITY[it.rar] || ''} · ${SLOT_LABEL[r.slot]}`, r.x + 50, r.y + 34);
      const dbx = r.x + 50, dbw = r.w - 72, dby = r.y + r.h - 11; // largeur réduite pour rester dans le cadre
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(dbx, dby, dbw, 4, 2); ctx.fill();
      const dst = durState(dur, durMaxOf(id));
      const dc = dst === 'ok' ? '#69f0ae' : dst === 'warn' ? '#ffd740' : '#ff5252';
      if (dur > 0) { ctx.fillStyle = dc; roundRect(dbx, dby, dbw * dur / durMaxOf(id), 4, 2); ctx.fill(); }
    } else {
      ctx.fillStyle = '#546e7a'; ctx.font = '16px serif';
      ctx.fillText('—', r.x + 26, r.y + r.h / 2 + 6);
      ctx.fillStyle = '#455a64'; ctx.font = `italic 11px ${UI}`;
      ctx.fillText(`${SLOT_LABEL[r.slot]} : vide`, r.x + 50, r.y + r.h / 2 + 5);
    }
  });
}

// ---------- ZONE CENTRALE : mannequin + nom + niveau + records ----------
function drawHeroCenter(L, CL) {
  const D = heroDoll(L);
  ctx.save();
  const hg = ctx.createRadialGradient(D.x, D.y - 20, 10, D.x, D.y - 20, 130);
  hg.addColorStop(0, 'rgba(255,215,64,0.10)'); hg.addColorStop(1, 'rgba(255,215,64,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(D.x, D.y - 20, 130, 0, TAU); ctx.fill();
  ctx.restore();
  drawDoll(D.x, D.y);
  // nom, niveau et records du personnage : affichés dans le menu principal, retirés d'ici
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,233,163,0.75)'; ctx.font = `italic 12px ${UI}`;
  ctx.fillText('aperçu du héros équipé', D.x, D.y + 96);
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

// ---------- COMPÉTENCES : cartes des 4 types d'armes + emplacements 1/2 ----------
const SKILL_DEF = [
  { key: 'epee',    icon: '⚔️', label: 'ÉPÉE',      color: '#ffb74d', mode: 1, rarity: 'ARME' },
  { key: 'lance',   icon: '🔱', label: 'LANCE',     color: '#4fc3f7', mode: 3, rarity: 'ARME' },
  { key: 'gardien', icon: '⚖️', label: 'JUGEMENT',  color: '#a7ffeb', mode: 7, rarity: 'LÉGENDAIRE' },
  { key: 'arc',     icon: '🏹', label: 'ARC',       color: '#b388ff', mode: 5, rarity: 'LÉGENDAIRE' }
];
// descriptions des attaques pour la fiche détaillée (carte corps = fiche)
const WEAPON_INFO = {
  epee: {
    name: 'Épée du Royaume', rarity: 'Commune',
    desc: 'Arme polyvalente et équilibrée, maniée d\'une main.',
    atk: 'Attaque : balayage en arc large, cadence rapide.',
    sec: 'Rotation (clic droit) : tourbillon infligeant des dégâts radiaux — recharge 5 s.'
  },
  lance: {
    name: 'Lance du Garde', rarity: 'Rare',
    desc: 'Arme de portée : perce les rangs sans s\'exposer.',
    atk: 'Attaque : estoc perforant vers l\'avant, cadence vive.',
    sec: 'Bouclier (clic droit) : dôme qui réduit les dégâts de 85 % pendant 3 s — recharge 10 s.'
  },
  gardien: {
    name: 'Le Jugement du Gardien', rarity: 'Légendaire',
    desc: 'Couteau de lancer forgé pour un gardien oublié. Métal sombre, or gravé et runes, cristal ancestral au pommeau. Arme de proximité : dévastatrice à bout portant, faible à distance.',
    atk: 'Attaque : lancer du couteau — il tournoie, transperce jusqu\'à 3 ennemis puis revient. Dégâts élevés à courte distance, fortement réduits à longue portée. Les impacts enchaînés montent un combo (rythme et puissance).',
    sec: 'Sentence ancestrale (clic droit) : 0,85 s de concentration, le cristal libère 4 lames spectrales en éventail puis une lame finale — dégâts fixes identiques à toute distance — recharge 10 s.'
  },
  arc: {
    name: 'Arc Cinétique Cosmique', rarity: 'Légendaire',
    desc: 'Relique de l\'Abomination Cosmique, distord l\'espace-temps.',
    atk: 'Attaque : flèches d\'énergie à charge, portées extrêmes.',
    sec: 'Singularité (clic droit) : zone de distorsion aspirant les ennemis — recharge 12,5 s.'
  }
};

function drawSkillsColumn(L, col) {
  const x = col.x + 14, w = col.w - 28;
  secHead('COMPÉTENCES · 1/2 = EMPLACEMENTS', x, col.y + 20, w);
  const cards = heroSkillCards(L);
  for (const card of cards) {
    const sd = SKILL_DEF.find(d => d.key === card.key);
    const locked = (sd.key === 'arc' && !(G.stats && G.stats.bowUnlocked))
      || (sd.key === 'gardien' && !(G.stats && G.stats.gardienUnlocked));
    drawSkillCard(card.x, card.y, card.w, card.h, sd, locked, card.z1, card.z2);
  }
}

function drawSkillCard(x, y, w, h, sd, locked, z1, z2) {
  const info = modeInfo(G.inv, sd.key);
  const hov = !locked && inR({ x, y, w, h }, G.mouse.x, G.mouse.y);
  const l = loadoutOf(G.inv);
  const in1 = l.s1 === sd.key, in2 = l.s2 === sd.key;
  const active = !locked && G.player.attackMode === sd.mode && (in1 || in2);
  const equipped = in1 || in2;
  ctx.fillStyle = locked ? 'rgba(20,16,40,0.55)' : (active ? hexA(sd.color, 0.16) : equipped ? hexA(sd.color, 0.08) : hov ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)');
  roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = active ? sd.color : equipped ? hexA(sd.color, 0.7) : (locked ? 'rgba(124,77,255,0.4)' : hov ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)');
  ctx.lineWidth = active || equipped ? 2 : 1;
  roundRect(x, y, w, h, 10); ctx.stroke();
  ctx.globalAlpha = locked || !equipped ? 0.55 : 1;
  // icône + nom + niveau
  ctx.textAlign = 'left'; ctx.font = `20px serif`;
  ctx.fillText(sd.icon, x + 12, y + 26);
  ctx.fillStyle = locked ? '#7c6aa8' : sd.color; ctx.font = `bold 14px ${UI}`;
  ctx.fillText(sd.label, x + 44, y + 24);
  ctx.fillStyle = locked ? '#5a5470' : '#ffe9a3'; ctx.font = `bold 15px Consolas, monospace`; ctx.textAlign = 'right';
  ctx.fillText(locked ? '???' : `NIV. ${info.lvl}`, x + w - 12, y + 25);
  // ligne stats (gauche) — le badge d'emplacement est en haut à droite
  // pour ne plus chevaucher le texte
  ctx.fillStyle = locked ? '#5a5470' : '#8d99ae'; ctx.font = `10px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText(locked ? sd.rarity + ' · non découverte' : `+${Math.round((modeMult(G.inv, sd.key) - 1) * 100)} % dégâts · ${sd.rarity}`, x + 44, y + 40);
  ctx.font = `bold 8px ${UI}`; ctx.textAlign = 'right';
  if (equipped) {
    ctx.fillStyle = sd.color;
    ctx.fillText(in1 && in2 ? 'S1+S2' : in1 ? 'EMPLACEMENT 1' : 'EMPLACEMENT 2', x + w - 10, y + 13);
  } else {
    ctx.fillStyle = '#546e7a';
    ctx.fillText('NON ÉQUIPÉE', x + w - 10, y + 13);
  }
  if (locked) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(x, y, w, h, 10); ctx.fill();
    ctx.fillStyle = '#b388ff'; ctx.font = `bold 10px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText(sd.key === 'gardien' ? '🔒 VAINCRE LE SEIGNEUR DES TERRES OUBLIÉES' : '🔒 VAINCRE L\'ABOMINATION COSMIQUE', x + w / 2, y + h - 30);
    ctx.globalAlpha = 1; return;
  }
  // ---------- zones d'emplacement 1 / 2 ----------
  for (const [zi, z, slot] of [[0, z1, 's1'], [1, z2, 's2']]) {
    const on = slot === 's1' ? in1 : in2;
    const zh = inR(z, G.mouse.x, G.mouse.y);
    ctx.fillStyle = on ? hexA(sd.color, zh ? 0.45 : 0.3) : (zh ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.3)');
    roundRect(z.x, z.y, z.w, z.h, 6); ctx.fill();
    ctx.strokeStyle = on ? sd.color : (zh ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)');
    ctx.lineWidth = on ? 1.6 : 1;
    roundRect(z.x, z.y, z.w, z.h, 6); ctx.stroke();
    ctx.fillStyle = on ? '#fff' : (zh ? sd.color : '#8d99ae');
    ctx.font = `bold ${on ? 11 : 10}px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText(on ? `✓ ${zi + 1} · ÉQUIPÉE` : `${zi + 1} · ÉQUIPER`, z.x + z.w / 2, z.y + 14);
  }
  ctx.globalAlpha = 1;
}

// ---------- FICHE ARME DÉTAILLÉE ----------
// ouverte par clic sur le corps d'une carte COMPÉTENCES : illustration, rareté,
// statistiques, attaques, comparaison avec l'arme principale et boutons d'emplacement
export function drawWeaponDetail() {
  const key = weaponDetail;
  if (!key) return;
  const sd = SKILL_DEF.find(d => d.key === key);
  const wi = WEAPON_INFO[key] || WEAPON_INFO.epee;
  const D = weaponDetailLayout();
  const locked = (key === 'arc' && !(G.stats && G.stats.bowUnlocked))
    || (key === 'gardien' && !(G.stats && G.stats.gardienUnlocked));
  const info = modeInfo(G.inv, key);
  const l = loadoutOf(G.inv);
  const in1 = l.s1 === key, in2 = l.s2 === key, equipped = in1 || in2;
  const hov = (r) => inR(r, G.mouse.x, G.mouse.y);

  // voile + panneau
  ctx.fillStyle = 'rgba(5,7,11,0.74)'; ctx.fillRect(0, 0, W, H);
  panel(D.x, D.y, D.w, D.h);
  ctx.strokeStyle = sd.color; ctx.lineWidth = 1.5;
  roundRect(D.x + 1, D.y + 1, D.w - 2, D.h - 2, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  roundRect(D.x + 8, D.y + 8, D.w - 16, D.h - 16, 9); ctx.stroke();

  // en-tête : grande icône + nom + rareté
  ctx.textAlign = 'left'; ctx.font = `46px serif`;
  ctx.fillText(sd.icon, D.x + 30, D.y + 92);
  ctx.fillStyle = locked ? '#7c6aa8' : sd.color;
  ctx.font = `bold 24px ${UI}`;
  ctx.fillText(locked ? 'ARME INCONNUE' : wi.name.toUpperCase(), D.x + 110, D.y + 66);
  // pastille rareté
  const rc = locked ? '#7c6aa8' : (key === 'gardien' ? '#ffd740' : key === 'arc' ? '#b388ff' : '#90a4ae');
  ctx.fillStyle = hexA(rc, 0.18); roundRect(D.x + 110, D.y + 76, 150, 22, 6); ctx.fill();
  ctx.strokeStyle = rc; ctx.lineWidth = 1; roundRect(D.x + 110, D.y + 76, 150, 22, 6); ctx.stroke();
  ctx.fillStyle = rc; ctx.font = `bold 10.5px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText(locked ? 'NON DÉCOUVERTE' : `✦ ${wi.rarity.toUpperCase()} ✦`, D.x + 185, D.y + 91);
  ctx.textAlign = 'left';
  // niveau + bonus dégâts
  ctx.fillStyle = locked ? '#5a5470' : '#ffe9a3'; ctx.font = `bold 15px Consolas, monospace`;
  ctx.fillText(locked ? 'NIV ???' : `NIVEAU ${info.lvl} · +${Math.round((modeMult(G.inv, key) - 1) * 100)} % DE DÉGÂTS`, D.x + 110, D.y + 116);
  // barre XP
  if (!locked) {
    const bx = D.x + 110, bw = D.w - 170, by = D.y + 126;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(bx, by, bw, 9, 5); ctx.fill();
    ctx.fillStyle = sd.color; roundRect(bx, by, bw * info.pct, 9, 5); ctx.fill();
    ctx.fillStyle = '#aab4c0'; ctx.font = `9.5px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText(info.lvl >= MODE_MAX_LVL ? 'NIVEAU MAX' : `${Math.floor(info.xp).toLocaleString('fr-FR')} / ${info.need.toLocaleString('fr-FR')} XP`, bx + bw / 2, by - 4);
    ctx.textAlign = 'left';
  }

  // descriptions (verrouillées = teaser)
  const tx = D.x + 30, tw = D.w - 60;
  let ty = D.y + 158;
  ctx.font = `italic 13px Georgia, serif`; ctx.fillStyle = 'rgba(232,226,210,0.85)';
  if (locked) {
    ctx.fillText(key === 'gardien'
      ? '« Forgée pour un gardien oublié, elle attend que son verdict soit rendu. »'
      : '« Une relique tombée des étoiles, assoiffée de verdict. »', tx, ty);
    ty += 22;
    ctx.fillStyle = '#b388ff'; ctx.font = `bold 12px ${UI}`;
    ctx.fillText(key === 'gardien' ? '🔒 Vaincre le Seigneur des Terres Oubliées (fin du monde 1)'
      : '🔒 Vaincre l\'Abomination Cosmique (fin du monde 5)', tx, ty);
  } else {
    for (const ln of wrapLines(wi.desc, tw)) { ctx.fillText(ln, tx, ty); ty += 18; }
    ty += 8;
    ctx.fillStyle = sd.color; ctx.font = `bold 12px ${UI}`;
    ctx.fillText('⚔ ATTAQUE PRINCIPALE', tx, ty); ty += 16;
    ctx.fillStyle = '#d8d2c0'; ctx.font = `12px Inter, sans-serif`;
    for (const ln of wrapLines(wi.atk, tw)) { ctx.fillText(ln, tx, ty); ty += 16; }
    ty += 8;
    ctx.fillStyle = sd.color; ctx.font = `bold 12px ${UI}`;
    ctx.fillText('✦ ATTAQUE SECONDAIRE — CLIC DROIT', tx, ty); ty += 16;
    ctx.fillStyle = '#d8d2c0'; ctx.font = `12px Inter, sans-serif`;
    for (const ln of wrapLines(wi.sec, tw)) { ctx.fillText(ln, tx, ty); ty += 16; }
  }

  // comparaison avec l'arme principale (s1) si différente et non verrouillée
  if (!locked && l.s1 && l.s1 !== key) {
    const other = SKILL_DEF.find(d => d.key === l.s1);
    const dMult = Math.round((modeMult(G.inv, key) - modeMult(G.inv, l.s1)) * 100);
    const cy = D.y + D.h - 108;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(tx, cy, tw, 40, 8); ctx.fill();
    ctx.fillStyle = '#8d99ae'; ctx.font = `11px ${UI}`;
    ctx.fillText(`COMPARÉ À ${wi.name === WEAPON_INFO[l.s1].name ? '' : WEAPON_INFO[l.s1].name.toUpperCase()} (${other ? other.label : l.s1.toUpperCase()}) :`, tx + 10, cy + 16);
    ctx.fillStyle = dMult >= 0 ? '#81c784' : '#ef9a9a'; ctx.font = `bold 12px Consolas, monospace`;
    ctx.fillText(`${dMult >= 0 ? '+' : ''}${dMult} % DE DÉGÂTS`, tx + 10, cy + 32);
  }

  // boutons d'emplacement (droite) + retrait (gauche)
  const btn = (r, label, on, accent) => {
    const h = hov(r);
    ctx.fillStyle = on ? hexA(accent, h ? 0.5 : 0.35) : (h ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)');
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = on ? accent : (h ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)');
    ctx.lineWidth = on ? 1.8 : 1;
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.fillStyle = on || !locked ? '#fff' : '#666'; ctx.font = `bold 12.5px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 4);
    ctx.textAlign = 'left';
  };
  if (!locked) {
    btn(D.eq1, in1 ? '✓ EMPLACEMENT 1 — RETIRER' : 'ÉQUIPER EMPLACEMENT 1', in1, sd.color);
    btn(D.eq2, in2 ? '✓ EMPLACEMENT 2 — RETIRER' : 'ÉQUIPER EMPLACEMENT 2', in2, sd.color);
    if (equipped) btn(D.uneq, 'RETIRER DES EMPLACEMENTS', false, '#ef5350');
  } else {
    ctx.fillStyle = '#546e7a'; ctx.font = `bold 12px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText('ARME VERROUILLÉE', D.eq1.x + D.eq1.w / 2, D.eq1.y + 20);
    ctx.textAlign = 'left';
  }
  // bouton fermer
  const c = D.close, ch = hov(c);
  ctx.fillStyle = ch ? 'rgba(239,83,80,0.5)' : 'rgba(255,255,255,0.08)';
  roundRect(c.x, c.y, c.w, c.h, 8); ctx.fill();
  ctx.fillStyle = '#e0e0e0'; ctx.font = `bold 15px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText('✕', c.x + c.w / 2, c.y + 21);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

// ---------- bandeau bas : ULTIME (gauche) + PROGRESSION (droite) ----------
function drawUltStrip(L) {
  const ub = ultBtns(L);
  const y = ub.nuke.y;
  // label (sous la zone contenu, au-dessus des boutons)
  ctx.fillStyle = C_GOLD; ctx.font = `bold 10px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('ULTIME · F', ub.nuke.x, y - 8);
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
  // stats de progression supprimées (demande utilisateur)
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
  const cols = 2, cw = (w - 20) / cols, rh = 34, x0 = x + 10, y0 = y + 44;
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
    ctx.fillText(fitText(r.tip, cw - 30), cx + 26, cy + 13);
  });
  // niveaux d'armes en bas
  const wy = y0 + Math.ceil(rows.length / cols) * rh + 6;
  secHead('NIVEAUX D\'ARMES', x + 10, wy, w - 20);
  const cw4 = (w - 40) / 4;
  SKILL_DEF.forEach((sd, i) => {
    const info = modeInfo(G.inv, sd.key);
    const locked = (sd.key === 'arc' && !(G.stats && G.stats.bowUnlocked))
      || (sd.key === 'gardien' && !(G.stats && G.stats.gardienUnlocked));
    const cx = x0 + i * cw4;
    ctx.fillStyle = locked ? 'rgba(20,16,40,0.5)' : 'rgba(255,255,255,0.05)';
    roundRect(cx, wy + 18, cw4 - 14, 40, 8); ctx.fill(); // descendu de 6 px (12→18)
    ctx.strokeStyle = locked ? 'rgba(124,77,255,0.4)' : sd.color; ctx.lineWidth = 1.2;
    roundRect(cx, wy + 18, cw4 - 14, 40, 8); ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = `13px serif`;
    ctx.fillText(sd.icon, cx + 10, wy + 36);
    ctx.fillStyle = locked ? '#7c6aa8' : sd.color; ctx.font = `bold 11px ${UI}`;
    ctx.fillText(locked ? sd.label + ' 🔒' : sd.label, cx + 32, wy + 33);
    ctx.fillStyle = '#ffe9a3'; ctx.font = `bold 10.5px Consolas, monospace`; ctx.textAlign = 'right';
    ctx.fillText(locked ? '???' : `NIV ${info.lvl} · +${Math.round((modeMult(G.inv, sd.key) - 1) * 100)}%`, cx + cw4 - 24, wy + 33);
    ctx.fillStyle = '#8d99ae'; ctx.font = `9px ${UI}`; ctx.textAlign = 'left';
    ctx.fillText(locked ? 'arme à découvrir' : `${Math.floor(info.xp).toLocaleString('fr-FR')} / ${info.need.toLocaleString('fr-FR')} XP`, cx + 32, wy + 47);
  });
}

// note des bonus permanents des consommables : affichée dans la bande du bas,
// à droite des boutons d'ultime (la colonne compétences est désormais pleine)
function drawBuffsNote(L) {
  const buffs = G.inv.buffs || {};
  if (!buffs.hp && !buffs.potions) return;
  const ub = ultBtns(L);
  const x = ub.hell.x + ub.hell.w + 18, y = ub.nuke.y + ub.nuke.h / 2;
  ctx.fillStyle = C_GOLD; ctx.font = `bold 10px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('BONUS CONSOMMABLES', x, y - 12);
  ctx.fillStyle = '#69f0ae'; ctx.font = `10.5px ${UI}`;
  const parts = [];
  if (buffs.hp) parts.push(`+${buffs.hp} PV max`);
  if (buffs.potions) parts.push(`+${buffs.potions} fiole max`);
  ctx.fillText(parts.join('  ·  '), x, y + 4);
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
  const dmax = it.conso ? DUR_MAX : durMaxOf(c.id);
  const dur = it.conso ? DUR_MAX : getDur(G.inv, c.id);
  const broken = dur <= 0;
  const hov = inR(c, G.mouse.x, G.mouse.y + forgeScroll);
  // fond teinté rareté + survol
  ctx.fillStyle = broken ? 'rgba(255,60,60,0.10)' : equipped ? hexA(tier, 0.16) : hov ? 'rgba(255,255,255,0.09)' : hexA(tier, 0.05);
  roundRect(c.x, c.y, c.w, c.h, 9); ctx.fill();
  ctx.strokeStyle = broken ? '#ff5252' : equipped ? tier : hov ? 'rgba(255,255,255,0.4)' : hexA(tier, 0.45);
  ctx.lineWidth = equipped || hov ? 2 : 1.2;
  roundRect(c.x, c.y, c.w, c.h, 9); ctx.stroke();
  // icône
  drawItemIcon(it, c.x + c.w / 2, c.y + 36, 22);
  // nom + rareté
  ctx.textAlign = 'center';
  ctx.fillStyle = broken ? '#ff8a80' : '#ffe9a3'; ctx.font = `bold 11px ${UI}`;
  ctx.fillText(fitText(it.name, c.w - 12), c.x + c.w / 2, c.y + 68);
  ctx.fillStyle = tier; ctx.font = `9px ${UI}`;
  ctx.fillText(ITEM_RARITY[it.rar] || '', c.x + c.w / 2, c.y + 81);
  // badges : quantité conso / équipé / cassé / durabilité
  if (it.conso) {
    ctx.fillStyle = '#b9f6ca'; ctx.font = `bold 12px Consolas, monospace`;
    ctx.fillText(`×${qty}`, c.x + c.w - 16, c.y + 18);
  } else if (equipped) {
    ctx.fillStyle = tier; ctx.font = `bold 10.5px ${UI}`;
    ctx.fillText('✓ ÉQUIPÉ', c.x + c.w / 2, c.y + 94);
  } else if (broken) {
    ctx.fillStyle = '#ff8a80'; ctx.font = `bold 10px ${UI}`;
    ctx.fillText('💥 CASSÉ', c.x + c.w / 2, c.y + 94);
  } else if (dur < dmax) {
    ctx.fillStyle = '#8d99ae'; ctx.font = `9.5px ${UI}`;
    ctx.fillText(`${Math.round(dur / dmax * 100)} %`, c.x + c.w / 2, c.y + 94);
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
  drawMatIcon(m, c.x + c.w / 2, c.y + 32, 13);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e0c8'; ctx.font = `bold 12px ${UI}`;
  ctx.fillText(info.name, c.x + c.w / 2, c.y + 64);
  ctx.fillStyle = '#ffd740'; ctx.font = `bold 16px Consolas, monospace`;
  ctx.fillText(`×${n.toLocaleString('fr-FR')}`, c.x + c.w / 2, c.y + 86);
}

