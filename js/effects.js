import { G, TAU } from './state.js';

export function spawnParticles(x, y, color, n = 8, speed = 4) {
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
  G.damageTexts.push({ x, y, text, color, life: 55, maxLife: 55 });
}

export function updateEffects(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt * 60;
    if (p.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.damageTexts.length - 1; i >= 0; i--) {
    const t = G.damageTexts[i]; t.y -= 0.7; t.life -= dt * 60;
    if (t.life <= 0) G.damageTexts.splice(i, 1);
  }
  for (let i = G.rings.length - 1; i >= 0; i--) {
    const r = G.rings[i]; r.r += (r.maxR - r.r) * 0.35; r.life -= dt * 60;
    if (r.life <= 0) G.rings.splice(i, 1);
  }
  for (let i = G.portals.length - 1; i >= 0; i--) {
    const po = G.portals[i]; po.life -= dt;
    if (po.life <= 0) G.portals.splice(i, 1);
  }
}
