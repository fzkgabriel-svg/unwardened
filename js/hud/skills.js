// js/hud/skills.js — barre de compétences du bas : emplacements circulaires
// à cadres métalliques, icônes en relief, balayage de recharge radial,
// animations de disponibilité. + plaque de l'arme active (nom, niveau, XP).
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, drawFlaskIcon } from '../utils.js';
import { ITEMS, modeInfo, modeKey, modeMult, weaponAllowed, loadoutOf } from '../inventory.js';
import { drawBowIcon } from '../gfx/bow_draw.js';
import { SENT_CD } from '../attacks.js';
import { HPAL, parchment, engraved, gem, crisp, HUD_CINZEL } from './frame.js';

// icônes détaillées des modes d'attaque (déplacées depuis hud.js)
function drawAttackIcon(kind, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'laser') {
    ctx.rotate(-Math.PI / 4);
    ctx.strokeStyle = 'rgba(255,140,60,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(4, -16); ctx.lineTo(4, 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,245,220,0.95)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(4, -16); ctx.lineTo(4, 8); ctx.stroke();
    const lg = ctx.createLinearGradient(0, 10, 0, -8);
    lg.addColorStop(0, '#bf360c'); lg.addColorStop(0.6, '#ff7043'); lg.addColorStop(1, '#ffd740');
    ctx.fillStyle = lg;
    ctx.strokeStyle = '#5d1303'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.lineTo(6, -4); ctx.lineTo(10, -8);
    ctx.lineTo(10, -11); ctx.lineTo(-10, -11); ctx.lineTo(-10, -8); ctx.lineTo(-6, -4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-11, 10, 7, 6);
    ctx.fillStyle = '#ffd740';
    ctx.beginPath(); ctx.arc(0, 14, 2.4, 0, TAU); ctx.fill();
  } else if (kind === 'volcano') {
    const vg = ctx.createLinearGradient(0, -10, 0, 12);
    vg.addColorStop(0, '#5d4037'); vg.addColorStop(1, '#3e2723');
    ctx.fillStyle = vg;
    ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-13, 12); ctx.lineTo(-4, -8); ctx.lineTo(4, -8); ctx.lineTo(13, 12);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const cg = ctx.createRadialGradient(0, -9, 1, 0, -9, 7);
    cg.addColorStop(0, '#fff9c4'); cg.addColorStop(0.5, '#ff5722'); cg.addColorStop(1, 'rgba(183,28,28,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, -9, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffab00';
    ctx.beginPath(); ctx.arc(-9, -2, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 0, 1.8, 0, TAU); ctx.fill();
  } else if (kind === 'sword') {
    ctx.rotate(-Math.PI / 4);
    ctx.strokeStyle = 'rgba(255,215,64,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0.6, 2.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI + 0.6, Math.PI + 2.2); ctx.stroke();
    const lg = ctx.createLinearGradient(0, 8, 0, -14);
    lg.addColorStop(0, '#78909c'); lg.addColorStop(0.5, '#eceff1'); lg.addColorStop(1, '#b0bec5');
    ctx.fillStyle = lg;
    ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2.2, 6); ctx.lineTo(2.2, 6); ctx.lineTo(1.4, -8); ctx.lineTo(0, -14); ctx.lineTo(-1.4, -8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(55,71,79,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -9); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,64,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(-1.2, -8); ctx.stroke();
    ctx.fillStyle = '#ffd740'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -1); ctx.lineTo(8, -1); ctx.lineTo(7, 1.5); ctx.lineTo(-7, 1.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-8, 0.2, 2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(8, 0.2, 2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-2, 6, 4, 7);
    ctx.fillStyle = '#ffd740';
    ctx.beginPath(); ctx.arc(0, 14, 2.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1; ctx.stroke();
  } else if (kind === 'bow') {
    drawBowIcon(0, 0, 1.05);
  } else if (kind === 'judgment') {
    // JUGEMENT DU GARDIEN : grande lame sombre + cristal cyan flottant
    ctx.rotate(-Math.PI / 4);
    ctx.strokeStyle = 'rgba(167,255,235,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0.6, 2.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI + 0.6, Math.PI + 2.2); ctx.stroke();
    const jg = ctx.createLinearGradient(0, 8, 0, -14);
    jg.addColorStop(0, '#263238'); jg.addColorStop(0.6, '#455a64'); jg.addColorStop(1, '#78909c');
    ctx.fillStyle = jg;
    ctx.strokeStyle = '#0f1419'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-2.4, 6); ctx.lineTo(2.4, 6); ctx.lineTo(1.5, -9); ctx.lineTo(0, -15); ctx.lineTo(-1.5, -9);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,64,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2.1, 4); ctx.lineTo(-1.3, -10); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,14,20,0.7)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -10); ctx.stroke();
    // gravures runiques
    ctx.strokeStyle = 'rgba(255,215,64,0.55)'; ctx.lineWidth = 0.9;
    for (const rx of [-5, 0, 5]) {
      ctx.beginPath(); ctx.moveTo(rx - 1.5, -2); ctx.lineTo(rx, 0); ctx.lineTo(rx - 1.5, 2); ctx.stroke();
    }
    // garde ailée dorée
    ctx.fillStyle = '#d4af37'; ctx.strokeStyle = '#8a6d1f'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, -2); ctx.lineTo(-3, -2); ctx.lineTo(-3, -4.5); ctx.lineTo(-7, -3.5);
    ctx.lineTo(-7, 3.5); ctx.lineTo(-3, 4.5); ctx.lineTo(-3, 2); ctx.lineTo(-9, 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3e2723'; ctx.fillRect(-4.5, 6, 3.6, 6);
    ctx.fillStyle = '#ffd740';
    ctx.beginPath(); ctx.arc(-2.6, 13, 2.2, 0, TAU); ctx.fill();
    // cristal flottant au-dessus de la garde
    const cg = ctx.createRadialGradient(-6, -8, 0.5, -6, -8, 6);
    cg.addColorStop(0, 'rgba(255,243,196,0.95)'); cg.addColorStop(0.5, 'rgba(167,255,235,0.4)'); cg.addColorStop(1, 'rgba(167,255,235,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(-6, -8, 6, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(-6, -8); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#a7ffeb'; ctx.fillRect(-3, -3, 6, 6);
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 0.9; ctx.strokeRect(-3, -3, 6, 6);
    ctx.restore();
  } else {
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-12, 13); ctx.lineTo(11, -12); ctx.stroke();
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(6, -7); ctx.lineTo(9, -10); ctx.stroke();
    ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#78909c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(11, -12); ctx.lineTo(17, -18); ctx.lineTo(13, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    const sg = ctx.createRadialGradient(-4, -5, 2, -3, 0, 12);
    sg.addColorStop(0, '#eceff1'); sg.addColorStop(0.55, '#90a4ae'); sg.addColorStop(1, '#455a64');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(-4, 1, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-4, 1, 9, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-11, 1); ctx.lineTo(3, 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-4, 8); ctx.stroke();
    ctx.fillStyle = '#1565c0';
    ctx.beginPath(); ctx.arc(-4, 1, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0d47a1'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}

// couleurs d'identité par arme (ornement propre à chaque mode)
const MODE_STYLE = {
  sword: { name: 'Épée',       col: '#e8c96a', glow: 'rgba(232,201,106,0.55)' },
  lance: { name: 'Lance',      col: '#7cc4f0', glow: 'rgba(124,196,240,0.55)' },
  bow:   { name: 'Arc Cinétique', col: '#b388ff', glow: 'rgba(179,136,255,0.6)' },
  judgment: { name: 'Jugement', col: '#a7ffeb', glow: 'rgba(167,255,235,0.55)' },
  laser: { name: 'Laser',      col: '#ffab66', glow: 'rgba(255,171,102,0.55)' },
  volcano:{ name: 'Volcan',    col: '#ff7043', glow: 'rgba(255,112,67,0.55)' }
};

// max connus des jauges de recharge (secondes)
const CD_MAX = { atk: 0.9, spin: 5, shield: 10, hand: 2.6, sing: 12.5 };

// ---------- emplacements d'armes du loadout ----------
// La barre affiche toujours 2 slots : & = emplacement 1, é = emplacement 2,
// peu importe l'arme qui y est équipée.
const WPN_SLOT = {
  epee:    { icon: 'sword',    mode: 1, sub: 'D', subColor: '#ff9100' },
  lance:   { icon: 'lance',    mode: 3, sub: 'D', subColor: '#4fc3f7' },
  gardien: { icon: 'judgment', mode: 7, sub: 'D', subColor: '#a7ffeb' },
  arc:     { icon: 'bow',      mode: 5, sub: 'D', subColor: '#b388ff' }
};
function weaponSlotVisible(wkey) {
  if (!WPN_SLOT[wkey] || !weaponAllowed(G.inv, wkey)) return false;
  if (wkey === 'gardien' && !(G.stats && G.stats.gardienUnlocked)) return false;
  if (wkey === 'arc' && !(G.stats && G.stats.bowUnlocked)) return false;
  return true;
}
function weaponSlotCd2(wkey, p) {
  if (wkey === 'epee')    return [p.spinCooldown, CD_MAX.spin];
  if (wkey === 'lance')   return [p.shieldCd, CD_MAX.shield];
  if (wkey === 'gardien') return [p.sentenceT > 0 ? SENT_CD : p.sentenceCd, SENT_CD];
  if (wkey === 'arc')     return [G.bow ? G.bow.singCd : 0, CD_MAX.sing];
  return [0, 0];
}
function loadoutSlots(p) {
  const lo = loadoutOf(G.inv);
  const out = [];
  [['&', 's1'], ['é', 's2']].forEach(([key, sk]) => {
    const wk = lo[sk];
    if (!wk || !weaponSlotVisible(wk)) return;
    const d = WPN_SLOT[wk];
    const [cd2, cd2Max] = weaponSlotCd2(wk, p);
    out.push({
      icon: d.icon, key, mode: d.mode,
      cd: p.attackCooldown, cdMax: CD_MAX.atk,
      cd2, cd2Max, sub: d.sub, subColor: d.subColor
    });
  });
  return out;
}

function slotFrame(cx, cy, r, active, accent, spent, cdFrac, subFrac, subColor) {
  const now = G.time || 0;
  // ombre + corps : anneau métallique (or si actif, acier sinon)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(1.5, 2.5, r + 4, 0, TAU); ctx.fill();
  const ringG = ctx.createLinearGradient(-r, -r, r, r);
  if (active) { ringG.addColorStop(0, '#f5e3b0'); ringG.addColorStop(0.5, accent); ringG.addColorStop(1, HPAL.goldLo); }
  else { ringG.addColorStop(0, '#9a917f'); ringG.addColorStop(0.5, HPAL.steel); ringG.addColorStop(1, HPAL.steelD); }
  ctx.fillStyle = ringG;
  ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, TAU); ctx.fill();
  // disque intérieur sombre
  const dg = ctx.createRadialGradient(0, -r * 0.3, r * 0.2, 0, 0, r);
  dg.addColorStop(0, spent ? '#241d18' : '#33291d');
  dg.addColorStop(1, spent ? '#171310' : '#1c1409');
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // reflet supérieur du métal
  ctx.strokeStyle = 'rgba(255,240,200,0.35)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(0, 0, r - 1, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
  ctx.restore();

  // balayage de recharge radial (pointe en haut, sens horaire)
  if (cdFrac > 0.001) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(8,5,2,0.72)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * cdFrac);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // liseré de recharge
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r - 0.5, -Math.PI / 2, -Math.PI / 2 + TAU * cdFrac); ctx.stroke();
  }
  // recharge secondaire (anneau extérieur qui se vide, ex. rotation / dôme / singularité)
  // subFrac = fraction RESTANTE (1 = recharge pleine, 0 = prêt)
  if (subFrac !== undefined && subFrac > 0.001) {
    ctx.save();
    ctx.strokeStyle = subColor; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.shadowColor = subColor; ctx.shadowBlur = 7;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6.5, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, subFrac));
    ctx.stroke();
    ctx.restore();
  }
  // animation de disponibilité : anneau qui pulse quand le sort revient
  if (active && cdFrac <= 0) {
    const pl = 0.5 + Math.sin(now * 4) * 0.3;
    ctx.strokeStyle = accent; ctx.globalAlpha = pl * 0.8; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, r + 5.5, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawSkillBar() {
  const p = G.player;
  const titan = p.ultActive > 0;
  const slots = titan ? [
    { icon: 'laser', key: 'G', mode: -1, cd: p.attackCooldown, cdMax: CD_MAX.atk, cd2: 0, cd2Max: 0 },
    { icon: 'volcano', key: 'D', mode: -2, cd: 0, cdMax: 1, cd2: p.handUsed ? 0 : p.handCd, cd2Max: CD_MAX.hand, used: p.handUsed },
    { icon: 'potion', key: 'W', mode: -3, cd: p.potionCooldown, cdMax: 1.5, cd2: 0, cd2Max: 0, potion: true }
  ] : [
    ...loadoutSlots(p),
    { icon: 'potion', key: 'W', mode: -3, cd: p.potionCooldown, cdMax: 1.5, cd2: 0, cd2Max: 0, potion: true }
  ];

  const n = slots.length, r = 26, gap = 68;
  const x0 = W / 2 - ((n - 1) * gap) / 2, cy = H - 46;

  slots.forEach((s, i) => {
    const cx = x0 + i * gap;
    const isPotion = !!s.potion;
    // fioles : "actif" = une fiole utilisable (stock > 0 et hors recharge)
    const active = isPotion ? (p.potions > 0 && p.potionCooldown <= 0) : (titan || p.attackMode === s.mode);
    const spent = isPotion ? p.potions <= 0 : !!s.used;
    const cdFrac = s.cd > 0 ? Math.min(1, s.cd / s.cdMax) : 0;
    const subFrac = s.cd2Max ? (s.cd2 > 0 ? Math.min(1, s.cd2 / s.cd2Max) : 0) : undefined;
    const mkey = s.icon === 'sword' ? 'sword' : s.icon === 'lance' ? 'lance' : s.icon === 'bow' ? 'bow' : s.icon === 'judgment' ? 'judgment' : s.icon;
    const st = isPotion ? { name: 'Fioles', col: '#ff8fb3', glow: 'rgba(255,143,179,0.6)' } : (MODE_STYLE[mkey] || MODE_STYLE.sword);
    // verrou de changement d'arme (2 s sans attaque) — ne concerne pas les fioles
    const locked = !isPotion && p.switchLock > 0;

    slotFrame(cx, cy, r, active, st.col, spent, locked ? 1 : cdFrac,
      subFrac !== undefined && subFrac > 0 ? subFrac : undefined, s.subColor || st.col);

    // icône en relief
    ctx.save();
    ctx.globalAlpha = spent ? 0.35 : active ? 1 : 0.6;
    if (active && !spent) { ctx.shadowColor = st.glow; ctx.shadowBlur = 7; }
    if (isPotion) {
      drawFlaskIcon(cx, cy - 4, 1.0, p.potions > 0);
      // compteur de fioles sous la fiole
      engraved(`${p.potions}`, cx, cy + 13, 13, p.potions > 0 ? '#ffd7e4' : '#8d7f8a', 'center', 'Consolas, monospace');
    } else {
      drawAttackIcon(s.icon, cx, cy + 1, active ? '#fff' : '#a8b0ba');
    }
    ctx.restore();

    // lettre de touche sous l'emblème
    engraved(s.key, cx, cy + r - 3, 10, active ? st.col : 'rgba(216,196,154,0.6)', 'center', 'Consolas, monospace');

    // badge secondaire (clic droit) en coin du cercle : anneau de progression
    // + secondes restantes pendant la recharge, lettre quand c'est prêt
    if (s.sub) {
      const bx = cx + r - 2, by = cy + r - 2;
      const subCd = (s.cd2 || 0) > 0 && s.cd2Max > 0;
      const subFracB = subCd ? Math.min(1, s.cd2 / s.cd2Max) : 0;
      const subCol = s.subColor || '#fff';
      ctx.fillStyle = subCd ? 'rgba(0,0,0,0.55)' : subCol + '33';
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.fill();
      if (subCd) {
        // progression du cooldown directement sur le badge
        ctx.strokeStyle = subCol; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.shadowColor = subCol; ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(bx, by, 7.5, -Math.PI / 2, -Math.PI / 2 + TAU * subFracB);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = subCd ? subCol : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.stroke();
      if (subCd) {
        engraved(String(Math.ceil(s.cd2)), bx, by + 3, 8.5, subCol, 'center', 'Consolas, monospace');
      } else {
        engraved(s.sub, bx, by + 3.5, 10, subCol, 'center', 'Consolas, monospace');
      }
    }

    // textes d'état : cooldown / verrou / utilisé
    if (locked) {
      ctx.fillStyle = 'rgba(8,5,2,0.6)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      engraved(`⏳${p.switchLock.toFixed(1)}`, cx, cy + 4, 11, '#ffd740', 'center', 'Consolas, monospace');
    } else if (s.cd > 0) {
      engraved(s.cd.toFixed(1), cx, cy + 4, 13, '#ffb3a6', 'center', 'Consolas, monospace');
    } else if (s.used) {
      ctx.fillStyle = 'rgba(8,5,2,0.55)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      engraved('✓', cx, cy + 4, 14, '#81c784', 'center', 'Consolas, monospace');
    }
  });
}

// ---------- panneau arme active (parchemin compact en bas à gauche) ----------
// % de puissance totale de l'arme (artefacts × niveau) + dégâts bruts au-dessus
export function drawWeaponPanel() {
  const p = G.player;
  const titan = p.ultActive > 0;
  const key = modeKey(p.attackMode);
  const st = titan ? { name: 'Titan de Feu', col: '#ff8a50' }
    : MODE_STYLE[p.attackMode === 5 ? 'bow' : p.attackMode === 3 ? 'lance' : p.attackMode === 7 ? 'judgment' : 'sword'];
  const wMult = G.equip ? G.equip.weaponMult : 1;
  const mMult = titan ? 1 : modeMult(G.inv, key);
  // dégâts totaux infligés par cette arme pendant la partie (runWmode accumulé par damageEnemy)
  const dmgTot = Math.round((G.runWmode && G.runWmode[key]) || 0);
  const dmgPct = Math.round((wMult * mMult - 1) * 100);
  const mi = titan ? { lvl: 1 } : modeInfo(G.inv, key);

  const pw = 196, ph = 56, px = 14, py = H - 100;
  // dégâts totaux : petit compteur juste au-dessus du panneau arme
  crisp(`⚔ ${dmgTot}`, px + pw / 2, py - 8, 11, '#ffd740', 'center', { weight: 700, spacing: 0.5 });
  parchment(px, py, pw, ph, 0.9);
  ctx.strokeStyle = HPAL.goldLo; ctx.lineWidth = 1;
  roundRect(px + 3, py + 3, pw - 6, ph - 6, 6); ctx.stroke();

  gem(px + 24, py + ph / 2, 8, st.col, 1.2);
  crisp((titan ? 'TITAN DE FEU' : st.name).toUpperCase(), px + 42, py + 22, 14, '#33240f', 'left', { font: HUD_CINZEL, weight: 700, spacing: 0.8 });
  crisp(titan ? 'PUISSANCE INFERNALE' : `NIV ${mi.lvl} · +${dmgPct} %`, px + 42, py + 43, 11, '#5a4526', 'left', { weight: 700, spacing: 0.6 });
}
