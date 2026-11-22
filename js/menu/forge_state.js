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

// ---------- FORGE & INVENTAIRE ----------
export let forgeTab = 'craft'; // 'craft' | 'inv'
export let forgeScroll = 0;    // scroll molette de l'onglet fourneau
export let itemDetail = null;  // id de l'équipement ouvert en fiche détaillée

// hauteur totale / visible du contenu forge (pour borner le scroll)
export function forgeScrollMax() {
  const L = forgeLayout();
  const visibleH = L.ch - 160;
  if (forgeTab === 'inv') return Math.max(0, invItems(L).totalH - visibleH);
  const rows = Math.ceil(Object.keys(ITEMS).length / 3);
  const totalH = rows * 104 + (rows - 1) * 8;
  return Math.max(0, totalH - visibleH);
}

export function forgeWheel(delta) {
  forgeScroll = Math.max(0, Math.min(forgeScrollMax(), forgeScroll + delta));
}

export function forgeLayout() {
  const cw = 960, ch = 470;
  return { cx: W / 2 - cw / 2, cy: H / 2 - ch / 2, cw, ch };
}
export function forgeTabs(L) {
  return {
    craft: { x: L.cx + 40, y: L.cy + 62, w: 190, h: 34 },
    inv:   { x: L.cx + 244, y: L.cy + 62, w: 190, h: 34 },
    hero:  { x: L.cx + 448, y: L.cy + 62, w: 190, h: 34 },
    back:  menuButtons().back
  };
}
// bouton admin « don de matériaux » : visible à la forge uniquement si admin débloqué
export function adminMatsBtn(L) { return { x: L.cx + L.cw - 176, y: L.cy + 34, w: 156, h: 30 }; }

// rects des recettes (partagé dessin / clic)
export function craftCells(L) {
  const ids = Object.keys(ITEMS);
  const cellW = (L.cw - 60 - 24) / 3, cellH = 104;
  const x0 = L.cx + 30, y0 = L.cy + 112;
  return ids.map((id, i) => ({
    id,
    x: x0 + (i % 3) * (cellW + 12),
    y: y0 + Math.floor(i / 3) * (cellH + 8),
    w: cellW, h: cellH,
    btn: { x: x0 + (i % 3) * (cellW + 12) + cellW - 92, y: y0 + Math.floor(i / 3) * (cellH + 8) + cellH - 30, w: 78, h: 24 }
  }));
}

// inventaire : liste pleine largeur groupée par emplacement (scrollable)
export function invItems(L) {
  const slots = [['weapon', '⚔️ ARME'], ['armor', '🛡️ ARMURE'], ['charm', '🧿 TALISMAN'], ['boots', '👢 BOTTES']];
  const x0 = L.cx + 30, w = L.cw - 60, y0 = L.cy + 146;
  const out = { headers: [], rows: [], totalH: 0 };
  let y = y0;
  for (const [slot, label] of slots) {
    const ids = Object.keys(ITEMS).filter(id => ITEMS[id].slot === slot && G.inv.items[id]);
    out.headers.push({ slot, label, y });
    y += 24;
    if (!ids.length) {
      out.rows.push({ empty: true, slot, x: x0, y, w, h: 30 });
      y += 38;
    }
    for (const id of ids) {
      out.rows.push({
        id, slot, x: x0, y, w, h: 54,
        btn: { x: x0 + w - 236, y: y + 12, w: 112, h: 30 },
        rbtn: { x: x0 + w - 116, y: y + 12, w: 100, h: 30 }
      });
      y += 60;
    }
    y += 12;
  }
  out.totalH = y - y0;
  return out;
}

// fiche équipement détaillée (modale) — géométrie partagée dessin / clic
function itemDetailLayout(dur) {
  const cw = 600, ch = 440, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  const by = cy + ch - 66;
  const two = dur < 100; // RÉPARER + ÉQUIPER côte à côte, sinon ÉQUIPER seul
  return {
    cx, cy, cw, ch,
    close: { x: cx + cw - 48, y: cy + 12, w: 36, h: 32 },
    equip: two ? { x: cx + cw - 275, y: by, w: 235, h: 42 }
               : { x: cx + cw / 2 - 140, y: by, w: 280, h: 42 },
    repair: { x: cx + 40, y: by, w: 235, h: 42 }
  };
}

export const SLOT_LABEL = { weapon: '⚔️ ARME', armor: '🛡️ ARMURE', charm: '🧿 TALISMAN', boots: '👢 BOTTES' };

export function drawItemDetail() {
  const id = itemDetail;
  const it = id && ITEMS[id];
  if (!it) { itemDetail = null; return; }
  const dur = getDur(G.inv, id);
  const broken = dur <= 0;
  const equipped = Object.values(G.inv.equip).includes(id);
  const rc = repairCost(G.inv, id);
  const L = itemDetailLayout(dur);
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(14,12,8,0.97)';
  roundRect(L.cx, L.cy, L.cw, L.ch, 18); ctx.fill();
  ctx.strokeStyle = broken ? '#ff5252' : '#5c6bc0'; ctx.lineWidth = 2.5;
  roundRect(L.cx, L.cy, L.cw, L.ch, 18); ctx.stroke();

  // grande icône + nom + emplacement
  drawItemIcon(it, W / 2, L.cy + 88, 40);
  ctx.textAlign = 'center';
  ctx.fillStyle = broken ? '#ff8a80' : '#ffe9a3'; ctx.font = 'bold 23px Inter, sans-serif';
  ctx.fillText(fitText(it.name, L.cw - 60), W / 2, L.cy + 152);
  ctx.fillStyle = '#90caf9'; ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillText(SLOT_LABEL[it.slot] || it.slot.toUpperCase(), W / 2, L.cy + 174);
  ctx.fillStyle = broken ? '#ff8a80' : '#69f0ae'; ctx.font = 'italic 13px Inter, sans-serif';
  ctx.fillText(broken ? '💥 CASSÉ — répare-le pour le rééquiper' : equipped ? '✓ Actuellement équipé' : 'Dans ton inventaire', W / 2, L.cy + 196);

  // les niveaux d'armes se suivent dans l'onglet Héros (épée / lance)

  // description + effet (max 5 lignes, le reste est tronqué avec « … »)
  ctx.textAlign = 'left'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
  ctx.fillText('📜 DESCRIPTION', L.cx + 42, L.cy + 226);
  ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#e8e0c8';
  let lines = wrapLines(it.desc, L.cw - 84);
  if (lines.length > 5) { lines = lines.slice(0, 5); lines[4] = fitText(lines[4] + '…', L.cw - 84); }
  lines.forEach((ln, i) => ctx.fillText(ln, L.cx + 42, L.cy + 247 + i * 18));

  // durabilité (position fixe : jamais dans les boutons)
  const dy = L.cy + 322;
  ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
  ctx.fillText('🔧 DURABILITÉ', L.cx + 42, dy);
  const dbx = L.cx + 42, dbw = L.cw - 84, dby = dy + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(dbx, dby, dbw, 12, 6); ctx.fill();
  const dc = dur > 50 ? '#69f0ae' : dur > 25 ? '#ffd740' : '#ff5252';
  if (dur > 0) { ctx.fillStyle = dc; roundRect(dbx, dby, dbw * dur / 100, 12, 6); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(broken ? 'CASSÉ' : `${Math.round(dur)} %`, dbx + dbw / 2, dby + 10);
  ctx.textAlign = 'left';

  // coût de réparation (une seule ligne, tronquée si besoin)
  ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
  ctx.fillText('💰 RÉPARATION', L.cx + 42, dy + 42);
  ctx.font = '12px Consolas, monospace';
  if (rc) {
    ctx.fillStyle = canRepair(G.inv, id) ? '#a5d6a7' : '#ef9a9a';
    ctx.fillText(fitText(Object.keys(rc).map(m => `${MATS[m].name} ×${rc[m]}`).join('  ·  '), L.cw - 240), L.cx + 140, dy + 42);
  } else {
    ctx.fillStyle = '#69f0ae';
    ctx.fillText(dur >= 100 ? 'Parfaite — aucune réparation nécessaire' : 'Matériaux insuffisants', L.cx + 140, dy + 42);
  }

  // boutons : RÉPARER + ÉQUIPER sur une seule rangée en bas
  if (dur < 100) {
    const okR = canRepair(G.inv, id);
    const rb = L.repair;
    ctx.fillStyle = okR ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.06)';
    roundRect(rb.x, rb.y, rb.w, rb.h, 9); ctx.fill();
    ctx.strokeStyle = okR ? '#ff9800' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
    roundRect(rb.x, rb.y, rb.w, rb.h, 9); ctx.stroke();
    ctx.fillStyle = okR ? '#ffe0b2' : '#78909c'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(okR ? '🔧  RÉPARER' : 'MATÉRIAUX INSUFFISANTS', rb.x + rb.w / 2, rb.y + 27);
  }
  const eb = L.equip;
  ctx.fillStyle = equipped ? 'rgba(255,215,64,0.3)' : broken ? 'rgba(255,82,82,0.2)' : 'rgba(92,107,192,0.55)';
  roundRect(eb.x, eb.y, eb.w, eb.h, 10); ctx.fill();
  ctx.strokeStyle = equipped ? '#ffd740' : broken ? '#ff5252' : '#9fa8da'; ctx.lineWidth = 2;
  roundRect(eb.x, eb.y, eb.w, eb.h, 10); ctx.stroke();
  ctx.fillStyle = equipped ? '#ffe9a3' : broken ? '#ff8a80' : '#fff'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(equipped ? '✓  ÉQUIPÉ' : broken ? 'CASSÉ — À RÉPARER' : 'ÉQUIPER', eb.x + eb.w / 2, eb.y + 27);
  const fb = L.close;
  ctx.fillStyle = 'rgba(69,90,100,0.8)';
  roundRect(fb.x, fb.y, fb.w, fb.h, 8); ctx.fill();
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.5;
  roundRect(fb.x, fb.y, fb.w, fb.h, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('✕', fb.x + fb.w / 2, fb.y + 22);
}

export function forgeClickAt(x, y) {
  const L = forgeLayout(), T = forgeTabs(L);
  // fiche équipement ouverte : elle intercepte tous les clics
  if (itemDetail) {
    const D = itemDetailLayout(getDur(G.inv, itemDetail));
    if (inR(D.close, x, y)) { itemDetail = null; return 'close'; }
    const id = itemDetail;
    if (inR(D.repair, x, y) && canRepair(G.inv, id)) {
      repairItem(G.inv, id);
      G.forgeAnim = { start: G.time, id, repair: true };
      sfxRepair();
      return 'repair';
    }
    if (inR(D.equip, x, y)) { toggleEquip(G.inv, id); sfxEquip(); return 'equip'; }
    return 'noop';
  }
  if (inR(T.back, x, y)) { itemDetail = null; return 'back'; }
  // don de matériaux : réservé à la forge + mode admin débloqué
  if (adminUnlocked() && inR(adminMatsBtn(L), x, y)) {
    for (const m in MATS) addMaterial(G.inv, m, 10);
    sfxCraft();
    return 'adminmats';
  }
  if (inR(T.craft, x, y)) { forgeTab = 'craft'; forgeScroll = 0; itemDetail = null; return 'tab'; }
  if (inR(T.inv, x, y)) { forgeTab = 'inv'; itemDetail = null; return 'tab'; }
  if (inR(T.hero, x, y)) { forgeTab = 'hero'; itemDetail = null; return 'tab'; }
  if (forgeTab === 'hero') {
    // choix de l'ultime
    const ub = ultBtns(L);
    if (inR(ub.nuke, x, y)) { G.stats.ultSel = 'nuke'; saveStats(); return 'ult'; }
    if (inR(ub.glace, x, y) && G.stats.iceUlt) { G.stats.ultSel = 'glace'; saveStats(); return 'ult'; }
    if (inR(ub.hell, x, y) && G.stats.hellUlt) { G.stats.ultSel = 'hell'; saveStats(); return 'ult'; }
    // clic sur une embase du personnage -> fiche de l'objet équipé (ou rien)
    for (const slot of ['weapon', 'armor', 'charm', 'boots']) {
      const r = heroSlots(L)[slot];
      const id = G.inv.equip[slot];
      if (id && inR(r, x, y)) { itemDetail = id; return 'open'; }
    }
    return null;
  }
  if (forgeTab === 'craft') {
    const sy = y + forgeScroll; // les cellules sont décalées par le scroll
    for (const c of craftCells(L)) {
      if (inR(c.btn, x, sy) && canCraft(G.inv, c.id)) {
        craft(G.inv, c.id);
        G.forgeAnim = { start: G.time, id: c.id }; // animation enclume + marteau
        sfxCraft();
        return 'craft';
      }
    }
  } else {
    const inv = invItems(L);
    const sy = y + forgeScroll; // contenu décalé par le scroll
    for (const r of inv.rows) {
      if (r.empty) continue;
      if (inR(r.rbtn, x, sy)) {
        if (canRepair(G.inv, r.id)) {
          repairItem(G.inv, r.id);
          G.forgeAnim = { start: G.time, id: r.id, repair: true }; // animation de réparation
          sfxRepair();
        }
        return 'repair';
      }
      if (inR(r.btn, x, sy)) { toggleEquip(G.inv, r.id); sfxEquip(); return 'equip'; }
      // clic sur la ligne (hors boutons) → fiche détaillée
      if (inR({ x: r.x, y: r.y, w: r.w, h: r.h }, x, sy)) { itemDetail = r.id; return 'open'; }
    }
  }
  return null;
}

export function heroSlots(L) {
  const hx = L.cx + L.cw / 2 - 20, hy = L.cy + L.ch / 2 + 26;
  // emplacements calés sur les parties du corps, bien dégagés du héros
  return {
    hx, hy,
    weapon: { x: hx + 78, y: hy - 32, w: 88, h: 64 },   // droite, hauteur torse
    armor:  { x: hx - 166, y: hy - 32, w: 88, h: 64 },  // gauche, hauteur torse
    charm:  { x: hx - 44, y: hy - 124, w: 88, h: 52 },  // centré au-dessus de la tête
    boots:  { x: hx - 44, y: hy + 92, w: 88, h: 50 }    // centré sous les pieds
  };
}

export function ultBtns(L) {
  const x = L.cx + L.cw - 252, y = L.cy + 96;
  return {
    nuke:  { x, y, w: 232, h: 40 },
    glace: { x, y: y + 48, w: 232, h: 40 },
    hell:  { x, y: y + 96, w: 232, h: 40 }
  };
}
