// js/hud/boss.js — barre de boss final : cadre métallique imposant,
// emblème du boss, nom, phases avec transition animée, bouclier de phase.
import { G, ctx, W, TAU } from '../state.js';
import { roundRect } from '../utils.js';
import { metalFrame, medBar, engraved, gem } from './frame.js';

const BOSSES = {
  finalBoss:      { name: 'SEIGNEUR OUBLIÉ',        short: 'Le Seigneur Oublié',       col: '#e040fb', hi: '#f3e5f5', c1: '#4a148c', c2: '#8e24aa', gemC: '#e040fb', phase: ['', 'COLÈRE ANCESTRALE', 'FUREUR DU ROI OUBLIÉ'] },
  finalBossGlace: { name: 'SOUVERAIN DE GLACE',     short: 'Le Souverain de Glace',    col: '#4fc3f7', hi: '#e1f5fe', c1: '#01579b', c2: '#0288d1', gemC: '#4fc3f7', phase: ['', 'GLACIATION', 'FUREUR GLACIALE'] },
  finalBossEnfer: { name: 'BARON DE L\'ENFER',      short: 'Le Baron de l\'Enfer',     col: '#ff7043', hi: '#ffccbc', c1: '#4a0d0d', c2: '#c62828', gemC: '#ff7043', phase: ['', 'FUREUR DU BARON', 'RAGE DE L\'ENFER'] },
  finalBossEgout: { name: 'TYRAN DES PROFONDEURS',  short: 'Le Tyran des Profondeurs', col: '#dce775', hi: '#f9fbe7', c1: '#1b3a00', c2: '#558b2f', gemC: '#aeea00', phase: ['', 'FURIE TOXIQUE', 'FUREUR DU TYRAN'] },
  finalBossSpace: { name: 'ABOMINATION COSMIQUE',   short: 'L\'Abomination Cosmique',  col: '#b388ff', hi: '#ede7f6', c1: '#1a0033', c2: '#6a1b9a', gemC: '#b388ff', phase: ['', 'FUREUR COSMIQUE', 'ABOMINATION'] },
  finalBossTempete:{ name: 'SOUVERAIN DES OURAGANS', short: 'Le Souverain des Ouragans', col: '#4fc3f7', hi: '#e1f5fe', c1: '#0d3a5c', c2: '#0277bd', gemC: '#4fc3f7', phase: ['', 'COLÈRE DU VENT', 'FUREUR DES OURAGANS'] }
};

// petit emblème du boss (silhouette stylisée par univers)
function bossEmblem(kind, x, y, r, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'finalBossEnfer') {
    // crâne + flammes
    ctx.beginPath(); ctx.arc(0, -2, r * 0.55, 0, TAU); ctx.fill();
    ctx.fillRect(-r * 0.3, r * 0.2, r * 0.6, r * 0.4);
    ctx.fillStyle = '#1a0d08';
    ctx.beginPath(); ctx.arc(-r * 0.22, -3, r * 0.14, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.22, -3, r * 0.14, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffab40';
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.7); ctx.quadraticCurveTo(-r * 0.7, -r * 1.1 + Math.sin(t * 5) * 1.5, -r * 0.5, -r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.7); ctx.quadraticCurveTo(r * 0.7, -r * 1.1 - Math.sin(t * 5) * 1.5, r * 0.5, -r * 0.5); ctx.stroke();
  } else if (kind === 'finalBossGlace') {
    // flocon à 6 branches
    ctx.strokeStyle = '#b3e5fc';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + t * 0.15;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); ctx.stroke();
      const bx = Math.cos(a) * r * 0.55, by = Math.sin(a) * r * 0.55;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + 0.5) * r * 0.28, by + Math.sin(a + 0.5) * r * 0.28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a - 0.5) * r * 0.28, by + Math.sin(a - 0.5) * r * 0.28); ctx.stroke();
    }
    ctx.fillStyle = '#e1f5fe';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, TAU); ctx.fill();
  } else if (kind === 'finalBossEgout') {
    // goutte toxique
    ctx.fillStyle = '#dce775';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.quadraticCurveTo(r * 0.75, r * 0.1, r * 0.55, r * 0.5);
    ctx.quadraticCurveTo(0, r * 0.95, -r * 0.55, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.75, r * 0.1, 0, -r * 0.9);
    ctx.fill();
    ctx.fillStyle = '#33691e';
    ctx.beginPath(); ctx.arc(-r * 0.18, r * 0.15, r * 0.12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.2, r * 0.35, r * 0.1, 0, TAU); ctx.fill();
  } else if (kind === 'finalBossSpace') {
    // œil cosmique : anneau + pupille + orbites
    ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.55, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ede7f6';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3 + Math.sin(t * 3) * 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#311b92';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b388ff';
    ctx.beginPath(); ctx.arc(Math.cos(t) * r * 1.15, Math.sin(t * 1.3) * r * 0.6, 1.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-Math.cos(t * 0.7) * r * 1.2, -Math.sin(t) * r * 0.7, 1.4, 0, TAU); ctx.fill();
  } else if (kind === 'finalBossTempete') {
    // œil du ouragan : spirale de vent + pupille électrique
    ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      const rr = r * (0.95 - i * 0.28);
      ctx.beginPath();
      for (let a = 0; a <= TAU * 1.6; a += 0.35) {
        const rad = rr * (1 - a / (TAU * 2.2));
        const px = Math.cos(a + t * 2 + i) * rad, py = Math.sin(a + t * 2 + i) * rad * 0.8;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#e1f5fe';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.2 + Math.sin(t * 4) * 1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0d3a5c';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, TAU); ctx.fill();
  } else {
    // seigneur oublié : couronne dorée
    ctx.fillStyle = '#ffd740';
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, r * 0.35); ctx.lineTo(-r * 0.7, -r * 0.15);
    ctx.lineTo(-r * 0.35, r * 0.05); ctx.lineTo(0, -r * 0.45);
    ctx.lineTo(r * 0.35, r * 0.05); ctx.lineTo(r * 0.7, -r * 0.15);
    ctx.lineTo(r * 0.7, r * 0.35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f3e5f5';
    ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.16, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawBossBar() {
  const e = G.enemies.find(en => BOSSES[en.type]);
  if (!e) { G._bossPhase = -1; return; }
  const b = BOSSES[e.type];
  const t = G.time || 0;
  const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
  const ph = e.phase || 0;

  // transition de phase : flash + onde quand la phase monte
  if (G._bossPhase !== ph) {
    if (G._bossPhase !== -1 && G._bossPhase !== undefined && ph > G._bossPhase) G._bossPhaseT = t;
    G._bossPhase = ph;
  }
  const phaseFlash = G._bossPhaseT !== undefined ? Math.max(0, 1 - (t - G._bossPhaseT) / 1.2) : 0;

  const bw = 620, bh = 20, bx = W / 2 - bw / 2, by = 62;

  // nom + emblème (légèrement agrandi pendant la transition)
  const pop = 1 + phaseFlash * 0.25;
  ctx.save();
  ctx.translate(W / 2, 42);
  ctx.scale(pop, pop);
  bossEmblem(e.type, -bw / 2 - 6, 0, 12, t);
  ctx.restore();
  engraved(`☠ ${b.short.toUpperCase()} ☠`, W / 2, 51, 13, b.hi, 'center', 'Georgia, serif');
  // cadre métallique (lueur de l'univers du boss)
  metalFrame(bx - 9, by - 7, bw + 18, bh + 30, 9, { glow: `rgba(${hexToRgb(b.col)},${0.35 + phaseFlash * 0.5})` });
  gem(bx - 2, by + bh / 2, 5, b.gemC, t);
  gem(bx + bw + 2, by + bh / 2, 5, b.gemC, t + 2);

  // barre de vie dégradée par univers + marqueurs de phase
  medBar(bx, by, bw, bh, e.shieldT > 0 ? 1 : f, null, b.c1, b.c2,
    { glow: phaseFlash > 0 ? b.col : null });
  if (e.shieldT <= 0) {
    ctx.save();
    ctx.beginPath();
    roundRect(bx, by, bw * f, bh, bh / 2); ctx.clip();
    // stries verticales de la jauge
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 1; i < 12; i++) ctx.fillRect(bx + (bw / 12) * i, by, 1.5, bh);
    // reflet
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bx, by, bw * f, bh * 0.35);
    ctx.restore();
  } else {
    // bouclier : la jauge scintille argentée
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(t * 8) * 0.3;
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }
  // marqueurs de phase à 66 % et 33 %
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const cut of [0.66, 0.33]) {
    const mx = bx + bw * cut;
    ctx.fillRect(mx - 1, by - 3, 2, bh + 6);
  }
  // PV numériques (centrés sur la jauge)
  engraved(`${Math.ceil(e.hp)} / ${e.maxHp}`, W / 2, by + bh / 2 + 4, 11, '#fff', 'center', 'Consolas, monospace');

  // ligne du bas du cadre : phase à gauche, bouclier à droite
  const footY = by + bh + 14;
  if (ph > 0) {
    engraved(`PHASE ${ph + 1} — ${b.phase[ph]}`, W / 2 - 120, footY, 11, b.col, 'left', 'Georgia, serif');
  }
  if (e.shieldT > 0) {
    engraved(`🛡 BOUCLIER ${e.shieldT.toFixed(0)}s`, W / 2 + 120, footY, 11, '#ffd740', 'right', 'Consolas, monospace');
  }

  // onde de transition de phase
  if (phaseFlash > 0) {
    ctx.save();
    ctx.globalAlpha = phaseFlash * 0.5;
    ctx.strokeStyle = b.col; ctx.lineWidth = 3;
    const rr = (1 - phaseFlash) * 60 + 10;
    ctx.beginPath(); ctx.arc(W / 2, by + bh / 2, rr, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
