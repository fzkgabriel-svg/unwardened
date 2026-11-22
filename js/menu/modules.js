// js/menu/modules.js — vue MODULES : écriture futuriste, slots + grille + fiche
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, hexA } from '../utils.js';
import { MODULES, MOD_IDS, modState, equippedMods, eqActive, modulesUnlocked, ownModule, ensureModules } from '../modules.js';
import { saveInv } from '../inventory.js';
import { inR, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, menuButtons, drawMenuButton } from './common.js';
import { sfxClick, sfxEquip } from '../audio.js';

// ---------- layout ----------
function layout() {
  const cw = 1080, ch = 560, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2 + 10;
  // slots en haut : ACTIF + 2 PASSIFS
  const slotW = 220, slotH = 74, gap = 18;
  const sx0 = cx + cw / 2 - (slotW * 3 + gap * 2) / 2, sy = cy + 66;
  const slots = [
    { key: 'act', label: 'ACTIF', x: sx0, y: sy, w: slotW, h: slotH },
    { key: 'p1', label: 'PASSIF 1', x: sx0 + slotW + gap, y: sy, w: slotW, h: slotH },
    { key: 'p2', label: 'PASSIF 2', x: sx0 + (slotW + gap) * 2, y: sy, w: slotW, h: slotH },
  ];
  // grille des modules possédés (2 lignes de 6)
  const gx = cx + 30, gy = cy + 168, gw = 560, gh = 330;
  const owned = G.inv ? modState(G.inv).owned : [];
  const cards = [];
  const perRow = 3, cw2 = (gw - 20) / perRow, ch2 = 104;
  owned.slice(0, 12).forEach((id, i) => {
    cards.push({ id, x: gx + (i % perRow) * (cw2 + 10), y: gy + Math.floor(i / perRow) * (ch2 + 10), w: cw2, h: ch2 });
  });
  // panneau détail à droite
  const det = { x: gx + gw + 16, y: gy, w: cw - gw - 46, h: gh };
  return { panel: { x: cx, y: cy, w: cw, h: ch }, slots, cards, det, owned };
}

// ---------- clics ----------
export function modClickAt(x, y) {
  if (!G.inv) return null;
  const L = layout();
  const b = menuButtons().back;
  if (inR(b, x, y)) { G.menuView = 'main'; return 'back'; }
  if (!modulesUnlocked()) return 'locked';
  // slots : clic = déséquipé
  const eq = modState(G.inv).eq;
  for (const s of L.slots) {
    if (inR(s, x, y)) {
      const id = eq[s.key];
      if (id) { eq[s.key] = null; saveInv(G.inv); sfxClick(); return 'unequip'; }
      return 'slot';
    }
  }
  // cartes : sélection
  for (const c of L.cards) {
    if (inR(c, x, y)) { G.modSel = G.modSel === c.id ? null : c.id; sfxClick(); return 'sel'; }
  }
  // bouton équiper du panneau détail
  const eqBtn = equipBtnRect(L);
  if (G.modSel && inR(eqBtn, x, y)) {
    const m = MODULES[G.modSel];
    const target = m.type === 'actif' ? 'act' : (eq.p1 ? 'p2' : 'p1');
    // si déjà équipé ailleurs, on le retire d'abord
    for (const k of ['act', 'p1', 'p2']) if (eq[k] === G.modSel) eq[k] = null;
    eq[target] = G.modSel;
    saveInv(G.inv); sfxEquip(); G.modSelFx = G.time;
    return 'equip';
  }
  return inR(L.panel, x, y) ? 'inside' : 'back';
}
function equipBtnRect(L) {
  const d = L.det;
  return { x: d.x + 20, y: d.y + d.h - 58, w: d.w - 40, h: 40 };
}

// ---------- dessin ----------
export function drawModulesView() {
  const inv = G.inv;
  ctx.textAlign = 'center';
  if (inv) ensureModules(); // débloque + offre les 2 modules si boss du monde 4 vaincu
  if (!modulesUnlocked()) { drawLocked(); return; }
  const L = layout();
  const P = L.panel;
  // panneau principal : verre sombre + liserés holographiques
  ctx.fillStyle = 'rgba(6,10,20,0.92)';
  roundRect(P.x, P.y, P.w, P.h, 16); ctx.fill();
  const hg = ctx.createLinearGradient(P.x, P.y, P.x + P.w, P.y + P.h);
  hg.addColorStop(0, hexA('#18ffff', 0.20)); hg.addColorStop(0.5, hexA('#7b2ff7', 0.10)); hg.addColorStop(1, hexA('#18ffff', 0.05));
  ctx.strokeStyle = hg; ctx.lineWidth = 1.5;
  roundRect(P.x, P.y, P.w, P.h, 16); ctx.stroke();
  // grille technique en fond
  ctx.strokeStyle = 'rgba(24,255,255,0.05)'; ctx.lineWidth = 1;
  for (let x = P.x + 20; x < P.x + P.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h); ctx.stroke(); }
  for (let y = P.y + 20; y < P.y + P.h; y += 40) { ctx.beginPath(); ctx.moveTo(P.x, y); ctx.lineTo(P.x + P.w, y); ctx.stroke(); }

  overlineX('MODULES DU HÉROS', W / 2, P.y + 34);
  ctx.font = `600 30px ${SERIF}`; ctx.fillStyle = C_TEXT; ctx.letterSpacing = '3px';
  ctx.fillText('SYSTÈME DE MODULES', W / 2, P.y + 66);
  ctx.letterSpacing = '0px';
  ctx.font = `12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('1 module actif (touche X) + 2 modules passifs — achetés à la boutique en émeraudes', W / 2, P.y + 88);

  // slots d'équipement
  const eq = modState(inv).eq;
  for (const s of L.slots) drawSlot(s, eq[s.key]);

  // titre de la grille
  ctx.textAlign = 'left'; ctx.font = `600 11px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = '#18ffff';
  ctx.fillText(`MODULES POSSÉDÉS (${L.owned.length}/${MOD_IDS.length})`, L.cards.length ? L.cards[0].x : P.x + 30, L.slots[0].y + L.slots[0].h + 22);
  ctx.letterSpacing = '0px';

  for (const c of L.cards) drawModCard(c);
  if (G.modSel && MODULES[G.modSel]) drawModDetail(L, G.modSel);
  else drawEmptyDetail(L);

  // bouton retour
  drawMenuButton(menuButtons().back, '← RETOUR', '#455a64', '#90a4ae', false);
  ctx.textAlign = 'center';
}

function overlineX(text, x, y) {
  ctx.save(); ctx.font = `600 11px ${UI}`; ctx.letterSpacing = '3px';
  ctx.fillStyle = '#18ffff'; ctx.textAlign = 'center'; ctx.fillText(text, x, y); ctx.restore();
}

function drawLocked() {
  const cw = 560, ch = 320, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  ctx.fillStyle = 'rgba(6,10,20,0.94)';
  roundRect(cx, cy, cw, ch, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(24,255,255,0.25)'; ctx.lineWidth = 1.5;
  roundRect(cx, cy, cw, ch, 16); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '64px serif'; ctx.fillText('🔒', W / 2, cy + 110);
  ctx.font = `600 26px ${SERIF}`; ctx.fillStyle = C_TEXT; ctx.letterSpacing = '2px';
  ctx.fillText('MODULES VERROUILLÉS', W / 2, cy + 170);
  ctx.letterSpacing = '0px'; ctx.font = `14px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Vainquez le boss final du monde 4 (Les Égouts)', W / 2, cy + 205);
  ctx.fillText('pour débloquer le système et recevoir vos 2 premiers modules.', W / 2, cy + 228);
  drawMenuButton(menuButtons().back, '← RETOUR', '#455a64', '#90a4ae', false);
}

function drawSlot(s, id) {
  const hov = inR(s, G.mouse.x, G.mouse.y);
  const m = id ? MODULES[id] : null;
  ctx.fillStyle = hov ? 'rgba(24,255,255,0.10)' : 'rgba(255,255,255,0.04)';
  roundRect(s.x, s.y, s.w, s.h, 10); ctx.fill();
  ctx.strokeStyle = m ? hexA(m.col, 0.7) : (hov ? 'rgba(24,255,255,0.4)' : 'rgba(255,255,255,0.12)');
  ctx.lineWidth = 1.4; roundRect(s.x, s.y, s.w, s.h, 10); ctx.stroke();
  // coin sci-fi
  ctx.fillStyle = m ? m.col : 'rgba(255,255,255,0.2)';
  ctx.font = `600 10px ${UI}`; ctx.textAlign = 'left'; ctx.letterSpacing = '1.5px';
  ctx.fillText(s.label, s.x + 14, s.y + 18); ctx.letterSpacing = '0px';
  if (m) {
    ctx.font = '24px serif'; ctx.textAlign = 'center';
    ctx.fillText(m.icon, s.x + 30, s.y + s.h / 2 + 8);
    ctx.textAlign = 'left'; ctx.font = `600 13px ${UI}`; ctx.fillStyle = C_TEXT;
    ctx.fillText(m.name, s.x + 52, s.y + s.h / 2 - 2);
    ctx.font = `10px ${UI}`; ctx.fillStyle = m.col;
    ctx.fillText(`${m.type.toUpperCase()} · clic pour retirer`, s.x + 52, s.y + s.h / 2 + 16);
  } else {
    ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('◇', s.x + s.w / 2, s.y + s.h / 2 + 2);
    ctx.font = `10px ${UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('slot vide', s.x + s.w / 2, s.y + s.h - 10);
  }
}

function drawModCard(c) {
  const id = c.id, m = MODULES[id];
  const sel = G.modSel === id;
  const eq = modState(G.inv).eq;
  const equipped = eq.act === id || eq.p1 === id || eq.p2 === id;
  const hov = inR(c, G.mouse.x, G.mouse.y);
  // carte holographique
  ctx.fillStyle = sel ? hexA(m.col, 0.14) : hov ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
  roundRect(c.x, c.y, c.w, c.h, 10); ctx.fill();
  ctx.strokeStyle = equipped ? m.col : sel ? hexA(m.col, 0.9) : hov ? hexA(m.col, 0.5) : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = equipped || sel ? 2 : 1.2;
  roundRect(c.x, c.y, c.w, c.h, 10); ctx.stroke();
  // lueur du module
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 3 + c.x);
  ctx.save();
  ctx.shadowColor = m.col; ctx.shadowBlur = sel ? 18 : 8 + pulse * 6;
  ctx.font = '26px serif'; ctx.textAlign = 'center';
  ctx.fillText(m.icon, c.x + c.w / 2, c.y + 34);
  ctx.restore();
  // nom + type
  ctx.font = `600 11.5px ${UI}`; ctx.fillStyle = C_TEXT; ctx.textAlign = 'center';
  ctx.fillText(m.name, c.x + c.w / 2, c.y + 62);
  ctx.font = `9.5px ${UI}`; ctx.fillStyle = m.col;
  ctx.fillText(`${m.rar.toUpperCase()} · ${m.type.toUpperCase()}`, c.x + c.w / 2, c.y + 78);
  // badges
  if (equipped) {
    ctx.fillStyle = m.col; ctx.font = `700 9px ${UI}`;
    ctx.fillText('✔ ÉQUIPÉ', c.x + c.w / 2, c.y + c.h - 8);
  } else if (hov) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `9px ${UI}`;
    ctx.fillText('cliquer pour inspecter', c.x + c.w / 2, c.y + c.h - 8);
  }
}

function drawModDetail(L, id) {
  const m = MODULES[id], d = L.det;
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.fill();
  ctx.strokeStyle = hexA(m.col, 0.5); ctx.lineWidth = 1.4;
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.stroke();
  const eq = modState(G.inv).eq;
  const equipped = eq.act === id || eq.p1 === id || eq.p2 === id;
  // grande icône animée
  const ix = d.x + d.w / 2, iy = d.y + 66;
  const bob = Math.sin(G.time * 2.4) * 4;
  ctx.save();
  ctx.shadowColor = m.col; ctx.shadowBlur = 24;
  ctx.font = '52px serif'; ctx.textAlign = 'center';
  ctx.fillText(m.icon, ix, iy + bob);
  ctx.restore();
  // nom + rareté + type
  ctx.font = `700 17px ${UI}`; ctx.fillStyle = C_TEXT; ctx.textAlign = 'center';
  ctx.fillText(m.name, ix, d.y + 128);
  ctx.font = `600 10px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = m.col;
  ctx.fillText(`${m.rar.toUpperCase()} · ${m.type === 'actif' ? 'MODULE ACTIF (Touche X)' : 'MODULE PASSIF'}`, ix, d.y + 148);
  ctx.letterSpacing = '0px';
  // description
  ctx.font = `12px ${UI}`; ctx.fillStyle = '#b5af9f';
  const words = m.desc.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > d.w - 44) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => ctx.fillText(l, ix, d.y + 176 + i * 17));
  // stats
  ctx.font = `600 10px ${UI}`; ctx.letterSpacing = '2px'; ctx.fillStyle = '#18ffff';
  ctx.fillText('STATISTIQUES', ix, d.y + d.h - 108); ctx.letterSpacing = '0px';
  ctx.font = `11.5px ${UI}`; ctx.fillStyle = C_MUTED; ctx.textAlign = 'center';
  statLines(m).forEach((l, i) => ctx.fillText(l, ix, d.y + d.h - 88 + i * 15));
  // bouton équiper / équipé
  const b = equipBtnRect(L), hov = inR(b, G.mouse.x, G.mouse.y);
  if (equipped) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(b.x, b.y, b.w, b.h, 9); ctx.fill();
    ctx.strokeStyle = m.col; ctx.lineWidth = 1.4; roundRect(b.x, b.y, b.w, b.h, 9); ctx.stroke();
    ctx.fillStyle = m.col; ctx.font = `700 13px ${UI}`;
    ctx.fillText('✔ ÉQUIPÉ — cliquez un slot vide pour changer', ix, b.y + b.h / 2 + 5);
  } else {
    ctx.fillStyle = hov ? hexA(m.col, 0.95) : hexA(m.col, 0.55);
    roundRect(b.x, b.y, b.w, b.h, 9); ctx.fill();
    ctx.fillStyle = '#0a0f1a'; ctx.font = `700 13px ${UI}`;
    ctx.fillText(m.type === 'actif' ? '⚡ ÉQUIPER COMME MODULE ACTIF' : '⬡ ÉQUIPER COMME MODULE PASSIF', ix, b.y + b.h / 2 + 5);
  }
}
function statLines(m) {
  switch (m.name) {
    case 'Bouclier énergétique': return ['Bouclier : 70 PV', 'Régénération : 3 PV/s (après 4 s)'];
    case 'Ruée dimensionnelle': return ['Distance : ~250 px', 'Durée : 0,24 s', 'Recharge : 8 s'];
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
function drawEmptyDetail(L) {
  const d = L.det;
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = C_MUTED; ctx.font = `italic 13px ${UI}`;
  ctx.fillText('Sélectionnez un module pour voir sa fiche', d.x + d.w / 2, d.y + d.h / 2);
}
