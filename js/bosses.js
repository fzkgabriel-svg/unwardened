import { G, ctx, W, H, TAU, VERSION, finalWave, saveStats } from './state.js';
import { spawnEnemy, spawnMinibossWave, spawnBossWave, spawnFinalBoss, damageEnemy, enemyTypes } from './enemies.js';
import { doSlash, doSpin, doThrust, doUlt, doShield, doFireLaser, doFireHand, updateNuke, updateIceUlt, updateLasers, updateHands, updateVolcanoes, updateSewerUlt, updateSpaceUlt } from './attacks.js';
import { updateEffects, addDamageText, spawnParticles } from './effects.js';
import { drawBackground, drawEnemy, drawDrops, drawPlayer, drawSlashArc, drawUltFlash, drawMushroom, drawBomber, drawEffects, drawFireZones, drawCraters, drawPortals, drawProjectiles, drawLightnings, drawGrain, drawClouds, dayNight, drawTerrain, drawBuildings, drawWorldPortals, drawObstacle, drawIceStorm, drawLasers, drawHands, drawVolcanoes, drawAcidZones, drawBlackHoles, drawVoidHole } from './graphics.js';
import { checkAchievements } from './achievements.js';
import { wearEquipment, addMaterial } from './inventory.js';
import { drawHUD, drawAchToast, drawWarnToast } from './hud.js';
import { drawMenu, drawGameOver, drawPauseMenu, drawVictory, recordRun, drawAdminMenu, drawAdminButton, drawDurWarnPopup } from './menu.js';
import { initWorlds, updateCamera, worldW, worldH, checkWavePortal, syncCamera, resolveObstacles, curWorld } from './world.js';
import { drawMusicButton, sfxHurt, sfxWave, sfxPickup, sfxBreak, sfxBoss, sfxWarn, sfxPhase, sfxBossAtk } from './audio.js';
import { updateTutorial, drawTutorial } from './tutorial.js';
import { tickPlaytime } from './chars.js';
import { damagePlayer } from './main.js';

// ---------- MOUVEMENTS SIGNATURE DES BOSS FINAUX ----------
// Seigneur Oublié : s'enfouit sous terre puis refait surface en éruption,
// onde sismique, rafale de projectiles d'ombre.
// Souverain de Glace : pluie de piques, murs de glace, éventail de shards,
// lame de glace. Chaque mouvement est précédé d'un temps de télégraphe.

const clampW = (v) => Math.max(40, Math.min(worldW() - 40, v));
const clampH = (v) => Math.max(40, Math.min(worldH() - 40, v));

// phases du boss final : 66 % de PV -> phase 2, 33 % -> phase 3 (énervé)
function bossPhase(e) {
  const r = e.hp / e.maxHp;
  return r <= 0.33 ? 2 : r <= 0.66 ? 1 : 0;
}

function advanceBossPhase(e, phase) {
  e.phase = phase;
  const hell = e.type === 'finalBossEnfer';
  const frozen = e.type === 'finalBossGlace';
  const ephase = e.type === 'finalBossEgout';
  const esac = e.type === 'finalBossSpace';
  const names = hell
    ? ['', '🔥 FUREUR DU BARON', '☠️ RAGE DE L\'ENFER']
    : frozen
      ? ['', '❄ GLACIATION', '🔥 FUREUR GLACIALE']
      : ephase
        ? ['', '☣ FURIE TOXIQUE', '👑 FUREUR DU TYRAN']
        : esac
          ? ['', '🌀 FUREUR COSMIQUE', '💀 ABOMINATION']
          : ['', '😡 COLÈRE ANCESTRALE', '💀 FUREUR DU ROI OUBLIÉ'];
  const col = hell ? '#ffab00' : frozen ? '#80d8ff' : ephase ? '#aeea00' : esac ? '#b388ff' : '#e040fb';
  addDamageText(G.player.x, G.player.y - 90, names[phase], col);
  addDamageText(e.x, e.y - e.r - 40, names[phase], col);
  // enragé : plus rapide, plus douloureux, attaque plus souvent
  e.speed *= 1.18; e.damage *= 1.18;
  e.moveCd = Math.min(e.moveCd || 0, 2.2);
  // bouclier de phase : 10 s de protection (dégâts réduits à 15 %)
  e.shieldT = 10;
  bossSuperAttack(e, phase); // super attaque déclenchée par le changement de phase
  G.screenShake = Math.max(G.screenShake, 16);
  G.screenFlash = Math.max(G.screenFlash, 0.5);
  G.rings.push({ x: e.x, y: e.y, r: e.r * 0.5, maxR: 320, life: 36, maxLife: 36, color: col });
  spawnParticles(e.x, e.y, col, 40, 9);
  spawnParticles(e.x, e.y, '#ffffff', 20, 8);
  // second anneau qui s'estompe + débris de phase
  G.rings.push({ x: e.x, y: e.y, r: e.r * 0.8, maxR: 210, life: 28, maxLife: 28, color: '#ffffff' });
  spawnParticles(e.x, e.y - e.r, '#ffffff', 14, 12);
  sfxPhase(); // sting dramatique de transition
}

// super attaque déclenchée à chaque changement de phase du boss final
function bossSuperAttack(e, phase) {
  const p = G.player;
  const hell = e.type === 'finalBossEnfer';
  const frozen = e.type === 'finalBossGlace';
  const ephase = e.type === 'finalBossEgout';
  const esac = e.type === 'finalBossSpace';
  const power = 1 + phase * 0.5; // plus mortel à la phase 3
  if (ephase) {
    // super attaque des égouts : geysers d'acide en cercle + gerbe de vases
    const n = 8 + phase * 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.4;
      const d = 120 + Math.random() * 260;
      const x = clampW(p.x + Math.cos(a) * d), y = clampH(p.y + Math.sin(a) * d);
      G.acidZones.push({ x, y, r: 80 + Math.random() * 40, life: 8, maxLife: 8, tick: 0 });
      G.rings.push({ x, y, r: 6, maxR: 60, life: 20, maxLife: 20, color: '#aeea00' });
      spawnParticles(x, y, '#aeea00', 16, 7);
    }
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < 11; i++) {
      const a = base + (i - 5) * 0.2;
      G.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 5.2, vy: Math.sin(a) * 5.2, life: 2.6, r: 8, dmg: e.damage * 0.75 * power, color: '#aeea00', acid: true });
    }
    G.shockwaves.push({ x: e.x, y: e.y, r: e.r, maxR: 420, speed: 13, dmg: e.damage * 1.35 * power, hit: false, color: '#aeea00', slow: 1.1 });
    G.screenShake = Math.max(G.screenShake, 20);
    G.screenFlash = Math.max(G.screenFlash, 0.6);
    spawnParticles(e.x, e.y, '#aeea00', 50, 10);
    spawnParticles(e.x, e.y, '#33691e', 30, 10);
    return;
  }
  if (esac) {
    // super attaque spatiale : mini-trous noirs + rayon de vide en spirale
    for (let i = 0; i < 3 + phase; i++) {
      const a = Math.random() * TAU, d = 100 + Math.random() * 240;
      const x = clampW(p.x + Math.cos(a) * d), y = clampH(p.y + Math.sin(a) * d);
      G.blackHoles.push({ x, y, r: 70, life: 5, maxLife: 5, tick: 0, pull: 0.6 });
      spawnParticles(x, y, '#b388ff', 18, 8);
    }
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < 13; i++) {
      const a = base + (i - 6) * 0.16;
      G.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 6.4, vy: Math.sin(a) * 6.4, life: 2.6, r: 9, dmg: e.damage * 0.8 * power, color: '#b388ff', bolt: true });
    }
    G.shockwaves.push({ x: e.x, y: e.y, r: e.r, maxR: 440, speed: 14, dmg: e.damage * 1.4 * power, hit: false, color: '#b388ff', slow: 0.9 });
    G.rings.push({ x: e.x, y: e.y, r: e.r, maxR: 400, life: 36, maxLife: 36, color: '#b388ff' });
    G.screenShake = Math.max(G.screenShake, 20);
    G.screenFlash = Math.max(G.screenFlash, 0.65);
    spawnParticles(e.x, e.y, '#7e57c2', 45, 10);
    spawnParticles(e.x, e.y, '#e1bee7', 30, 11);
    return;
  }
  if (hell) {
    // super attaque : impacts de braise en cercle + rafale de boules de feu
    const n = 8 + phase * 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.4;
      const d = 120 + Math.random() * 260;
      const x = clampW(p.x + Math.cos(a) * d), y = clampH(p.y + Math.sin(a) * d);
      G.shockwaves.push({ x, y, r: 8, maxR: 100, speed: 12, dmg: e.damage * 0.6 * power, hit: false, color: '#ff7043', slow: 0.9 });
    }
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < 12; i++) {
      const a = base + (i - 5.5) * 0.18;
      G.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 6.0, vy: Math.sin(a) * 6.0, life: 2.8, r: 10, dmg: e.damage * 0.85 * power, color: '#ff7043', fire: true });
    }
    G.shockwaves.push({ x: e.x, y: e.y, r: e.r, maxR: 460, speed: 13, dmg: e.damage * 1.4 * power, hit: false, color: '#ff7043', slow: 1.2 });
    G.screenShake = Math.max(G.screenShake, 22);
    G.screenFlash = Math.max(G.screenFlash, 0.7);
    spawnParticles(e.x, e.y, '#ffab00', 55, 11);
    spawnParticles(e.x, e.y, '#ff5252', 30, 10);
    return;
  }
  if (frozen) {
    // tornade de pics de glace autour du joueur
    for (let i = 0; i < 18 + phase * 6; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 340;
      const x = clampW(p.x + Math.cos(a) * d), y = clampH(p.y + Math.sin(a) * d);
      G.iceSpikes.push({ x, ty: y, y: y - 520 - Math.random() * 260, v: 15 + Math.random() * 8, r: 8 + Math.random() * 6, fromBoss: true });
    }
    // mur de glace encerclant + éventail de shards
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      G.iceWalls.push({ x: clampW(e.x + Math.cos(a) * 170), y: clampH(e.y + Math.sin(a) * 170), r: 34, life: 8, maxLife: 8 });
    }
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < 13; i++) {
      const a = base + (i - 6) * 0.16;
      G.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 6.2, vy: Math.sin(a) * 6.2, life: 2.8, r: 9, dmg: e.damage * 0.8 * power, color: '#81d4fa' });
    }
    G.shockwaves.push({ x: e.x, y: e.y, r: e.r, maxR: 420, speed: 11, dmg: e.damage * 1.3 * power, hit: false, color: '#b3e5fc', slow: 2.2 });
    if (!G.iceStorm) G.iceStorm = { t: 4, x: e.x, y: e.y, r: 420, spawnT: 0 }; // micro-tempête glacée autour du boss
  } else {
    // super éruption : onde sismique géante + ombres en spirale
    G.shockwaves.push({ x: p.x, y: p.y, r: 10, maxR: 520, speed: 15, dmg: e.damage * 1.6 * power, hit: false, color: '#ff7043', slow: 1.2 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + G.time;
      G.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 5.6, vy: Math.sin(a) * 5.6, life: 2.8, r: 9, dmg: e.damage * 0.75 * power, color: '#ce93d8' });
    }
    G.rings.push({ x: e.x, y: e.y, r: e.r, maxR: 380, life: 40, maxLife: 40, color: '#e040fb' });
    spawnParticles(e.x, e.y, '#a1887f', 50, 10);
    spawnParticles(e.x, e.y, '#e040fb', 30, 11);
  }
  G.screenShake = Math.max(G.screenShake, 20);
  G.screenFlash = Math.max(G.screenFlash, 0.65);
}

// facteur de rythme selon la phase : les télégraphes et pauses raccourcissent
function phasePace(e) {
  return [1, 0.72, 0.5][e.phase || 0];
}

function startBossMove(e, p) {
  const hell = e.type === 'finalBossEnfer';
  const frozen = e.type === 'finalBossGlace';
  const ephase = e.type === 'finalBossEgout';
  const esac = e.type === 'finalBossSpace';
  const pace = phasePace(e);
  const roll = Math.random();
  const mk = (kind, t, extra = {}) => {
    e.bossMove = { kind, t: t * pace, dur: t * pace, tx: p.x, ty: p.y, ...extra };
  };
  if (ephase) {
    if (roll < 0.30)      mk('acidrain', 1.1, { track: true }); // pluie de vases sur le joueur
    else if (roll < 0.55) mk('acidgout', 0.9, { track: true }); // gerbe de projectiles acides
    else if (roll < 0.80) mk('geysers', 1.0, { track: true });  // geysers autour du joueur
    else                  mk('slam', 1.0, { track: true });     // onde de vase
  } else if (esac) {
    if (roll < 0.30)      mk('voidrain', 1.0, { track: true }); // pluies de bolts de void
    else if (roll < 0.55) mk('blackhole', 1.0);                // mini-trou noir sous le boss
    else if (roll < 0.80) mk('volley', 0.85, { track: true }); // éventail de bolts stellaires
    else                  mk('slam', 0.95, { track: true });    // onde de choc gravitationnelle
  } else if (hell) {
    if (roll < 0.30)      mk('meteor', 1.1, { track: true });  // pluie de météores sur le joueur
    else if (roll < 0.55) mk('volley', 0.9, { track: true });  // rafale de boules de feu
    else if (roll < 0.80) mk('slam', 1.0, { track: true });    // lame de braise
    else                  mk('ringfire', 1.0);                 // anneau de feu autour de lui
  } else if (frozen) {
    if (roll < 0.28)      mk('volley', 1.0, { track: true }); // pluie de piques sur le joueur
    else if (roll < 0.52) mk('walls', 1.1);                   // murs de glace devant lui
    else if (roll < 0.78) mk('fan', 0.9, { track: true });     // éventail de shards de glace
    else                  mk('slam', 1.0, { track: true });    // lame de glace
  } else {
    if (roll < 0.34)      mk('burrow', 0.9);                  // s'enfouit sous terre
    else if (roll < 0.62) mk('slam', 1.0, { track: true });    // onde sismique
    else                  mk('volley', 0.8, { track: true });  // rafale d'ombres
  }
  e.moveCd = (ephase ? 4.4 : esac ? 4.8 : hell ? 4.2 : frozen ? 4.6 : 5.6) * pace;
}

export function updateFinalBoss(e, dt, p) {
  // changement de phase à 66 % et 33 % de PV
  const want = bossPhase(e);
  if (want > (e.phase || 0)) advanceBossPhase(e, want);
  e.moveCd = (e.moveCd === undefined ? 5.5 : e.moveCd) - dt;
  if (!e.bossMove && e.moveCd <= 0 && e.attackCooldown <= 0) startBossMove(e, p);
  const m = e.bossMove;
  if (!m) return;
  m.t -= dt;
  if (m.track) { m.tx = p.x; m.ty = p.y; } // la cible suit le joueur (dodgeable)
  // fumée de préparation pendant le télégraphe
  if (m.t > 0 && Math.random() < dt * 22) {
    spawnParticles(m.tx + (Math.random() - 0.5) * 60, m.ty + (Math.random() - 0.5) * 40,
      e.type === 'finalBossGlace' ? '#b3e5fc' : e.type === 'finalBossEnfer' ? '#ff7043'
        : e.type === 'finalBossEgout' ? '#aeea00' : e.type === 'finalBossSpace' ? '#b388ff' : '#8d6e63', 2, 3);
  }
  if (m.t <= 0) { execBossMove(e, m, p); e.bossMove = null; }
}

function execBossMove(e, m, p) {
  const hell = e.type === 'finalBossEnfer';
  const frozen = e.type === 'finalBossGlace';
  const ephase = e.type === 'finalBossEgout';
  const esac = e.type === 'finalBossSpace';
  // chaque mouvement signature a son timbre : feu, glace, ombres, terre, vase ou void
  sfxBossAtk(ephase ? 'acid' : esac ? 'void' : hell ? 'fire' : frozen ? 'ice' : 'shadow');
  switch (m.kind) {
    case 'acidrain': {
      // pluie de vases acides autour du joueur
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 300;
        const x = clampW(m.tx + Math.cos(a) * d), y = clampH(m.ty + Math.sin(a) * d);
        G.projectiles.push({
          x, y: y - 420 - Math.random() * 160, vx: 0, vy: 7 + Math.random() * 3,
          life: 2.6, r: 7, dmg: e.damage * 0.5, color: '#aeea00', acid: true
        });
      }
      spawnParticles(m.tx, m.ty, '#aeea00', 20, 7);
      G.screenShake = Math.max(G.screenShake, 8);
      break;
    }
    case 'acidgout': {
      // gerbe de 7 projectiles acides en éventail
      const base = Math.atan2(m.ty - e.y, m.tx - e.x);
      for (let i = -3; i <= 3; i++) {
        const a = base + i * 0.2;
        G.projectiles.push({
          x: e.x, y: e.y, vx: Math.cos(a) * 5.0, vy: Math.sin(a) * 5.0,
          life: 2.4, r: 8, dmg: e.damage * 0.7, color: '#aeea00', acid: true
        });
      }
      spawnParticles(e.x, e.y - e.r * 0.4, '#aeea00', 14, 6);
      break;
    }
    case 'geysers': {
      // 5 geysers d'acide surgissent autour du joueur
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * TAU, d = 80 + Math.random() * 220;
        const x = clampW(m.tx + Math.cos(a) * d), y = clampH(m.ty + Math.sin(a) * d);
        G.acidZones.push({ x, y, r: 75 + Math.random() * 35, life: 7, maxLife: 7, tick: 0 });
        spawnParticles(x, y, '#aeea00', 14, 7);
      }
      G.screenShake = Math.max(G.screenShake, 10);
      break;
    }
    case 'voidrain': {
      // pluie de bolts de void depuis le ciel
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 300;
        const x = clampW(m.tx + Math.cos(a) * d), y = clampH(m.ty + Math.sin(a) * d);
        G.projectiles.push({
          x, y: y - 460 - Math.random() * 140, vx: 0, vy: 8.5 + Math.random() * 2.5,
          life: 2.2, r: 7, dmg: e.damage * 0.55, color: '#b388ff', bolt: true
        });
      }
      spawnParticles(m.tx, m.ty, '#b388ff', 18, 7);
      G.screenShake = Math.max(G.screenShake, 9);
      break;
    }
    case 'blackhole': {
      // mini-trou noir sous le boss : aspire et déchire
      G.blackHoles.push({ x: e.x, y: e.y, r: 85, life: 6, maxLife: 6, tick: 0, pull: 0.7 });
      G.rings.push({ x: e.x, y: e.y, r: e.r, maxR: 200, life: 22, maxLife: 22, color: '#b388ff' });
      spawnParticles(e.x, e.y, '#b388ff', 26, 8);
      break;
    }
    case 'meteor': {
      // pluie de météores : impacts de braise autour du joueur (choc = dégâts joueur)
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 300;
        const x = clampW(m.tx + Math.cos(a) * d), y = clampH(m.ty + Math.sin(a) * d);
        G.shockwaves.push({ x, y, r: 8, maxR: 90 + Math.random() * 50, speed: 11, dmg: e.damage * 0.55, hit: false, color: '#ff7043', slow: 0.8 });
        spawnParticles(x, y, '#ff7043', 10, 7);
      }
      G.screenShake = Math.max(G.screenShake, 14);
      break;
    }
    case 'ringfire': {
      // anneau de flammes autour du boss : tout ce qui touche brûle
      G.rings.push({ x: e.x, y: e.y, r: e.r, maxR: 340, life: 30, maxLife: 30, color: '#ff7043' });
      G.shockwaves.push({ x: e.x, y: e.y, r: e.r, maxR: 340, speed: 16, dmg: e.damage * 1.1, hit: false, color: '#ffab00', slow: 0.9 });
      // flammes persistantes : la zone reste brûlante quelques secondes
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * TAU, d = 120 + Math.random() * 160;
        const x = clampW(e.x + Math.cos(a) * d), y = clampH(e.y + Math.sin(a) * d);
        G.shockwaves.push({ x, y, r: 6, maxR: 70, speed: 9, dmg: e.damage * 0.4, hit: false, color: '#ff5252', slow: 0.7 });
      }
      G.screenShake = Math.max(G.screenShake, 13);
      spawnParticles(e.x, e.y, '#ffab00', 40, 10);
      break;
    }
    case 'burrow':
      e.burrow = { phase: 'sink', t: 0.8 };
      break;
    case 'slam': {
      // onde de choc au sol centrée sur la zone visée
      G.shockwaves.push({
        x: m.tx, y: m.ty, r: 12, maxR: 400, speed: hell ? 15 : frozen ? 10 : 12,
        dmg: e.damage * (hell ? 1.7 : 1.5), hit: false,
        color: hell ? '#ff7043' : frozen ? '#b3e5fc' : '#ff7043', slow: frozen ? 1.6 : 1.0
      });
      G.screenShake = Math.max(G.screenShake, 9);
      spawnParticles(m.tx, m.ty, hell ? '#ffab40' : frozen ? '#e1f5fe' : '#a1887f', 26, 8);
      break;
    }
    case 'volley':
      if (hell) {
        // rafale de 7 boules de feu en éventail vers le joueur
        const base = Math.atan2(m.ty - e.y, m.tx - e.x);
        for (let i = -3; i <= 3; i++) {
          const a = base + i * 0.22;
          G.projectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 5.6, vy: Math.sin(a) * 5.6,
            life: 2.5, r: 9, dmg: e.damage * 0.75, color: '#ff7043', fire: true
          });
        }
        spawnParticles(e.x, e.y - e.r * 0.4, '#ffab40', 16, 7); // gerbe de feu au lancement
      } else if (frozen) {
        // pluie de piques de glace autour du joueur (comme une mini Pluie de Glace)
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 280;
          const x = clampW(m.tx + Math.cos(a) * d), y = clampH(m.ty + Math.sin(a) * d);
          G.iceSpikes.push({ x, ty: y, y: y - 480 - Math.random() * 240, v: 13 + Math.random() * 7, r: 7 + Math.random() * 5, fromBoss: true });
        }
        spawnParticles(e.x, e.y - e.r * 0.4, '#e1f5fe', 16, 7);
        G.screenShake = Math.max(G.screenShake, 6);
      } else {
        // rafale de 5 projectiles d'ombre en éventail vers le joueur
        const base = Math.atan2(m.ty - e.y, m.tx - e.x);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.24;
          G.projectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 4.8, vy: Math.sin(a) * 4.8,
            life: 2.4, r: 8, dmg: e.damage * 0.7, color: '#ce93d8'
          });
        }
        spawnParticles(e.x, e.y - e.r * 0.4, '#ce93d8', 14, 6); // gerbe d'ombres
      }
      break;
    case 'walls': {
      // 4 murs de glace alignés entre le boss et le joueur : il faut contourner
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = 1; i <= 4; i++) {
        const d = 120 + i * 58;
        G.iceWalls.push({
          x: clampW(e.x + Math.cos(a) * d), y: clampH(e.y + Math.sin(a) * d),
          r: 30, life: 7, maxLife: 7
        });
      }
      spawnParticles(e.x, e.y, '#e1f5fe', 24, 7);
      G.screenShake = Math.max(G.screenShake, 7);
      break;
    }
    case 'fan': {
      // éventail de 9 shards de glace vers le joueur
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = 0; i < 9; i++) {
        const a = base + (i - 4) * 0.2;
        G.projectiles.push({
          x: e.x, y: e.y, vx: Math.cos(a) * 5.2, vy: Math.sin(a) * 5.2,
          life: 2.6, r: 8, dmg: e.damage * 0.75, color: '#81d4fa'
        });
      }
      spawnParticles(e.x, e.y - e.r * 0.4, '#81d4fa', 14, 6);
      G.screenShake = Math.max(G.screenShake, 5);
      break;
    }
  }
}

// cycles d'enfouissement du Seigneur Oublié : il coule, file sous terre
// vers le joueur puis refait surface en éruption
export function updateBurrow(e, dt, p) {
  const b = e.burrow;
  b.t -= dt;
  if (b.phase === 'sink') {
    if (b.t <= 0) {
      b.phase = 'hidden'; b.t = 2.1 * phasePace(e); // plus court quand il est enragé
      G.screenShake = Math.max(G.screenShake, 6);
      spawnParticles(e.x, e.y, '#8d6e63', 22, 7);
    }
  } else if (b.phase === 'hidden') {
    // avance rapide sous terre, laisse une trace de poussière
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.x = clampW(e.x + Math.cos(a) * e.speed * 4 * dt);
    e.y = clampH(e.y + Math.sin(a) * e.speed * 4 * dt);
    if (Math.random() < dt * 30) spawnParticles(e.x + (Math.random() - 0.5) * 30, e.y + (Math.random() - 0.5) * 20, '#a1887f', 1, 2);
    if (b.t <= 0) { b.phase = 'rise'; b.t = 0.55; }
  } else if (b.phase === 'rise') {
    if (Math.random() < dt * 35) spawnParticles(e.x + (Math.random() - 0.5) * e.r * 1.6, e.y + (Math.random() - 0.5) * e.r, '#a1887f', 2, 4);
    if (b.t <= 0) {
      e.burrow = null;
      e.moveCd = 6;
      sfxBossAtk('earth'); // le Seigneur refait surface dans un fracas de terre
      // éruption : anneau de terre + dégâts de zone
      G.rings.push({ x: e.x, y: e.y, r: e.r, maxR: 180, life: 24, maxLife: 24, color: '#ff7043' });
      spawnParticles(e.x, e.y, '#8d6e63', 42, 9);
      spawnParticles(e.x, e.y, '#ff7043', 26, 8);
      G.screenShake = Math.max(G.screenShake, 15);
      if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 75) {
        damagePlayer(e.damage * 1.7, 1.2);
      }
    }
  }
}

// pousse une entité hors des murs de glace (les deux camps butent dessus)
export function collideIceWalls(ent) {
  for (const wl of G.iceWalls) {
    const dx = ent.x - wl.x, dy = ent.y - wl.y;
    const d = Math.hypot(dx, dy), min = ent.r + wl.r;
    if (d > 0 && d < min) {
      const push = (min - d) / d;
      ent.x += dx * push; ent.y += dy * push;
    }
  }
}

