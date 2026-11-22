import { G, ctx, W, H, TAU, saveStats, finalWave } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { regenerateDecor } from '../graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from '../achievements.js';
import { ITEMS, MATS, ITEM_RARITY, canCraft, craft, toggleEquip, useConsumable, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave, toggleLoadoutWeapon, damagedItems, repairAll, repairAllCost, DUR_MAX, durState } from '../inventory.js';
import { spawnEnemy, spawnFinalBoss } from '../enemies.js';
import { gainXp } from '../player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart } from '../world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm, sfxClick } from '../audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from '../chars.js';
import { inR, fitText, wrapLines, hexA, fmtTime, overline, panel, overlineCentered, drawMenuButton, drawAdminPwInput, menuButtons, menuButtonAt, adminUnlocked, campaignUnlocked, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, MENU_X, MENU_W, MENU_ITEMS } from './common.js';

// ---------- FORGE & INVENTAIRE ----------
export let forgeTab = 'craft'; // 'craft' | 'inv' | 'hero'
export let forgeScroll = 0;    // scroll molette de l'onglet fourneau
export let itemDetail = null;  // id de l'équipement ouvert en fiche détaillée

// ---------- état d'UI des sous-onglets (refonte 3.1) ----------
export const invUI = { cat: 'all', sort: 'name', rar: 'all' };   // inventaire : catégorie/tri/filtre rareté
export const craftUI = { cat: 'all', sel: null };                // forge : catégorie + recette sélectionnée
export const heroUI = { tab: 'apercu' };                         // personnage : 'apercu' | 'stats'

// hauteur totale / visible du contenu forge (pour borner le scroll)
export function forgeScrollMax() {
  const L = forgeLayout();
  if (forgeTab === 'inv') {
    const g = invCells(L);
    return Math.max(0, g.totalH - g.view.h);
  }
  if (forgeTab === 'craft' && craftUI.cat === 'repair') {
    return Math.max(0, repairCount() * 64 - (L.ch - 188));
  }
  if (forgeTab === 'craft' && craftUI.cat !== 'upgrade') {
    const rows = craftList(L).length;
    return Math.max(0, rows * 48 - (L.ch - 250));
  }
  return 0;
}

export function forgeWheel(delta) {
  forgeScroll = Math.max(0, Math.min(forgeScrollMax(), forgeScroll + delta));
}

// setters (les exports `let` sont immuables depuis l'extérieur du module)
export function setForgeTab(t) { forgeTab = t; forgeScroll = 0; }
export function setForgeScroll(v) { forgeScroll = Math.max(0, v); }
export function setItemDetail(id) { itemDetail = id; }

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

// ---------- INVENTAIRE : catégories + recherche + tri + filtre rareté + grille ----------
export const INV_CATS = [
  ['all',      'Tout'],
  ['weapon',   'Armes'],
  ['armor',    'Armures'],
  ['charm',    'Accessoires'],
  ['conso',    'Consommables'],
  ['mats',     'Matériaux'],
  ['special',  'Objets spéciaux']
];

// classification automatique d'un objet dans sa catégorie d'inventaire
export function invCatOf(it) {
  if (it.conso) return 'conso';
  if (it.slot === 'weapon') return 'weapon';
  if (it.slot === 'charm') return 'charm';
  return 'armor'; // armor, helm, gloves, boots
}
const RAR_ORDER = { commun: 0, rare: 1, epique: 2, legendaire: 3 };
const SLOT_ORDER = ['weapon', 'armor', 'helm', 'gloves', 'charm', 'boots', 'conso'];

// liste filtrée/triée des objets possédés (hors onglet Matériaux)
export function invVisible() {
  const q = (G.invQuery || '').toLowerCase().trim();
  let ids = Object.keys(ITEMS).filter(id => G.inv.items[id]);
  if (invUI.cat === 'special') ids = ids.filter(id => RAR_ORDER[ITEMS[id].rar] >= 2);
  else if (invUI.cat !== 'all' && invUI.cat !== 'mats') ids = ids.filter(id => invCatOf(ITEMS[id]) === invUI.cat);
  if (invUI.rar !== 'all') ids = ids.filter(id => ITEMS[id].rar === invUI.rar);
  if (q) ids = ids.filter(id => ITEMS[id].name.toLowerCase().includes(q) || (ITEMS[id].desc || '').toLowerCase().includes(q));
  const s = invUI.sort;
  ids.sort((a, b) => {
    const A = ITEMS[a], B = ITEMS[b];
    if (s === 'rar') return (RAR_ORDER[B.rar] - RAR_ORDER[A.rar]) || A.name.localeCompare(B.name, 'fr');
    if (s === 'slot') return (SLOT_ORDER.indexOf(A.slot) - SLOT_ORDER.indexOf(B.slot)) || A.name.localeCompare(B.name, 'fr');
    return A.name.localeCompare(B.name, 'fr'); // 'name'
  });
  return ids;
}

// grille d'inventaire : onglets catégories + barre recherche/tri + cellules (scrollable)
export function invCells(L) {
  const tx = L.cx + 30, tw = L.cw - 60;
  // rangée d'onglets catégories
  const tabs = [];
  const cw2 = (tw - 6 * 8) / 7, ty = L.cy + 96, th = 30;
  INV_CATS.forEach(([key, label], i) => {
    tabs.push({ key, label, r: { x: tx + i * (cw2 + 8), y: ty, w: cw2, h: th }, count: invCatCount(key) });
  });
  // barre d'outils : recherche + tri + filtre rareté
  const oy = ty + th + 8;
  const search = { x: tx, y: oy, w: 230, h: 30 };
  const sortNames = { name: 'Tri : Nom', rar: 'Tri : Rareté', slot: 'Tri : Catégorie' };
  const sortBtn = { x: tx + search.w + 10, y: oy, w: 150, h: 30 };
  const rarNames = { all: 'Toutes raretés', commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
  const rarBtn = { x: sortBtn.x + sortBtn.w + 10, y: oy, w: 150, h: 30 };
  const countTxt = { x: rarBtn.x + rarBtn.w + 12, y: oy + 20 };
  // zone de grille
  const view = { x: tx, y: oy + 40, w: tw, h: L.cy + L.ch - 12 - (oy + 40) };
  const cells = [];
  let totalH = 0;
  if (invUI.cat === 'mats') {
    // les 5 matériaux + fioles
    const cw3 = (tw - 4 * 12) / 5, ch3 = 92;
    Object.keys(MATS).forEach((m, i) => {
      cells.push({ mat: m, x: view.x + i * (cw3 + 12), y: view.y, w: cw3, h: ch3 });
    });
    totalH = ch3;
  } else {
    const ids = invVisible();
    const cols = 6, gap = 10;
    const cw4 = (tw - (cols - 1) * gap) / cols, ch4 = 96;
    ids.forEach((id, i) => {
      cells.push({
        id, x: view.x + (i % cols) * (cw4 + gap), y: view.y + Math.floor(i / cols) * (ch4 + gap),
        w: cw4, h: ch4
      });
    });
    totalH = Math.ceil(ids.length / cols) * (ch4 + gap);
  }
  return { tabs, search, sortBtn, rarBtn, countTxt, view, cells, totalH };
}

function invCatCount(cat) {
  if (cat === 'all') return Object.keys(G.inv.items).filter(id => ITEMS[id]).length;
  if (cat === 'mats') return Object.keys(MATS).length;
  if (cat === 'special') return Object.keys(G.inv.items).filter(id => ITEMS[id] && RAR_ORDER[ITEMS[id].rar] >= 2).length;
  return Object.keys(G.inv.items).filter(id => ITEMS[id] && invCatOf(ITEMS[id]) === cat).length;
}

// ---------- FORGE : sous-onglets de catégories + layout 3 zones ----------
export const CRAFT_CATS = [
  ['all',     'FABRICATION'],
  ['weapon',  'ARMES'],
  ['armor',   'ARMURES'],
  ['charm',   'ACCESSOIRES'],
  ['upgrade', 'AMÉLIORATIONS'],
  ['repair',  'RÉPARATION']
];
export function craftCatOf(it) { return invCatOf(it); } // même classification que l'inventaire

// ids de recettes visibles pour la catégorie forge courante
export function craftList(L) {
  const cat = craftUI.cat;
  if (cat === 'upgrade' || cat === 'repair') return [];
  let ids = Object.keys(ITEMS);
  if (cat !== 'all') ids = ids.filter(id => craftCatOf(ITEMS[id]) === cat);
  // tri : fabricables d'abord, puis par rareté décroissante
  const rk = r => (RAR_ORDER[ITEMS[r].rar] ?? 0);
  return ids.sort((a, b) => {
    const ca = canCraft(G.inv, a) ? 0 : 1, cb = canCraft(G.inv, b) ? 0 : 1;
    return ca - cb || rk(b) - rk(a) || ITEMS[a].name.localeCompare(ITEMS[b].name, 'fr');
  });
}

// chips de catégories forge (partagé dessin / clic)
export function craftTabs(L) {
  const tx = L.cx + 30, ty = L.cy + 96, th = 30;
  const cw = (L.cw - 60 - 5 * 8) / 6;
  return CRAFT_CATS.map(([key, label], i) => ({
    key, label,
    r: { x: tx + i * (cw + 8), y: ty, w: cw, h: th },
    n: key === 'upgrade' ? 3 : key === 'repair' ? repairCount() : craftList(L).length
  }));
}

// layout 3 zones de l'onglet forge : liste | aperçu | coûts+fabrication
export function craftZones(L) {
  const y0 = L.cy + 140, y1 = L.cy + L.ch - 14;
  const lx = L.cx + 24, lw = 252;
  const cx2 = lx + lw + 14, cw2 = 316;
  const rx = cx2 + cw2 + 14, rw = L.cx + L.cw - 24 - rx;
  // liste scrollable des recettes
  const ids = craftList(L);
  const rows = ids.map((id, i) => ({ id, x: lx, y: y0 + i * 50 - forgeScroll, w: lw, h: 44 }));
  // recette sélectionnée (première par défaut)
  const selId = craftUI.sel && ids.includes(craftUI.sel) ? craftUI.sel : ids[0];
  const it = selId && ITEMS[selId];
  // panneau droit : matériaux + statut + bouton
  const ry = y0 + 8;
  const costRows = it ? Object.keys(it.cost).map((m, i) => ({ m, y: ry + 96 + i * 24 })) : [];
  return {
    lx, lw, cx2, cw2, rx, rw, y0, y1, rows, selId, it,
    craftBtn: it ? { x: rx + 16, y: y1 - 52, w: rw - 32, h: 38 } : null,
    costRows
  };
}

// coût d'une amélioration d'arme : XP = 10 % du niveau requis, prix en matériaux
export function upgradeCost(lvl) {
  return { essence: 8 + Math.floor(lvl / 8), cristal: 4 + Math.floor(lvl / 12) };
}
export function upgradeXpGain(inv, key) {
  const info = modeInfo(inv, key);
  return info.lvl >= MODE_MAX_LVL ? 0 : Math.max(1, Math.round(info.need * 0.10));
}
// rects des 3 cartes d'amélioration d'armes
export function upgradeCards(L) {
  const y0 = L.cy + 150, ch = 190, gap = 16;
  const cw = (L.cw - 60 - 2 * gap) / 3, x0 = L.cx + 30;
  return ['epee', 'lance', 'arc'].map((key, i) => ({
    key, x: x0 + i * (cw + gap), y: y0, w: cw, h: ch,
    btn: { x: x0 + i * (cw + gap) + 18, y: y0 + ch - 48, w: cw - 36, h: 32 }
  }));
}
// ---------- RÉPARATION : liste des équipements endommagés ----------
export function repairCount() { return damagedItems(G.inv).length; }
// lignes de la liste de réparation (scroll forgeScroll, tri : plus endommagé d'abord)
export function repairRows(L) {
  const y0 = L.cy + 178, y1 = L.cy + L.ch - 14;
  const lx = L.cx + 30, lw = L.cw - 60;
  const rh = 56, gap = 8;
  return damagedItems(G.inv).map((id, i) => ({
    id, x: lx, y: y0 + i * (rh + gap) - forgeScroll, w: lw, h: rh
  })).filter(r => r.y + r.h > y0 - 60 && r.y < y1 + 60);
}
// bouton « tout réparer » en haut à droite de l'onglet
export function repairAllBtn(L) {
  return { x: L.cx + L.cw - 240, y: L.cy + 130, w: 210, h: 28 };
}
// bouton de réparation d'une ligne (à droite de la ligne)
export function repairRowBtn(row) {
  return { x: row.x + row.w - 140, y: row.y + row.h / 2 - 14, w: 120, h: 28 };
}

// liste des objets possédés pour l'inventaire (rétro-compat : utilisé par les anciens appels)
export function invItems(L) {
  const g = invCells(L);
  return { headers: [], rows: g.cells.filter(c => c.id).map(c => ({
    id: c.id, x: c.x, y: c.y + forgeScroll * 0, w: c.w, h: c.h,
    empty: false,
    btn: { x: c.x + c.w - 100, y: c.y + c.h - 34, w: 88, h: 26 },
    rbtn: { x: c.x + c.w - 196, y: c.y + c.h - 34, w: 88, h: 26 }
  })), totalH: g.totalH };
}

export const SLOT_LABEL = { weapon: '⚔️ ARME', armor: '🛡️ ARMURE', helm: '⛑️ CASQUE', gloves: '🧤 GANTS', charm: '🧿 ACCESSOIRE', boots: '👢 BOTTES', conso: '🧪 CONSOMMABLE' };

// fiche équipement détaillée (modale) — géométrie partagée dessin / clic
function itemDetailLayout(dur, conso) {
  const cw = 620, ch = conso ? 470 : 500, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  const by = cy + ch - 66;
  const two = dur < DUR_MAX && !conso;
  return {
    cx, cy, cw, ch,
    close: { x: cx + cw - 48, y: cy + 12, w: 36, h: 32 },
    equip: two ? { x: cx + cw - 275, y: by, w: 235, h: 42 }
               : { x: cx + cw / 2 - (conso ? 140 : 140), y: by, w: conso ? 280 : 280, h: 42 },
    repair: { x: cx + 40, y: by, w: 235, h: 42 },
    use: conso ? { x: cx + cw / 2 - 140, y: by, w: 280, h: 42 } : null
  };
}

export function drawItemDetail() {
  const id = itemDetail;
  const it = id && ITEMS[id];
  if (!it) { itemDetail = null; return; }
  const dur = getDur(G.inv, id);
  const broken = dur <= 0;
  const conso = !!it.conso;
  const qty = conso ? (G.inv.items[id] || 0) : 0;
  const equipped = !conso && Object.values(G.inv.equip).includes(id);
  const rc = conso ? null : repairCost(G.inv, id);
  const L = itemDetailLayout(dur, conso);
  const tier = itemTier(it);
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(14,12,8,0.97)';
  roundRect(L.cx, L.cy, L.cw, L.ch, 18); ctx.fill();
  ctx.strokeStyle = broken ? '#ff5252' : tier; ctx.lineWidth = 2.5;
  roundRect(L.cx, L.cy, L.cw, L.ch, 18); ctx.stroke();

  // grande icône + nom + emplacement + rareté
  drawItemIcon(it, W / 2, L.cy + 88, 40);
  ctx.textAlign = 'center';
  ctx.fillStyle = broken ? '#ff8a80' : '#ffe9a3'; ctx.font = 'bold 23px Inter, sans-serif';
  ctx.fillText(fitText(it.name, L.cw - 60), W / 2, L.cy + 152);
  ctx.fillStyle = '#90caf9'; ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillText(SLOT_LABEL[it.slot] || it.slot.toUpperCase(), W / 2, L.cy + 174);
  ctx.fillStyle = tier; ctx.font = `bold 11px ${UI}`;
  ctx.fillText(`◆ ${ITEM_RARITY[it.rar] || 'Objet'}${conso ? ` · ×${qty}` : ''}`, W / 2, L.cy + 192);
  // comparaison : quel objet serait remplacé dans le même emplacement
  const mateId = conso ? null : G.inv.equip[it.slot];
  const mateIt = mateId && mateId !== id ? ITEMS[mateId] : null;
  ctx.fillStyle = broken ? '#ff8a80' : equipped ? '#69f0ae' : mateIt ? '#ffcc80' : '#90a4ae';
  ctx.font = 'italic 12.5px Inter, sans-serif';
  const statusTxt = conso ? `Consommable · tu en possèdes ×${qty}`
    : broken ? '💥 CASSÉ — reste équipé mais sans aucun bonus : répare-le !'
    : equipped ? '✓ Actuellement équipé'
    : mateIt ? `🔄 Équiper remplacera : ${mateIt.name} (${mateIt.desc})`
    : 'Dans ton inventaire';
  ctx.fillText(fitText(statusTxt, L.cw - 60), W / 2, L.cy + 210);

  // les niveaux d'armes se suivent dans l'onglet Héros (épée / lance)

  // description + effet (max 5 lignes, le reste est tronqué avec « … »)
  ctx.textAlign = 'left'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
  ctx.fillText('📜 DESCRIPTION', L.cx + 42, L.cy + 226);
  ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#e8e0c8';
  const maxLines = conso ? 3 : 5;
  let lines = wrapLines(it.desc, L.cw - 84);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = fitText(lines[maxLines - 1] + '…', L.cw - 84); }
  lines.forEach((ln, i) => ctx.fillText(ln, L.cx + 42, L.cy + 247 + i * 18));

  // effet de la consommation (conso uniquement)
  if (conso) {
    const by = L.cy + 306;
    ctx.textAlign = 'left'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
    ctx.fillText('✨ EFFET', L.cx + 42, by);
    ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#e8e0c8';
    const effTxt = id === 'ragoût' ? 'Augmente de façon permanente tes PV max de +35.'
      : id === 'breuvage' ? 'Augmente de façon permanente ton nombre de fioles de +1.'
      : it.desc;
    ctx.fillText(fitText(effTxt, L.cw - 84), L.cx + 42, by + 24);
  }

  // durabilité + réparation (masqués pour les consommables)
  const dy = L.cy + (conso ? 300 : 322);
  if (!conso) {
    ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
    ctx.fillText('🔧 DURABILITÉ', L.cx + 42, dy);
    const dbx = L.cx + 42, dbw = L.cw - 84, dby = dy + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(dbx, dby, dbw, 12, 6); ctx.fill();
    const st = durState(dur);
    const dc = st === 'ok' ? '#69f0ae' : st === 'warn' ? '#ffd740' : '#ff5252';
    if (dur > 0) { ctx.fillStyle = dc; roundRect(dbx, dby, dbw * dur / DUR_MAX, 12, 6); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(broken ? 'CASSÉ' : `${Math.round(dur)} / ${DUR_MAX}`, dbx + dbw / 2, dby + 10);
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
    ctx.fillText('💰 RÉPARATION', L.cx + 42, dy + 42);
    ctx.font = '12px Consolas, monospace';
    if (rc) {
      ctx.fillStyle = canRepair(G.inv, id) ? '#a5d6a7' : '#ef9a9a';
      ctx.fillText(fitText(Object.keys(rc).map(m => `${MATS[m].name} ×${rc[m]}`).join('  ·  '), L.cw - 240), L.cx + 140, dy + 42);
    } else {
      ctx.fillStyle = '#69f0ae';
      ctx.fillText(dur >= DUR_MAX ? 'Parfaite — aucune réparation nécessaire' : 'Matériaux insuffisants', L.cx + 140, dy + 42);
    }
  }

  // boutons : RÉPARER + ÉQUIPER (ou UTILISER pour un conso)
  if (!conso && dur < DUR_MAX) {
    const okR = canRepair(G.inv, id);
    const rb = L.repair;
    ctx.fillStyle = okR ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.06)';
    roundRect(rb.x, rb.y, rb.w, rb.h, 9); ctx.fill();
    ctx.strokeStyle = okR ? '#ff9800' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
    roundRect(rb.x, rb.y, rb.w, rb.h, 9); ctx.stroke();
    ctx.fillStyle = okR ? '#ffe0b2' : '#78909c'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(okR ? '🔧  RÉPARER' : 'MATÉRIAUX INSUFFISANTS', rb.x + rb.w / 2, rb.y + 27);
  }
  const eb = conso ? L.use : L.equip;
  ctx.fillStyle = conso ? 'rgba(105,240,174,0.28)' : equipped ? 'rgba(255,215,64,0.3)' : broken ? 'rgba(255,82,82,0.2)' : 'rgba(92,107,192,0.55)';
  roundRect(eb.x, eb.y, eb.w, eb.h, 10); ctx.fill();
  ctx.strokeStyle = conso ? '#69f0ae' : equipped ? '#ffd740' : broken ? '#ff5252' : '#9fa8da'; ctx.lineWidth = 2;
  roundRect(eb.x, eb.y, eb.w, eb.h, 10); ctx.stroke();
  ctx.fillStyle = conso ? '#b9f6ca' : equipped ? '#ffe9a3' : broken ? '#ff8a80' : '#fff'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(conso ? `✨  UTILISER (×${qty})` : equipped ? '✓  ÉQUIPÉ' : broken ? 'CASSÉ — À RÉPARER' : 'ÉQUIPER', eb.x + eb.w / 2, eb.y + 27);
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
    const it = ITEMS[itemDetail];
    const D = itemDetailLayout(getDur(G.inv, itemDetail), it && it.conso);
    if (inR(D.close, x, y)) { itemDetail = null; return 'close'; }
    const id = itemDetail;
    if (it && it.conso && D.use && inR(D.use, x, y)) {
      if (useConsumable(G.inv, id)) { sfxConfirm(); itemDetail = null; }
      return 'use';
    }
    if (!it || it.conso) return 'noop';
    if (inR(D.repair, x, y) && canRepair(G.inv, id)) {
      repairItem(G.inv, id);
      G.forgeAnim = { start: G.time, id, repair: true };
      sfxRepair();
      return 'repair';
    }
    if (inR(D.equip, x, y)) { toggleEquip(G.inv, id); sfxEquip(); return 'equip'; }
    return 'noop';
  }
  // clic hors champ de recherche -> quitter la saisie
  if (G.invQueryFocus && forgeTab === 'inv') {
    const g0 = invCells(L);
    if (!inR(g0.search, x, y)) { G.invQueryFocus = false; }
  }
  if (inR(T.back, x, y)) { itemDetail = null; G.invQueryFocus = false; return 'back'; }
  // don de matériaux : réservé à la forge + mode admin débloqué
  if (adminUnlocked() && inR(adminMatsBtn(L), x, y)) {
    for (const m in MATS) addMaterial(G.inv, m, 10);
    sfxCraft();
    return 'adminmats';
  }
  if (inR(T.craft, x, y)) { forgeTab = 'craft'; forgeScroll = 0; itemDetail = null; G.invQueryFocus = false; return 'tab'; }
  if (inR(T.inv, x, y)) { forgeTab = 'inv'; itemDetail = null; G.invQueryFocus = false; return 'tab'; }
  if (inR(T.hero, x, y)) { forgeTab = 'hero'; itemDetail = null; G.invQueryFocus = false; return 'tab'; }

  // ---------- onglet PERSONNAGE ----------
  if (forgeTab === 'hero') {
    const ht = heroTabs(L);
    if (inR(ht.apercu, x, y)) { heroUI.tab = 'apercu'; return 'htab'; }
    if (inR(ht.stats, x, y)) { heroUI.tab = 'stats'; return 'htab'; }
    if (heroUI.tab === 'stats') return null; // l'onglet caractéristiques est en lecture seule
    // choix des 2 armes emportées en partie (carte d'arme cliquable)
    for (const card of heroSkillCards(L)) {
      if (!inR(card, x, y)) continue;
      if (card.key === 'arc' && !(G.stats && G.stats.bowUnlocked)) return null; // verrouillée
      toggleLoadoutWeapon(G.inv, card.key);
      sfxClick();
      return 'wsel';
    }
    // choix de l'ultime
    const ub = ultBtns(L);
    if (inR(ub.nuke, x, y)) { G.stats.ultSel = 'nuke'; saveStats(); return 'ult'; }
    if (inR(ub.glace, x, y) && G.stats.iceUlt) { G.stats.ultSel = 'glace'; saveStats(); return 'ult'; }
    if (inR(ub.hell, x, y) && G.stats.hellUlt) { G.stats.ultSel = 'hell'; saveStats(); return 'ult'; }
    // liste des équipements à gauche -> fiche de l'objet équipé
    for (const row of heroEquipRows(L)) {
      const id = G.inv.equip[row.slot];
      if (id && inR(row, x, y)) { itemDetail = id; return 'open'; }
      // zone vide cliquable = rien (information seulement)
    }
    return null;
  }

  // ---------- onglet FORGE ----------
  if (forgeTab === 'craft') {
    const tabs = craftTabs(L);
    for (const t of tabs) {
      if (inR(t.r, x, y)) {
        craftUI.cat = t.key; forgeScroll = 0; craftUI.sel = null; itemDetail = null;
        return 'ctab';
      }
    }
    if (craftUI.cat === 'repair') {
      // RÉPARER TOUT : consomme les matériaux de tout ce qui est abordable
      const all = repairAllBtn(L);
      const total = repairAllCost(G.inv);
      const anyOk = damagedItems(G.inv).some(id => canRepair(G.inv, id));
      if (inR(all, x, y) && anyOk) {
        const r = repairAll(G.inv);
        if (r.repaired) { sfxRepair(); forgeScroll = 0; }
        return 'repairall';
      }
      for (const row of repairRows(L)) {
        const rb = repairRowBtn(row);
        if (inR(rb, x, y)) {
          if (canRepair(G.inv, row.id)) { repairItem(G.inv, row.id); sfxRepair(); return 'repair'; }
          return 'repairno';
        }
        // clic sur la ligne -> fiche détail de l'objet
        if (inR(row, x, y)) { itemDetail = row.id; return 'open'; }
      }
      return null;
    }
    if (craftUI.cat === 'upgrade') {
      // AMÉLIORER une arme : dépense des matériaux pour +10 % du XP requis
      const canPay = (cost) => Object.keys(cost).every(m => (G.inv.mats[m] || 0) >= cost[m]);
      for (const card of upgradeCards(L)) {
        const info = modeInfo(G.inv, card.key);
        const locked = card.key === 'arc' && !(G.stats && G.stats.bowUnlocked);
        const xpGain = upgradeXpGain(G.inv, card.key);
        const cost = upgradeCost(info.lvl);
        if (locked || info.lvl >= MODE_MAX_LVL || !canPay(cost)) continue;
        if (inR(card.btn, x, y)) {
          for (const m in cost) G.inv.mats[m] -= cost[m];
          addWmodeXp(G.inv, card.key, xpGain);
          sfxCraft();
          return 'upxp';
        }
      }
      return null;
    }
    // layout 3 zones : liste | aperçu | coûts (les lignes sont en coords écran, scroll inclus)
    const Z = craftZones(L);
    for (const r of Z.rows) {
      if (r.y < Z.y0 - 50 || r.y > Z.y1) continue;
      if (inR(r, x, y)) { craftUI.sel = r.id; return 'csel'; }
    }
    // bouton FABRIQUER
    const it = Z.it;
    if (it && Z.craftBtn && inR(Z.craftBtn, x, y)) {
      const id = Z.selId;
      if (canCraft(G.inv, id)) {
        craft(G.inv, id);
        G.forgeAnim = { start: G.time, id };
        sfxCraft();
        return 'craft';
      }
    }
    return null;
  }

  // ---------- onglet INVENTAIRE ----------
  {
    const g = invCells(L);
    for (const t of g.tabs) {
      if (inR(t.r, x, y)) { invUI.cat = t.key; forgeScroll = 0; G.invQueryFocus = false; return 'icat'; }
    }
    if (inR(g.search, x, y)) { G.invQueryFocus = !G.invQueryFocus; sfxClick(); return 'isearch'; }
    if (inR(g.sortBtn, x, y)) {
      invUI.sort = invUI.sort === 'name' ? 'rar' : invUI.sort === 'rar' ? 'slot' : 'name';
      sfxClick(); return 'isort';
    }
    if (inR(g.rarBtn, x, y)) {
      const order = ['all', 'commun', 'rare', 'epique', 'legendaire'];
      invUI.rar = order[(order.indexOf(invUI.rar) + 1) % order.length];
      sfxClick(); return 'irar';
    }
    const sy = y + forgeScroll;
    for (const c of g.cells) {
      if (c.mat) continue; // les matériaux sont en lecture seule
      if (c.y < g.view.y - 100 || c.y > g.view.y + g.view.h) continue;
      if (inR(c, x, sy)) { itemDetail = c.id; G.invQueryFocus = false; return 'open'; }
    }
  }
  return null;
}

// ---------- onglet PERSONNAGE : colonnes gauche/centre/droite + bandeau bas ----------
// zone de contenu : sous les onglets, au-dessus de la bande ULTIME/PROGRESSION
export function heroColLayout(L) {
  const ix = L.cx + 18, iy = L.cy + 96, iw = L.cw - 36;
  const stripY = L.cy + L.ch - 54;         // haut de la bande du bas
  const ih = stripY - 10 - iy;             // hauteur utile du contenu
  const colW = 240;
  return {
    ix, iy, iw, ih, colW, stripY,
    left:  { x: ix, y: iy, w: colW, h: ih },
    right: { x: ix + iw - colW, y: iy, w: colW, h: ih },
    dcx: ix + iw / 2,                       // centre horizontal = milieu du panneau
    dcy: iy + ih / 2
  };
}

// ---------- onglet PERSONNAGE : sous-onglets + lignes d'équipement ----------
// chips APERCU / CARACTÉRISTIQUES en haut à droite (même ligne que les onglets principaux)
export function heroTabs(L) {
  const y = L.cy + 62, h = 32, w = 140, x1 = L.cx + L.cw - 26;
  return {
    stats:  { x: x1 - w, y, w, h },
    apercu: { x: x1 - 2 * w - 8, y, w, h }
  };
}

// cartes d'armes de la colonne COMPÉTENCES (personnage) : ordre = SKILL_DEF de forge_gear.js
export function heroSkillCards(L) {
  const col = heroColLayout(L).right;
  const x = col.x + 14, w = col.w - 28, ch = 84, gap = 12, y0 = col.y + 54;
  return ['epee', 'arc', 'lance'].map((key, i) => ({
    key, x, y: y0 + i * (ch + gap), w, h: ch
  }));
}

// lignes cliquables de la liste d'équipement (colonne gauche) : 6 emplacements
export function heroEquipRows(L) {
  const CL = heroColLayout(L);
  const col = CL.left;
  const x = col.x + 10, w = col.w - 20;
  const y0 = col.y + 56, rh = 46, gap = 4;
  return ['weapon', 'armor', 'helm', 'gloves', 'charm', 'boots'].map((slot, i) => ({
    slot, x, y: y0 + i * (rh + gap), w, h: rh
  }));
}

// position du mannequin (colonne centrale)
export function heroDoll(L) {
  const CL = heroColLayout(L);
  return { x: CL.dcx, y: CL.dcy + 16 };
}

// sélecteur d'ultime : 3 boutons compacts sur la bande du bas (gauche)
export function ultBtns(L) {
  const y = L.cy + L.ch - 68, h = 34;
  const w = 196, gap = 10, x0 = L.cx + 24;
  return {
    nuke:  { x: x0, y, w, h },
    glace: { x: x0 + w + gap, y, w, h },
    hell:  { x: x0 + 2 * (w + gap), y, w, h }
  };
}
