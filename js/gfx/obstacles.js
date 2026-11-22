import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';

// ---------- OBSTACLES : rochers et montagnes (triés en y avec les entités) ----------
export function drawObstacle(o, def) {
  const ice = def.biome === 'ice';
  const hell = def.biome === 'hell';
  const sewer = def.biome === 'sewer';
  const space = def.biome === 'space';
  if (o.type === 'mountain') drawMountain(o, ice, hell, sewer, space); else drawBoulder(o, ice, hell, sewer, space);
}

// montagne : pic rocheux détaillé — crêtes en contrebas, facettes ombrées,
// calotte neigeuse sculptée, éboulis et sapins à la base
function drawMountain(o, ice, hell = false, sewer = false, space = false) {
  const r = o.r, sd = o.seed * 7919 % 1, sd2 = (o.seed * 104729 % 1) - 0.5;
  const px = o.x + sd2 * r * 0.3, py = o.y - r * 1.55; // sommet
  const baseY = o.y + r * 0.5;
  const rockHi = hell ? '#7a4a3a' : space ? '#4d5568' : sewer ? '#5a6a45' : ice ? '#9db4c8' : '#94856f';
  const rockMid = hell ? '#5c322a' : space ? '#3a4150' : sewer ? '#43502f' : ice ? '#748ca3' : '#776a58';
  const rockLo = hell ? '#3a1d18' : space ? '#232833' : sewer ? '#2a341e' : ice ? '#546d85' : '#4e443a';
  const ridgeCol = (back, sc) => hell ? (back ? '#4a2620' : '#5f322b') : space ? (back ? '#2e3444' : '#3d4556') : sewer ? (back ? '#35401f' : '#43502f') : ice ? (back ? '#54708a' : '#6a869e') : (back ? '#4c4139' : '#5f5346');

  // halo atmosphérique derrière le massif
  const hz = ctx.createRadialGradient(o.x, o.y - r * 0.6, r * 0.3, o.x, o.y - r * 0.6, r * 1.9);
  hz.addColorStop(0, 'rgba(255,255,255,0.10)');
  hz.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hz;
  ctx.beginPath(); ctx.ellipse(o.x, o.y - r * 0.6, r * 1.9, r * 1.5, 0, 0, TAU); ctx.fill();

  // ombre portée au sol
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath(); ctx.ellipse(o.x, baseY + r * 0.08, r * 1.2, r * 0.3, 0, 0, TAU); ctx.fill();

  // ---- crêtes en contrebas (2 plans plus lointains, plus sombres) ----
  const ridge = (off, sc, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(o.x - r * 1.35 * sc + off, baseY);
    ctx.lineTo(o.x - r * 0.2 * sc + off, baseY - r * 0.95 * sc);
    ctx.lineTo(o.x + r * 0.5 * sc + off, baseY - r * 0.6 * sc);
    ctx.lineTo(o.x + r * 1.3 * sc + off, baseY);
    ctx.closePath(); ctx.fill();
  };
  ridge(r * 0.55, 0.62, ridgeCol(true));
  ridge(-r * 0.4, 0.8, ridgeCol(false));

  // ---- corps principal : pic avec dégradé roche vertical ----
  const mg = ctx.createLinearGradient(o.x, py, o.x, baseY);
  mg.addColorStop(0, rockHi);
  mg.addColorStop(0.45, rockMid);
  mg.addColorStop(1, rockLo);
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.moveTo(o.x - r * 1.05, baseY);
  // versant gauche : Slightement concave
  ctx.quadraticCurveTo(o.x - r * 0.55, py + r * 0.35, px - r * 0.06, py);
  // arête sommitale accidentée
  ctx.lineTo(px + r * 0.14, py + r * 0.1);
  ctx.lineTo(px + r * 0.3, py - r * 0.03);
  // versant droit
  ctx.quadraticCurveTo(o.x + r * 0.6, py + r * 0.4, o.x + r * 1.05, baseY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.42)'; ctx.lineWidth = 2;
  ctx.stroke();

  // ---- facettes : faces ombrées à droite, éclairées à gauche ----
  // face ombrée (droite)
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.moveTo(px + r * 0.1, py + r * 0.06);
  ctx.quadraticCurveTo(o.x + r * 0.62, py + r * 0.45, o.x + r * 1.0, baseY);
  ctx.lineTo(px + r * 0.45, baseY - r * 0.1);
  ctx.quadraticCurveTo(o.x + r * 0.4, py + r * 0.5, px + r * 0.2, py + r * 0.35);
  ctx.closePath(); ctx.fill();
  // face éclairée (gauche)
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath();
  ctx.moveTo(o.x - r * 1.0, baseY);
  ctx.quadraticCurveTo(o.x - r * 0.55, py + r * 0.32, px - r * 0.05, py);
  ctx.lineTo(px - r * 0.3, py + r * 0.3);
  ctx.quadraticCurveTo(o.x - r * 0.3, py + r * 0.55, o.x - r * 0.15, baseY);
  ctx.closePath(); ctx.fill();
  // strates rocheuses horizontales
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.4;
  for (let i = 1; i <= 3; i++) {
    const yy = py + (baseY - py) * (i / 4);
    const spread = r * (0.15 + i * 0.28);
    ctx.beginPath();
    ctx.moveTo(px - spread * 0.5, yy);
    ctx.quadraticCurveTo(o.x - r * 0.2, yy + r * 0.05, o.x + spread * 0.3, yy + r * 0.02);
    ctx.stroke();
  }

  // ---- calotte : cratère de lave (enfers) ou neige sculptée ----
  if (hell) {
    // lave incandescente au sommet + veines qui descendent le versant
    const lg = ctx.createRadialGradient(px, py + r * 0.05, 2, px, py + r * 0.05, r * 0.55);
    lg.addColorStop(0, 'rgba(255,220,120,0.95)');
    lg.addColorStop(0.4, 'rgba(255,90,20,0.75)');
    lg.addColorStop(1, 'rgba(180,30,0,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(px, py + r * 0.08, r * 0.5, r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,40,0.85)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const vx = px + (i - 1) * r * 0.3;
      ctx.beginPath();
      ctx.moveTo(vx, py + r * 0.12);
      ctx.quadraticCurveTo(vx + r * 0.15, py + r * 0.5, vx + (i - 1) * r * 0.2, py + r * (0.75 + i * 0.12));
      ctx.stroke();
    }
  } else if (space) {
    // cratère spatial : dépression bleutée + lueur au fond
    const lg = ctx.createRadialGradient(px, py + r * 0.1, 2, px, py + r * 0.1, r * 0.6);
    lg.addColorStop(0, 'rgba(160,190,255,0.9)');
    lg.addColorStop(0.5, 'rgba(90,110,200,0.5)');
    lg.addColorStop(1, 'rgba(40,50,110,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(px, py + r * 0.1, r * 0.55, r * 0.32, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(170,200,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(px, py + r * 0.1, r * 0.55, r * 0.32, 0, 0, TAU); ctx.stroke();
  } else if (sewer) {
    // calotte de vase : luisance verdâtre suintant le long du pic
    const lg = ctx.createRadialGradient(px, py + r * 0.08, 2, px, py + r * 0.08, r * 0.55);
    lg.addColorStop(0, 'rgba(200,255,130,0.85)');
    lg.addColorStop(0.5, 'rgba(110,180,60,0.5)');
    lg.addColorStop(1, 'rgba(60,110,40,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(px, py + r * 0.08, r * 0.55, r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,230,90,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const vx = px + (i - 1) * r * 0.28;
      ctx.beginPath();
      ctx.moveTo(vx, py + r * 0.1);
      ctx.quadraticCurveTo(vx + r * 0.12, py + r * 0.45, vx + (i - 1) * r * 0.18, py + r * (0.7 + i * 0.1));
      ctx.stroke();
    }
  } else {
  const capH = ice ? 0.5 : 0.34;
  const capBase = py + r * capH;
  // ombre sous la corniche
  ctx.fillStyle = 'rgba(30,40,55,0.35)';
  ctx.beginPath();
  ctx.moveTo(px - r * 0.42, capBase + r * 0.16);
  ctx.quadraticCurveTo(px, capBase + r * 0.3, px + r * 0.36, capBase + r * 0.12);
  ctx.lineTo(px + r * 0.2, capBase + r * 0.22);
  ctx.quadraticCurveTo(px, capBase + r * 0.34, px - r * 0.24, capBase + r * 0.26);
  ctx.closePath(); ctx.fill();
  // neige
  const sg = ctx.createLinearGradient(px, py - r * 0.05, px, capBase + r * 0.2);
  sg.addColorStop(0, ice ? '#ffffff' : '#f6fafd');
  sg.addColorStop(1, ice ? '#cfe0ee' : '#dfe9f2');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(px - r * 0.44, capBase + r * 0.08);
  // lisière irrégulière de la neige
  ctx.quadraticCurveTo(px - r * 0.2, capBase - r * 0.08, px - r * 0.02, capBase - r * 0.12);
  ctx.quadraticCurveTo(px + r * 0.16, capBase - r * 0.05, px + r * 0.38, capBase + r * 0.05);
  ctx.lineTo(px + r * 0.22, capBase + r * 0.24);
  ctx.quadraticCurveTo(px, capBase + r * 0.36, px - r * 0.26, capBase + r * 0.22);
  ctx.closePath(); ctx.fill();
  // reflet bleuté sur la neige
  ctx.fillStyle = 'rgba(140,180,215,0.4)';
  ctx.beginPath(); ctx.ellipse(px - r * 0.08, capBase + r * 0.1, r * 0.2, r * 0.05, -0.3, 0, TAU); ctx.fill();
  // glaçons qui débordent de la corniche et mordent dans la roche
  ctx.fillStyle = sg;
  for (let i = 0; i < 4; i++) {
    const gx = px - r * 0.3 + i * r * 0.2 + sd * r * 0.08;
    const gl = r * (0.1 + (i % 2) * 0.07);
    const gy = capBase + r * (0.2 + (i % 2) * 0.06);
    ctx.beginPath();
    ctx.moveTo(gx - r * 0.05, gy); ctx.lineTo(gx + r * 0.05, gy);
    ctx.lineTo(gx, gy + gl); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,160,195,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // neige qui dégringole le long du versant (coulées)
  ctx.fillStyle = 'rgba(246,250,253,0.55)';
  for (let i = 0; i < 3; i++) {
    const cx2 = px + (i - 1) * r * 0.28;
    const cy2 = capBase + r * (0.3 + i * 0.16);
    ctx.beginPath();
    ctx.moveTo(cx2 - r * 0.07, cy2); ctx.lineTo(cx2 + r * 0.07, cy2);
    ctx.lineTo(cx2 + r * 0.04, cy2 + r * (0.22 + i * 0.08));
    ctx.lineTo(cx2 - r * 0.04, cy2 + r * (0.22 + i * 0.08));
    ctx.closePath(); ctx.fill();
  }
  } // fin du bloc calotte neige (biomes non-enfers)

  // ---- éboulis au pied ----
  for (let i = 0; i < 6; i++) {
    const a = sd * TAU + i * 1.05;
    const bx = o.x + Math.cos(a) * r * (0.75 + (i % 3) * 0.18);
    const by = baseY - r * 0.06 + Math.abs(Math.sin(a)) * r * 0.1;
    const br = r * (0.06 + (i % 3) * 0.025);
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.7, 0, 0, TAU); ctx.fill();
  }
  // sapins nains accrochés à la pente (leurs pieds épousent le versant)
  // (absents des Enfers/Égouts/Espace : d'autres décors s'en chargent)
  for (let i = 0; !hell && !sewer && !space && i < 3; i++) {
    const tx = o.x - r * 0.62 + i * r * 0.5 + sd2 * r * 0.3;
    const nx = Math.max(-0.95, Math.min(0.95, (tx - o.x) / r));
    // hauteur de la surface rocheuse à cet x (approximation linéaire du versant)
    const surfY = baseY - (1 - Math.abs(nx) / 1.05) * (baseY - py) * 0.72;
    const ty = surfY + r * 0.03;
    const ts = r * 0.11;
    // motte de roche sous le tronc : le sapin ne flotte plus
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(tx, ty + 1, ts * 0.9, ts * 0.35, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(tx - ts * 0.12, ty - ts * 0.7, ts * 0.24, ts * 0.75);
    const greens = ice ? ['#6d9ab5', '#84aec4', '#5b87a0'] : ['#2e7d32', '#388e3c', '#43a047'];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = greens[(i + k) % 3];
      const tw = (ts * (1.1 - k * 0.3)), top = ty - ts * (0.9 + k * 0.55);
      ctx.beginPath();
      ctx.moveTo(tx, top - ts * 0.9); ctx.lineTo(tx - tw, top); ctx.lineTo(tx + tw, top);
      ctx.closePath(); ctx.fill();
    }
    // neige sur les branches (biome glace)
    if (ice) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let k = 0; k < 3; k++) {
        const tw = ts * (1.1 - k * 0.3) * 0.8, top = ty - ts * (0.9 + k * 0.55);
        ctx.beginPath(); ctx.ellipse(tx, top + ts * 0.15, tw * 0.7, ts * 0.12, 0, 0, TAU); ctx.fill();
      }
    }
  }
  // brume au pied
  const mist = ctx.createLinearGradient(0, baseY - r * 0.25, 0, baseY + r * 0.2);
  mist.addColorStop(0, 'rgba(255,255,255,0)');
  mist.addColorStop(1, ice ? 'rgba(230,242,252,0.4)' : hell ? 'rgba(255,90,30,0.18)' : space ? 'rgba(150,180,255,0.15)' : sewer ? 'rgba(160,220,110,0.16)' : 'rgba(230,225,210,0.3)');
  ctx.fillStyle = mist;
  ctx.beginPath(); ctx.ellipse(o.x, baseY + r * 0.05, r * 1.15, r * 0.32, 0, 0, TAU); ctx.fill();
}

// rocher : groupe de 2-3 blocs arrondis avec facettes
function drawBoulder(o, ice, hell = false, sewer = false, space = false) {
  const r = o.r;
  // ombre
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(o.x, o.y + r * 0.62, r * 1.05, r * 0.32, 0, 0, TAU); ctx.fill();
  const blocks = [
    { dx: 0, dy: -r * 0.12, rx: r * 0.95, ry: r * 0.8 },
    { dx: r * 0.62, dy: r * 0.18, rx: r * 0.55, ry: r * 0.48 },
    { dx: -r * 0.6, dy: r * 0.22, rx: r * 0.5, ry: r * 0.42 },
  ];
  for (const b of blocks) {
    const bx = o.x + b.dx + (o.seed % 1) * r * 0.15, by = o.y + b.dy;
    const g = ctx.createRadialGradient(bx - b.rx * 0.3, by - b.ry * 0.35, 1, bx, by, b.rx);
    g.addColorStop(0, hell ? '#6b3a30' : space ? '#565e70' : sewer ? '#6a7a4a' : ice ? '#d7e3ec' : '#a8a29a');
    g.addColorStop(0.6, hell ? '#4a2620' : space ? '#3d4556' : sewer ? '#4c5c33' : ice ? '#93a9bd' : '#7d746a');
    g.addColorStop(1, hell ? '#2e1512' : space ? '#232833' : sewer ? '#2e3a1f' : ice ? '#5f7488' : '#4e463e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(bx, by, b.rx, b.ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.6; ctx.stroke();
    // facette claire + ligne de fracture
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(bx - b.rx * 0.28, by - b.ry * 0.3, b.rx * 0.32, b.ry * 0.24, -0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx - b.rx * 0.4, by - b.ry * 0.1);
    ctx.lineTo(bx + b.rx * 0.35, by + b.ry * 0.15);
    ctx.stroke();
  }
}
