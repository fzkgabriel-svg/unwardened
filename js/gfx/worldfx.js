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
      ctx.font = 'bold 12px Segoe UI';
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
    ctx.font = 'bold 15px Segoe UI';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1;
  }
}