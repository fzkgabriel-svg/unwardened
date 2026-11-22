// TUTORIEL : mode d'apprentissage lancé depuis le menu principal.
// Séquence guidée qui débloque progressivement les mécaniques :
// déplacement → attaque → rotation → lance/bouclier → fiole → loot → boss → bombe.
// Le texte se tape lettre par lettre, chaque étape laisse un temps de lecture,
// et à la fin on retourne au menu principal.
import { G, ctx, W, H, TAU, canvas } from './state.js';
import { startGame, resetToMenu } from './menu.js';
import { spawnEnemy } from './enemies.js';
import { addDamageText, spawnParticles } from './effects.js';
import { curWorld, worldW, worldH, resolveObstacles } from './world.js';
import { setInvNoSave } from './inventory.js';
import { activeSlot } from './chars.js';

// ---------- utilitaires ----------
function clearAdds() { G.enemies.length = 0; G.drops.length = 0; }

function spawnAround(type, n, d) {
  const p = G.player;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, dd = d * (0.7 + Math.random() * 0.6);
    const x = Math.max(40, Math.min(worldW() - 40, p.x + Math.cos(a) * dd));
    const y = Math.max(40, Math.min(worldH() - 40, p.y + Math.sin(a) * dd));
    spawnEnemy(type, false, x, y, 0);
  }
}

function nearestEnemy() {
  const p = G.player;
  let best = null, bd = 1e9;
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best ? { x: best.x, y: best.y } : null;
}

function nearestBuilding() {
  const p = G.player, w = curWorld();
  let best = null, bd = 1e9;
  for (const b of w.buildings) {
    if (b.looted) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function tpNear(b) {
  const p = G.player;
  p.x = Math.max(p.r, Math.min(worldW() - p.r, b.x + 70));
  p.y = Math.max(p.r, Math.min(worldH() - p.r, b.y + 50));
  resolveObstacles(p);
}

// programme une action pour dans `at` secondes de l'étape
// (les monstres/boss apparaissent APRÈS le début de la lecture, plus loin)
function later(at, fn) {
  const t = G.tutorial;
  if (t) (t.timers = t.timers || []).push({ at, fn });
}

// timing d'une étape : le texte se tape (~36 car/s, max 3s) puis `hold`
// secondes de lecture avant que l'exercice ne devienne actif
function stepTiming(s) {
  const typeDur = Math.min(3, s.text.length / 36);
  const hold = s.hold ?? 2.4;
  return { typeDur, activeAt: typeDur + hold };
}

// ---------- les étapes ----------
// check(s) : true quand le joueur a réussi l'exercice (actif après la lecture)
// onStart(s) : prépare la scène ; s.base mémorise les compteurs
const STEPS = [
  {
    text: 'Bienvenue ! Déplace-toi avec ZQSD ou les flèches pour explorer les Terres Oubliées.', max: 15, hold: 2.6,
    onStart(s) { s.sx = G.player.x; s.sy = G.player.y; },
    check(s) { return Math.hypot(G.player.x - s.sx, G.player.y - s.sy) > 60; }
  },
  {
    text: 'Vise un monstre et CLIQUE GAUCHE pour attaquer ! Tue TOUS les slimes pour passer à la suite.', max: 45, hold: 2.8,
    onStart(s) { s.base = G.kills; later(3.2, () => spawnAround('slime', 2, 230)); },
    check(s) { return G.kills > s.base && G.enemies.length === 0; }
  },
  {
    text: 'CLIQUER DROIT : attaque rotative à 360° ! Utilise-la PUIS tue tous les monstres pour continuer.', max: 35, hold: 2.8,
    onStart(s) { s.base = G.spinUsed || 0; clearAdds(); later(3.2, () => spawnAround('slime', 3, 250)); },
    check(s) { return (G.spinUsed || 0) > s.base && G.enemies.length === 0; }
  },
  {
    text: 'Appuie sur É : passe en mode LANCE. Tu gagnes un bouclier et une arme d\'estoc.', max: 22, hold: 2.8,
    onStart() { clearAdds(); },
    check() { return G.player.attackMode === 3; }
  },
  {
    text: 'Mode lance : CLIC GAUCHE = estoc rapide, CLIC DROIT = dôme de bouclier (-85% dégâts pendant 3s) ! Tue la brute ensuite.', max: 40, hold: 3,
    onStart(s) { s.base = G.shieldUsed || 0; clearAdds(); later(3.4, () => spawnAround('brute', 1, 290)); },
    check(s) { return (G.shieldUsed || 0) > s.base && G.enemies.length === 0; }
  },
  {
    text: 'Reviens à l\'épée (&) puis bois une fiole avec W pour te soigner (+50 PV).', max: 28, hold: 2.6,
    onStart(s) {
      s.base = G.potionsUsed; clearAdds();
      G.player.attackMode = 1;
      G.player.potions = Math.max(G.player.potions, 1);
      G.player.hp = Math.floor(G.player.maxHp * 0.45); // force le soin
    },
    check(s) { return G.potionsUsed > s.base; }
  },
  {
    text: 'SYSTÈME DE VAGUES : tuer tous les monstres d\'une vague en appelle une nouvelle, toujours plus nombreuse et plus forte. Mini-boss toutes les 3 vagues, boss toutes les 5 — et la vague 20 révèle le Seigneur Oublié !', max: 5, hold: 3, highlight: 'wave',
    onStart() { clearAdds(); },
    check() { return false; } // étape lecture : avance par timeout
  },
  {
    text: 'NIVEAU & XP : chaque ennemi tué et chaque bâtiment fouillé donne de l\'XP (barre en haut à gauche). Monter de niveau augmente tes PV, tes dégâts et la recharge de ta bombe !', max: 5, hold: 3, highlight: 'xp',
    onStart() { clearAdds(); },
    check() { return false; } // étape lecture : avance par timeout
  },
  {
    text: 'Les bâtiments contiennent des secrets : approche-en un et appuie sur E pour le fouiller (XP garanti + fiole possible).', max: 45, hold: 3.2,
    onStart(s) {
      G.lastInteract = null; clearAdds();
      const b = nearestBuilding();
      if (!b) { nextStep(); return; } // pas de bâtiment : on saute l'étape
      s.target = { x: b.x, y: b.y };
      later(1.8, () => tpNear(b)); // téléportation différée : le joueur finit de lire d'abord
    },
    check() { return G.lastInteract === 'building'; }
  },
  {
    text: 'BOSS : toutes les 5 vagues, un géant apparaît. Il frappe très fort — utilise le bouclier, l\'estoc et la rotation, et VAINCS-LE pour passer à la suite !', max: 50, hold: 3.4,
    onStart(s) {
      clearAdds(); G.lastInteract = null;
      const p = G.player;
      p.hp = p.maxHp; // on répare avant le boss
      // le boss surgit APRÈS la lecture, à bonne distance
      later(3.4, () => {
        const bx = Math.max(90, Math.min(worldW() - 90, p.x + 400));
        const by = Math.max(90, Math.min(worldH() - 90, p.y));
        spawnEnemy('boss', false, bx, by, 0);
        s.boss = G.enemies[G.enemies.length - 1];
      });
    },
    check(s) { return s.boss && !G.enemies.includes(s.boss) && G.enemies.length === 0; }
  },
  {
    text: 'Ultime : quand la jauge est pleine, appuie sur F — un bombardier B-2 largue une BOMBE ATOMIQUE sur ta position ! Tue tout ce qui reste.', max: 50, hold: 3.2,
    onStart(s) {
      s.base = G.ultsUsed; clearAdds();
      G.player.ultCharge = 100;
      later(3.4, () => { spawnAround('slime', 4, 200); spawnAround('brute', 1, 290); });
    },
    check(s) { return G.ultsUsed > s.base && G.enemies.length === 0; }
  },
  {
    text: 'TUTORIEL TERMINÉ ! Tu connais maintenant toutes les bases. Bonne survie dans les Terres Oubliées !', max: 8, hold: 3,
    onStart() { clearAdds(); G.player.hp = G.player.maxHp; },
    check() { return false; } // se termine par timeout
  }
];

// ---------- cycle de vie ----------
export function startTutorial() {
  if (G.state !== 'menu') return;
  if (activeSlot() < 0) { startGame(); return; } // pas de héros : retour à la sélection
  // le tutoriel se déroule comme un TOUT NOUVEAU personnage :
  // toujours le monde 1, sans équipement, sans niveaux d'armes,
  // et rien de tout ça n'est persisté (inventaire/stats jetables)
  G._tutBackup = { campaign: G.campaign };
  G.campaign = 0;
  G.inv = { mats: {}, items: {}, equip: {}, dur: {}, wmode: {} };
  G.stats = {};
  setInvNoSave(true);
  startGame(); // reset complet + intro nuages (le héros tombe du ciel)
  // startGame a tout appliqué sur les copies : 100 PV, aucun bonus, monde 1
  G.tutorial = { i: -1, t: 0, endT: 0, target: null, timers: [], skipCd: 0 }; // i=-1 : attend la fin de l'intro
}

function nextStep() {
  const t = G.tutorial;
  if (!t) return;
  t.i++; t.t = 0; t.target = null; t.timers = [];
  if (t.i >= STEPS.length) { endTutorial(); return; }
  const s = STEPS[t.i];
  s.base = {};
  if (s.onStart) s.onStart(s);
  addDamageText(G.player.x, G.player.y - 60, `ÉTAPE ${t.i + 1}/${STEPS.length}`, '#ffd740');
}

function endTutorial() {
  const t = G.tutorial;
  if (!t) return;
  t.endT = 4.5; // bannière de fin puis retour au menu principal
  clearAdds();
  G.player.hp = G.player.maxHp;
  addDamageText(G.player.x, G.player.y - 60, 'TU ES PRÊT !', '#69f0ae');
}

// ENTRÉE : passer à l'étape SUIVANTE (skip de l'exercice),
// délai de 2,5 s entre deux appuis pour éviter le spam
export function tutorialEnter() {
  const t = G.tutorial;
  if (!t || G.state !== 'playing') return false;
  if ((t.skipCd || 0) > 0) return false;
  t.skipCd = 2.5;
  if (t.endT > 0) { t.endT = 0.7; return true; } // accélère la fin
  nextStep();
  return true;
}

export function updateTutorial(dt) {
  const t = G.tutorial;
  if (!t) return;
  t.skipCd = Math.max(0, (t.skipCd || 0) - dt);
  if (t.endT > 0) { // compte à rebours de la bannière de fin -> menu
    t.endT -= dt;
    if (t.endT <= 0) { G.tutorial = null; resetToMenu(); }
    return;
  }
  if (t.i < 0) { nextStep(); return; } // le jeu vient de démarrer (post-intro)
  const s = STEPS[t.i];
  if (!s) return;
  t.t += dt;
  // déclenche les actions programmées (apparitions différées, téléportation…)
  if (t.timers && t.timers.length) {
    for (let i = t.timers.length - 1; i >= 0; i--) {
      if (t.t >= t.timers[i].at) { const j = t.timers.splice(i, 1)[0]; j.fn(); }
    }
  }
  const { activeAt } = stepTiming(s);
  // l'exercice ne devient actif qu'après la lecture ; timeout = budget actif
  if (t.t > activeAt && (s.check(s) || t.t > activeAt + s.max)) {
    clearAdds();
    nextStep();
  }
}

// ---------- rendu ----------
// Zones du HUD mises en évidence (zoom + contour) pendant les étapes
const HUD_SPOT = {
  wave: { x: 12, y: 5, w: 430, h: 38 },
  xp:   { x: 40, y: 64, w: 310, h: 30 },
};

// contour pointillé pulsé autour de l'élément HUD + bulle zoom en bas d'écran
function drawHudSpotlight(key) {
  const r = HUD_SPOT[key];
  if (!r) return;
  const SS = canvas.width / W;
  ctx.save();
  const pulse = 0.65 + Math.sin(G.time * 5) * 0.3;
  ctx.strokeStyle = `rgba(255,215,64,${pulse})`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([9, 6]);
  ctx.lineDashOffset = -G.time * 30;
  ctx.beginPath();
  ctx.roundRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px Segoe UI';
  ctx.fillStyle = '#ffd740';
  ctx.fillText('▼ REGARDE ICI', r.x + r.w / 2, r.y + r.h + 18);
  // bulle zoom en bas d'écran
  const zoom = Math.min(2.0, (W - 160) / r.w);
  const bw = r.w * zoom, bh = r.h * zoom;
  const bx = W / 2 - bw / 2, by = H - bh - 52;
  ctx.strokeStyle = 'rgba(255,215,64,0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(r.x + r.w / 2, r.y + r.h + 4);
  ctx.lineTo(bx + bw / 2, by);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(5,4,2,0.88)';
  ctx.beginPath(); ctx.roundRect(bx - 7, by - 7, bw + 14, bh + 14, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx - 7, by - 7, bw + 14, bh + 14, 10); ctx.stroke();
  ctx.drawImage(canvas, r.x * SS, r.y * SS, r.w * SS, r.h * SS, bx, by, bw, bh);
  ctx.font = 'bold 11px Segoe UI';
  ctx.fillStyle = '#ffe9a3';
  ctx.fillText('◉ ZOOM', bx + bw / 2, by - 13);
  ctx.restore();
}

// découpe le texte en lignes tenant dans maxW
function wrapLines(text, maxW) {
  const lines = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const test = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawTutorial() {
  const t = G.tutorial;
  if (!t || G.state !== 'playing' || t.i < 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, (t.t || 0.01) * 4); // fondu d'entrée du panneau
  if (t.endT > 0) {
    // bannière de fin
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillStyle = '#ffd740';
    ctx.shadowColor = 'rgba(255,215,64,0.8)'; ctx.shadowBlur = 20;
    ctx.fillText('✦ TUTORIEL TERMINÉ ✦', W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.font = 'italic 16px Segoe UI'; ctx.fillStyle = '#e0e0e0';
    ctx.fillText('Retour au menu principal…', W / 2, H / 2 - 12);
    ctx.restore();
    return;
  }
  const s = STEPS[t.i];
  if (!s) { ctx.restore(); return; }
  const { typeDur, activeAt } = stepTiming(s);

  // ---- panneau d'objectif (haut-centre, SOUS le HUD pour ne rien masquer) ----
  const bw = Math.min(820, W - 80);
  const bx = W / 2 - bw / 2, by = 150;
  // texte tapé lettre par lettre puis enveloppé sur plusieurs lignes
  ctx.font = 'bold 16px Segoe UI';
  const typed = Math.min(s.text.length, Math.floor((t.t / typeDur) * s.text.length));
  const shown = s.text.slice(0, typed);
  const lines = wrapLines(shown, bw - 60);
  const bh = 24 + lines.length * 21 + 26; // marges + lignes + compteur
  ctx.fillStyle = 'rgba(8,6,2,0.82)';
  ctx.strokeStyle = 'rgba(255,215,64,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill(); ctx.stroke();
  // accent latéral + progression (temps restant total)
  ctx.fillStyle = 'rgba(255,215,64,0.9)';
  ctx.fillRect(bx + 6, by + 10, 4, bh - 34);
  const total = activeAt + s.max;
  const prog = Math.min(1, t.t / total);
  ctx.fillStyle = 'rgba(255,215,64,0.25)';
  ctx.fillRect(bx, by + bh - 6, bw, 6);
  ctx.fillStyle = '#ffd740';
  ctx.fillRect(bx, by + bh - 6, bw * (1 - prog), 6); // barre qui se vide = temps restant

  // ---- texte multi-lignes (machine à écrire) ----
  ctx.textAlign = 'left';
  const tx = bx + 26, ty = by + 30;
  ctx.fillStyle = '#ffe9a3';
  for (let li = 0; li < lines.length; li++) {
    ctx.fillText(lines[li], tx, ty + li * 21);
  }
  // curseur clignotant à la fin du texte tapé
  if (typed < s.text.length || t.t < activeAt) {
    const last = lines[lines.length - 1] || '';
    const cx = tx + ctx.measureText(last).width + 5;
    const cy = ty + (lines.length - 1) * 21 - 14;
    ctx.globalAlpha = Math.min(1, (t.t || 0.01) * 4) * (0.45 + Math.abs(Math.sin(G.time * 9)) * 0.5);
    ctx.fillStyle = '#ffd740';
    ctx.fillRect(cx, cy, 9, 19);
    ctx.globalAlpha = Math.min(1, (t.t || 0.01) * 4);
  }
  ctx.textAlign = 'right';
  ctx.font = '11px Segoe UI'; ctx.fillStyle = '#b0a488';
  ctx.fillText(`Étape ${t.i + 1}/${STEPS.length}`, bx + bw - 16, by + bh - 18);

  // ---- indication ENTRÉE : passer à l'étape suivante (cooldown 2,5 s) ----
  const cool = (t.skipCd || 0) > 0;
  ctx.globalAlpha = Math.min(1, (t.t || 0.01) * 4) * (cool ? 0.35 : 0.6);
  ctx.textAlign = 'center';
  ctx.font = 'italic 12px Segoe UI';
  ctx.fillStyle = cool ? '#8a7f5e' : '#d4af37';
  ctx.fillText(
    cool ? `ENTRÉE à nouveau dans ${t.skipCd.toFixed(1)}s` : 'Appuyez sur ENTRÉE pour passer à l\'étape suivante',
    W / 2, by + bh + 18
  );
  ctx.globalAlpha = Math.min(1, (t.t || 0.01) * 4);

  // ---- zoom + contour sur la zone HUD expliquée ----
  if (s.highlight) drawHudSpotlight(s.highlight);

  // ---- marqueur de cible (flèche dorée au-dessus de l'objectif) ----
  let target = s.target;
  if (!target && G.enemies.length) target = nearestEnemy();
  if (target) {
    const sx = target.x - (G.camX || 0), sy = target.y - (G.camY || 0);
    if (sx > -40 && sx < W + 40 && sy > -40 && sy < H + 40) {
      const bob = Math.sin(G.time * 6) * 6;
      ctx.fillStyle = '#ffd740';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 34 + bob);
      ctx.lineTo(sx - 10, sy - 52 + bob);
      ctx.lineTo(sx + 10, sy - 52 + bob);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // anneau pulsé
      const pr = 14 + Math.sin(G.time * 6) * 4;
      ctx.strokeStyle = 'rgba(255,215,64,0.8)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy - 20, pr, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
}
