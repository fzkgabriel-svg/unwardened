// js/menu/modules.js — interface MODULES : reliquaire médiéval fantasy
// Scène grimoire : fond cuir/parchemin, poussières d'or, médaillons de reliques,
// cartes parchemin par rareté, panneau de détail, boutique intégrée.
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, hexA } from '../utils.js';
import { MODULES, MOD_IDS, modState, modulesUnlocked, ensureModules, unlockPassSlot, PASS_SLOT_PRICE, modLevel, modUpgradeCost, upgradeModule, pass2Unlocked, drawModuleIcon } from '../modules.js';
import { saveInv } from '../inventory.js';
import { inR, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, menuButtons, drawMenuButton } from './common.js';
import { sfxClick, sfxEquip, sfxConfirm } from '../audio.js';

// raretés à l'ancienne : bronze & cuir / argent bleuté / violet enchanté / or ancien
const RAR_COL = { 'Commun': '#c0a878', 'Rare': '#a9c6e2', 'Épique': '#b388ff', 'Légendaire': '#ffd54f' };
const RAR_GLOW = { 'Commun': 'rgba(192,168,120,0.4)', 'Rare': 'rgba(169,198,226,0.45)', 'Épique': 'rgba(179,136,255,0.5)', 'Légendaire': 'rgba(255,213,79,0.55)' };
const GOLD = '#d8b45a', GOLD_HI = '#f4dc9a', INK = '#0d0a06';

// ---------- layout ----------
function layout() {
  const t = G.time || 0;
  // pods d'équipement (haut, centrés) — 1 actif + 2 passifs
  const sw = Math.min(290, W * 0.23), sh = 92, gap = 26;
  const sx = W / 2 - (sw * 3 + gap * 2) / 2, sy = 88;
  const slots = [
    { key: 'act', label: 'MODULE ACTIF', hint: 'Touche X', x: sx, y: sy, w: sw, h: sh },
    { key: 'pass', label: 'PASSIF 1', hint: '', x: sx + sw + gap, y: sy, w: sw, h: sh },
    { key: 'pass2', label: 'PASSIF 2', hint: '', x: sx + (sw + gap) * 2, y: sy, w: sw, h: sh },
  ];
  // panneau détail (droite) — plus haut pour accueillir description + stats + 2 boutons
  const dw = Math.min(360, W * 0.3), dy = 190, dh = 400;
  const det = { x: W - dw - 34, y: dy, w: dw, h: dh };
  // grille des modules (gauche), tous les modules : possédés + verrouillés
  // DÉFILANTE : 4 colonnes, hauteur fixe par carte, scroll vertical à la molette
  const gx = 34, gy = 192, gw = det.x - gx - 18, gh = 400;
  const cols = 4, cw = (gw - (cols - 1) * 12) / cols, ch = 138;
  const ownedSet = G.inv ? modState(G.inv).owned : [];
  const ids = [...MOD_IDS].sort((a, b) => (ownedSet.includes(b) ? 1 : 0) - (ownedSet.includes(a) ? 1 : 0));
  const rows = Math.ceil(ids.length / cols);
  const contentH = rows * (ch + 12);
  const scrollMax = Math.max(0, contentH - gh);
  const sc = Math.max(0, Math.min(scrollMax, G.modScroll || 0));
  G.modScroll = sc;
  const cards = ids.map((id, i) => ({
    id, x: gx + (i % cols) * (cw + 12), y: gy + Math.floor(i / cols) * (ch + 12) - sc, w: cw, h: ch, i,
  }));
  const btnY = det.y + det.h - 50;
  // bas du panneau : [équiper/installé] à gauche + [améliorer] à droite
  const bw = det.w - 40, uw = Math.min(150, bw * 0.44);
  const ew = bw - uw - 12;
  return {
    slots, cards, det, grid: { x: gx, y: gy - 4, w: gw, h: gh + 8 }, scrollMax,
    equipBtn: { x: det.x + 20, y: btnY, w: ew, h: 40 },
    upBtn: { x: det.x + 20 + ew + 12, y: btnY, w: uw, h: 40 },
    shopBtn: { x: det.x + 20, y: btnY, w: det.w - 40, h: 40 },
  };
}

// molette : scroll de la grille des modules
export function modWheel(dy) {
  G.modScroll = Math.max(0, Math.min((layout().scrollMax || 0), (G.modScroll || 0) + dy * 0.5));
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
      // pass2 verrouillé : le clic affiche la condition de déblocage
      if (s.key === 'pass2' && !pass2Unlocked(G.inv)) {
        G.modMsg = { msg: '🔒 Vainquez le SOUVERAIN DES OURAGANS (campagne 6) pour débloquer ce slot', t: G.time, bad: true };
        sfxClick(); return 'deny';
      }
      const id = eq[s.key];
      if (id) { eq[s.key] = null; saveInv(G.inv); G.modFx = G.time; sfxClick(); return 'unequip'; }
      const sel = G.modSel && MODULES[G.modSel];
      if (sel && ms.owned.includes(G.modSel)) {
        const want = s.key === 'act' ? 'actif' : 'passif';
        if (sel.type !== want) {
          G.modMsg = { msg: sel.type === 'actif' ? 'MODULE ACTIF — slot ACTIF requis' : 'MODULE PASSIF — slot PASSIF requis', t: G.time, bad: true };
          sfxClick(); return 'deny';
        }
        // un module passif ne peut pas occuper deux slots
        if (s.key !== 'act' && (eq.pass === G.modSel || eq.pass2 === G.modSel)) {
          G.modMsg = { msg: 'Ce module est déjà installé dans un autre slot passif', t: G.time, bad: true };
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
  // bouton amélioration (module possédé, niveau < 3)
  if (G.modSel && ms.owned.includes(G.modSel) && inR(L.upBtn, x, y)) {
    const r = upgradeModule(G.modSel);
    G.modMsg = { msg: r.msg, t: G.time, bad: !r.ok };
    if (r.ok) { G.modFx = G.time; sfxEquip(); } else sfxClick();
    return r.ok ? 'upgrade' : 'deny';
  }
  // bouton équiper du panneau détail
  if (G.modSel && ms.owned.includes(G.modSel) && inR(L.equipBtn, x, y)) {
    const m = MODULES[G.modSel];
    let target = m.type === 'actif' ? 'act' : null;
    if (m.type === 'passif') {
      // premier slot passif libre ; sinon le 2ᵉ si débloqué ; sinon message
      if (eq.pass == null && ms.passUnlocked) target = 'pass';
      else if (eq.pass2 == null && pass2Unlocked(G.inv)) target = 'pass2';
      else if (eq.pass == null) target = 'pass'; // slot 1 verrouillé -> tente l'achat
      else { G.modMsg = { msg: 'Les 2 slots passifs sont occupés — retirez-en un', t: G.time, bad: true }; sfxClick(); return 'deny'; }
    }
    if (target === 'pass' && !ms.passUnlocked) {
      const r = unlockPassSlot(G.inv);
      G.modMsg = { msg: r.msg, t: G.time, bad: !r.ok };
      if (r.ok) { eq.pass = G.modSel; saveInv(G.inv); G.modFx = G.time; sfxEquip(); }
      else sfxClick();
      return r.ok ? 'unlock' : 'deny';
    }
    if ((eq.pass === G.modSel || eq.pass2 === G.modSel)) {
      G.modMsg = { msg: 'Ce module est déjà installé dans un slot passif', t: G.time, bad: true };
      sfxClick(); return 'deny';
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

// ---------- décor de fond : reliquaire (cuir, parchemin, poussières d'or) ----------
function drawGrimoireBG(t) {
  // cuir sombre incliné : dégradé chaud profond
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141009'); g.addColorStop(0.5, '#1c150c'); g.addColorStop(1, '#100c07');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // fibres de cuir : fines stries verticales déterministes
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const fx = (i * 137) % W;
    ctx.strokeStyle = `rgba(216,180,90,${0.015 + (i % 5) * 0.006})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(fx, 0); ctx.bezierCurveTo(fx + 14, H * 0.33, fx - 14, H * 0.66, fx + 6, H); ctx.stroke();
  }
  // poussières d'or en suspension (dérive lente)
  for (let i = 0; i < 40; i++) {
    const px = (i * 197 + Math.sin(t * 0.35 + i) * 36 + W * 3) % W;
    const py = (i * 131 + t * (4 + (i % 5) * 2)) % H;
    const a = 0.10 + 0.12 * Math.sin(t * 1.6 + i * 1.9);
    ctx.fillStyle = `rgba(216,180,90,${Math.max(0, a)})`;
    ctx.beginPath(); ctx.arc(px, py, 0.8 + (i % 3) * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // cercle runique watermark derrière le titre (très discret)
  ctx.save();
  ctx.translate(W / 2, 60); ctx.globalAlpha = 0.05;
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 120, 0, TAU); ctx.stroke();
  ctx.setLineDash([6, 10]);
  ctx.beginPath(); ctx.arc(0, 0, 132, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let k = 0; k < 12; k++) {
    const a = k * TAU / 12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 120, Math.sin(a) * 120);
    ctx.lineTo(Math.cos(a) * 128, Math.sin(a) * 128);
    ctx.stroke();
  }
  ctx.restore();
  // lueur chaude centrale derrière les panneaux
  const cg = ctx.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.42, 620);
  cg.addColorStop(0, 'rgba(216,164,74,0.07)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  // vignette chaude
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,5,2,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- en-tête ----------
function drawHeader(t) {
  ctx.textAlign = 'center';
  ctx.save();
  ctx.font = `600 11px ${UI}`; ctx.letterSpacing = '4px';
  ctx.fillStyle = GOLD;
  ctx.fillText('RELIQUES & ARTEFACTS DU HÉROS', W / 2, 44);
  ctx.restore();
  ctx.font = `700 34px ${SERIF}`; ctx.letterSpacing = '6px';
  const tg = ctx.createLinearGradient(W / 2 - 160, 0, W / 2 + 160, 0);
  tg.addColorStop(0, '#8a6d3b'); tg.addColorStop(0.5, GOLD_HI); tg.addColorStop(1, '#8a6d3b');
  ctx.fillStyle = tg;
  ctx.fillText('MODULES', W / 2, 76);
  ctx.letterSpacing = '0px';
  // filet ornemental : ligne — losange — ligne, lueur douce qui respire
  const lw = 340, lx = W / 2 - lw / 2;
  ctx.strokeStyle = 'rgba(216,180,90,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, 86); ctx.lineTo(lx + lw, 86); ctx.stroke();
  ctx.save();
  ctx.translate(W / 2, 86); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = `rgba(244,220,154,${0.55 + 0.25 * Math.sin(t * 2)})`;
  ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
  ctx.restore();
  ctx.fillStyle = 'rgba(216,180,90,0.35)';
  ctx.font = '11px serif'; ctx.textAlign = 'center';
  ctx.fillText('✦', lx + 14, 90); ctx.fillText('✦', lx + lw - 14, 90);
}

// ---------- pods d'équipement ----------
function drawSlot(s, id, locked, t) {
  const ms = modState(G.inv);
  const isLocked = (s.key === 'pass' && !ms.passUnlocked) || (s.key === 'pass2' && !pass2Unlocked(G.inv));
  const m = id ? MODULES[id] : null;
  const hov = !isLocked && inR(s, G.mouse.x, G.mouse.y);
  const fxAge = G.modFx !== undefined ? t - G.modFx : 99;
  const fxK = fxAge < 0.7 ? 1 - fxAge / 0.7 : 0;
  ctx.save();
  // halo chaud de la relique installée
  if (m) {
    const hg = ctx.createRadialGradient(s.x + s.w / 2, s.y + s.h / 2, 8, s.x + s.w / 2, s.y + s.h / 2, s.w * 0.75);
    hg.addColorStop(0, hexA(m.col, 0.16 + fxK * 0.25)); hg.addColorStop(1, hexA(m.col, 0));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(s.x + s.w / 2, s.y + s.h / 2, s.w * 0.75, 0, TAU); ctx.fill();
  }
  // corps : panneau cuir sombre à bordure bronze
  ctx.fillStyle = hov ? 'rgba(38,28,16,0.9)' : 'rgba(24,18,10,0.85)';
  roundRect(s.x, s.y, s.w, s.h, 12); ctx.fill();
  const bg = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
  bg.addColorStop(0, 'rgba(216,180,90,0.10)'); bg.addColorStop(0.4, 'rgba(216,180,90,0.0)');
  ctx.fillStyle = bg; roundRect(s.x, s.y, s.w, s.h, 12); ctx.fill();
  // anneau bronze : arc lent + 4 clous runiques
  ctx.save();
  ctx.translate(s.x + s.w - 26, s.y + 26);
  ctx.rotate(-t * (m ? 0.5 : 0.2));
  ctx.strokeStyle = m ? hexA(GOLD, 0.7) : 'rgba(216,180,90,0.25)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU * 0.72); ctx.stroke();
  ctx.setLineDash([]);
  for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4 + Math.PI / 4;
    ctx.fillStyle = m ? hexA(GOLD, 0.8) : 'rgba(216,180,90,0.3)';
    ctx.beginPath(); ctx.arc(Math.cos(a) * 12, Math.sin(a) * 12, 1.4, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = m ? GOLD : 'rgba(216,180,90,0.35)';
  ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
  // label + hint
  ctx.textAlign = 'left'; ctx.font = `600 10px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = GOLD;
  ctx.fillText(s.label, s.x + 16, s.y + 20);
  ctx.letterSpacing = '0px';
  if (s.hint) { ctx.fillStyle = 'rgba(244,220,154,0.8)'; ctx.font = `700 9px ${UI}`; ctx.fillText(`[${s.hint}]`, s.x + s.w - 52, s.y + 20); }
  if (m) {
    // médaillon de la relique : flotte doucement
    const bob = Math.sin(t * 2.2 + s.x * 0.01) * 2.5;
    ctx.save();
    ctx.shadowColor = m.col; ctx.shadowBlur = 10;
    drawModuleIcon(id, s.x + 34, s.y + s.h / 2 + 6 + bob, 0.82);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.font = `700 13.5px ${UI}`; ctx.fillStyle = C_TEXT;
    ctx.fillText(m.name, s.x + 58, s.y + s.h / 2 - 8);
    ctx.font = `10px ${UI}`; ctx.fillStyle = RAR_COL[m.rar] || m.col;
    ctx.fillText(`${m.rar.toUpperCase()} · ${m.type.toUpperCase()}`, s.x + 58, s.y + s.h / 2 + 10);
    ctx.font = `9px ${UI}`; ctx.fillStyle = 'rgba(230,220,200,0.4)';
    ctx.fillText('cliquez pour retirer', s.x + 58, s.y + s.h / 2 + 26);
  } else if (isLocked) {
    ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd740';
    ctx.fillText('🔒', s.x + s.w / 2 - 30, s.y + s.h / 2 + 4);
    if (s.key === 'pass2') {
      ctx.textAlign = 'left'; ctx.font = `700 10.5px ${UI}`; ctx.fillStyle = '#ffd740';
      ctx.fillText('RÉCOMPENSE SOUVERAIN', s.x + s.w / 2 - 8, s.y + s.h / 2 - 12);
      ctx.font = `8.5px ${UI}`; ctx.fillStyle = C_MUTED;
      ctx.fillText('2ᵉ slot passif — cliquez pour', s.x + 12, s.y + s.h - 22);
      ctx.fillText('voir la condition', s.x + 12, s.y + s.h - 10);
    } else {
      ctx.textAlign = 'left'; ctx.font = `700 12px ${UI}`; ctx.fillStyle = '#ffd740';
      ctx.fillText(`DÉBLOQUER · ${PASS_SLOT_PRICE} ◆`, s.x + s.w / 2 - 8, s.y + s.h / 2 - 4);
      ctx.font = `9.5px ${UI}`; ctx.fillStyle = C_MUTED;
      ctx.fillText('slot passif verrouillé — cliquez pour acheter', s.x + 16, s.y + s.h - 12);
    }
  } else {
    ctx.font = '22px serif'; ctx.textAlign = 'center';
    ctx.fillStyle = hov ? 'rgba(216,180,90,0.5)' : 'rgba(230,220,200,0.15)';
    ctx.fillText('✦', s.x + s.w / 2, s.y + s.h / 2 - 6);
    ctx.font = `10px ${UI}`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,220,200,0.25)';
    ctx.fillText('emplacement vide — choisissez une relique', s.x + s.w / 2, s.y + s.h - 14);
  }
  // onde d'installation : cercle doré qui s'estompe
  if (fxK > 0) {
    ctx.strokeStyle = m ? hexA(m.col, fxK * 0.9) : `rgba(216,180,90,${fxK * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x + s.w / 2, s.y + s.h / 2, 20 + (1 - fxK) * 70, 0, TAU); ctx.stroke();
  }
  // bordure bronze gravée
  ctx.strokeStyle = m ? hexA(GOLD, hov ? 0.95 : 0.55) : isLocked ? 'rgba(255,213,79,0.4)' : hov ? 'rgba(216,180,90,0.5)' : 'rgba(216,180,90,0.15)';
  ctx.lineWidth = m || hov ? 1.8 : 1.2;
  roundRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1, 12); ctx.stroke();
  // clous aux quatre coins
  ctx.fillStyle = 'rgba(216,180,90,0.5)';
  for (const [nx, ny] of [[s.x + 7, s.y + 7], [s.x + s.w - 7, s.y + 7], [s.x + 7, s.y + s.h - 7], [s.x + s.w - 7, s.y + s.h - 7]]) {
    ctx.beginPath(); ctx.arc(nx, ny, 1.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- carte de relique (parchemin gravé par rareté) ----------
function drawCard(c, t) {
  const id = c.id, m = MODULES[id];
  const owned = modState(G.inv).owned.includes(id);
  const sel = G.modSel === id;
  const eq = modState(G.inv).eq;
  const equipped = eq.act === id || eq.pass === id || eq.pass2 === id;
  const hov = inR(c, G.mouse.x, G.mouse.y);
  const rc = RAR_COL[m.rar] || '#c0a878';
  const enter = Math.max(0, Math.min(1, (t - (G.modViewT || 0)) / 0.6 - c.i * 0.045));
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate(0, (1 - enter) * 16);
  // halo de rareté doux
  const hg = ctx.createRadialGradient(c.x + c.w / 2, c.y + c.h * 0.42, 6, c.x + c.w / 2, c.y + c.h * 0.42, c.w * 0.72);
  hg.addColorStop(0, owned ? hexA(rc, sel ? 0.18 : 0.09) : 'rgba(216,180,90,0.03)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(c.x + c.w / 2, c.y + c.h * 0.42, c.w * 0.72, 0, TAU); ctx.fill();
  // corps : parchemin sombre veiné
  const cg = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
  cg.addColorStop(0, owned ? (sel ? 'rgba(46,36,20,0.92)' : hov ? 'rgba(40,31,18,0.92)' : 'rgba(32,25,14,0.9)') : 'rgba(24,19,11,0.85)');
  cg.addColorStop(1, 'rgba(16,12,7,0.92)');
  ctx.fillStyle = cg;
  roundRect(c.x, c.y, c.w, c.h, 10); ctx.fill();
  // liseré supérieur : filigrane doré par rareté
  const lg = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y);
  lg.addColorStop(0, hexA(rc, owned ? 0.75 : 0.2)); lg.addColorStop(0.5, hexA(rc, owned ? 0.12 : 0.04)); lg.addColorStop(1, hexA(rc, 0));
  ctx.fillStyle = lg; roundRect(c.x + 8, c.y, c.w - 16, 2.5, 2); ctx.fill();
  // médaillon de la relique dans un cercle gravé
  const ix = c.x + c.w / 2, iy = c.y + c.h * 0.36;
  ctx.save();
  ctx.strokeStyle = owned ? hexA(rc, hov || sel ? 0.75 : 0.4) : 'rgba(216,180,90,0.15)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(ix, iy, 23, 0, TAU); ctx.stroke();
  ctx.strokeStyle = hexA(rc, owned ? 0.25 : 0.08); ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.arc(ix, iy, 26.5, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  // 4 clous cardinaux
  ctx.fillStyle = hexA(rc, owned ? 0.7 : 0.2);
  for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4 + Math.PI / 4;
    ctx.beginPath(); ctx.arc(ix + Math.cos(a) * 23, iy + Math.sin(a) * 23, 1.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  const bob = Math.sin(t * 2 + c.i * 1.3) * 2;
  ctx.save();
  if (owned) { ctx.shadowColor = m.col; ctx.shadowBlur = sel ? 16 : hov ? 11 : 5; }
  ctx.globalAlpha = enter * (owned ? 1 : 0.5);
  drawModuleIcon(id, ix, iy + bob, 0.95);
  ctx.restore();
  // poussière dorée orbitant la carte sélectionnée
  if (sel && owned) {
    const a = t * 1.8;
    ctx.fillStyle = GOLD_HI;
    ctx.beginPath(); ctx.arc(ix + Math.cos(a) * 27, iy + Math.sin(a) * 27, 1.8, 0, TAU); ctx.fill();
  }
  // nom + type/rareté
  ctx.textAlign = 'center';
  ctx.font = `600 11px ${UI}`; ctx.fillStyle = owned ? C_TEXT : 'rgba(230,220,200,0.35)';
  ctx.fillText(m.name, ix, c.y + c.h - 36, c.w - 12);
  ctx.font = `8.5px ${UI}`; ctx.fillStyle = owned ? rc : 'rgba(230,220,200,0.25)';
  ctx.fillText(`${m.rar.toUpperCase()} · ${m.type === 'actif' ? 'ACTIF' : 'PASSIF'}`, ix, c.y + c.h - 22);
  // niveau du module (possédé) : losanges dorés en haut à droite
  if (owned) {
    const lv = modLevel(id);
    ctx.textAlign = 'right';
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k < lv ? '#ffd54f' : 'rgba(255,255,255,0.14)';
      ctx.save(); ctx.translate(c.x + c.w - 14 - (2 - k) * 10, c.y + 14); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3.2, -3.2, 6.4, 6.4); ctx.restore();
    }
    ctx.textAlign = 'center';
  }
  // badge bas : équipé / touche X / prix
  if (equipped) {
    ctx.fillStyle = GOLD_HI; ctx.font = `700 9px ${UI}`;
    ctx.fillText('❖ INSTALLÉ', ix, c.y + c.h - 8);
  } else if (!owned) {
    ctx.fillStyle = '#ffd54f'; ctx.font = `700 9.5px ${UI}`;
    ctx.fillText(`🔒 ${m.price} ◆`, ix, c.y + c.h - 8);
  } else if (m.type === 'actif') {
    ctx.fillStyle = 'rgba(244,220,154,0.65)'; ctx.font = `700 8.5px ${UI}`;
    ctx.fillText('[X] actif', ix, c.y + c.h - 8);
  }
  // reflet doré doux au survol
  if (hov && owned) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    const hg2 = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y + c.h);
    hg2.addColorStop(0, 'rgba(244,220,154,0)'); hg2.addColorStop(0.5, 'rgba(244,220,154,0.9)'); hg2.addColorStop(1, 'rgba(244,220,154,0)');
    ctx.fillStyle = hg2;
    const sx = c.x + ((t * 90) % (c.w * 2)) - c.w * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 14, c.y); ctx.lineTo(sx + 14, c.y); ctx.lineTo(sx + c.w * 0.4, c.y + c.h); ctx.lineTo(sx - c.w * 0.4 - 28, c.y + c.h);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // bordure : bronze gravée, renforcée si sélectionnée/équipée
  ctx.strokeStyle = equipped ? m.col : sel ? hexA(rc, 0.95) : hov && owned ? hexA(rc, 0.6) : owned ? 'rgba(216,180,90,0.28)' : 'rgba(216,180,90,0.14)';
  ctx.lineWidth = equipped || sel ? 1.8 : 1.1;
  roundRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, 10); ctx.stroke();
  ctx.restore();
}

// ---------- panneau détail ----------
function drawDetail(L, id, t) {
  const m = MODULES[id], d = L.det;
  const owned = modState(G.inv).owned.includes(id);
  const ms = modState(G.inv);
  const eq = ms.eq;
  const equipped = eq.act === id || eq.pass === id || eq.pass2 === id;
  const rc = RAR_COL[m.rar] || '#90a4ae';
  const enter = Math.max(0, Math.min(1, (t - (G.modViewT || 0)) / 0.6 - 0.15));
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate((1 - enter) * 24, 0);
  // page de grimoire : cuir sombre, double filet bronze, coins gravés
  const pg = ctx.createLinearGradient(d.x, d.y, d.x + d.w, d.y + d.h);
  pg.addColorStop(0, 'rgba(34,26,15,0.94)'); pg.addColorStop(1, 'rgba(20,15,9,0.94)');
  ctx.fillStyle = pg;
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.fill();
  ctx.strokeStyle = hexA(GOLD, 0.65); ctx.lineWidth = 1.4;
  roundRect(d.x + 5, d.y + 5, d.w - 10, d.h - 10, 9); ctx.stroke();
  ctx.strokeStyle = hexA(GOLD, 0.22); ctx.lineWidth = 0.8;
  roundRect(d.x + 10, d.y + 10, d.w - 20, d.h - 20, 7); ctx.stroke();
  // coins ornementaux : crosses pattées
  ctx.strokeStyle = hexA(GOLD, 0.8); ctx.lineWidth = 1.2;
  const cl = 10;
  [[d.x + 14, d.y + 14, 1, 1], [d.x + d.w - 14, d.y + 14, -1, 1], [d.x + 14, d.y + d.h - 14, 1, -1], [d.x + d.w - 14, d.y + d.h - 14, -1, -1]].forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + sx * cl, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * cl);
    ctx.moveTo(cx + sx * cl * 0.5, cy + sy * cl * 0.5); ctx.lineTo(cx + sx * cl * 0.5 + sx * 3, cy + sy * cl * 0.5);
    ctx.moveTo(cx + sx * cl * 0.5, cy + sy * cl * 0.5); ctx.lineTo(cx + sx * cl * 0.5, cy + sy * cl * 0.5 + sy * 3);
    ctx.stroke();
  });
  const ix = d.x + d.w / 2;
  // grande médaillon de relique : anneau double + points cardinaux
  const iy = d.y + 74;
  ctx.save();
  ctx.strokeStyle = hexA(GOLD, owned ? 0.6 : 0.2); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(ix, iy, 48, 0, TAU); ctx.stroke();
  ctx.strokeStyle = hexA(rc, owned ? 0.5 : 0.15); ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 8;
  ctx.beginPath(); ctx.arc(ix, iy, 54, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4 + Math.PI / 4;
    ctx.fillStyle = hexA(GOLD, owned ? 0.8 : 0.25);
    ctx.beginPath(); ctx.arc(ix + Math.cos(a) * 48, iy + Math.sin(a) * 48, 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
  const bob = Math.sin(t * 2.2) * 3;
  ctx.save();
  ctx.shadowColor = owned ? m.col : 'transparent'; ctx.shadowBlur = owned ? 18 : 0;
  ctx.globalAlpha = enter * (owned ? 1 : 0.4);
  drawModuleIcon(id, ix, iy + bob, 2.1);
  ctx.restore();
  // nom
  const lvl = owned ? modLevel(id) : 1;
  ctx.globalAlpha = enter;
  ctx.font = `700 18px ${UI}`; ctx.fillStyle = owned ? C_TEXT : 'rgba(255,255,255,0.4)';
  ctx.fillText(m.name, ix, d.y + 146);
  // rangée méta : rareté · type (centrée)
  ctx.font = `600 9.5px ${UI}`; ctx.letterSpacing = '1.5px';
  ctx.fillStyle = rc; ctx.fillText(m.rar.toUpperCase(), ix - 62, d.y + 164);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillText('·', ix - 24, d.y + 164);
  ctx.fillStyle = m.col; ctx.fillText(m.type === 'actif' ? 'MODULE ACTIF' : 'MODULE PASSIF', ix + 34, d.y + 164);
  ctx.letterSpacing = '0px';
  // rangée niveau (gauche) + recharge (droite) — jamais superposées
  if (owned) {
    const lx = ix - 96;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k < lvl ? '#ffd740' : 'rgba(255,255,255,0.18)';
      ctx.save(); ctx.translate(lx + k * 15, d.y + 182);
      ctx.rotate(Math.PI / 4); ctx.fillRect(-3.6, -3.6, 7.2, 7.2); ctx.restore();
    }
    ctx.font = `700 9.5px ${UI}`; ctx.fillStyle = lvl >= 3 ? '#ffd740' : '#69f0ae';
    ctx.fillText(lvl >= 3 ? 'NIV MAX' : `NIV ${lvl}`, lx + 52, d.y + 185);
  }
  if (m.type === 'actif' && m.cd) {
    ctx.fillStyle = 'rgba(255,215,64,0.85)'; ctx.font = `700 10px ${UI}`;
    const cdTxt = `[X] recharge ${m.cd} s`;
    ctx.fillText(cdTxt, d.x + d.w - 22 - ctx.measureText(cdTxt).width, d.y + 185);
  }
  // description : retour à la ligne, max 4 lignes, jamais de troncature
  ctx.font = `10.5px ${UI}`; ctx.fillStyle = owned ? '#b5af9f' : 'rgba(255,255,255,0.3)';
  const words = m.desc.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const tx = cur ? cur + ' ' + w : w;
    if (ctx.measureText(tx).width > d.w - 52 && cur) { lines.push(cur); cur = w; } else cur = tx;
  }
  if (cur) lines.push(cur);
  lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, ix, d.y + 206 + i * 14));
  // statistiques
  const sy = d.y + d.h - 118;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(d.x + 24, sy - 14); ctx.lineTo(d.x + d.w - 24, sy - 14); ctx.stroke();
  ctx.font = `600 9.5px ${UI}`; ctx.letterSpacing = '2px'; ctx.fillStyle = GOLD;
  ctx.fillText('STATISTIQUES', ix, sy + 2); ctx.letterSpacing = '0px';
  ctx.font = `11px ${UI}`; ctx.fillStyle = owned ? C_MUTED : 'rgba(255,255,255,0.28)';
  statLines(m, lvl).forEach((l, i) => ctx.fillText(l, ix, sy + 20 + i * 14));
  // boutons bas : [équiper/installé] + [améliorer niv] (module possédé) ou [acheter] (verrouillé)
  const b = equipped ? L.equipBtn : (owned ? L.equipBtn : L.shopBtn);
  const hov = inR(b, G.mouse.x, G.mouse.y);
  const ub = L.upBtn;
  const ucost = owned && lvl < 3 ? modUpgradeCost(id) : null;
  if (ucost) {
    const hovU = inR(ub, G.mouse.x, G.mouse.y);
    ctx.fillStyle = hovU ? 'rgba(105,240,174,0.95)' : 'rgba(105,240,174,0.55)';
    roundRect(ub.x, ub.y, ub.w, ub.h, 10); ctx.fill();
    ctx.fillStyle = '#06130c';
    ctx.font = `700 10.5px ${UI}`;
    ctx.fillText(`⬆ AMÉLIORER → NIV ${lvl + 1}`, ub.x + ub.w / 2, ub.y + 16);
    ctx.font = `600 9px ${UI}`;
    ctx.fillText(`${ucost.emeraude} ◆ + ${ucost.cristal} ✦`, ub.x + ub.w / 2, ub.y + 31);
  } else if (owned && lvl >= 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ub.x, ub.y, ub.w, ub.h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,64,0.5)'; ctx.lineWidth = 1; roundRect(ub.x, ub.y, ub.w, ub.h, 10); ctx.stroke();
    ctx.fillStyle = '#ffd740'; ctx.font = `700 10.5px ${UI}`;
    ctx.fillText('★ NIVEAU MAX', ub.x + ub.w / 2, ub.y + ub.h / 2 + 4);
  }
  if (equipped) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.strokeStyle = m.col; ctx.lineWidth = 1.5; roundRect(b.x, b.y, b.w, b.h, 10); ctx.stroke();
    ctx.fillStyle = m.col; ctx.font = `700 12.5px ${UI}`;
    ctx.fillText('❖ INSTALLÉ', b.x + b.w / 2, b.y + b.h / 2 + 4);
  } else if (!owned) {
    ctx.fillStyle = hov ? 'rgba(255,215,64,0.9)' : 'rgba(255,215,64,0.55)';
    roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.fillStyle = '#16130c'; ctx.font = `700 12.5px ${UI}`;
    ctx.fillText(`🛒 ACHETER — ${m.price} ◆`, b.x + b.w / 2, b.y + b.h / 2 + 4);
  } else {
    const passLocked = m.type === 'passif' && !ms.passUnlocked;
    ctx.fillStyle = passLocked ? (hov ? 'rgba(255,215,64,0.9)' : 'rgba(255,215,64,0.55)') : hov ? hexA(m.col, 0.95) : hexA(m.col, 0.5);
    roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.fillStyle = passLocked ? '#16130c' : '#06101e'; ctx.font = `700 12.5px ${UI}`;
    ctx.fillText(passLocked ? `🔒 SLOT PASSIF — ${PASS_SLOT_PRICE} ◆` : (m.type === 'actif' ? '✦ INSTALLER [X]' : '❖ INSTALLER PASSIF'), b.x + b.w / 2, b.y + b.h / 2 + 4);
  }
  ctx.restore();
}

function drawEmptyDetail(L, t) {
  const d = L.det;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, (t - (G.modViewT || 0)) / 0.6 - 0.15));
  const pg2 = ctx.createLinearGradient(d.x, d.y, d.x + d.w, d.y + d.h);
  pg2.addColorStop(0, 'rgba(34,26,15,0.8)'); pg2.addColorStop(1, 'rgba(20,15,9,0.8)');
  ctx.fillStyle = pg2;
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(216,180,90,0.3)'; ctx.lineWidth = 1;
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '26px serif'; ctx.fillStyle = 'rgba(216,180,90,0.4)';
  ctx.fillText('✦', d.x + d.w / 2, d.y + d.h / 2 - 10);
  ctx.font = `12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Choisissez une relique pour', d.x + d.w / 2, d.y + d.h / 2 + 18);
  ctx.fillText('examiner ses pouvoirs.', d.x + d.w / 2, d.y + d.h / 2 + 36);
  ctx.restore();
}

// ---------- résumé des bonus équipés ----------
function drawSummary(t) {
  const ms = G.inv ? modState(G.inv) : null;
  const eqIds = ms ? [ms.eq.act, ms.eq.pass, ms.eq.pass2].filter(Boolean) : [];
  const y = H - 20;
  ctx.textAlign = 'left';
  ctx.font = `600 10px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = GOLD;
  ctx.fillText('RELIQUES ÉQUIPÉES', 34, y);
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
  drawGrimoireBG(t);
  drawHeader(t);
  const cw = 620, ch = 330, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2 + 20;
  ctx.fillStyle = 'rgba(24,18,10,0.92)';
  roundRect(cx, cy, cw, ch, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(216,180,90,0.4)'; ctx.lineWidth = 1.5;
  roundRect(cx + 5, cy + 5, cw - 10, ch - 10, 12); ctx.stroke();
  const lx = cx + cw / 2, ly = cy + 100;
  ctx.save();
  ctx.translate(lx, ly); ctx.rotate(t * 0.4);
  ctx.strokeStyle = 'rgba(216,180,90,0.7)'; ctx.lineWidth = 1.6; ctx.setLineDash([8, 7]);
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8;
    ctx.strokeStyle = 'rgba(216,180,90,0.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 44, Math.sin(a) * 44);
    ctx.lineTo(Math.cos(a) * 51, Math.sin(a) * 51);
    ctx.stroke();
  }
  ctx.restore();
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
  ctx.fillStyle = 'rgba(24,18,10,0.94)';
  roundRect(W / 2 - wTxt / 2, 168, wTxt, 30, 15); ctx.fill();
  ctx.strokeStyle = G.modMsg.bad ? 'rgba(255,120,110,0.6)' : 'rgba(216,180,90,0.6)';
  ctx.lineWidth = 1.2; roundRect(W / 2 - wTxt / 2 + 0.5, 168.5, wTxt - 1, 29, 15); ctx.stroke();
  ctx.fillStyle = G.modMsg.bad ? '#ff8a80' : '#69f0ae';
  ctx.fillText(msg, W / 2, 188);
  ctx.restore();
}

// ---------- statistiques par module ----------
function statLines(m, lvl = 1) {
  const cd = c => (c * (1 - 0.07 * (lvl - 1))).toFixed(1).replace('.', ',');
  switch (m.name) {
    case 'Bouclier énergétique': return [`Bouclier : ${70 + 40 * (lvl - 1)} PV`, `Régén : ${(3 + 1.5 * (lvl - 1)).toFixed(1).replace('.', ',')} PV/s`, `Conversion : ${(2 + 1.5 * (lvl - 1)).toFixed(1).replace('.', ',')} % (max 75 %)`];
    case 'Ruée dimensionnelle': return [`Distance : ~${Math.round(560 * (1 + 0.15 * (lvl - 1)))} px`, 'Durée : 0,3 s', `Recharge : ${cd(14)} s`];
    case 'Surcharge': return [`Dégâts : +${50 + 15 * (lvl - 1)} %`, 'Durée : 6 s', `Recharge : ${cd(14)} s`];
    case 'Régénération': return [`Régénération : +${4 + 2 * (lvl - 1)} PV/s`];
    case 'Onde de choc': return [`Rayon : ${Math.round(230 * (1 + 0.1 * (lvl - 1)))} px`, `Dégâts : +${20 * (lvl - 1)} %`, `Recharge : ${cd(15)} s`];
    case 'Instinct du chasseur': return [`Chance critique : +${12 + 5 * (lvl - 1)} %`, 'Critique : ×1,75'];
    case 'Distorsion temporelle': return ['Portée : 270 px', `Ralentissement : 45 % / ${4 + 0.5 * (lvl - 1)} s`, `Recharge : ${cd(18)} s`];
    case 'Absorption': return [`Soins : ${8 + 2 * (lvl - 1)} % des dégâts infligés`];
    case 'Frappe orbitale': return ['Cible : ennemi le plus proche', `Dégâts : +${25 * (lvl - 1)} %`, `Recharge : ${cd(12)} s`];
    case 'Résistance': return [`Dégâts subis : −${12 + 4 * (lvl - 1)} %`];
    case 'Impulsion': return [`Vitesse : +${60 + 15 * (lvl - 1)} %`, `Durée : ${4 + 0.5 * (lvl - 1)} s`, `Recharge : ${cd(14)} s`];
    case 'Dernier rempart': return ['Déclencheur : PV < 30 %', `Bouclier : ${60 + 40 * (lvl - 1)} PV / ${Math.max(4, 6 - (lvl - 1))} s`, `Recharge : ${30 - 4 * (lvl - 1)} s`];
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
  drawGrimoireBG(t);
  drawHeader(t);
  // pods
  const eq = modState(inv).eq;
  const ms = modState(inv);
  for (const s of L.slots) drawSlot(s, eq[s.key], s.key === 'pass' && !ms.passUnlocked, t);
  // grille
  ctx.textAlign = 'left'; ctx.font = `600 10px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = GOLD;
  ctx.fillText(`RELIQUES · ${ms.owned.length}/${MOD_IDS.length} DÉCOUVERTES`, 34, 190);
  ctx.letterSpacing = '0px';
  // grille rognée à la zone visible (les cartes défilent sous l'en-tête)
  ctx.save();
  ctx.beginPath(); ctx.rect(L.grid.x, L.grid.y, L.grid.w, L.grid.h); ctx.clip();
  for (const c of L.cards) drawCard(c, t);
  ctx.restore();
  // scrollbar verticale discrète
  if (L.scrollMax > 0) {
    const gx = L.grid.x + L.grid.w - 8, gy = L.grid.y, gh = L.grid.h;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(gx, gy, 5, gh, 3); ctx.fill();
    const thumbH = Math.max(30, gh * (gh / (gh + L.scrollMax)));
    const thumbY = gy + (gh - thumbH) * ((G.modScroll || 0) / L.scrollMax);
    ctx.fillStyle = 'rgba(216,180,90,0.4)';
    roundRect(gx, thumbY, 5, thumbH, 3); ctx.fill();
  }
  // détail
  if (G.modSel && MODULES[G.modSel]) drawDetail(L, G.modSel, t);
  else drawEmptyDetail(L, t);
  drawSummary(t);
  drawMsg(t);
  drawMenuButton(menuButtons().back, '← RETOUR', '#4a3817', GOLD_HI, false);
  ctx.textAlign = 'center';
}
