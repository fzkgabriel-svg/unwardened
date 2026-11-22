// js/menu/forge.js — vue forge : dispatche vers les onglets forger / inventaire / personnage
import { G, ctx, W, H } from '../state.js';
import { roundRect } from '../utils.js';
import { adminUnlocked, inR, drawMenuButton } from './common.js';
import { forgeLayout, forgeTabs, adminMatsBtn, forgeTab, itemDetail } from './forge_state.js';
import { drawForgeCraft, drawForgeAnim } from './forge_craft.js';
import { drawForgeInv, drawHeroPaperdoll } from './forge_gear.js';
export { forgeClickAt, forgeWheel } from './forge_state.js';

export function drawForgeView() {
  const L = forgeLayout(), T = forgeTabs(L);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(L.cx, L.cy, L.cw, L.ch, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,64,0.6)'; ctx.lineWidth = 2;
  roundRect(L.cx, L.cy, L.cw, L.ch, 16); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd740'; ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillText('⚒️  FORGE', W / 2, L.cy + 44);
  ctx.fillStyle = '#a89f7c'; ctx.font = 'italic 14px Inter, sans-serif';
  ctx.fillText('Forgez des équipements avec les matériaux des monstres', W / 2, L.cy + 62);

  // onglets
  for (const [key, label] of [['craft', '🔨 FORGER'], ['inv', '🎒 INVENTAIRE'], ['hero', '🧍 PERSONNAGE']]) {
    const r = T[key], active = forgeTab === key;
    ctx.fillStyle = active ? 'rgba(184,134,11,0.35)' : 'rgba(255,255,255,0.06)';
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = active ? '#ffd740' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = active ? 2 : 1;
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.fillStyle = active ? '#ffe9a3' : '#bdbdbd'; ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(label, r.x + r.w / 2, r.y + 23);
  }

  // bouton admin : don de matériaux (forge uniquement, admin débloqué)
  if (adminUnlocked()) {
    const mb = adminMatsBtn(L);
    const mhov = inR(mb, G.mouse.x, G.mouse.y);
    ctx.fillStyle = mhov ? 'rgba(239,83,80,0.55)' : 'rgba(239,83,80,0.22)';
    roundRect(mb.x, mb.y, mb.w, mb.h, 8); ctx.fill();
    ctx.strokeStyle = '#ef5350'; ctx.lineWidth = mhov ? 2 : 1.2;
    roundRect(mb.x, mb.y, mb.w, mb.h, 8); ctx.stroke();
    ctx.fillStyle = '#ffcdd2'; ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('🛠 +10 MATÉRIAUX', mb.x + mb.w / 2, mb.y + 20);
  }

  if (forgeTab === 'craft') drawForgeCraft(L);
  else if (forgeTab === 'inv') drawForgeInv(L);
  else drawHeroPaperdoll(L);
  if (itemDetail) drawItemDetail(); // fiche équipement par-dessus tout

  drawMenuButton(T.back, '← RETOUR', '#455a64', '#90a4ae', false);
  drawForgeAnim(L);
}
