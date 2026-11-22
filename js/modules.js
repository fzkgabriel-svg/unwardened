// ---------- MODULES : personnalisation du héros (débloqué après le boss du monde 4) ----------
// 12 modules : 2 offerts (bouclier, ruée) + 10 achetables à la boutique en émeraudes.
// Équipement : 1 actif + 1 passif (slot passif débloqué pour 500 ◆). Persisté dans inv.modules via saveInv.
import { G, ctx, TAU, H } from './state.js';
import { roundRect, hexA } from './utils.js';
import { saveInv } from './inventory.js';
import { spawnParticles, addDamageText } from './effects.js';
import { damageEnemy } from './enemies.js';
import { worldW, worldH } from './world.js';
import { sfxPickup } from './audio.js';

// id → définition. type: 'actif'|'passif' · price: émeraudes (0 = offert)
export const MODULES = {
  bouclier:    { name: 'Bouclier énergétique', type: 'passif', rar: 'Épique',      col: '#4fc3f7', icon: '🛡', price: 0,   cd: 0,
    desc: 'Barre de bouclier qui absorbe les dégâts avant les PV. Se régénère après 4 s sans dégâts.' },
  ruee:        { name: 'Ruée dimensionnelle',  type: 'actif',  rar: 'Épique',      col: '#18ffff', icon: '➤', price: 0,   cd: 8,
    desc: 'Dash foudroyant vers l\'avant avec traînée d\'énergie. Recharge 8 s.' },
  surcharge:   { name: 'Surcharge',            type: 'actif',  rar: 'Rare',        col: '#ff5252', icon: '⚡', price: 160, cd: 14,
    desc: '+50 % de dégâts pendant 6 s. Recharge 14 s.' },
  regeneration:{ name: 'Régénération',         type: 'passif', rar: 'Commun',      col: '#69f0ae', icon: '✚', price: 120, cd: 0,
    desc: 'Restaure 4 PV par seconde en permanence.' },
  onde:        { name: 'Onde de choc',         type: 'actif',  rar: 'Rare',        col: '#ffab40', icon: '◎', price: 180, cd: 15,
    desc: 'Explosion d\'énergie : 50 + 4×niv dégâts dans un rayon de 230 px. Recharge 15 s.' },
  instinct:    { name: 'Instinct du chasseur', type: 'passif', rar: 'Rare',        col: '#ffd740', icon: '🎯', price: 200, cd: 0,
    desc: '+12 % de chance de coup critique (dégâts ×1,75).' },
  distorsion:  { name: 'Distorsion temporelle',type: 'actif',  rar: 'Épique',      col: '#ce93d8', icon: '◷', price: 260, cd: 18,
    desc: 'Ralentit de 45 % tous les ennemis à moins de 270 px pendant 4 s. Recharge 18 s.' },
  absorption:  { name: 'Absorption',           type: 'passif', rar: 'Rare',        col: '#ff8a65', icon: '❖', price: 220, cd: 0,
    desc: '8 % des dégâts infligés sont convertis en PV.' },
  orbitale:    { name: 'Frappe orbitale',      type: 'actif',  rar: 'Légendaire',  col: '#82b1ff', icon: '☄', price: 400, cd: 12,
    desc: 'Frappe énergétique sur l\'ennemi le plus proche : 130 + 8×niv dégâts. Recharge 12 s.' },
  resistance:  { name: 'Résistance',           type: 'passif', rar: 'Commun',      col: '#90a4ae', icon: '▣', price: 100, cd: 0,
    desc: 'Réduit de 12 % tous les dégâts subis.' },
  impulsion:   { name: 'Impulsion',            type: 'actif',  rar: 'Rare',        col: '#40c4ff', icon: '≫', price: 170, cd: 14,
    desc: '+60 % de vitesse de déplacement pendant 4 s. Recharge 14 s.' },
  rempart:     { name: 'Dernier rempart',      type: 'passif', rar: 'Épique',      col: '#ffd54f', icon: '◆', price: 300, cd: 0,
    desc: 'Quand les PV passent sous 30 %, gagne un bouclier de 60 pendant 6 s (recharge 30 s).' },
};
export const MOD_IDS = Object.keys(MODULES);

// ---------- ÉTAT (persisté dans inv.modules) ----------
export function modulesUnlocked() { return !!(G.stats && G.stats.campaignDone && G.stats.campaignDone[3]); }
export function modState(inv) {
  inv.modules = inv.modules || { owned: [], eq: { act: null, pass: null }, passUnlocked: false };
  const m = inv.modules;
  m.eq = m.eq || {};
  // migration : ancien slot unique {mod} -> actif ou passif selon le type
  if (m.eq.mod !== undefined) {
    const old = m.eq.mod;
    m.eq.act = old && MODULES[old] && MODULES[old].type === 'actif' ? old : null;
    m.eq.pass = old && m.eq.act !== old ? old : null;
    delete m.eq.mod;
  }
  // migration : ancien format 3 slots {act,p1,p2} -> {act,pass}
  if (m.eq.p1 !== undefined || m.eq.p2 !== undefined) {
    m.eq.pass = m.eq.pass || m.eq.p1 || m.eq.p2 || null;
    delete m.eq.p1; delete m.eq.p2;
  }
  if (m.eq.act === undefined) m.eq.act = null;
  if (m.eq.pass === undefined) m.eq.pass = null;
  if (m.passUnlocked === undefined) m.passUnlocked = false;
  // sanitisation : chaque slot n'accepte que son type — un module d'un
  // mauvais type est déplacé vers l'autre slot s'il est libre, sinon retiré
  const sanitize = (slot, want, other) => {
    const id = m.eq[slot];
    if (!id) return;
    if (!MODULES[id]) { m.eq[slot] = null; return; }
    if (MODULES[id].type === want) return;
    const altType = want === 'actif' ? 'passif' : 'actif';
    if (m.eq[other] == null && MODULES[id].type === altType) m.eq[other] = id;
    m.eq[slot] = null;
  };
  sanitize('act', 'actif', 'pass');
  sanitize('pass', 'passif', 'act');
  return m;
}
// débloque l'emplacement passif pour 500 émeraudes (achat unique)
export const PASS_SLOT_PRICE = 500;
export function unlockPassSlot(inv) {
  const ms = modState(inv);
  if (ms.passUnlocked) return { ok: false, msg: 'Emplacement déjà débloqué' };
  if ((inv.mats.emeraude || 0) < PASS_SLOT_PRICE) return { ok: false, msg: `Il faut ${PASS_SLOT_PRICE} émeraudes` };
  inv.mats.emeraude -= PASS_SLOT_PRICE;
  ms.passUnlocked = true;
  saveInv(inv);
  return { ok: true, msg: 'Emplacement PASSIF débloqué !' };
}
// appelé à chaque frame/menu : débloque et offre les 2 modules après le boss du monde 4
export function ensureModules() {
  const inv = G.inv; if (!inv) return;
  const ms = modState(inv);
  if (modulesUnlocked()) {
    let granted = false;
    for (const id of ['bouclier', 'ruee']) if (!ms.owned.includes(id)) { ms.owned.push(id); granted = true; }
    if (granted) {
      saveInv(inv);
      G.warnToast = { name: '⚡ MODULES DÉBLOQUÉS : Bouclier énergétique + Ruée dimensionnelle offerts ! (menu Modules)', t: 7 };
    }
  }
}
export function ownModule(inv, id) {
  const ms = modState(inv);
  if (ms.owned.includes(id)) return false;
  ms.owned.push(id); saveInv(inv); return true;
}
export function equippedMods() {
  const inv = G.inv; if (!inv) return [];
  const eq = modState(inv).eq;
  return [eq.act, eq.pass].filter(Boolean).map(id => MODULES[id]).filter(Boolean);
}
export function eqActive() { const inv = G.inv; return inv ? modState(inv).eq.act : null; }
export function hasMod(id) { const inv = G.inv; return inv ? modState(inv).owned.includes(id) : false; }

// ---------- STATS PASSIFS ÉQUIPÉS ----------
function has(id) { return equippedMods().some(m => m && MODULES[id] === m); }
export function modDmgMult() {
  const b = G.modBuffs || {};
  return (b.surcharge > 0 ? 1.5 : 1) * (b.ultBuff > 0 ? 1.2 : 1);
}
export function modDmgReduce() { return has('resistance') ? 0.12 : 0; }
export function modCritBonus() { return has('instinct') ? 0.12 : 0; }
export function modLifesteal() { return has('absorption') ? 0.08 : 0; }
export function modRegen() { return has('regeneration') ? 4 : 0; }
export function modShieldMax() { return has('bouclier') ? 70 : 0; }
export function modShieldRegen() { return has('bouclier') ? 3 : 0; }
export function modSpeedMult() { const b = G.modBuffs || {}; return b.impulsion > 0 ? 1.6 : 1; }

// ---------- ACTIVATION (touche X) ----------
export function activateModule() {
  const inv = G.inv, p = G.player;
  if (!inv || !p || !p.alive || G.state !== 'playing') return false;
  const id = eqActive();
  if (!id) return false;
  const m = MODULES[id];
  if (!m || m.type !== 'actif') return false;
  const cds = G.modCds = G.modCds || {};
  if ((cds[id] || 0) > G.time) return false; // en recharge
  cds[id] = G.time + m.cd;
  const lvl = p.level || 1;
  switch (id) {
    case 'ruee': {
      // dash vers la dernière direction de déplacement (ou vers la droite)
      const dx = p.lastDx !== undefined ? p.lastDx : 1, dy = p.lastDy !== undefined ? p.lastDy : 0;
      p.dashT = 0.24; p.dashDx = dx; p.dashDy = dy;
      spawnParticles(p.x, p.y, m.col, 14, 5);
      break;
    }
    case 'surcharge':
      G.modBuffs = G.modBuffs || {}; G.modBuffs.surcharge = 6;
      addDamageText(p.x, p.y - 34, 'SURCHARGE !', m.col);
      spawnParticles(p.x, p.y, m.col, 20, 6);
      break;
    case 'onde': {
      const dmg = 50 + lvl * 4, R = 230;
      G.rings.push({ x: p.x, y: p.y, r: 20, maxR: R, life: 30, maxLife: 30, color: m.col });
      spawnParticles(p.x, p.y, m.col, 40, 8);
      G.screenShake = Math.max(G.screenShake, 8);
      for (const e of [...G.enemies]) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < R + e.r) damageEnemy(e, dmg, Math.atan2(e.y - p.y, e.x - p.x));
      }
      break;
    }
    case 'distorsion': {
      let n = 0;
      for (const e of G.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 270 + e.r) { e.timeSlow = 4; n++; }
      }
      addDamageText(p.x, p.y - 34, `DISTORSION ×${n}`, m.col);
      G.rings.push({ x: p.x, y: p.y, r: 30, maxR: 270, life: 36, maxLife: 36, color: m.col });
      break;
    }
    case 'orbitale': {
      // cible : ennemi le plus proche
      let best = null, bd = Infinity;
      for (const e of G.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const dmg = 130 + lvl * 8;
        G.modStrike = { t: 0.45, x: best.x, y: best.y, e: best, dmg };
        spawnParticles(best.x, best.y, m.col, 16, 5);
      } else addDamageText(p.x, p.y - 34, 'AUCUNE CIBLE', '#90a4ae');
      break;
    }
    case 'impulsion':
      G.modBuffs = G.modBuffs || {}; G.modBuffs.impulsion = 4;
      addDamageText(p.x, p.y - 34, 'IMPULSION !', m.col);
      spawnParticles(p.x, p.y, m.col, 22, 6);
      break;
  }
  sfxPickup();
  return true;
}
export function moduleCooldownLeft(id) {
  const cds = G.modCds || {};
  return Math.max(0, (cds[id] || 0) - G.time);
}

// ---------- UPDATE PAR FRAME (appelé depuis main.js) ----------
export function updateModules(dt) {
  const inv = G.inv, p = G.player;
  if (!inv || !p) return;
  ensureModules();
  const buffs = G.modBuffs = G.modBuffs || {};
  for (const k in buffs) if (buffs[k] > 0) buffs[k] = Math.max(0, buffs[k] - dt);
  // dash : déplacement rapide + traînée
  if (p.dashT > 0) {
    p.dashT = Math.max(0, p.dashT - dt);
    const sp = p.speed * 3.4;
    p.x = Math.max(p.r, Math.min(G.world ? worldWSafe() - p.r : p.x + sp * dt, p.x + p.dashDx * sp * dt));
    p.y = Math.max(p.r, Math.min(worldHSafe() - p.r, p.y + p.dashDy * sp * dt));
    spawnParticles(p.x, p.y, '#18ffff', 2, 2.5);
    if (Math.random() < 0.4) G.rings.push({ x: p.x, y: p.y, r: 6, maxR: 26, life: 14, maxLife: 14, color: 'rgba(24,255,255,0.5)' });
  }
  // frappe orbitale retardée
  if (G.modStrike) {
    const s = G.modStrike; s.t -= dt;
    if (s.t <= 0) {
      G.modStrike = null;
      if (s.e && s.e.hp > 0) {
        damageEnemy(s.e, s.dmg, Math.atan2(s.e.y - p.y, s.e.x - p.x));
        G.rings.push({ x: s.x, y: s.y, r: 8, maxR: 90, life: 22, maxLife: 22, color: '#82b1ff' });
        spawnParticles(s.x, s.y, '#82b1ff', 30, 7);
        G.screenShake = Math.max(G.screenShake, 6);
      }
    }
  }
  // régénération du module (en plus de la regen de base)
  const regen = modRegen();
  if (regen > 0 && p.alive && p.hp > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + regen * dt);
  }
  // bouclier énergétique : absorbe les dégâts, se régénère hors combat
  const sMax = modShieldMax();
  if (sMax > 0) {
    p.modShield = Math.min(sMax, (p.modShield || 0) + (G.time - (p.lastHurt || 0) > 4 ? modShieldRegen() * dt : 0));
  } else p.modShield = 0;
  // dernier rempart : bouclier d'urgence sous 30 % de PV
  if (has('rempart') && p.alive && p.hp > 0 && p.hp < p.maxHp * 0.3) {
    const cds = G.modCds = G.modCds || {};
    if (!(cds._rempart > G.time)) {
      cds._rempart = G.time + 30;
      p.modShield = Math.max(p.modShield || 0, 60);
      addDamageText(p.x, p.y - 44, 'DERNIER REMPART !', '#ffd54f');
      spawnParticles(p.x, p.y, '#ffd54f', 26, 6);
      G.rings.push({ x: p.x, y: p.y, r: 10, maxR: 120, life: 26, maxLife: 26, color: '#ffd54f' });
    }
  }
}
function worldWSafe() { try { return worldW(); } catch (e) { return 99999; } }
function worldHSafe() { try { return worldH(); } catch (e) { return 99999; } }

// absorption des dégâts : retourne les dégâts restants après bouclier + résistance
export function moduleAbsorb(dmg) {
  const p = G.player;
  let d = dmg * (1 - modDmgReduce());
  const shield = p.modShield || 0;
  if (shield > 0) {
    const absorbed = Math.min(shield, d);
    p.modShield = shield - absorbed;
    d -= absorbed;
    if (absorbed > 0) addDamageText(p.x, p.y - 30, `🛡 -${Math.round(absorbed)}`, '#4fc3f7');
    spawnParticles(p.x, p.y, '#4fc3f7', 5, 3);
  }
  return d;
}

// ---------- DESSIN ----------
export function drawModuleIcon(id, x, y, s = 1) {
  const m = MODULES[id]; if (!m) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.shadowColor = m.col; ctx.shadowBlur = 12;
  ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(m.icon, 0, 1);
  ctx.restore();
}

// icône HUD du module actif + cooldown (coin haut-gauche, sous le profil)
export function drawModuleHUD() {
  const inv = G.inv; if (!inv || G.state !== 'playing') return;
  const id = eqActive();
  const x = 16, y = H * 0.5 - 30;
  ctx.save();
  if (id) {
    const m = MODULES[id];
    const cdLeft = moduleCooldownLeft(id);
    const cdMax = m.cd || 1;
    const ready = cdLeft <= 0;
    // cadre
    ctx.fillStyle = 'rgba(8,12,20,0.8)';
    roundRect(x, y, 52, 52, 10); ctx.fill();
    ctx.strokeStyle = ready ? hexA(m.col, 0.8) : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5; roundRect(x, y, 52, 52, 10); ctx.stroke();
    drawModuleIcon(id, x + 26, y + 20, 0.85);
    ctx.font = 'bold 10px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = ready ? m.col : '#6f7378';
    ctx.fillText(ready ? 'X' : `${Math.ceil(cdLeft)}`, x + 26, y + 45);
    // barre de recharge circulaire (arc)
    if (!ready) {
      const k = 1 - cdLeft / cdMax;
      ctx.strokeStyle = hexA(m.col, 0.9); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + 26, y + 20, 24, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke();
    }
    // barre de bouclier sous l'icône si module bouclier équipé
    const p = G.player;
    if (p && (p.modShield || 0) > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 6, y + 56, 40, 5);
      ctx.fillStyle = '#4fc3f7'; ctx.fillRect(x + 6, y + 56, 40 * Math.min(1, p.modShield / modShieldMax()), 5);
    }
  } else {
    // aucun module actif : slot vide discret
    ctx.fillStyle = 'rgba(8,12,20,0.5)';
    roundRect(x, y, 52, 52, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    roundRect(x, y, 52, 52, 10); ctx.stroke();
    ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('◇', x + 26, y + 22);
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('X', x + 26, y + 44);
  }
  ctx.restore();
}
