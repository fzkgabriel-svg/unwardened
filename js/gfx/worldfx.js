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

// ---------- AMBIANCE PAR BIOME : particules d'ambiance dans le monde ----------
// Positions calculées procéduralement (aucune allocation par frame).
// Chaque biome a son propre climat : feuilles, neige, braises, spores, poussière cosmique.
const AMB = {
  plain:  { n: 34, col: ['rgba(180,220,120,', 'rgba(255,200,120,', 'rgba(150,190,255,'], spd: [14, 30], size: [1, 2.4], mode: 'leaf' },
  ice:    { n: 55, col: ['rgba(255,255,255,', 'rgba(200,230,250,'],       spd: [30, 60], size: [1, 2.6], mode: 'snow' },
  hell:   { n: 42, col: ['rgba(255,140,50,', 'rgba(255,210,90,', 'rgba(255,80,30,'], spd: [12, 34], size: [1.2, 2.8], mode: 'ember' },
  sewer:  { n: 38, col: ['rgba(170,255,120,', 'rgba(140,230,160,'],       spd: [6, 18],  size: [1, 2.2], mode: 'spore' },
  space:  { n: 46, col: ['rgba(140,200,255,', 'rgba(220,140,255,', 'rgba(160,255,220,'], spd: [8, 26], size: [1, 2.4], mode: 'mote' },
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
    if (cfg.mode === 'snow' || cfg.mode === 'leaf' || cfg.mode === 'spore') {
      // chute douce + balayage latéral
      py += (t * cfg.spd[1] * (0.6 + (i % 3) * 0.3)) % (H + 280);
      px += Math.sin(t * 0.9 + i * 2.3) * (cfg.mode === 'snow' ? 26 : 12);
      if (py > cy + H + 140) py -= H + 280;
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
  }
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