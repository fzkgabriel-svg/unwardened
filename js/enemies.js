import { G, TAU, finalWave } from './state.js';
import { worldW, worldH, resolveObstacles } from './world.js';
import { addDamageText, spawnParticles } from './effects.js';
import { gainXp } from './player.js';
import { MATS, MATERIAL_DROPS, addMaterial, modeKey, modeMult } from './inventory.js';
import { sfxHit, sfxDie, sfxBoss, sfxBossRoar, sfxBossDie, sfxBossHit, sfxGem } from './audio.js';
import { modDmgMult, modCritBonus, modLifesteal } from './modules.js';

export const enemyTypes = {
  slime:    { name: 'Slime',        hp: 30,  speed: 0.75, damage: 8,  xp: 10,  r: 13, aggro: Infinity, range: 17, color: '#4caf50', glow: '#69f0ae' },
  bat:      { name: 'Chauve-souris', hp: 20,  speed: 1.0,  damage: 6,  xp: 12,  r: 11, aggro: Infinity, range: 21, color: '#ab47bc', glow: '#e1bee7' },
  brute:    { name: 'Brute',        hp: 80,  speed: 1.1,  damage: 16, xp: 24,  r: 15, aggro: Infinity, range: 21, color: '#d84315', glow: '#ffab91' },
  miniboss: { name: 'Mini-Boss',    hp: 100, speed: 0.7,  damage: 14, xp: 40,  r: 24, aggro: Infinity, range: 29, color: '#fb8c00', glow: '#ffd54f', isMini: true },
  golem:    { name: 'Golem',        hp: 85,  speed: 0.45, damage: 18, xp: 25,  r: 19, aggro: Infinity, range: 31, color: '#8d6e63', glow: '#d7ccc8' },
  boss:     { name: 'Boss',         hp: 370, speed: 0.7,  damage: 24, xp: 120, r: 32, aggro: Infinity, range: 37, color: '#c62828', glow: '#ff8a80', isBoss: true },
  bossFoudre:{ name: 'Boss Foudre',  hp: 340, speed: 0.55, damage: 20, xp: 140, r: 30, aggro: Infinity, range: 0,  color: '#5c6bc0', glow: '#b388ff', isBoss: true, attack: 'lightning' },
  bossGivre:{ name: 'Boss Givre',   hp: 420, speed: 0.5,  damage: 18, xp: 150, r: 31, aggro: Infinity, range: 0,  color: '#4fc3f7', glow: '#b3e5fc', isBoss: true, attack: 'ice' },
  witch:    { name: 'Sorcière',     hp: 60,  speed: 0.8,  damage: 10, xp: 22,  r: 14, aggro: Infinity, range: 0,  color: '#6a1b9a', glow: '#ce93d8', attack: 'hex' },
  spider:   { name: 'Araignée',     hp: 45,  speed: 1.35, damage: 9,  xp: 16,  r: 13, aggro: Infinity, range: 21, color: '#4e342e', glow: '#ffab91' },
  finalBoss:{ name: 'Seigneur Oublié', hp: 1, speed: 0.55, damage: 30, xp: 800, r: 46, aggro: Infinity, range: 60, color: '#4a148c', glow: '#e040fb', isBoss: true, attack: 'hex' },
  // ---------- THE FROZEN LAND : créatures gelées ----------
  yeti:     { name: 'Prédateur des Neiges', hp: 75,  speed: 1.55, damage: 17, xp: 22,  r: 14, aggro: Infinity, range: 19, color: '#eceff1', glow: '#b3e5fc' },
  glacier:  { name: 'Géant des Glaces',    hp: 230, speed: 0.42, damage: 31, xp: 44,  r: 23, aggro: Infinity, range: 33, color: '#4fc3f7', glow: '#e1f5fe' },
  crypt:    { name: 'Créature des Grottes',hp: 85,  speed: 0.85, damage: 16, xp: 28,  r: 14, aggro: Infinity, range: 0,  color: '#263238', glow: '#80deea', attack: 'ice' },
  hunter:   { name: 'Chasseur Gelé',       hp: 68,  speed: 1.3,  damage: 15, xp: 20,  r: 13, aggro: Infinity, range: 21, color: '#90a4ae', glow: '#e1f5fe' },
  alpha:    { name: 'Alpha des Neiges',    hp: 195, speed: 1.15, damage: 25, xp: 62,  r: 20, aggro: Infinity, range: 26, color: '#ffffff', glow: '#4fc3f7', isMini: true },
  bossGlace:{ name: 'Roi de Glace',        hp: 620, speed: 0.5,  damage: 33, xp: 210, r: 33, aggro: Infinity, range: 0,  color: '#29b6f6', glow: '#e1f5fe', isBoss: true, attack: 'ice' },
  bossCryo: { name: 'Souveraine Cryo',     hp: 680, speed: 0.45, damage: 36, xp: 235, r: 32, aggro: Infinity, range: 0,  color: '#0288d1', glow: '#b3e5fc', isBoss: true, attack: 'hex' },
  finalBossGlace:{ name: 'Souverain de Glace', hp: 1, speed: 0.5, damage: 46, xp: 1200, r: 50, aggro: Infinity, range: 62, color: '#01579b', glow: '#80d8ff', isBoss: true, attack: 'ice' },
  // ---------- LES ENFERS : créatures infernales ----------
  imp:      { name: 'Diablotin',            hp: 95,  speed: 1.7,  damage: 19, xp: 26,  r: 12, aggro: Infinity, range: 17, color: '#e64a19', glow: '#ffab40' },
  hound:    { name: 'Mastiff des Enfers',   hp: 150, speed: 1.45, damage: 24, xp: 34,  r: 15, aggro: Infinity, range: 21, color: '#4e342e', glow: '#ff5722' },
  cultist:  { name: 'Acolyte',              hp: 110, speed: 0.85, damage: 20, xp: 40,  r: 14, aggro: Infinity, range: 0,  color: '#6d1f1f', glow: '#ff7043', attack: 'hex' },
  demon:    { name: 'Démon',               hp: 190, speed: 1.0,  damage: 28, xp: 48,  r: 17, aggro: Infinity, range: 23, color: '#8e0000', glow: '#ff5252' },
  golemEnf: { name: 'Golem de Braise',     hp: 320, speed: 0.4,  damage: 38, xp: 60,  r: 22, aggro: Infinity, range: 33, color: '#3e2723', glow: '#ff8a50' },
  bossEnf:  { name: 'Démon Seigneur',       hp: 800, speed: 0.55, damage: 40, xp: 280, r: 34, aggro: Infinity, range: 0,  color: '#b71c1c', glow: '#ff7043', isBoss: true, attack: 'fire' },
  priest:   { name: 'Prêtre des Enfers',   hp: 240, speed: 0.8,  damage: 26, xp: 75,  r: 18, aggro: Infinity, range: 0,  color: '#4a148c', glow: '#e040fb', isMini: true, attack: 'hex' },
  finalBossEnfer:{ name: 'Le Baron de l\'Enfer', hp: 1, speed: 0.52, damage: 72, xp: 1800, r: 54, aggro: Infinity, range: 64, color: '#7f0000', glow: '#ffab00', isBoss: true, attack: 'fire' },
  // ---------- LES ÉGOUTS : créatures souterraines (campagne 4) ----------
  rat:      { name: 'Rat Géant',           hp: 55,  speed: 2.1,  damage: 12, xp: 16,  r: 10, aggro: Infinity, range: 15, color: '#6d5a48', glow: '#a1887f' },
  vase:     { name: 'Vase Toxique',        hp: 110, speed: 0.55, damage: 18, xp: 32,  r: 16, aggro: Infinity, range: 0,  color: '#558b2f', glow: '#aeea00', attack: 'acid' },
  crapaud:  { name: 'Crapaud des Égoûts',  hp: 150, speed: 1.0,  damage: 24, xp: 38,  r: 15, aggro: Infinity, range: 19, color: '#4e6b3a', glow: '#aed581' },
  ver:      { name: 'Ver des Profondeurs', hp: 190, speed: 0.8,  damage: 26, xp: 46,  r: 17, aggro: Infinity, range: 0,  color: '#7a6a52', glow: '#d7ccc8', attack: 'acid' },
  chanter:  { name: 'Chanteur des Égoûts',  hp: 130, speed: 0.85, damage: 20, xp: 42,  r: 14, aggro: Infinity, range: 0,  color: '#5d4037', glow: '#bcaaa4', attack: 'hex' },
  matriarche:{ name: 'Matriarche',          hp: 300, speed: 0.9,  damage: 30, xp: 90,  r: 22, aggro: Infinity, range: 26, color: '#6d4c41', glow: '#ffab91', isMini: true },
  bossEgout:{ name: 'Roi des Rats',        hp: 950, speed: 0.5,  damage: 44, xp: 320, r: 34, aggro: Infinity, range: 0,  color: '#5d4037', glow: '#aed581', isBoss: true, attack: 'acid' },
  finalBossEgout:{ name: 'Le Tyran des Profondeurs', hp: 1, speed: 0.5, damage: 80, xp: 2200, r: 56, aggro: Infinity, range: 66, color: '#3e2723', glow: '#aeea00', isBoss: true, attack: 'acid' },
  // ---------- L'ESPACE : créatures extraterrestres (campagne 5) ----------
  alien:    { name: 'Alien Rampant',       hp: 140, speed: 1.45, damage: 26, xp: 40,  r: 14, aggro: Infinity, range: 19, color: '#7b1fa2', glow: '#ce93d8' },
  drone:    { name: 'Drone de Chasse',     hp: 100, speed: 1.9,  damage: 22, xp: 32,  r: 12, aggro: Infinity, range: 0,  color: '#455a64', glow: '#80d8ff', attack: 'bolt' },
  tentacule:{ name: 'Tentacule Stellaire', hp: 220, speed: 0.7,  damage: 34, xp: 58,  r: 19, aggro: Infinity, range: 0,  color: '#311b92', glow: '#b388ff', attack: 'bolt' },
  cristal:  { name: 'Cristal Vivant',      hp: 170, speed: 0.85, damage: 30, xp: 50,  r: 16, aggro: Infinity, range: 23, color: '#00838f', glow: '#80deea' },
  overlord: { name: 'Dominator',           hp: 340, speed: 1.0,  damage: 38, xp: 110, r: 24, aggro: Infinity, range: 28, color: '#1a237e', glow: '#64b5f6', isMini: true },
  bossVoid: { name: 'Seigneur Stellaire',  hp: 1100,speed: 0.5,  damage: 52, xp: 400, r: 36, aggro: Infinity, range: 0,  color: '#283593', glow: '#82b1ff', isBoss: true, attack: 'bolt' },
  finalBossSpace:{ name: 'L\'Abomination Cosmique', hp: 1, speed: 0.5, damage: 95, xp: 3000, r: 58, aggro: Infinity, range: 68, color: '#0d0a1f', glow: '#b388ff', isBoss: true, attack: 'bolt' },
  // ---------- LE ROYAUME DES TEMPÊTES : créatures du vent (campagne 6) ----------
  courant:  { name: 'Enfant du Vent',         hp: 120, speed: 2.2,  damage: 24, xp: 36,  r: 12, aggro: Infinity, range: 17, color: '#b3e5fc', glow: '#e1f5fe' },
  rafale:   { name: 'Rafale Vivante',        hp: 150, speed: 1.7,  damage: 27, xp: 42,  r: 14, aggro: Infinity, range: 0,  color: '#4fc3f7', glow: '#b2ebf2', attack: 'bolt' },
  esprit:   { name: 'Esprit de la Brise',    hp: 200, speed: 1.0,  damage: 30, xp: 52,  r: 16, aggro: Infinity, range: 0,  color: '#80deea', glow: '#e0f7fa', attack: 'hex' },
  gardien:  { name: 'Gardien de la Tempête', hp: 280, speed: 0.75, damage: 36, xp: 66,  r: 20, aggro: Infinity, range: 26, color: '#546e7a', glow: '#4fc3f7' },
  colosse:  { name: 'Colosse des Nuages',    hp: 380, speed: 0.55, damage: 44, xp: 100, r: 24, aggro: Infinity, range: 30, color: '#37474f', glow: '#80d8ff', isMini: true },
  bossOuragan:{ name: 'Typhon Céleste',      hp: 1400,speed: 0.5,  damage: 58, xp: 480, r: 38, aggro: Infinity, range: 0,  color: '#1565c0', glow: '#4fc3f7', isBoss: true, attack: 'bolt' },
  finalBossTempete:{ name: 'Le Souverain des Ouragans', hp: 1, speed: 0.5, damage: 110, xp: 4000, r: 60, aggro: Infinity, range: 70, color: '#0d2b45', glow: '#80d8ff', isBoss: true, attack: 'bolt' },
};

function difficultyScale() {
  const base = 1 + (G.wave - 1) * 0.5;
  if (G.campaign === 5) return base * 5.2;   // Les Tempêtes : le plus dur
  if (G.campaign === 4) return base * 4.4;   // L'Espace
  if (G.campaign === 3) return base * 3.6;   // Les Égouts
  if (G.campaign === 2) return base * 2.6;   // Les Enfers
  return G.campaign === 1 ? base * 1.8 : base; // The Frozen Land est plus rude
}

export function spawnEnemy(forceType = null, bigPortal = false, px = null, py = null, portalTime = null) {
  const roll = Math.random();
  const camp = G.campaign; // 0 = Terres Oubliées, 1 = Frozen Land, 2 = Enfers
  let type = forceType;
  if (!type) {
    if (camp === 2) {
      // faune infernale : diablotins rapides, mastiffs, acolytes, démons, golems
      const minisAlive = G.enemies.filter(e => e.type === 'priest').length;
      if (G.wave % 3 === 0 && minisAlive < 2 && roll < 0.5) type = 'priest';
      else if (G.wave >= 3 && roll < 0.13) type = 'golemEnf';
      else if (G.wave >= 4 && roll < 0.28) type = 'demon';
      else if (G.wave >= 3 && roll < 0.44) type = 'cultist';
      else if (G.wave >= 2 && roll < 0.62) type = 'hound';
      else type = 'imp'; // jamais de monstre des autres campagnes en Enfer
    } else if (camp === 1) {
      // faune hivernale : prédateurs rapides, géants lents, créatures de grotte
      const minisAlive = G.enemies.filter(e => e.type === 'alpha').length;
      if (G.wave % 3 === 0 && minisAlive < 2 && roll < 0.5) type = 'alpha';
      else if (G.wave >= 3 && roll < 0.14) type = 'glacier';
      else if (G.wave >= 2 && roll < 0.30) type = 'crypt';
      else if (G.wave >= 2 && roll < 0.50) type = 'hunter';
      else if (G.wave >= 4 && roll < 0.72) type = 'yeti';
      else type = 'yeti'; // jamais de monstre de la campagne 1 en Frozen Land
    } else if (camp === 3) {
      // faune des égouts : rats rapides, crapauds, vers, vases toxiques
      const minisAlive = G.enemies.filter(e => e.type === 'matriarche').length;
      if (G.wave % 3 === 0 && minisAlive < 2 && roll < 0.5) type = 'matriarche';
      else if (G.wave >= 3 && roll < 0.14) type = 'ver';
      else if (G.wave >= 4 && roll < 0.30) type = 'vase';
      else if (G.wave >= 2 && roll < 0.50) type = 'crapaud';
      else if (G.wave >= 5 && roll < 0.68) type = 'chanter';
      else type = 'rat'; // jamais de monstre d'une autre campagne dans les égouts
    } else if (camp === 4) {
      // faune extraterrestre : aliens rapides, drones, tentacules, cristaux
      const minisAlive = G.enemies.filter(e => e.type === 'overlord').length;
      if (G.wave % 3 === 0 && minisAlive < 2 && roll < 0.5) type = 'overlord';
      else if (G.wave >= 3 && roll < 0.14) type = 'tentacule';
      else if (G.wave >= 3 && roll < 0.30) type = 'cristal';
      else if (G.wave >= 2 && roll < 0.52) type = 'drone';
      else type = 'alien'; // jamais de monstre d'une autre campagne dans l'espace
    } else if (camp === 5) {
      // faune des tempêtes : enfants du vent rapides, rafales, esprits, gardiens
      const minisAlive = G.enemies.filter(e => e.type === 'colosse').length;
      if (G.wave % 3 === 0 && minisAlive < 2 && roll < 0.5) type = 'colosse';
      else if (G.wave >= 3 && roll < 0.14) type = 'esprit';
      else if (G.wave >= 4 && roll < 0.30) type = 'rafale';
      else if (G.wave >= 2 && roll < 0.52) type = 'gardien';
      else if (G.wave >= 2 && roll < 0.80) type = 'courant';
      else type = 'courant'; // jamais de monstre d'une autre campagne dans les tempêtes
    } else {
    // Mini-boss aléatoire en cours de vague (les boss n'apparaissent qu'au début des vagues ×5)
    const minisAlive = G.enemies.filter(e => e.type === 'miniboss').length;
    if (G.wave % 3 === 0 && minisAlive < 2 && roll < 0.5) type = 'miniboss';
    else if (G.wave >= 3 && roll < 0.15) type = 'golem';
    else if (G.wave >= 2 && roll < 0.42) type = 'bat';
    else if (G.wave >= 2 && roll < 0.58) type = 'brute';
    else if (G.wave >= 6 && roll < 0.68) type = 'witch'; // sorcières dès la vague 6
    else if (G.wave >= 4 && roll < 0.78) type = 'spider'; // araignées dès la vague 4
    else type = 'slime';
    }
  }

  const t = enemyTypes[type];
  const scale = difficultyScale();

  // spawn en anneau autour du joueur (coords monde), hors de l'écran puis rentré
  let x = 0, y = 0;
  if (px !== null && py !== null) { x = px; y = py; } // position imposée (événement)
  else {
    const p = G.player;
    for (let t = 0; t < 6; t++) {
      const a = Math.random() * TAU, d = 760 + Math.random() * 160;
      const cx = Math.max(40, Math.min(worldW() - 40, p.x + Math.cos(a) * d));
      const cy = Math.max(40, Math.min(worldH() - 40, p.y + Math.sin(a) * d));
      // près des bords du monde, on accepte le point le plus éloigné du joueur
      if (Math.hypot(cx - p.x, cy - p.y) > 560 || t === 5) { x = cx; y = cy; break; }
      x = cx; y = cy;
    }
  }

  const extraScale = t.isBoss ? 1 + Math.floor(G.wave / 5) * 0.5
                   : (type === 'miniboss' || type === 'alpha' || type === 'priest' || type === 'matriarche' || type === 'overlord' || type === 'colosse') ? 1 + Math.floor(G.wave / 3) * 0.3 : 1;
  // NG+ / défi du jour : multiplicateurs de la partie (G.mods, voir challenge.js)
  const md = (G.mods && G.mods.enemyMult) || 1;
  // Les Enfers et au-delà : dégâts de base encore plus majorés
  const dmgMult = G.campaign === 5 ? 4.2 : G.campaign === 4 ? 3.4 : G.campaign === 3 ? 2.8 : G.campaign === 2 ? 2.3 : G.campaign === 1 ? 1.5 : 1;

  // portail d'apparition (surdimensionné et rougeoyant pour l'événement des brutes)
  const portalLife = portalTime !== null ? portalTime : bigPortal ? 1.3 : 0.8;
  G.portals.push({
    x, y,
    r: t.r * (bigPortal ? 4.2 : 2.8),
    life: portalLife, maxLife: portalLife,
    color: G.campaign === 5 ? '#4fc3f7' : G.campaign === 4 ? '#82b1ff' : G.campaign === 3 ? '#aeea00' : G.campaign === 2 ? '#ff5722' : bigPortal ? '#ff5722' : '#a855f7'
  });

  G.enemies.push({
    ...t, type,
    hp: t.hp * scale * extraScale * md, maxHp: t.hp * scale * extraScale * md,
    speed: t.speed * (1 + (G.wave - 1) * 0.08) * ((G.mods && G.mods.speedMult) || 1),
    damage: t.damage * (1 + (G.wave - 1) * 0.25) * extraScale * dmgMult * md,
    xp: Math.round(t.xp * ((G.mods && G.mods.xpMult) || 1)),
    x, y, attackCooldown: 0, wobble: Math.random() * TAU, slow: 0, spawnT: portalLife, spawnMax: portalLife,
    specialCd: 1.5 + Math.random() * 2.5, // timer des attaques spéciales de boss
    graceT: portalTime || 0, // invulnérable et immobile pendant le portail (événement)
    lunging: 0, lungeCd: 2 + Math.random() * 2.5, lvx: 0, lvy: 0 // bond de l'araignée
  });
  resolveObstacles(G.enemies[G.enemies.length - 1]); // jamais spawné dans un rocher
}

export function damageEnemy(e, dmg, angle) {
  if (e.graceT > 0) {
    addDamageText(e.x, e.y - e.r - 6, 'IMMUNI', '#90a4ae');
    return;
  }
  if (e.burrow && e.burrow.phase !== 'rise') {
    addDamageText(e.x, e.y - e.r - 6, 'SOUS TERRE', '#90a4ae');
    return; // le Seigneur Oublié est intouchable quand il est enfoui
  }
  if (e.bossDying) return; // déjà en train de mourir : plus rien ne le touche
  // bouclier de phase du boss final : totalement invulnérable pendant 10 s
  if (e.shieldT > 0) {
    addDamageText(e.x, e.y - e.r - 22, '🛡 IMMUNI', '#80d8ff');
    return;
  }
  const mk = modeKey(G.player.attackMode); // épée (mode 1) ou lance (mode 3)
  let real = dmg * (G.equip ? G.equip.weaponMult : 1) * (G.inv ? modeMult(G.inv, mk) : 1) * modDmgMult();
  // coup critique : instinct du chasseur (+12 %) sur une base de 5 %
  const isCrit = Math.random() < 0.05 + modCritBonus();
  if (isCrit) real *= 1.75;
  e.hp -= real;
  // absorption : une partie des dégâts infligés soigne le héros
  const ls = modLifesteal();
  if (ls > 0 && G.player.alive && G.player.hp > 0) {
    G.player.hp = Math.min(G.player.maxHp, G.player.hp + real * ls);
  }
  (e.isBoss || e.isMini ? sfxBossHit : () => sfxHit(e.r > 32 || isCrit)); // les boss ont un impact plus lourd
  G.dmgDealt += real;
  // progression : le type d'arme (épée/lance) gagne l'XP des dégâts infligés
  G.runWmode = G.runWmode || {};
  G.runWmode[mk] = (G.runWmode[mk] || 0) + real;
  e.slow = Math.max(e.slow || 0, 1.5); // ralenti 1,5s quand on le frappe
  e.hitFlash = 0.12; // flash blanc à chaque coup subi
  addDamageText(e.x + (Math.random() - 0.5) * 10, e.y - e.r - 6, (isCrit ? 'CRIT ' : '') + Math.round(real), isCrit ? '#ff5252' : '#ffeb3b');
  spawnParticles(e.x, e.y, e.glow, 5, 3);
  const idx = G.enemies.indexOf(e);
  if (e.hp <= 0) {
    // boss final : cinématique de mort (effondrement au ralenti) avant la victoire
    if ((e.type === 'finalBoss' || e.type === 'finalBossGlace' || e.type === 'finalBossEnfer'
      || e.type === 'finalBossEgout' || e.type === 'finalBossSpace' || e.type === 'finalBossTempete') && !e.bossDying) {
      e.bossDying = 2.4;
      e.hp = 0;
      sfxBossDie(e.type); // long effondrement sonore pendant l'agonie, teinté par l'univers du boss
      G.screenShake = Math.max(G.screenShake, 18);
      G.screenFlash = Math.max(G.screenFlash, 0.55);
      G.rings.push({
        x: e.x, y: e.y, r: e.r, maxR: 240, life: 42, maxLife: 42,
        color: e.type === 'finalBossGlace' ? '#81d4fa' : e.type === 'finalBossEnfer' ? '#ff7043'
          : e.type === 'finalBossEgout' ? '#aeea00' : e.type === 'finalBossSpace' ? '#b388ff'
          : e.type === 'finalBossTempete' ? '#4fc3f7' : '#e040fb'
      });
      spawnParticles(e.x, e.y, e.glow, 46, 10);
      spawnParticles(e.x, e.y, '#ffffff', 24, 8);
      spawnParticles(e.x, e.y, e.type === 'finalBossEnfer' ? '#ffab00' : '#ff5252', 20, 9);
      addDamageText(e.x, e.y - e.r - 30, 'LE BOSS S\'EFFONDRE...', '#ffd740');
      return; // la mort effective est gérée dans la boucle de mise à jour
    }
    sfxDie(e.r > 34 ? 'big' : ''); // les gros monstres ont une mort plus grave
    spawnParticles(e.x, e.y, e.color, 18, 6);
    addDamageText(e.x, e.y - 16, `+${e.xp} XP`, '#40c4ff');
    gainXp(e.xp);
    // charge de l'ultime selon la sélection : Titan de Feu très lent (×0,22),
    // Pluie de Glace nettement plus difficile (×0,3 — ~3× plus de cibles que la bombe)
    const sel = G.stats.ultSel || 'nuke';
    const ultMult = sel === 'hell' && G.stats.hellUlt ? 0.22
      : sel === 'glace' && G.stats.iceUlt ? 0.3 : 1;
    const gain = e.isBoss ? 30 : e.isMini ? 15 : 4;
    G.player.ultCharge = Math.min(100, G.player.ultCharge + gain * ultMult);
    // drop de fiole au sol : monstre 3%, mini-boss 8%, boss 15%,
    // le taux augmente avec la vague (+6 %/vague, plafonné à 50 %)
    const waveBoost = 1 + G.wave * 0.06;
    const lootBoost = (G.mods && G.mods.lootMult) || 1;
    const dropChance = Math.min(0.5, (e.isBoss ? 0.15 : e.isMini ? 0.08 : 0.03) * waveBoost) * lootBoost;
    if (!(G.mods && G.mods.noPotions) && Math.random() < dropChance) {
      G.drops.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y + (Math.random() - 0.5) * 20, r: 12, life: 12 }); // disparaît après 12s
    }
    if (e.isBoss) G.bossesKilled++;
    // drops de matériaux (cuir, fer, or, essence, cristal)
    // les monstres communs donnent ~40 % de moins : les succès par monde
    // compensent, et les boss gardent leurs loots complets
    const table = MATERIAL_DROPS[e.type] || {};
    const matMult = (e.isBoss || e.isMini || e.type.startsWith('finalBoss')) ? 1 : 0.6;
    let mi = 0;
    let gotEmerald = false;
    for (const m in table) {
      if (Math.random() < table[m] * matMult) {
        // l'émeraude est précieuse : les boss en lâchent une petite poignée
        const qty = m === 'emeraude'
          ? Math.round(((e.type.startsWith('finalBoss') ? 8 : e.isBoss ? 5 : e.isMini ? 3 : 1)) * ((G.mods && G.mods.lootMult) || 1))
          : 1;
        if (m === 'emeraude') gotEmerald = true;
        addMaterial(G.inv, m, qty);
        G.runMats[m] = (G.runMats[m] || 0) + qty; // résumé de fin de partie
        addDamageText(e.x + (mi % 3 - 1) * 14, e.y - e.r - 26 - mi * 10, `+${qty} ${MATS[m].name}`, MATS[m].color);
        mi++;
      }
    }
    if (gotEmerald) sfxGem(); // carillon cristallin : butin d'émeraudes
    G.enemies.splice(idx, 1);
    G.kills++;
    G.waveKills++; // compte pour le quota de la vague
    G.typeKills[e.type] = (G.typeKills[e.type] || 0) + 1; // stats par type (succès)
    // le boss final ne déclenche la victoire qu'à la vague finale :
    // en Enfer il surgit dès la vague 20 comme boss intermédiaire
    const isFinalType = e.type === 'finalBoss' || e.type === 'finalBossGlace' || e.type === 'finalBossEnfer'
      || e.type === 'finalBossEgout' || e.type === 'finalBossSpace' || e.type === 'finalBossTempete';
    if (isFinalType && G.wave >= finalWave()) G.pendingVictory = true;
  }
}

// Boss final de la vague 20 : émerge de terre près du joueur dans une explosion,
// invulnérable pendant l'émergence (graceT), très résistant et puissant.
// En campagne 2, c'est le Souverain de Glace — encore plus imposant.
export function spawnFinalBoss() {
  sfxBossRoar(); // rugissement immense à l'émergence du boss final
  const p = G.player;
  const a = Math.random() * TAU, d = 300;
  const x = Math.max(60, Math.min(worldW() - 60, p.x + Math.cos(a) * d));
  const y = Math.max(60, Math.min(worldH() - 60, p.y + Math.sin(a) * d));
  const frozen = G.campaign === 1;
  const hell = G.campaign === 2;
  const sewer = G.campaign === 3;
  const space = G.campaign === 4;
  const storm = G.campaign === 5;
  const type = hell ? 'finalBossEnfer' : frozen ? 'finalBossGlace'
    : sewer ? 'finalBossEgout' : space ? 'finalBossSpace' : storm ? 'finalBossTempete' : 'finalBoss';
  const hp = (storm ? 21000 : hell ? 11500 : space ? 17000 : sewer ? 14000 : frozen ? 7500 : 4000)
    + p.level * (storm ? 1000 : space ? 800 : sewer ? 650 : hell ? 550 : frozen ? 450 : 300);
  const e = {
    ...enemyTypes[type], type, hp, maxHp: hp,
    damage: (storm ? 125 : space ? 105 : sewer ? 90 : hell ? 78 : frozen ? 60 : 38) + p.level * (storm ? 7 : space ? 6 : sewer ? 5 : hell ? 5 : frozen ? 4 : 2.5),
    x, y,
    attackCooldown: 0, wobble: 0, slow: 0,
    spawnT: 0, spawnMax: 0,
    graceT: 2.4, // invulnérable pendant la sortie de terre
    specialCd: 1.5 + Math.random(),
    lunging: 0, lungeCd: 9, lvx: 0, lvy: 0
  };
  resolveObstacles(e);
  G.enemies.push(e);
  // énorme explosion d'émergence
  spawnParticles(x, y, '#b388ff', 55, 11);
  spawnParticles(x, y, '#ff7043', 35, 9);
  spawnParticles(x, y, '#5d4037', 30, 7);
  spawnParticles(x, y, hell ? '#ffab00' : space ? '#b388ff' : sewer ? '#aeea00' : storm ? '#4fc3f7' : '#e040fb', 20, 13);
  G.rings.push({ x, y, r: 10, maxR: 300, life: 45, maxLife: 45, color: storm ? '#4fc3f7' : space ? '#b388ff' : sewer ? '#aeea00' : '#e040fb' });
  G.rings.push({ x, y, r: 5, maxR: 170, life: 30, maxLife: 30, color: '#ff7043' });
  G.screenShake = 20; G.screenFlash = 0.7;
  // l'explosion blesse le joueur s'il est trop proche
  if (Math.hypot(p.x - x, p.y - y) < 250) {
    const dmg = 35 * (1 - (G.equip ? G.equip.armorReduce : 0));
    p.hp = Math.max(1, p.hp - dmg);
    p.lastHurt = G.time; p.slowT = Math.max(p.slowT, 0.9);
    addDamageText(p.x, p.y - 24, `-${Math.round(dmg)}`, '#ff1744');
    spawnParticles(p.x, p.y, '#ff1744', 12, 6);
  }
  addDamageText(p.x, p.y - 90, hell ? 'LE BARON DE L\'ENFER ÉMERGE !' : space ? 'L\'ABOMINATION COSMIQUE ÉMERGE !' : sewer ? 'LE TYRAN DES PROFONDEURS ÉMERGE !' : storm ? 'LE SOUVERAIN DES OURAGANS ÉMERGE !' : frozen ? 'LE SOUVERAIN DE GLACE ÉMERGE !' : 'LE SEIGNEUR OUBLIÉ ÉMERGE !',
    hell ? '#ffab00' : space ? '#b388ff' : sewer ? '#aeea00' : storm ? '#4fc3f7' : frozen ? '#80d8ff' : '#e040fb');
}

// Fait apparaître 1 à 3 mini-boss d'un coup (début des vagues ×3)
export function spawnMinibossWave() {
  const n = 1 + Math.floor(Math.random() * 3);
  const type = G.campaign === 5 ? 'colosse' : G.campaign === 4 ? 'overlord' : G.campaign === 3 ? 'matriarche' : G.campaign === 2 ? 'priest' : G.campaign === 1 ? 'alpha' : 'miniboss'; // mini-boss propre à chaque campagne
  for (let i = 0; i < n; i++) spawnEnemy(type);
}

// Fait apparaître des boss (début des vagues ×5), type choisi par rotation
export function spawnBossWave(count = 1, type = 'boss') {
  sfxBoss();
  for (let i = 0; i < count; i++) spawnEnemy(type);
}
