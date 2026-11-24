import { G, ctx, W, H, TAU, VERSION, finalWave, saveStats } from './state.js';
import { spawnEnemy, spawnMinibossWave, spawnBossWave, spawnFinalBoss, damageEnemy, enemyTypes } from './enemies.js';
import { doSlash, doSpin, doThrust, doUlt, doShield, doFireLaser, doFireHand, updateNuke, updateIceUlt, updateLasers, updateHands, updateVolcanoes, updateSewerUlt, updateSpaceUlt } from './attacks.js';
import { updateEffects, addDamageText, spawnParticles } from './effects.js';
import { drawBackground, drawEnemy, drawDrops, drawPlayer, drawSlashArc, drawUltFlash, drawMushroom, drawBomber, drawEffects, drawFireZones, drawCraters, drawPortals, drawProjectiles, drawLightnings, drawGrain, drawClouds, dayNight, drawTerrain, drawBuildings, drawWorldPortals, drawObstacle, drawIceStorm, drawLasers, drawHands, drawVolcanoes, drawAcidZones, drawBlackHoles, drawVoidHole, drawWindZones, drawStormTornado, drawBowShots, drawSingZones, drawBowReveal, drawGardienAura, drawSentenceCharge, drawKnifeShots, drawGardienReveal, drawAmbient, drawFalls, drawBiomeGrade, drawCloudShadows, drawSnowCover } from './graphics.js';
import { checkAchievements } from './achievements.js';
import { wearEquipment, addMaterial } from './inventory.js';
import { drawHUD, drawAchToast, drawWarnToast, drawLevelToast } from './hud.js';
import { drawSecrets, drawSwayDecor, drawDecorLights, drawLakeGlints } from './gfx/terrain.js';
import { drawMenu, drawGameOver, drawPauseMenu, drawVictory, recordRun, drawAdminMenu, drawAdminButton, drawDurWarnPopup } from './menu.js';
import { initWorlds, updateCamera, worldW, worldH, checkWavePortal, syncCamera, resolveObstacles, curWorld } from './world.js';
import { drawMusicButton, drawAudioPanel, sfxHurt, sfxWave, sfxPickup, sfxBreak, sfxBoss, sfxWarn, sfxPhase, sfxBossAtk } from './audio.js';
import { updateTutorial, drawTutorial } from './tutorial.js';
import { tickPlaytime } from './chars.js';
import { drawShop, drawShopBtn } from './shop.js';
import { drawModuleHUD } from './modules.js';

// ---------- DESSIN ----------
export function draw() {
  ctx.save();
  // boutique : vue exclusive plein écran (comme la forge) — aucun autre overlay
  if (G.shopOpen) {
    ctx.fillStyle = '#0a0c12'; ctx.fillRect(0, 0, W, H);
    drawShop();
    ctx.restore();
    return;
  }
  // secousse d'écran pendant la bombe atomique
  if (G.screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * G.screenShake, (Math.random() - 0.5) * G.screenShake);
  }
  // ---- monde : tout est dessiné en coordonnées monde, décalé par la caméra ----
  ctx.save();
  ctx.translate(-(G.camX || 0), -(G.camY || 0));
  drawTerrain();
  drawSnowCover();  // couverture de neige de la Pluie de Glace (sous les entités)
  drawAmbient();   // particules d'ambiance du biome (neige, braises, spores...)
  drawSwayDecor(); // végétation ondulée par le vent (sous-ensemble animé)
  drawDecorLights(); // halos vacillants des éléments luminescents
  ctx.save();
  ctx.filter = 'saturate(1.18) contrast(1.05)';
  drawBuildings();
  ctx.restore();
  drawWorldPortals();
  drawFalls();      // cascades animées (eau, glace, lave) — coords monde
  drawSecrets();    // sites cachés animés (feu de camp, artefact, autel)
  drawLakeGlints(); // reflets scintillants sur les lacs — coords monde
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
    drawBowShots();  // flèches d'énergie de l'arc cinétique
    drawSingZones(); // zones de distorsion de la singularité
    drawKnifeShots(); // couteaux de lancer du Jugement (projectiles au-dessus des entités)
    drawSlashArc();
    drawGardienAura(); // halo discret de l'arme équipée
    drawPlayer();
    drawSentenceCharge(); // cercle de runes pendant la concentration
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
    drawWindZones(); // courants d'air du Royaume des Tempêtes
    drawStormTornado(); // tornade des événements/boss des Tempêtes
    drawHands();    // mains de feu en vol (coords monde, par-dessus tout)
  }
  ctx.restore();

  // ---- écran : atmosphère, HUD et overlays (coordonnées écran) ----
  drawBackground();
  drawBiomeGrade(); // voile teinté par biome (couleurs plus riches)
  drawCloudShadows(); // nappes d'ombre de nuages dérivant sur le monde
  // Pluie de Glace : assombrissement glacé progressif pendant l'ultime
  if (G.iceDim > 0.01) {
    ctx.fillStyle = `rgba(5,12,30,${G.iceDim})`;
    ctx.fillRect(0, 0, W, H);
    const fg = ctx.createLinearGradient(0, H * 0.55, 0, H);
    fg.addColorStop(0, 'rgba(120,200,255,0)');
    fg.addColorStop(1, `rgba(140,220,255,${G.iceDim * 0.45})`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  }
  if (G.state === 'menu') {
    drawMenu();
    drawDurWarnPopup(); // popup durabilité par-dessus tous les écrans du menu
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(232,217,176,0.45)';
    ctx.fillText(`v${VERSION}`, W - 14, H - 12);
    drawMusicButton(); drawShopBtn(); drawAudioPanel();
    ctx.restore();
    return;
  }
  if (G.state === 'victory') {
    drawVictory();
    drawBowReveal(); // cinématique de découverte de l'arc (premières secondes)
    drawGardienReveal(); // cinématique de découverte du Jugement du Gardien
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(232,217,176,0.45)';
    ctx.fillText(`v${VERSION}`, W - 14, H - 12);
    drawMusicButton(); drawAudioPanel();
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
  drawMusicButton(); // pastilles son/effets (coin haut-droit) — boutique : menu uniquement
  if (G.state === 'playing' || G.state === 'paused') {
    drawAdminButton(); // bouton 🛠 admin (actif seulement si mot de passe validé)
    drawAdminMenu();   // panneau de triche (se dessine si ouvert)
  }
  if (G.state !== 'intro') drawHUD(); // HUD caché pendant l'intro
  drawModuleHUD(); // icône du module actif + cooldown (X)
  if (G.tutorial) drawTutorial(); // panneau d'objectif + flèche de cible
  drawAchToast(); // notification de succès débloqué
  drawLevelToast(); // notification de niveau global
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
  drawAudioPanel(); // panneau de réglages audio par-dessus tout
  ctx.restore();
}

