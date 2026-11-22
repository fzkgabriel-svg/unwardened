// js/bow.js — ARC CINÉTIQUE COSMIQUE : arme légendaire du boss du monde 9.
// Combat à distance : maintenir clic gauche pour charger, relâcher pour tirer.
// Clic droit : capacité SINGULARITÉ (projectile gravitationnel + zone d'implosion).
import { G, TAU } from './state.js';
import { spawnParticles, addDamageText } from './effects.js';
import { damageEnemy } from './enemies.js';
import { playerAngle, waveBonus } from './attacks.js';
import { worldW, worldH } from './world.js';
import { sfxBowFire, sfxSingularity, sfxBossAtk } from './audio.js';
import { wearWeaponUse } from './inventory.js';

export const BOW_SING_CD = 10;          // recharge de la singularité
const CHARGE_TIME = 1.15;               // temps de charge max (s)
const MIN_DMG = 0.55, MAX_DMG = 2.6;    // multiplicateur de dégâts selon la charge
const BOW_SHOT_CD = 0.25;               // cadence mini entre deux tirs (anti-spam)

export function bowUnlocked() { return !!(G.stats && G.stats.bowUnlocked); }

// état paresseux : G.bow = { charge, singCd, singAnim, recoil }
function bow() {
  if (!G.bow) G.bow = { charge: 0, singCd: 0, singAnim: 0, recoil: 0 };
  return G.bow;
}

// ---------- TIR ----------
function fireBolt() {
  const p = G.player, b = bow();
  const charge = Math.max(0.18, b.charge); // un appui bref tire quand même une flèche faible
  const a = playerAngle();
  const spd = 11 + charge * 6; // vitesse : 11 -> 17 px/frame
  const dmgMul = MIN_DMG + (MAX_DMG - MIN_DMG) * Math.min(1, charge);
  const type = charge >= 0.55 ? 'charged' : 'normal';
  G.bowShots = G.bowShots || [];
  G.bowShots.push({
    x: p.x + Math.cos(a) * (p.r + 14), y: p.y + Math.sin(a) * (p.r + 14),
    px: p.x, py: p.y,
    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
    r: type === 'charged' ? 9 : 6,
    dmg: p.attackDamage * dmgMul * waveBonus(),
    type, life: 2.2, t: 0, trail: [],
  });
  p.attackCooldown = BOW_SHOT_CD; // cadence de tir de l'arc (anti-spam)
  const broken = wearWeaponUse(G.inv, 0.14); // l'arc s'use à chaque trait
  if (broken) addDamageText(p.x, p.y - 42, `💥 ${broken} CASSÉ !`, '#ff5252');
  b.recoil = 1;            // recul visuel de l'arc
  sfxBowFire(charge);
  // buée d'énergie au départ
  spawnParticles(p.x + Math.cos(a) * (p.r + 16), p.y + Math.sin(a) * (p.r + 16),
    type === 'charged' ? '#b388ff' : '#40c4ff', type === 'charged' ? 12 : 7, 4);
  if (type === 'charged') G.screenShake = Math.max(G.screenShake, 2);
}

// ---------- SINGULARITÉ ----------
export function doSingularity() {
  const b = bow(), p = G.player;
  if (b.singCd > 0 || p.attackCooldown > 0) return false;
  const a = playerAngle();
  G.bowShots = G.bowShots || [];
  G.bowShots.push({
    x: p.x + Math.cos(a) * (p.r + 16), y: p.y + Math.sin(a) * (p.r + 16),
    px: p.x, py: p.y,
    vx: Math.cos(a) * 8.5, vy: Math.sin(a) * 8.5,
    r: 14, dmg: p.attackDamage * 4.2 * waveBonus(),
    type: 'sing', life: 3.0, t: 0, trail: [], zoneR: 210,
  });
  b.singCd = BOW_SING_CD;
  b.singAnim = 1;
  const broken = wearWeaponUse(G.inv, 0.5); // la singularité use l'arc davantage
  if (broken) addDamageText(p.x, p.y - 42, `💥 ${broken} CASSÉ !`, '#ff5252');
  p.attackCooldown = 0.5;
  b.recoil = 1.6;
  sfxSingularity();
  G.screenShake = Math.max(G.screenShake, 5);
  G.singPrep = G.time; // animation de charge cosmique autour du joueur
  return true;
}

// ---------- IMPACTS ----------
function boltImpact(s) {
  if (s.impacted) return;
  s.impacted = true;
  if (s.type === 'sing') {
    // singularité : formation + aspiration + détonation (3,8 s)
    G.singZones = G.singZones || [];
    G.singZones.push({ x: s.x, y: s.y, r: s.zoneR || 210, t: 0, dur: 3.8 });
    spawnParticles(s.x, s.y, '#7c4dff', 40, 10);
    spawnParticles(s.x, s.y, '#18ffff', 26, 8);
    spawnParticles(s.x, s.y, '#e040fb', 18, 6);
    spawnParticles(s.x, s.y, '#ffffff', 12, 5);
    G.rings.push({ x: s.x, y: s.y, r: 8, maxR: (s.zoneR || 210) * 0.55, life: 22, maxLife: 22, color: '#b388ff' });
    addDamageText(s.x, s.y - 26, '⬤ SINGULARITÉ', '#b388ff');
    G.screenShake = Math.max(G.screenShake, 10);
    G.screenFlash = Math.max(G.screenFlash || 0, 0.22);
    sfxBossAtk('void');
  } else {
    const col = s.type === 'charged' ? '#b388ff' : '#40c4ff';
    spawnParticles(s.x, s.y, col, s.type === 'charged' ? 18 : 9, s.type === 'charged' ? 7 : 5);
    if (s.type === 'charged') {
      // explosion cinétique : petits dégâts de zone
      const aoe = 74;
      for (let i = G.enemies.length - 1; i >= 0; i--) {
        const e = G.enemies[i];
        if (Math.hypot(e.x - s.x, e.y - s.y) < aoe + e.r) {
          damageEnemy(e, s.dmg * 0.45, Math.atan2(e.y - s.y, e.x - s.x));
        }
      }
      spawnParticles(s.x, s.y, '#7c4dff', 14, 6);
      G.screenShake = Math.max(G.screenShake, 4);
    }
  }
}

function shotHitEnemy(s, e) {
  const a = Math.atan2(s.vy, s.vx);
  damageEnemy(e, s.dmg, a);
  if (s.type === 'sing') {
    boltImpact(s);
  } else {
    boltImpact(s);
  }
  return true;
}

// ---------- UPDATE (appelé chaque frame depuis main.js) ----------
export function updateBow(dt) {
  const p = G.player, b = bow();
  const isBow = p.attackMode === 5 && p.alive !== false;

  // --- machine à états de la charge ---
  if (isBow) {
    if (G.attackHeld) {
      if (!b.charging) { b.charging = true; b.charge = 0; }
      b.charge = Math.min(1, b.charge + dt / CHARGE_TIME);
      // cristaux aspirés pendant la charge (feedback visuel dans draw)
    } else if (b.charging) {
      // anti-spam : pas de tir pendant le cooldown — le coup est retenu
      // et part automatiquement dès que les 0,25 s sont écoulées
      if (p.attackCooldown <= 0) {
        b.charging = false;
        fireBolt();
        b.charge = 0;
      }
    }
  } else if (b.charging) {
    b.charging = false; b.charge = 0; // changement d'arme pendant la charge : annule
  }

  b.singCd = Math.max(0, b.singCd - dt);
  b.singAnim = Math.max(0, b.singAnim - dt * 1.4);
  b.recoil = Math.max(0, b.recoil - dt * 5);

  // --- projectiles de l'arc ---
  G.bowShots = G.bowShots || [];
  for (let i = G.bowShots.length - 1; i >= 0; i--) {
    const s = G.bowShots[i];
    s.t += dt; s.life -= dt;
    s.px = s.x; s.py = s.y;
    // la singularité est légèrement attirée par les ennemis proches (gravité)
    if (s.type === 'sing') {
      for (const e of G.enemies) {
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < 260 && d > 1) {
          const pull = (1 - d / 260) * 0.9;
          s.vx += ((e.x - s.x) / d) * pull * dt * 60;
          s.vy += ((e.y - s.y) / d) * pull * dt * 60;
        }
      }
    }
    s.x += s.vx; s.y += s.vy;
    // traînée : on garde les positions récentes pour le rendu
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 14) s.trail.shift();
    // particules de traînée
    if ((i + (s.t * 60 | 0)) % 3 === 0) {
      spawnParticles(s.x, s.y, s.type === 'sing' ? '#7c4dff' : (s.type === 'charged' ? '#b388ff' : '#40c4ff'), 1, 0.6);
    }
    let dead = s.life <= 0 || s.x < -40 || s.x > worldW() + 40 || s.y < -40 || s.y > worldH() + 40;
    if (!dead) {
      for (let j = G.enemies.length - 1; j >= 0; j--) {
        const e = G.enemies[j];
        if (Math.hypot(e.x - s.x, e.y - s.y) < s.r + e.r) {
          shotHitEnemy(s, e);
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      if (s.life > 0) boltImpact(s); // impact mur/bords ; l'impact ennemi est déjà fait
      G.bowShots.splice(i, 1);
    }
  }

  // --- zones de singularité : formation -> attraction -> détonation ---
  G.singZones = G.singZones || [];
  for (let i = G.singZones.length - 1; i >= 0; i--) {
    const z = G.singZones[i];
    z.t += dt;
    if (z.t >= z.dur) { detonateSing(z); G.singZones.splice(i, 1); continue; }
    const k = 1 - z.t / z.dur;
    const det = z.t > z.dur - 0.9; // contraction finale : les anneaux accélèrent
    const pullK = det ? 1.8 : 1.0;
    for (const e of G.enemies) {
      const d = Math.hypot(e.x - z.x, e.y - z.y);
      if (d < z.r + e.r) {
        // aspiration vers le centre — les boss résistent à ~30 % du pull
        if (d > 8) {
          const boss = e.boss || /boss/i.test(e.type || '');
          const pull = (1 - d / (z.r + e.r)) * 2.6 * k * pullK * (boss ? 0.3 : 1);
          e.x -= ((e.x - z.x) / d) * pull * dt * 60 * 0.3;
          e.y -= ((e.y - z.y) / d) * pull * dt * 60 * 0.3;
        }
        e.slow = Math.max(e.slow || 0, det ? 0.9 : 0.6); // distorsion : ralentit les ennemis
        if ((z.t * 8 | 0) !== ((z.t - dt) * 8 | 0)) {
          damageEnemy(e, (det ? 44 : 26) * waveBonus() * k, Math.atan2(e.y - z.y, e.x - z.x)); // dps de la distorsion
        }
      }
    }
    // vortex visuel : particules aspirées (plus denses en phase de détonation)
    if (Math.random() < dt * (det ? 40 : 22)) {
      const a = Math.random() * TAU, rr = z.r * (0.7 + Math.random() * 0.5);
      spawnParticles(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr,
        Math.random() < 0.6 ? '#7c4dff' : (Math.random() < 0.5 ? '#18ffff' : '#e040fb'), 1, 0.5);
    }
  }
}

// ---------- DÉTONATION de la singularité ----------
function detonateSing(z) {
  const R = z.r * 1.2;
  // onde de choc violette + cyan
  G.rings.push({ x: z.x, y: z.y, r: 16, maxR: R * 1.5, life: 30, maxLife: 30, color: '#b388ff' });
  G.rings.push({ x: z.x, y: z.y, r: 8, maxR: R, life: 24, maxLife: 24, color: '#00e5ff' });
  G.screenShake = Math.max(G.screenShake, 15);
  G.screenFlash = Math.max(G.screenFlash || 0, 0.4);
  spawnParticles(z.x, z.y, '#b388ff', 46, 12);
  spawnParticles(z.x, z.y, '#18ffff', 30, 10);
  spawnParticles(z.x, z.y, '#e040fb', 22, 8);
  spawnParticles(z.x, z.y, '#ffffff', 16, 6);
  sfxBossAtk('void');
  for (const e of [...G.enemies]) {
    if (Math.hypot(e.x - z.x, e.y - z.y) < R + e.r) {
      damageEnemy(e, G.player.attackDamage * 3.4 * waveBonus(), Math.atan2(e.y - z.y, e.x - z.x));
      e.slow = Math.max(e.slow || 0, 5);
    }
  }
  addDamageText(z.x, z.y - 34, '✦ DÉTONATION', '#e040fb');
}

//Called from main.js for singularity input
export function trySingularity() { return doSingularity(); }
