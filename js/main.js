import { G, ctx, W, H, TAU, VERSION, finalWave, saveStats } from './state.js';
import { initInput } from './input.js';
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

// polices de l'interface (canvas) : chargement explicite au démarrage
if (document.fonts) ['600 16px Inter', '600 38px Cinzel'].forEach(f => document.fonts.load(f));

let lastTime = performance.now();

// rotation des types de boss toutes les 5 vagues
const bossCycle = ['boss', 'bossFoudre', 'bossGivre'];
const bossCycleEgout = ['bossEgout', 'matriarche', 'bossEgout'];
const bossCycleEspace = ['bossVoid', 'overlord', 'bossVoid'];
// vagues intermédiaires des boss finaux (campagne -> vague du boss intermédiaire)
const MID_BOSS_WAVE = { 2: 20, 3: 25, 4: 30 };

// inflige des dégâts au joueur (contact, foudre, projectile de glace)
function damagePlayer(dmg, slow = 1.0) {
  const p = G.player;
  if (G.godMode) { addDamageText(p.x, p.y - 18, 'IMMORTEL', '#69f0ae'); return; }
  if (p.attackMode === 3) dmg *= 0.6;   // bouclier : -40% de dégâts subis
  if (p.shieldT > 0) dmg *= 0.15;       // dôme de bouclier : -85% de dégâts subis
  dmg *= 1 - (G.equip ? G.equip.armorReduce : 0); // armure équipée
  if (G.iceStorm) dmg *= 0.5; // Pluie de Glace : les ennemis frappent 2× moins fort
  p.hp -= dmg;
  G.dmgTaken += dmg;
  sfxHurt();
  p.lastHurt = G.time;
  p.slowT = Math.max(p.slowT, slow);
  addDamageText(p.x, p.y - 18, `-${Math.round(dmg)}`, '#ff1744');
  spawnParticles(p.x, p.y, '#ff1744', 6, 4);
  // usure des équipements : chaque coup use l'armure, l'arme et le talisman
  if (G.inv) {
    const w = wearEquipment(G.inv);
    if (w.wear) for (const id in w.wear) G.runWear[id] = (G.runWear[id] || 0) + w.wear[id];
    if (w.broken) { addDamageText(p.x, p.y - 42, `💥 ${w.broken} CASSÉ !`, '#ff5252'); sfxBreak(); }
  }
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false; G.gameOver = true;
    G.bomber = null; // la cinématique de l'ultime s'arrête avec le héros
    G.iceStorm = null; G.iceSpikes = [];
    // cinématique de mort : le héros s'effondre pendant 1,8s avant le game over
    G.state = 'dying'; G.deathT = 1.8;
    G.deathDir = Math.random() < 0.5 ? -1 : 1;
    recordRun();
    // salve de mort : gerbe rouge, débris d'armure, onde de choc
    spawnParticles(p.x, p.y, '#ff1744', 30, 8);
    spawnParticles(p.x, p.y, '#78909c', 15, 5);
    G.rings.push({ x: p.x, y: p.y, r: p.r, maxR: 110, life: 40, maxLife: 40, color: '#ff1744' });
    G.screenFlash = 0.5; G.screenShake = 14;
  }
}

// ---------- UPDATE ----------
function update(dt) {
  // pause : jeu gelé, seul le compte à rebours de reprise défile
  if (G.state === 'paused') {
    if (G.resumeTimer > 0) {
      G.resumeTimer -= dt;
      if (G.resumeTimer <= 0) { G.resumeTimer = 0; G.state = 'playing'; }
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
    if (G.achToast) { G.achToast.t -= dt; if (G.achToast.t <= 0) G.achToast = null; }
    if (G.warnToast) { G.warnToast.t -= dt; if (G.warnToast.t <= 0) G.warnToast = null; }
    updateEffects(dt);
    if (G.deathT <= 0) { G.deathT = 0; G.state = 'gameover'; }
    return;
  }
  // victoire : les confettis continuent de danser derrière l'écran de fin,
  // et la secousse/flash de l'explosion finale s'estompent normalement
  if (G.state === 'victory') {
    G.screenShake = Math.max(0, G.screenShake - dt * 45);
    G.screenFlash = Math.max(0, G.screenFlash - dt);
    updateEffects(dt);
    return;
  }
  if (G.state !== 'playing' || G.gameOver) return;
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
  const pSpeed = p.speed * (p.slowT > 0 ? 0.55 : 1) * (p.attackMode === 3 ? 0.7 : 0.93); // ralenti si touché / lance plus lente que l'épée
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    p.x = Math.max(p.r, Math.min(worldW() - p.r, p.x + dx / len * pSpeed));
    p.y = Math.max(p.r, Math.min(worldH() - p.r, p.y + dy / len * pSpeed));
  }
  resolveObstacles(p); // rochers et montagnes bloquent le joueur
  collideIceWalls(p);  // les murs de glace du Souverain bloquent aussi le joueur

  // découverte des bâtiments : visibles sur la minimap seulement une fois vus
  {
    const w = curWorld();
    if (w) for (const b of w.buildings) {
      if (!b.seen && Math.abs(b.x - p.x) < W / 2 + 140 && Math.abs(b.y - p.y) < H / 2 + 140) b.seen = true;
    }
  }

  // Attaques : clic gauche = principale (épée/lance), clic droit = rotation secondaire
  // (verrouillé 2s après un changement d'arme)
  if (G.attackQueued && p.switchLock <= 0) {
    if (p.attackCooldown <= 0 && p.spinDuration <= 0) {
      G.attackQueued = false;
      if (p.ultActive > 0) doFireLaser(); // titan de feu : le clic lance le laser
      else if (p.attackMode === 3) doThrust(); else doSlash();
    }
  }
  if (G.spinQueued && p.switchLock <= 0 && p.spinCooldown <= 0 && p.attackMode !== 3) {
    G.spinQueued = false;
    doSpin();
  }
  // dôme de bouclier (clic droit en mode é) : -85% de dégâts pendant 2,5s
  if (G.shieldQueued) {
    G.shieldQueued = false;
    if (p.attackMode === 3 && p.shieldCd <= 0 && p.switchLock <= 0) doShield();
  }
  // main de feu (clic droit pendant la transformation du Titan de Feu)
  if (G.handQueued) {
    G.handQueued = false;
    if (p.ultActive > 0 && p.handCd <= 0 && !p.handUsed) doFireHand();
  }
  p.handCd = Math.max(0, p.handCd - dt);
  if (G.ultQueued) {
    if (p.ultCharge >= 100 && p.ultActive <= 0 && !G.bomber) {
      G.ultQueued = false;
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
  }
  p.ultAnim = Math.max(0, p.ultAnim - dt);
  p.potionCooldown = Math.max(0, p.potionCooldown - dt);
  p.shieldT = Math.max(0, p.shieldT - dt);
  p.shieldCd = Math.max(0, p.shieldCd - dt);
  p.switchLock = Math.max(0, p.switchLock - dt);
  G.cloudT = Math.max(0, G.cloudT - dt);
  G.screenFlash = Math.max(0, G.screenFlash - dt);
  G.screenShake = Math.max(0, G.screenShake - dt * 45);
  if (G.achToast) { G.achToast.t -= dt; if (G.achToast.t <= 0) G.achToast = null; }
  if (G.warnToast) { G.warnToast.t -= dt; if (G.warnToast.t <= 0) G.warnToast = null; }

  // Spawn : cadence en temps réel même pendant le ralenti (les monstres arrivent)
  G.spawnTimer -= rawDt;
  const interval = Math.max(0.55, 2.0 - G.wave * 0.13); // spawn légèrement plus rapide
  if (G.spawnTimer <= 0 && G.enemies.length < 20 && G.wave < finalWave() && !G.tutorial) {
    spawnEnemy();
    G.spawnTimer = interval;
  }
  // Quota de la vague : la tuer fait avancer (plus de blocage)
  if (!G.tutorial && G.waveKills >= G.waveTarget) { // le tutoriel gère ses propres ennemis
    G.wave++;
    G.waveKills = 0;
    G.waveTarget = 6 + G.wave * 2; // le quota grandit avec la vague
    G.wavePause = 2.5; // pause entre les vagues
    p.maxHp += 15;
    p.hp = Math.min(p.maxHp, p.hp + 30);
    p.attackDamage += 5;
    p.spinDamage += 3;
    p.speed = Math.min(3.1, p.speed + 0.04);
    addDamageText(p.x, p.y - 20, G.wave === finalWave() ? 'VAGUE FINALE !' : `VAGUE ${G.wave}!`, G.wave === finalWave() ? '#e040fb' : '#ffd740');
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
      const cycle = camp === 4 ? bossCycleEspace
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
        const et = camp === 4 ? ['alien', 'alien', 'drone', 'tentacule'][Math.floor(Math.random() * 4)]
          : camp === 3 ? ['rat', 'rat', 'crapaud', 'vase'][Math.floor(Math.random() * 4)]
          : camp === 1 ? 'alpha'
          : camp === 2 ? ['imp', 'imp', 'hound', 'demon'][Math.floor(Math.random() * 4)]
          : 'brute';
        spawnEnemy(et, true, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 2 + Math.random()); // portail visible 2-3s
      }
      addDamageText(p.x, p.y - 85,
        camp === 4 ? 'ÉVÉNEMENT : ESSAIM ALIEN !' : camp === 3 ? 'ÉVÉNEMENT : ESSAIM D\'ÉGOUT !' : camp === 1 ? 'ÉVÉNEMENT : MEUTE DES NEIGES !' : camp === 2 ? 'ÉVÉNEMENT : ESSAIM INFERNAL !' : 'ÉVÉNEMENT : BRUTES !',
        camp >= 1 ? (camp === 4 ? '#82b1ff' : camp === 3 ? '#aeea00' : camp === 1 ? '#4fc3f7' : '#ff7043') : '#ff7043');
    }
    // Enfers : le Baron surgit dès la vague 20 (boss intermédiaire,
    // sans vider le champ — la vague finale reste à la vague 30).
    // Égouts : le Tyran dès la vague 25 (sur 35) · Espace : l'Abomination dès la vague 30 (sur 40)
    const midWave = MID_BOSS_WAVE[G.campaign];
    if (midWave && G.wave === midWave) {
      const midType = G.campaign === 4 ? 'finalBossSpace' : G.campaign === 3 ? 'finalBossEgout' : 'finalBossEnfer';
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
        || en.type === 'finalBossEgout' || en.type === 'finalBossSpace')) {
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
    // boss final en agonie : il s'effondre au ralenti, plus aucune action
    if (e.bossDying) {
      e.bossDying -= dt;
      // gerbe d'âme qui s'élève du corps
      if (Math.random() < dt * 22) {
        spawnParticles(
          e.x + (Math.random() - 0.5) * e.r * 1.8,
          e.y - Math.random() * e.r * 1.2,
          e.type === 'finalBossGlace' ? '#b3e5fc' : e.type === 'finalBossEnfer' ? '#ffab40' : '#ce93d8',
          3, 4
        );
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
      const eSlow = e.slow > 0 ? 0.5 : 1; // ralenti quand on le frappe
      if ((e.type === 'spider' || e.type === 'hunter') && e.lunging > 0) {
        // en plein bond : trajectoire rapide vers la position visée
        e.lunging -= dt;
        e.x += e.lvx; e.y += e.lvy;
        e.x = Math.max(e.r, Math.min(worldW() - e.r, e.x));
        e.y = Math.max(e.r, Math.min(worldH() - e.r, e.y));
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 6) {
          damagePlayer(e.damage * 1.4, 1.0); // le bond frappe plus fort
          e.lunging = 0;
          e.lungeCd = 3.5 + Math.random() * 1.5;
        } else if (e.lunging <= 0) {
          e.lungeCd = 3.5 + Math.random() * 1.5;
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
        damagePlayer(e.damage, 1.0);
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
        || e.type === 'finalBossEgout' || e.type === 'finalBossSpace') updateFinalBoss(e, dt, p);
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
      if (Math.hypot(p.x - l.x, p.y - l.y) < 62) damagePlayer(l.dmg, 0.6);
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
      damagePlayer(pr.dmg, 1.5); // la glace ralentit bien le joueur
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
  // campagne — 15 PV/3s (Terres), 30 PV/3s (Terre Gelée), 50 PV/3s (Enfers)
  const REGEN_PS = [15 / 3, 30 / 3, 50 / 3, 65 / 3, 80 / 3]; // PV par seconde
  if (G.time - p.lastHurt > 3 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + REGEN_PS[G.campaign || 0] * dt);
  }

  // victoire : le boss final vient d'être vaincu -> cinématique + fin de partie
  if (G.pendingVictory) {
    G.pendingVictory = false;
    G.state = 'victory';
    recordRun(); // la victoire compte comme une partie réussie dans les stats
    // campagne terminée : débloque la suite (campagne 1 -> Frozen Land)
    G.stats.campaignDone = G.stats.campaignDone || {};
    G.stats.campaignDone[G.campaign] = true;
    if (G.campaign === 1) G.stats.iceUlt = true; // coffre : débloque la Pluie de Glace
    if (G.campaign === 2) G.stats.hellUlt = true; // trône : débloque la Colère Infernale
    saveStats();
    G.enemies.length = 0; G.drops.length = 0; G.fireZones.length = 0;
    G.portals.length = 0; G.projectiles.length = 0; G.lightnings.length = 0;
    G.iceWalls.length = 0; G.shockwaves.length = 0; G.iceSpikes.length = 0; G.skyIcicles.length = 0; G.snowPatches.length = 0; G.iceStorm = null;
    G.lasers.length = 0; G.hands.length = 0; G.volcanoes.length = 0; G.hellStorm = null;
    G.acidZones.length = 0; G.blackHoles.length = 0;
    G.acidRain = 0; G.voidStorm = 0;
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

// ---------- ÉVÉNEMENTS DES ENFERS ----------
// braises flottantes, pluie de cendres, meute de démons, éruption volcanique
function updateHellEvents(dt) {
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
      const m = ['or', 'essence', 'cristal', 'fer'][Math.floor(Math.random() * 4)];
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
function updateFrozenEvents(dt) {
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
        damagePlayer(30 * (1 - (G.equip ? G.equip.armorReduce : 0)), 1.4);
        p.slowT = Math.max(p.slowT, 2.5); // enseveli : très ralenti
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
      const m = ['cristal', 'essence', 'fer', 'or'][Math.floor(Math.random() * 4)];
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
function updateSewerEvents(dt) {
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
      const m = ['fer', 'cristal', 'or', 'essence'][Math.floor(Math.random() * 4)];
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
function updateSpaceEvents(dt) {
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
      const x = clampW(p.x + Math.cos(a) * d), y = clampH(p.y + Math.sin(a) * d);
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
      const m = ['cristal', 'essence', 'or', 'fer'][Math.floor(Math.random() * 4)];
      loot[m] = (loot[m] || 0) + (2 + Math.floor(Math.random() * 5));
    }
    for (const m in loot) { addMaterial(G.inv, m, loot[m]); G.runMats[m] = (G.runMats[m] || 0) + loot[m]; }
    if (Math.random() < 0.5) { p.potions = Math.min(p.maxPotions, p.potions + 1); }
    addDamageText(p.x, p.y - 60, '🛰 CACHE ORBITAL !', '#ffd740');
    spawnParticles(p.x, p.y, '#80d8ff', 20, 6);
  }
}
function waveBonusLocal() { return 1 + (G.wave - 1) * 0.06; }

// ---------- DESSIN ----------
function draw() {
  ctx.save();
  // secousse d'écran pendant la bombe atomique
  if (G.screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * G.screenShake, (Math.random() - 0.5) * G.screenShake);
  }
  // ---- monde : tout est dessiné en coordonnées monde, décalé par la caméra ----
  ctx.save();
  ctx.translate(-(G.camX || 0), -(G.camY || 0));
  drawTerrain();
  drawBuildings();
  drawWorldPortals();
  if (G.state !== 'menu') {
    drawCraters(); // cratères au sol (sous les entités)
    drawFireZones(); // feux de la bombe atomique (sous les entités)
    drawPortals();   // portails d'apparition des monstres
    // ennemis + obstacles triés par y pour pseudo-profondeur
    const w = curWorld();
    const obsItems = (w.obstacles || []).map(o => ({ _obs: o, y: o.y + o.r * 0.35 }));
    const sorted = [...G.enemies, ...obsItems].sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      if (e._obs) drawObstacle(e._obs, w.def); else drawEnemy(e);
    }
    drawDrops();
    drawProjectiles();
    drawSlashArc();
    drawPlayer();
    drawLightnings(); // télégraphes + bolts par-dessus les entités
    drawEffects();
    drawUltFlash();
    drawMushroom(); // champignon nuageux de la bombe (coords monde)
    drawIceStorm(); // pluie de pics de glace (coords monde)
    drawLasers();   // faisceaux de feu du Titan de Feu (coords monde)
    drawVolcanoes(); // volcans en éruption (coords monde)
    drawAcidZones(); // flaques de la Déluge Acide
    drawBlackHoles(); // trous noirs de l'ultime spatiale + événements
    drawVoidHole();  // télégraphe du micro-trou noir
    drawHands();    // mains de feu en vol (coords monde, par-dessus tout)
  }
  ctx.restore();

  // ---- écran : atmosphère, HUD et overlays (coordonnées écran) ----
  drawBackground();
  if (G.state === 'menu') {
    drawMenu();
    drawDurWarnPopup(); // popup durabilité par-dessus tous les écrans du menu
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(232,217,176,0.45)';
    ctx.fillText(`v${VERSION}`, W - 14, H - 12);
    drawMusicButton();
    ctx.restore();
    return;
  }
  if (G.state === 'victory') {
    drawVictory();
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(232,217,176,0.45)';
    ctx.fillText(`v${VERSION}`, W - 14, H - 12);
    drawMusicButton();
    ctx.restore();
    return;
  }

  // bannière de transition entre les vagues
  if (G.wavePause > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 72px Georgia, serif';
    ctx.fillStyle = 'rgba(255,215,64,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 24;
    ctx.fillText(G.wave >= finalWave() ? 'VAGUE FINALE' : `VAGUE ${G.wave}`, W / 2, H / 2 - 30);
    ctx.shadowBlur = 0;
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillStyle = 'rgba(232,217,176,0.85)';
    ctx.fillText(G.wave >= finalWave() ? (G.campaign === 4 ? 'L\'Abomination Cosmique déchire le vide...' : G.campaign === 3 ? 'Le Tyran des Profondeurs sort de l\'acide...' : G.campaign === 2 ? 'Le Baron de l\'Enfer s\'élève des braises...' : G.campaign === 1 ? 'Le Souverain de Glace émerge du blizzard...' : 'Le Seigneur Oublié émerge des profondeurs...') : 'La horde approche...', W / 2, H / 2 + 8);
  }
  drawClouds(); // ouverture par les nuages au lancement
  drawBomber(); // B-2 + bombe en chute (coords écran, au-dessus du monde)
  drawGrain(); // grain photographique par-dessus le monde (pas le HUD)
  drawMusicButton(); // pastille son ON/OFF (coin haut-droit)
  if (G.state === 'playing' || G.state === 'paused') {
    drawAdminButton(); // bouton 🛠 admin (actif seulement si mot de passe validé)
    drawAdminMenu();   // panneau de triche (se dessine si ouvert)
  }
  if (G.state !== 'intro') drawHUD(); // HUD caché pendant l'intro
  if (G.tutorial) drawTutorial(); // panneau d'objectif + flèche de cible
  drawAchToast(); // notification de succès débloqué
  drawWarnToast(); // avertissement équipement fragile
  if (G.screenFlash > 0) {
    ctx.fillStyle = `rgba(255,60,40,${G.screenFlash * 0.8})`;
    ctx.fillRect(0, 0, W, H);
  }
  // vignette rouge qui s'assombrit pendant la cinématique de mort
  if (G.state === 'dying') {
    const k = Math.min(1, Math.max(0, 1 - G.deathT / 1.8));
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.78);
    v.addColorStop(0, 'rgba(90,0,0,0)');
    v.addColorStop(1, `rgba(150,0,0,${0.12 + k * 0.42})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  if (G.state === 'gameover') drawGameOver();
  if (G.state === 'paused' && !G.adminMenu && !G.adminInput) drawPauseMenu(); // l'admin passe au-dessus
  // version du jeu, en bas à droite (visible partout : menu, partie, game over)
  ctx.font = '11px Consolas, monospace';
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(232,217,176,0.45)';
  ctx.fillText(`v${VERSION}`, W - 14, H - 12);
  ctx.restore();
}

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

function updateFinalBoss(e, dt, p) {
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
function updateBurrow(e, dt, p) {
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
function collideIceWalls(ent) {
  for (const wl of G.iceWalls) {
    const dx = ent.x - wl.x, dy = ent.y - wl.y;
    const d = Math.hypot(dx, dy), min = ent.r + wl.r;
    if (d > 0 && d < min) {
      const push = (min - d) / d;
      ent.x += dx * push; ent.y += dy * push;
    }
  }
}

// ---------- BOUCLE ----------
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initWorlds();   // génère/charge le monde courant (seed + sauvegarde)
syncCamera(true);
initInput();
requestAnimationFrame(loop);
