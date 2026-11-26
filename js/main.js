import { G, ctx, W, H, TAU, VERSION, finalWave, saveStats } from './state.js';
import { spawnEnemy, spawnMinibossWave, spawnBossWave, spawnFinalBoss, damageEnemy, enemyTypes } from './enemies.js';
import { doSlash, doSpin, doThrust, doUlt, doShield, doFireLaser, doFireHand, doJudgment, doSentence, updateSentence, updateKnifeShots, updateNuke, updateIceUlt, updateLasers, updateHands, updateVolcanoes, updateSewerUlt, updateSpaceUlt } from './attacks.js';
import { updateEffects, addDamageText, spawnParticles } from './effects.js';
import { drawBackground, drawEnemy, drawDrops, drawPlayer, drawSlashArc, drawUltFlash, drawMushroom, drawBomber, drawEffects, drawFireZones, drawCraters, drawPortals, drawProjectiles, drawLightnings, drawGrain, drawClouds, dayNight, drawTerrain, drawBuildings, drawWorldPortals, drawObstacle, drawIceStorm, drawLasers, drawHands, drawVolcanoes, drawAcidZones, drawBlackHoles, drawVoidHole } from './graphics.js';
import { checkAchievements } from './achievements.js';
import { damagePlayer } from './damage.js';
import { drawHUD, drawAchToast, drawWarnToast, drawLevelToast } from './hud.js';
import { gainGlobalXp, xpForVictory, XP_WORLD } from './levelup.js';
import { drawMenu, drawGameOver, drawPauseMenu, drawVictory, recordRun, drawAdminMenu, drawAdminButton, drawDurWarnPopup } from './menu.js';
import { initWorlds, updateCamera, worldW, worldH, checkWavePortal, syncCamera, resolveObstacles, curWorld } from './world.js';
import { drawMusicButton, sfxWave, sfxPickup, sfxBoss, sfxWarn, sfxPhase, sfxBossAtk, sfxTitanEnd, sfxVictory, sfxSonicCharge, sfxSonicShot, sfxSonicHit } from './audio.js';
import { updateTutorial, drawTutorial } from './tutorial.js';
import { tickPlaytime } from './chars.js';
import { updateHellEvents, updateFrozenEvents, updateSewerEvents, updateSpaceEvents, updateStormEvents } from './events.js';
import { updateBow, doSingularity } from './bow.js';
import { updateFinalBoss, updateBurrow, collideIceWalls } from './bosses.js';
import { draw } from './draw.js';
import { initInput } from './input.js';
import { updateModules, modSpeedMult, grantPass2 } from './modules.js';
import { maybeAutoSync } from './net.js';
import { DIFFS, waveModFor, recordDiffWin, runScore } from './difficulty.js';
import { qAdd, qMax, qWinWorld } from './quests.js';

// polices de l'interface (canvas) : chargement explicite au démarrage
if (document.fonts) ['600 16px Inter', '600 38px Cinzel'].forEach(f => document.fonts.load(f));

let lastTime = performance.now();

// rotation des types de boss toutes les 5 vagues
const bossCycle = ['boss', 'bossFoudre', 'bossGivre'];
const bossCycleEgout = ['bossEgout', 'matriarche', 'bossEgout'];
const bossCycleEspace = ['bossVoid', 'overlord', 'bossVoid'];
const bossCycleTempete = ['bossOuragan', 'colosse', 'bossOuragan'];
// vagues intermédiaires des boss finaux (campagne -> vague du boss intermédiaire)
const MID_BOSS_WAVE = { 2: 20, 3: 25, 4: 30, 5: 35 };

// ---------- UPDATE ----------
function update(dt) {
  // pause : jeu gelé, seul le compte à rebours de reprise défile
  if (G.state === 'paused') {
    if (G.resumeTimer > 0) {
      G.resumeTimer -= dt;
      if (G.resumeTimer <= 0) { G.resumeTimer = 0; G.state = 'playing'; G.audioOpen = false; }
    }
    return;
  }
  // intro : le jeu est gelé pendant que les nuages s'ouvrent
  if (G.state === 'intro') {
    G.cloudT -= dt;
    if (G.cloudT <= 0) { G.cloudT = 0; G.state = 'playing'; }
    return;
  }
  G.time += dt;
  // cinématique de mort : gameplay gelé, les effets continuent de jouer
  if (G.state === 'dying') {
    G.deathT -= dt;
    G.screenFlash = Math.max(0, G.screenFlash - dt);
    G.screenShake = Math.max(0, G.screenShake - dt * 45);
    if (G.levelToast) { G.levelToast.t -= dt; if (G.levelToast.t <= 0) G.levelToast = null; }
    if (G.achToast) { G.achToast.t -= dt; if (G.achToast.t <= 0) G.achToast = null; }
    if (G.warnToast) { G.warnToast.t -= dt; if (G.warnToast.t <= 0) G.warnToast = null; }
    updateEffects(dt);
    if (G.deathT <= 0) { G.deathT = 0; G.state = 'gameover'; }
    return;
  }
  // victoire : les confettis continuent de danser derrière l'écran de fin,
  // et la secousse/flash de l'explosion finale s'estompent normalement
  if (G.state === 'victory') {
    G.vicT = (G.vicT || 0) + dt; // horloge des animations de l'écran de victoire
    G.screenShake = Math.max(0, G.screenShake - dt * 45);
    G.screenFlash = Math.max(0, G.screenFlash - dt);
    updateEffects(dt);
    return;
  }
  if (G.state === 'gameover') G.goT = (G.goT || 0) + dt; // horloge des animations de l'écran de mort
  if (G.state !== 'playing' || G.gameOver) return;
  if (!G.tutorial) qAdd('time', dt); // quête du jour : temps de survie
  // ralenti entre les vagues (au lieu du freeze) : 2,5s à ~30% de vitesse,
  // les monstres continuent de surgir normalement pendant la transition
  const rawDt = dt;
  const bossDying = G.enemies.some(en => en.bossDying); // ralenti pendant l'agonie d'un boss final
  const slowMo = (G.wavePause > 0 ? 0.3 : 1) * (G.bomber ? 0.35 : 1) * (bossDying ? 0.3 : 1);
  if (G.wavePause > 0) G.wavePause = Math.max(0, G.wavePause - rawDt);
  dt *= slowMo;
  G.runTime += rawDt;
  tickPlaytime(rawDt); // temps de jeu du personnage (persisté)
  if (dayNight() < 0.35) G.nightTime += dt; // temps de nuit (succès)
  // vérification périodique des succès
  G.achT = (G.achT || 0) - dt;
  if (G.achT <= 0) { G.achT = 0.5; checkAchievements(); }

  const p = G.player, keys = G.keys;
  updateCamera(dt); // la caméra suit le joueur dans le monde
  if (G.adminMenu || G.adminInput) return; // admin = jeu en pause

  // Déplacement
  let dx = 0, dy = 0;
  if (keys['z'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['q'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (p.slowT > 0) p.slowT = Math.max(0, p.slowT - dt);
  if (p.hitSlowT > 0) p.hitSlowT = Math.max(0, p.hitSlowT - dt);
  const pSpeed = p.speed * (p.slowT > 0 ? 0.8 : 1) * (p.hitSlowT > 0 ? 0.88 : 1) * (p.sentenceT > 0 ? 0.55 : 1) * (p.attackMode === 3 ? 0.7 : p.attackMode === 5 ? 0.9 : p.attackMode === 7 ? 0.95 : 0.93) * modSpeedMult(); // concentration Sentence / lance tank / arc très légèrement plus lent / jugement légèrement lesté / module Impulsion
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    p.lastDx = dx / len; p.lastDy = dy / len; // direction pour la Ruée dimensionnelle
    const ox = p.x, oy = p.y;
    p.x = Math.max(p.r, Math.min(worldW() - p.r, p.x + dx / len * pSpeed));
    p.y = Math.max(p.r, Math.min(worldH() - p.r, p.y + dy / len * pSpeed));
    if (!G.tutorial) qAdd('dist', Math.hypot(p.x - ox, p.y - oy) / 50); // quête : distance en mètres (50 px = 1 m)
  }
  // Royaume des Tempêtes : les courants d'air poussent le joueur
  {
    const wz = curWorld() && curWorld().windZones;
    if (wz && wz.length) {
      const t = G.time || 0;
      for (const zn of wz) {
        const d = Math.hypot(p.x - zn.x, p.y - zn.y);
        if (d < zn.r) {
          // poussée radiale douce vers le centre de la zone, dans le sens du vent
          const k = (1 - d / zn.r) * zn.str * (0.7 + 0.3 * Math.sin(t * 2.2 + zn.ph));
          p.x += zn.dx * k * 1.6 * dt * 60 * 0.28;
          p.y += zn.dy * k * 1.6 * dt * 60 * 0.28;
          if (Math.random() < dt * 6) {
            spawnParticles(p.x - zn.dx * 20, p.y - zn.dy * 20, '#cfe8f8', 1, 1.5);
          }
        }
      }
    }
  }
  resolveObstacles(p); // rochers et montagnes bloquent le joueur
  collideIceWalls(p);  // les murs de glace du Souverain bloquent aussi le joueur
  updateModules(dt);   // modules équipés : dash, buffs, bouclier, régénération, rempart

  // découverte des bâtiments : visibles sur la minimap seulement une fois vus
  {
    const w = curWorld();
    if (w) for (const b of w.buildings) {
      if (!b.seen && Math.abs(b.x - p.x) < W / 2 + 140 && Math.abs(b.y - p.y) < H / 2 + 140) b.seen = true;
    }
  }

  // Attaques : clic gauche = principale (épée/lance), clic droit = rotation secondaire
  // (verrouillé 2s après un changement d'arme)
  // arc cinétique : le clic gauche est géré par la charge (updateBow),
  // les files épée/lance/rotation sont ignorées dans ce mode
  if (p.attackMode === 5) { G.attackQueued = false; G.spinQueued = false; }
  if (p.attackMode === 7) G.spinQueued = false; // le Jugement n'a pas de rotation
  if (G.attackQueued && p.switchLock <= 0 && p.sentenceT <= 0) {
    if (p.attackCooldown <= 0 && p.spinDuration <= 0) {
      G.attackQueued = false;
      if (p.ultActive > 0) doFireLaser(); // titan de feu : le clic lance le laser
      else if (p.attackMode === 7) doJudgment();
      else if (p.attackMode === 3) doThrust(); else doSlash();
    }
  }
  if (G.spinQueued && p.switchLock <= 0 && p.spinCooldown <= 0 && p.attackMode !== 3 && p.attackMode !== 7 && p.ultActive <= 0) {
    G.spinQueued = false;
    doSpin();
  }
  // dôme de bouclier (clic droit en mode é) : -85% de dégâts pendant 2,5s
  if (G.shieldQueued) {
    G.shieldQueued = false;
    if (p.attackMode === 3 && p.shieldCd <= 0 && p.switchLock <= 0 && p.ultActive <= 0) doShield();
  }
  // main de feu (clic droit pendant la transformation du Titan de Feu)
  if (G.handQueued) {
    G.handQueued = false;
    if (p.ultActive > 0 && p.handCd <= 0 && !p.handUsed) doFireHand();
  }
  // singularité de l'arc (clic droit en mode arc)
  if (G.singQueued) {
    G.singQueued = false;
    if (p.attackMode === 5) doSingularity();
  }
  // Sentence ancestrale (clic droit en mode jugement)
  if (G.judgQueued) {
    G.judgQueued = false;
    if (p.attackMode === 7 && p.sentenceCd <= 0 && p.sentenceT <= 0 && p.switchLock <= 0 && p.ultActive <= 0) doSentence();
  }
  updateSentence(dt); // concentration de Sentence ancestrale
  updateKnifeShots(dt); // couteaux de lancer du Jugement (vol + collisions)
  updateBow(dt); // charge + projectiles + zones de distorsion de l'arc
  p.handCd = Math.max(0, p.handCd - dt);
  if (G.ultQueued) {
    if (p.ultCharge >= 100 && p.ultActive <= 0 && !G.bomber) {
      G.ultQueued = false;
      qAdd('ult', 1); // quête : utilisation de l'ultime
      doUlt();
    } else if (p.ultCharge < 100) {
      G.ultQueued = false; // pas encore chargée : on oublie la pression, pas de déclenchement auto
    }
  }
  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.spinCooldown = Math.max(0, p.spinCooldown - dt);
  p.spinDuration = Math.max(0, p.spinDuration - dt);
  const wasTitan = p.ultActive > 0;
  p.ultActive = Math.max(0, p.ultActive - dt);
  // fin de la transformation TITAN DE FEU : les PV triplés reviennent à la normale
  if (wasTitan && p.ultActive <= 0 && p._titanMax) {
    p.hp = Math.min(p.hp, p._titanMax);
    p.maxHp = p._titanMax;
    p._titanMax = 0;
    sfxTitanEnd(); // le feu s'éteint en soupir
  }
  p.ultAnim = Math.max(0, p.ultAnim - dt);
  p.potionCooldown = Math.max(0, p.potionCooldown - dt);
  p.shieldT = Math.max(0, p.shieldT - dt);
  p.shieldCd = Math.max(0, p.shieldCd - dt);
  p.sentenceCd = Math.max(0, p.sentenceCd - dt);
  p.switchLock = Math.max(0, p.switchLock - dt);
  // admin : pas de cooldowns — toutes les actions sont immédiatement disponibles
  if (G.adminNoCd) {
    p.attackCooldown = 0; p.spinCooldown = 0; p.shieldCd = 0;
    p.handCd = 0; p.potionCooldown = 0; p.switchLock = 0;
    p.sentenceCd = 0; p.sentenceT = 0;
  }
  G.cloudT = Math.max(0, G.cloudT - dt);
  G.screenFlash = Math.max(0, G.screenFlash - dt);
  G.screenShake = Math.max(0, G.screenShake - dt * 45);
  if (G.achToast) { G.achToast.t -= dt; if (G.achToast.t <= 0) G.achToast = null; }
  if (G.levelToast) { G.levelToast.t -= dt; if (G.levelToast.t <= 0) G.levelToast = null; }
  if (G.warnToast) { G.warnToast.t -= dt; if (G.warnToast.t <= 0) G.warnToast = null; }

  // Spawn : cadence en temps réel même pendant le ralenti (les monstres arrivent)
  G.spawnTimer -= rawDt;
  const interval = Math.max(0.4, (2.0 - G.wave * 0.13) * ((G.waveMod && G.waveMod.spawn) || 1)); // spawn légèrement plus rapide
  if (G.spawnTimer <= 0 && G.enemies.length < 20 && G.wave < finalWave() && !G.tutorial) {
    spawnEnemy();
    G.spawnTimer = interval;
  }
  // Quota de la vague : la tuer fait avancer (plus de blocage)
  if (!G.tutorial && G.waveKills >= G.waveTarget) { // le tutoriel gère ses propres ennemis
    G.wave++;
    G.waveKills = 0;
    qMax('wave', G.wave); // quête du jour : vague max atteinte
    // modificateur de vague (EXPERT uniquement) : un seul à la fois, progressif
    G.waveMod = waveModFor(G.wave, G.difficulty || 0);
    G.waveTarget = Math.round((6 + G.wave * 2) * ((G.waveMod && G.waveMod.quota) || 1)); // le quota grandit avec la vague
    G.wavePause = 2.5; // pause entre les vagues
    p.maxHp += 15;
    p.hp = Math.min(p.maxHp, p.hp + 30);
    p.attackDamage += 5;
    p.spinDamage += 3;
    p.speed = Math.min(3.5, p.speed + 0.04);
    addDamageText(p.x, p.y - 20, G.wave === finalWave() ? 'VAGUE FINALE !' : `VAGUE ${G.wave}!`, G.wave === finalWave() ? '#e040fb' : '#ffd740');
    if (G.waveMod) addDamageText(p.x, p.y - 105, `MODIFICATEUR : ${G.waveMod.label} !`, '#e040fb');
    sfxWave();
    if (G.wave === finalWave()) {
      // VAGUE FINALE : tous les monstres disparaissent, plus aucun spawn,
      // place au boss final qui émerge de terre dans une explosion
      G.enemies.length = 0;
      G.portals.length = 0; G.projectiles.length = 0;
      G.fireZones.length = 0; G.lightnings.length = 0; G.lasers.length = 0;
      G.hands.length = 0; G.volcanoes.length = 0;
      G.wavePause = 3.0;
      addDamageText(p.x, p.y - 85, 'VAGUE FINALE', '#e040fb');
      spawnFinalBoss();
    } else {
    // vagues ×3 : 1 à 3 mini-boss apparaissent immédiatement
    if (G.wave % 3 === 0) {
      spawnMinibossWave();
      addDamageText(p.x, p.y - 45, 'MINI-BOSSES !', '#ffb300');
    }
    // vagues ×5 : un seul boss garanti, type en rotation
    if (G.wave % 5 === 0) {
      const camp = G.campaign;
      const cycle = camp === 5 ? bossCycleTempete
        : camp === 4 ? bossCycleEspace
        : camp === 3 ? bossCycleEgout
        : camp === 1 ? ['bossGlace', 'bossCryo', 'bossGlace']
        : camp === 2 ? ['bossEnf', 'demon', 'bossEnf']
        : bossCycle;
      const btype = cycle[(G.wave / 5 - 1) % cycle.length];
      spawnBossWave(1, btype);
      addDamageText(p.x, p.y - 65, `BOSS : ${enemyTypes[btype].name.toUpperCase()} !`, '#ff1744');
    }
    // Événement aléatoire : une meute surgit par un grand portail (vague 2+)
    if (G.wave >= 2 && Math.random() < 0.16) {
      const camp = G.campaign;
      const n = 2 + Math.floor(Math.random() * 3); // 2 à 4
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = 30 + Math.random() * 110;
        const et = camp === 5 ? ['courant', 'esprit', 'esprit', 'rafale', 'gardien'][Math.floor(Math.random() * 5)]
          : camp === 4 ? ['alien', 'alien', 'drone', 'tentacule'][Math.floor(Math.random() * 4)]
          : camp === 3 ? ['rat', 'rat', 'crapaud', 'vase'][Math.floor(Math.random() * 4)]
          : camp === 1 ? 'alpha'
          : camp === 2 ? ['imp', 'imp', 'hound', 'demon'][Math.floor(Math.random() * 4)]
          : 'brute';
        spawnEnemy(et, true, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 2 + Math.random()); // portail visible 2-3s
      }
      addDamageText(p.x, p.y - 85,
        camp === 5 ? 'ÉVÉNEMENT : ESSAIM DES TEMPÊTES !' : camp === 4 ? 'ÉVÉNEMENT : ESSAIM ALIEN !' : camp === 3 ? 'ÉVÉNEMENT : ESSAIM D\'ÉGOUT !' : camp === 1 ? 'ÉVÉNEMENT : MEUTE DES NEIGES !' : camp === 2 ? 'ÉVÉNEMENT : ESSAIM INFERNAL !' : 'ÉVÉNEMENT : BRUTES !',
        camp >= 1 ? (camp === 5 ? '#aeea00' : camp === 4 ? '#82b1ff' : camp === 3 ? '#aeea00' : camp === 1 ? '#4fc3f7' : '#ff7043') : '#ff7043');
    }
    // Enfers : le Baron surgit dès la vague 20 (boss intermédiaire,
    // sans vider le champ — la vague finale reste à la vague 30).
    // Égouts : le Tyran dès la vague 25 (sur 35) · Espace : l'Abomination dès la vague 30 (sur 40)
    const midWave = MID_BOSS_WAVE[G.campaign];
    if (midWave && G.wave === midWave) {
      const midType = G.campaign === 5 ? 'finalBossTempete' : G.campaign === 4 ? 'finalBossSpace' : G.campaign === 3 ? 'finalBossEgout' : 'finalBossEnfer';
      if (!G.enemies.some(e => e.type === midType)) spawnFinalBoss();
    }
    // fin de la vague 50 : le portail dimensionnel apparaît
    checkWavePortal();
    }
  }
  // écran vidé : on accélère le prochain spawn
  if (G.enemies.length === 0) G.spawnTimer = Math.min(G.spawnTimer, 0.8);

  // sécurité vague finale : le boss final (et sa barre de vie) doit être
  // présent pendant toute la vague — il apparaît dès son début
  if (G.state === 'playing' && G.wave >= finalWave() && !G.pendingVictory &&
      !G.enemies.some(en => en.type === 'finalBoss' || en.type === 'finalBossGlace' || en.type === 'finalBossEnfer'
        || en.type === 'finalBossEgout' || en.type === 'finalBossSpace' || en.type === 'finalBossTempete')) {
    spawnFinalBoss();
  }

  // Ennemis : poursuite + attaque
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.wobble += dt * 4;
    if (e.spawnT > 0) e.spawnT = Math.max(0, e.spawnT - dt);
    if (e.graceT > 0) { e.graceT = Math.max(0, e.graceT - dt); continue; } // grace : ni ni attaque
    if (e.attackCooldown > 0) e.attackCooldown -= dt;
    if (e.slow > 0) e.slow = Math.max(0, e.slow - dt);
    if (e.timeSlow > 0) e.timeSlow = Math.max(0, e.timeSlow - dt); // Distorsion temporelle
    if (e.shieldT > 0) e.shieldT = Math.max(0, e.shieldT - dt); // bouclier de phase
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    // ambiance : boss et mini-boss dégagent des particules de leur élément
    if ((e.isBoss || e.isMini) && !e.bossDying && Math.random() < dt * 7) {
      const hell = G.campaign === 2, frozen = G.campaign === 1, sewer = G.campaign === 3, space = G.campaign === 4;
      spawnParticles(
        e.x + (Math.random() - 0.5) * e.r * 1.8,
        e.y - e.r * 0.4 - Math.random() * e.r * 0.8,
        hell ? '#ff7043' : frozen ? '#b3e5fc' : sewer ? '#aeea00' : space ? '#b388ff' : e.isBoss ? '#ff5252' : '#ffb74d',
        1, 2
      );
    }
    // boss final en agonie : il s'effondre au ralenti, plus aucune action.
    // Les débris émis suivent l'identité de l'univers du boss.
    if (e.bossDying) {
      const dieK = Math.max(0, e.bossDying / 2.4); // 1 -> 0
      e.bossDying -= dt;
      const bt = e.type;
      const isIce = bt === 'finalBossGlace', isHell = bt === 'finalBossEnfer',
        isSewer = bt === 'finalBossEgout', isSpace = bt === 'finalBossSpace',
        isStorm = bt === 'finalBossTempete';
      // gerbe d'âme qui s'élève du corps (tous les boss)
      if (Math.random() < dt * 22) {
        spawnParticles(
          e.x + (Math.random() - 0.5) * e.r * 1.8,
          e.y - Math.random() * e.r * 1.2,
          isIce ? '#b3e5fc' : isHell ? '#ffab40' : isSewer ? '#aeea00'
            : isSpace ? '#b388ff' : isStorm ? '#4fc3f7' : '#ce93d8',
          3, 4
        );
      }
      // débris thématiques : cristaux / braises / pierres / vase / motes / vent
      if (Math.random() < dt * (10 + (1 - dieK) * 14)) {
        const bx = e.x + (Math.random() - 0.5) * e.r * 1.7;
        const by = e.y - Math.random() * e.r * 1.4;
        const out = Math.random() < 0.5 ? 1 : -1;
        G.particles.push({
          x: bx, y: by,
          vx: (Math.random() - 0.5) * (isStorm ? 5 : 2.2) + (isStorm ? out * 3 : 0),
          vy: isHell ? -1.4 - Math.random() * 1.6 : isStorm ? (Math.random() - 0.5) * 2 : -0.8 - Math.random() * 1.6,
          life: 30 + Math.random() * 26, maxLife: 56,
          color: isIce ? (Math.random() < 0.6 ? '#e1f5fe' : '#81d4fa')
            : isHell ? (Math.random() < 0.6 ? '#ffab40' : '#ff7043')
            : isSewer ? (Math.random() < 0.6 ? '#dce775' : '#9ccc65')
            : isSpace ? (Math.random() < 0.6 ? '#ede7f6' : '#b388ff')
            : isStorm ? (Math.random() < 0.6 ? '#e1f5fe' : '#80d8ff')
            : (Math.random() < 0.5 ? '#a1887f' : '#8d6e63'),
          r: (isIce || isSpace ? 2.2 : 1.8) + Math.random() * 2.6
        });
      }
      // poussière au sol qui s'épaissit en fin d'effondrement
      if (dieK < 0.45 && Math.random() < dt * 16) {
        const a = Math.random() * TAU, d = e.r * (0.7 + Math.random() * 0.9);
        G.particles.push({
          x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d * 0.5 + e.r * 0.4,
          vx: (Math.random() - 0.5) * 1.4, vy: -0.3 - Math.random() * 0.7,
          life: 34 + Math.random() * 24, maxLife: 58,
          color: isIce ? 'rgba(186,222,255,0.30)' : isHell ? 'rgba(255,171,64,0.28)'
            : isSewer ? 'rgba(174,234,0,0.25)' : isSpace ? 'rgba(179,136,255,0.30)'
            : isStorm ? 'rgba(129,212,250,0.30)' : 'rgba(160,140,120,0.28)',
          r: 6 + Math.random() * 9
        });
      }
      if (e.bossDying <= 0) {
        // mort effective : mêmes récompenses qu'une mort normale + victoire
        G.enemies.splice(i, 1);
        G.kills++;
        G.waveKills++;
        G.typeKills[e.type] = (G.typeKills[e.type] || 0) + 1;
        G.bossesKilled++;
        // victoire seulement à la vague finale : le Baron des Enfers surgit
        // dès la vague 20 comme boss intermédiaire (30 vagues au total)
        if (G.wave >= finalWave()) G.pendingVictory = true;
      }
      continue;
    }
    // boss enfoui sous terre : il manœuvre en sous-sol, intouchable
    if (e.burrow) { updateBurrow(e, dt, p); continue; }
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    if (dist < e.aggro) {
      const nx = (p.x - e.x) / dist, ny = (p.y - e.y) / dist;
      const wob = e.type === 'slime' ? Math.sin(e.wobble) * 0.3 : 0;
      const eSlow = (e.slow > 0 ? 0.5 : 1) * (e.timeSlow > 0 ? 0.55 : 1); // ralenti quand on le frappe / distorsion
      if ((e.type === 'spider' || e.type === 'hunter') && e.lunging > 0) {
        // en plein bond : trajectoire rapide vers la position visée
        e.lunging -= dt;
        e.x += e.lvx; e.y += e.lvy;
        e.x = Math.max(e.r, Math.min(worldW() - e.r, e.x));
        e.y = Math.max(e.r, Math.min(worldH() - e.r, e.y));
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 6) {
          damagePlayer(e.damage * 1.4, 0.7, e); // le bond frappe plus fort
          e.lunging = 0;
          e.lungeCd = 3.5 + Math.random() * 1.5;
        } else if (e.lunging <= 0) {
          e.lungeCd = 3.5 + Math.random() * 1.5;
        }
      } else if (e.type === 'chanter') {
        // Chanteur des Profondeurs : artillerie à distance — garde ses
        // distances, recule si le joueur s'approche, orbite en bande moyenne,
        // prépare son chant (télégraphe) puis crache une orbe sonique
        e.faceX = nx; e.faceY = ny;
        if (e.shotCharge > 0) {
          e.shotCharge -= dt;
          if (e.shotCharge <= 0) {
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            G.projectiles.push({
              x: e.x + Math.cos(a) * e.r * 0.7, y: e.y + Math.sin(a) * e.r * 0.7,
              vx: Math.cos(a) * 4.9, vy: Math.sin(a) * 4.9,
              life: 2.6, r: 8, dmg: e.damage * 0.8, color: '#dcedc8', sonic: true
            });
            sfxSonicShot();
            spawnParticles(e.x, e.y, '#c5e1a5', 8, 4);
            e.specialCd = 3.1 + Math.random() * 0.9;
          }
        } else {
          e.specialCd -= dt;
          const wantMin = 250, wantMax = 430;
          let mx = nx, my = ny;
          if (dist < wantMin) { mx = -nx; my = -ny; } // trop proche : recule
          else if (dist > wantMax) { /* approche */ }
          else { // bande idéale : orbite lente pour désorienter
            const sa = Math.sin(G.time * 0.55 + e.wobble) > 0 ? 1 : -1;
            mx = -ny * sa * 0.85; my = nx * sa * 0.85;
          }
          e.x += mx * e.speed * 0.85 * eSlow;
          e.y += my * e.speed * 0.85 * eSlow;
          if (e.specialCd <= 0 && dist < 560 && dist > 130 && e.spawnT <= 0) {
            e.shotCharge = 0.75; // télégraphe : les notes convergent
            sfxSonicCharge();
          }
        }
      } else {
        e.x += nx * e.speed * (1 + wob) * eSlow;
        e.y += ny * e.speed * eSlow;
        // araignée : prépare un bond assassinat toutes les ~3-5s
        if ((e.type === 'spider' || e.type === 'hunter')) {
          e.lungeCd -= dt;
          if (e.lungeCd <= 0 && dist > 60 && dist < 300) {
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            e.lvx = Math.cos(a) * 7.5; e.lvy = Math.sin(a) * 7.5;
            e.lunging = 0.38;
            e.lungeCd = 9; // sécurité anti-redéclenchement
            spawnParticles(e.x, e.y, '#ffab91', 6, 3);
          }
        }
      }
      resolveObstacles(e); // les monstres ne traversent pas les obstacles
      collideIceWalls(e);  // ni les murs de glace
      if (dist < e.r + p.r + (e.range || 0) && e.attackCooldown <= 0) {
        e.attackCooldown = 1;
        damagePlayer(e.damage, 0.7, e);
      }

      // Attaques à distance : boss (foudre/glace) et sorcière (sort violet)
      if ((e.isBoss || e.type === 'witch') && e.attack && e.spawnT <= 0) {
        e.specialCd -= dt;
        if (e.attack === 'lightning' && e.specialCd <= 0) {
          e.specialCd = 3.4 + Math.random() * 0.8;
          // télégraphe une foudre là où se trouve le joueur (légèrement décalée)
          G.lightnings.push({
            x: p.x + (Math.random() - 0.5) * 50,
            y: p.y + (Math.random() - 0.5) * 50,
            t: 0.7, max: 0.7, dmg: e.damage * 1.3, struck: false
          });
        } else if (e.attack === 'ice' && e.specialCd <= 0 && dist < 520) {
          e.specialCd = 2.3 + Math.random() * 0.5;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          G.projectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 4.4, vy: Math.sin(a) * 4.4,
            life: 2.2, r: 7, dmg: e.damage * 0.8, color: '#b3e5fc'
          });
        } else if (e.attack === 'hex' && e.specialCd <= 0 && dist < 500) {
          e.specialCd = 2.6 + Math.random() * 0.7;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          G.projectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 3.6, vy: Math.sin(a) * 3.6,
            life: 2.6, r: 6, dmg: e.damage * 0.9, color: '#e1bee7', hex: true
          });
        } else if (e.attack === 'fire' && e.specialCd <= 0 && dist < 540) {
          e.specialCd = 2.4 + Math.random() * 0.6;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          // boule de feu infernale : rapide, gros dégâts, laisse une trace
          G.projectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 5.4, vy: Math.sin(a) * 5.4,
            life: 2.4, r: 9, dmg: e.damage * 0.85, color: '#ff7043', fire: true
          });
          spawnParticles(e.x, e.y - 6, '#ffab40', 5, 4);
        } else if (e.attack === 'acid' && e.specialCd <= 0 && dist < 540) {
          e.specialCd = 2.5 + Math.random() * 0.6;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          // bille de vase : projectiles verts lents, poison au contact
          G.projectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2,
            life: 2.8, r: 8, dmg: e.damage * 0.8, color: '#aeea00', acid: true
          });
          spawnParticles(e.x, e.y - 6, '#aeea00', 5, 4);
        } else if (e.attack === 'bolt' && e.specialCd <= 0 && dist < 560) {
          e.specialCd = 2.2 + Math.random() * 0.5;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          // rayon stellaire : projectile violet très rapide
          G.projectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 6.2, vy: Math.sin(a) * 6.2,
            life: 2.0, r: 7, dmg: e.damage * 0.9, color: '#b388ff', bolt: true
          });
          spawnParticles(e.x, e.y - 6, '#b388ff', 5, 4);
        }
      }

      // mouvements signature des boss finaux (hors attaques de base)
      if (e.type === 'finalBoss' || e.type === 'finalBossGlace' || e.type === 'finalBossEnfer'
        || e.type === 'finalBossEgout' || e.type === 'finalBossSpace' || e.type === 'finalBossTempete') updateFinalBoss(e, dt, p);
    }
  }

  // Séparation des ennemis
  for (let i = 0; i < G.enemies.length; i++) for (let j = i + 1; j < G.enemies.length; j++) {
    const a = G.enemies[i], b = G.enemies[j];
    if (a.burrow || b.burrow) continue; // un boss enfoui n'est pas bousculé
    const d = Math.hypot(a.x - b.x, a.y - b.y), min = a.r + b.r;
    if (d > 0 && d < min) {
      const push = (min - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }
  // la séparation peut avoir poussé des ennemis dans un obstacle
  for (const e of G.enemies) resolveObstacles(e);

  // Ramassage des fioles au sol (expirent après 12s)
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    d.life -= dt;
    if (d.life <= 0) {
      spawnParticles(d.x, d.y, '#ff80ab', 6, 2);
      G.drops.splice(i, 1);
      continue;
    }
    if (Math.hypot(p.x - d.x, p.y - d.y) < p.r + d.r) {
      if (p.potions < p.maxPotions) {
        p.potions++;
        sfxPickup();
        addDamageText(d.x, d.y - 14, '+FIOLE', '#ff80ab');
        spawnParticles(d.x, d.y, '#ff80ab', 8, 3);
        G.drops.splice(i, 1);
      }
      // inventaire plein : la fiole reste par terre
    }
  }

  // Zones de feu (bombe atomique) : brûlure persistante
  for (let i = G.fireZones.length - 1; i >= 0; i--) {
    const z = G.fireZones[i];
    z.life -= dt;
    z.tick -= dt;
    // braises animées
    if (Math.random() < 0.4) {
      spawnParticles(
        z.x + (Math.random() - 0.5) * z.r * 1.4,
        z.y + (Math.random() - 0.5) * z.r * 1.4,
        Math.random() < 0.5 ? '#ff7043' : '#ffd740', 1, 1.5
      );
    }
    // dégâts de brûlure toutes les 0,25s
    if (z.tick <= 0) {
      z.tick = 0.25;
      for (const e of [...G.enemies]) {
        if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
          e.slow = Math.max(e.slow || 0, 0.4); // la brûlure ralentit légèrement
          // le Baron de l'Enfer encaisse très peu la Colère Infernale
          const red = z.fromUlt && e.type === 'finalBossEnfer' ? 0.25 : 1;
          const tickDmg = z.dps * 0.25 * red;
          if (e.hp - tickDmg <= 0) {
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            damageEnemy(e, e.maxHp, a); // mort par brûlure : récompenses normaux
          } else {
            e.hp -= tickDmg;
          }
        }
      }
    }
    if (z.life <= 0) G.fireZones.splice(i, 1);
  }

  // Ondes de choc au sol (boss finaux) : le front de l'anneau blesse le joueur
  for (let i = G.shockwaves.length - 1; i >= 0; i--) {
    const s = G.shockwaves[i];
    s.r += s.speed;
    s.t = (s.t || 0) + dt;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (!s.hit && Math.abs(d - s.r) < 30) {
      s.hit = true;
      damagePlayer(s.dmg, s.slow || 1.0);
      spawnParticles(p.x, p.y, s.color, 10, 5);
    }
    // débris projetés le long du front
    if (Math.random() < 0.6) {
      const a = Math.random() * TAU;
      spawnParticles(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r * 0.6,
        s.color, 1, 2.5);
    }
    if (s.r > s.maxR) G.shockwaves.splice(i, 1);
  }

  // Murs de glace du Souverain : durée de vie + cristaux qui scintillent
  for (let i = G.iceWalls.length - 1; i >= 0; i--) {
    const wl = G.iceWalls[i];
    wl.life -= dt;
    if (wl.life <= 0) {
      spawnParticles(wl.x, wl.y, '#b3e5fc', 14, 5);
      G.iceWalls.splice(i, 1);
      continue;
    }
    if (Math.random() < dt * 6) spawnParticles(wl.x + (Math.random() - 0.5) * wl.r, wl.y - wl.r * 0.5, '#e1f5fe', 1, 1);
  }

  // Cratères : durée de vie ~10 s puis disparition
  for (let i = G.craters.length - 1; i >= 0; i--) {
    G.craters[i].t -= dt;
    if (G.craters[i].t <= 0) G.craters.splice(i, 1);
  }

  // Foudre du Boss Foudre : télégraphe puis frappe
  for (let i = G.lightnings.length - 1; i >= 0; i--) {
    const l = G.lightnings[i];
    l.t -= dt;
    if (!l.struck && l.t <= 0) {
      l.struck = true;
      l.t = -0.18; // le bolt reste visible un instant
      if (Math.hypot(p.x - l.x, p.y - l.y) < 62) damagePlayer(l.dmg, 0.4);
      spawnParticles(l.x, l.y, '#fff176', 14, 6);
      G.screenShake = Math.max(G.screenShake, 6);
    }
    if (l.t <= -0.18) G.lightnings.splice(i, 1);
  }

  // Projectiles de glace du Boss Givre
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    // rayon de void : homing vers sa cible, explose à l'impact (dégâts ennemis)
    if (pr.voidBolt) {
      pr.life -= dt;
      const tgt = pr.tx && G.enemies.includes(pr.tx) ? pr.tx : null;
      if (tgt) {
        const a = Math.atan2(tgt.y - pr.y, tgt.x - pr.x);
        const sp = Math.min(9, Math.hypot(pr.vx, pr.vy) + 4 * dt);
        pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
        if (Math.hypot(tgt.x - pr.x, tgt.y - pr.y) < tgt.r + pr.r + 4) {
          damageEnemy(tgt, pr.dmg, a);
          spawnParticles(pr.x, pr.y, '#b388ff', 12, 5);
          G.projectiles.splice(i, 1); continue;
        }
      }
      pr.x += pr.vx; pr.y += pr.vy;
      if (pr.life <= 0 || pr.x < -30 || pr.x > worldW() + 30 || pr.y < -30 || pr.y > worldH() + 30) {
        G.projectiles.splice(i, 1);
      }
      continue;
    }
    pr.x += pr.vx; pr.y += pr.vy; pr.life -= dt;
    if (pr.life <= 0 || pr.x < -30 || pr.x > worldW() + 30 || pr.y < -30 || pr.y > worldH() + 30) {
      G.projectiles.splice(i, 1); continue;
    }
    if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + pr.r) {
      damagePlayer(pr.dmg, 1.0); // la glace ralentit le joueur
      if (pr.sonic) { // orbe du Chanteur : onde sonore + débris verts
        sfxSonicHit();
        G.rings.push({ x: pr.x, y: pr.y, r: 4, maxR: 44, life: 16, maxLife: 16, color: '#c5e1a5' });
        spawnParticles(pr.x, pr.y, '#e8f5e9', 10, 4);
      }
      if (pr.hex || pr.acid) { // sort de la sorcière / bille de vase : poison (3s, plancher 15%)
        p.poisonT = 3;
        p.poisonDps = Math.max(p.poisonDps, pr.dmg * 0.5);
        spawnParticles(p.x, p.y, pr.acid ? '#aeea00' : '#76ff03', 12, 4);
      }
      spawnParticles(pr.x, pr.y, pr.hex ? '#e1bee7' : (pr.color || '#b3e5fc'), 10, 4);
      G.projectiles.splice(i, 1);
    }
  }

  // Poison de la sorcière : dégâts dans le temps, ne descend jamais sous 15% des PV max
  if (p.poisonT > 0) {
    p.poisonT -= dt;
    const floor = p.maxHp * 0.15;
    if (p.hp > floor) {
      const d = Math.min(p.poisonDps * dt, p.hp - floor);
      p.hp -= d;
      G.dmgTaken += d;
      p.lastHurt = G.time;
      if (Math.random() < 0.35) spawnParticles(p.x + (Math.random() - 0.5) * 20, p.y - 10, '#76ff03', 1, 1.5);
    }
    if (p.poisonT <= 0) p.poisonDps = 0;
  }

  // Régénération hors combat (3s sans dégâts) : le montant dépend de la
  // campagne — ~8 PV/s (Terres) à ~43 PV/s (Espace)
  const REGEN_PS = [8, 16, 27, 35, 43, 52]; // PV par seconde
  if (G.time - p.lastHurt > 3 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + REGEN_PS[G.campaign || 0] * dt);
  }

  // victoire : le boss final vient d'être vaincu -> cinématique + fin de partie
  if (G.pendingVictory) {
    G.pendingVictory = false;
    G.state = 'victory';
    G.vicT = 0; // horloge de la révélation de l'écran de victoire
    sfxVictory(); // sting triomphal sombre : gong + accords ascendants
    recordRun(); // la victoire compte comme une partie réussie dans les stats
    qAdd('victories', 1); // quête du jour
    qWinWorld(G.campaign); // quête : royaumes distincts terminés
    if (!G.runDeaths) qAdd('flawless', 1); // quête : victoire sans aucune mort
    // difficulté de campagne : enregistre la victoire par niveau (Normal/Difficile/Expert),
    // débloque la difficulté suivante et mémorise les records — campaignDone reste
    // la condition de déblocage du niveau suivant (le Normal l'implique toujours)
    G.lastScore = runScore();
    // niveau global : victoire de campagne (difficulté pondérée) + bonus premier monde
    const firstWin = !(G.stats.campaignDone && G.stats.campaignDone[G.campaign]);
    gainGlobalXp(xpForVictory(G.campaign, G.difficulty || 0) + (firstWin ? XP_WORLD : 0));
    recordDiffWin(G.campaign, G.difficulty || 0, G.lastScore, G.runTime);
    if (G.campaign === 1) G.stats.iceUlt = true; // coffre : débloque la Pluie de Glace
    if (G.campaign === 2) G.stats.hellUlt = true; // trône : débloque la Colère Infernale
    if (G.campaign === 4) { G.stats.bowUnlocked = true; G.bowReveal = G.time; } // ARC CINÉTIQUE COSMIQUE
    // LE JUGEMENT DU GARDIEN : arme légendaire gagnée en finissant les Terres Oubliées
    if (G.campaign === 0) { G.stats.gardienUnlocked = true; G.gardienReveal = G.time; G._gardienSfxDone = false; }
    if (G.campaign === 5) { grantPass2(); } // 2ᵉ slot passif (récompense du Royaume des Tempêtes)
    saveStats();
    G.enemies.length = 0; G.drops.length = 0; G.fireZones.length = 0;
    G.portals.length = 0; G.projectiles.length = 0; G.lightnings.length = 0;
    G.iceWalls.length = 0; G.shockwaves.length = 0; G.iceSpikes.length = 0; G.skyIcicles.length = 0; G.snowPatches.length = 0; G.iceShards.length = 0; G.iceFrost.length = 0; G.iceStorm = null; G.iceDim = 0; G.snowCover = null;
    G.lasers.length = 0; G.hands.length = 0; G.volcanoes.length = 0; G.hellStorm = null;
    G.acidZones.length = 0; G.blackHoles.length = 0;
    G.acidRain = 0; G.voidStorm = 0;
    G.stormGale = 0; G.stormTornado = null;
    G.bowShots.length = 0; G.singZones.length = 0; G.knifeShots.length = 0;
    // salve de fête : or, violet, vert
    const cols = ['#ffd740', '#e040fb', '#69f0ae', '#40c4ff', '#ff8a65'];
    for (let i = 0; i < 6; i++) {
      spawnParticles(
        p.x + (Math.random() - 0.5) * 500, p.y + (Math.random() - 0.5) * 320,
        cols[i % cols.length], 36, 9
      );
    }
    G.rings.push({ x: p.x, y: p.y, r: 10, maxR: 320, life: 50, maxLife: 50, color: '#ffd740' });
    G.screenFlash = 0.9; G.screenShake = 18;
    addDamageText(p.x, p.y - 60, 'VICTOIRE !', '#ffd740');
  }

  updateFrozenEvents(rawDt); // tempêtes, avalanches et événements de la campagne 2
  updateHellEvents(rawDt);   // braises, essaims et événements des Enfers
  updateSewerEvents(rawDt);  // vase, rats et événements des Égouts
  updateSpaceEvents(rawDt);  // void, essaims et événements de l'Espace
  updateStormEvents(rawDt);  // rafales, tornades et événements des Tempêtes
  updateTutorial(dt); // étapes guidées du tutoriel (si actif)
  updateNuke(rawDt); // bombardier B-2 + bombe : cinématique en temps réel
  updateIceUlt(rawDt); // pluie de pics de glace (ultime campagne 2)
  updateLasers(rawDt); // faisceaux de feu du Titan de Feu
  updateVolcanoes(rawDt); // volcans éruptifs
  updateSewerUlt(rawDt);  // flaques d'acide + pluie de vase (boss/événements égouts)
  updateSpaceUlt(rawDt);  // trous noirs + tempête de void (boss/événements espace)
  updateHands(rawDt);  // mains de feu en vol
  updateEffects(dt);
}

// ---------- BOUCLE ----------
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  maybeAutoSync(); // synchronisation cloud périodique (compte connecté)
  draw();
  requestAnimationFrame(loop);
}

initWorlds();   // génère/charge le monde courant (seed + sauvegarde)
syncCamera(true);
initInput();
requestAnimationFrame(loop);
