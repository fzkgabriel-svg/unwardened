// js/menu/card.js — écran CARTE DE JOUEUR : aperçu + personnalisation par onglets
import { G, ctx, W, H } from '../state.js';
import { roundRect } from '../utils.js';
import { drawPlayerCard } from '../card.js';
import { COSMETIC_CATS, gLevel, gXp, gXpNeed, isOwned, cosmeticUnlocked, equipCosmetic, resetCard, nextReward, rewardsAtLevel, MAX_LEVEL, REWARD_EVERY } from '../cosmetics.js';
import { inR, overlineCentered, drawMenuButton, menuButtons, hexA, UI, SERIF, C_TEXT, C_MUTED, C_GOLD } from './common.js';
import { sfxConfirm, sfxDeny } from '../audio.js';

const PW = 920, PH = 596;
let curTab = 'portrait';

export function cardButtons() {
  const cx = W / 2 - PW / 2, cy = H / 2 - PH / 2 - 16;
  const tabY = cy + 292;
  const tabs = COSMETIC_CATS.map((c, i) => ({
    id: c.id, x: cx + 40 + i * ((PW - 80) / 5), y: tabY, w: (PW - 80) / 5 - 8, h: 32,
  }));
  const cat = COSMETIC_CATS.find(c => c.id === curTab);
  const gridY = tabY + 42;
  const cols = 5, gw = (PW - 80) / cols, gh = 50;
  const items = (cat ? cat.list : []).map((c, i) => ({
    id: c.id,
    x: cx + 40 + (i % cols) * gw,
    y: gridY + Math.floor(i / cols) * (gh + 6),
    w: gw - 8, h: gh,
  }));
  const rows = Math.ceil(items.length / cols);
  const footY = gridY + rows * (gh + 6) + 10;
  return {
    cx, cy, tabs, items,
    reset: { x: cx + PW - 210, y: footY, w: 180, h: 36 },
    back: { x: cx + 40, y: footY, w: 160, h: 36 },
    cardRect: { x: cx + 40, y: cy + 84, w: PW - 80, h: 140 },
  };
}

export function cardClickAt(x, y) {
  const b = cardButtons();
  if (inR(b.back, x, y)) return 'back';
  for (const t of b.tabs) if (inR(t, x, y)) { curTab = t.id; return 'tab'; }
  for (const it of b.items) {
    if (inR(it, x, y)) {
      const cat = COSMETIC_CATS.find(c => c.id === curTab);
      const item = cat.list.find(c => c.id === it.id);
      if (!item || !cosmeticUnlocked(item.id)) { sfxDeny(); return 'locked'; }
      if (equipCosmetic(curTab, it.id)) { sfxConfirm(); G.stats.cardTouched = true; return 'equip'; }
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

export function drawCardView() {
  const b = cardButtons();
  const { cx, cy } = b;
  ctx.fillStyle = 'rgba(15,17,19,0.95)';
  roundRect(cx, cy, PW, PH, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(cx + 0.5, cy + 0.5, PW - 1, PH - 1, 14); ctx.stroke();

  ctx.textAlign = 'center';
  overlineCentered('IDENTITÉ DU JOUEUR', W / 2, cy + 34);
  ctx.save();
  ctx.fillStyle = C_TEXT; ctx.font = `600 26px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillText('CARTE DE JOUEUR', W / 2 + 1, cy + 64);
  ctx.restore();

  // ---- aperçu de la carte ----
  const cr = b.cardRect;
  drawPlayerCard(cr.x, cr.y, cr.w, cr.h);
  // liseré "APERÇU"
  ctx.font = `600 10px ${UI}`; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.textAlign = 'left';
  ctx.fillText('APERÇU', cr.x + 8, cr.y + 16);

  // ---- niveau + XP sous l'aperçu ----
  const lvl = gLevel(), xp = gXp(), need = gXpNeed();
  ctx.textAlign = 'center'; ctx.font = `600 13px ${UI}`;
  ctx.fillStyle = C_GOLD;
  ctx.fillText(`NIVEAU ${lvl} / ${MAX_LEVEL}`, W / 2, cy + 246);
  const nbx = cx + 60, nbw = PW - 120, nby = cy + 254;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(nbx, nby, nbw, 8, 4); ctx.fill();
  const pct = need ? Math.min(1, xp / need) : 1;
  if (pct > 0.01) {
    ctx.fillStyle = '#ffd54f';
    roundRect(nbx, nby, nbw * pct, 8, 4); ctx.fill();
  }
  ctx.font = `600 10px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText(lvl >= MAX_LEVEL ? 'NIVEAU MAXIMUM — TRANSCENDANT' : `${xp.toLocaleString('fr-FR')} / ${need.toLocaleString('fr-FR')} XP · prochain palier : NV ${nextReward()}`,
    W / 2, nby + 20);

  // ---- onglets ----
  const cat = COSMETIC_CATS.find(c => c.id === curTab);
  b.tabs.forEach(t => {
    const c = COSMETIC_CATS.find(x => x.id === t.id);
    const on = t.id === curTab;
    ctx.fillStyle = on ? 'rgba(212,176,98,0.16)' : 'rgba(255,255,255,0.04)';
    roundRect(t.x, t.y, t.w, t.h, 8); ctx.fill();
    ctx.strokeStyle = on ? 'rgba(212,176,98,0.6)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    roundRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1, 8); ctx.stroke();
    ctx.font = `700 12px ${UI}`; ctx.fillStyle = on ? C_GOLD : C_MUTED; ctx.textAlign = 'center';
    ctx.fillText(`${c.icon} ${c.nom}`, t.x + t.w / 2, t.y + t.h / 2 + 4);
  });

  // ---- grille de cosmétiques ----
  const eq = (G.stats.card = G.stats.card || {});
  const eqKey = { portrait: 'portrait', frame: 'frame', background: 'background', title: 'title', ornament: 'ornament' }[curTab];
  b.items.forEach(it => {
    const item = cat.list.find(c => c.id === it.id);
    const unlocked = cosmeticUnlocked(item.id);
    const owned = isOwned(item.id);
    const equipped = eq[eqKey] === it.id;
    const hov = unlocked && inR(it, G.mouse.x, G.mouse.y);
    // fond tuile
    ctx.fillStyle = equipped ? 'rgba(212,176,98,0.14)'
      : hov ? 'rgba(255,255,255,0.09)'
      : unlocked ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)';
    roundRect(it.x, it.y, it.w, it.h, 8); ctx.fill();
    ctx.strokeStyle = equipped ? 'rgba(212,176,98,0.8)'
      : unlocked ? hexA(item.col, 0.5) : 'rgba(255,255,255,0.07)';
    ctx.lineWidth = equipped ? 1.6 : 1;
    roundRect(it.x + 0.5, it.y + 0.5, it.w - 1, it.h - 1, 8); ctx.stroke();
    // icône + nom
    ctx.textAlign = 'left';
    ctx.globalAlpha = unlocked ? 1 : 0.45;
    ctx.font = `700 15px ${UI}`; ctx.fillStyle = unlocked ? item.col : C_MUTED;
    ctx.fillText(`${item.icon} ${item.nom}`, it.x + 12, it.y + 24);
    ctx.font = `10px ${UI}`; ctx.fillStyle = unlocked ? C_MUTED : '#666';
    const status = equipped ? '✔ ÉQUIPÉ' : owned ? `${item.rar}` : `NV ${item.lv} · ${item.rar}`;
    ctx.fillText(status.length > 22 ? status.slice(0, 21) + '…' : status, it.x + 10, it.y + 40);
    ctx.globalAlpha = 1;
    if (!unlocked) {
      ctx.textAlign = 'right'; ctx.font = `700 11px ${UI}`; ctx.fillStyle = '#555';
      ctx.fillText('🔒', it.x + it.w - 10, it.y + 22);
    }
  });

  // ---- pied : bouton reset ----
  const rh = inR(b.reset, G.mouse.x, G.mouse.y);
  ctx.fillStyle = rh ? 'rgba(198,40,40,0.25)' : 'rgba(198,40,40,0.12)';
  roundRect(b.reset.x, b.reset.y, b.reset.w, b.reset.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(229,115,115,0.5)'; ctx.lineWidth = 1;
  roundRect(b.reset.x + 0.5, b.reset.y + 0.5, b.reset.w - 1, b.reset.h - 1, 8); ctx.stroke();
  ctx.font = `700 12px ${UI}`; ctx.fillStyle = '#ef9a9a'; ctx.textAlign = 'center';
  ctx.fillText('↺ RÉINITIALISER', b.reset.x + b.reset.w / 2, b.reset.y + b.reset.h / 2 + 4);

  drawMenuButton(b.back, '← RETOUR', '#455a64', '#90a4ae', false);
}
