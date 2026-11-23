// TUTORIEL : mode d'apprentissage lancé depuis le menu principal.
// Séquence guidée et interactive : chaque étape explique UNE mécanique,
// les étapes « action » exigent que le joueur la réussisse, les étapes
// « info » s'avancent avec le bouton Suivant. La progression est sauvegardée.
import { G, ctx, W, H, TAU, canvas } from './state.js';
import { startGame, resetToMenu } from './menu.js';
import { spawnEnemy } from './enemies.js';
import { addDamageText, spawnParticles } from './effects.js';
import { curWorld, worldW, worldH, resolveObstacles } from './world.js';
import { setInvNoSave } from './inventory.js';
import { activeSlot } from './chars.js';

const SERIF = 'Cinzel, Georgia, serif';
const SANS = 'Inter, sans-serif';
const TUT_KEY = 'rpg2d_tut';
const GOLD = '#d4af37', GOLD_HI = '#ffd740';

// ---------- persistance ----------
function tutSave(done) {
  try {
    if (done) localStorage.setItem(TUT_KEY, JSON.stringify({ i: -1, done: true }));
    else if (G.tutorial) localStorage.setItem(TUT_KEY, JSON.stringify({ i: G.tutorial.i, done: false }));
  } catch (e) { /* stockage indisponible : on ignore */ }
}
function tutLoad() {
  try { return JSON.parse(localStorage.getItem(TUT_KEY) || 'null'); } catch (e) { return null; }
}

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

// timing : le texte se tape (~45 car/s, max 2,6 s), `hold` s de lecture,
// puis l'exercice devient actif (étapes action)
function stepTiming(s) {
  const typeDur = Math.min(2.6, s.text.length / 45);
  const hold = s.hold ?? 1.4;
  return { typeDur, readyAt: typeDur + 0.5, activeAt: typeDur + hold };
}

// ---------- les étapes ----------
// kind 'info'   : lecture seule, avance via « Suivant »
// kind 'action' : le joueur doit réussir check() (ou cliquer « Passer l'étape »)
// s.base mémorise les compteurs au démarrage de l'étape
const STEPS = [
  {
    icon: '✦', kind: 'info', title: 'Bienvenue, héros',
    text: 'Survis aux vagues, explore les Terres Oubliées et forge ta légende.\nJe vais te montrer chaque mécanique, une à une.',
    onStart() { clearAdds(); }
  },
  {
    icon: '✥', kind: 'action', title: 'Déplacement',
    text: 'Déplace-toi avec ZQSD ou les flèches du clavier.\nVa explorer les environs pour continuer.', max: 20,
    onStart(s) { s.sx = G.player.x; s.sy = G.player.y; clearAdds(); },
    check(s) { return Math.hypot(G.player.x - s.sx, G.player.y - s.sy) > 60; }
  },
  {
    icon: '♥', kind: 'info', title: 'Ton héros', highlight: 'xp',
    text: 'En haut à gauche : tes PV, ton niveau et ton XP.\nChaque ennemi tué et chaque bâtiment fouillé te fait monter de niveau — plus de dégâts et plus de PV.',
    onStart() { clearAdds(); }
  },
  {
    icon: '⚔', kind: 'action', title: 'Attaque',
    text: 'Vise un monstre et CLIQUE GAUCHE pour frapper.\nTue tous les slimes pour continuer.', max: 45,
    onStart(s) { s.base = G.kills; clearAdds(); later(3, () => spawnAround('slime', 2, 230)); },
    check(s) { return G.kills > s.base && G.enemies.length === 0; }
  },
  {
    icon: '🌀', kind: 'action', title: 'Attaque rotative',
    text: 'CLIQUER DROIT : ton arme tourne à 360° et frappe tout autour de toi.\nUtilise-la, puis finis les monstres.', max: 40,
    onStart(s) { s.base = G.spinUsed || 0; clearAdds(); later(3, () => spawnAround('slime', 3, 250)); },
    check(s) { return (G.spinUsed || 0) > s.base && G.enemies.length === 0; }
  },
  {
    icon: '🎯', kind: 'action', title: 'Changer d\'arme',
    text: 'Appuie sur É pour sortir ton arme secondaire (et & pour l\'arme principale).\nChaque arme a ses propres attaques — tu en essaieras d\'autres plus tard.', max: 20,
    onStart() { clearAdds(); },
    check() { return G.player.attackMode === 3; }
  },
  {
    icon: '🛡', kind: 'action', title: 'Lance & bouclier',
    text: 'En mode lance : CLIQUE GAUCHE = estoc rapide, CLIQUE DROIT = dôme de bouclier (-85 % de dégâts pendant 3 s).\nTue la brute pour continuer.', max: 45,
    onStart(s) { s.base = G.shieldUsed || 0; clearAdds(); later(3.2, () => spawnAround('brute', 1, 290)); },
    check(s) { return (G.shieldUsed || 0) > s.base && G.enemies.length === 0; }
  },
  {
    icon: '🧪', kind: 'action', title: 'Fiole de soin',
    text: 'Reviens à l\'épée avec & puis appuie sur W pour boire une fiole : +50 PV.', max: 25,
    onStart(s) {
      s.base = G.potionsUsed; clearAdds();
      G.player.attackMode = 1;
      G.player.potions = Math.max(G.player.potions, 1);
      G.player.hp = Math.floor(G.player.maxHp * 0.45); // force le soin
    },
    check(s) { return G.potionsUsed > s.base; }
  },
  {
    icon: '👾', kind: 'info', title: 'Vagues & boss', highlight: 'wave',
    text: 'Tuer tous les monstres d\'une vague en appelle une nouvelle, toujours plus nombreuse.\nUn mini-boss toutes les 3 vagues, un boss toutes les 5 — et le Seigneur Oublié à la vague 20.',
    onStart() { clearAdds(); }
  },
  {
    icon: '🏠', kind: 'action', title: 'Fouiller un bâtiment',
    text: 'Approche-toi d\'un bâtiment et appuie sur E pour le fouiller : XP garanti et parfois une fiole.', max: 40,
    onStart(s) {
      G.lastInteract = null; clearAdds();
      const b = nearestBuilding();
      if (!b) { nextStep(); return; } // pas de bâtiment : on saute l'étape
      s.target = { x: b.x, y: b.y };
      later(1.6, () => tpNear(b));
    },
    check() { return G.lastInteract === 'building'; }
  },
  {
    icon: '💀', kind: 'action', title: 'Affronter un boss',
    text: 'Un géant surgit : ses coups sont lourds.\nUtilise le bouclier, l\'estoc et la rotation — puis VAINCS-LE.', max: 60,
    onStart(s) {
      clearAdds(); G.lastInteract = null;
      const p = G.player;
      p.hp = p.maxHp; // on répare avant le boss
      later(3.2, () => {
        const bx = Math.max(90, Math.min(worldW() - 90, p.x + 400));
        const by = Math.max(90, Math.min(worldH() - 90, p.y));
        spawnEnemy('boss', false, bx, by, 0);
        s.boss = G.enemies[G.enemies.length - 1];
      });
    },
    check(s) { return s.boss && !G.enemies.includes(s.boss) && G.enemies.length === 0; }
  },
  {
    icon: '☢', kind: 'action', title: 'Ultime : la bombe',
    text: 'Quand la jauge est pleine, appuie sur F : un bombardier largue une BOMBE ATOMIQUE sur ta position !\nTue ce qui reste pour continuer.', max: 50,
    onStart(s) {
      s.base = G.ultsUsed; clearAdds();
      G.player.ultCharge = 100;
      later(3.2, () => { spawnAround('slime', 4, 200); spawnAround('brute', 1, 290); });
    },
    check(s) { return G.ultsUsed > s.base && G.enemies.length === 0; }
  },
  {
    icon: '⚒', kind: 'info', title: 'Forge, modules & boutique',
    text: 'Entre les parties, le menu donne accès à :\n• la FORGE : fabriquer et améliorer ton équipement\n• les MODULES : bonus de combat • la BOUTIQUE : matériaux\nLes butins gagnés en jeu servent à tout ça.',
    onStart() { clearAdds(); G.player.hp = G.player.maxHp; }
  },
  {
    icon: '🗺', kind: 'info', title: 'Les 6 mondes',
    text: 'Ce monde n\'est que le début. En progressant, tu débloqueras 5 autres royaumes :\nNeige, Feu, Égouts, Espace et Tempêtes — chacun avec ses monstres, ses boss et ses récompenses uniques.',
    onStart() { clearAdds(); }
  },
  {
    icon: '🏆', kind: 'info', title: 'Tu es prêt !',
    text: 'Tu connais maintenant toutes les bases.\nBonne survie dans les Terres Oubliées !',
    onStart() { clearAdds(); G.player.hp = G.player.maxHp; }
  }
];

// ---------- géométrie du panneau ----------
function panelRect() {
  const w = Math.min(740, W - 48);
  const hh = 178;
  return { x: W / 2 - w / 2, y: H - hh - 22, w, h: hh };
}
// zones de boutons (partagées dessin / hit-test)
function tutButtons() {
  const r = panelRect();
  const bh = 32, by = r.y + r.h - bh - 12;
  const bwNext = 132, bwPrev = 108;
  const nx = r.x + r.w - bwNext - 16;
  const px = nx - bwPrev - 10;
  const sx = r.x + r.w - 40, sy = r.y + 12, ss = 28; // ✕ passer
  return {
    rect: r,
    prev: { x: px, y: by, w: bwPrev, h: bh },
    next: { x: nx, y: by, w: bwNext, h: bh },
    skip: { x: sx, y: sy, w: ss, h: ss },
  };
}
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

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
  // reprise de la progression sauvegardée (sauf si terminée)
  const sv = tutLoad();
  const resume = sv && !sv.done && sv.i > 0 && sv.i < STEPS.length ? sv.i : 0;
  G.tutorial = { i: resume - 1, t: 0, endT: 0, target: null, timers: [], flash: 0, skipCd: 0 };
}

function enterStep() {
  const t = G.tutorial;
  if (!t) return;
  t.t = 0; t.target = null; t.timers = []; t.flash = 0;
  tutSave(false);
  const s = STEPS[t.i];
  s.base = {};
  if (s.onStart) s.onStart(s);
}

function nextStep() {
  const t = G.tutorial;
  if (!t) return;
  t.i++; t.endT = 0;
  if (t.i >= STEPS.length) { endTutorial(); return; }
  enterStep();
}

function prevStep() {
  const t = G.tutorial;
  if (!t || t.i <= 0 || t.endT > 0) return;
  t.i--;
  enterStep();
}

function endTutorial() {
  const t = G.tutorial;
  if (!t) return;
  tutSave(true); // terminé ou passé : on ne reprend pas au milieu
  t.endT = 4;
  clearAdds();
  G.player.hp = G.player.maxHp;
  addDamageText(G.player.x, G.player.y - 60, 'TU ES PRÊT !', '#69f0ae');
}

// ENTRÉE : passer à l'étape suivante (skip de l'exercice),
// délai de 1,2 s entre deux appuis pour éviter le spam
export function tutorialEnter() {
  const t = G.tutorial;
  if (!t || G.state !== 'playing' || t.endT > 0) return false;
  if ((t.skipCd || 0) > 0) return false;
  t.skipCd = 1.2;
  nextStep();
  return true;
}

// clic sur le panneau : 'next' | 'prev' | 'skip' | 'panel' (avalé) | null (hors panneau)
export function tutorialClickAt(x, y) {
  const t = G.tutorial;
  if (!t || G.state !== 'playing' || t.i < 0 || t.endT > 0) return null;
  const b = tutButtons();
  if (inRect(x, y, b.skip)) { endTutorial(); return 'skip'; }
  if (inRect(x, y, b.next)) {
    const s = STEPS[t.i];
    const { readyAt } = stepTiming(s);
    if (t.t < readyAt || (t.skipCd || 0) > 0) return 'panel';
    t.skipCd = 1.2;
    nextStep();
    return 'next';
  }
  if (inRect(x, y, b.prev)) {
    if ((t.skipCd || 0) <= 0) { t.skipCd = 1.2; prevStep(); return 'prev'; }
    return 'panel';
  }
  if (inRect(x, y, b.rect)) return 'panel'; // clic dans le panneau : ne pas attaquer
  return null;
}

export function updateTutorial(dt) {
  const t = G.tutorial;
  if (!t) return;
  t.skipCd = Math.max(0, (t.skipCd || 0) - dt);
  if (t.flash > 0) t.flash -= dt;
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
  if (s.kind === 'info') return; // les étapes info n'avancent que par action du joueur
  if (t._pendingNext) { // flash « objectif atteint » terminé -> étape suivante
    if (t.flash <= 0) { t._pendingNext = false; nextStep(); }
    return;
  }
  const { activeAt } = stepTiming(s);
  // l'exercice ne devient actif qu'après la lecture ; timeout = budget actif
  if (t.t > activeAt && (s.check(s) || t.t > activeAt + (s.max || 30))) {
    clearAdds();
    t.flash = 0.7;
    t._pendingNext = true;
  }
}

// ---------- rendu ----------
// Zones du HUD mises en évidence (contour lumineux + flèche)
const HUD_SPOT = {
  wave: { x: 976, y: 386, w: 216, h: 62 }, // parchemin vague/monstres au-dessus de la minimip
  xp:   { x: 14, y: 88, w: 330, h: 18 },    // barre XP
};

function drawHudSpotlight(key) {
  const r = HUD_SPOT[key];
  if (!r) return;
  ctx.save();
  const pulse = 0.55 + Math.sin(G.time * 4) * 0.3;
  // halo doux
  ctx.shadowColor = `rgba(255,215,64,${pulse})`;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = `rgba(255,215,64,${0.5 + pulse * 0.4})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 10);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // flèche discrète
  ctx.textAlign = 'center';
  ctx.font = `bold 13px ${SANS}`;
  ctx.fillStyle = `rgba(255,215,64,${0.75 + pulse * 0.25})`;
  ctx.fillText('▼', r.x + r.w / 2, r.y - 14);
  ctx.restore();
}

function wrapLines(text, maxW, font) {
  ctx.font = font;
  const lines = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const w of para.split(' ')) {
      const test = cur ? cur + ' ' + w : w;
      if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
      else cur = test;
    }
    lines.push(cur || ' ');
  }
  return lines;
}

// petit bouton pilule ; retourne true si la souris survole
function tutButton(b, label, primary, disabled, hoverX, hoverY) {
  const hov = !disabled && hoverX >= b.x && hoverX <= b.x + b.w && hoverY >= b.y && hoverY <= b.y + b.h;
  ctx.save();
  ctx.globalAlpha = disabled ? 0.4 : 1;
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  if (primary) { g.addColorStop(0, 'rgba(212,175,55,0.28)'); g.addColorStop(1, 'rgba(212,175,55,0.12)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(255,255,255,0.03)'); }
  ctx.fillStyle = g;
  ctx.strokeStyle = hov ? GOLD_HI : (primary ? 'rgba(212,175,55,0.8)' : 'rgba(212,175,55,0.35)');
  ctx.lineWidth = hov ? 2 : 1.2;
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2); ctx.fill(); ctx.stroke();
  if (hov) { ctx.shadowColor = 'rgba(255,215,64,0.6)'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 13px ${SANS}`;
  ctx.fillStyle = primary ? '#ffe9a3' : '#cfc4a4';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();
  return hov;
}

export function drawTutorial() {
  const t = G.tutorial;
  if (!t || G.state !== 'playing' || t.i < 0) return;
  const s = STEPS[t.i];
  if (!s) return;
  ctx.save();

  if (t.endT > 0) {
    // bannière de fin
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 36px ${SERIF}`;
    ctx.fillStyle = GOLD_HI;
    ctx.shadowColor = 'rgba(255,215,64,0.8)'; ctx.shadowBlur = 22;
    ctx.fillText('✦ TUTORIEL TERMINÉ ✦', W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.font = `italic 15px ${SANS}`; ctx.fillStyle = '#e0e0e0';
    ctx.fillText('Retour au menu principal…', W / 2, H / 2 - 10);
    ctx.restore();
    return;
  }

  const { typeDur, readyAt, activeAt } = stepTiming(s);
  const fade = Math.min(1, t.t * 4); // fondu d'entrée
  const slide = (1 - fade) * 18;     // léger glissement vers le haut

  // ---- panneau principal (bas-centre) ----
  const b = tutButtons(), r = b.rect;
  ctx.globalAlpha = fade;
  ctx.save();
  ctx.translate(0, slide);

  // carte raffinée
  ctx.fillStyle = 'rgba(9,8,14,0.9)';
  ctx.strokeStyle = 'rgba(212,175,55,0.45)'; ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  // filet doré supérieur
  ctx.strokeStyle = 'rgba(212,175,55,0.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(r.x + 18, r.y + 1); ctx.lineTo(r.x + r.w - 18, r.y + 1); ctx.stroke();

  // ---- barre de progression (en haut du panneau) ----
  const stepIdx = t.i + 1, total = STEPS.length;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `600 11px ${SANS}`; ctx.fillStyle = '#9a8f6e';
  ctx.fillText(`ÉTAPE ${stepIdx} / ${total}`, r.x + 18, r.y + 20);
  const barX = r.x + 92, barW = r.w - 92 - 120;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.roundRect(barX, r.y + 15, barW, 5, 2.5); ctx.fill();
  const frac = stepIdx / total;
  const pg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  pg.addColorStop(0, 'rgba(212,175,55,0.5)'); pg.addColorStop(1, GOLD_HI);
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.roundRect(barX, r.y + 15, Math.max(5, barW * frac), 5, 2.5); ctx.fill();
  // pastille d'étape courante
  ctx.fillStyle = GOLD_HI;
  ctx.beginPath(); ctx.arc(barX + barW * frac, r.y + 17.5, 3.5, 0, TAU); ctx.fill();

  // ---- bouton passer (✕ en haut à droite) ----
  tutButton(b.skip, '✕', false, false, G.mouse.x, G.mouse.y);

  // ---- icône + titre + texte ----
  const iconX = r.x + 30, iconY = r.y + r.h / 2 - 6;
  const ig = ctx.createRadialGradient(iconX, iconY, 2, iconX, iconY, 26);
  ig.addColorStop(0, 'rgba(212,175,55,0.35)'); ig.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = ig;
  ctx.beginPath(); ctx.arc(iconX, iconY, 26, 0, TAU); ctx.fill();
  ctx.font = `22px ${SANS}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(s.icon, iconX, iconY + 1);

  const tx = r.x + 62;
  ctx.textAlign = 'left';
  ctx.font = `bold 17px ${SERIF}`; ctx.fillStyle = '#f0e6c8';
  ctx.fillText(s.title, tx, r.y + 38);
  // sous-titre : nature de l'étape
  ctx.font = `600 10.5px ${SANS}`;
  ctx.fillStyle = s.kind === 'action' ? '#e8b04b' : '#8fd0a0';
  ctx.fillText(s.kind === 'action' ? '▸ ACTION REQUISE' : 'ℹ CONSEIL', tx, r.y + 56);

  // texte (machine à écrire)
  const typed = Math.min(s.text.length, Math.floor((t.t / typeDur) * s.text.length));
  const shown = s.text.slice(0, typed);
  const lines = wrapLines(shown, r.w - tx + r.x - 190, `500 13.5px ${SANS}`);
  const maxLines = Math.floor((r.h - 100) / 17);
  ctx.font = `500 13.5px ${SANS}`;
  ctx.fillStyle = '#d8d0bd';
  for (let li = 0; li < Math.min(lines.length, maxLines); li++) {
    ctx.fillText(lines[li], tx, r.y + 76 + li * 17);
  }
  // curseur de frappe
  if (typed < s.text.length) {
    const vis = lines.length <= maxLines ? lines[lines.length - 1] || '' : '';
    if (vis) {
      ctx.globalAlpha = fade * (0.4 + Math.abs(Math.sin(G.time * 9)) * 0.5);
      ctx.fillStyle = GOLD_HI;
      const cw = ctx.measureText(vis).width;
      ctx.fillRect(tx + cw + 3, r.y + 63 + (Math.min(lines.length, maxLines) - 1) * 17, 7, 13);
      ctx.globalAlpha = fade;
    }
  }

  // ---- boutons bas-droite ----
  const hov = { x: G.mouse.x, y: G.mouse.y };
  const canNext = t.t >= readyAt && (t.skipCd || 0) <= 0;
  const nextLabel = s.kind === 'info' ? 'Suivant ›' : 'Passer l\'étape ›';
  tutButton(b.prev, '‹ Précédent', false, t.i <= 0 || t.endT > 0, hov.x, hov.y);
  tutButton(b.next, nextLabel, true, !canNext, hov.x, hov.y);

  // ---- indice clavier ----
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `500 11px ${SANS}`; ctx.fillStyle = 'rgba(216,208,189,0.55)';
  ctx.fillText('ENTRÉE = étape suivante', W / 2, r.y - 14);

  ctx.restore(); // fin translate

  // ---- flash « objectif atteint » ----
  if (t.flash > 0) {
    ctx.globalAlpha = Math.min(1, t.flash * 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold 20px ${SERIF}`;
    ctx.fillStyle = '#69f0ae';
    ctx.shadowColor = 'rgba(105,240,174,0.7)'; ctx.shadowBlur = 16;
    ctx.fillText('✓ OBJECTIF ATTEINT', W / 2, r.y - 44);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = fade;
  }

  // ---- zoom + contour sur la zone HUD expliquée ----
  if (s.highlight) drawHudSpotlight(s.highlight);

  // ---- marqueur de cible (flèche dorée au-dessus de l'objectif) ----
  let target = s.target;
  if (!target && G.enemies.length && s.kind === 'action') target = nearestEnemy();
  if (target) {
    const sx = target.x - (G.camX || 0), sy = target.y - (G.camY || 0);
    if (sx > -40 && sx < W + 40 && sy > -40 && sy < H + 40) {
      const bob = Math.sin(G.time * 6) * 6;
      ctx.fillStyle = GOLD_HI;
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
