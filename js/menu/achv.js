import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect } from '../utils.js';
import { ACHIEVEMENTS, unlocked, RARITY, achievementCount, achInfo, isClaimed, claimReward, achProgress, achUnlockT, achCat, CATS, achCatList } from '../achievements.js';
import { MATS, loadInv } from '../inventory.js';
import { sfxConfirm, sfxClick } from '../audio.js';
import { fmtDate } from '../chars.js';
import { inR, fitText, wrapLines, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, drawMenuButton } from './common.js';

// ---------- état du registre ----------
let achScroll = 0;
let achDetail = null;          // id du succès ouvert en fiche
let achCatF = 'all';           // catégorie active
let achRarF = 'all';           // rareté active ('all' ou clé RARITY)
let achSortF = 'order';        // 'order' | 'rarity' | 'recent'
const WORLD_NAMES = ['Terres Oubliées', 'Terre Gelée', 'Les Enfers', 'Les Égouts', 'L\'Espace', 'Royaume des Tempêtes'];
const WORLD_ICONS = ['', '❄️', '🔥', '🗑️', '🛸', '🌪️'];
const RAR_ORDER = { all: 0, commun: 1, rare: 2, epique: 3, legendaire: 4 };

// ---------- géométrie ----------
function panelRect() {
  return { x: 44, y: 30, w: W - 88, h: H - 62 };
}
function headerRect() { const p = panelRect(); return { x: p.x + 26, y: p.y + 18, w: p.w - 52 }; }

// rangée d'onglets catégories
function catBtns() {
  const p = panelRect();
  const y = p.y + 176, h = 36, gap = 8;
  const bw = (p.w - 52 - gap * (CATS.length - 1)) / CATS.length;
  return CATS.map((c, i) => {
    const list = achCatList(c.id);
    const done = list.filter(a => unlocked[a.id]).length;
    return { cat: c, x: p.x + 26 + i * (bw + gap), y, w: bw, h, done, total: list.length };
  });
}

// rangée filtres : rareté + tri + recherche + tout réclamer
function filterRects() {
  const p = panelRect();
  const y = p.y + 222, h = 32;
  const rarKeys = ['all', 'commun', 'rare', 'epique', 'legendaire'];
  const rarLabels = { all: 'Toutes', commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
  const rarBtns = rarKeys.map((k, i) => ({ k, label: rarLabels[k], x: p.x + 26 + i * 86, y, w: 78, h }));
  const sortDefs = [['order', 'Ordre'], ['rarity', 'Rareté'], ['recent', 'Récent']];
  const sx = p.x + 26 + 5 * 86 + 14;
  const sortBtns = sortDefs.map(([k, label], i) => ({ k, label, x: sx + i * 92, y, w: 84, h }));
  const searchW = 190;
  const search = { x: p.x + p.w - 26 - searchW - 108, y, w: searchW, h };
  const claimAll = { x: search.x + searchW + 10, y, w: 98, h };
  return { rarBtns, sortBtns, search, claimAll };
}

// liste filtrée + triée
function achFiltered() {
  const q = (G.achQuery || '').trim().toLowerCase();
  let list = ACHIEVEMENTS.filter(a => {
    if (achCatF !== 'all' && achCat(a) !== achCatF) return false;
    if (achRarF !== 'all' && achInfo(a.id).key !== achRarF) return false;
    if (q && !(a.name + ' ' + a.desc).toLowerCase().includes(q)) return false;
    return true;
  });
  if (achSortF === 'rarity') {
    list = [...list].sort((x, y) => RAR_ORDER[achInfo(x.id).key] - RAR_ORDER[achInfo(y.id).key] || ACHIEVEMENTS.indexOf(x) - ACHIEVEMENTS.indexOf(y));
  } else if (achSortF === 'recent') {
    list = [...list].sort((x, y) => achUnlockT(y.id) - achUnlockT(x.id) || ACHIEVEMENTS.indexOf(x) - ACHIEVEMENTS.indexOf(y));
  }
  return list;
}

// ---------- grille ----------
const COLS = 4, CELL_W = 0, CELL_H = 108, GAP = 10;

function achCells() {
  const p = panelRect();
  const gx = p.x + 26, gy = p.y + 268;
  const viewW = p.w - 52;
  const cw = (viewW - GAP * (COLS - 1)) / COLS;
  const list = achFiltered();
  const cells = list.map((a, i) => {
    const x = gx + (i % COLS) * (cw + GAP);
    const y = gy + Math.floor(i / COLS) * (CELL_H + GAP) - achScroll;
    return { a, x, y, w: cw, h: CELL_H, ix: i };
  });
  const rows = Math.ceil(list.length / COLS);
  const contentH = rows * CELL_H + (rows - 1) * GAP;
  const viewB = p.y + p.h - 34;
  const viewH = viewB - gy;
  return {
    p, gx, gy, cw, cells, viewH, list,
    view: { x: gx - 6, y: gy - 6, w: viewW + 12, h: viewH },
    scrollMax: Math.max(0, contentH - viewH)
  };
}

export function achWheel(delta) {
  const { scrollMax } = achCells();
  achScroll = Math.max(0, Math.min(scrollMax, achScroll + delta * 0.5));
}

// ---------- fiche détail ----------
function achDetailLayout() {
  const cw = 620, ch = 500, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  return {
    cx, cy, cw, ch,
    close: { x: cx + cw - 52, y: cy + 14, w: 38, h: 34 },
    claim: { x: cx + cw / 2 - 100, y: cy + ch - 76, w: 200, h: 46 }
  };
}

// ---------- clics ----------
export function achClickAt(x, y) {
  const p = panelRect();
  // modale détail : intercepte tous les clics
  if (achDetail) {
    const L = achDetailLayout();
    if (inR(L.close, x, y)) { achDetail = null; return 'close'; }
    const a = ACHIEVEMENTS.find(v => v.id === achDetail);
    if (a && inR(L.claim, x, y)) {
      if (unlocked[a.id] && !isClaimed(a.id) && claimReward(a.id)) { sfxConfirm(); return 'claimed'; }
      return 'noop';
    }
    return 'noop';
  }
  // retour
  const back = { x: p.x + p.w - 150, y: p.y + 20, w: 124, h: 36 };
  if (inR(back, x, y)) { achDetail = null; achScroll = 0; G.achQueryFocus = false; return 'back'; }
  // recherche : focus / clic dedans
  const F = filterRects();
  if (inR(F.search, x, y)) { G.achQueryFocus = true; achScroll = 0; return 'search'; }
  G.achQueryFocus = false;
  // tout réclamer
  if (inR(F.claimAll, x, y)) {
    let n = 0;
    for (const a of achFiltered()) if (unlocked[a.id] && !isClaimed(a.id) && claimReward(a.id)) n++;
    if (n) sfxConfirm();
    return n ? 'claimedAll' : 'noop';
  }
  for (const c of catBtns()) {
    if (inR(c, x, y)) { if (achCatF !== c.cat.id) { achCatF = c.cat.id; achScroll = 0; achDetail = null; } return 'tab'; }
  }
  for (const r of F.rarBtns) {
    if (inR(r, x, y)) { if (achRarF !== r.k) { achRarF = r.k; achScroll = 0; } return 'rar'; }
  }
  for (const s of F.sortBtns) {
    if (inR(s, x, y)) { if (achSortF !== s.k) { achSortF = s.k; achScroll = 0; } return 'sort'; }
  }
  for (const c of achCells().cells) {
    if (!inR({ x: c.x, y: c.y, w: c.w, h: c.h }, x, y)) continue;
    const ok = !!unlocked[c.a.id];
    // mini-bouton réclamer en bas à droite de la carte
    const cb = { x: c.x + c.w - 74, y: c.y + c.h - 26, w: 62, h: 18 };
    if (ok && inR(cb, x, y)) {
      if (!isClaimed(c.a.id) && claimReward(c.a.id)) { sfxConfirm(); return 'claimed'; }
      return 'noop';
    }
    achDetail = c.a.id;
    return 'open';
  }
  return null;
}

// ---------- petits éléments ----------
function chip(x, y, w, h, label, on, accent) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (on) { g.addColorStop(0, 'rgba(212,175,55,0.30)'); g.addColorStop(1, 'rgba(212,175,55,0.14)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0.02)'); }
  ctx.fillStyle = g;
  ctx.strokeStyle = on ? (accent || C_GOLD) : 'rgba(255,255,255,0.14)';
  ctx.lineWidth = on ? 1.6 : 1;
  roundRect(x, y, w, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${h > 34 ? 12.5 : 11}px ${UI}`;
  ctx.fillStyle = on ? '#ffe9a3' : '#b8b0a0';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawBackBtn() {
  const p = panelRect();
  const b = { x: p.x + p.w - 150, y: p.y + 20, w: 124, h: 36 };
  drawMenuButton(b, '← RETOUR', '#455a64', '#90a4ae', false);
}

// ---------- écran principal ----------
export function drawAchievementsCard() {
  const p = panelRect();
  // fond panneau
  ctx.fillStyle = 'rgba(10,9,14,0.88)';
  roundRect(p.x, p.y, p.w, p.h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,0.4)'; ctx.lineWidth = 1.5;
  roundRect(p.x, p.y, p.w, p.h, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(212,175,55,0.15)'; ctx.lineWidth = 1;
  roundRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8, 13); ctx.stroke();

  const h = headerRect();
  // titre + ornement
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `bold 30px ${SERIF}`;
  ctx.fillStyle = '#ffd740';
  ctx.shadowColor = 'rgba(255,215,64,0.35)'; ctx.shadowBlur = 12;
  ctx.fillText('✦ REGISTRE DES EXPLOITS', h.x, h.y + 22);
  ctx.shadowBlur = 0;
  ctx.font = `500 12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Chaque exploit gravé ici témoigne de ta légende.', h.x, h.y + 44);

  drawBackBtn();

  // ---------- statistiques globales ----------
  const total = ACHIEVEMENTS.length;
  const done = achievementCount();
  const left = total - done;
  const claimableAll = ACHIEVEMENTS.filter(a => unlocked[a.id] && !isClaimed(a.id)).length;
  const pct = total ? done / total : 0;

  const sy = h.y + 62;
  // grand compteur
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `bold 34px ${SERIF}`; ctx.fillStyle = '#ffe9a3';
  ctx.fillText(`${done}`, h.x, sy + 12);
  const doneW = ctx.measureText(`${done}`).width; // mesure avec la police 34px, pas la petite
  ctx.font = `500 13px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText(`/ ${total} succès débloqués`, h.x + doneW + 8, sy + 14);

  // barre de progression globale
  const bw = 330, bx = h.x + 190, by = sy + 4;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(bx, by, bw, 10, 5); ctx.fill();
  const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  pg.addColorStop(0, 'rgba(212,175,55,0.5)'); pg.addColorStop(1, '#ffd740');
  ctx.fillStyle = pg;
  roundRect(bx, by, Math.max(10, bw * pct), 10, 5); ctx.fill();
  ctx.font = `600 11px ${UI}`; ctx.fillStyle = '#ffe9a3';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(pct * 100)} %`, bx + bw, by - 9);

  // chips stats
  const chips = [
    { label: `${left} restant${left > 1 ? 's' : ''}`, color: '#9fb3c8' },
    { label: `${claimableAll} récompense${claimableAll > 1 ? 's' : ''} à réclamer`, color: claimableAll ? '#81c784' : C_MUTED },
  ];
  let cx = bx + bw + 22;
  for (const c of chips) {
    ctx.font = `600 12px ${UI}`;
    const w = ctx.measureText(c.label).width + 22;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(cx, sy - 4, w, 30, 15); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    roundRect(cx, sy - 4, w, 30, 15); ctx.stroke();
    ctx.fillStyle = c.color; ctx.textAlign = 'center';
    ctx.fillText(c.label, cx + w / 2, sy + 11);
    cx += w + 10;
  }

  // dernier + prochain succès (décalés vers le bas pour aérer le bandeau stats)
  const ny = sy + 46;
  // dernier succès débloqué
  let lastA = null, lastT = 0;
  for (const a of ACHIEVEMENTS) { const t = achUnlockT(a.id); if (t > lastT) { lastT = t; lastA = a; } }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `600 10.5px ${UI}`; ctx.fillStyle = C_GOLD;
  ctx.fillText('✦ DERNIER EXPLOIT', h.x, ny);
  ctx.font = `500 13px ${UI}`; ctx.fillStyle = lastA ? C_TEXT : C_MUTED;
  ctx.fillText(lastA ? `${lastA.icon} ${lastA.name} — ${fmtDate(lastT)}` : 'Aucun pour le moment', h.x + 118, ny);

  // prochain succès (premier verrouillé de la liste filtrée)
  const filt = achFiltered();
  const nextA = filt.find(a => !unlocked[a.id]);
  ctx.fillStyle = C_GOLD;
  ctx.fillText('➤ PROCHAIN', h.x + 560, ny);
  if (nextA) {
    const pr = achProgress(nextA);
    ctx.font = `500 13px ${UI}`; ctx.fillStyle = C_TEXT;
    ctx.fillText(`${nextA.icon} ${fitText(nextA.name, 300)}`, h.x + 660, ny);
    if (pr) {
      const nbw = 90;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(h.x + 660, ny + 12, nbw, 5, 2.5); ctx.fill();
      ctx.fillStyle = '#ffd740';
      roundRect(h.x + 660, ny + 12, nbw * pr.pct, 5, 2.5); ctx.fill();
      ctx.font = `500 10px ${UI}`; ctx.fillStyle = C_MUTED;
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(pr.pct * 100)} %`, h.x + 660 + nbw + 6, ny + 14);
    }
  } else {
    ctx.font = `500 13px ${UI}`; ctx.fillStyle = '#81c784';
    ctx.fillText('Tous les succès de ce filtre sont débloqués !', h.x + 660, ny);
  }

  // ---------- onglets catégories ----------
  for (const c of catBtns()) {
    chip(c.x, c.y, c.w, c.h, `${c.cat.icon} ${c.cat.label} · ${c.done}/${c.total}`, achCatF === c.cat.id);
  }

  // ---------- filtres ----------
  const F = filterRects();
  for (const r of F.rarBtns) {
    const col = r.k === 'all' ? null : RARITY[r.k].color;
    chip(r.x, r.y, r.w, r.h, r.label, achRarF === r.k, col);
  }
  const sortLbl = { order: 'Ordre', rarity: 'Rareté', recent: 'Récent' };
  for (const s of F.sortBtns) chip(s.x, s.y, s.w, s.h, `⇅ ${sortLbl[s.k]}`, achSortF === s.k, '#7fb3d5');

  // recherche
  const focused = !!G.achQueryFocus;
  ctx.fillStyle = focused ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.05)';
  roundRect(F.search.x, F.search.y, F.search.w, F.search.h, F.search.h / 2); ctx.fill();
  ctx.strokeStyle = focused ? C_GOLD : 'rgba(255,255,255,0.15)'; ctx.lineWidth = focused ? 1.8 : 1;
  roundRect(F.search.x, F.search.y, F.search.w, F.search.h, F.search.h / 2); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `500 12px ${UI}`;
  const q = G.achQuery || '';
  ctx.fillStyle = q ? C_TEXT : C_MUTED;
  ctx.fillText(q ? q + (focused && Math.floor(G.time * 2) % 2 ? '▌' : '') : '🔍 Rechercher…', F.search.x + 14, F.search.y + F.search.h / 2 + 1);

  // tout réclamer
  const nClaim = achFiltered().filter(a => unlocked[a.id] && !isClaimed(a.id)).length;
  chip(F.claimAll.x, F.claimAll.y, F.claimAll.w, F.claimAll.h, `🎁 Tout (${nClaim})`, false, nClaim ? '#81c784' : null);

  // ---------- grille des cartes ----------
  const { cells, view, scrollMax } = achCells();
  ctx.save();
  ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
  for (const c of cells) {
    const a = c.a, ok = !!unlocked[a.id], claimed = isClaimed(a.id);
    const claimable = ok && !claimed;
    const { key, rarity, reward } = achInfo(a.id);
    const hid = a.hidden && !ok;
    const pr = ok ? null : achProgress(a);
    const legendary = key === 'legendaire';

    ctx.save();
    // carte
    const bgA = hid ? 0.30 : ok ? (claimed ? 0.62 : 0.72) : 0.45;
    ctx.globalAlpha = bgA;
    const bg = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
    if (claimable) { bg.addColorStop(0, 'rgba(46,80,52,0.9)'); bg.addColorStop(1, 'rgba(24,40,28,0.9)'); }
    else if (claimed) { bg.addColorStop(0, 'rgba(60,52,26,0.9)'); bg.addColorStop(1, 'rgba(34,30,16,0.9)'); }
    else { bg.addColorStop(0, 'rgba(30,32,44,0.9)'); bg.addColorStop(1, 'rgba(18,20,30,0.9)'); }
    ctx.fillStyle = bg;
    roundRect(c.x, c.y, c.w, c.h, 10); ctx.fill();
    // bordure rareté (légendaire : lueur dorée)
    ctx.strokeStyle = hid ? 'rgba(140,120,200,0.35)' : rarity.color + '88';
    ctx.lineWidth = legendary && ok ? 2 : 1.2;
    if (legendary && ok) { ctx.shadowColor = 'rgba(255,215,64,0.55)'; ctx.shadowBlur = 10; }
    roundRect(c.x, c.y, c.w, c.h, 10); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // filet supérieur coloré par rareté
    ctx.fillStyle = hid ? 'rgba(140,120,200,0.4)' : rarity.color + '55';
    roundRect(c.x + 10, c.y + 1, c.w - 20, 3, 1.5); ctx.fill();

    // icône
    ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(hid ? '❓' : a.icon, c.x + 24, c.y + 30);

    // nom + rareté
    ctx.textAlign = 'left';
    ctx.font = `bold 12.5px ${UI}`;
    ctx.fillStyle = hid ? '#9a8fb8' : ok ? (claimed ? '#e8d9a8' : '#ffe9a3') : '#8b93a8';
    ctx.fillText(fitText(hid ? 'Succès mystère' : a.name, c.w - 108), c.x + 44, c.y + 18);
    ctx.font = `600 9px ${UI}`;
    ctx.fillStyle = hid ? '#6a5f8f' : rarity.color;
    ctx.fillText(hid ? '???' : rarity.label.toUpperCase(), c.x + 44, c.y + 33);
    // badge monde (à droite de la rareté)
    if ((a.tab || 0) > 0 && !hid) {
      ctx.textAlign = 'right';
      ctx.font = `500 9px ${UI}`; ctx.fillStyle = '#7d86a0';
      ctx.fillText(WORLD_ICONS[a.tab] || '', c.x + c.w - 8, c.y + 33);
      ctx.textAlign = 'left';
    }

    // description (1 ligne)
    ctx.font = `400 10.5px ${UI}`;
    ctx.fillStyle = ok ? '#b9b2a2' : '#6d7488';
    ctx.fillText(fitText(hid ? 'Ce succès reste caché jusqu\'à son déblocage…' : a.desc, c.w - 56), c.x + 44, c.y + 50);

    // barre de progression (si disponible et non débloqué)
    if (pr) {
      const pbx = c.x + 44, pbw = c.w - 100;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(pbx, c.y + 62, pbw, 5, 2.5); ctx.fill();
      ctx.fillStyle = '#7fb3d5';
      roundRect(pbx, c.y + 62, pbw * pr.pct, 5, 2.5); ctx.fill();
      ctx.font = `500 9px ${UI}`; ctx.fillStyle = '#9fb3c8';
      ctx.fillText(`${Math.round(pr.pct * 100)} %`, pbx + pbw + 5, c.y + 65);
    } else if (!ok) {
      ctx.font = `500 9.5px ${UI}`; ctx.fillStyle = '#5d6478';
      ctx.fillText('◇ Objectif à découvrir', c.x + 44, c.y + 65);
    }

    // récompense (bas de carte)
    ctx.font = `500 9px Consolas, monospace`;
    if (claimed) {
      ctx.fillStyle = '#ffd740';
      ctx.fillText('✓ Récompense récoltée', c.x + 44, c.y + c.h - 14);
    } else if (hid) {
      ctx.fillStyle = '#6a5f8f';
      ctx.fillText('🎁 ???', c.x + 44, c.y + c.h - 14);
    } else {
      const rw = Object.keys(reward).map(m => `${MATS[m] ? MATS[m].name : m} ×${reward[m]}`).join(' · ');
      ctx.fillStyle = ok ? '#d8cba0' : '#5d6478';
      ctx.fillText(fitText('🎁 ' + rw, c.w - 130), c.x + 44, c.y + c.h - 14);
    }

    // bouton réclamer / statut
    const cb = { x: c.x + c.w - 74, y: c.y + c.h - 26, w: 62, h: 18 };
    if (ok) {
      ctx.fillStyle = claimable ? 'rgba(76,175,80,0.75)' : 'rgba(255,255,255,0.07)';
      roundRect(cb.x, cb.y, cb.w, cb.h, 6); ctx.fill();
      ctx.strokeStyle = claimable ? '#81c784' : 'rgba(255,215,64,0.4)';
      ctx.lineWidth = 1.2; roundRect(cb.x, cb.y, cb.w, cb.h, 6); ctx.stroke();
      ctx.fillStyle = claimable ? '#fff' : '#ffd740';
      ctx.font = `bold 9px ${UI}`; ctx.textAlign = 'center';
      ctx.fillText(claimable ? 'OBTENIR' : '✓', cb.x + cb.w / 2, cb.y + 10);
    } else {
      ctx.font = `500 10px ${UI}`; ctx.textAlign = 'center';
      ctx.fillStyle = '#4a5165';
      ctx.fillText('🔒', cb.x + cb.w / 2, cb.y + 10);
    }
    ctx.restore();
  }
  ctx.restore(); // fin clip

  // scrollbar
  if (scrollMax > 0) {
    const sx = view.x + view.w + 8, sy = view.y, sh = view.h;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(sx, sy, 7, sh, 4); ctx.fill();
    const thumbH = Math.max(28, sh * (view.h / (view.h + scrollMax)));
    const thumbY = sy + (sh - thumbH) * (achScroll / scrollMax);
    ctx.fillStyle = 'rgba(255,215,64,0.55)';
    roundRect(sx, thumbY, 7, thumbH, 4); ctx.fill();
  }

  // indice bas
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `400 10.5px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Molette pour défiler · clic sur un succès pour le détail · 🔍 pour rechercher', W / 2, p.y + p.h - 14);

  if (achDetail) drawAchDetail();
}

// ---------- fiche détail d'un succès ----------
function drawAchDetail() {
  const a = ACHIEVEMENTS.find(v => v.id === achDetail);
  if (!a) { achDetail = null; return; }
  const ok = !!unlocked[a.id], claimed = isClaimed(a.id);
  const { key, rarity, reward } = achInfo(a.id);
  const hid = a.hidden && !ok;
  const L = achDetailLayout();
  const legendary = key === 'legendaire';

  ctx.fillStyle = 'rgba(0,0,0,0.66)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(12,11,17,0.97)';
  roundRect(L.cx, L.cy, L.cw, L.ch, 16); ctx.fill();
  ctx.strokeStyle = hid ? 'rgba(140,120,200,0.6)' : rarity.color; ctx.lineWidth = 2;
  if (legendary && ok) { ctx.shadowColor = 'rgba(255,215,64,0.6)'; ctx.shadowBlur = 16; }
  roundRect(L.cx, L.cy, L.cw, L.ch, 16); ctx.stroke();
  ctx.shadowBlur = 0;
  // filet rareté en haut
  const rg = ctx.createLinearGradient(L.cx + 20, 0, L.cx + L.cw - 20, 0);
  rg.addColorStop(0, 'transparent'); rg.addColorStop(0.5, hid ? 'rgba(140,120,200,0.8)' : rarity.color); rg.addColorStop(1, 'transparent');
  ctx.fillStyle = rg;
  roundRect(L.cx + 20, L.cy + 2, L.cw - 40, 3, 1.5); ctx.fill();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // icône + nom + rareté
  ctx.font = '56px serif';
  ctx.fillText(hid ? '❓' : a.icon, W / 2, L.cy + 78);
  ctx.font = `bold 26px ${SERIF}`;
  ctx.fillStyle = ok ? '#ffe9a3' : '#8b93a8';
  ctx.fillText(fitText(hid ? 'Succès mystère' : a.name, L.cw - 90), W / 2, L.cy + 128);
  ctx.font = `600 12px ${UI}`;
  ctx.fillStyle = hid ? '#6a5f8f' : rarity.color;
  ctx.fillText(hid ? '???' : `★ ${rarity.label.toUpperCase()}`, W / 2, L.cy + 152);
  // monde + date + statut
  ctx.font = `500 11px ${UI}`; ctx.fillStyle = C_MUTED;
  const worldTxt = (a.tab || 0) > 0 ? ` · ${WORLD_NAMES[a.tab] || ''}` : '';
  ctx.fillText(`${WORLD_NAMES[0]}${worldTxt}`, W / 2, L.cy + 170);
  ctx.fillStyle = ok ? (claimed ? '#81c784' : '#ffd740') : '#6d7488';
  ctx.font = `600 12px ${UI}`;
  ctx.fillText(ok ? (claimed ? `✓ Débloqué le ${fmtDate(achUnlockT(a.id))} — récompense récoltée` : `✓ Débloqué le ${fmtDate(achUnlockT(a.id))} — récompense à réclamer !`) : '🔒 Pas encore débloqué', W / 2, L.cy + 192);

  // objectif
  ctx.textAlign = 'left';
  ctx.font = `600 12px ${UI}`; ctx.fillStyle = C_GOLD;
  ctx.fillText('🎯 COMMENT L\'OBTENIR', L.cx + 36, L.cy + 226);
  ctx.font = `500 14px ${UI}`; ctx.fillStyle = '#e8e0c8';
  const lines = wrapLines(hid ? 'Ce succès reste caché jusqu\'à son déblocage. Explore, bats-toi et reviens plus fort…' : a.desc, L.cw - 72);
  lines.forEach((ln, i) => ctx.fillText(ln, L.cx + 36, L.cy + 250 + i * 20));

  // progression
  const pr = ok ? null : achProgress(a);
  let ry = L.cy + 250 + lines.length * 20 + 16;
  if (pr) {
    ctx.font = `600 12px ${UI}`; ctx.fillStyle = C_GOLD;
    ctx.fillText('📊 PROGRESSION', L.cx + 36, ry);
    const pbx = L.cx + 36, pbw = L.cw - 72;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(pbx, ry + 12, pbw, 8, 4); ctx.fill();
    ctx.fillStyle = '#7fb3d5';
    roundRect(pbx, ry + 12, pbw * pr.pct, 8, 4); ctx.fill();
    ctx.font = `500 11px ${UI}`; ctx.fillStyle = '#9fb3c8'; ctx.textAlign = 'right';
    ctx.fillText(`${pr.cur} / ${pr.max}  (${Math.round(pr.pct * 100)} %)`, L.cx + L.cw - 36, ry + 16);
    ctx.textAlign = 'left';
    ry += 40;
  }

  // récompense
  ctx.font = `600 12px ${UI}`; ctx.fillStyle = C_GOLD;
  ctx.fillText('🎁 RÉCOMPENSE', L.cx + 36, ry);
  const rwKeys = Object.keys(reward);
  if (rwKeys.length) {
    const rwTxt = rwKeys.map(m => `${MATS[m] ? MATS[m].name : m} ×${reward[m]}`).join('   ·   ');
    ctx.font = `500 13px Consolas, monospace`;
    ctx.fillStyle = hid ? '#6a5f8f' : ok ? '#ffe9a3' : '#8b93a8';
    ctx.fillText(fitText(rwTxt, L.cw - 72), L.cx + 36, ry + 24);
  } else {
    ctx.font = `500 12px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText('Aucune récompense matérielle', L.cx + 36, ry + 24);
  }

  // boutons
  const claimable = ok && !claimed;
  if (claimable) {
    const cb = L.claim;
    const gg = ctx.createLinearGradient(0, cb.y, 0, cb.y + cb.h);
    gg.addColorStop(0, 'rgba(76,175,80,0.85)'); gg.addColorStop(1, 'rgba(46,125,50,0.85)');
    ctx.fillStyle = gg;
    roundRect(cb.x, cb.y, cb.w, cb.h, 12); ctx.fill();
    ctx.strokeStyle = '#a5d6a7'; ctx.lineWidth = 1.8;
    roundRect(cb.x, cb.y, cb.w, cb.h, 12); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold 15px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText('★  RÉCLAMER LA RÉCOMPENSE  ★', cb.x + cb.w / 2, cb.y + cb.h / 2 + 1);
  } else {
    ctx.font = `500 12px ${UI}`; ctx.textAlign = 'center';
    ctx.fillStyle = claimed ? '#81c784' : '#5d6478';
    ctx.fillText(claimed ? 'Récompense déjà récoltée ✓' : 'Verrouillé — continue à jouer !', W / 2, L.claim.y + 24);
  }
  // fermer
  const fb = L.close;
  ctx.fillStyle = 'rgba(69,90,100,0.85)';
  roundRect(fb.x, fb.y, fb.w, fb.h, 9); ctx.fill();
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.4;
  roundRect(fb.x, fb.y, fb.w, fb.h, 9); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `bold 16px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText('✕', fb.x + fb.w / 2, fb.y + fb.h / 2 + 1);
}
