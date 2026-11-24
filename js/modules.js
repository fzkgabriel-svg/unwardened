// ---------- MODULES : personnalisation du héros (débloqué après le boss du monde 4) ----------
// 12 modules : 2 offerts (bouclier, ruée) + 10 achetables à la boutique en émeraudes.
// Équipement : 1 actif + 1 passif (slot passif débloqué pour 500 ◆). Persisté dans inv.modules via saveInv.
import { G, ctx, TAU, H } from './state.js';
import { roundRect, hexA } from './utils.js';
import { saveInv, MATS } from './inventory.js';
import { spawnParticles, addDamageText } from './effects.js';
import { damageEnemy } from './enemies.js';
import { worldW, worldH } from './world.js';
import { sfxPickup } from './audio.js';

// id → définition. type: 'actif'|'passif' · price: émeraudes (0 = offert)
export const MODULES = {
  bouclier:    { name: 'Bouclier énergétique', type: 'passif', rar: 'Épique',      col: '#4fc3f7', icon: '🛡', price: 0,   cd: 0,
    desc: 'Barre de bouclier qui absorbe les dégâts avant les PV. 2-5 % des dégâts absorbés reconstituent le bouclier (max 75 %). Se régénère après 4 s sans dégâts.' },
  ruee:        { name: 'Ruée dimensionnelle',  type: 'actif',  rar: 'Épique',      col: '#18ffff', icon: '➤', price: 0,   cd: 14,
    desc: 'Dash foudroyant vers l\'avant avec traînée d\'énergie. Recharge 8 s.' },
  surcharge:   { name: 'Surcharge',            type: 'actif',  rar: 'Rare',        col: '#ff5252', icon: '⚡', price: 260, cd: 14,
    desc: '+50 % de dégâts pendant 6 s. Recharge 14 s.' },
  regeneration:{ name: 'Régénération',         type: 'passif', rar: 'Commun',      col: '#69f0ae', icon: '✚', price: 190, cd: 0,
    desc: 'Restaure 4 PV par seconde en permanence.' },
  onde:        { name: 'Onde de choc',         type: 'actif',  rar: 'Rare',        col: '#ffab40', icon: '◎', price: 290, cd: 15,
    desc: 'Explosion d\'énergie : 50 + 4×niv dégâts dans un rayon de 230 px. Recharge 15 s.' },
  instinct:    { name: 'Instinct du chasseur', type: 'passif', rar: 'Rare',        col: '#ffd740', icon: '🎯', price: 320, cd: 0,
    desc: '+12 % de chance de coup critique (dégâts ×1,75).' },
  distorsion:  { name: 'Distorsion temporelle',type: 'actif',  rar: 'Épique',      col: '#ce93d8', icon: '◷', price: 420, cd: 18,
    desc: 'Ralentit de 45 % tous les ennemis à moins de 270 px pendant 4 s. Recharge 18 s.' },
  absorption:  { name: 'Absorption',           type: 'passif', rar: 'Rare',        col: '#ff8a65', icon: '❖', price: 350, cd: 0,
    desc: '8 % des dégâts infligés sont convertis en PV.' },
  orbitale:    { name: 'Frappe orbitale',      type: 'actif',  rar: 'Légendaire',  col: '#82b1ff', icon: '☄', price: 640, cd: 12,
    desc: 'Frappe énergétique sur l\'ennemi le plus proche : 130 + 8×niv dégâts. Recharge 12 s.' },
  resistance:  { name: 'Résistance',           type: 'passif', rar: 'Commun',      col: '#90a4ae', icon: '▣', price: 160, cd: 0,
    desc: 'Réduit de 12 % tous les dégâts subis.' },
  impulsion:   { name: 'Impulsion',            type: 'actif',  rar: 'Rare',        col: '#40c4ff', icon: '≫', price: 270, cd: 14,
    desc: '+60 % de vitesse de déplacement pendant 4 s. Recharge 14 s.' },
  rempart:     { name: 'Dernier rempart',      type: 'passif', rar: 'Épique',      col: '#ffd54f', icon: '◆', price: 480, cd: 0,
    desc: 'Quand les PV passent sous 30 %, gagne un bouclier de 60 pendant 6 s (recharge 30 s).' },
  rage:        { name: 'Fureur du berserk',    type: 'passif', rar: 'Épique',      col: '#ff1744', icon: '♛', price: 510, cd: 0,
    desc: 'Sous 50 % de PV, +20 % de dégâts infligés (nourrit la rage du combat).' },
  carapace:    { name: 'Carapace abyssale',    type: 'passif', rar: 'Épique',      col: '#7c4dff', icon: '⬢', price: 450, cd: 0,
    desc: 'Réduit de 8 % tous les dégâts subis. Se cumule avec la Résistance.' },
  supernova:   { name: 'Supernova',            type: 'actif',  rar: 'Légendaire',  col: '#ffea00', icon: '✺', price: 770, cd: 22,
    desc: 'Implosion stellaire : attire tous les ennemis à moins de 480 px et inflige 160 + 10×niv dégâts. Recharge 22 s.' },
  meteorite:   { name: 'Pluie de météores',    type: 'actif',  rar: 'Légendaire',  col: '#ff6e40', icon: '☄', price: 830, cd: 26,
    desc: 'Fait tomber 6 météores sur les ennemis : 70 + 6×niv dégâts chacun. Recharge 26 s.' },
};
export const MOD_IDS = Object.keys(MODULES);

// ---------- ÉTAT (persisté dans inv.modules) ----------
export function modulesUnlocked() { return !!(G.stats && G.stats.campaignDone && G.stats.campaignDone[3]); }
export function modState(inv) {
  inv.modules = inv.modules || { owned: [], eq: { act: null, pass: null }, passUnlocked: false };
  const m = inv.modules;
  m.eq = m.eq || {};
  if (m.eq.pass2 === undefined) m.eq.pass2 = null;
  if (m.pass2Unlocked === undefined) m.pass2Unlocked = false;
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
  if (m.levels === undefined) m.levels = {}; // niveaux de module 1→3
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
  // pass2 : même type 'passif' ; si verrouillé, on vide le slot
  {
    const id = m.eq.pass2;
    if (id) {
      if (!pass2Unlocked(inv) || !MODULES[id]) m.eq.pass2 = null;
      else if (MODULES[id].type !== 'passif') {
        if (m.eq.act == null) m.eq.act = id; else if (m.eq.pass == null) m.eq.pass = id;
        m.eq.pass2 = null;
      }
    }
  }
  return m;
}
// le 2ᵉ emplacement passif se débloque en vainquant le Souverain des Ouragans.
// NB : ne PAS appeler modState() ici — modState() itself appelle pass2Unlocked
// pendant sa sanitisation (récursion infinie sinon).
export function pass2Unlocked(inv) {
  const raw = inv && inv.modules;
  return !!((raw && raw.pass2Unlocked) || (G.stats && G.stats.campaignDone && G.stats.campaignDone[5]));
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
// récompense du Souverain des Ouragans : 2ᵉ emplacement passif permanent
export function grantPass2() {
  const inv = G.inv; if (!inv) return false;
  const ms = modState(inv);
  if (ms.pass2Unlocked) return false;
  ms.pass2Unlocked = true;
  saveInv(inv);
  G.warnToast = { name: '🌪 RÉCOMPENSE : 2ᵉ EMPLACEMENT PASSIF débloqué ! (menu Modules)', t: 9 };
  return true;
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
  return [eq.act, eq.pass, eq.pass2].filter(Boolean).map(id => MODULES[id]).filter(Boolean);
}
export function eqActive() { const inv = G.inv; return inv ? modState(inv).eq.act : null; }
export function hasMod(id) { const inv = G.inv; return inv ? modState(inv).owned.includes(id) : false; }

// ---------- NIVEAUX DE MODULE (1 → 3, améliorés avec émeraudes + cristaux) ----------
export function modLevel(id) {
  const inv = G.inv; if (!inv) return 1;
  const lv = (modState(inv).levels || {})[id];
  return Math.min(3, Math.max(1, lv || 1));
}
// coût pour passer au niveau suivant : niv2 = 120◆+4 cristaux, niv3 = 300◆+10 cristaux
export function modUpgradeCost(id) {
  const l = modLevel(id);
  if (l >= 3) return null;
  return l === 1 ? { emeraude: 120, cristal: 4 } : { emeraude: 300, cristal: 10 };
}
export function upgradeModule(id) {
  const inv = G.inv;
  if (!inv || !MODULES[id]) return { ok: false, msg: 'Module introuvable' };
  const ms = modState(inv);
  if (!ms.owned.includes(id)) return { ok: false, msg: 'Module non possédé' };
  ms.levels = ms.levels || {};
  const l = ms.levels[id] || 1;
  if (l >= 3) return { ok: false, msg: 'Niveau maximum atteint' };
  const cost = modUpgradeCost(id);
  inv.mats = inv.mats || {};
  for (const k in cost) {
    if ((inv.mats[k] || 0) < cost[k]) {
      const names = Object.keys(cost).map(k2 => `${cost[k2]} ${MATS[k2] ? MATS[k2].name : k2}`).join(' + ');
      return { ok: false, msg: `Matériaux insuffisants — ${names} requis` };
    }
  }
  for (const k in cost) inv.mats[k] -= cost[k];
  ms.levels[id] = l + 1;
  saveInv(inv);
  return { ok: true, msg: `${MODULES[id].name} → niveau ${l + 1} !` };
}

// ---------- STATS PASSIFS ÉQUIPÉS ----------
function has(id) { return equippedMods().some(m => m && MODULES[id] === m); }
// niveau d'un module (1→3) pour la montée en puissance des améliorations
function mlvl(id) { return modLevel(id); }
export function modDmgMult() {
  const b = G.modBuffs || {};
  const p = G.player;
  const berserk = has('rage') && p && p.alive && p.hp > 0 && p.hp < p.maxHp * 0.5 ? 1.2 + 0.05 * (mlvl('rage') - 1) : 1;
  return (b.surcharge > 0 ? 1.5 + 0.15 * (mlvl('surcharge') - 1) : 1) * (b.ultBuff > 0 ? 1.2 : 1) * berserk;
}
export function modDmgReduce() { return (has('resistance') ? 0.12 + 0.04 * (mlvl('resistance') - 1) : 0) + (has('carapace') ? 0.08 + 0.02 * (mlvl('carapace') - 1) : 0); }
export function modCritBonus() { return has('instinct') ? 0.12 + 0.05 * (mlvl('instinct') - 1) : 0; }
export function modLifesteal() { return has('absorption') ? 0.08 + 0.02 * (mlvl('absorption') - 1) : 0; }
export function modRegen() { return has('regeneration') ? 4 + 2 * (mlvl('regeneration') - 1) : 0; }
export function modShieldMax() { return has('bouclier') ? 70 + 40 * (mlvl('bouclier') - 1) : 0; }
export function modShieldRegen() { return has('bouclier') ? 3 + 1.5 * (mlvl('bouclier') - 1) : 0; }
// conversion dégâts absorbés -> PV de bouclier : 2 % (niv1) -> 5 % (niv3)
export function modShieldGain() { return has('bouclier') ? 0.02 + 0.015 * (mlvl('bouclier') - 1) : 0; }
export function modSpeedMult() { const b = G.modBuffs || {}; return b.impulsion > 0 ? 1.6 + 0.15 * (mlvl('impulsion') - 1) : 1; }

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
  const ml = modLevel(id); // niveau du module : améliore effets ET réduit le cooldown
  cds[id] = G.time + m.cd * (1 - 0.07 * (ml - 1));
  const lvl = p.level || 1;
  switch (id) {
    case 'ruee': {
      // vrai dash : impulsion unique ~560 px en 0,3 s (ease-out), +15 %/niv
      let dx = p.lastDx !== undefined ? p.lastDx : 1, dy = p.lastDy !== undefined ? p.lastDy : 0;
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      p.dashT = 0; p.dashDur = 0.3;
      p.dashX0 = p.x; p.dashY0 = p.y;
      p.dashDist = Math.round(560 * (1 + 0.15 * (ml - 1))); p.dashDx = dx; p.dashDy = dy;
      spawnParticles(p.x, p.y, m.col, 18, 6);
      G.rings.push({ x: p.x, y: p.y, r: 10, maxR: 60, life: 16, maxLife: 16, color: m.col });
      G.screenShake = Math.max(G.screenShake, 3);
      break;
    }
    case 'surcharge':
      G.modBuffs = G.modBuffs || {}; G.modBuffs.surcharge = 6;
      addDamageText(p.x, p.y - 34, 'SURCHARGE !', m.col);
      spawnParticles(p.x, p.y, m.col, 20, 6);
      break;
    case 'onde': {
      const dmg = (50 + lvl * 4) * (1 + 0.2 * (ml - 1)), R = 230 * (1 + 0.1 * (ml - 1));
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
        if (Math.hypot(e.x - p.x, e.y - p.y) < 270 + e.r) { e.timeSlow = 4 + 0.5 * (ml - 1); n++; }
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
        const dmg = (130 + lvl * 8) * (1 + 0.25 * (ml - 1));
        G.modStrike = { t: 0.45, x: best.x, y: best.y, e: best, dmg };
        spawnParticles(best.x, best.y, m.col, 16, 5);
      } else addDamageText(p.x, p.y - 34, 'AUCUNE CIBLE', '#90a4ae');
      break;
    }
    case 'impulsion':
      G.modBuffs = G.modBuffs || {}; G.modBuffs.impulsion = 4 + 0.5 * (ml - 1);
      addDamageText(p.x, p.y - 34, 'IMPULSION !', m.col);
      spawnParticles(p.x, p.y, m.col, 22, 6);
      break;
    case 'supernova': {
      // implosion : attire puis déchire tout ce qui est proche
      const R = 480 * (1 + 0.08 * (ml - 1));
      const dmg = (160 + lvl * 10) * (1 + 0.25 * (ml - 1));
      for (const e of [...G.enemies]) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < R + e.r) {
          const pull = Math.min(d, 260) * 0.85;
          if (d > 1) { e.x -= ((e.x - p.x) / d) * pull; e.y -= ((e.y - p.y) / d) * pull; }
          damageEnemy(e, dmg, Math.atan2(e.y - p.y, e.x - p.x));
        }
      }
      G.rings.push({ x: p.x, y: p.y, r: 20, maxR: R, life: 40, maxLife: 40, color: m.col });
      spawnParticles(p.x, p.y, '#fff59d', 50, 9);
      spawnParticles(p.x, p.y, m.col, 30, 7);
      G.screenShake = Math.max(G.screenShake, 14);
      addDamageText(p.x, p.y - 60, 'SUPERNOVA !', m.col);
      break;
    }
    case 'meteorite': {
      const dmg = (70 + lvl * 6) * (1 + 0.2 * (ml - 1));
      // 6 cibles : ennemis les plus proches d'abord, sinon aléatoires autour du joueur
      const targets = [...G.enemies]
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
        .slice(0, 6);
      for (const e of targets) {
        G.rings.push({ x: e.x, y: e.y, r: 8, maxR: 70, life: 26, maxLife: 26, color: '#ff6e40' });
        spawnParticles(e.x, e.y, '#ffab40', 20, 7);
        damageEnemy(e, dmg, Math.atan2(e.y - p.y, e.x - p.x));
      }
      if (targets.length) G.screenShake = Math.max(G.screenShake, 9);
      else addDamageText(p.x, p.y - 34, 'AUCUNE CIBLE', '#90a4ae');
      break;
    }
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
  // ruée dimensionnelle : dash directionnel — distance fixe, ease-out brutal
  if (p.dashDur > 0) {
    p.dashT += dt;
    const k = Math.min(1, p.dashT / p.dashDur);
    const e = 1 - Math.pow(1 - k, 3); // décélération franche : départ fulgurant, arrêt net
    const nx = p.dashX0 + p.dashDx * p.dashDist * e;
    const ny = p.dashY0 + p.dashDy * p.dashDist * e;
    const wx = G.world ? worldWSafe() - p.r : nx, wy = G.world ? worldHSafe() - p.r : ny;
    p.x = Math.max(p.r, Math.min(wx, nx));
    p.y = Math.max(p.r, Math.min(wy, ny));
    // traînée spectrale : afterimages cyan + étincelles
    spawnParticles(p.x, p.y, '#18ffff', 3, 3);
    if (Math.random() < 0.5) spawnParticles(p.x - p.dashDx * 14, p.y - p.dashDy * 14, '#7b2ff7', 1, 1.5);
    if (k >= 1) {
      p.dashDur = 0;
      spawnParticles(p.x, p.y, '#18ffff', 22, 7);
      spawnParticles(p.x, p.y, '#e040fb', 10, 4);
      G.rings.push({ x: p.x, y: p.y, r: 8, maxR: 70, life: 18, maxLife: 18, color: 'rgba(24,255,255,0.7)' });
    }
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
      const rl = modLevel('rempart');
      cds._rempart = G.time + (30 - 4 * (rl - 1));
      p.modShield = Math.max(p.modShield || 0, 60 + 40 * (rl - 1));
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
    if (absorbed > 0) {
      addDamageText(p.x, p.y - 30, `🛡 -${Math.round(absorbed)}`, '#4fc3f7');
      spawnParticles(p.x, p.y, '#4fc3f7', 5, 3);
      // conversion : 2→5 % des dégâts absorbés refont des PV de bouclier (plafond 75 % du max)
      const gainRate = modShieldGain();
      if (gainRate > 0) {
        const cap = modShieldMax() * 0.75;
        const before = p.modShield || 0;
        p.modShield = Math.min(cap, before + absorbed * gainRate);
        const gained = p.modShield - before;
        if (gained >= 1) addDamageText(p.x, p.y - 48, `+${Math.round(gained)} 🛡`, '#69f0ae');
      }
    }
  }
  return d;
}

// ---------- DESSIN ----------
// Médaillon de relique : anneau métallique par rareté + glyphe magique propre
// à chaque module (traits argentés/or sur disque sombre — style grimorio).
const RAR_METAL = { 'Commun': '#a5854f', 'Rare': '#b9c8d9', 'Épique': '#9a7bd0', 'Légendaire': '#e8c05a' };
const RAR_GLOW = { 'Commun': 'rgba(165,133,79,0.35)', 'Rare': 'rgba(185,200,217,0.4)', 'Épique': 'rgba(154,123,208,0.45)', 'Légendaire': 'rgba(232,192,90,0.5)' };

// glyphe magique du module, dessiné dans une boîte ~±13 autour de l'origine
function drawModGlyph(id, col) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  switch (id) {
    case 'bouclier': // bouclier heaters + rune centrale
      ctx.moveTo(0, -12); ctx.quadraticCurveTo(9, -9, 10, -2); ctx.lineTo(10, 3);
      ctx.quadraticCurveTo(10, 9, 0, 13); ctx.quadraticCurveTo(-10, 9, -10, 3); ctx.lineTo(-10, -2);
      ctx.quadraticCurveTo(-9, -9, 0, -12); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 8); ctx.moveTo(-4, -2); ctx.lineTo(4, -2); ctx.stroke();
      break;
    case 'ruee': // aile de ruée + traînées de vitesse
      ctx.moveTo(-11, 6); ctx.quadraticCurveTo(-4, -2, 3, -9); ctx.quadraticCurveTo(9, -13, 12, -12);
      ctx.moveTo(-7, 9); ctx.quadraticCurveTo(0, 1, 7, -6);
      ctx.moveTo(-12, 1); ctx.lineTo(-8, 3); ctx.moveTo(-13, 6); ctx.lineTo(-9, 7); ctx.stroke();
      break;
    case 'surcharge': // foudre
      ctx.moveTo(3, -13); ctx.lineTo(-5, 1); ctx.lineTo(-1, 1); ctx.lineTo(-4, 13); ctx.lineTo(6, -3); ctx.lineTo(1, -3);
      ctx.closePath(); ctx.stroke();
      break;
    case 'regeneration': // pousse enchantée : tige + deux feuilles
      ctx.moveTo(0, 12); ctx.quadraticCurveTo(-1, 4, 0, -2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-4, -5, 4.5, 2.4, -0.6, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(4, -7, 4.5, 2.4, 0.6, 0, TAU); ctx.stroke();
      break;
    case 'onde': // onde de choc : arcs concentriques
      for (const r of [4, 8, 12]) { ctx.beginPath(); ctx.arc(0, 4, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 4, 1.6, 0, TAU); ctx.fillStyle = col; ctx.fill();
      break;
    case 'instinct': // arc de chasseur + flèche
      ctx.beginPath(); ctx.arc(-2, 0, 11, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.moveTo(9, -3); ctx.lineTo(13, 0); ctx.lineTo(9, 3); ctx.stroke();
      break;
    case 'distorsion': // sablier du temps
      ctx.moveTo(-8, -11); ctx.lineTo(8, -11); ctx.moveTo(-8, 11); ctx.lineTo(8, 11);
      ctx.moveTo(-8, -11); ctx.lineTo(0, -1); ctx.lineTo(8, -11);
      ctx.moveTo(-8, 11); ctx.lineTo(0, 1); ctx.lineTo(8, 11); ctx.stroke();
      break;
    case 'absorption': // vortex aspirant
      for (let k = 0; k < 26; k++) {
        const a = k * 0.5, r = 12 - k * 0.42;
        const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.8;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      break;
    case 'orbitale': // comète + traînée
      ctx.moveTo(-12, 9); ctx.lineTo(-4, 3); ctx.moveTo(-10, 12); ctx.lineTo(-3, 7); ctx.moveTo(-8, -11); ctx.lineTo(-2, -5);
      ctx.beginPath(); ctx.arc(5, -6, 5, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(5, -6, 1.8, 0, TAU); ctx.fillStyle = col; ctx.fill();
      break;
    case 'resistance': // tour-bouclier crénelé
      ctx.moveTo(-8, -11); ctx.lineTo(-8, -6); ctx.lineTo(-4, -6); ctx.lineTo(-4, -9); ctx.lineTo(0, -9); ctx.lineTo(0, -6); ctx.lineTo(4, -6); ctx.lineTo(4, -9); ctx.lineTo(8, -9); ctx.lineTo(8, -11);
      ctx.lineTo(8, 2); ctx.quadraticCurveTo(8, 8, 0, 12); ctx.quadraticCurveTo(-8, 8, -8, 2);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 9); ctx.moveTo(-5, 1); ctx.lineTo(5, 1); ctx.stroke();
      break;
    case 'impulsion': // triple bourrasque de vent
      ctx.moveTo(-11, -7); ctx.quadraticCurveTo(-3, -10, 7, -7);
      ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-3, -3, 8, 0);
      ctx.moveTo(-10, 7); ctx.quadraticCurveTo(-2, 4, 8, 7); ctx.stroke();
      break;
    case 'rempart': // oriflamme sur mur
      ctx.moveTo(-10, 12); ctx.lineTo(-10, -12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(8, -9); ctx.lineTo(-10, -5); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(12, 12); ctx.stroke();
      break;
    case 'rage': // lame enflammée
      ctx.moveTo(0, -12); ctx.quadraticCurveTo(4, -5, 1, 3); ctx.quadraticCurveTo(-1, 8, 0, 12);
      ctx.moveTo(-5, 12); ctx.lineTo(5, 12); ctx.moveTo(-7, 12); ctx.lineTo(-7, 8); ctx.moveTo(7, 12); ctx.lineTo(7, 8); ctx.stroke();
      break;
    case 'carapace': // carapace hexagonale rivetée
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6 - Math.PI / 2; const px = Math.cos(a) * 11, py = Math.sin(a) * 11; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6 - Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 0.9, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
      break;
    case 'supernova': // supernova : étoile à 8 branches
      for (let k = 0; k < 8; k++) {
        const a = k * TAU / 8, l = k % 2 ? 7 : 12;
        ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l);
      }
      ctx.stroke();
      break;
    case 'meteorite': // météore + traînée
      ctx.moveTo(-12, 10); ctx.lineTo(-5, 4); ctx.moveTo(-10, 13); ctx.lineTo(-4, 8); ctx.moveTo(-9, -10); ctx.lineTo(-3, -5);
      ctx.beginPath();
      for (let k = 0; k < 7; k++) { const a = k * TAU / 7; const px = 5 + Math.cos(a) * 5.5, py = -5 + Math.sin(a) * 5.5; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
      break;
    default: // glyphe générique : losange runique
      ctx.moveTo(0, -11); ctx.lineTo(8, 0); ctx.lineTo(0, 11); ctx.lineTo(-8, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fillStyle = col; ctx.fill();
  }
  ctx.restore();
}

export function drawModuleIcon(id, x, y, s = 1) {
  const m = MODULES[id]; if (!m) return;
  const metal = RAR_METAL[m.rar] || '#a5854f';
  const glow = RAR_GLOW[m.rar] || 'rgba(200,170,90,0.35)';
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  // halo d'élément
  const hg = ctx.createRadialGradient(0, 0, 4, 0, 0, 24);
  hg.addColorStop(0, hexA(m.col, 0.30)); hg.addColorStop(1, hexA(m.col, 0));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
  // disque sombre du médaillon
  const dg = ctx.createRadialGradient(-4, -5, 2, 0, 0, 21);
  dg.addColorStop(0, '#2a2013'); dg.addColorStop(0.7, '#17110a'); dg.addColorStop(1, '#0c0905');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
  // anneau métallique de rareté + seconde bordure fine
  ctx.strokeStyle = metal; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(0, 0, 20.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = hexA(metal, 0.45); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 17.5, 0, TAU); ctx.stroke();
  // graduations runiques autour de l'anneau
  ctx.strokeStyle = hexA(metal, 0.8); ctx.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8 + Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 20.5, Math.sin(a) * 20.5);
    ctx.lineTo(Math.cos(a) * 23.5, Math.sin(a) * 23.5);
    ctx.stroke();
  }
  // lueur de rareté sous le glyphe
  ctx.shadowColor = glow; ctx.shadowBlur = 8;
  drawModGlyph(id, m.col);
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
    // cadre cuir + liseré bronze
    ctx.fillStyle = 'rgba(14,11,7,0.85)';
    roundRect(x, y, 52, 52, 10); ctx.fill();
    ctx.strokeStyle = ready ? hexA(m.col, 0.8) : 'rgba(216,180,90,0.4)';
    ctx.lineWidth = 1.5; roundRect(x, y, 52, 52, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(216,180,90,0.18)'; ctx.lineWidth = 1;
    roundRect(x + 3, y + 3, 46, 46, 8); ctx.stroke();
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
    ctx.fillStyle = 'rgba(14,11,7,0.6)';
    roundRect(x, y, 52, 52, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(216,180,90,0.15)'; ctx.lineWidth = 1;
    roundRect(x, y, 52, 52, 10); ctx.stroke();
    ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('◇', x + 26, y + 22);
    ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('X', x + 26, y + 44);
  }
  ctx.restore();
}
