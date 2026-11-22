// js/hud/equip.js — équipement compact : une colonne fine d'icônes à
// droite de l'écran. Icône + micro-jauge de durabilité + anneau de
// sélection (l'arme active porte la couleur de son mode). Aucun panneau.
import { G, ctx, W } from '../state.js';
import { roundRect } from '../utils.js';
import { ITEMS, getDur, durMaxOf, durState } from '../inventory.js';
import { drawItemIcon } from '../utils.js';
import { HPAL, crisp } from './frame.js';

const SLOTS = ['weapon', 'armor', 'helm', 'gloves', 'charm', 'boots'];
// couleur de l'anneau de sélection selon le mode d'attaque actif
const MODE_COL = { 1: '#e8c96a', 3: '#7cc4f7', 5: '#b388ff' };

export function drawEquipPanel() {
  const inv = G.inv;
  if (!inv || !inv.equip) return;
  const cx = W - 34;          // colonne collée au bord droit
  const y0 = 72, gap = 33;

  SLOTS.forEach((slot, i) => {
    const cy = y0 + i * gap;
    const id = inv.equip[slot], it = id ? ITEMS[id] : null;
    const selected = slot === 'weapon' && !!it;
    const ringCol = selected ? (G.player.ultActive > 0 ? '#ff8a50' : (MODE_COL[G.player.attackMode] || HPAL.gold)) : null;

    // médaillon sombre discret (restitue la lisibilité sur tout terrain)
    ctx.fillStyle = 'rgba(10,7,4,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();

    if (it) {
      const dur = getDur(inv, id);
      const broken = dur <= 0;
      // icône
      ctx.globalAlpha = broken ? 0.45 : 1;
      drawItemIcon(it, cx, cy - 1, 10);
      ctx.globalAlpha = 1;
      // anneau de sélection de l'arme active
      if (ringCol) {
        ctx.strokeStyle = ringCol; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, 14.5, 0, Math.PI * 2); ctx.stroke();
      }
      // micro-jauge de durabilité sous l'icône (échelle propre à la rareté)
      const dmax = durMaxOf(id);
      const dbw = 26, dbx = cx - dbw / 2, dby = cy + 17;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(dbx - 1, dby - 1, dbw + 2, 4, 2); ctx.fill();
      const st = durState(dur, dmax);
      const dc = st === 'ok' ? HPAL.green : st === 'warn' ? '#d4a84b' : HPAL.red;
      ctx.fillStyle = broken ? HPAL.red : dc;
      if (dur > 0) { roundRect(dbx, dby, dbw * dur / dmax, 2, 1); ctx.fill(); }
      // % de durabilité miniature à gauche du médaillon — pas sur l'arme
      if (slot !== 'weapon' && !broken) {
        crisp(`${Math.round(dur / dmax * 100)}%`, cx - 19, cy + 3, 9,
          st === 'ok' ? 'rgba(232,220,190,0.8)' : st === 'warn' ? '#ffd740' : '#ff8a80',
          'right', { weight: 700, spacing: 0.5 });
      }
    } else {
      // emplacement vide : cercle pointillé discret
      ctx.strokeStyle = 'rgba(216,196,154,0.22)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}
