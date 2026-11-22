// js/hud.js — orchestrateur du HUD « médiéval fantastique » (HUD 3.3).
// Compose les modules js/hud/* : profil, compétences, boss, carte, équipement.
// Aucune mécanique n'est modifiée : seuls les valeurs affichées changent de style.
import { G, ctx, W, TAU } from './state.js';
import { roundRect } from './utils.js';
import { drawProfile } from './hud/profile.js';
import { drawSkillBar, drawWeaponPanel } from './hud/skills.js';
import { drawBossBar } from './hud/boss.js';
import { drawMinimap } from './hud/map.js';
import { drawEquipPanel } from './hud/equip.js';
import { drawAchToast as _ach, drawWarnToast as _warn } from './hud/toasts.js';

export const drawAchToast = _ach;
export const drawWarnToast = _warn;

export function drawHUD() {
  // halo supérieur : assombrit le haut de l'écran pour la lisibilité
  const band = ctx.createLinearGradient(0, 0, 0, 104);
  band.addColorStop(0, 'rgba(16,10,5,0.5)');
  band.addColorStop(0.8, 'rgba(16,10,5,0.24)');
  band.addColorStop(1, 'rgba(16,10,5,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 104);

  // Timer de partie (haut au centre) — médaillon métallique
  const t = Math.floor(G.runTime || 0);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  const timeLabel = `⏱ ${mm}:${ss}`;
  ctx.font = 'bold 12.5px Consolas, monospace';
  const tw = ctx.measureText(timeLabel).width + 26;
  const tx = W / 2 - tw / 2, ty = 7;
  const tg = ctx.createLinearGradient(tx, ty, tx, ty + 26);
  tg.addColorStop(0, '#3d2f1e'); tg.addColorStop(1, '#1e150c');
  ctx.fillStyle = tg;
  roundRect(tx, ty, tw, 26, 13); ctx.fill();
  ctx.strokeStyle = '#d4a84b'; ctx.lineWidth = 1.2;
  roundRect(tx + 1, ty + 1, tw - 2, 24, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(240,212,136,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(tx + 13, ty + 13, 2.6, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx + tw - 13, ty + 13, 2.6, 0, TAU); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#e8d9b0';
  ctx.fillText(timeLabel, W / 2, ty + 17.5);

  // panneaux
  drawProfile();
  drawSkillBar();
  drawWeaponPanel();
  drawBossBar();
  drawMinimap();
  drawEquipPanel();
}
