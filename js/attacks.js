import { G, W, H, TAU } from './state.js';
import { spawnParticles, addDamageText } from './effects.js';
import { damageEnemy } from './enemies.js';
import { worldW, worldH } from './world.js';
import { sfxSlash, sfxThrust, sfxSpin, sfxShield, sfxNuke, sfxBossAtk, sfxFireLaser, sfxFireHand, sfxVolcano } from './audio.js';
import { waveBonus, clampW, clampH, playerAngle, inMeleeArc } from './attacks_util.js';
import { doIceUlt, doHellUlt } from './attacks_ult.js';
import { wearWeaponUse } from './inventory.js';

// usure de l'arme équipée à chaque attaque (0 % = cassée, sans bonus jusqu'à réparation)
function weaponWear(pts) {
  if (!G.inv) return;
  const broken = wearWeaponUse(G.inv, pts);
  if (broken) addDamageText(G.player.x, G.player.y - 42, `💥 ${broken} CASSÉ !`, '#ff5252');
}
export * from './attacks_util.js';
export * from './attacks_ult.js';

export function doSlash() {
  sfxSlash();
  const p = G.player, angle = playerAngle();
  const maxD = p.attackRange;
  let hit = false;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (inMeleeArc(p, e, angle, p.attackArc / 2, p.attackRange)) {
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      // épée : les dégâts baissent linéairement avec la distance (1,4x au contact → 0,6x à pleine portée)
      const mult = 1.4 - 0.8 * Math.min(1, dist / maxD);
      damageEnemy(e, p.attackDamage * mult * waveBonus(), angle);
      spawnParticles(e.x, e.y, '#ffd740', 6, 5); // gerbe d'étincelles à l'impact
      hit = true;
    }
  }
  p.attackCooldown = 0.4;
  weaponWear(0.22); // l'épée s'use à chaque coup porté
  if (hit) {
    spawnParticles(p.x + Math.cos(angle) * p.attackRange * 0.6, p.y + Math.sin(angle) * p.attackRange * 0.6, '#fff176', 8, 6);
    G.screenShake = Math.max(G.screenShake, 3); // micro-secousse à l'impact
  }
}

// Attaque secondaire du mode bouclier : dôme défensif 3s, -85% de dégâts subis
export function doShield() {
  sfxShield();
  const p = G.player;
  p.shieldCd = 10; // recharge du dôme de bouclier
  p.shieldT = 3;
  G.shieldUsed = (G.shieldUsed || 0) + 1; // compteur tutoriel
  G.rings.push({ x: p.x, y: p.y, r: p.r, maxR: 100, life: 20, maxLife: 20, color: '#4fc3f7' });
  spawnParticles(p.x, p.y, '#4fc3f7', 22, 5);
}

export function doSpin() {
  sfxSpin();
  // Attaque rotative : touche tous les ennemis dans le rayon, avec recul
  const p = G.player;
  p.spinCooldown = 5; // recharge de la rotation
  p.spinDuration = 0.35;
  G.spinUsed = (G.spinUsed || 0) + 1; // compteur tutoriel
  G.rings.push({ x: p.x, y: p.y, r: 10, maxR: p.spinRadius, life: 25, maxLife: 25, color: '#ff9100' });
  weaponWear(0.3); // la rotation use l'épée un peu plus (zone large)
  let hit = false;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    if (dist < p.spinRadius + e.r) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      e.x += Math.cos(a) * 22; e.y += Math.sin(a) * 22;
      damageEnemy(e, p.spinDamage * waveBonus(), a);
      hit = true;
    }
  }
  if (hit) spawnParticles(p.x, p.y, '#ff9100', 20, 7);
}

// Mode 3 : lance + bouclier — frappe courte, dégâts réduits, mais encaisse moins
export function doThrust() {
  sfxThrust();
  const p = G.player, angle = playerAngle();
  const maxD = p.attackRange * 1.5; // portée ×1.5 : la lance est dessinée jusqu'à ~89px
  // estoc : le héros bondit légèrement vers sa cible (dash de perforation)
  p.x = Math.max(p.r, Math.min(worldW() - p.r, p.x + Math.cos(angle) * 9));
  p.y = Math.max(p.r, Math.min(worldH() - p.r, p.y + Math.sin(angle) * 9));
  let hit = false;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (inMeleeArc(p, e, angle, 0.4, maxD)) {
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      // lance : les dégâts montent linéairement avec la distance (0,6x au contact → 1,4x à pleine portée)
      const mult = 0.6 + 0.8 * Math.min(1, dist / maxD);
      // lance : ~45% des dégâts de l'épée (attaque de poignard, pas de lame)
      damageEnemy(e, p.attackDamage * 0.45 * mult * waveBonus(), angle);
      // petit recul de la lance + gerbe à l'impact
      e.x += Math.cos(angle) * 10; e.y += Math.sin(angle) * 10;
      spawnParticles(e.x, e.y, '#ffe082', 5, 4);
      hit = true;
    }
  }
  p.attackCooldown = 0.32; // la lance frappe plus vite que l'épée (0,4s)
  weaponWear(0.18); // l'arme s'use à chaque estoc
  if (hit) {
    spawnParticles(p.x + Math.cos(angle) * p.attackRange * 0.5, p.y + Math.sin(angle) * p.attackRange * 0.5, '#ffe082', 10, 7);
    G.screenShake = Math.max(G.screenShake, 3); // micro-secousse percutante
    // onde de choc à la pointe de la lance
    G.rings.push({
      x: p.x + Math.cos(angle) * maxD * 0.7, y: p.y + Math.sin(angle) * maxD * 0.7,
      r: 6, maxR: 46, life: 14, maxLife: 14, color: '#ffd740'
    });
  }
}

export function doUlt() {
  const p = G.player;
  // Pluie de Glace : ultime débloquée en finissant The Frozen Land
  if ((G.stats.ultSel || 'nuke') === 'glace' && G.stats.iceUlt) { doIceUlt(); return; }
  // Colère Infernale : ultime débloquée en finissant Les Enfers
  if ((G.stats.ultSel || 'nuke') === 'hell' && G.stats.hellUlt) { doHellUlt(); return; }
  // BOMBE ATOMIQUE : un B-2 Spirit traverse l'écran et largue la bombe
  // au-dessus du joueur ; elle explose quand l'avion a quitté la carte
  if (G.bomber) return; // une frappe est déjà en cours
  p.ultCharge = 0;
  G.ultsUsed++; // stats (succès)
  G.nukeUlts = (G.nukeUlts || 0) + 1;
  const tx = p.x, ty = p.y; // cible figée au moment du largage
  const dir = (tx - (G.camX || 0)) < W / 2 ? -1 : 1; // l'avion arrive du côté opposé
  G.bomber = {
    phase: 'fly',           // fly -> done (la bombe tombe pendant que l'avion sort)
    x: dir > 0 ? -200 : W + 200, y: 92, dir,
    speed: 780, tx, ty, t: 0,
    bomb: null, dropX: 0
  };
}

// mis à jour en temps réel (hors slow-motion) : le bombardier, la bombe,
// le champignon nuageux
export function doFireLaser() {
  const p = G.player;
  if (p.attackCooldown > 0) return;
  p.attackCooldown = 0.85; // cadence du laser
  const a = playerAngle();
  G.lasers.push({
    x: p.x, y: p.y, angle: a,
    len: p.ultRadius * 2.0, w: 42,
    life: 0.65, maxLife: 0.65, tick: 0
  });
  sfxFireLaser(); // souffle de laser brûlant + zap + crépitements
  spawnParticles(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30, '#ff7043', 8, 5);
}

export function updateLasers(dt) {
  for (let i = G.lasers.length - 1; i >= 0; i--) {
    const L = G.lasers[i];
    L.life -= dt;
    L.tick -= dt;
    // braises projetées le long du faisceau
    if (Math.random() < dt * 70) {
      const d = Math.random() * L.len;
      G.particles.push({
        x: L.x + Math.cos(L.angle) * d + (Math.random() - 0.5) * L.w,
        y: L.y + Math.sin(L.angle) * d + (Math.random() - 0.5) * L.w,
        vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2,
        life: 22, maxLife: 22,
        color: Math.random() < 0.6 ? '#ff7043' : '#ffd740',
        r: 1.5 + Math.random() * 2
      });
    }
    // dégâts de brûlure en continu le long du faisceau (toutes les 0,12 s)
    if (L.tick <= 0) {
      L.tick = 0.12;
      const dmg = G.player.attackDamage * 2.2 * waveBonus();
      const ex = Math.cos(L.angle), ey = Math.sin(L.angle);
      for (const e of [...G.enemies]) {
        const rx = e.x - L.x, ry = e.y - L.y;
        const proj = rx * ex + ry * ey;
        if (proj < -e.r || proj > L.len + e.r) continue;
        const perp = Math.abs(rx * ey - ry * ex);
        if (perp < L.w / 2 + e.r) {
          // le Baron de l'Enfer encaisse peu les dégâts d'ultime
          const red = e.type === 'finalBossEnfer' ? 0.25 : 1;
          damageEnemy(e, dmg * red, Math.atan2(ry, rx));
          e.slow = Math.max(e.slow || 0, 0.5); // brûlure
        }
      }
    }
    if (L.life <= 0) G.lasers.splice(i, 1);
  }
}

// ---------- TITAN DE FEU : MAIN DE FEU (attaque secondaire, clic droit) ----------
// Une main de feu jaillit du titan, fend l'air en arc et s'écrase au sol :
// elle y fait surgir un volcan qui entre en éruption (dégâts + brûlure).
export function doFireHand() {
  const p = G.player;
  if (p.handUsed) return; // une seule main de feu par transformation
  p.handUsed = true;
  p.handCd = 2.6; // recharge affichée dans le HUD
  const tx = G.mouse.x + (G.camX || 0), ty = G.mouse.y + (G.camY || 0);
  const a = Math.atan2(ty - p.y, tx - p.x);
  const d = Math.min(540, Math.hypot(tx - p.x, ty - p.y));
  G.hands.push({
    x: p.x, y: p.y - p.r, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d,
    sx: p.x, sy: p.y - p.r, t: 0, dur: 0.38
  });
  sfxFireHand(); // whoosh enflammé + burst de feu
  spawnParticles(p.x, p.y - 20, '#ff7043', 14, 6);
}

export function updateHands(dt) {
  for (let i = G.hands.length - 1; i >= 0; i--) {
    const h = G.hands[i];
    h.t += dt;
    const k = Math.min(1, h.t / h.dur);
    // traînée de braises derrière la main
    if (Math.random() < dt * 60) {
      const e = k * k * (3 - 2 * k); // smoothstep
      G.particles.push({
        x: h.sx + (h.tx - h.sx) * e + (Math.random() - 0.5) * 14,
        y: h.sy + (h.ty - h.sy) * e - Math.sin(k * Math.PI) * 70 + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random() * 2,
        life: 22, maxLife: 22,
        color: Math.random() < 0.6 ? '#ff7043' : '#ffd740',
        r: 1.6 + Math.random() * 2
      });
    }
    if (k >= 1) {
      G.hands.splice(i, 1);
      spawnVolcano(h.tx, h.ty);
    }
  }
}

function spawnVolcano(x, y) {
  x = Math.max(50, Math.min(worldW() - 50, x));
  y = Math.max(50, Math.min(worldH() - 50, y));
  G.volcanoes.push({ x, y, r: 125, life: 4.5, maxLife: 4.5, tick: 0, eruptT: 0.3, burst: false });
  G.screenShake = Math.max(G.screenShake, 15);
  G.screenFlash = Math.max(G.screenFlash, 0.3);
  G.rings.push({ x, y, r: 10, maxR: 175, life: 26, maxLife: 26, color: '#ff7043' });
  G.rings.push({ x, y, r: 5, maxR: 110, life: 20, maxLife: 20, color: '#ffd740' });
  sfxVolcano(); // éruption : boom profond + projections + sifflement
  spawnParticles(x, y, '#ff7043', 36, 9);
  spawnParticles(x, y, '#4e342e', 22, 7); // projections de roche
}

export function updateVolcanoes(dt) {
  const p = G.player;
  for (let i = G.volcanoes.length - 1; i >= 0; i--) {
    const v = G.volcanoes[i];
    v.life -= dt; v.eruptT -= dt; v.tick -= dt;
    // gerbe de flammes + projette de la LAVE en nappes et des rochers
    if (v.life > 0 && Math.random() < dt * 34) {
      const a = Math.random() * TAU, d = Math.random() * v.r * 0.5;
      G.particles.push({
        x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d * 0.6,
        vx: (Math.random() - 0.5) * 1.5, vy: -2.5 - Math.random() * 3.5,
        life: 26, maxLife: 26,
        color: Math.random() < 0.55 ? '#ff7043' : '#ffd740',
        r: 2 + Math.random() * 2.6
      });
    }
    // gouttelettes de lave : gerbe orange qui retombe en pluie de feu
    if (v.burst && v.life > 0 && Math.random() < dt * 26) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const sp = 3 + Math.random() * 5;
      G.particles.push({
        x: v.x + (Math.random() - 0.5) * v.r * 0.4, y: v.y - v.r * 0.8,
        vx: Math.cos(a) * sp * 2.4, vy: Math.sin(a) * sp * 2.4,
        life: 34, maxLife: 34,
        color: Math.random() < 0.5 ? '#ff5722' : '#ffab00',
        r: 2.4 + Math.random() * 2.4
      });
    }
    // mini rochers éjectés du cratère : débris sombres qui volent partout
    if (v.burst && v.life > 0 && Math.random() < dt * 15) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 4 + Math.random() * 6;
      G.particles.push({
        x: v.x + (Math.random() - 0.5) * v.r * 0.3, y: v.y - v.r * 0.7,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 40, maxLife: 40,
        color: Math.random() < 0.6 ? '#4e342e' : '#3e2723',
        r: 3 + Math.random() * 3.4
      });
    }
    // explosion initiale : grosse gerbe + dégâts massifs dans le cratère
    if (!v.burst && v.eruptT <= 0) {
      v.burst = true;
      v.tick = 0;
      const dmg = p.attackDamage * 4.5 * waveBonus();
      for (const e of [...G.enemies]) {
        if (Math.hypot(e.x - v.x, e.y - v.y) < v.r + e.r) {
          const red = e.type === 'finalBossEnfer' ? 0.25 : 1;
          damageEnemy(e, dmg * red, Math.atan2(e.y - v.y, e.x - v.x));
          e.slow = Math.max(e.slow || 0, 0.6); // brûlure
        }
      }
      sfxBossAtk('fire');
      G.screenShake = Math.max(G.screenShake, 16);
      spawnParticles(v.x, v.y, '#ffd740', 40, 11);
      spawnParticles(v.x, v.y - 30, '#ff5722', 30, 10); // gerbe de lave
      spawnParticles(v.x, v.y - 20, '#4e342e', 24, 9);  // projection de rochers
    }
    // brûlure persistante : le volcan crache du feu sur la zone
    if (v.burst && v.tick <= 0 && v.life > 0) {
      v.tick = 0.3;
      const dmg = p.attackDamage * 1.1 * waveBonus();
      for (const e of [...G.enemies]) {
        if (Math.hypot(e.x - v.x, e.y - v.y) < v.r * 0.85 + e.r) {
          const red = e.type === 'finalBossEnfer' ? 0.25 : 1;
          damageEnemy(e, dmg * red, Math.atan2(e.y - v.y, e.x - v.x));
          e.slow = Math.max(e.slow || 0, 0.5);
        }
      }
    }
    if (v.life <= 0) G.volcanoes.splice(i, 1);
  }
}

// explosion de la bombe : flash, secousse, anneaux, boule de feu,
// panache de fumée, zone de feu persistante et dégâts de zone
