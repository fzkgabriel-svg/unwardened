import { G, TAU } from './state.js';

// plafonds : au-delà, les effets les plus anciens sont purgés.
// Évite les frames à 100+ ms lors des combats chargés (boss + ultimes + mêlée).
const MAX_PARTICLES = 1400;
const MAX_TEXTS = 260;
const MAX_RINGS = 140;
const MAX_PORTALS = 60;

function capOldest(arr, max) {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export function spawnParticles(x, y, color, n = 8, speed = 4) {
  if (G.particles.length >= MAX_PARTICLES) return; // saturation : on saute ce jet
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = (0.3 + Math.random() * 0.7) * speed;
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 30 + Math.random() * 20, maxLife: 50,
      color, r: 2 + Math.random() * 3
    });
  }
}

export function addDamageText(x, y, text, color = '#ff5252') {
  // pas de purge ici : updateEffects() borne le tableau une fois par frame
  // (shift() à chaque appel était O(n) -> pics lors des salves de textes)
  G.damageTexts.push({ x, y, text, color, life: 55, maxLife: 55 });
}

// compaction en place : O(n) sans splice par élément (les splice répétés
// sur des milliers d'effets étaient une source de micro-freezes)
export function updateEffects(dt) {
  const d60 = dt * 60;
  let a = G.particles, w = 0;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life -= d60;
    if (p.life > 0) a[w++] = p;
  }
  a.length = w;

  a = G.damageTexts; w = 0;
  for (let i = 0; i < a.length; i++) {
    const t = a[i]; t.y -= 0.7; t.life -= d60;
    if (t.life > 0) a[w++] = t;
  }
  a.length = w;

  a = G.rings; w = 0;
  for (let i = 0; i < a.length; i++) {
    const r = a[i]; r.r += (r.maxR - r.r) * 0.35; r.life -= d60;
    if (r.life > 0) a[w++] = r;
  }
  a.length = w;

  a = G.portals; w = 0;
  for (let i = 0; i < a.length; i++) {
    const po = a[i]; po.life -= dt;
    if (po.life > 0) a[w++] = po;
  }
  a.length = w;

  capOldest(G.particles, MAX_PARTICLES);
  capOldest(G.damageTexts, MAX_TEXTS);
  capOldest(G.rings, MAX_RINGS);
  capOldest(G.portals, MAX_PORTALS);
}
