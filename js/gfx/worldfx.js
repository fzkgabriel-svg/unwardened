import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';

// ---------- PORTAILS DIMENSIONNELS ----------
export function drawWorldPortals() {
  const w = curWorld();
  if (!w) return;
  const entries = [
    { po: w.portal, color: '#e040fb', label: 'PORTAIL' },
    { po: w.returnPortal, color: '#4fc3f7', label: 'RETOUR' },
  ];
  for (const { po, color, label } of entries) {
    if (!po) continue;
    ctx.save();
    ctx.translate(po.x, po.y);
    // grand halo au sol
    ctx.scale(1, 0.55);
    const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 70);
    g.addColorStop(0, hexA(color, 0.85));
    g.addColorStop(0.55, hexA(color, 0.4));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill();
    ctx.restore();
    // arche verticale : deux piliers d'énergie + tourbillon central
    ctx.save();
    ctx.translate(po.x, po.y);
    ctx.strokeStyle = hexA(color, 0.8); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 14, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a0 = G.time * 2.2 + i * TAU / 3;
      ctx.strokeStyle = hexA(color, 0.5 - i * 0.12); ctx.lineWidth = 5 - i;
      ctx.beginPath(); ctx.ellipse(0, 0, 40 - i * 9, (40 - i * 9) * 0.32, a0 * 0.2, a0, a0 + 2.2); ctx.stroke();
    }
    // cœur montant
    const cy = -18 + Math.sin(G.time * 2.8) * 6;
    const cg = ctx.createRadialGradient(0, cy, 2, 0, cy, 26);
    cg.addColorStop(0, 'rgba(255,255,255,0.95)');
    cg.addColorStop(0.4, hexA(color, 0.8));
    cg.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, cy, 26, 0, TAU); ctx.fill();
    ctx.restore();
    // étiquette + invite
    ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(label, po.x, po.y - 78);
    ctx.fillStyle = color;
    ctx.fillText(label, po.x, po.y - 78);
    const d = Math.hypot(G.player.x - po.x, G.player.y - po.y) - 46;
    if (d < CONFIG.interactDist) {
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.strokeText('E — Entrer', po.x, po.y - 96);
      ctx.fillStyle = '#fff';
      ctx.fillText('E — Entrer', po.x, po.y - 96);
    }
  }
}

// cratères d'impact : marque brûlée au sol pendant ~10 s (coords monde)
export function drawCraters() {
  for (const c of G.craters || []) {
    const k = c.t / c.maxT; // 1 -> 0
    const fade = c.t < 2 ? c.t / 2 : 1; // disparaît doucement sur les 2 dernières secondes
    ctx.save();
    ctx.globalAlpha = fade;
    // halo de chaleur résiduelle au centre
    const hg = ctx.createRadialGradient(c.x, c.y, c.r * 0.1, c.x, c.y, c.r);
    hg.addColorStop(0, `rgba(255,120,30,${0.3 * k})`);
    hg.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.6, 0, 0, TAU); ctx.fill();
    // fond du cratère : terre calcinée
    ctx.fillStyle = `rgba(30,22,16,${0.85 * fade})`;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * 0.92, c.r * 0.55, 0, 0, TAU); ctx.fill();
    // centre vitrifié plus sombre
    ctx.fillStyle = `rgba(12,8,6,${0.9 * fade})`;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * 0.55, c.r * 0.32, 0, 0, TAU); ctx.fill();
    // liseré de braises encore chaudes
    ctx.strokeStyle = `rgba(255,${Math.round(120 + 80 * k)},40,${0.55 * fade})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * 0.92, c.r * 0.55, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // fissures rayonnantes
    ctx.strokeStyle = `rgba(20,14,10,${0.7 * fade})`; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + c.x * 0.01;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * c.r * 0.5, c.y + Math.sin(a) * c.r * 0.3);
      ctx.lineTo(c.x + Math.cos(a) * c.r * (0.95 + (i % 2) * 0.25), c.y + Math.sin(a) * c.r * (0.58 + (i % 2) * 0.15));
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawFireZones() {
  // zones de feu de la bombe atomique
  for (const z of G.fireZones) {
    const fade = Math.min(1, z.life / 1.5); // s'éteint sur la dernière seconde et demie
    const flick = 0.92 + Math.sin(G.time * 20 + z.x) * 0.08;
    // halo de chaleur
    const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.15, z.x, z.y, z.r);
    g.addColorStop(0, `rgba(255,120,30,${0.5 * fade})`);
    g.addColorStop(0.6, `rgba(255,60,0,${0.28 * fade})`);
    g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r * flick, 0, TAU); ctx.fill();
    // flammes autour
    ctx.fillStyle = `rgba(255,160,50,${0.35 * fade})`;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + G.time * 2;
      const fx = z.x + Math.cos(a) * z.r * 0.55, fy = z.y + Math.sin(a) * z.r * 0.55;
      const fr = z.r * 0.18 * (0.7 + Math.sin(G.time * 8 + i) * 0.3);
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, TAU); ctx.fill();
    }
    // cœur intense
    ctx.fillStyle = `rgba(255,220,120,${0.4 * fade})`;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r * 0.3, 0, TAU); ctx.fill();
  }
}

// Flaques d'acide de la Déluge Acide : mare toxique scintillante
export function drawAcidZones() {
  for (const z of G.acidZones) {
    const fade = Math.min(1, z.life / 2); // résorption en fin de vie
    const w = 0.9 + Math.sin(G.time * 6 + z.x * 0.1) * 0.1;
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.scale(1, 0.62);
    // liseré bouillonnant
    const g = ctx.createRadialGradient(0, 0, z.r * 0.1, 0, 0, z.r * w);
    g.addColorStop(0, `rgba(217,255,106,${0.75 * fade})`);
    g.addColorStop(0.55, `rgba(174,234,0,${0.5 * fade})`);
    g.addColorStop(1, 'rgba(51,105,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, z.r * w, 0, TAU); ctx.fill();
    // bulles de vase
    ctx.fillStyle = `rgba(240,255,150,${0.5 * fade})`;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + G.time * 1.5;
      const br = z.r * (0.2 + ((G.time * 0.7 + i * 0.33) % 0.5));
      ctx.beginPath(); ctx.arc(Math.cos(a) * br, Math.sin(a) * br * 0.62, 2.5 + Math.sin(G.time * 5 + i) * 1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// Trous noirs : puits de gravité avec disque d'accrétion et lentille
export function drawBlackHoles() {
  for (const h of G.blackHoles) {
    const lifeK = Math.min(1, h.life / 1.2); // s'éteint à l'implosion
    const pull = h.pull || 0;
    ctx.save();
    ctx.translate(h.x, h.y);
    // lentille gravitationnelle : halo violet déformé
    const hg = ctx.createRadialGradient(0, 0, h.r * 0.4, 0, 0, h.r * 1.5);
    hg.addColorStop(0, `rgba(123,31,162,${0.55 * lifeK})`);
    hg.addColorStop(0.6, `rgba(92,33,160,${0.28 * lifeK})`);
    hg.addColorStop(1, 'rgba(13,10,31,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, 0, h.r * 1.5, 0, TAU); ctx.fill();
    // disque d'accrétion : anneau incliné qui tourne
    ctx.save();
    ctx.scale(1, 0.42);
    ctx.rotate(G.time * (2 + pull * 3));
    for (let i = 0; i < 14; i++) {
      const a = i * TAU / 14;
      ctx.fillStyle = i % 2 ? `rgba(179,157,219,${0.75 * lifeK})` : `rgba(128,216,255,${0.75 * lifeK})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * h.r * (0.95 + Math.sin(i * 7) * 0.12), Math.sin(a) * h.r * (0.95 + Math.cos(i * 5) * 0.12),
        3.5 + Math.sin(G.time * 6 + i * 2) * 1.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // horizon des événements : noir absolu + anneau photonique
    ctx.fillStyle = '#05030f';
    ctx.beginPath(); ctx.arc(0, 0, h.r * 0.42 * lifeK + 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(227,190,231,${0.9 * lifeK})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, h.r * 0.42 * lifeK + 4, 0, TAU); ctx.stroke();
    // jet polaire
    const jg = ctx.createLinearGradient(0, -h.r * 1.6, 0, 0);
    jg.addColorStop(0, 'rgba(179,157,219,0)'); jg.addColorStop(1, `rgba(179,157,219,${0.4 * lifeK})`);
    ctx.fillStyle = jg;
    ctx.beginPath(); ctx.moveTo(-h.r * 0.12, -h.r * 1.7); ctx.lineTo(h.r * 0.12, -h.r * 1.7); ctx.lineTo(h.r * 0.3, 0); ctx.lineTo(-h.r * 0.3, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// Télégraphe du micro-trou noir des événements spatiaux
export function drawVoidHole() {
  const h = G.voidHole;
  if (!h) return;
  const pulse = 0.5 + Math.sin(G.time * 8) * 0.5;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.strokeStyle = `rgba(179,157,219,${0.4 + pulse * 0.5})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 40 + pulse * 10, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(227,190,231,${0.3 + pulse * 0.4})`;
  ctx.setLineDash([8, 10]);
  ctx.beginPath(); ctx.arc(0, 0, 70 + pulse * 16, G.time * 3, G.time * 3 + TAU * 0.8); ctx.stroke();
  ctx.setLineDash([]);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
  g.addColorStop(0, '#000'); g.addColorStop(0.7, '#1a0033'); g.addColorStop(1, 'rgba(74,20,140,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
  ctx.restore();
}

// Portails d'apparition des monstres (tourbillon violet)
export function drawPortals() {
  for (const po of G.portals) {
    const t = po.life / po.maxLife; // 1 -> 0
    ctx.save();
    ctx.translate(po.x, po.y);
    ctx.scale(1, 0.6); // ellipse au sol
    ctx.globalAlpha = Math.min(1, t * 2.5);
    // halo
    const c = po.color || '#a855f7';
    const g = ctx.createRadialGradient(0, 0, po.r * 0.15, 0, 0, po.r);
    g.addColorStop(0, hexA(c, 0.9));
    g.addColorStop(0.6, hexA(c, 0.55));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, po.r, 0, TAU); ctx.fill();
    // arcs tournants
    ctx.strokeStyle = hexA('#ffffff', 0.15 + t * 0.35);
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a0 = G.time * 5 + i * TAU / 3;
      ctx.beginPath(); ctx.arc(0, 0, po.r * (0.45 + i * 0.2), a0, a0 + 1.7); ctx.stroke();
    }
    ctx.strokeStyle = hexA(c, 0.3 + t * 0.4);
    for (let i = 0; i < 3; i++) {
      const a0 = -G.time * 4 + i * TAU / 3;
      ctx.beginPath(); ctx.arc(0, 0, po.r * (0.6 + i * 0.15), a0, a0 + 1.2); ctx.stroke();
    }
    // cœur blanc-violet
    ctx.fillStyle = `rgba(240,220,255,${0.5 * t})`;
    ctx.beginPath(); ctx.arc(0, 0, po.r * 0.22, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export function drawDrops() {
  for (const d of G.drops) {
    const bob = Math.sin(G.time * 3 + d.x) * 3;
    const fade = d.life !== undefined ? Math.min(1, d.life / 3) : 1; // clignote avant d'expirer
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 8, 9, 4, 0, 0, TAU); ctx.fill();
    // halo + cercle de repère pour bien voir la fiole sur le décor
    ctx.globalAlpha = (0.4 + Math.sin(G.time * 4 + d.x) * 0.18) * fade;
    ctx.fillStyle = '#ff80ab';
    ctx.beginPath(); ctx.arc(d.x, d.y + bob, 18, 0, TAU); ctx.fill();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(d.x, d.y + bob, 10.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ad1457'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(d.x, d.y + bob, 10.5, 0, TAU); ctx.stroke();
    drawFlaskIcon(d.x, d.y + bob, 1.25);
    ctx.globalAlpha = 1;
  }
}

// Projectiles de glace du Boss Givre
export function drawProjectiles() {
  for (const pr of G.projectiles) {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    if (pr.hex) {
      // orbe de sort violet
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.fillStyle = 'rgba(225,190,231,0.3)';
      ctx.beginPath(); ctx.ellipse(-8, 0, 8, 3.5, 0, 0, TAU); ctx.fill();
      const hg = ctx.createRadialGradient(-2, -2, 1, 0, 0, pr.r);
      hg.addColorStop(0, '#f3e5f5'); hg.addColorStop(0.6, '#ab47bc'); hg.addColorStop(1, '#4a148c');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ce93d8'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      continue;
    }
    if (pr.fire) {
      // boule de feu infernale : lueur orange + trainée incandescente
      const fg = ctx.createRadialGradient(-pr.r * 0.2, -pr.r * 0.2, 1, 0, 0, pr.r);
      fg.addColorStop(0, '#fff59d'); fg.addColorStop(0.5, '#ff7043'); fg.addColorStop(1, '#b71c1c');
      ctx.fillStyle = 'rgba(255,120,40,0.35)';
      ctx.beginPath(); ctx.ellipse(-10, 0, 12, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,150,0.9)';
      ctx.beginPath(); ctx.arc(-pr.r * 0.25, -pr.r * 0.25, pr.r * 0.35, 0, TAU); ctx.fill();
      ctx.restore();
      continue;
    }
    if (pr.acid) {
      // bille de vase toxique : orbe vert + trainée acide
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.fillStyle = 'rgba(174,234,0,0.3)';
      ctx.beginPath(); ctx.ellipse(-9, 0, 9, 4, 0, 0, TAU); ctx.fill();
      const ag = ctx.createRadialGradient(-pr.r * 0.2, -pr.r * 0.2, 1, 0, 0, pr.r);
      ag.addColorStop(0, '#f4ff81'); ag.addColorStop(0.55, '#aeea00'); ag.addColorStop(1, '#33691e');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#827717'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      continue;
    }
    if (pr.bolt || pr.voidBolt) {
      // rayon stellaire : orbe violet + traînée nébuleuse
      ctx.rotate(Math.atan2(pr.vy || 1, pr.vx || 0.01));
      ctx.fillStyle = 'rgba(179,157,219,0.35)';
      ctx.beginPath(); ctx.ellipse(-11, 0, 11, 5, 0, 0, TAU); ctx.fill();
      const bg = ctx.createRadialGradient(-pr.r * 0.2, -pr.r * 0.2, 1, 0, 0, pr.r);
      bg.addColorStop(0, '#f3e5f5'); bg.addColorStop(0.55, '#b388ff'); bg.addColorStop(1, '#4a148c');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ce93d8'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.rotate(Math.atan2(pr.vy, pr.vx));
    // traînée
    ctx.fillStyle = 'rgba(179,229,252,0.3)';
    ctx.beginPath(); ctx.ellipse(-10, 0, 10, 4, 0, 0, TAU); ctx.fill();
    // éclat de glace
    const g = ctx.createLinearGradient(-pr.r, 0, pr.r, 0);
    g.addColorStop(0, '#0277bd'); g.addColorStop(0.5, '#e1f5fe'); g.addColorStop(1, '#0288d1');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pr.r, 0); ctx.lineTo(0, -pr.r * 0.7); ctx.lineTo(-pr.r, 0); ctx.lineTo(0, pr.r * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

// Faisceaux de feu du Titan de Feu : lame incandescente + cœur blanc
export function drawLasers() {
  for (const L of G.lasers) {
    const k = Math.max(0, L.life / L.maxLife); // 1 -> 0
    const ex = Math.cos(L.angle), ey = Math.sin(L.angle);
    const flick = 0.85 + Math.sin(G.time * 40) * 0.15;
    const x2 = L.x + ex * L.len, y2 = L.y + ey * L.len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // lueur externe large
    ctx.strokeStyle = `rgba(255,87,34,${0.30 * k * flick})`;
    ctx.lineWidth = L.w * 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(x2, y2); ctx.stroke();
    // corps du faisceau
    ctx.strokeStyle = `rgba(255,140,60,${0.75 * k * flick})`;
    ctx.lineWidth = L.w * 0.7;
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(x2, y2); ctx.stroke();
    // cœur blanc brûlant
    ctx.strokeStyle = `rgba(255,245,220,${0.9 * k})`;
    ctx.lineWidth = L.w * 0.28;
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(x2, y2); ctx.stroke();
    // impact au bout : gerbe de flammes
    if (k > 0.3) {
      const ig = ctx.createRadialGradient(x2, y2, 1, x2, y2, 26 * k);
      ig.addColorStop(0, `rgba(255,220,150,${0.7 * k})`);
      ig.addColorStop(0.5, `rgba(255,110,40,${0.4 * k})`);
      ig.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(x2, y2, 26 * k, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// Mains de feu du Titan de Feu : poing enflammé qui fend l'air en arc
export function drawHands() {
  for (const h of G.hands) {
    const k = Math.min(1, h.t / h.dur);
    const e = k * k * (3 - 2 * k);
    const x = h.sx + (h.tx - h.sx) * e;
    const y = h.sy + (h.ty - h.sy) * e - Math.sin(k * Math.PI) * 70;
    const stretch = 1 + Math.sin(k * Math.PI) * 0.35; // la main s'étire en vol
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(h.ty - h.sy, h.tx - h.sx) + Math.PI / 2);
    ctx.scale(1 / stretch, stretch);
    // lueur
    const lg = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    lg.addColorStop(0, 'rgba(255,180,80,0.55)');
    lg.addColorStop(0.6, 'rgba(255,90,30,0.25)');
    lg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    // paume
    const pg = ctx.createRadialGradient(-4, -5, 2, 0, 0, 20);
    pg.addColorStop(0, '#ffd740'); pg.addColorStop(0.5, '#ff7043'); pg.addColorStop(1, '#bf360c');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.ellipse(0, 4, 15, 17, 0, 0, TAU); ctx.fill();
    // doigts
    for (let i = -1.5; i <= 1.5; i++) {
      ctx.fillStyle = i === 0 ? '#ffe082' : '#ff8a50';
      ctx.beginPath();
      ctx.ellipse(i * 7.5, -13 - Math.abs(i) * -2, 4.6, 8.5, i * 0.18, 0, TAU);
      ctx.fill();
    }
    // pouce
    ctx.fillStyle = '#ffab40';
    ctx.beginPath(); ctx.ellipse(-14, 2, 5, 8, 0.7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,150,0.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 4, 15, 17, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

// Volcans éruptifs créés par les mains de feu : cône de roche + cratère de lave
export function drawVolcanoes() {
  for (const v of G.volcanoes) {
    const k = Math.max(0, v.life / v.maxLife); // 1 -> 0
    const grow = Math.min(1, (v.maxLife - v.life) * 4); // le cône surgit vite
    ctx.save();
    ctx.translate(v.x, v.y);
    // halo de chaleur au sol
    const hg = ctx.createRadialGradient(0, 0, v.r * 0.2, 0, 0, v.r * 1.5);
    hg.addColorStop(0, `rgba(255,110,40,${0.4 * k})`);
    hg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, 0, v.r * 1.5, 0, TAU); ctx.fill();
    // cône volcanique (s'élargit depuis le centre)
    const cw = v.r * grow, ch = v.r * 0.85 * grow;
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.moveTo(-cw, 0);
    ctx.lineTo(-cw * 0.28, -ch);
    ctx.lineTo(cw * 0.28, -ch);
    ctx.lineTo(cw, 0);
    ctx.closePath(); ctx.fill();
    // faces ombrées
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(-cw, 0); ctx.lineTo(-cw * 0.28, -ch); ctx.lineTo(0, 0);
    ctx.closePath(); ctx.fill();
    // cratère : lave qui bouillonne
    const pulse = 0.7 + Math.sin(G.time * 9 + v.x) * 0.3;
    const cg = ctx.createRadialGradient(0, -ch, 1, 0, -ch, cw * 0.3);
    cg.addColorStop(0, `rgba(255,235,140,${0.95 * pulse})`);
    cg.addColorStop(0.5, `rgba(255,110,30,${0.8 * pulse})`);
    cg.addColorStop(1, 'rgba(120,20,5,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, -ch, cw * 0.3, 0, TAU); ctx.fill();
    // fissures de lave sur le cône
    ctx.strokeStyle = `rgba(255,120,40,${0.5 * pulse})`;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cw * 0.22, -ch * 0.15);
      ctx.lineTo(i * cw * 0.4, -ch * 0.55);
      ctx.stroke();
    }
    // fumée sombre au-dessus du cratère
    for (let i = 0; i < 3; i++) {
      const sy = -ch - 14 - i * 16 - (G.time * 14 + i * 9) % 30;
      const sr = cw * (0.16 + i * 0.07);
      ctx.fillStyle = `rgba(60,50,45,${0.30 * k})`;
      ctx.beginPath(); ctx.arc(Math.sin(G.time * 2 + i * 2) * 8, sy, sr, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// Foudre du Boss Foudre : cercle de télégraphe puis bolt
export function drawLightnings() {
  for (const l of G.lightnings) {
    if (!l.struck) {
      // télégraphe : cercle qui rétrécit + croix
      const k = l.t / l.max;
      ctx.globalAlpha = 0.35 + (1 - k) * 0.45;
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(l.x, l.y, 62 * k + 10, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,235,59,0.15)';
      ctx.beginPath(); ctx.arc(l.x, l.y, 62, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l.x - 8, l.y); ctx.lineTo(l.x + 8, l.y);
      ctx.moveTo(l.x, l.y - 8); ctx.lineTo(l.x, l.y + 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // bolt : zigzag vertical lumineux
      const a = Math.min(1, -l.t / 0.18);
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath();
      let bx = l.x, by = l.y - 160;
      ctx.moveTo(bx, by);
      while (by < l.y) {
        bx += (Math.random() - 0.5) * 36;
        by += 22;
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- CASCADES : eau/lave/glace qui dévale (animé, coords monde) ----------
const FALL_COL = {
  plain:  ['#5aa8d8', '#9fd4f0', '#dff2fb'],
  ice:    ['#a8d4f0', '#d8ecfa', '#f0f8ff'],
  hell:   ['#ff5722', '#ff9800', '#ffd54f'],
  sewer:  ['#7cb86a', '#a4d68a', '#d4ecc0'],
  space:  ['#5a8ae0', '#82b1ff', '#cfe4ff'],
  storm:  ['#9fd4f0', '#cfe8f8', '#f4fbff'],
};
export function drawFalls() {
  const w = curWorld();
  if (!w || !w.falls || !w.falls.length) return;
  const cols = FALL_COL[w.def.biome] || FALL_COL.plain;
  const t = G.time;
  for (const f of w.falls) {
    if (f.x < G.camX - 160 || f.x > G.camX + W + 160 || f.y < G.camY - 240 || f.y > G.camY + H + 160) continue;
    const h = f.h, dir = f.flip ? -1 : 1;
    ctx.save();
    ctx.translate(f.x, f.y);
    // falaise rocheuse derrière la chute
    const rockG = ctx.createLinearGradient(-40 * dir, -h - 20, 40 * dir, 10);
    rockG.addColorStop(0, 'rgba(0,0,0,0.45)'); rockG.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = rockG;
    ctx.beginPath();
    ctx.moveTo(-46 * dir, 8); ctx.lineTo(-30 * dir, -h - 14); ctx.lineTo(30 * dir, -h - 10); ctx.lineTo(46 * dir, 6);
    ctx.closePath(); ctx.fill();
    // lame d'eau : dégradé + streaks animés
    const wg = ctx.createLinearGradient(0, -h - 12, 0, 8);
    wg.addColorStop(0, cols[0]); wg.addColorStop(0.6, cols[1]); wg.addColorStop(1, cols[2]);
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(-12 * dir, -h - 10); ctx.quadraticCurveTo(-16 * dir, -h / 2, -10 * dir, 4);
    ctx.lineTo(10 * dir, 4); ctx.quadraticCurveTo(16 * dir, -h / 2, 12 * dir, -h - 10);
    ctx.closePath(); ctx.fill();
    // filet brillant central
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-3 * dir, -h - 8); ctx.quadraticCurveTo(-5 * dir, -h / 2, -2 * dir, 2);
    ctx.stroke();
    // gouttelettes qui tombent
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 6; i++) {
      const sp = (t * (60 + i * 22) + i * 47) % h;
      const dx = Math.sin(i * 3.7 + t) * 6 * dir;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8 + i);
      ctx.beginPath(); ctx.ellipse(dx, -sp, 1.6, 3.4, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // embruns à la base
    const mistA = 0.25 + Math.sin(t * 2.5 + f.seed * 30) * 0.1;
    const mg = ctx.createRadialGradient(0, 6, 2, 0, 6, 30);
    mg.addColorStop(0, `rgba(255,255,255,${mistA})`); mg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.ellipse(0, 6, 30, 10, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---------- COLOR GRADING : voile teinté par biome (coordonnées écran) ----------
const GRADE = {
  plain:  ['rgba(255,230,150,0.16)', 'rgba(60,100,30,0.14)'],
  ice:    ['rgba(185,225,255,0.18)', 'rgba(60,125,180,0.14)'],
  hell:   ['rgba(255,120,50,0.15)',  'rgba(130,25,8,0.18)'],
  sewer:  ['rgba(140,205,110,0.11)', 'rgba(10,30,10,0.20)'],
  space:  ['rgba(150,115,255,0.17)', 'rgba(10,10,55,0.20)'],
  storm:  ['rgba(170,215,245,0.16)', 'rgba(50,80,110,0.16)'],
};
export function drawBiomeGrade() {
  const w = curWorld();
  if (!w || G.state === 'menu') return;
  const g = GRADE[w.def.biome];
  if (!g) return;
  const lg = ctx.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, g[0]); lg.addColorStop(1, g[1]);
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);
  // halo chaud central pour la profondeur
  const rg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.9);
  rg.addColorStop(0, 'rgba(255,255,255,0.05)'); rg.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
}

// ---------- OMBRES DE NUAGES : gigantesques nappes d'ombre dérivant sur le monde ----------
export function drawCloudShadows() {
  const w = curWorld();
  if (!w || G.state === 'menu') return;
  const t = G.time;
  const sky = w.def.biome;
  const n = sky === 'space' ? 3 : 5;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const spanX = W + 900, spanY = H + 700;
    const speed = 9 + (i % 3) * 5;
    const mx = ((i * 613 + t * speed) % spanX) - 450;
    const my = ((i * 389 + t * speed * 0.35) % spanY) - 350 + Math.sin(t * 0.1 + i * 2) * 60;
    const mr = 260 + (i % 3) * 130;
    // forme irrégulière : 3 ellipses fusionnées par nuage
    for (let k = 0; k < 3; k++) {
      const ox = (k - 1) * mr * 0.75, oy = (k % 2 ? 30 : -25) + Math.sin(t * 0.2 + i + k) * 15;
      const ex = mr * (1.15 - k * 0.15), ey = mr * 0.42;
      const cg = ctx.createRadialGradient(mx + ox, my + oy, mr * 0.15, mx + ox, my + oy, ex);
      const a = sky === 'space' ? 0.14 : sky === 'hell' ? 0.10 : 0.12;
      cg.addColorStop(0, `rgba(8,10,25,${a})`);
      cg.addColorStop(0.7, `rgba(8,10,25,${a * 0.5})`);
      cg.addColorStop(1, 'rgba(8,10,25,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.ellipse(mx + ox, my + oy, ex, ey, (i * 0.7 + k * 0.4) % 0.6 - 0.3, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- AMBIANCE PAR BIOME : particules d'ambiance dans le monde ----------
// Positions calculées procéduralement (aucune allocation par frame).
// Chaque biome a son propre climat : feuilles, neige, braises, spores, poussière cosmique.
const AMB = {
  plain:  { n: 55, col: ['rgba(180,220,120,', 'rgba(255,200,120,', 'rgba(150,190,255,'], spd: [14, 30], size: [1, 2.4], mode: 'leaf' },
  ice:    { n: 85, col: ['rgba(255,255,255,', 'rgba(200,230,250,'],       spd: [30, 60], size: [1, 2.6], mode: 'snow' },
  hell:   { n: 65, col: ['rgba(255,140,50,', 'rgba(255,210,90,', 'rgba(255,80,30,'], spd: [12, 34], size: [1.2, 2.8], mode: 'ember' },
  sewer:  { n: 60, col: ['rgba(170,255,120,', 'rgba(140,230,160,'],       spd: [6, 18],  size: [1, 2.2], mode: 'spore' },
  space:  { n: 72, col: ['rgba(140,200,255,', 'rgba(220,140,255,', 'rgba(160,255,220,'], spd: [8, 26], size: [1, 2.4], mode: 'mote' },
  storm:  { n: 80, col: ['rgba(220,240,255,', 'rgba(160,205,235,'],       spd: [60, 110], size: [1, 2.2], mode: 'gust' },
};
export function drawAmbient() {
  const w = curWorld();
  if (!w || G.state === 'menu') return;
  const cfg = AMB[w.def.biome] || AMB.plain;
  const cx = G.camX || 0, cy = G.camY || 0;
  const t = G.time;
  for (let i = 0; i < cfg.n; i++) {
    // grille déterministe : chaque particule a une cellule qui défile
    const cell = 140;
    const gx = (i * 197 + ((i * 31) % 7) * 53) % Math.ceil((W + 280) / cell);
    const gy = (i * 149 + ((i * 17) % 5) * 47) % Math.ceil((H + 280) / cell);
    const seed = i * 0.6180339;
    let px = cx - 140 + gx * cell + (seed * 97 % cell);
    let py = cy - 140 + gy * cell + (seed * 89 % cell);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (1.2 + (i % 4) * 0.4) + i));
    if (cfg.mode === 'snow' || cfg.mode === 'leaf' || cfg.mode === 'spore' || cfg.mode === 'gust') {
      // chute douce + balayage latéral ; 'gust' = embruns horizontaux très rapides
      if (cfg.mode === 'gust') {
        px += (t * cfg.spd[1] * (0.8 + (i % 3) * 0.3)) % (W + 280);
        py += Math.sin(t * 1.4 + i * 1.9) * 46;
        if (px > cx + W + 140) px -= W + 280;
      } else {
        py += (t * cfg.spd[1] * (0.6 + (i % 3) * 0.3)) % (H + 280);
        px += Math.sin(t * 0.9 + i * 2.3) * (cfg.mode === 'snow' ? 26 : 12);
        if (py > cy + H + 140) py -= H + 280;
      }
    } else if (cfg.mode === 'ember') {
      // braises : remontent en vacillant
      py -= (t * cfg.spd[1] * (0.7 + (i % 3) * 0.25)) % (H + 280);
      px += Math.sin(t * 2.2 + i * 3.1) * 18;
      if (py < cy - 140) py += H + 280;
    } else {
      // motes cosmiques : dérive lente + scintillement
      px += Math.sin(t * 0.4 + i * 1.7) * 30;
      py += Math.cos(t * 0.33 + i * 2.1) * 24;
    }
    if (px < cx - 140) px += W + 280; else if (px > cx + W + 140) px -= W + 280;
    const size = cfg.size[0] + (i % 3) * (cfg.size[1] - cfg.size[0]) / 2;
    ctx.globalAlpha = tw * (cfg.mode === 'ember' ? 0.8 : 0.65);
    ctx.fillStyle = cfg.col[i % cfg.col.length] + (cfg.mode === 'mote' ? '1)' : '0.85)');
    if (cfg.mode === 'leaf') {
      // feuilles/pétales : petites ellipses tournées
      ctx.save(); ctx.translate(px, py); ctx.rotate(t * 1.5 + i);
      ctx.beginPath(); ctx.ellipse(0, 0, size * 1.6, size * 0.7, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(px, py, size, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // ---- couches d'ambiance par biome (brumes, aurores, fumée) ----
  const sky = w.def.biome;
  if (sky === 'sewer' || sky === 'plain' || sky === 'ice') {
    // brume basse dérivante : grandes nappes douces qui glissent
    const mistCol = sky === 'sewer' ? 'rgba(140,200,110,' : sky === 'ice' ? 'rgba(230,242,252,' : 'rgba(255,240,200,';
    const nM = sky === 'sewer' ? 7 : 5;
    for (let i = 0; i < nM; i++) {
      const span = W + 500;
      const mx = cx - 250 + ((i * 373 + t * (6 + i * 3)) % span);
      const my = cy + (i * 211 % (H + 200)) - 100 + Math.sin(t * 0.4 + i * 2) * 30;
      const mr = 130 + (i % 3) * 60;
      const a = sky === 'sewer' ? 0.05 : sky === 'ice' ? 0.07 : 0.045;
      const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr);
      mg.addColorStop(0, mistCol + a + ')'); mg.addColorStop(1, mistCol + '0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.ellipse(mx, my, mr * 1.6, mr * 0.55, 0, 0, TAU); ctx.fill();
    }
  } else if (sky === 'space') {
    // aurores cosmiques : rubans ondulants violet/cyan en haut de la zone visible
    const aurCols = ['rgba(177,140,255,', 'rgba(80,200,255,', 'rgba(255,120,220,'];
    for (let b = 0; b < 3; b++) {
      const yBase = cy - 60 + b * 90 + Math.sin(t * 0.3 + b * 2) * 25;
      ctx.beginPath();
      for (let x = cx - 100; x <= cx + W + 100; x += 60) {
        const yy = yBase + Math.sin(x * 0.006 + t * (0.5 + b * 0.2) + b * 2.5) * (26 + b * 14);
        x === cx - 100 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      for (let x = cx + W + 100; x >= cx - 100; x -= 60) {
        const yy = yBase + 34 + Math.sin(x * 0.006 + t * (0.5 + b * 0.2) + b * 2.5) * (26 + b * 14);
        ctx.lineTo(x, yy);
      }
      ctx.closePath();
      const ag = ctx.createLinearGradient(0, yBase - 40, 0, yBase + 80);
      ag.addColorStop(0, aurCols[b] + '0.14)'); ag.addColorStop(0.5, aurCols[b] + '0.05)'); ag.addColorStop(1, aurCols[b] + '0)');
      ctx.fillStyle = ag;
      ctx.fill();
    }
  } else if (sky === 'hell') {
    // colonnes de fumée : nappes sombres qui montent des fissures
    for (let i = 0; i < 6; i++) {
      const span = W + 400;
      const mx = cx - 200 + ((i * 431 + t * (10 + i * 4)) % span);
      const rise = (t * (22 + i * 6)) % (H + 300);
      const my = cy + H + 100 - rise;
      const mr = 60 + (i % 3) * 35 + rise * 0.15;
      const a = Math.max(0, 0.09 - rise * 0.0002);
      const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr);
      mg.addColorStop(0, `rgba(90,70,60,${a})`); mg.addColorStop(1, 'rgba(90,70,60,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    }
  } else if (sky === 'plain' || sky === 'ice') {
    // rafales de vent : traînées horizontales rapides et fugaces
    const windCol = sky === 'ice' ? 'rgba(240,248,255,' : 'rgba(255,250,230,';
    for (let i = 0; i < 5; i++) {
      const span = W + 600;
      const wx = cx - 300 + ((i * 467 + t * (140 + i * 30)) % span);
      const wy = cy + (i * 173 % H) + Math.sin(t * 2 + i) * 20;
      const wl = 50 + (i % 3) * 35;
      const a = 0.05 + 0.04 * Math.sin(t * 3 + i * 2);
      ctx.strokeStyle = windCol + a + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + wl * 0.5, wy - 4, wx + wl, wy);
      ctx.stroke();
    }
  } else if (sky === 'storm') {
    // nappes de nuages orageux qui défilent + spirales lointaines + éclairs ambiants
    const cxp = cx - 300, span = W + 600;
    for (let i = 0; i < 7; i++) {
      const mx = cxp + ((i * 331 + t * (46 + i * 9)) % span);
      const my = cy + 40 + (i * 137 % Math.max(120, H * 0.5)) + Math.sin(t * 0.5 + i * 1.7) * 22;
      const mr = 150 + (i % 3) * 80;
      const a = 0.06 + 0.03 * Math.sin(t * 0.8 + i * 2.4);
      const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr);
      mg.addColorStop(0, `rgba(120,145,175,${a})`); mg.addColorStop(1, 'rgba(120,145,175,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.ellipse(mx, my, mr * 1.5, mr * 0.6, 0, 0, TAU); ctx.fill();
    }
    // tornades lointaines : colonnes de débris en rotation au fond
    for (let i = 0; i < 2; i++) {
      const tx = cxp + ((i * 997 + 400 + t * 9) % span);
      const ty = cy + H * 0.62 + i * 60 + Math.sin(t + i * 4) * 14;
      const tr = 46 + i * 12;
      ctx.save();
      ctx.translate(tx, ty); ctx.rotate(Math.sin(t * 0.7 + i) * 0.06);
      const tg = ctx.createLinearGradient(0, -tr * 2.6, 0, 0);
      tg.addColorStop(0, 'rgba(180,215,240,0)'); tg.addColorStop(0.55, 'rgba(190,220,245,0.20)'); tg.addColorStop(1, 'rgba(220,240,255,0.34)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(-tr * 0.4, -tr * 2.6);
      ctx.quadraticCurveTo(-tr * 0.55, -tr * 1.2, -tr * 0.7, 0);
      ctx.quadraticCurveTo(0, tr * 0.5, tr * 0.7, 0);
      ctx.quadraticCurveTo(tr * 0.55, -tr * 1.2, tr * 0.4, -tr * 2.6);
      ctx.closePath(); ctx.fill();
      // spirale interne
      ctx.strokeStyle = 'rgba(240,250,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s < 26; s++) {
        const a2 = s * 0.55 + t * (5 + i);
        const rr2 = tr * (0.15 + s * 0.022);
        const yy = -rr2 * 0.9;
        const xx = Math.cos(a2) * rr2 * 0.55;
        s === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.restore();
    }
    // éclairs ambiants : flash bref aléatoire dans le ciel visible
    const fl = Math.sin(t * 0.23) * Math.sin(t * 1.71 + 2);
    if (fl > 0.985) {
      ctx.fillStyle = `rgba(230,240,255,${(fl - 0.985) * 9})`;
      ctx.fillRect(cx - 100, cy - 100, W + 200, H * 0.6);
    }
  }
}

// ---------- zones de vent + tornade d'événement (coords monde) ----------
export function drawWindZones() {
  const w = curWorld();
  if (!w || w.def.biome !== 'storm' || G.state === 'menu') return;
  const t = G.time;
  for (const zn of w.windZones || []) {
    const cx0 = zn.x, cy0 = zn.y;
    const len = Math.hypot(zn.dx, zn.dy);
    const ux = zn.dx / len, uy = zn.dy / len;
    const pulse = 0.7 + 0.3 * Math.sin(t * 2.2 + zn.ph);
    // voile turbulent
    ctx.fillStyle = 'rgba(150,200,240,0.05)';
    ctx.beginPath(); ctx.ellipse(cx0, cy0, zn.r * 1.05, zn.r * 0.62, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(170,215,250,0.14)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 60 * zn.str * pulse;
    ctx.beginPath(); ctx.ellipse(cx0, cy0, zn.r * 1.05, zn.r * 0.62, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // filets de vent dans le sens du courant
    for (let i = 0; i < 7; i++) {
      const off = ((i * 97 + t * 220 * zn.str * pulse) % (zn.r * 2.2)) - zn.r * 1.1;
      const px0 = cx0 + ux * off - uy * (zn.r * 0.36) * (i % 2 ? 1 : -1) * 0.5;
      const py0 = cy0 + uy * off + ux * (zn.r * 0.36) * (i % 2 ? 1 : -1) * 0.5;
      const a = 0.12 + 0.1 * Math.sin(t * 4 + i * 2);
      ctx.strokeStyle = `rgba(220,240,255,${a})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px0 - ux * 26, py0 - uy * 26);
      ctx.quadraticCurveTo(px0, py0 - 8, px0 + ux * 26, py0 + uy * 26);
      ctx.stroke();
    }
    // flèches de direction aux extrémités
    ctx.fillStyle = `rgba(200,230,255,${0.3 + 0.15 * Math.sin(t * 3)})`;
    for (const s of [-1, 1]) {
      const ax = cx0 + ux * s * zn.r * 0.85, ay = cy0 + uy * s * zn.r * 0.85;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(uy, ux));
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-4, -6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

export function drawStormTornado() {
  const tn = G.stormTornado;
  if (!tn || G.state === 'menu') return;
  const t = G.time, lifeF = Math.min(1, tn.life / 1.2) * Math.min(1, (6.5 - tn.life + 0.5) / 0.5);
  ctx.save();
  ctx.translate(tn.x, tn.y);
  ctx.globalAlpha = Math.max(0, Math.min(1, lifeF));
  // colonne de débris : cône étroit en haut, large en bas
  for (let layer = 0; layer < 4; layer++) {
    const f = layer / 4;
    const rr = tn.r * (0.35 + f * 1.1);
    const yy = -rr * 3.4 * (1 - f * 0.55);
    const hgt = rr * 3.6;
    ctx.fillStyle = `rgba(${180 + f * 40},${215 + f * 30},${240 + f * 15},${0.16 - f * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(-rr * 0.32, yy);
    ctx.quadraticCurveTo(-rr * 0.5, yy + hgt * 0.5, -rr * 0.85, yy + hgt);
    ctx.quadraticCurveTo(0, yy + hgt * 1.15, rr * 0.85, yy + hgt);
    ctx.quadraticCurveTo(rr * 0.5, yy + hgt * 0.5, rr * 0.32, yy);
    ctx.closePath(); ctx.fill();
  }
  // spirale de débris
  ctx.strokeStyle = 'rgba(240,250,255,0.65)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let s = 0; s < 40; s++) {
    const a2 = s * 0.5 + t * 7;
    const rr2 = tn.r * (0.2 + s * 0.02);
    const xx = Math.cos(a2) * rr2 * 0.6, yy = -rr2 * 0.8 + s * 2.4;
    s === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  // débris sombres orbitant
  for (let i = 0; i < 8; i++) {
    const a3 = t * 6 + i * 0.8, rr3 = tn.r * (0.5 + (i % 3) * 0.2);
    ctx.fillStyle = 'rgba(90,120,145,0.55)';
    ctx.fillRect(Math.cos(a3) * rr3 * 0.6 - 2, Math.sin(a3) * rr3 * 0.35 - rr3 * 0.55 - 2, 4, 4);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawEffects() {
  for (const r of G.rings) {
    ctx.globalAlpha = r.life / r.maxLife;
    ctx.strokeStyle = r.color; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = (r.life / r.maxLife) * 0.4;
    ctx.fillStyle = r.color;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.9, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center';
  for (const t of G.damageTexts) {
    ctx.globalAlpha = Math.min(1, t.life / (t.maxLife * 0.5));
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1;
  }
}