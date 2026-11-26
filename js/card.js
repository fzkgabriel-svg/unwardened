// js/card.js — rendu canvas de la carte de joueur (aperçu menu + futurs exports)
// La carte reprend les cosmétiques équipés : fond, cadre, portrait, titre, ornement.
import { G, ctx, W, H } from './state.js';
import { roundRect } from './utils.js';
import { gLevel, gXp, gXpNeed, card, cosmeticById, RAR_COL, MAX_LEVEL } from './cosmetics.js';

// ---------- styles par cosmétique ----------
// Chaque entrée : fonction de fond / couleur de cadre / icône
const BG_STYLES = {
  b_terre:     { g1: '#1c3a24', g2: '#0d2013', acc: '#69f0ae', deco: '🌿' },
  b_glace:     { g1: '#16324a', g2: '#0a1a2c', acc: '#80d8ff', deco: '🏔' },
  b_enfer:     { g1: '#3a1410', g2: '#1c0806', acc: '#ff7043', deco: '🌋' },
  b_egout:     { g1: '#24300d', g2: '#101803', acc: '#aeea00', deco: '🦠' },
  b_espace:    { g1: '#141c3a', g2: '#080c1c', acc: '#82b1ff', deco: '🚀' },
  b_tempete:   { g1: '#0e2a3a', g2: '#061420', acc: '#4fc3f7', deco: '🌪' },
  b_nuit:      { g1: '#1c1040', g2: '#0a0620', acc: '#7c4dff', deco: '🌌' },
  b_aurore:    { g1: '#0f3a2a', g2: '#051a12', acc: '#69f0ae', deco: '🌈' },
  b_cathedrale:{ g1: '#2a2416', g2: '#12100a', acc: '#ffd54f', deco: '⛪' },
  b_comete:    { g1: '#2a1a2e', g2: '#120a18', acc: '#ffab91', deco: '☄️' },
  b_abysses:   { g1: '#04202e', g2: '#010a10', acc: '#00e5ff', deco: '🕳' },
  b_labyrinthe:{ g1: '#1e1440', g2: '#0c0820', acc: '#9575cd', deco: '🌀' },
};
const FRAME_STYLES = {
  f_bois:    { c1: '#6d4c41', c2: '#4e342e', w: 6 },
  f_fer:     { c1: '#78909c', c2: '#455a64', w: 5 },
  f_argent:  { c1: '#e8e8e8', c2: '#9e9e9e', w: 5 },
  f_dor:     { c1: '#ffd54f', c2: '#b8860b', w: 6 },
  f_glace:   { c1: '#b3e5fc', c2: '#4fc3f7', w: 5 },
  f_enfer:   { c1: '#ff8a65', c2: '#bf360c', w: 5 },
  f_void:    { c1: '#b388ff', c2: '#4a148c', w: 6 },
  f_eternel: { c1: '#fff9c4', c2: '#ffea00', w: 7 },
  f_tempete: { c1: '#4fc3f7', c2: '#01579b', w: 5 },
  f_star:    { c1: '#ffe082', c2: '#ff8f00', w: 5 },
  f_obscur:  { c1: '#455a64', c2: '#102027', w: 6 },
  f_genese:  { c1: '#fff59d', c2: '#ff6f00', w: 7 },
};
export function cardBgStyle(id) { return BG_STYLES[id] || BG_STYLES.b_terre; }
export function cardFrameStyle(id) { return FRAME_STYLES[id] || FRAME_STYLES.f_bois; }

// ---------- carte ----------
// Dessine la carte dans un rectangle (x,y,w,h). scale = multiplicateur interne.
export function drawPlayerCard(x, y, w, h, opts = {}) {
  const eq = card().eq || {};
  const lvl = gLevel(), xp = gXp(), need = gXpNeed();
  const pseudo = (G.stats && G.stats.pseudo) || (G.net && G.net.pseudo) || 'Aventurier';
  const bg = cardBgStyle(eq.background);
  const fr = cardFrameStyle(eq.frame);
  const portrait = cosmeticById(eq.portrait);
  const title = cosmeticById(eq.title);
  const orn = cosmeticById(eq.ornament);
  const t = G.time;

  ctx.save();
  // ---- fond (clip) ----
  ctx.save();
  roundRect(x, y, w, h, 14); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, bg.g1); g.addColorStop(1, bg.g2);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // halo central + particules scintillantes
  const rg = ctx.createRadialGradient(x + w * 0.5, y + h * 0.42, 10, x + w * 0.5, y + h * 0.42, w * 0.6);
  rg.addColorStop(0, bg.acc + '22'); rg.addColorStop(1, 'transparent');
  ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
  ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 14; i++) {
    const px = x + ((i * 97 + Math.floor(t * 8) * 13) % w);
    const py = y + ((i * 61 + Math.floor(t * 5) * 7) % h);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
    ctx.globalAlpha = tw * 0.5;
    ctx.fillText(['✦', '·', '✧'][i % 3], px, py);
  }
  ctx.globalAlpha = 1;
  // reflet lumineux qui balaie la carte en diagonale
  const shx = x - 80 + ((t * 90) % (w + 220));
  ctx.save();
  ctx.translate(shx, y + h / 2); ctx.rotate(-0.35);
  const sg = ctx.createLinearGradient(-50, 0, 50, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.08)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(-50, -h, 100, h * 2);
  ctx.restore();
  // décor d'ambiance discret en coin
  ctx.font = '54px serif'; ctx.globalAlpha = 0.10;
  ctx.fillText(bg.deco, x + w - 46, y + h - 34);
  ctx.globalAlpha = 1;
  ctx.restore();

  // ---- cadre : uniquement si un cadre est équipé (sinon fine bordure neutre) ----
  if (eq.frame) {
    const pulse = fr.c1 === '#fff9c4' ? 1 + Math.sin(t * 3) * 0.02 : 1;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(pulse, pulse); ctx.translate(-w / 2, -h / 2);
    const cg = ctx.createLinearGradient(x, y, x + w, y + h);
    cg.addColorStop(0, fr.c1); cg.addColorStop(1, fr.c2);
    ctx.strokeStyle = cg; ctx.lineWidth = fr.w;
    ctx.shadowColor = fr.c1; ctx.shadowBlur = eq.frame === 'f_eternel' ? 18 : 6;
    roundRect(x - fr.w / 2, y - fr.w / 2, w + fr.w, h + fr.w, 16); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    roundRect(x - fr.w / 2 - 3, y - fr.w / 2 - 3, w + fr.w + 6, h + fr.w + 6, 18); ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 14); ctx.stroke();
  }

  const s = Math.min(w / 480, h / 300); // échelle : la carte reste lisible à tout ratio
  // ---- portrait ----
  const px = x + 78 * s, py = y + h / 2;
  const pr = 44 * s;
  const pcol = portrait ? portrait.col : '#78909c';
  ctx.save();
  ctx.beginPath(); ctx.arc(px, py, pr + 4, 0, Math.PI * 2);
  const pcg = ctx.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
  pcg.addColorStop(0, pcol); pcg.addColorStop(1, '#1a1a22');
  ctx.fillStyle = pcg; ctx.fill();
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fillStyle = '#14141c'; ctx.fill();
  ctx.font = `${pr * 1.05}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = portrait ? '#fff' : '#78909c';
  ctx.fillText(portrait ? portrait.icon : '👤', px, py + 2 * s);
  // niveau sous le portrait
  ctx.font = `bold ${13 * s}px Inter, sans-serif`; ctx.fillStyle = '#ffd740';
  ctx.fillText(`NV ${lvl}`, px, py + pr + 16 * s);
  ctx.restore();

  // ---- pseudo + titre ----
  const tx = px + pr + 22 * s;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${26 * s}px Georgia, serif`;
  const disp = pseudo.length > 16 ? pseudo.slice(0, 15) + '…' : pseudo;
  ctx.fillText(disp, tx, y + 62 * s);
  // titre (couleur de rareté)
  const tcol = title ? title.col : '#b0bec5';
  ctx.font = `${13 * s}px Inter, sans-serif`;
  ctx.fillStyle = tcol;
  ctx.fillText(title ? `${title.icon} ${title.nom.toUpperCase()}` : '— Aventurier —', tx, y + 84 * s);
  // ornement près du titre
  if (orn && orn.id !== 'o_rien') {
    ctx.font = `${20 * s}px serif`;
    ctx.fillText(orn.icon, x + w - 58 * s, y + 60 * s);
  }

  // ---- barre d'XP ----
  const bx = tx, bw2 = w - (tx - x) - 30 * s, by2 = y + h - 52 * s;
  const pct = need ? Math.min(1, xp / need) : 1;
  ctx.font = `${10 * s}px Inter, sans-serif`; ctx.fillStyle = '#cfd8dc';
  ctx.fillText(lvl >= MAX_LEVEL ? 'NIVEAU MAXIMUM' : `${xp.toLocaleString('fr-FR')} / ${need.toLocaleString('fr-FR')} XP`, bx, by2 - 6 * s);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(bx, by2, bw2, 10 * s, 5 * s); ctx.fill();
  const xpg = ctx.createLinearGradient(bx, 0, bx + bw2, 0);
  xpg.addColorStop(0, '#ffd54f'); xpg.addColorStop(1, '#ff8a65');
  ctx.fillStyle = xpg;
  if (pct > 0.01) { roundRect(bx, by2, Math.max(8 * s, bw2 * pct), 10 * s, 5 * s); ctx.fill(); }
  // liseré
  ctx.strokeStyle = 'rgba(255,213,79,0.5)'; ctx.lineWidth = 1;
  roundRect(bx, by2, bw2, 10 * s, 5 * s); ctx.stroke();

  // ---- stats discrètes en bas à droite ----
  const st = G.stats || {};
  ctx.textAlign = 'right'; ctx.font = `${11 * s}px Inter, sans-serif`; ctx.fillStyle = 'rgba(207,216,220,0.75)';
  const worlds = Object.keys(st.campaignDone || {}).length;
  const bosses = st.bossesKilled || G.bossesKilled || 0;
  ctx.fillText(`${worlds}/6 mondes · ${bosses} boss · ${lvl}/1000`, x + w - 18 * s, y + h - 14 * s);
  ctx.restore();
}
