// js/gfx/gardien_draw.js — Le Jugement du Gardien : aura au repos,
// concentration de « Sentence ancestrale », ondes runiques et révélation.
import { G, W, H, TAU, ctx } from '../state.js';
import { roundRect } from '../utils.js';
import { SENT_CHARGE } from '../attacks.js';
import { sfxGardienUnlock } from '../audio.js';

const CRY = '#a7ffeb', GLD = '#ffd740';

// ---------- aura subtile de l'arme équipée (mode 7) ----------
// léger halo cyan qui pulse lentement autour du héros — jamais éblouissant
export function drawGardienAura() {
  const p = G.player;
  if (!p || p.attackMode !== 7 || G.state !== 'playing') return;
  if (p.sentenceT > 0) return; // la charge a son propre effet plus intense
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 1.7);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.4, p.x, p.y, p.r * 3.4);
  g.addColorStop(0, `rgba(167,255,235,${0.05 + pulse * 0.03})`);
  g.addColorStop(1, 'rgba(167,255,235,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.4, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------- concentration de Sentence ancestrale ----------
// cercle de runes qui se resserre autour du héros + liseré montant
export function drawSentenceCharge() {
  const p = G.player;
  if (!p || p.sentenceT <= 0) return;
  const chg = 1 - p.sentenceT / SENT_CHARGE; // 0 -> 1
  const a = p.sentenceAng;
  ctx.save();
  ctx.translate(p.x, p.y);
  // halo central qui s'intensifie
  ctx.globalCompositeOperation = 'lighter';
  const hg = ctx.createRadialGradient(0, 0, 2, 0, 0, 60 + chg * 50);
  hg.addColorStop(0, `rgba(255,243,196,${0.10 + chg * 0.22})`);
  hg.addColorStop(0.5, `rgba(167,255,235,${0.06 + chg * 0.10})`);
  hg.addColorStop(1, 'rgba(167,255,235,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, 0, 60 + chg * 50, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // runes orbitant : traits dorés/cyan disposés en cercle, rayon qui se resserre
  const n = 10;
  for (let i = 0; i < n; i++) {
    const ra = G.time * (1.2 + chg * 1.6) + (i / n) * TAU;
    const rr = (58 - chg * 26) * (0.75 + 0.25 * Math.sin(i * 2.3));
    const rx = Math.cos(ra) * rr, ry = Math.sin(ra) * rr * 0.72;
    const appear = Math.min(1, chg * n / 4 + (n - i) / n * 0.4);
    if (appear <= 0.05) continue;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(ra + Math.PI / 2);
    ctx.globalAlpha = appear;
    ctx.strokeStyle = i % 3 === 0 ? GLD : CRY;
    ctx.lineWidth = 1.4;
    const s = 3 + chg * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  // liseré d'impact : le secteur de la vague à venir, de plus en plus net
  const reach = 330;
  ctx.save();
  ctx.rotate(a);
  const fg = ctx.createLinearGradient(0, 0, reach, 0);
  fg.addColorStop(0, `rgba(255,243,196,${0.10 + chg * 0.20})`);
  fg.addColorStop(1, 'rgba(167,255,235,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, reach, -0.28, 0.28);
  ctx.closePath(); ctx.fill();
  // deux bords du secteur (traits runiques)
  ctx.strokeStyle = `rgba(255,215,64,${0.25 + chg * 0.5})`;
  ctx.lineWidth = 1.5;
  for (const s of [-0.28, 0.28]) {
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(s) * reach, Math.sin(s) * reach); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

// ---------- ondes runiques libérées ----------
// front d'onde en arc + traces runiques au sol, estompé en fin de parcours
export function drawSentenceWaves() {
  if (!G.sentenceWaves.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const w of G.sentenceWaves) {
    const k = 1 - w.t / w.dur;              // intensité décroissante
    const front = w.t * w.speed;
    const ex = Math.cos(w.angle), ey = Math.sin(w.angle);
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.angle);
    // corps de l'onde : secteur allongé devant le front
    const len = Math.min(front, w.speed * w.dur);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255,243,196,${0.30 * k})`);
    g.addColorStop(0.6, `rgba(167,255,235,${0.22 * k})`);
    g.addColorStop(1, 'rgba(167,255,235,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, len + 30, -0.16, 0.16);
    ctx.closePath(); ctx.fill();
    // front brilliant : arc lumineux au bout de l'onde
    const fg2 = ctx.createRadialGradient(len, 0, 2, len, 0, w.halfW * 0.9);
    fg2.addColorStop(0, `rgba(255,255,255,${0.5 * k})`);
    fg2.addColorStop(0.5, `rgba(167,255,235,${0.25 * k})`);
    fg2.addColorStop(1, 'rgba(167,255,235,0)');
    ctx.fillStyle = fg2;
    ctx.beginPath();
    ctx.ellipse(len, 0, 26, w.halfW * 0.85, 0, 0, TAU);
    ctx.fill();
    // chevrons runiques gravés le long du sillon
    ctx.strokeStyle = `rgba(255,215,64,${0.5 * k})`;
    ctx.lineWidth = 1.6;
    const step = 34;
    for (let d = step; d < len - 10; d += step) {
      const wob = Math.sin(d * 0.05 + w.t * 20) * 6;
      const off = Math.sin(d * 0.11) * w.halfW * 0.55;
      for (const s of [off - 7, off + 7]) {
        ctx.beginPath();
        ctx.moveTo(d - 5, s + wob); ctx.lineTo(d, s - 4 + wob); ctx.lineTo(d + 5, s + wob);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------- révélation de l'arme (écran de victoire, monde 1) ----------
// calquée sur drawBowReveal : fondu, particules dorées/cyan, carte de présentation
export function drawGardienReveal() {
  if (G.gardienReveal === null || G.gardienReveal === undefined) return;
  const t = G.time - G.gardienReveal;
  const DUR = 7;
  if (t > DUR) { G.gardienReveal = null; G._gardienSfxDone = false; return; }
  // sting de découverte : une fois, quand la carte commence à apparaître
  if (t > 0.9 && !G._gardienSfxDone) { G._gardienSfxDone = true; sfxGardienUnlock(); }
  const k = Math.min(1, t / 1.1);           // apparition
  const fade = t > DUR - 1.2 ? Math.max(0, (DUR - t) / 1.2) : 1;
  ctx.save();
  ctx.globalAlpha = fade;
  // voile sombre qui s'estompe
  ctx.fillStyle = `rgba(6,8,14,${0.72 * fade * Math.min(1, t / 0.4)})`;
  ctx.fillRect(0, 0, W, H);
  // particules montant des bords
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const px = ((i * 197.3 + G.time * (8 + (i % 5) * 3)) % (W + 80)) - 40;
    const py = H - ((i * 89.7 + G.time * (14 + (i % 7) * 4)) % (H + 60));
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(G.time * 2 + i));
    ctx.fillStyle = i % 3 === 0 ? `rgba(255,215,64,${0.35 * tw * fade})` : `rgba(167,255,235,${0.4 * tw * fade})`;
    ctx.beginPath(); ctx.arc(px, py, 1.5 + (i % 3), 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const cx = W / 2, cy = H / 2 - 20;
  const pop = 1 + 0.25 * (1 - k); // léger rebond d'apparition
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.globalAlpha = fade * k;
  // carte de présentation
  const cw = 460, ch = 300;
  const gx = -cw / 2, gy = -ch / 2;
  const bg = ctx.createLinearGradient(0, gy, 0, gy + ch);
  bg.addColorStop(0, '#1c2030'); bg.addColorStop(1, '#10131c');
  ctx.fillStyle = bg;
  roundRect(gx, gy, cw, ch, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.6)'; ctx.lineWidth = 1.5;
  roundRect(gx + 0.75, gy + 0.75, cw - 1.5, ch - 1.5, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(167,255,235,0.35)'; ctx.lineWidth = 1;
  roundRect(gx + 7, gy + 7, cw - 14, ch - 14, 10); ctx.stroke();
  // étiquette rareté
  ctx.textAlign = 'center';
  ctx.font = '700 13px Inter, sans-serif';
  ctx.fillStyle = '#ffd740';
  ctx.fillText('✦ ARME LÉGENDAIRE ✦', 0, gy + 30);
  // nom
  ctx.font = '700 30px Georgia, serif';
  ctx.fillStyle = '#e8d9a8';
  ctx.fillText('LE JUGEMENT', 0, gy + 72);
  ctx.fillText('DU GARDIEN', 0, gy + 106);
  // petite lame stylisée
  ctx.save();
  ctx.translate(-90, gy + 150);
  ctx.rotate(-0.5);
  const lg = ctx.createLinearGradient(0, -8, 0, 8);
  lg.addColorStop(0, '#455a64'); lg.addColorStop(1, '#1a2332');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(0, -5); ctx.lineTo(78, -3); ctx.lineTo(90, 0); ctx.lineTo(78, 3); ctx.lineTo(0, 5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(-8, -9, 5, 18);
  ctx.fillStyle = '#a7ffeb';
  ctx.save(); ctx.translate(-14, -13); ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8); ctx.restore();
  ctx.restore();
  // description courte
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = 'rgba(232,226,210,0.85)';
  ctx.fillText('Forgée pour un gardien oublié, elle attend', 0, gy + 195);
  ctx.fillText('que son verdict soit rendu.', 0, gy + 213);
  // statistiques
  ctx.font = '600 12px Inter, sans-serif';
  ctx.fillStyle = CRY;
  ctx.fillText('ATTAQUE LOURDE · ONDE RUNIQUE « SENTENCE ANCESTRALE »', 0, gy + ch - 30);
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('Menu FORGE → Personnage → JUGEMENT pour l\'équiper', 0, gy + ch - 14);
  ctx.restore();
  ctx.restore();
}
