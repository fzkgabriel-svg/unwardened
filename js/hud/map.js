// js/hud/map.js — mini-carte CARRÉE : mêmes proportions que le monde
// (échelle uniforme, aucun écrasement), cadre métallique, panneau
// « objectif » sur parchemin (vraies données : vague, boss, portails).
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect } from '../utils.js';
import { curWorld, RARITY_COLOR } from '../world.js';
import { playerAngle } from '../attacks.js';
import { HPAL, metalFrame, parchment, engraved, gem } from './frame.js';

const MS = 148; // côté de la carte carrée

export function drawMinimap() {
  const w = curWorld();
  if (!w) return;
  const mx = W - MS - 18, my = H - MS - 34; // cadre
  const t = G.time || 0;

  // ---- panneau objectif (parchemin, AU-DESSUS de la carte) ----
  const ow = 210, oh = 54;
  // centré sur la carte mais jamais coupé par le bord droit de l'écran
  const ox = Math.min(mx + MS / 2 - ow / 2, W - ow - 10), oy = my - 6 - oh - 8;
  parchment(ox, oy, ow, oh, 0.9);
  ctx.strokeStyle = HPAL.goldLo; ctx.lineWidth = 1;
  roundRect(ox + 2.5, oy + 2.5, ow - 5, oh - 5, 5); ctx.stroke();
  const bossAlive = G.enemies.some(en => en.type && en.type.startsWith('finalBoss'));
  // ligne 1 : vague à gauche, kills totaux à droite
  engraved(bossAlive ? 'BOSS' : `VAGUE ${G.wave}`, ox + 12, oy + 20, 13, bossAlive ? '#8e2424' : '#3a2a14', 'left', 'Georgia, serif');
  engraved(`${G.kills} kills`, ox + ow - 12, oy + 20, 10, '#6d5a3a', 'right', 'Consolas, monospace');
  // ligne 2 : progression des monstres de la vague + mini-jauge
  if (!bossAlive) {
    engraved(`${G.waveKills}/${G.waveTarget} monstres`, ox + 12, oy + 37, 10.5, '#5a4526', 'left', 'Consolas, monospace');
    const f = G.waveTarget > 0 ? Math.min(1, G.waveKills / G.waveTarget) : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ox + 12, oy + oh - 10, ow - 24, 4, 2); ctx.fill();
    ctx.fillStyle = HPAL.green;
    if (f > 0.01) { roundRect(ox + 12, oy + oh - 10, (ow - 24) * f, 4, 2); ctx.fill(); }
  } else {
    engraved('DÉTRUIRE LE BOSS', ox + 12, oy + 37, 10.5, '#8e2424', 'left', 'Georgia, serif');
  }

  // ---- cadre métallique carré ----
  metalFrame(mx - 6, my - 6, MS + 12, MS + 12, 9, {});
  // contenu : zone clipée
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, MS, MS); ctx.clip();
  // fond du monde
  const hellMap = (w.def && w.def.biome === 'hell') || G.campaign === 2;
  const frozenMap = (w.def && w.def.biome === 'ice') || G.campaign === 1;
  const sewerMap = (w.def && w.def.biome === 'sewer') || G.campaign === 3;
  const spaceMap = (w.def && w.def.biome === 'space') || G.campaign === 4;
  ctx.fillStyle = hellMap ? '#34100a' : frozenMap ? '#d6e8f4'
    : sewerMap ? '#262a1a' : spaceMap ? '#0a081e'
    : '#3c542e';
  ctx.fillRect(mx, my, MS, MS);
  // vignette intérieure (profondeur)
  const vg = ctx.createRadialGradient(mx + MS / 2, my + MS / 2, MS * 0.35, mx + MS / 2, my + MS / 2, MS * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg;
  ctx.fillRect(mx, my, MS, MS);

  // échelle UNIFORME : le monde entier tient dans le carré, proportions réelles
  const k = MS / Math.max(w.w, w.h);
  const ox2 = mx + (MS - w.w * k) / 2, oy2 = my + (MS - w.h * k) / 2;
  const sx = wx => ox2 + wx * k;
  const sy = wy => oy2 + wy * k;
  const inMap = (x, y) => x > mx && x < mx + MS && y > my && y < my + MS;

  // lacs
  for (const l of w.lakes || []) {
    ctx.fillStyle = hellMap ? 'rgba(120,60,140,0.7)' : 'rgba(50,120,190,0.75)';
    ctx.beginPath();
    ctx.ellipse(sx(l.x), sy(l.y), Math.max(2, l.rx * k), Math.max(1.5, l.ry * k), 0, 0, TAU);
    ctx.fill();
  }
  // bâtiments découverts
  for (const b of w.buildings) {
    if (!b.seen) continue;
    const bx = sx(b.x), by = sy(b.y);
    if (!inMap(bx, by)) continue;
    ctx.fillStyle = b.looted ? 'rgba(105,240,174,0.8)' : RARITY_COLOR[b.def.rarity];
    ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
  }
  // obstacles
  for (const o of w.obstacles || []) {
    const bx = sx(o.x), by = sy(o.y);
    if (!inMap(bx, by)) continue;
    ctx.fillStyle = 'rgba(130,125,115,0.8)';
    ctx.beginPath(); ctx.arc(bx, by, Math.max(1.2, o.r * k * 0.4), 0, TAU); ctx.fill();
  }
  // portails : violet = sortie, bleu = retour
  for (const [po, c] of [[w.portal, '#e040fb'], [w.returnPortal, '#4fc3f7']]) {
    if (!po) continue;
    const bx = sx(po.x), by = sy(po.y);
    if (!inMap(bx, by)) continue;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(bx, by, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, TAU); ctx.stroke();
  }
  // boss final : point pulsant
  for (const en of G.enemies) {
    if (!en.type || !en.type.startsWith('finalBoss')) continue;
    const bx = sx(en.x), by = sy(en.y);
    if (!inMap(bx, by)) continue;
    const pulse = 4 + Math.sin(t * 6) * 1.6;
    const hellBoss = en.type === 'finalBossEnfer', sewerBoss = en.type === 'finalBossEgout', spaceBoss = en.type === 'finalBossSpace';
    const c0 = hellBoss ? '255,112,67' : sewerBoss ? '174,234,0' : spaceBoss ? '179,157,219' : '224,64,251';
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, pulse * 3);
    g.addColorStop(0, `rgba(${c0},0.95)`); g.addColorStop(0.5, `rgba(${c0},0.55)`); g.addColorStop(1, `rgba(${c0},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, pulse * 3, 0, TAU); ctx.fill();
    ctx.fillStyle = hellBoss ? '#fff3e0' : sewerBoss ? '#f9fbe7' : spaceBoss ? '#ede7f6' : '#f3e5f5';
    ctx.beginPath(); ctx.arc(bx, by, pulse * 0.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = hellBoss ? '#ff7043' : sewerBoss ? '#aeea00' : spaceBoss ? '#b388ff' : '#e040fb';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bx, by, pulse + 2.5, 0, TAU); ctx.stroke();
  }
  // rectangle de la zone visible (caméra) — écran W×H sans zoom
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  ctx.strokeRect(sx(G.camX || 0), sy(G.camY || 0), W * k, H * k);
  // joueur : flèche dorée orientée vers la visée
  const p = G.player;
  const px = sx(p.x), py = sy(p.y);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(playerAngle());
  // halo du joueur
  ctx.fillStyle = 'rgba(255,215,64,0.3)';
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd740';
  ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(5, 0); ctx.lineTo(-3.5, -3); ctx.lineTo(-1.5, 0); ctx.lineTo(-3.5, 3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore(); // fin clip

  // nom du monde gravé sous la carte
  engraved((w.def && w.def.name || 'MONDE').toUpperCase(), mx + MS / 2, my + MS + 16, 10.5, HPAL.parch, 'center', 'Georgia, serif');
  // gemme du cadre
  gem(mx + MS / 2, my - 1, 4.5, HPAL.goldHi, t);
}
