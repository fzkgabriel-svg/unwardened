import { G, W, H, TAU } from './state.js';
import { spawnParticles, addDamageText } from './effects.js';
import { damageEnemy } from './enemies.js';
import { worldW, worldH } from './world.js';
import { sfxSlash, sfxThrust, sfxSpin, sfxNuke, sfxBossAtk, sfxWave, sfxIceCharge, sfxIceOpen, sfxIceStorm, sfxIceImpact, sfxIceEnd, sfxHellTransform } from './audio.js';
import { waveBonus, clampW, clampH, playerAngle } from './attacks_util.js';

export function updateNuke(dt) {
  const b = G.bomber;
  if (b) {
    b.t += dt;
    const targetSX = b.tx - (G.camX || 0);
    const targetSY = b.ty - (G.camY || 0);
    if (b.phase === 'fly') {
      b.x += b.dir * b.speed * dt;
      const passed = b.dir > 0 ? b.x >= targetSX : b.x <= targetSX;
      if (passed || b.t > 3.4) {
        // largage : la bombe chute vers la cible pendant que l'avion sort
        b.phase = 'done';
        b.dropX = b.x;
        const fallDist = Math.max(60, targetSY - (b.y + 14));
        const exitDist = b.dir > 0 ? (W + 210 - b.x) : (b.x + 210);
        const exitTime = Math.max(0.5, exitDist / b.speed);
        // vitesse de chute calibrée pour toucher le sol au moment du départ de l'avion
        b.bomb = {
          x: b.x, y: b.y + 14,
          speed: Math.min(1300, Math.max(320, fallDist / exitTime)),
          w: Math.random() * TAU
        };
      }
    } else {
      // l'avion continue sa route et largue la bombe en chute
      b.x += b.dir * b.speed * dt;
      const bd = b.bomb;
      if (bd) {
        bd.w += dt * 9;
        bd.y += bd.speed * dt * (1 + Math.min(0.4, bd.y / 1000));
        bd.x += Math.sin(bd.w) * 0.7;
        // traînée de fumée derrière la bombe
        if (Math.random() < 0.85) {
          G.particles.push({
            x: bd.x + (Math.random() - 0.5) * 5, y: bd.y - Math.random() * 12,
            vx: (Math.random() - 0.5) * 0.9, vy: -0.7 - Math.random() * 0.9,
            life: 26 + Math.random() * 14, maxLife: 40,
            color: Math.random() < 0.55 ? '#78909c' : '#546e7a',
            r: 3 + Math.random() * 3.5
          });
        }
        if (bd.y >= targetSY) bd.done = true; // la bombe a touché le sol
      }
      // la bombe explose quand l'avion a quitté l'écran
      if (b.x < -210 || b.x > W + 210) {
        G.bomber = null;
        explodeNuke(b.tx, b.ty);
      }
    }
  }
  // le champignon nuageux monte puis s'estompe
  const m = G.mushroom;
  if (m) { m.t += dt; if (m.t > 2.8) G.mushroom = null; }
}

// position des nuages de la tempête de glace (même formule dans cinematic.js)
function stormCloudXY(s, i, t) {
  const defs = [
    { ox: -0.42, oy: -0.80, sc: 1.0, sp: 0.45 },
    { ox: 0.05,  oy: -0.95, sc: 1.3, sp: 0.30 },
    { ox: 0.50,  oy: -0.72, sc: 0.85, sp: 0.55 }
  ];
  const d = defs[i % defs.length];
  return {
    x: s.x + d.ox * s.r + Math.sin(t * d.sp + i * 2.1) * s.r * 0.06,
    y: s.y + d.oy * s.r + Math.cos(t * d.sp * 0.8 + i) * s.r * 0.03,
    s: d.sc
  };
}

// ---------- ULTIME : PLUIE DE GLACE (coffre du Souverain de Glace) ----------
// Refonte spectaculaire en 4 phases :
//   charge  (0–1,3 s)  : le héros canalise — aura cyan, cristaux orbitaux, givre
//   open    (1,3–2,2 s): la tempête s'ouvre — cercle runique, pilier de lumière
//   storm   (2,2–10,6s): déchaînement — pluie de cristaux, rafales, aura de givre
//   finale  (10,6–12,5): méga-cristaux, onde glaciale finale, dissolution
// Pendant la tempête, les ennemis de la zone sont ralentis et frappent
// 50 % moins fort. Dégâts globalement identiques à l'ancienne version.
export function doIceUlt() {
  const p = G.player;
  p.ultCharge = 0;
  G.ultsUsed++;
  G.iceUlts = (G.iceUlts || 0) + 1;
  const stormR = (p.ultRadius * (G.equip ? G.equip.ultR : 1) + 190) * 0.7;
  G.iceStorm = { t: 12.5, x: p.x, y: p.y, r: stormR, spawnT: 0, friendly: true, tick: 0, iceT: 0, age: 0, megaT: 0, boomed: false, phase: 'charge', gustT: 0 };
  G.iceSpikes = [];
  G.iceShards = [];
  // la couverture de neige procédurale est initialisée dans updateSnowCover
  // (partagée avec la micro-tempête du boss)
  G.screenShake = Math.max(G.screenShake, 10);
  sfxIceCharge(); // canalisation : montée grave + cristaux qui tintent
  spawnParticles(p.x, p.y - 60, '#b3e5fc', 30, 8);
  addDamageText(p.x, p.y - 90, '❄ PLUIE DE GLACE ❄', '#80d8ff');
}

// ---------- COUVERTURE DE NEIGE : transformation du sol (Pluie de Glace) ----------
// Des cellules irrégulières se déposent progressivement depuis le centre de la
// tempête vers les bords, s'épaississent autour des impacts, puis fondent
// lentement après la tempête (~16 s). Partagée avec la micro-tempête du boss.
function initSnowCover(s) {
  const cells = [];
  const R = s.r * 1.05;
  const count = Math.min(110, 14 + Math.round(R / 55) ** 2 * 1.6);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const d = Math.sqrt(Math.random()) * R;
    cells.push({
      x: s.x + Math.cos(a) * d,
      y: s.y + Math.sin(a) * d * 0.72, // sol vu en perspective : ellipse aplatie
      r: 46 + Math.random() * 62,
      seed: Math.random() * 1000,
      delay: (d / R) * 6.5 + Math.random() * 3, // propagation centre -> bords
      depth: 0, boost: 0,
      target: 0.55 + Math.random() * 0.45        // épaisseur variable par cellule
    });
  }
  G.snowCover = { cells, t: 0, melt: 0 };
}

function updateSnowCover(s, dt) {
  if (s && !G.snowCover) initSnowCover(s);
  const cv = G.snowCover;
  if (!cv) return;
  if (s) {
    cv.t += dt;
    for (const c of cv.cells) {
      // la neige apparaît d'abord autour des impacts : le boost court-circuite le délai
      const dl = c.boostT !== undefined ? Math.min(c.delay, c.boostT) : c.delay;
      const g = Math.max(0, Math.min(1, (cv.t - dl) / 7));
      const ease = g * g * (3 - 2 * g);
      c.depth = Math.min(1, ease * Math.min(1, c.target + c.boost));
    }
  } else {
    cv.melt += dt;
    const k = Math.max(0, 1 - cv.melt / 16); // fonte douce sur ~16 s
    let alive = false;
    for (const c of cv.cells) {
      c.depth *= Math.max(0, 1 - dt * 0.14);
      if (c.depth * k > 0.015) alive = true;
    }
    if (!alive || cv.melt > 22) G.snowCover = null;
  }
}

export function updateIceUlt(dt) {
  const s = G.iceStorm;
  // décroissance visuelle de la carapace de glace sur les ennemis (+ gerbes de givre)
  for (const e of G.enemies) {
    if (e.frozen > 0) {
      e.frozen -= dt;
      if (Math.random() < dt * 4) {
        G.particles.push({
          x: e.x + (Math.random() - 0.5) * e.r * 1.6, y: e.y - e.r * 0.3 - Math.random() * e.r * 0.6,
          vx: (Math.random() - 0.5) * 0.4, vy: -0.9 - Math.random() * 0.9,
          life: 28, maxLife: 28, color: 'rgba(186,222,255,0.4)', r: 1.4 + Math.random() * 1.8
        });
      }
    }
  }
  if (s) s.age = (s.age || 0) + dt;
  // phases : charge (aura) -> open (formation) -> storm -> finale
  // la tempête du boss n'a pas de préparation : elle va droit au storm
  const phase = !s ? null : (!s.friendly ? 'storm'
    : s.age < 1.3 ? 'charge'
    : s.age < 2.2 ? 'open'
    : s.age < 10.6 ? 'storm'
    : 'finale');
  const active = phase === 'storm' || phase === 'finale';
  const finale = phase === 'finale';
  if (s) {
    const dimT = phase === 'charge' ? 0.08 : phase === 'open' ? 0.14 : finale ? 0.26 : 0.16;
    G.iceDim += (dimT - G.iceDim) * Math.min(1, dt * 2.4);
    // impulsions sonores aux changements de phase
    if (s.phase !== phase) {
      if (phase === 'open') { sfxIceOpen(); G.screenFlash = Math.max(G.screenFlash || 0, 0.15); }
      else if (phase === 'storm') sfxIceStorm();
      s.phase = phase;
    }
  } else {
    G.iceDim = Math.max(0, (G.iceDim || 0) - dt * 0.9);
  }

  // impact de glace partagé : dégâts + ralenti + gel visuel + débris au sol
  const iceImpact = (x, ty, rad, dmg, big, fromBoss) => {
    spawnParticles(x, ty - 6, '#e1f5fe', big ? 22 : 9, big ? 9 : 5);
    spawnParticles(x, ty - 6, '#4fc3f7', big ? 14 : 6, big ? 8 : 4);
    G.rings.push({ x, y: ty, r: 4, maxR: rad * (big ? 4.2 : 2.4), life: big ? 26 : 14, maxLife: big ? 26 : 14, color: '#b3e5fc' });
    // trace de givre au sol : ellipse bleutée qui fond en quelques secondes
    G.iceFrost.push({ x, y: ty, r: rad * (big ? 2.3 : 1.5), life: big ? 5.5 : 3.6, maxLife: big ? 5.5 : 3.6 });
    if (G.iceFrost.length > 70) G.iceFrost.splice(0, G.iceFrost.length - 70);
    // accumulation de neige autour de l'impact : les cellules proches
    // se déposent plus vite et plus épais
    if (G.snowCover) {
      const reach = rad * 4.5;
      for (const c of G.snowCover.cells) {
        const dx = c.x - x, dy = c.y - ty;
        if (dx * dx + dy * dy < reach * reach) {
          c.boost = Math.min(0.5, c.boost + (big ? 0.3 : 0.18));
          c.boostT = Math.min(c.boostT ?? 1e9, (G.snowCover.t || 0) + 0.4);
        }
      }
    }
    // bouffée de poudreuse au sol
    for (let i = 0; i < (big ? 9 : 4); i++) {
      G.particles.push({
        x: x + (Math.random() - 0.5) * rad * 2.6, y: ty - 3 - Math.random() * 5,
        vx: (Math.random() - 0.5) * 2.4, vy: -0.5 - Math.random() * 0.9,
        life: 26 + Math.random() * 20, maxLife: 46,
        color: 'rgba(255,255,255,0.5)', r: 2.5 + Math.random() * 3.5
      });
    }
    // brume froide qui s'élève de l'impact
    const nm = big ? 8 : 3;
    for (let i = 0; i < nm; i++) {
      G.particles.push({
        x: x + (Math.random() - 0.5) * rad * 1.8, y: ty - 4 - Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.8, vy: -0.4 - Math.random() * 0.8,
        life: 30 + Math.random() * 26, maxLife: 56,
        color: 'rgba(186,222,255,0.14)', r: 9 + Math.random() * (big ? 14 : 8)
      });
    }
    // scintillements de givre qui montent
    for (let i = 0; i < (big ? 6 : 3); i++) {
      G.particles.push({
        x: x + (Math.random() - 0.5) * rad * 1.5, y: ty - Math.random() * 22,
        vx: (Math.random() - 0.5) * 0.5, vy: -1.2 - Math.random() * 1.4,
        life: 26 + Math.random() * 16, maxLife: 42,
        color: '#e1f5fe', r: 1 + Math.random() * 1.3
      });
    }
    // craquement cristallin — probabiliste pour éviter la saturation sonore
    if (Math.random() < (big ? 0.9 : 0.22)) sfxIceImpact(big);
    // éclats de glace persistants sur le sol
    const nd = big ? 5 : 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < nd; i++) {
      G.iceShards.push({
        x: x + (Math.random() - 0.5) * rad * 2.4, y: ty + (Math.random() - 0.5) * rad,
        rot: Math.random() * TAU, s: (big ? 1.5 : 1) * (0.7 + Math.random() * 0.6),
        life: 7, maxLife: 7
      });
    }
    if (G.iceShards.length > 60) G.iceShards.splice(0, G.iceShards.length - 60);
    for (const e of G.enemies) {
      // les pics du Souverain ne blessent pas les boss finaux (pas de dégâts collatéraux)
      if (fromBoss && (e.type === 'finalBoss' || e.type === 'finalBossGlace')) continue;
      if (Math.hypot(e.x - x, e.y - ty) < rad + e.r) {
        const red = e.type === 'finalBossGlace' ? 0.25 : 1;
        damageEnemy(e, dmg * red, Math.atan2(e.y - ty, e.x - x));
        e.slow = Math.max(e.slow || 0, big ? 7 : 6);   // les cristaux figent les ennemis
        e.frozen = Math.max(e.frozen || 0, big ? 3 : 2.2); // carapace de glace visuelle
        // gerbe de givre sur l'ennemi touché
        spawnParticles(e.x, e.y - e.r * 0.5, '#b3e5fc', big ? 9 : 4, big ? 5 : 3);
      }
    }
  };

  // cristaux en chute : chute + traînée + impact (variantes de taille/forme)
  for (let i = G.iceSpikes.length - 1; i >= 0; i--) {
    const sp = G.iceSpikes[i];
    sp.y += sp.v * dt;
    sp.x += ((sp.drift || 0) + Math.sin((G.time || 0) * 4 + (sp.rot || 0)) * 7) * dt;
    sp.rot = (sp.rot || 0) + dt * 3;
    if (sp.y >= sp.ty) {
      G.iceSpikes.splice(i, 1);
      iceImpact(sp.x, sp.ty, sp.r * (sp.mega ? 2.3 : 1),
        G.player.attackDamage * (sp.mega ? 4.5 : 1.4) * waveBonus(), !!sp.mega, sp.fromBoss);
      if (sp.mega) { G.screenShake = Math.max(G.screenShake, 7); sfxBossAtk('ice'); }
    }
  }
  // STALACTITES GÉANTES : lames de glace dévalant le ciel (plus grosses en finale)
  // La chute et les impacts sont traités même après la fin de la tempête.
  if (s && s.friendly && s.iceT !== undefined) {
    s.iceT -= dt;
    if (s.iceT <= 0 && active) {
      s.iceT = finale ? 0.5 : 0.9;
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * s.r * 0.9;
      const cx = Math.max(60, Math.min(worldW() - 60, s.x + Math.cos(a) * d));
      const cy = Math.max(60, Math.min(worldH() - 60, s.y + Math.sin(a) * d));
      G.skyIcicles.push({
        x: cx, y: cy - 720 - Math.random() * 320, ty: cy,
        v: (130 + Math.random() * 60) * (finale ? 1.15 : 1), r: (15 + Math.random() * 9) * (finale ? 1.5 : 1),
        rot: (Math.random() - 0.5) * 0.4
      });
    }
  }
  // couverture de neige du sol : dépôt progressif pendant la tempête,
  // fonte lente ensuite — tourne même quand la tempête est finie
  updateSnowCover(s, dt);
  // les sols enneigés fondent lentement (~25 s)
  for (let i = G.snowPatches.length - 1; i >= 0; i--) {
    G.snowPatches[i].life -= dt;
    if (G.snowPatches[i].life <= 0) G.snowPatches.splice(i, 1);
  }
  // les traces de givre des impacts fondent en ~4-6 s
  for (let i = G.iceFrost.length - 1; i >= 0; i--) {
    G.iceFrost[i].life -= dt;
    if (G.iceFrost[i].life <= 0) G.iceFrost.splice(i, 1);
  }
  // les éclats de glace au sol fondent en ~7 s
  for (let i = G.iceShards.length - 1; i >= 0; i--) {
    G.iceShards[i].life -= dt;
    if (G.iceShards[i].life <= 0) G.iceShards.splice(i, 1);
  }
  for (let i = G.skyIcicles.length - 1; i >= 0; i--) {
    const c = G.skyIcicles[i];
    c.y += c.v * dt;
    if (c.y >= c.ty) {
      G.skyIcicles.splice(i, 1);
      iceImpact(c.x, c.ty, c.r * 1.9, G.player.attackDamage * 3.2 * waveBonus(), c.r > 20, false);
      G.screenShake = Math.max(G.screenShake, c.r > 20 ? 12 : 9);
    }
  }
  if (!s) return;
  s.t -= dt;
  // CHARGE : le héros canalise — aura ascendante + gerbes de givre (0 dégât)
  if (phase === 'charge') {
    if (Math.random() < dt * 60) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * s.r * 0.5;
      G.particles.push({
        x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d * 0.6 + 30,
        vx: (Math.random() - 0.5) * 0.6, vy: -1.6 - Math.random() * 1.6,
        life: 40, maxLife: 40, color: Math.random() < 0.6 ? '#e1f5fe' : '#ffffff', r: 1.5 + Math.random() * 2
      });
    }
    // mini-cristaux aspirés vers le héros pendant la canalisation
    if (Math.random() < dt * 22) {
      const a = Math.random() * TAU;
      G.particles.push({
        x: s.x + Math.cos(a) * (60 + Math.random() * 70), y: s.y - 24 + Math.sin(a) * 34,
        vx: -Math.cos(a) * 0.9, vy: -1.6 - Math.random() * 1.4,
        life: 38, maxLife: 38, color: Math.random() < 0.55 ? '#e1f5fe' : '#b3e5fc',
        r: 1.2 + Math.random() * 1.6
      });
    }
  }
  // OUVERTURE : les fragments de givre convergent vers le centre de la tempête
  if (phase === 'open') {
    if (Math.random() < dt * 110) {
      const a = Math.random() * TAU, d = s.r * (0.5 + Math.random() * 0.35);
      const px = s.x + Math.cos(a) * d, py = s.y + Math.sin(a) * d * 0.55;
      const dx = s.x - px, dy = s.y - py, dd = Math.hypot(dx, dy) || 1;
      const v = 3 + Math.random() * 3;
      G.particles.push({
        x: px, y: py, vx: dx / dd * v, vy: dy / dd * v,
        life: 34, maxLife: 34, color: Math.random() < 0.6 ? '#e1f5fe' : '#ffffff',
        r: 1.4 + Math.random() * 1.8
      });
    }
  }
  // cristaux : tempête ~16/s, finale ~22/s + méga-cristaux périodiques
  // la cadence ralentit progressivement en toute fin de tempête
  if (active) {
    s.spawnT -= dt;
    while (s.spawnT <= 0 && G.iceStorm === s) {
      s.spawnT += finale ? (s.t < 1.5 ? 0.11 : 0.048) : 0.062;
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * s.r;
      const x = Math.max(20, Math.min(worldW() - 20, s.x + Math.cos(a) * d));
      const y = Math.max(20, Math.min(worldH() - 20, s.y + Math.sin(a) * d));
      G.iceSpikes.push({
        x, ty: y, y: y - 480 - Math.random() * 260,
        v: 60 + Math.random() * 35, r: (7 + Math.random() * 5) * (finale ? 1.25 : 1),
        fromBoss: !s.friendly,
        kind: Math.random() < 0.16 ? 3 : Math.random() * 3 | 0, rot: Math.random() * TAU,
        drift: (Math.random() - 0.5) * 26, mega: false
      });
    }
    // rafales : toutes les ~2,6 s, une vague groupée de cristaux surgit
    s.gustT = (s.gustT || 0) - dt;
    if (s.gustT <= 0) {
      s.gustT = finale ? 1.6 : 2.6;
      const ga = Math.random() * TAU, gd = Math.sqrt(Math.random()) * s.r * 0.85;
      const gx = clampW(s.x + Math.cos(ga) * gd), gy = clampH(s.y + Math.sin(ga) * gd);
      const gn = finale ? 6 : 4;
      for (let i = 0; i < gn; i++) {
        G.iceSpikes.push({
          x: gx + (Math.random() - 0.5) * 70, ty: gy + (Math.random() - 0.5) * 45,
          y: gy - 540 - Math.random() * 320, v: 65 + Math.random() * 40,
          r: (6 + Math.random() * 5) * (finale ? 1.25 : 1),
          fromBoss: !s.friendly, kind: Math.random() < 0.16 ? 3 : Math.random() * 3 | 0,
          rot: Math.random() * TAU, drift: (Math.random() - 0.5) * 30, mega: false
        });
      }
    }
    // méga-cristaux de la finale : un toutes les ~0,9 s
    if (finale) {
      s.megaT -= dt;
      if (s.megaT <= 0) {
        s.megaT = 0.9;
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * s.r * 0.85;
        const x = Math.max(20, Math.min(worldW() - 20, s.x + Math.cos(a) * d));
        const y = Math.max(20, Math.min(worldH() - 20, s.y + Math.sin(a) * d));
        G.iceSpikes.push({
          x, ty: y, y: y - 620 - Math.random() * 200,
          v: 80 + Math.random() * 30, r: 15 + Math.random() * 5,
          fromBoss: !s.friendly, kind: 1, rot: Math.random() * TAU,
          drift: (Math.random() - 0.5) * 14, mega: true
        });
      }
    }
  }
  // zone gelée : les ennemis dedans sont figés (tempête + finale uniquement)
  if (active) {
    for (const e of G.enemies) {
      if (Math.hypot(e.x - s.x, e.y - s.y) < s.r + e.r) e.slow = Math.max(e.slow || 0, 1.4);
    }
    // aura de givre : dégâts continus dans la zone
    if (s.friendly) {
      s.tick += dt;
      if (s.tick >= 0.5) {
        s.tick = 0;
        for (const e of G.enemies) {
          if (Math.hypot(e.x - s.x, e.y - s.y) < s.r + e.r) {
            const red = e.type === 'finalBossGlace' ? 0.25 : 1;
            damageEnemy(e, G.player.attackDamage * 0.55 * waveBonus() * red, Math.atan2(e.y - s.y, e.x - s.x));
            e.frozen = Math.max(e.frozen || 0, 1.2); // la zone fige visuellement
            spawnParticles(e.x, e.y - e.r, '#b3e5fc', 3, 3); // gerbe de givre
          }
        }
      }
    }
    // brouillard glacé : nappes douces dérivant au ras du sol
    if (Math.random() < dt * 14) {
      G.particles.push({
        x: s.x + (Math.random() - 0.5) * s.r * 1.7,
        y: s.y + (Math.random() - 0.5) * s.r * 1.0,
        vx: (Math.random() - 0.5) * 0.5, vy: -0.12 - Math.random() * 0.18,
        life: 80, maxLife: 80, color: 'rgba(186,222,255,0.08)', r: 26 + Math.random() * 32
      });
    }
    // les nuages de la tempête déversent neige et grêlons de glace
    if (Math.random() < dt * 55) {
      const c = stormCloudXY(s, Math.floor(Math.random() * 3), G.time);
      const flake = Math.random() < 0.62;
      G.particles.push({
        x: c.x + (Math.random() - 0.5) * 130 * c.s,
        y: c.y + 30 * c.s,
        vx: (Math.random() - 0.5) * (flake ? 1.1 : 0.4),
        vy: flake ? 0.8 + Math.random() * 0.9 : 3.6 + Math.random() * 2.2,
        life: flake ? 75 : 42, maxLife: flake ? 75 : 42,
        color: flake ? (Math.random() < 0.5 ? '#ffffff' : '#e1f5fe') : '#9fd8f5',
        r: flake ? 2.2 + Math.random() * 2.2 : 1.4 + Math.random() * 1.6
      });
    }
  }
  // EXPLOSION FINALE : dernière vague + déflagration glaciale
  if (s.t <= 0 && !s.boomed) {
    s.boomed = true;
    G.rings.push({ x: s.x, y: s.y, r: 20, maxR: s.r * 1.15, life: 42, maxLife: 42, color: '#e1f5fe' });
    G.rings.push({ x: s.x, y: s.y, r: 10, maxR: s.r * 0.8, life: 30, maxLife: 30, color: '#ffffff' });
    G.screenShake = Math.max(G.screenShake, 16);
    G.screenFlash = Math.max(G.screenFlash || 0, 0.45);
    spawnParticles(s.x, s.y - 40, '#e1f5fe', 60, 12);
    spawnParticles(s.x, s.y - 40, '#4fc3f7', 40, 10);
    spawnParticles(s.x, s.y - 40, '#ffffff', 30, 8);
    // immense nappe de givre laissée par l'onde finale
    G.iceFrost.push({ x: s.x, y: s.y, r: s.r * 0.95, life: 9, maxLife: 9 });
    sfxIceEnd(); sfxWave(); // expiration glacée + gong de la dernière onde
    for (const e of [...G.enemies]) {
      if (Math.hypot(e.x - s.x, e.y - s.y) < s.r + e.r) {
        const red = e.type === 'finalBossGlace' ? 0.25 : 1;
        damageEnemy(e, G.player.attackDamage * 5 * waveBonus() * red, Math.atan2(e.y - s.y, e.x - s.x));
        e.slow = Math.max(e.slow || 0, 7);
        e.frozen = Math.max(e.frozen || 0, 3.5);
      }
    }
    // derniers cristaux géants pour la chute d'éclats finale
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * s.r * 0.8;
      G.skyIcicles.push({
        x: clampW(s.x + Math.cos(a) * d), y: clampH(s.y + Math.sin(a) * d) - 720 - Math.random() * 200,
        ty: clampH(s.y + Math.sin(a) * d),
        v: 150 + Math.random() * 50, r: 18 + Math.random() * 8,
        rot: (Math.random() - 0.5) * 0.4
      });
    }
  }
  if (s.t <= 0) G.iceStorm = null;
}

// ---------- ULTIME : TITAN DE FEU (trône du Baron de l'Enfer) ----------
// Le héros se transforme en titan de feu pendant 10 s : il est plus grand,
// entouré de flammes, et son attaque devient un laser de feu dévastateur.
// Cette ultime est la plus lente à charger (×0,5 aux gains de charge).
export function doHellUlt() {
  const p = G.player;
  p.ultCharge = 0;
  G.ultsUsed++;
  G.hellUlts = (G.hellUlts || 0) + 1;
  // TITAN DE FEU : PV triplés pendant la transformation (10 s)
  p._titanMax = p.maxHp;
  p.maxHp = p._titanMax * 3;
  p.hp = Math.min(p.maxHp, p.hp + p._titanMax * 2); // +200 % des PV max en bonus
  // une seule main de feu par transformation
  p.handUsed = false;
  p.ultActive = 10;   // durée de la transformation
  p.ultAnim = 0.9;    // flash de transformation
  G.screenShake = Math.max(G.screenShake, 16);
  G.screenFlash = Math.max(G.screenFlash, 0.5);
  G.rings.push({ x: p.x, y: p.y, r: p.r, maxR: 300, life: 42, maxLife: 42, color: '#ff7043' });
  spawnParticles(p.x, p.y - 20, '#ff7043', 50, 11);
  spawnParticles(p.x, p.y - 20, '#ffd740', 30, 10);
  addDamageText(p.x, p.y - 90, '🔥 TITAN DE FEU 🔥', '#ffab91');
  sfxHellTransform(); // rugissement de transformation : montée de feu + battements
}

// laser de feu : faisceau persistant qui brûle tout sur son passage.
// Disponible uniquement pendant la transformation (ultActive > 0).
function explodeNuke(x, y) {
  sfxNuke();
  const R = G.player.ultRadius * (G.equip ? G.equip.ultR : 1);
  const bossPct = 0.7 + (G.equip ? G.equip.ultBoss : 0);
  G.mushroom = { x, y, t: 0 };
  G.screenFlash = 1;
  G.screenShake = 30;
  // quadruple anneau de choc (souffle + débris)
  G.rings.push({ x, y, r: 30, maxR: R * 1.7, life: 40, maxLife: 40, color: '#ff1744' });
  G.rings.push({ x, y, r: 15, maxR: R * 1.3, life: 32, maxLife: 32, color: '#ffd740' });
  G.rings.push({ x, y, r: 8,  maxR: R,       life: 24, maxLife: 24, color: '#ffffff' });
  G.rings.push({ x, y, r: 5,  maxR: R * 0.6, life: 18, maxLife: 18, color: '#ff8a65' });
  // boule de feu : gerbe incandescente
  const cols = ['#fff59d', '#ffd740', '#ff7043', '#ff1744', '#ffffff'];
  for (let i = 0; i < 170; i++) {
    const a = Math.random() * TAU, s = 4 + Math.random() * 14;
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3,
      life: 40 + Math.random() * 30, maxLife: 70,
      color: cols[i % cols.length], r: 3 + Math.random() * 4
    });
  }
  // panache de fumée qui s'élève
  for (let i = 0; i < 55; i++) {
    const a = Math.random() * TAU, s = 1 + Math.random() * 3.5;
    G.particles.push({
      x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 40,
      vx: Math.cos(a) * s, vy: -2 - Math.random() * 4,
      life: 60 + Math.random() * 40, maxLife: 100,
      color: Math.random() < 0.5 ? '#455a64' : '#78909c',
      r: 6 + Math.random() * 8
    });
  }
  spawnParticles(x, y, '#8d6e63', 30, 9); // débris de sol
  // zone de feu persistante élargie
  G.fireZones.push({ x, y, r: R * 0.7, dps: 80, life: 6, maxLife: 6, tick: 0 });
  // cratère au sol : trace brûlée visible ~10 s
  G.craters.push({ x, y, r: R * 0.62, t: 10, maxT: 10 });
  // dégâts : mort instantanée, boss/mini-boss perdent un % de PV max
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist < R + e.r) {
      const a = Math.atan2(e.y - y, e.x - x);
      if (e.isBoss || e.isMini) {
        // le boss final résiste à la bombe : seulement ~4-6% de ses PV max
        // (les autres boss perdent 70%+ — sinon la bombe le one-shot)
        // le Souverain de Glace est encore plus résistant : ~1,5-3 % seulement
        const pct = e.type === 'finalBoss'
          ? 0.04 + (G.equip ? G.equip.ultBoss : 0) * 0.04
          : e.type === 'finalBossGlace'
            ? 0.015 + (G.equip ? G.equip.ultBoss : 0) * 0.015
            : bossPct;
        damageEnemy(e, e.maxHp * pct, a);
      } else { e.hp = 0; damageEnemy(e, e.maxHp, a); }
    }
  }
  addDamageText(x, y - 60, '☢ ARMAGEDDON', '#ffd740');
}

// ---------- EFFETS : DÉLUGE ACIDE (zones et pluie partagées boss/événements) ----------
export function updateSewerUlt(dt) {
  const p = G.player;
  // pluie de vase : gouttelettes acides tombent du plafond
  if (G.acidRain > 0) {
    G.acidRain -= dt;
    if (Math.random() < dt * 22) {
      const x = p.x + (Math.random() - 0.5) * 1200;
      const y = p.y - 320 - Math.random() * 200;
      G.projectiles.push({
        x, y, vx: (Math.random() - 0.5) * 0.8, vy: 7.5 + Math.random() * 2.5,
        life: 2.4, r: 7, dmg: p.attackDamage * 0.9 * waveBonus(),
        color: '#aeea00', acid: true, fromUlt: true
      });
    }
    // nouveaux geysers sporadiques pendant la pluie
    if (Math.random() < dt * 2.2) {
      const a = Math.random() * TAU, d = 120 + Math.random() * 240;
      const x = Math.max(50, Math.min(worldW() - 50, p.x + Math.cos(a) * d));
      const y = Math.max(50, Math.min(worldH() - 50, p.y + Math.sin(a) * d));
      G.acidZones.push({ x, y, r: 70 + Math.random() * 50, life: 11, maxLife: 11, tick: 0 });
      spawnParticles(x, y, '#aeea00', 18, 8);
    }
    if (G.acidRain <= 0) addDamageText(p.x, p.y - 70, '🧪 FIN DE LA PLUIE DE VASE', '#dce775');
  }
  // flaques d'acide : dégâts continus + poison, puis résorption
  for (let i = G.acidZones.length - 1; i >= 0; i--) {
    const z = G.acidZones[i];
    z.life -= dt; z.tick -= dt;
    if (Math.random() < dt * 14) {
      G.particles.push({
        x: z.x + (Math.random() - 0.5) * z.r * 1.4, y: z.y + (Math.random() - 0.5) * z.r * 0.6,
        vx: (Math.random() - 0.5) * 0.6, vy: -0.8 - Math.random() * 1.4,
        life: 26, maxLife: 26,
        color: Math.random() < 0.6 ? '#aeea00' : '#558b2f',
        r: 2 + Math.random() * 2.6
      });
    }
    if (z.tick <= 0) {
      z.tick = 0.35;
      const dmg = p.attackDamage * 1.5 * waveBonus();
      for (const e of [...G.enemies]) {
        if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
          const red = e.type === 'finalBossEgout' ? 0.3 : e.type === 'finalBoss' || e.type === 'finalBossGlace' || e.type === 'finalBossEnfer' || e.type === 'finalBossSpace' ? 0.5 : 1;
          damageEnemy(e, dmg * red, Math.atan2(e.y - z.y, e.x - z.x));
          e.slow = Math.max(e.slow || 0, 0.45); // dissolution
          e.poisonT = Math.max(e.poisonT || 0, 2); // le vase empoisonne
        }
      }
    }
    if (z.life <= 0) G.acidZones.splice(i, 1);
  }
}

// ---------- EFFETS : TROU NOIR (aspiration et effondrement partagés boss/événements) ----------
export function updateSpaceUlt(dt) {
  const p = G.player;
  // tempête de void : micro-trous noirs orbitaux qui tirent des rayons
  if (G.voidStorm > 0) {
    G.voidStorm -= dt;
    if (Math.random() < dt * 16) {
      // rayon de vide : projectile violet homing vers un ennemi proche
      const foes = G.enemies.filter(e => !e.bossDying);
      if (foes.length) {
        const e = foes[Math.floor(Math.random() * foes.length)];
        const a = Math.random() * TAU;
        G.projectiles.push({
          x: p.x + Math.cos(a) * 320, y: p.y + Math.sin(a) * 320,
          vx: 0, vy: 0, life: 1.4, r: 8,
          dmg: p.attackDamage * 1.1 * waveBonus(), color: '#b388ff',
          voidBolt: true, tx: e, home: 5.5
        });
      }
    }
    if (Math.random() < dt * 5) spawnParticles(p.x + (Math.random() - 0.5) * 700, p.y + (Math.random() - 0.5) * 500, '#7e57c2', 2, 3);
    if (G.voidStorm <= 0) addDamageText(p.x, p.y - 70, '✨ FIN DE LA TEMPÊTE DE VOID ✨', '#b388ff');
  }
  // trous noirs : aspiration + dégâts de marée, puis implosion
  for (let i = G.blackHoles.length - 1; i >= 0; i--) {
    const h = G.blackHoles[i];
    h.life -= dt; h.tick -= dt; h.pull = Math.min(1, h.pull + dt * 0.5);
    // disque d'accrétion : particules spiralées aspirées
    if (Math.random() < dt * 40) {
      const a = Math.random() * TAU, d = 150 + Math.random() * 90;
      G.particles.push({
        x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d,
        vx: -Math.cos(a) * (2 + h.pull * 4) + Math.sin(a) * 1.5,
        vy: -Math.sin(a) * (2 + h.pull * 4) - Math.cos(a) * 1.5,
        life: 30, maxLife: 30,
        color: Math.random() < 0.6 ? '#b388ff' : '#80d8ff',
        r: 1.5 + Math.random() * 2.2
      });
    }
    // aspiration des ennemis (les boss finaux résistent)
    for (const e of [...G.enemies]) {
      if (e.bossDying || e.graceT > 0) continue;
      const dx = h.x - e.x, dy = h.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 30 && d < 420) {
        const f = (e.isBoss || e.isMini ? 0.15 : 1) * (1 - d / 460) * 6 * h.pull;
        e.x = clampW(e.x + (dx / d) * f * dt * 60 * 0.16);
        e.y = clampH(e.y + (dy / d) * f * dt * 60 * 0.16);
      }
    }
    // dégâts de marée : tout ce qui est aspiré se fait déchirer
    if (h.tick <= 0) {
      h.tick = 0.3;
      const dmg = p.attackDamage * 2.4 * waveBonus();
      for (const e of [...G.enemies]) {
        const d = Math.hypot(e.x - h.x, e.y - h.y);
        if (d < 130 + e.r) {
          const red = e.type === 'finalBossSpace' ? 0.22 : e.type === 'finalBoss' || e.type === 'finalBossGlace' || e.type === 'finalBossEnfer' || e.type === 'finalBossEgout' ? 0.45 : 1;
          damageEnemy(e, dmg * red, Math.atan2(e.y - h.y, e.x - h.x));
        }
      }
    }
    // implosion : le trou s'effondre en déflagration
    if (h.life <= 0) {
      G.blackHoles.splice(i, 1);
      const R = 380;
      G.rings.push({ x: h.x, y: h.y, r: 20, maxR: R, life: 30, maxLife: 30, color: '#b388ff' });
      G.rings.push({ x: h.x, y: h.y, r: 10, maxR: R * 0.65, life: 24, maxLife: 24, color: '#e1bee7' });
      G.screenShake = Math.max(G.screenShake, 24);
      G.screenFlash = Math.max(G.screenFlash, 0.6);
      const cols = ['#b388ff', '#7e57c2', '#e1bee7', '#ffffff', '#80d8ff'];
      for (let k = 0; k < 90; k++) {
        const a = Math.random() * TAU, s = 5 + Math.random() * 16;
        G.particles.push({
          x: h.x, y: h.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 36 + Math.random() * 26, maxLife: 62,
          color: cols[k % cols.length], r: 2 + Math.random() * 3.4
        });
      }
      sfxBossAtk('void');
      const dmg = p.attackDamage * 5 * waveBonus();
      for (const e of [...G.enemies]) {
        const d = Math.hypot(e.x - h.x, e.y - h.y);
        if (d < R + e.r) {
          const red = e.type === 'finalBossSpace' ? 0.3 : e.type.startsWith('finalBoss') ? 0.5 : 1;
          damageEnemy(e, dmg * red, Math.atan2(e.y - h.y, e.x - h.x));
        }
      }
      addDamageText(h.x, h.y - 50, '💥 EFFONDREMENT !', '#e1bee7');
    }
  }
}
