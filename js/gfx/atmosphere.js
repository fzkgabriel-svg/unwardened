import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';

// grain photographique : texture de bruit pour un rendu moins "vectoriel/IA"
const noiseTile = document.createElement('canvas');
noiseTile.width = 160; noiseTile.height = 160;
const noiseCtx = noiseTile.getContext('2d');
const noiseImg = noiseCtx.createImageData(160, 160);
for (let i = 0; i < noiseImg.data.length; i += 4) {
  const v = 110 + (Math.random() * 50 | 0);
  noiseImg.data[i] = v; noiseImg.data[i + 1] = v; noiseImg.data[i + 2] = v;
  noiseImg.data[i + 3] = 22 + (Math.random() * 20 | 0);
}
noiseCtx.putImageData(noiseImg, 0, 0);
const noisePattern = ctx.createPattern(noiseTile, 'repeat');

export function drawGrain() {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = noisePattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

//Cycle jour/nuit : désactivé — toujours plein jour (retourne 1)
export function dayNight() {
  return 1;
}
const lerpC = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

// atmosphère écran (teinte nocturne, lucioles, vignette, lanterne) —
// le sol et le décor sont désormais rendus en coordonnées monde par drawTerrain()
export function drawBackground() {
  const dayF = dayNight(), nF = 1 - dayF;
  const w = curWorld();
  // teinte nocturne globale — colorée par biome (identité de chaque monde)
  if (nF > 0.02) {
    const sky = w ? w.def.biome : 'plain';
    const NIGHT = {
      plain:  'rgba(10,16,50,',  ice:    'rgba(14,26,58,',
      hell:   'rgba(48,8,6,',    sewer:  'rgba(8,26,14,',
      space:  'rgba(24,10,60,',
    };
    ctx.fillStyle = (NIGHT[sky] || NIGHT.plain) + `${nF * 0.34})`;
    ctx.fillRect(0, 0, W, H);
  }
  // lucioles la nuit
  if (nF > 0.05) {
    for (let i = 0; i < 26; i++) {
      const fx = (i * 173 + Math.sin(G.time * 0.6 + i * 2.1) * 45 + W) % W;
      const fy = (i * 131 + Math.cos(G.time * 0.5 + i * 1.7) * 40 + H) % H;
      const tw = 0.5 + 0.5 * Math.sin(G.time * 2.5 + i * 1.3);
      ctx.globalAlpha = nF * tw * 0.9;
      ctx.fillStyle = i % 2 ? '#d4ff4f' : '#fff176';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(fx, fy, 1.6 + (i % 3) * 0.5, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // lueur chaude autour du joueur la nuit (lanterne) — coords écran = monde - caméra
  if (nF > 0.05) {
    const p = G.player;
    const sx = p.x - (G.camX || 0), sy = p.y - (G.camY || 0);
    const lg = ctx.createRadialGradient(sx, sy, 15, sx, sy, 210);
    lg.addColorStop(0, `rgba(255,214,130,${0.3 * nF})`);
    lg.addColorStop(0.6, `rgba(255,180,80,${0.12 * nF})`);
    lg.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(sx, sy, 210, 0, TAU); ctx.fill();
  }
}
