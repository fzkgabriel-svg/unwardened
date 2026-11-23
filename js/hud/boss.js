// js/hud/boss.js — barre de boss final : cadre métallique imposant,
// emblème du boss, nom, phases avec transition animée, bouclier de phase.
import { G, ctx, W, TAU } from '../state.js';
import { roundRect } from '../utils.js';
import { metalFrame, medBar, engraved, gem } from './frame.js';

const BOSSES = {
  finalBoss:      { name: 'SEIGNEUR OUBLIÉ',        short: 'Le Seigneur Oublié',       epithet: 'LE ROI DES TÉNÈBRES',        col: '#e040fb', hi: '#f3e5f5', c1: '#4a148c', c2: '#8e24aa', gemC: '#e040fb', phase: ['', 'COLÈRE ANCESTRALE', 'FUREUR DU ROI OUBLIÉ'] },
  finalBossGlace: { name: 'SOUVERAIN DE GLACE',     short: 'Le Souverain de Glace',    epithet: 'MAÎTRE DU FROID ÉTERNEL',    col: '#4fc3f7', hi: '#e1f5fe', c1: '#01579b', c2: '#0288d1', gemC: '#4fc3f7', phase: ['', 'GLACIATION', 'FUREUR GLACIALE'] },
  finalBossEnfer: { name: 'BARON DE L\'ENFER',      short: 'Le Baron de l\'Enfer',     epithet: 'LE SOUVERAIN DES BRAISES',   col: '#ff7043', hi: '#ffccbc', c1: '#4a0d0d', c2: '#c62828', gemC: '#ff7043', phase: ['', 'FUREUR DU BARON', 'RAGE DE L\'ENFER'] },
  finalBossEgout: { name: 'TYRAN DES PROFONDEURS',  short: 'Le Tyran des Profondeurs', epithet: 'LE DOMPTEUR DES ABÎMES',     col: '#dce775', hi: '#f9fbe7', c1: '#1b3a00', c2: '#558b2f', gemC: '#aeea00', phase: ['', 'FURIE TOXIQUE', 'FUREUR DU TYRAN'] },
  finalBossSpace: { name: 'ABOMINATION COSMIQUE',   short: 'L\'Abomination Cosmique',  epithet: 'L\'HORREUR DES ÉTOILES',     col: '#b388ff', hi: '#ede7f6', c1: '#1a0033', c2: '#6a1b9a', gemC: '#b388ff', phase: ['', 'FUREUR COSMIQUE', 'ABOMINATION'] },
  finalBossTempete:{ name: 'SOUVERAIN DES OURAGANS', short: 'Le Souverain des Ouragans', epithet: 'LE SEIGNEUR DES CYCLES',    col: '#4fc3f7', hi: '#e1f5fe', c1: '#0d3a5c', c2: '#0277bd', gemC: '#4fc3f7', phase: ['', 'COLÈRE DU VENT', 'FUREUR DES OURAGANS'] }
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
  if (!e) {
    G._bossPhase = -1; G._bossGhost = null; G._bossBarIn = 0;
    return;
  }
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

  // apparition de la barre : glissement + fondu à l'arrivée du boss
  if (!G._bossBarIn) G._bossBarIn = t;
  const inK = Math.min(1, (t - G._bossBarIn) / 0.9);
  const inEase = 1 - Math.pow(1 - inK, 3);

  // disparition : la barre s'efface pendant l'agonie du boss
  const dieK = e.bossDying ? Math.max(0, e.bossDying / 2.4) : 1;
  const alpha = inEase * dieK;
  if (alpha <= 0.01) return;

  // traînée de dégâts : jauge pâle qui se vide avec du retard
  if (G._bossGhost === undefined || G._bossGhost === null) G._bossGhost = f;
  if (f < G._bossGhost) G._bossGhost = f;
  else G._bossGhost = Math.max(f, G._bossGhost - 0.006); // vidange lente ~2,5 s
  const ghostF = G._bossGhost;

  // pouls quand la vie est faible + flash quand le boss subit un coup
  const lowHp = f < 0.28;
  const lowPulse = lowHp ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
  if (G._bossLastHp === undefined || e.hp < G._bossLastHp) G._bossHitT = t;
  G._bossLastHp = e.hp;
  const hitFlash = G._bossHitT !== undefined ? Math.max(0, 1 - (t - G._bossHitT) / 0.25) : 0;

  const bw = 640, bh = 20, bx = W / 2 - bw / 2, by = 64;

  ctx.save();
  ctx.globalAlpha = alpha;
  // décalage d'entrée : la barre monte de 14 px
  ctx.translate(0, (1 - inEase) * 14);

  // nom + emblème + épithète (légèrement agrandi pendant la transition)
  const pop = 1 + phaseFlash * 0.25;
  ctx.save();
  ctx.translate(W / 2, 44);
  ctx.scale(pop * (0.9 + 0.1 * inEase), pop * (0.9 + 0.1 * inEase));
  bossEmblem(e.type, -bw / 2 - 30, 0, 13, t);
  ctx.restore();
  engraved(`☠ ${b.short.toUpperCase()} ☠`, W / 2, 53, 13, b.hi, 'center', 'Georgia, serif');
  // épithète + rang sous le nom
  ctx.font = '600 8.5px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.letterSpacing = '2.5px';
  ctx.fillStyle = 'rgba(212,176,98,0.85)';
  ctx.fillText(`${b.epithet} · ✦ BOSS FINAL ✦`, W / 2, 66);
  ctx.letterSpacing = '0px';

  // cadre métallique (lueur de l'univers du boss, intensifiée si vie faible)
  const glowA = 0.35 + phaseFlash * 0.5 + lowPulse * 0.3 + hitFlash * 0.4;
  metalFrame(bx - 10, by - 8, bw + 20, bh + 34, 9, { glow: `rgba(${hexToRgb(b.col)},${glowA})` });
  gem(bx - 3, by + bh / 2, 5, b.gemC, t);
  gem(bx + bw + 3, by + bh / 2, 5, b.gemC, t + 2);

  // traînée de dégâts : fine ligne pâle derrière la jauge principale
  if (ghostF > f + 0.004) {
    ctx.fillStyle = 'rgba(255,235,160,0.4)';
    roundRect(bx, by, bw * ghostF, bh, bh / 2); ctx.fill();
  }
  // barre de vie dégradée par univers + marqueurs de phase
  medBar(bx, by, bw, bh, e.shieldT > 0 ? 1 : f, null, b.c1, b.c2,
    { glow: phaseFlash > 0 || lowPulse > 0.2 ? b.col : null });
  // reflet lumineux qui balaie la jauge
  const sweep = ((t * 0.6) % 1.6) - 0.3;
  ctx.save();
  ctx.beginPath();
  roundRect(bx, by, bw * f, bh, bh / 2); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 1; i < 12; i++) ctx.fillRect(bx + (bw / 12) * i, by, 1.5, bh);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(bx, by, bw * f, bh * 0.35);
  // reflet mobile
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(bx + bw * f * sweep - 18, by, 36, bh);
  ctx.restore();
  if (e.shieldT <= 0) {
    // liseré incandescent en bout de jauge
    ctx.fillStyle = hexACol(b.col, 0.5 + lowPulse * 0.4);
    roundRect(bx + bw * f - 3, by - 1, 3, bh + 2, 1.5); ctx.fill();
  } else {
    // bouclier : la jauge scintille argentée
    ctx.save();
    ctx.globalAlpha = (0.5 + Math.sin(t * 8) * 0.3) * alpha;
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }
  // flash de coup subi : la jauge s'embrase brièvement
  if (hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = hitFlash * 0.55;
    ctx.fillStyle = '#ffffff';
    roundRect(bx, by, bw * f, bh, bh / 2); ctx.fill();
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
  const footY = by + bh + 15;
  if (ph > 0) {
    engraved(`PHASE ${ph + 1} — ${b.phase[ph]}`, W / 2 - 140, footY, 11, b.col, 'left', 'Georgia, serif');
  }
  if (e.shieldT > 0) {
    engraved(`🛡 BOUCLIER ${e.shieldT.toFixed(0)}s`, W / 2 + 140, footY, 11, '#ffd740', 'right', 'Consolas, monospace');
  }
  // avertissement vie faible
  if (lowHp && !e.bossDying) {
    ctx.font = '600 9px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.letterSpacing = '2px';
    ctx.fillStyle = `rgba(255,82,82,${0.55 + lowPulse * 0.4})`;
    ctx.fillText('⚠ DERNIÈRE LIGNE DE DÉFENSE ⚠', W / 2, footY);
    ctx.letterSpacing = '0px';
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
  ctx.restore();
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
function hexACol(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
