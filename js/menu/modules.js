// js/menu/modules.js — interface MODULES holographique futuriste
// Scène tech : fond animée (grille, particules, scanlines), pods d'équipement,
// cartes holographiques par rareté, panneau de détail, boutique intégrée.
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, hexA } from '../utils.js';
import { MODULES, MOD_IDS, modState, modulesUnlocked, ensureModules, unlockPassSlot, PASS_SLOT_PRICE } from '../modules.js';
import { saveInv } from '../inventory.js';
import { inR, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, menuButtons, drawMenuButton } from './common.js';
import { sfxClick, sfxEquip, sfxConfirm } from '../audio.js';

const RAR_COL = { 'Commun': '#90a4ae', 'Rare': '#40c4ff', 'Épique': '#b388ff', 'Légendaire': '#ffd740' };
const RAR_GLOW = { 'Commun': 'rgba(144,164,174,0.5)', 'Rare': 'rgba(64,196,255,0.55)', 'Épique': 'rgba(179,136,255,0.6)', 'Légendaire': 'rgba(255,215,64,0.65)' };
const CYAN = '#18ffff', VIOLET = '#7b2ff7';

// ---------- layout ----------
function layout() {
  const t = G.time || 0;
  // pods d'équipement (haut, centrés)
  const sw = Math.min(300, W * 0.24), sh = 92, gap = 34;
  const sx = W / 2 - (sw * 2 + gap) / 2, sy = 88;
  const slots = [
    { key: 'act', label: 'MODULE ACTIF', hint: 'Touche X', x: sx, y: sy, w: sw, h: sh },
    { key: 'pass', label: 'MODULE PASSIF', hint: '', x: sx + sw + gap, y: sy, w: sw, h: sh },
  ];
  // panneau détail (droite)
  const dw = Math.min(360, W * 0.3), dy = 196, dh = 356;
  const det = { x: W - dw - 34, y: dy, w: dw, h: dh };
  // grille des modules (gauche), tous les modules : possédés + verrouillés
  const gx = 34, gy = 196, gw = det.x - gx - 18;
  const cols = 4, rows = 3;
  const cw = (gw - (cols - 1) * 12) / cols, ch = (dh - (rows - 1) * 12) / rows;
  const ownedSet = G.inv ? modState(G.inv).owned : [];
  const ids = [...MOD_IDS].sort((a, b) => (ownedSet.includes(b) ? 1 : 0) - (ownedSet.includes(a) ? 1 : 0));
  const cards = ids.map((id, i) => ({
    id, x: gx + (i % cols) * (cw + 12), y: gy + Math.floor(i / cols) * (ch + 12), w: cw, h: ch, i,
  }));
  const btnY = det.y + det.h - 52;
  return {
    slots, cards, det,
    equipBtn: { x: det.x + 20, y: btnY, w: det.w - 40, h: 40 },
    shopBtn: { x: det.x + 20, y: btnY, w: det.w - 40, h: 40 },
  };
}

// ---------- clics ----------
export function modClickAt(x, y) {
  if (!G.inv) return null;
  const L = layout();
  const b = menuButtons().back;
  if (inR(b, x, y)) { G.menuView = 'main'; G.modViewT = 0; return 'back'; }
  if (!modulesUnlocked()) return 'locked';
  const eq = modState(G.inv).eq;
  const ms = modState(G.inv);
  // pods d'équipement
  for (const s of L.slots) {
    if (inR(s, x, y)) {
      const id = eq[s.key];
      if (id) { eq[s.key] = null; saveInv(G.inv); G.modFx = G.time; sfxClick(); return 'unequip'; }
      const sel = G.modSel && MODULES[G.modSel];
      if (sel && ms.owned.includes(G.modSel)) {
        const want = s.key === 'act' ? 'actif' : 'passif';
        if (sel.type !== want) {
          G.modMsg = { msg: sel.type === 'actif' ? 'MODULE ACTIF — slot ACTIF requis' : 'MODULE PASSIF — slot PASSIF requis', t: G.time, bad: true };
          sfxClick(); return 'deny';
        }
        if (s.key === 'pass' && !ms.passUnlocked) {
          const r = unlockPassSlot(G.inv);
          G.modMsg = { msg: r.msg, t: G.time, bad: !r.ok };
          if (r.ok) { eq.pass = G.modSel; saveInv(G.inv); G.modFx = G.time; sfxEquip(); }
          else sfxClick();
          return r.ok ? 'unlock' : 'deny';
        }
        eq[s.key] = G.modSel; saveInv(G.inv); G.modFx = G.time; sfxEquip();
        return 'equip';
      }
      if (s.key === 'pass' && !ms.passUnlocked) {
        const r = unlockPassSlot(G.inv);
        G.modMsg = { msg: r.msg, t: G.time, bad: !r.ok };
        if (r.ok) { G.modFx = G.time; sfxEquip(); } else sfxClick();
        return r.ok ? 'unlock' : 'deny';
      }
      return 'slot';
    }
  }
  // bouton boutique du panneau détail (module non possédé)
  if (G.modSel && !ms.owned.includes(G.modSel) && inR(L.shopBtn, x, y)) {
    G.shopOpen = true; sfxConfirm(); return 'shop';
  }
  // bouton équiper du panneau détail
  if (G.modSel && ms.owned.includes(G.modSel) && inR(L.equipBtn, x, y)) {
    const m = MODULES[G.modSel];
    const target = m.type === 'actif' ? 'act' : 'pass';
    if (target === 'pass' && !ms.passUnlocked) {
      const r = unlockPassSlot(G.inv);
      G.modMsg = { msg: r.msg, t: G.time, bad: !r.ok };
      if (r.ok) { eq.pass = G.modSel; saveInv(G.inv); G.modFx = G.time; sfxEquip(); }
      else sfxClick();
      return r.ok ? 'unlock' : 'deny';
    }
    eq[target] = G.modSel;
    saveInv(G.inv); G.modFx = G.time; sfxEquip();
    return 'equip';
  }
  // cartes : sélection (possédés ET verrouillés — la fiche montre le prix)
  for (const c of L.cards) {
    if (inR(c, x, y)) { G.modSel = G.modSel === c.id ? null : c.id; sfxClick(); return 'sel'; }
  }
  return 'inside';
}

// ---------- décor de fond technologique ----------
function drawTechBG(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04060e'); g.addColorStop(0.55, '#070b18'); g.addColorStop(1, '#04060e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // grille perspective animée
  ctx.save();
  ctx.strokeStyle = 'rgba(24,255,255,0.05)'; ctx.lineWidth = 1;
  const off = (t * 18) % 40;
  for (let y = 90 + off; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 90); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.restore();
  // particules dérivantes
  ctx.save();
  for (let i = 0; i < 42; i++) {
    const px = (i * 197 + Math.sin(t * 0.4 + i) * 30 + W * 3) % W;
    const py = (i * 131 + t * (6 + (i % 5) * 3)) % H;
    const a = 0.10 + 0.10 * Math.sin(t * 2 + i * 1.7);
    ctx.fillStyle = i % 3 ? `rgba(24,255,255,${a})` : `rgba(179,136,255,${a})`;
    ctx.beginPath(); ctx.arc(px, py, 1 + (i % 3) * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // balayage lumineux vertical
  const sx = (t * 90) % (W + 300) - 150;
  const sg = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0);
  sg.addColorStop(0, 'rgba(24,255,255,0)'); sg.addColorStop(0.5, 'rgba(24,255,255,0.045)'); sg.addColorStop(1, 'rgba(24,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  // lignes de circuit décoratives dans les coins
  ctx.strokeStyle = 'rgba(24,255,255,0.10)'; ctx.lineWidth = 1;
  const deco = (x, y, dx, dy) => {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 60, y); ctx.lineTo(x + dx * 60, y + dy * 26); ctx.stroke();
    ctx.fillStyle = 'rgba(24,255,255,0.35)';
    ctx.beginPath(); ctx.arc(x + dx * 60, y + dy * 26, 2, 0, TAU); ctx.fill();
  };
  deco(0, 0, 1, 1); deco(W, 0, -1, 1); deco(0, H, 1, -1); deco(W, H, -1, -1);
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- en-tête ----------
function drawHeader(t) {
  ctx.textAlign = 'center';
  ctx.save();
  ctx.font = `600 11px ${UI}`; ctx.letterSpacing = '4px';
  ctx.fillStyle = CYAN;
  ctx.fillText('SYSTÈME DE PERSONNALISATION DU HÉROS', W / 2, 44);
  ctx.restore();
  ctx.font = `700 34px ${SERIF}`; ctx.letterSpacing = '6px';
  const tg = ctx.createLinearGradient(W / 2 - 160, 0, W / 2 + 160, 0);
  tg.addColorStop(0, CYAN); tg.addColorStop(0.5, '#eafcff'); tg.addColorStop(1, VIOLET);
  ctx.fillStyle = tg;
  ctx.fillText('MODULES', W / 2, 76);
  ctx.letterSpacing = '0px';
  // filet animé sous le titre
  const lw = 340, lx = W / 2 - lw / 2;
  ctx.strokeStyle = 'rgba(24,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, 86); ctx.lineTo(lx + lw, 86); ctx.stroke();
  const px = lx + ((t * 140) % (lw + 80)) - 40;
  const pg = ctx.createLinearGradient(px - 40, 0, px + 40, 0);
  pg.addColorStop(0, 'rgba(24,255,255,0)'); pg.addColorStop(0.5, 'rgba(160,250,255,0.9)'); pg.addColorStop(1, 'rgba(24,255,255,0)');
  ctx.strokeStyle = pg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(Math.max(lx, px - 40), 86); ctx.lineTo(Math.min(lx + lw, px + 40), 86); ctx.stroke();
}

// ---------- pods d'équipement ----------
function drawSlot(s, id, locked, t) {
  const ms = modState(G.inv);
  const isLocked = s.key === 'pass' && !ms.passUnlocked;
  const m = id ? MODULES[id] : null;
  const hov = !isLocked && inR(s, G.mouse.x, G.mouse.y);
  const fxAge = G.modFx !== undefined ? t - G.modFx : 99;
  const fxK = fxAge < 0.7 ? 1 - fxAge / 0.7 : 0;
  ctx.save();
  // halo
  if (m) {
    const hg = ctx.createRadialGradient(s.x + s.w / 2, s.y + s.h / 2, 8, s.x + s.w / 2, s.y + s.h / 2, s.w * 0.75);
    hg.addColorStop(0, hexA(m.col, 0.20 + fxK * 0.3)); hg.addColorStop(1, hexA(m.col, 0));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(s.x + s.w / 2, s.y + s.h / 2, s.w * 0.75, 0, TAU); ctx.fill();
  }
  // corps du pod
  ctx.fillStyle = hov ? 'rgba(16,26,48,0.85)' : 'rgba(8,14,28,0.75)';
  roundRect(s.x, s.y, s.w, s.h, 14); ctx.fill();
  const bg = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
  bg.addColorStop(0, 'rgba(255,255,255,0.07)'); bg.addColorStop(0.4, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = bg; roundRect(s.x, s.y, s.w, s.h, 14); ctx.fill();
  // anneau rotatif
  ctx.save();
  ctx.translate(s.x + s.w - 26, s.y + 26);
  ctx.rotate(t * (m ? 0.9 : 0.35));
  ctx.strokeStyle = m ? hexA(m.col, 0.75) : 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2; ctx.setLineDash([7, 9]);
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = m ? m.col : 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
  ctx.restore();
  // label + hint
  ctx.textAlign = 'left'; ctx.font = `600 10px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = CYAN;
  ctx.fillText(s.label, s.x + 16, s.y + 20);
  ctx.letterSpacing = '0px';
  if (s.hint) { ctx.fillStyle = 'rgba(255,215,64,0.75)'; ctx.font = `700 9px ${UI}`; ctx.fillText(`[${s.hint}]`, s.x + s.w - 52, s.y + 20); }
  if (m) {
    // icône flottante
    const bob = Math.sin(t * 2.2 + s.x * 0.01) * 3;
    ctx.save();
    ctx.shadowColor = m.col; ctx.shadowBlur = 14;
    ctx.font = '30px serif'; ctx.textAlign = 'center';
    ctx.fillText(m.icon, s.x + 34, s.y + s.h / 2 + 8 + bob);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.font = `700 13.5px ${UI}`; ctx.fillStyle = C_TEXT;
    ctx.fillText(m.name, s.x + 58, s.y + s.h / 2 - 8);
    ctx.font = `10px ${UI}`; ctx.fillStyle = m.col;
    ctx.fillText(`${m.type.toUpperCase()} · ${m.rar.toUpperCase()}`, s.x + 58, s.y + s.h / 2 + 10);
    ctx.font = `9px ${UI}`; ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('cliquez pour retirer', s.x + 58, s.y + s.h / 2 + 26);
  } else if (isLocked) {
    ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd740';
    ctx.fillText('🔒', s.x + s.w / 2 - 30, s.y + s.h / 2 + 4);
    ctx.textAlign = 'left'; ctx.font = `700 12px ${UI}`; ctx.fillStyle = '#ffd740';
    ctx.fillText(`DÉBLOQUER · ${PASS_SLOT_PRICE} ◆`, s.x + s.w / 2 - 8, s.y + s.h / 2 - 4);
    ctx.font = `9.5px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText('slot passif verrouillé — cliquez pour acheter', s.x + 16, s.y + s.h - 12);
  } else {
    ctx.font = '24px serif'; ctx.textAlign = 'center';
    ctx.fillStyle = hov ? 'rgba(24,255,255,0.5)' : 'rgba(255,255,255,0.14)';
    ctx.fillText('◇', s.x + s.w / 2, s.y + s.h / 2 - 6);
    ctx.font = `10px ${UI}`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillText('slot vide — sélectionnez un module', s.x + s.w / 2, s.y + s.h - 14);
  }
  // onde d'installation
  if (fxK > 0) {
    ctx.strokeStyle = m ? hexA(m.col, fxK * 0.9) : `rgba(24,255,255,${fxK * 0.8})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(s.x + s.w / 2, s.y + s.h / 2, 20 + (1 - fxK) * 70, 0, TAU); ctx.stroke();
  }
  // bordure
  ctx.strokeStyle = m ? hexA(m.col, hov ? 0.95 : 0.55) : isLocked ? 'rgba(255,215,64,0.35)' : hov ? 'rgba(24,255,255,0.5)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = m || hov ? 1.8 : 1.2;
  roundRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1, 14); ctx.stroke();
  ctx.restore();
}

// ---------- carte holographique ----------
function drawCard(c, t) {
  const id = c.id, m = MODULES[id];
  const owned = modState(G.inv).owned.includes(id);
  const sel = G.modSel === id;
  const eq = modState(G.inv).eq;
  const equipped = eq.act === id || eq.pass === id;
  const hov = inR(c, G.mouse.x, G.mouse.y);
  const rc = RAR_COL[m.rar] || '#90a4ae';
  const enter = Math.max(0, Math.min(1, (t - (G.modViewT || 0)) / 0.6 - c.i * 0.045));
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate(0, (1 - enter) * 16);
  // halo rareté
  const hg = ctx.createRadialGradient(c.x + c.w / 2, c.y + c.h * 0.45, 6, c.x + c.w / 2, c.y + c.h * 0.45, c.w * 0.7);
  hg.addColorStop(0, owned ? hexA(rc, sel ? 0.20 : 0.10) : 'rgba(255,255,255,0.02)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(c.x + c.w / 2, c.y + c.h * 0.45, c.w * 0.7, 0, TAU); ctx.fill();
  // corps
  ctx.fillStyle = owned ? (sel ? hexA(rc, 0.10) : hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.035)') : 'rgba(255,255,255,0.015)';
  roundRect(c.x, c.y, c.w, c.h, 12); ctx.fill();
  // liseré haut coloré par rareté
  const lg = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y);
  lg.addColorStop(0, hexA(rc, owned ? 0.8 : 0.25)); lg.addColorStop(0.5, hexA(rc, owned ? 0.15 : 0.05)); lg.addColorStop(1, hexA(rc, 0));
  ctx.fillStyle = lg; roundRect(c.x, c.y, c.w, 3, 2); ctx.fill();
  // icône : anneau rotatif + flottement
  const ix = c.x + c.w / 2, iy = c.y + c.h * 0.38;
  ctx.save();
  ctx.translate(ix, iy);
  ctx.rotate(t * 0.5 + c.i);
  ctx.strokeStyle = owned ? hexA(rc, hov || sel ? 0.9 : 0.45) : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.4; ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  const bob = Math.sin(t * 2 + c.i * 1.3) * 2.5;
  ctx.save();
  if (owned) { ctx.shadowColor = m.col; ctx.shadowBlur = sel ? 20 : hov ? 14 : 7; }
  ctx.globalAlpha = enter * (owned ? 1 : 0.45);
  ctx.font = '30px serif'; ctx.textAlign = 'center';
  ctx.fillText(m.icon, ix, iy + bob + 1);
  ctx.restore();
  // étincelle orbitale sur la carte sélectionnée
  if (sel && owned) {
    const a = t * 2.4;
    ctx.fillStyle = rc;
    ctx.beginPath(); ctx.arc(ix + Math.cos(a) * 26, iy + Math.sin(a) * 26, 2, 0, TAU); ctx.fill();
  }
  // nom + type/rareté
  ctx.textAlign = 'center';
  ctx.font = `600 11px ${UI}`; ctx.fillStyle = owned ? C_TEXT : 'rgba(255,255,255,0.35)';
  ctx.fillText(m.name, ix, c.y + c.h - 34, c.w - 12);
  ctx.font = `8.5px ${UI}`; ctx.fillStyle = owned ? rc : 'rgba(255,255,255,0.25)';
  ctx.fillText(`${m.rar.toUpperCase()} · ${m.type === 'actif' ? 'ACTIF' : 'PASSIF'}`, ix, c.y + c.h - 20);
  // badge bas : équipé / touche X / prix
  if (equipped) {
    ctx.fillStyle = m.col; ctx.font = `700 9px ${UI}`;
    ctx.fillText('◈ INSTALLÉ', ix, c.y + c.h - 7);
  } else if (!owned) {
    ctx.fillStyle = '#ffd740'; ctx.font = `700 9.5px ${UI}`;
    ctx.fillText(`🔒 ${m.price} ◆`, ix, c.y + c.h - 7);
  } else if (m.type === 'actif') {
    ctx.fillStyle = 'rgba(255,215,64,0.6)'; ctx.font = `700 8.5px ${UI}`;
    ctx.fillText('[X] actif', ix, c.y + c.h - 7);
  }
  // balayage électrique au survol
  if (hov && owned) {
    ctx.save();
    ctx.strokeStyle = hexA(rc, 0.5); ctx.lineWidth = 1;
    for (let j = 0; j < 3; j++) {
      const ex = c.x + ((t * 300 + j * 97 + c.i * 53) % c.w);
      const ey = c.y + ((t * 200 + j * 71) % c.h);
      ctx.beginPath(); ctx.moveTo(ex - 5, ey); ctx.lineTo(ex + 5, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey - 5); ctx.lineTo(ex, ey + 5); ctx.stroke();
    }
    ctx.restore();
  }
  // bordure
  ctx.strokeStyle = equipped ? m.col : sel ? hexA(rc, 0.95) : hov && owned ? hexA(rc, 0.55) : owned ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)';
  ctx.lineWidth = equipped || sel ? 2 : 1.2;
  roundRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, 12); ctx.stroke();
  ctx.restore();
}

// ---------- panneau détail ----------
function drawDetail(L, id, t) {
  const m = MODULES[id], d = L.det;
  const owned = modState(G.inv).owned.includes(id);
  const ms = modState(G.inv);
  const eq = ms.eq;
  const equipped = eq.act === id || eq.pass === id;
  const rc = RAR_COL[m.rar] || '#90a4ae';
  const enter = Math.max(0, Math.min(1, (t - (G.modViewT || 0)) / 0.6 - 0.15));
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate((1 - enter) * 24, 0);
  // panneau verre
  ctx.fillStyle = 'rgba(8,14,28,0.82)';
  roundRect(d.x, d.y, d.w, d.h, 14); ctx.fill();
  const pg = ctx.createLinearGradient(d.x, d.y, d.x + d.w, d.y + d.h);
  pg.addColorStop(0, hexA(CYAN, 0.14)); pg.addColorStop(0.5, hexA(VIOLET, 0.07)); pg.addColorStop(1, hexA(CYAN, 0.05));
  ctx.fillStyle = pg; roundRect(d.x, d.y, d.w, d.h, 14); ctx.fill();
  // coins tech
  ctx.strokeStyle = hexA(m.col, 0.8); ctx.lineWidth = 1.6;
  const cl = 14;
  [[d.x, d.y, 1, 1], [d.x + d.w, d.y, -1, 1], [d.x, d.y + d.h, 1, -1], [d.x + d.w, d.y + d.h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(cx + sx * cl, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * cl); ctx.stroke();
  });
  const ix = d.x + d.w / 2;
  // grande icône : hexagone tournant + orbite
  const iy = d.y + 78;
  ctx.save();
  ctx.translate(ix, iy);
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = hexA(m.col, owned ? 0.7 : 0.2); ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6; const px = Math.cos(a) * 46, py = Math.sin(a) * 46; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
  const bob = Math.sin(t * 2.2) * 4;
  ctx.save();
  ctx.shadowColor = m.col; ctx.shadowBlur = owned ? 26 : 6;
  ctx.font = '46px serif'; ctx.textAlign = 'center';
  ctx.globalAlpha = enter * (owned ? 1 : 0.4);
  ctx.fillText(m.icon, ix, iy + bob);
  ctx.restore();
  // nom + chips
  ctx.globalAlpha = enter;
  ctx.font = `700 18px ${UI}`; ctx.fillStyle = owned ? C_TEXT : 'rgba(255,255,255,0.4)';
  ctx.fillText(m.name, ix, d.y + 152);
  ctx.font = `600 9.5px ${UI}`; ctx.letterSpacing = '1.5px';
  ctx.fillStyle = rc; ctx.fillText(m.rar.toUpperCase(), ix - 60, d.y + 172);
  ctx.fillStyle = m.col; ctx.fillText(m.type === 'actif' ? 'MODULE ACTIF' : 'MODULE PASSIF', ix + 60, d.y + 172);
  ctx.letterSpacing = '0px';
  if (m.type === 'actif' && m.cd) {
    ctx.fillStyle = 'rgba(255,215,64,0.8)'; ctx.font = `700 10px ${UI}`;
    ctx.fillText(`[X] recharge ${m.cd} s`, ix, d.y + 190);
  }
  // description
  ctx.font = `12px ${UI}`; ctx.fillStyle = owned ? '#b5af9f' : 'rgba(255,255,255,0.3)';
  const words = m.desc.split(' '); const lines = []; let cur = '';
  for (const w of words) { const tx = cur ? cur + ' ' + w : w; if (ctx.measureText(tx).width > d.w - 48) { lines.push(cur); cur = w; } else cur = tx; }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => ctx.fillText(l, ix, d.y + 216 + i * 17));
  // statistiques
  const sy = d.y + d.h - 108;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(d.x + 24, sy - 14); ctx.lineTo(d.x + d.w - 24, sy - 14); ctx.stroke();
  ctx.font = `600 9.5px ${UI}`; ctx.letterSpacing = '2px'; ctx.fillStyle = CYAN;
  ctx.fillText('STATISTIQUES', ix, sy + 2); ctx.letterSpacing = '0px';
  ctx.font = `11px ${UI}`; ctx.fillStyle = owned ? C_MUTED : 'rgba(255,255,255,0.28)';
  statLines(m).forEach((l, i) => ctx.fillText(l, ix, sy + 20 + i * 15));
  // bouton bas : équiper / équipé / acheter à la boutique
  const b = equipped ? L.equipBtn : (owned ? L.equipBtn : L.shopBtn);
  const hov = inR(b, G.mouse.x, G.mouse.y);
  if (equipped) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.strokeStyle = m.col; ctx.lineWidth = 1.5; roundRect(b.x, b.y, b.w, b.h, 10); ctx.stroke();
    ctx.fillStyle = m.col; ctx.font = `700 12.5px ${UI}`;
    ctx.fillText('◈ INSTALLÉ — cliquez un slot pour changer', ix, b.y + b.h / 2 + 4);
  } else if (!owned) {
    ctx.fillStyle = hov ? 'rgba(255,215,64,0.9)' : 'rgba(255,215,64,0.55)';
    roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.fillStyle = '#16130c'; ctx.font = `700 12.5px ${UI}`;
    ctx.fillText(`🛒 ACHETER À LA BOUTIQUE — ${m.price} ◆`, ix, b.y + b.h / 2 + 4);
  } else {
    const passLocked = m.type === 'passif' && !ms.passUnlocked;
    ctx.fillStyle = passLocked ? (hov ? 'rgba(255,215,64,0.9)' : 'rgba(255,215,64,0.55)') : hov ? hexA(m.col, 0.95) : hexA(m.col, 0.5);
    roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.fillStyle = passLocked ? '#16130c' : '#06101e'; ctx.font = `700 12.5px ${UI}`;
    ctx.fillText(passLocked ? `🔒 DÉBLOQUER LE SLOT PASSIF — ${PASS_SLOT_PRICE} ◆` : (m.type === 'actif' ? '⚡ INSTALLER COMME MODULE ACTIF [X]' : '⬡ INSTALLER COMME MODULE PASSIF'), ix, b.y + b.h / 2 + 4);
  }
  ctx.restore();
}

function drawEmptyDetail(L, t) {
  const d = L.det;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, (t - (G.modViewT || 0)) / 0.6 - 0.15));
  ctx.fillStyle = 'rgba(8,14,28,0.6)';
  roundRect(d.x, d.y, d.w, d.h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(d.x, d.y, d.w, d.h, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '30px serif'; ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillText('◇', d.x + d.w / 2, d.y + d.h / 2 - 10);
  ctx.font = `12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Sélectionnez un module pour', d.x + d.w / 2, d.y + d.h / 2 + 18);
  ctx.fillText('examiner ses statistiques.', d.x + d.w / 2, d.y + d.h / 2 + 36);
  ctx.restore();
}

// ---------- résumé des bonus équipés ----------
function drawSummary(t) {
  const ms = G.inv ? modState(G.inv) : null;
  const eqIds = ms ? [ms.eq.act, ms.eq.pass].filter(Boolean) : [];
  const y = H - 20;
  ctx.textAlign = 'left';
  ctx.font = `600 10px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = CYAN;
  ctx.fillText('INSTALLEZ', 34, y);
  ctx.letterSpacing = '0px';
  if (!eqIds.length) {
    ctx.font = `11px ${UI}`; ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('— aucun module installé —', 110, y);
    return;
  }
  let x = 110;
  eqIds.forEach((id, i) => {
    const m = MODULES[id]; if (!m) return;
    const label = `${m.icon} ${m.name}${m.type === 'actif' ? ' [X]' : ''}`;
    ctx.font = `600 11px ${UI}`;
    const wTxt = ctx.measureText(label).width + 22;
    ctx.fillStyle = hexA(m.col, 0.12);
    roundRect(x, y - 13, wTxt, 20, 10); ctx.fill();
    ctx.strokeStyle = hexA(m.col, 0.5); ctx.lineWidth = 1;
    roundRect(x + 0.5, y - 12.5, wTxt - 1, 19, 10); ctx.stroke();
    ctx.fillStyle = m.col; ctx.fillText(label, x + 11, y + 1);
    x += wTxt + 10;
  });
}

// ---------- écran verrouillé ----------
function drawLocked(t) {
  drawTechBG(t);
  drawHeader(t);
  const cw = 620, ch = 330, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2 + 20;
  ctx.fillStyle = 'rgba(8,14,28,0.9)';
  roundRect(cx, cy, cw, ch, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(24,255,255,0.3)'; ctx.lineWidth = 1.5;
  roundRect(cx, cy, cw, ch, 16); ctx.stroke();
  const lx = cx + cw / 2, ly = cy + 100;
  ctx.save();
  ctx.translate(lx, ly); ctx.rotate(t * 0.6);
  ctx.strokeStyle = 'rgba(255,215,64,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
  ctx.font = '52px serif'; ctx.textAlign = 'center';
  ctx.fillText('🔒', lx, ly + 18);
  ctx.font = `700 24px ${SERIF}`; ctx.fillStyle = C_TEXT; ctx.letterSpacing = '2px';
  ctx.fillText('MODULES VERROUILLÉS', lx, cy + 190);
  ctx.letterSpacing = '0px'; ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Vainquez le boss final du monde 4 (Les Égouts)', lx, cy + 224);
  ctx.fillText('pour débloquer le système et recevoir vos 2 premiers modules.', lx, cy + 246);
  drawMenuButton(menuButtons().back, '← RETOUR', '#455a64', '#90a4ae', false);
}

// ---------- message flash ----------
function drawMsg(t) {
  if (!G.modMsg || t - G.modMsg.t > 2.5) return;
  const a = Math.min(1, 2.5 - (t - G.modMsg.t));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `700 13px ${UI}`; ctx.textAlign = 'center';
  const msg = G.modMsg.msg;
  const wTxt = ctx.measureText(msg).width + 36;
  ctx.fillStyle = 'rgba(8,14,28,0.9)';
  roundRect(W / 2 - wTxt / 2, 168, wTxt, 30, 15); ctx.fill();
  ctx.strokeStyle = G.modMsg.bad ? 'rgba(255,120,110,0.6)' : 'rgba(24,255,255,0.6)';
  ctx.lineWidth = 1.2; roundRect(W / 2 - wTxt / 2 + 0.5, 168.5, wTxt - 1, 29, 15); ctx.stroke();
  ctx.fillStyle = G.modMsg.bad ? '#ff8a80' : '#69f0ae';
  ctx.fillText(msg, W / 2, 188);
  ctx.restore();
}

// ---------- statistiques par module ----------
function statLines(m) {
  switch (m.name) {
    case 'Bouclier énergétique': return ['Bouclier : 70 PV', 'Régénération : 3 PV/s (après 4 s)'];
    case 'Ruée dimensionnelle': return ['Distance : ~560 px', 'Durée : 0,3 s', 'Recharge : 8 s'];
    case 'Surcharge': return ['Dégâts : +50 %', 'Durée : 6 s', 'Recharge : 14 s'];
    case 'Régénération': return ['Régénération : +4 PV/s'];
    case 'Onde de choc': return ['Rayon : 230 px', 'Dégâts : 50 + 4×niv', 'Recharge : 15 s'];
    case 'Instinct du chasseur': return ['Chance critique : +12 %', 'Critique : ×1,75'];
    case 'Distorsion temporelle': return ['Portée : 270 px', 'Ralentissement : 45 % / 4 s', 'Recharge : 18 s'];
    case 'Absorption': return ['Soins : 8 % des dégâts infligés'];
    case 'Frappe orbitale': return ['Cible : ennemi le plus proche', 'Dégâts : 130 + 8×niv', 'Recharge : 12 s'];
    case 'Résistance': return ['Dégâts subis : −12 %'];
    case 'Impulsion': return ['Vitesse : +60 %', 'Durée : 4 s', 'Recharge : 14 s'];
    case 'Dernier rempart': return ['Déclencheur : PV < 30 %', 'Bouclier : 60 PV / 6 s', 'Recharge : 30 s'];
    default: return [m.desc];
  }
}

// ---------- vue principale ----------
export function drawModulesView() {
  const inv = G.inv;
  const t = G.time || 0;
  ctx.textAlign = 'center';
  if (inv) {
    ensureModules(); // débloque + offre bouclier/ruée si boss du monde 4 vaincu
    modState(inv);
  }
  if (!modulesUnlocked()) { drawLocked(t); return; }
  const L = layout();
  drawTechBG(t);
  drawHeader(t);
  // pods
  const eq = modState(inv).eq;
  const ms = modState(inv);
  for (const s of L.slots) drawSlot(s, eq[s.key], s.key === 'pass' && !ms.passUnlocked, t);
  // grille
  ctx.textAlign = 'left'; ctx.font = `600 10px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = CYAN;
  ctx.fillText(`MODULES · ${ms.owned.length}/${MOD_IDS.length} DÉBLOQUÉS`, 34, 190);
  ctx.letterSpacing = '0px';
  for (const c of L.cards) drawCard(c, t);
  // détail
  if (G.modSel && MODULES[G.modSel]) drawDetail(L, G.modSel, t);
  else drawEmptyDetail(L, t);
  drawSummary(t);
  drawMsg(t);
  drawMenuButton(menuButtons().back, '← RETOUR', '#1d4e5f', '#7de8ff', false);
  ctx.textAlign = 'center';
}
