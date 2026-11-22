// js/attacks_util.js — helpers partagés des attaques (extraits de attacks.js)
import { G, TAU } from './state.js';
import { worldW, worldH } from './world.js';

export function waveBonus() { return 1 + (G.wave - 1) * 0.06; }
export const clampW = (v) => Math.max(40, Math.min(worldW() - 40, v));
export const clampH = (v) => Math.max(40, Math.min(worldH() - 40, v));

export function playerAngle() {
  // la souris est en coords écran : on la repasse en coords monde via la caméra
  return Math.atan2(G.mouse.y + (G.camY || 0) - G.player.y, G.mouse.x + (G.camX || 0) - G.player.x);
}

// hitbox de mêlée : l'ennemi est touché dès qu'une partie de son corps
// (pas seulement son centre) entre dans le secteur d'attaque
export function inMeleeArc(p, e, angle, halfArc, range) {
  const dist = Math.hypot(e.x - p.x, e.y - p.y);
  if (dist >= range + e.r) return false;
  if (dist < p.r + e.r + 8) return true; // corps à corps : touché peu importe l'angle
  const ea = Math.atan2(e.y - p.y, e.x - p.x);
  let diff = Math.abs(ea - angle);
  if (diff > Math.PI) diff = TAU - diff;
  // tolérance angulaire = demi-angle sous lequel l'ennemi est vu :
  // son bord compte autant que son centre
  const tol = Math.asin(Math.min(1, e.r / dist));
  return diff < halfArc + tol;
}

