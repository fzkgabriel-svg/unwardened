// js/menu/card.js — écran CARTE DE JOUEUR : sanctuaire du héros
// Grande carte animée à gauche ; à droite, onglets + grille de cosmétiques
// avec aperçu visuel de chaque élément (médaillon, cadre, fond, titre, ornement).
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect } from '../utils.js';
import { drawPlayerCard, cardBgStyle, cardFrameStyle } from '../card.js';
import { COSMETIC_CATS, gLevel, gXp, gXpNeed, isOwned, cosmeticUnlocked, equipCosmetic, resetCard, nextReward, rewardsAtLevel, MAX_LEVEL, RAR_COL } from '../cosmetics.js';
import { inR, overlineCentered, drawMenuButton, hexA, fitText, UI, SERIF, C_TEXT, C_MUTED, C_GOLD } from './common.js';
import { sfxConfirm, sfxDeny } from '../audio.js';
import { activeSlot, slotSummary, fmtPlaytime } from '../chars.js';

const PW = 1020, PH = 600;
let curTab = 'portrait';

// ---------- layout ----------
export function cardButtons() {
  const cx = W / 2 - PW / 2, cy = H / 2 - PH / 2 - 8;
  // colonne gauche : la carte
  const cardRect = { x: cx + 36, y: cy + 76, w: 384, h: 216 };
  // colonne droite : onglets + grille
  const rx = cx + 442, rw = PW - 442 - 36;
  const tabY = cy + 76, tabH = 34, tabGap = 6;
  const tabs = COSMETIC_CATS.map((c, i) => ({
    id: c.id, x: rx + 8 + i * ((rw - 16 + tabGap) / 5), y: tabY, w: (rw - 16 - 4 * tabGap) / 5, h: tabH,
  }));
  const gridX = rx + 8, gridY = tabY + tabH + 12;
  const cols = 3, gw = (rw - 16 - (cols - 1) * 8) / cols, gh = 62;
  const cat = COSMETIC_CATS.find(c => c.id === curTab);
  // tri par niveau de déblocage : la progression se lit de haut en bas
  const list = cat ? [...cat.list].sort((a, b) => a.lv - b.lv) : [];
  const items = list.map((c, i) => ({
    id: c.id, item: c,
    x: gridX + (i % cols) * (gw + 8),
    y: gridY + Math.floor(i / cols) * (gh + 8),
    w: gw, h: gh,
  }));
  const footY = cy + PH - 54;
  return {
    cx, cy, cardRect, tabs, items, footY,
    reset: { x: cx + PW - 196, y: footY, w: 164, h: 38 },
    back: { x: cx + 36, y: footY, w: 170, h: 38 },
    gridX, gridY,
  };
}

// ---------- aperçus visuels des tuiles ----------
function tilePreview(cat, item, x, y, s) {
  ctx.save();
  roundRect(x, y, s, s, 9); ctx.clip();
  ctx.fillStyle = '#101018'; ctx.fillRect(x, y, s, s);
  if (cat === 'portrait') {
    const g = ctx.createRadialGradient(x + s / 2, y + s / 2 - 3, 2, x + s / 2, y + s / 2, s / 1.6);
    g.addColorStop(0, item.col + 'aa'); g.addColorStop(1, '#101018');
    ctx.fillStyle = g; ctx.fillRect(x, y, s, s);
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.3, 0, TAU);
    ctx.fillStyle = '#0b0b12'; ctx.fill();
    ctx.font = `${s * 0.44}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(item.icon, x + s / 2, y + s / 2 + 1);
  } else if (cat === 'frame') {
    const fr = cardFrameStyle(item.id);
    ctx.fillStyle = '#0d0d14'; ctx.fillRect(x, y, s, s);
    const cg = ctx.createLinearGradient(x, y, x + s, y + s);
    cg.addColorStop(0, fr.c1); cg.addColorStop(1, fr.c2);
    ctx.strokeStyle = cg; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    roundRect(x + 4, y + 4, s - 8, s - 8, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(x + 12, y + 12, s - 24, s - 24, 4); ctx.fill();
  } else if (cat === 'background') {
    const bg = cardBgStyle(item.id);
    const g = ctx.createLinearGradient(x, y, x + s * 0.3, y + s);
    g.addColorStop(0, bg.g1); g.addColorStop(1, bg.g2);
    ctx.fillStyle = g; ctx.fillRect(x, y, s, s);
    const rg = ctx.createRadialGradient(x + s / 2, y + s * 0.4, 2, x + s / 2, y + s / 2, s / 1.4);
    rg.addColorStop(0, bg.acc + '55'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(x, y, s, s);
    ctx.font = `${s * 0.42}px serif`; ctx.globalAlpha = 0.55;
    ctx.fillText(bg.deco, x + s / 2, y + s / 2 + 1);
    ctx.globalAlpha = 1;
  } else if (cat === 'title') {
    const g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, '#1a1626'); g.addColorStop(1, '#0d0b14');
    ctx.fillStyle = g; ctx.fillRect(x, y, s, s);
    ctx.font = `${s * 0.5}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = item.col; ctx.shadowBlur = 8;
    ctx.fillStyle = item.col;
    ctx.fillText(item.icon, x + s / 2, y + s / 2 - 2);
    ctx.shadowBlur = 0;
    ctx.font = `600 7.5px ${UI}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(fitText(item.nom, s - 6), x + s / 2, y + s - 9);
  } else { // ornament
    const g = ctx.createRadialGradient(x + s / 2, y + s / 2, 2, x + s / 2, y + s / 2, s / 1.5);
    g.addColorStop(0, item.col + '44'); g.addColorStop(1, '#101018');
    ctx.fillStyle = g; ctx.fillRect(x, y, s, s);
    ctx.font = `${s * 0.52}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(item.icon, x + s / 2, y + s / 2 + 1);
  }
  ctx.restore();
  // liseré rareté en bas de la boîte
  ctx.fillStyle = RAR_COL[item.rar] || '#78909c';
  roundRect(x + 3, y + s - 6, s - 6, 3, 1.5); ctx.fill();
}

// ---------- clics ----------
export function cardClickAt(x, y) {
  const b = cardButtons();
  if (inR(b.back, x, y)) return 'back';
  for (const t of b.tabs) if (inR(t, x, y)) { curTab = t.id; return 'tab'; }
  for (const it of b.items) {
    if (inR(it, x, y)) {
      const item = it.item;
      if (!item || !cosmeticUnlocked(item.id)) { sfxDeny(); return 'locked'; }
      if (equipCosmetic(curTab, item.id)) { sfxConfirm(); G.stats.cardTouched = true; return 'equip'; }
      return 'deny';
    }
  }
  if (inR(b.reset, x, y)) {
    const eq = (G.stats.card = G.stats.card || {});
    if (eq.portrait || eq.frame || eq.background || eq.title || eq.ornament) {
      resetCard(); sfxDeny(); return 'reset';
    }
    return null;
  }
  return null;
}

// ---------- dessin ----------
export function drawCardView() {
  const b = cardButtons();
  const { cx, cy } = b;
  // panneau
  ctx.fillStyle = 'rgba(13,15,18,0.96)';
  roundRect(cx, cy, PW, PH, 16); ctx.fill();
  const pg = ctx.createLinearGradient(cx, cy, cx, cy + PH);
  pg.addColorStop(0, 'rgba(212,176,98,0.07)'); pg.addColorStop(0.12, 'rgba(0,0,0,0)');
  ctx.fillStyle = pg; roundRect(cx, cy, PW, PH, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(212,176,98,0.22)'; ctx.lineWidth = 1;
  roundRect(cx + 0.5, cy + 0.5, PW - 1, PH - 1, 16); ctx.stroke();

  // ---- en-tête ----
  overlineCentered('✦ IDENTITÉ ✦', W / 2, cy + 30);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = C_TEXT; ctx.font = `600 30px ${SERIF}`; ctx.letterSpacing = '3px';
  ctx.fillText('SANCTUAIRE DU HÉROS', W / 2, cy + 58);
  ctx.restore();
  // filet ornemental sous le titre
  ctx.strokeStyle = 'rgba(212,176,98,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 200, cy + 68); ctx.lineTo(cx + PW / 2 - 60, cy + 68);
  ctx.moveTo(cx + PW / 2 + 60, cy + 68); ctx.lineTo(cx + PW - 200, cy + 68);
  ctx.stroke();
  ctx.fillStyle = 'rgba(212,176,98,0.6)';
  [[cx + PW / 2 - 52, cy + 68], [cx + PW / 2 + 52, cy + 68]].forEach(([dx, dy]) => {
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
  });

  // ================= COLONNE GAUCHE : LA CARTE =================
  const lvl = gLevel(), xp = gXp(), need = gXpNeed();
  // halo derrière la carte
  const cr = b.cardRect;
  const hg = ctx.createRadialGradient(cr.x + cr.w / 2, cr.y + cr.h / 2, 20, cr.x + cr.w / 2, cr.y + cr.h / 2, cr.w * 0.75);
  hg.addColorStop(0, 'rgba(212,176,98,0.10)'); hg.addColorStop(1, 'transparent');
  ctx.fillStyle = hg; ctx.fillRect(cr.x - 60, cr.y - 40, cr.w + 120, cr.h + 80);
  drawPlayerCard(cr.x, cr.y, cr.w, cr.h);
  // étiquette APRÈS la carte (elle passe au-dessus du coin)
  ctx.font = `600 9px ${UI}`; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'left';
  ctx.fillText('APERÇU', cr.x + 10, cr.y + cr.h - 10);

  // ---- bloc niveau + XP ----
  const ly = cr.y + cr.h + 22;
  ctx.textAlign = 'left';
  ctx.font = `600 13px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('NIVEAU DU JOUEUR', cr.x, ly);
  // nombre + suffixe « / max » : le nombre s'arrête avant la place du suffixe
  // (avant : les deux étaient alignés à droite et se chevauchaient)
  ctx.textAlign = 'right'; ctx.font = `600 20px ${SERIF}`; ctx.fillStyle = C_GOLD;
  ctx.fillText(`${lvl}`, cr.x + cr.w - 36, ly - 4);
  ctx.font = `600 11px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText(`/ ${MAX_LEVEL}`, cr.x + cr.w, ly);
  // barre XP
  const bx = cr.x, bw = cr.w, by = ly + 10;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(bx, by, bw, 10, 5); ctx.fill();
  const pct = need ? Math.min(1, xp / need) : 1;
  if (pct > 0.01) {
    const xg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    xg.addColorStop(0, '#ffd54f'); xg.addColorStop(1, '#ff8a65');
    ctx.fillStyle = xg;
    roundRect(bx, by, Math.max(10, bw * pct), 10, 5); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,213,79,0.35)'; ctx.lineWidth = 1;
  roundRect(bx + 0.5, by + 0.5, bw - 1, 9, 4); ctx.stroke();
  ctx.font = `600 10.5px ${UI}`; ctx.fillStyle = C_MUTED; ctx.textAlign = 'center';
  ctx.fillText(lvl >= MAX_LEVEL ? 'NIVEAU MAXIMUM — TRANSCENDANT' : `${xp.toLocaleString('fr-FR')} / ${need.toLocaleString('fr-FR')} XP`, cr.x + cr.w / 2, by + 24);

  // ---- prochaines récompenses ----
  const ry = by + 44;
  ctx.textAlign = 'left'; ctx.font = `600 10px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('PROCHAINES RÉCOMPENSES', cr.x, ry);
  const p1 = nextReward();
  const paliers = [];
  for (let p = p1; p <= Math.min(MAX_LEVEL, p1 + 50); p += 25) {
    const items = rewardsAtLevel(p);
    if (items.length) paliers.push({ lvl: p, items });
    if (paliers.length >= 3) break;
  }
  paliers.forEach((pl, i) => {
    const px = cr.x + i * ((cr.w - 16) / 3), pw3 = (cr.w - 32) / 3;
    const py = ry + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    roundRect(px, py, pw3, 44, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(212,176,98,0.25)'; ctx.lineWidth = 1;
    roundRect(px + 0.5, py + 0.5, pw3 - 1, 43, 8); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = `700 11px ${UI}`; ctx.fillStyle = C_GOLD;
    ctx.fillText(`NV ${pl.lvl}`, px + pw3 / 2, py + 15);
    ctx.font = `${13}px serif`;
    const icons = pl.items.slice(0, 3).map(it => it.icon).join(' ');
    ctx.fillText(icons, px + pw3 / 2, py + 33);
  });

  // ---- stats du héros ----
  const sum = slotSummary(activeSlot());
  const worlds = Object.keys((G.stats && G.stats.campaignDone) || {}).length;
  const bosses = (G.stats && G.stats.totalBossKills) || 0;
  const sy = ry + 66;
  ctx.textAlign = 'left'; ctx.font = `600 11px ${UI}`; ctx.fillStyle = 'rgba(207,216,220,0.7)';
  ctx.fillText(`${worlds}/6 mondes`, cr.x, sy);
  ctx.fillText(`${bosses} boss vaincus`, cr.x + 110, sy);
  ctx.fillText(sum ? fmtPlaytime(sum.playtime) : '', cr.x + 250, sy);
  // cosmétiques débloqués
  const total = COSMETIC_CATS.reduce((n, c) => n + c.list.length, 0);
  const owned = (G.stats.cardOwned || []).length;
  ctx.textAlign = 'right'; ctx.fillStyle = C_GOLD;
  ctx.fillText(`${owned}/${total} cosmétiques`, cr.x + cr.w, sy);

  // ================= COLONNE DROITE : PERSONNALISATION =================
  const rx = b.cx + 442, rw = PW - 442 - 36;
  // ---- onglets ----
  b.tabs.forEach(t => {
    const c = COSMETIC_CATS.find(x => x.id === t.id);
    const on = t.id === curTab;
    const hov = inR(t, G.mouse.x, G.mouse.y);
    ctx.fillStyle = on ? 'rgba(212,176,98,0.16)' : hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.035)';
    roundRect(t.x, t.y, t.w, t.h, 9); ctx.fill();
    ctx.strokeStyle = on ? 'rgba(212,176,98,0.65)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    roundRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1, 9); ctx.stroke();
    ctx.font = `700 11.5px ${UI}`; ctx.fillStyle = on ? C_GOLD : C_MUTED; ctx.textAlign = 'center';
    ctx.fillText(`${c.icon} ${c.nom}`, t.x + t.w / 2, t.y + t.h / 2 + 4);
  });

  // ---- grille de cosmétiques ----
  const eq = (G.stats.card = G.stats.card || {});
  const eqKey = { portrait: 'portrait', frame: 'frame', background: 'background', title: 'title', ornament: 'ornament' }[curTab];
  const nxt = nextReward();
  b.items.forEach((it) => {
    const item = it.item;
    if (!item) return;
    const unlocked = cosmeticUnlocked(item.id);
    const equipped = eq[eqKey] === it.id;
    const isNext = !unlocked && item.lv === nxt;
    const hov = unlocked && inR(it, G.mouse.x, G.mouse.y);
    // fond tuile
    ctx.fillStyle = equipped ? 'rgba(212,176,98,0.15)'
      : hov ? 'rgba(255,255,255,0.10)'
      : isNext ? 'rgba(255,213,79,0.06)'
      : unlocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)';
    roundRect(it.x, it.y, it.w, it.h, 10); ctx.fill();
    ctx.strokeStyle = equipped ? 'rgba(212,176,98,0.85)'
      : unlocked ? hexA(item.col, 0.55) : isNext ? 'rgba(255,213,79,0.4)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = equipped ? 1.8 : 1;
    roundRect(it.x + 0.5, it.y + 0.5, it.w - 1, it.h - 1, 10); ctx.stroke();
    // aperçu visuel
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.4;
    tilePreview(curTab, item, it.x + 8, it.y + 8, 46);
    ctx.restore();
    // cadenas sur l'aperçu si verrouillé
    if (!unlocked) {
      ctx.font = `700 13px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText('🔒', it.x + 31, it.y + 34);
    }
    // textes
    const tx = it.x + 64;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = unlocked ? 1 : 0.5;
    ctx.font = `700 12.5px ${UI}`; ctx.fillStyle = unlocked ? C_TEXT : C_MUTED;
    const label = `${item.icon} ${item.nom}`;
    ctx.fillText(fitText(label, it.x + it.w - tx - 12), tx, it.y + 25);
    ctx.font = `600 9.5px ${UI}`;
    if (equipped) { ctx.fillStyle = C_GOLD; ctx.fillText('✔ ÉQUIPÉ', tx, it.y + 41); }
    else if (isOwned(item.id)) { ctx.fillStyle = item.col; ctx.fillText(`${item.rar.toUpperCase()}`, tx, it.y + 41); }
    else { ctx.fillStyle = '#6b6f75'; ctx.fillText(`NV ${item.lv} · ${item.rar.toUpperCase()}`, tx, it.y + 41); }
    ctx.globalAlpha = 1;
    // badge PROCHAIN sur la prochaine récompense
    if (isNext) {
      ctx.font = `700 8.5px ${UI}`; ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd54f';
      ctx.fillText('✦ PROCHAIN', it.x + it.w - 8, it.y + 16);
    }
  });

  // ---- pied ----
  const rh = inR(b.reset, G.mouse.x, G.mouse.y);
  ctx.fillStyle = rh ? 'rgba(198,40,40,0.28)' : 'rgba(198,40,40,0.12)';
  roundRect(b.reset.x, b.reset.y, b.reset.w, b.reset.h, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(229,115,115,0.55)'; ctx.lineWidth = 1;
  roundRect(b.reset.x + 0.5, b.reset.y + 0.5, b.reset.w - 1, b.reset.h - 1, 9); ctx.stroke();
  ctx.font = `700 11.5px ${UI}`; ctx.fillStyle = '#ef9a9a'; ctx.textAlign = 'center';
  ctx.fillText('↺ RÉINITIALISER', b.reset.x + b.reset.w / 2, b.reset.y + b.reset.h / 2 + 4);

  drawMenuButton(b.back, '← RETOUR', '#455a64', '#90a4ae', false);
}
