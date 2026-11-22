import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';

// ---------- BÂTIMENTS ----------
export function drawBuildings() {
  const w = curWorld();
  if (!w) return;
  const x0 = G.camX - 140, y0 = G.camY - 140, x1 = G.camX + W + 140, y1 = G.camY + H + 140;
  for (const b of w.buildings) {
    if (b.x + b.w / 2 < x0 || b.x - b.w / 2 > x1 || b.y + b.h / 2 < y0 || b.y - b.h / 2 > y1) continue;
    drawBuilding(b, w.def);
    // invite d'interaction au-dessus du bâtiment
    if (!b.looted) {
      const d = Math.hypot(G.player.x - b.x, G.player.y - b.y) - Math.max(b.w, b.h) * 0.5;
      if (d < CONFIG.interactDist) {
        ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'center';
        const label = `E — Fouiller : ${b.def.name}`;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(label, b.x, b.y - b.h / 2 - 18);
        ctx.fillStyle = '#ffd740';
        ctx.fillText(label, b.x, b.y - b.h / 2 - 18);
      }
    }
  }
}

function drawBuilding(b, def) {
  const hw = b.def.w / 2, hh = b.def.h / 2; // dims d'origine, la rotation est gérée par ctx.rotate
  // ombre portée
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(b.x, b.y + hh * 0.85, hw * 1.05, hh * 0.32, 0, 0, TAU); ctx.fill();

  ctx.save();
  ctx.translate(b.x, b.y); ctx.rotate(b.rot);
  // murs
  const mg = ctx.createLinearGradient(0, -hh, 0, hh);
  mg.addColorStop(0, def.wall); mg.addColorStop(1, def.wallDark);
  ctx.fillStyle = mg;
  ctx.fillRect(-hw, -hh, b.def.w, b.def.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
  ctx.strokeRect(-hw, -hh, b.def.w, b.def.h);

  const W2 = b.def.w, H2 = b.def.h;
  const doorW = Math.min(26, W2 * 0.18), doorH = Math.min(34, H2 * 0.45);
  const win = (wx, wy, ww, wh) => {
    ctx.fillStyle = def.window;
    ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(wx - ww / 2, wy - wh / 2, ww, wh);
    ctx.beginPath(); ctx.moveTo(wx, wy - wh / 2); ctx.lineTo(wx, wy + wh / 2); ctx.stroke();
  };
  const door = (dx) => {
    ctx.fillStyle = def.door;
    ctx.fillRect(dx - doorW / 2, H2 / 2 - doorH, doorW, doorH);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(dx - doorW / 2, H2 / 2 - doorH, doorW, doorH);
    ctx.fillStyle = '#ffd740';
    ctx.beginPath(); ctx.arc(dx + doorW / 2 - 5, H2 / 2 - doorH / 2, 1.8, 0, TAU); ctx.fill();
  };
  const gable = (roofC) => {
    ctx.fillStyle = roofC;
    ctx.beginPath();
    ctx.moveTo(-hw - 8, -hh); ctx.lineTo(0, -hh - H2 * 0.45); ctx.lineTo(hw + 8, -hh);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  };

  switch (b.def.drawAs || b.type) {
    case 'cabin':
      gable(def.roof);
      door(0); win(-hw * 0.45, -hh * 0.35, 16, 14);
      // cheminée
      ctx.fillStyle = def.wallDark; ctx.fillRect(hw * 0.4, -hh - H2 * 0.3, 12, 22);
      break;
    case 'house':
      gable(def.roofAlt);
      door(0); win(-hw * 0.45, -hh * 0.35, 18, 16); win(hw * 0.45, -hh * 0.35, 18, 16);
      win(-hw * 0.3, hh * 0.15, 16, 14); win(hw * 0.3, hh * 0.15, 16, 14);
      break;
    case 'ruins': {
      // murs brisés sans toit + gravats
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-hw, -hh, W2, 8);
      ctx.fillRect(-hw, hh - 8, W2, 8);
      ctx.fillRect(-hw, -hh, 8, H2);
      ctx.fillRect(hw - 8, -hh + 14, 8, H2 - 14);
      ctx.fillStyle = def.wallDark;
      for (let i = 0; i < 7; i++) {
        const rx = -hw + 14 + i * (W2 - 28) / 6;
        ctx.fillRect(rx - 5, -hh + (i % 2) * 6, 10, 10 + (i % 3) * 5);
      }
      break;
    }
    case 'warehouse':
      // toit plat + grande porte de chargement
      ctx.fillStyle = def.roof;
      ctx.fillRect(-hw - 6, -hh - 10, W2 + 12, 14);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(-hw - 6, -hh - 10, W2 + 12, 14);
      ctx.fillStyle = def.door;
      ctx.fillRect(-W2 * 0.28, H2 / 2 - 44, W2 * 0.56, 44);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(-W2 * 0.28 + (W2 * 0.56 / 5) * i, H2 / 2 - 44); ctx.lineTo(-W2 * 0.28 + (W2 * 0.56 / 5) * i, H2 / 2); ctx.stroke();
      }
      win(-hw * 0.6, -hh * 0.3, 18, 14); win(hw * 0.6, -hh * 0.3, 18, 14);
      break;
    case 'factory':
      // toit + cheminées + ligne de production
      ctx.fillStyle = def.roof;
      ctx.fillRect(-hw - 8, -hh - 8, W2 + 16, 12);
      ctx.fillStyle = def.wallDark;
      ctx.fillRect(-hw * 0.55, -hh - 46, 16, 46);
      ctx.fillRect(hw * 0.2, -hh - 38, 14, 38);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(-hw * 0.55 + 8, -hh - 48, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(hw * 0.2 + 7, -hh - 40, 4, 0, TAU); ctx.fill();
      door(0); win(-hw * 0.55, hh * 0.1, 16, 14); win(hw * 0.55, hh * 0.1, 16, 14);
      break;
    case 'gas':
      // auvent sur piliers + petit corps de garde
      ctx.fillStyle = def.roof;
      ctx.fillRect(-hw - 10, -hh - 30, W2 + 20, 12);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(-hw - 10, -hh - 30, W2 + 20, 12);
      ctx.fillStyle = def.wallDark;
      for (const px of [-hw * 0.8, -hw * 0.27, hw * 0.27, hw * 0.8]) ctx.fillRect(px - 4, -hh - 18, 8, H2 - 12);
      // corps de garde
      ctx.fillStyle = mg;
      ctx.fillRect(hw * 0.35, -hh * 0.1, W2 * 0.3, H2 * 0.6);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(hw * 0.35, -hh * 0.1, W2 * 0.3, H2 * 0.6);
      win(hw * 0.5, -hh * 0.05, 14, 12);
      break;
    case 'shrine': {
      // temple en ruine : plateforme + colonnes + cristal central
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.95, hh * 0.95, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = def.wallDark;
      ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.8, hh * 0.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = def.wall;
      ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.68, hh * 0.68, 0, 0, TAU); ctx.fill();
      // colonnes
      ctx.fillStyle = def.wallDark;
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        const cx = Math.cos(a) * hw * 0.55, cy = Math.sin(a) * hh * 0.55;
        ctx.fillRect(cx - 4, cy - 12, 8, 24);
      }
      // cristal central flottant
      const pulse = 1 + Math.sin(G.time * 2.4) * 0.12;
      ctx.save();
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(224,64,251,0.9)';
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(8, 0); ctx.lineTo(0, 20); ctx.lineTo(-8, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(3, 0); ctx.lineTo(0, 8); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'castle': {
      // CHÂTEAU : donjon central + 4 tours d'angle à créneaux, toits coniques.
      // Biome glace : calottes de neige · Biome enfer : toits de braise
      const hell = def.biome === 'hell';
      const capCol = hell ? '#3a1512' : '#eceff1';      // calotte (braise / neige)
      const winCol = hell ? '#ff7043' : '#b3e5fc';      // vitrail (feu / glace)
      const trimCol = hell ? '#ff5252' : '#e53935';     // fanion
      const tower = (tx, ty, tr) => {
        // corps de tour
        const tg = ctx.createLinearGradient(tx - tr, ty, tx + tr, ty);
        tg.addColorStop(0, def.wallDark); tg.addColorStop(0.5, def.wall); tg.addColorStop(1, def.wallDark);
        ctx.fillStyle = tg;
        ctx.beginPath(); ctx.arc(tx, ty, tr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; ctx.stroke();
        // créneaux
        ctx.fillStyle = def.wallDark;
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8;
          ctx.save(); ctx.translate(tx + Math.cos(a) * tr * 0.92, ty + Math.sin(a) * tr * 0.92); ctx.rotate(a + Math.PI / 2);
          ctx.fillRect(-3, -7, 6, 10); ctx.restore();
        }
        // toit conique enneigé
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath(); ctx.moveTo(tx, ty - tr * 2.1); ctx.lineTo(tx + tr * 1.05, ty - tr * 0.55); ctx.lineTo(tx - tr * 1.05, ty - tr * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = capCol; // calotte (neige ou braise)
        ctx.beginPath(); ctx.moveTo(tx, ty - tr * 2.1); ctx.lineTo(tx + tr * 0.55, ty - tr * 1.35); ctx.lineTo(tx - tr * 0.55, ty - tr * 1.35); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx + tr * 1.05, ty - tr * 0.55); ctx.lineTo(tx + tr * 0.5, ty - tr * 0.75); ctx.lineTo(tx + tr * 0.95, ty - tr * 0.42); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx - tr * 1.05, ty - tr * 0.55); ctx.lineTo(tx - tr * 0.5, ty - tr * 0.75); ctx.lineTo(tx - tr * 0.95, ty - tr * 0.42); ctx.closePath(); ctx.fill();
        // drapeau
        ctx.strokeStyle = '#78909c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tx, ty - tr * 2.1); ctx.lineTo(tx, ty - tr * 2.9); ctx.stroke();
        ctx.fillStyle = trimCol;
        ctx.beginPath(); ctx.moveTo(tx, ty - tr * 2.9); ctx.lineTo(tx + 11, ty - tr * 2.75); ctx.lineTo(tx, ty - tr * 2.6); ctx.closePath(); ctx.fill();
      };
      // tours d'angle (au-delà des murs pour la profondeur)
      const tr = Math.min(hw, hh) * 0.42;
      tower(-hw + tr * 0.9, -hh + tr * 0.9, tr);
      tower(hw - tr * 0.9, -hh + tr * 0.9, tr);
      tower(-hw + tr * 0.9, hh - tr * 0.9, tr);
      tower(hw - tr * 0.9, hh - tr * 0.9, tr);
      // créneaux du donjon (haut du mur)
      ctx.fillStyle = def.wallDark;
      for (let i = -4; i <= 4; i++) ctx.fillRect(i * 16 - 5, -hh - 8, 10, 9);
      ctx.fillStyle = capCol; // calotte sur les créneaux
      for (let i = -4; i <= 4; i++) ctx.fillRect(i * 16 - 5, -hh - 8, 10, 3);
      // grandes fenêtres gothiques en ogive + vitrail
      const gwin = (wx, wy, ww, wh) => {
        ctx.fillStyle = winCol;
        ctx.beginPath();
        ctx.moveTo(wx - ww / 2, wy + wh / 2); ctx.lineTo(wx - ww / 2, wy - wh * 0.1);
        ctx.quadraticCurveTo(wx, wy - wh / 2 - 6, wx + ww / 2, wy - wh * 0.1);
        ctx.lineTo(wx + ww / 2, wy + wh / 2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wx, wy - wh / 2 - 4); ctx.lineTo(wx, wy + wh / 2); ctx.stroke();
      };
      gwin(-hw * 0.42, -hh * 0.3, 20, 44); gwin(hw * 0.42, -hh * 0.3, 20, 44);
      gwin(-hw * 0.42, hh * 0.25, 20, 40); gwin(hw * 0.42, hh * 0.25, 20, 40);
      gwin(0, -hh * 0.62, 26, 52); // rosace au-dessus de la porte
      // porte fortifiée : double vantail + herse
      const dw2 = Math.min(40, W2 * 0.14);
      ctx.fillStyle = def.door;
      ctx.fillRect(-dw2 / 2, H2 / 2 - 56, dw2, 56);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
      ctx.strokeRect(-dw2 / 2, H2 / 2 - 56, dw2, 56);
      ctx.beginPath(); ctx.moveTo(0, H2 / 2 - 56); ctx.lineTo(0, H2 / 2); ctx.stroke();
      // herse (grille)
      ctx.strokeStyle = 'rgba(189,195,199,0.8)'; ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(i * 6, H2 / 2 - 56); ctx.lineTo(i * 6, H2 / 2 - 26); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-dw2 / 2, H2 / 2 - 44); ctx.lineTo(dw2 / 2, H2 / 2 - 44); ctx.stroke();
      // marches devant la porte
      ctx.fillStyle = capCol;
      ctx.beginPath(); ctx.ellipse(0, H2 / 2 + 6, dw2 * 1.1, 9, 0, 0, TAU); ctx.fill();
      break;
    }
  }

  // fanion de rareté sur le toit
  if (b.def.rarity !== 'commun') {
    const rc = RARITY_COLOR[b.def.rarity];
    ctx.strokeStyle = rc; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(0, -hh - 22); ctx.stroke();
    ctx.fillStyle = rc;
    ctx.beginPath();
    ctx.moveTo(0, -hh - 22); ctx.lineTo(16, -hh - 17); ctx.lineTo(0, -hh - 12);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // déjà pillé : petite marque au sol
  if (b.looted) {
    ctx.fillStyle = 'rgba(105,240,174,0.5)';
    ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('✓', b.x, b.y + 4);
  }
}
