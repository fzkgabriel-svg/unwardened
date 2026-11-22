// js/hud/equip.js — panneau équipement latéral droit : cadre cuir/or,
// lignes parchemin, icônes d'objets, barres de durabilité.
import { G, ctx, W } from '../state.js';
import { roundRect } from '../utils.js';
import { ITEMS, getDur } from '../inventory.js';
import { drawItemIcon } from '../utils.js';
import { HPAL, metalFrame, parchment, engraved } from './frame.js';

export function drawEquipPanel() {
  const inv = G.inv;
  if (!inv || !inv.equip) return;
  const slots = [['weapon', 'ARME'], ['armor', 'ARMURE'], ['charm', 'TALISMAN'], ['boots', 'BOTTES']];
  const px = W - 182, py = 66, pw = 168;
  const rowH = 46, headerH = 26;
  const ph = headerH + slots.length * rowH + 10;

  // cadre principal cuir + liseré or
  metalFrame(px, py, pw, ph, 9, {});
  // en-tête parchemin
  parchment(px + 5, py + 4, pw - 10, headerH - 6, 0.95);
  engraved('ÉQUIPEMENT', px + pw / 2, py + 21, 11, '#4a3517', 'center', 'Georgia, serif');

  slots.forEach(([slot, label], i) => {
    const ry = py + headerH + 4 + i * rowH;
    const id = inv.equip[slot], it = id ? ITEMS[id] : null;
    // ligne : parchemin clair si occupé, bois sombre sinon
    if (it) {
      parchment(px + 7, ry, pw - 14, rowH - 8, 0.9);
      ctx.strokeStyle = HPAL.goldLo; ctx.lineWidth = 0.8;
      roundRect(px + 8.5, ry + 1.5, pw - 17, rowH - 11, 5); ctx.stroke();
      // icône dans un médaillon
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.arc(px + 26, ry + (rowH - 8) / 2, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = HPAL.goldLo; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px + 26, ry + (rowH - 8) / 2, 13, 0, Math.PI * 2); ctx.stroke();
      drawItemIcon(it, px + 26, ry + (rowH - 8) / 2, 11);
      // nom + label
      ctx.textAlign = 'left';
      const name = it.name.length > 16 ? it.name.slice(0, 15) + '…' : it.name;
      engraved(name, px + 44, ry + 17, 10.5, '#3a2a14', 'left', 'Inter, sans-serif');
      ctx.font = '8px Inter, sans-serif'; ctx.fillStyle = '#6d5a3a';
      ctx.fillText(label, px + 44, ry + 29);
      // barre de durabilité
      const dur = getDur(inv, id);
      const dbx = px + 44, dbw = pw - 60, dby = ry + 35;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      roundRect(dbx - 1, dby - 1, dbw + 2, 6, 3); ctx.fill();
      const dc = dur > 50 ? HPAL.green : dur > 25 ? '#d4a84b' : HPAL.red;
      ctx.fillStyle = dc;
      if (dur > 0) { roundRect(dbx, dby, dbw * dur / 100, 4, 2); ctx.fill(); }
      ctx.textAlign = 'right'; ctx.font = '8px Consolas, monospace';
      ctx.fillStyle = dur <= 0 ? HPAL.red : '#5a4526';
      ctx.fillText(dur <= 0 ? 'CASSÉ' : `${Math.round(dur)}%`, px + pw - 16, dby + 4);
      ctx.textAlign = 'left';
    } else {
      // emplacement vide : bois sombre + tirets
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      roundRect(px + 7, ry, pw - 14, rowH - 8, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(212,168,75,0.25)'; ctx.lineWidth = 1;
      roundRect(px + 7.5, ry + 0.5, pw - 15, rowH - 9, 6); ctx.stroke();
      ctx.font = 'italic 10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(216,196,154,0.4)';
      ctx.fillText(`${label} : —`, px + 20, ry + (rowH - 8) / 2 + 3);
    }
  });
}
