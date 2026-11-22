// js/menu/forge.js — vue forge : dispatche vers les onglets forger / inventaire / personnage
import { G, ctx, W, H } from '../state.js';
import { roundRect } from '../utils.js';
import { adminUnlocked, inR, drawMenuButton } from './common.js';
import { forgeLayout, forgeTabs, adminMatsBtn, forgeTab, itemDetail, drawItemDetail } from './forge_state.js';
import { drawForgeCraft, drawForgeAnim } from './forge_craft.js';
import { drawForgeInv, drawHeroPaperdoll } from './forge_gear.js';
import { drawForgeScene, drawMiniFlame } from './forge_fx.js';
export { forgeClickAt, forgeWheel } from './forge_state.js';

export function drawForgeView() {
  const L = forgeLayout(), T = forgeTabs(L);
  const glow = drawForgeScene(); // environnement vivant : feu, fumée, chaînes, lanterne…

  // transition douce entre les onglets (apparition progressive + léger décalage)
  if (G._forgePrevTab !== forgeTab) { G._forgePrevTab = forgeTab; G._forgeTabT = G.time; }
  const tabK = Math.min(1, (G.time - (G._forgeTabT || 0)) / 0.3);
  const ease = 1 - Math.pow(1 - tabK, 3);

  // panneau : translucide pour laisser passer la lueur du foyer, bordure chauffée
  ctx.fillStyle = 'rgba(12,7,4,0.74)';
  roundRect(L.cx, L.cy, L.cw, L.ch, 16); ctx.fill();
  // lueur chaude qui déborde du panneau (2 passes concentriques)
  ctx.strokeStyle = `rgba(255,140,40,${0.10 + glow * 0.10})`; ctx.lineWidth = 7;
  roundRect(L.cx - 4, L.cy - 4, L.cw + 8, L.ch + 8, 19); ctx.stroke();
  ctx.strokeStyle = `rgba(255,190,80,${0.25 + glow * 0.2})`; ctx.lineWidth = 2;
  roundRect(L.cx, L.cy, L.cw, L.ch, 16); ctx.stroke();

  ctx.textAlign = 'center';
  drawMiniFlame(W / 2 - 108, L.cy + 36, 0.9);
  ctx.fillStyle = '#ffd740'; ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillText('FORGE', W / 2 + 14, L.cy + 44);
  ctx.fillStyle = '#a89f7c'; ctx.font = 'italic 14px Inter, sans-serif';
  ctx.fillText('Forgez des équipements avec les matériaux des monstres', W / 2, L.cy + 58);

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

  // contenu de l'onglet : apparition en fondu + léger glissement vers le haut
  ctx.save();
  ctx.globalAlpha = ease;
  ctx.translate(0, (1 - ease) * 14);
  if (forgeTab === 'craft') drawForgeCraft(L);
  else if (forgeTab === 'inv') drawForgeInv(L);
  else drawHeroPaperdoll(L);
  ctx.restore();
  if (itemDetail) drawItemDetail(); // fiche équipement par-dessus tout

  drawMenuButton(T.back, '← RETOUR', '#455a64', '#90a4ae', false);
  drawForgeAnim(L);
}
