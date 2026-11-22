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

// ---------- ÉVÉNEMENTS DES ENFERS ----------
// braises flottantes, pluie de cendres, meute de démons, éruption volcanique
export function updateHellEvents(dt) {
  if (G.campaign !== 2 || G.state !== 'playing' || G.tutorial) return;
  const p = G.player;
  // ambiance permanente : braises qui montent du sol
  if (Math.random() < dt * 9) {
    spawnParticles(p.x + (Math.random() - 0.5) * 1100, p.y + (Math.random() - 0.5) * 700,
      Math.random() < 0.5 ? '#ff7043' : '#ffab00', 1, 1.6);
  }
  // pluie de cendres : fontaine de braises vers le haut (sans dégât)
  if (G.ashRain > 0) {
    G.ashRain -= dt;
    if (Math.random() < dt * 26) {
      spawnParticles(p.x + (Math.random() - 0.5) * 1200, p.y - 260 - Math.random() * 160,
        Math.random() < 0.6 ? '#ffab40' : '#ff5252', 1, 3);
    }
    if (G.ashRain <= 0) addDamageText(p.x, p.y - 70, '🌋 FIN DE LA PLUIE DE CENDRES', '#ff8a65');
  }
  // éruption : après télégraphe, zone de feu au sol sous le joueur
  if (G.hellEruption) {
    const ev = G.hellEruption;
    ev.t -= dt;
    if (ev.t <= 0 && !ev.done) {
      ev.done = true;
      G.fireZones.push({
        x: ev.x, y: ev.y, r: 120, dps: 45, life: 7, maxLife: 7, tick: 0
      });
      G.shockwaves.push({ x: ev.x, y: ev.y, r: 20, maxR: 260, speed: 14, dmg: 80, hit: false, color: '#ff7043' });
      G.screenShake = Math.max(G.screenShake, 16);
      G.screenFlash = Math.max(G.screenFlash, 0.5);
      spawnParticles(ev.x, ev.y, '#ffab00', 50, 11);
      spawnParticles(ev.x, ev.y, '#5d4037', 30, 9);
      addDamageText(p.x, p.y - 70, '🌋 ÉRUPTION !', '#ff7043');
    }
    if (ev.t <= -1.2) G.hellEruption = null;
  }
  // déclencheur périodique
  G.hellEventT -= dt;
  if (G.hellEventT > 0) return;
  G.hellEventT = 36 + Math.random() * 28; // prochain événement dans ~36-64 s
  const roll = Math.random();
  if (roll < 0.26) {
    // PLUIE DE CENDRES : 10 s de braises dense qui obscurcissent le ciel
    G.ashRain = 10;
    addDamageText(p.x, p.y - 60, '🌋 PLUIE DE CENDRES !', '#ff8a65');
    G.warnToast = { name: 'Le ciel s\'embrase — méfie-toi des éruptions', t: 4 };
  } else if (roll < 0.48) {
    // ÉRUPTION : télégraphe 1,4 s puis zone de feu + onde de choc sous le joueur
    G.hellEruption = { x: p.x, y: p.y, t: 1.4, done: false };
    addDamageText(p.x, p.y - 60, '⚠ ÉRUPTION IMMINENTE !', '#ff5252');
    sfxWarn();
  } else if (roll < 0.72) {
    // PACK DE DÉMONS : 2-3 créatures infernales surgissent autour du joueur
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = 60 + Math.random() * 130;
      const types = ['imp', 'imp', 'hound', 'cultist', 'demon'];
      spawnEnemy(types[Math.floor(Math.random() * types.length)], true,
        p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.5 + Math.random());
    }
    addDamageText(p.x, p.y - 60, '😈 PACK DE DÉMONS !', '#ff5252');
    sfxBoss();
  } else {
    // OFFRANDE DE BRAISES : matériaux infernaux + fiole au sol
    const loot = {};
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const m = ['or', 'essence', 'cristal', 'fer', 'emeraude'][Math.floor(Math.random() * 5)];
      loot[m] = (loot[m] || 0) + (2 + Math.floor(Math.random() * 5));
    }
    for (const m in loot) { addMaterial(G.inv, m, loot[m]); G.runMats[m] = (G.runMats[m] || 0) + loot[m]; }
    if (Math.random() < 0.5) { p.potions = Math.min(p.maxPotions, p.potions + 1); }
    addDamageText(p.x, p.y - 60, '🔥 OFFRANDE DE BRAISES !', '#ffab00');
    spawnParticles(p.x, p.y, '#ffab00', 20, 6);
  }
}

// ---------- ÉVÉNEMENTS DE THE FROZEN LAND ----------
// tempête de neige, avalanche, cache de ravitaillement, meute d'alphas
export function updateFrozenEvents(dt) {
  if (G.campaign !== 1 || G.state !== 'playing' || G.tutorial) return;
  const p = G.player;
  // tempête en cours : décrément + neige dense
  if (G.blizzard > 0) {
    G.blizzard -= dt;
    if (Math.random() < dt * 30) {
      spawnParticles(p.x + (Math.random() - 0.5) * 1400, p.y - 300 - Math.random() * 200,
        '#e3f2fd', 1, 2);
    }
    p.slowT = Math.max(p.slowT, dt * 0.4); // la neige ralentit légèrement
  }
  // avalanche : télégraphe 1,2 s puis souffle de neige mortel
  if (G.avalanche) {
    const av = G.avalanche;
    av.t -= dt;
    if (Math.random() < dt * 20) spawnParticles(av.x + (Math.random() - 0.5) * 160, av.y - 60 - Math.random() * 80, '#ffffff', 2, 4);
    if (av.t <= 0) {
      G.avalanche = null;
      G.rings.push({ x: av.x, y: av.y, r: 10, maxR: 190, life: 25, maxLife: 25, color: '#b3e5fc' });
      spawnParticles(av.x, av.y, '#ffffff', 40, 10);
      spawnParticles(av.x, av.y, '#90caf9', 25, 8);
      G.screenShake = 14;
      if (Math.hypot(p.x - av.x, p.y - av.y) < 200) {
        damagePlayer(30 * (1 - (G.equip ? G.equip.armorReduce : 0)), 1.0, { name: 'Avalanche', type: 'event' });
        p.slowT = Math.max(p.slowT, 1.8); // enseveli : très ralenti
      }
    }
  }
  // déclencheur périodique
  G.eventT -= dt;
  if (G.eventT > 0) return;
  G.eventT = 38 + Math.random() * 30; // prochain événement dans ~40-70 s
  const roll = Math.random();
  if (roll < 0.28) {
    // TEMPÊTE DE NEIGE : 12 s de blizzard + apparitions accélérées
    G.blizzard = 12;
    addDamageText(p.x, p.y - 60, '❄ TEMPÊTE DE NEIGE !', '#b3e5fc');
    G.warnToast = { name: 'La visibilité chute — la meute arrive plus vite', t: 4 };
  } else if (roll < 0.52) {
    // AVALANCHE : zone de souffle mortel centrée sur le joueur
    G.avalanche = { x: p.x, y: p.y, t: 1.2 };
    addDamageText(p.x, p.y - 60, '⚠ AVALANCHE !', '#ff8a65');
  } else if (roll < 0.74) {
    // CACHE DE RAVITAILLEMENT : matériaux + fiole abandonnés dans la neige
    const loot = {};
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const m = ['cristal', 'essence', 'fer', 'or', 'emeraude'][Math.floor(Math.random() * 5)];
      loot[m] = (loot[m] || 0) + (2 + Math.floor(Math.random() * 5));
    }
    for (const m in loot) { addMaterial(G.inv, m, loot[m]); G.runMats[m] = (G.runMats[m] || 0) + loot[m]; }
    if (Math.random() < 0.5) { p.potions = Math.min(p.maxPotions, p.potions + 1); }
    addDamageText(p.x, p.y - 60, '📦 CACHE DE RAVITAILLEMENT !', '#ffd740');
    spawnParticles(p.x, p.y, '#ffd740', 20, 6);
  } else {
    // MEUTE D'ALPHAS : 2-3 prédateurs d'élite surgissent autour du joueur
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = 60 + Math.random() * 120;
      spawnEnemy(Math.random() < 0.5 ? 'alpha' : 'hunter', true,
        p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.5 + Math.random());
    }
    addDamageText(p.x, p.y - 60, '🐺 MEUTE D\'ALPHAS !', '#ff5252');
    sfxBoss();
  }
}

// ---------- ÉVÉNEMENTS DES ÉGOUTS ----------
// dripping toxique, invasion de rats, geyser, cache de vase
export function updateSewerEvents(dt) {
  if (G.campaign !== 3 || G.state !== 'playing' || G.tutorial) return;
  const p = G.player;
  // ambiance permanente : gouttes de vase qui tombent
  if (Math.random() < dt * 10) {
    spawnParticles(p.x + (Math.random() - 0.5) * 1200, p.y - 280 - Math.random() * 160,
      Math.random() < 0.6 ? '#aeea00' : '#558b2f', 1, 3);
  }
  // geyser : télégraphe 1,1 s puis zone acide au sol
  if (G.sewerGeyser) {
    const g = G.sewerGeyser;
    g.t -= dt;
    if (Math.random() < dt * 22) spawnParticles(g.x + (Math.random() - 0.5) * 70, g.y - 60 - Math.random() * 70, '#aeea00', 2, 4);
    if (g.t <= 0) {
      G.sewerGeyser = null;
      G.acidZones.push({ x: g.x, y: g.y, r: 105, life: 8, maxLife: 8, tick: 0 });
      G.rings.push({ x: g.x, y: g.y, r: 10, maxR: 140, life: 26, maxLife: 26, color: '#aeea00' });
      G.screenShake = Math.max(G.screenShake, 12);
      spawnParticles(g.x, g.y, '#aeea00', 34, 9);
      spawnParticles(g.x, g.y, '#33691e', 20, 7);
      addDamageText(p.x, p.y - 70, '☣ GÉYSER D\'ACIDE !', '#dce775');
    }
  }
  // déclencheur périodique
  G.sewerEventT -= dt;
  if (G.sewerEventT > 0) return;
  G.sewerEventT = 34 + Math.random() * 26;
  const roll = Math.random();
  if (roll < 0.25) {
    // INVASION DE RATS : 4-6 rats géants sortent des grilles
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = 80 + Math.random() * 160;
      spawnEnemy('rat', true, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.5 + Math.random());
    }
    addDamageText(p.x, p.y - 60, '🐀 INVASION DE RATS !', '#ff8a80');
    sfxBoss();
  } else if (roll < 0.5) {
    // GÉYSER : zone d'acide toxique sous le joueur
    G.sewerGeyser = { x: p.x, y: p.y, t: 1.1 };
    addDamageText(p.x, p.y - 60, '⚠ GÉYSER D\'ACIDE !', '#aeea00');
    sfxWarn();
  } else if (roll < 0.72) {
    // NUAGE DE VASE : 8 s de gouttes acides toxiques
    G.acidRain = 8;
    addDamageText(p.x, p.y - 60, '☣ NUAGE DE VASE !', '#dce775');
    G.warnToast = { name: 'Le plafond suinte — reste mobile', t: 4 };
  } else {
    // CACHE DES ÉGOUTS : matériaux + fiole au fond de l'égout
    const loot = {};
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const m = ['fer', 'cristal', 'or', 'essence', 'emeraude'][Math.floor(Math.random() * 5)];
      loot[m] = (loot[m] || 0) + (2 + Math.floor(Math.random() * 5));
    }
    for (const m in loot) { addMaterial(G.inv, m, loot[m]); G.runMats[m] = (G.runMats[m] || 0) + loot[m]; }
    if (Math.random() < 0.5) { p.potions = Math.min(p.maxPotions, p.potions + 1); }
    addDamageText(p.x, p.y - 60, '🗑 CACHE DES ÉGOUTS !', '#ffd740');
    spawnParticles(p.x, p.y, '#aeea00', 20, 6);
  }
}

// ---------- ÉVÉNEMENTS DE L'ESPACE ----------
// débris, essaims aliens, micro-trou noir, cache spatial
export function updateSpaceEvents(dt) {
  if (G.campaign !== 4 || G.state !== 'playing' || G.tutorial) return;
  const p = G.player;
  // ambiance permanente : poussière d'étoiles qui dérive
  if (Math.random() < dt * 12) {
    spawnParticles(p.x + (Math.random() - 0.5) * 1300, p.y + (Math.random() - 0.5) * 800,
      Math.random() < 0.5 ? '#b388ff' : '#80d8ff', 1, 1.2);
  }
  // tempête de void en cours : décrément
  if (G.voidStorm > 0) {
    G.voidStorm -= dt;
    if (G.voidStorm <= 0) addDamageText(p.x, p.y - 70, '✨ FIN DE LA TEMPÊTE DE VOID ✨', '#b388ff');
  }
  // micro-trou noir : télégraphe 1,3 s puis implosion
  if (G.voidHole) {
    const h = G.voidHole;
    h.t -= dt;
    if (Math.random() < dt * 24) {
      const a = Math.random() * TAU, d = 90 + Math.random() * 60;
      spawnParticles(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, '#b388ff', 1, 2);
    }
    if (h.t <= 0) {
      G.voidHole = null;
      G.blackHoles.push({ x: h.x, y: h.y, r: 90, life: 6, maxLife: 6, tick: 0, pull: 0.5 });
      G.rings.push({ x: h.x, y: h.y, r: 10, maxR: 240, life: 24, maxLife: 24, color: '#b388ff' });
      G.screenShake = Math.max(G.screenShake, 14);
      spawnParticles(h.x, h.y, '#b388ff', 30, 9);
      spawnParticles(h.x, h.y, '#e1bee7', 20, 8);
      addDamageText(p.x, p.y - 70, '🕳 MICRO-TROU NOIR !', '#e1bee7');
    }
  }
  // déclencheur périodique
  G.spaceEventT -= dt;
  if (G.spaceEventT > 0) return;
  G.spaceEventT = 34 + Math.random() * 26;
  const roll = Math.random();
  if (roll < 0.25) {
    // ESSAIM ALIEN : 3-5 créatures extraterrestres surgissent
    const n = 3 + Math.floor(Math.random() * 3);
    const types = ['alien', 'alien', 'drone', 'tentacule', 'cristal'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = 80 + Math.random() * 160;
      spawnEnemy(types[Math.floor(Math.random() * types.length)], true,
        p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.5 + Math.random());
    }
    addDamageText(p.x, p.y - 60, '👽 ESSAIM ALIEN !', '#ce93d8');
    sfxBoss();
  } else if (roll < 0.5) {
    // MICRO-TROU NOIR : puits de gravité sous le joueur
    G.voidHole = { x: p.x, y: p.y, t: 1.3 };
    addDamageText(p.x, p.y - 60, '⚠ ANOMALIE GRAVITATIONNELLE !', '#b388ff');
    sfxWarn();
  } else if (roll < 0.72) {
    // PLUIE DE MÉTÉORES : projectiles de void sur toute la zone
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 320;
      const x = clampWS(p.x + Math.cos(a) * d), y = clampHS(p.y + Math.sin(a) * d);
      G.projectiles.push({
        x, y, vx: (Math.random() - 0.5) * 2, vy: 5.5 + Math.random() * 2,
        life: 2.6, r: 8, dmg: 30 * waveBonusLocal(), color: '#b388ff', bolt: true, fromUlt: true
      });
    }
    addDamageText(p.x, p.y - 60, '☄ PLUIE DE MÉTÉORES !', '#80d8ff');
    G.warnToast = { name: 'Les débris spatiaux pleuvent — reste mobile', t: 4 };
  } else {
    // CACHE ORBITAL : matériaux + fiole largués en orbite basse
    const loot = {};
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const m = ['cristal', 'essence', 'or', 'fer', 'emeraude'][Math.floor(Math.random() * 5)];
      loot[m] = (loot[m] || 0) + (2 + Math.floor(Math.random() * 5));
    }
    for (const m in loot) { addMaterial(G.inv, m, loot[m]); G.runMats[m] = (G.runMats[m] || 0) + loot[m]; }
    if (Math.random() < 0.5) { p.potions = Math.min(p.maxPotions, p.potions + 1); }
    addDamageText(p.x, p.y - 60, '🛰 CACHE ORBITAL !', '#ffd740');
    spawnParticles(p.x, p.y, '#80d8ff', 20, 6);
  }
}
function waveBonusLocal() { return 1 + (G.wave - 1) * 0.06; }
const clampWS = (v) => Math.max(40, Math.min(worldW() - 40, v));
const clampHS = (v) => Math.max(40, Math.min(worldH() - 40, v));

// ---------- ÉVÉNEMENTS DU ROYAUME DES TEMPÊTES ----------
// rafales, tornades aspirantes, essaims de créatures du vent, cache royal
export function updateStormEvents(dt) {
  if (G.campaign !== 5 || G.state !== 'playing' || G.tutorial) return;
  const p = G.player;
  // ambiance permanente : débris et embruns emportés par le vent
  if (Math.random() < dt * 14) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    spawnParticles(p.x - dir * (500 + Math.random() * 300), p.y + (Math.random() - 0.5) * 600,
      Math.random() < 0.6 ? '#cfe8f8' : '#9fd4f0', 1, 1.4);
  }
  // rafale globale : le vent souffle fort dans toute la zone visible
  if (G.stormGale > 0) {
    G.stormGale -= dt;
    const k = 2.6 * (0.75 + 0.25 * Math.sin(G.time * 9));
    p.x = Math.max(p.r, Math.min(worldW() - p.r, p.x + G.stormGaleDx * k * dt));
    p.y = Math.max(p.r, Math.min(worldH() - p.r, p.y + G.stormGaleDy * k * 0.5 * dt));
    if (Math.random() < dt * 20) {
      spawnParticles(p.x - G.stormGaleDx * 40, p.y - G.stormGaleDy * 30, '#eaf6ff', 1, 1.6);
    }
    if (G.stormGale <= 0) addDamageText(p.x, p.y - 70, '🌬 FIN DE LA RAFALE', '#9fd4f0');
  }
  // tornade : aspire le joueur, le hache de débris, puis se dissipe
  if (G.stormTornado) {
    const tn = G.stormTornado;
    tn.life -= dt; tn.tick -= dt;
    const dx = tn.x - p.x, dy = tn.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < tn.r * 2.2) {
      const pull = (1 - Math.min(1, d / (tn.r * 2.2))) * 3.4;
      p.x += (dx / d) * pull * dt * 60 * 0.3;
      p.y += (dy / d) * pull * dt * 60 * 0.3;
      if (d < tn.r * 0.9 && tn.tick <= 0) {
        tn.tick = 0.8;
        damagePlayer(22 * (1 - (G.equip ? G.equip.armorReduce : 0)), 0.7, { name: 'Tornade', type: 'event' });
        p.slowT = Math.max(p.slowT, 0.6);
      }
    }
    // spirale de débris
    if (Math.random() < dt * 40) {
      const a = Math.random() * TAU, rr2 = tn.r * (0.5 + Math.random() * 0.9);
      spawnParticles(tn.x + Math.cos(a + G.time * 6) * rr2, tn.y + Math.sin(a + G.time * 6) * rr2 * 0.45,
        Math.random() < 0.5 ? '#cfe8f8' : '#8fb8cc', 1, 2.4);
    }
    if (tn.life <= 0) {
      G.stormTornado = null;
      G.rings.push({ x: tn.x, y: tn.y, r: tn.r * 0.4, maxR: tn.r * 1.6, life: 22, maxLife: 22, color: '#9fd4f0' });
      spawnParticles(tn.x, tn.y, '#eaf6ff', 26, 8);
      addDamageText(p.x, p.y - 70, '🌪 LA TORNAADE S\'ÉPUISE', '#9fd4f0');
    }
  }
  // déclencheur périodique
  G.stormEventT -= dt;
  if (G.stormEventT > 0) return;
  G.stormEventT = 32 + Math.random() * 26;
  const roll = Math.random();
  if (roll < 0.28) {
    // RAFale : 7 s de vent violent dans une direction aléatoire
    const a = Math.random() * TAU;
    G.stormGale = 7;
    G.stormGaleDx = Math.cos(a); G.stormGaleDy = Math.sin(a);
    addDamageText(p.x, p.y - 60, '🌬 RAFALE VIOLENTE !', '#eaf6ff');
    G.warnToast = { name: 'Le vent te pousse — lutte contre le courant', t: 4 };
  } else if (roll < 0.52) {
    // TORNade : vortex aspirant sous le joueur
    G.stormTornado = { x: p.x + (Math.random() - 0.5) * 120, y: p.y + (Math.random() - 0.5) * 120, r: 110, life: 6.5, tick: 0 };
    addDamageText(p.x, p.y - 60, '⚠ TORNAADE !', '#ff8a65');
    sfxWarn();
  } else if (roll < 0.74) {
    // ESSAIM DES HAUTES TERRES : 3-5 créatures du vent surgissent
    const n = 3 + Math.floor(Math.random() * 3);
    const types = ['courant', 'courant', 'rafale', 'esprit', 'gardien'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = 80 + Math.random() * 160;
      spawnEnemy(types[Math.floor(Math.random() * types.length)], true,
        clampWS(p.x + Math.cos(a) * d), clampHS(p.y + Math.sin(a) * d), 1.5 + Math.random());
    }
    addDamageText(p.x, p.y - 60, '🌪 ESSAIM DES HAUTES TERRES !', '#4fc3f7');
    sfxBoss();
  } else {
    // TRÉSOR DU ROI DES VENTS : matériaux + fiole
    const loot = {};
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const m = ['cristal', 'essence', 'fer', 'or', 'emeraude'][Math.floor(Math.random() * 5)];
      loot[m] = (loot[m] || 0) + (2 + Math.floor(Math.random() * 5));
    }
    for (const m in loot) { addMaterial(G.inv, m, loot[m]); G.runMats[m] = (G.runMats[m] || 0) + loot[m]; }
    if (Math.random() < 0.5) { p.potions = Math.min(p.maxPotions, p.potions + 1); }
    addDamageText(p.x, p.y - 60, '👑 TRÉSOR DU ROI DES VENTS !', '#ffd740');
    spawnParticles(p.x, p.y, '#4fc3f7', 20, 6);
  }
}
