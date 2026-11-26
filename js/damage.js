// Dégâts subis par le joueur — module à part pour casser le cycle
// main.js -> bosses.js/events.js -> main.js (import circulaire qui
// doublait l'exécution de main.js quand l'URL portait un ?v= de cache-bust)
import { G } from './state.js';
import { addDamageText, spawnParticles } from './effects.js';
import { sfxHurt, sfxBreak } from './audio.js';
import { wearEquipment, getDur, durMaxOf, ITEMS } from './inventory.js';
import { moduleAbsorb } from './modules.js';
import { curWorld } from './world.js';
import { CAMPAIGNS } from './world_data.js';
import { recordRun } from './menu/flow.js';

// inflige des dégâts au joueur (contact, foudre, projectile de glace)
export function damagePlayer(dmg, slow = 1.0, killer = null) {
  const p = G.player;
  if (G.godMode) { addDamageText(p.x, p.y - 18, 'IMMORTEL', '#69f0ae'); return; }
  if (p.attackMode === 3) dmg *= 0.6;   // bouclier : -40% de dégâts subis
  if (p.shieldT > 0) dmg *= 0.15;       // dôme de bouclier : -85% de dégâts subis
  dmg *= 1 - (G.equip ? G.equip.armorReduce : 0); // armure équipée
  if (G.iceStorm) dmg *= 0.5; // Pluie de Glace : les ennemis frappent 2× moins fort
  dmg = moduleAbsorb(dmg);    // modules : bouclier énergétique + résistance
  p.hp -= dmg;
  G.dmgTaken += dmg;
  // tracking du dernier agresseur (pour l'écran de mort)
  if (killer) G.lastKiller = killer;
  sfxHurt();
  p.lastHurt = G.time;
  p.slowT = Math.max(p.slowT, slow);
  p.hitSlowT = 0.35; // léger ralentissement à chaque coup subi (×0,88 pendant 0,35 s)
  addDamageText(p.x, p.y - 18, `-${Math.round(dmg)}`, '#ff1744');
  spawnParticles(p.x, p.y, '#ff1744', 6, 4);
  // usure des équipements : chaque coup use l'armure, l'arme et le talisman
  if (G.inv) {
    const w = wearEquipment(G.inv);
    if (w.wear) for (const id in w.wear) G.runWear[id] = (G.runWear[id] || 0) + w.wear[id];
    if (w.broken) { addDamageText(p.x, p.y - 42, `💥 ${w.broken} CASSÉ !`, '#ff5252'); sfxBreak(); }
    // alerte : un équipement sous 30 % de durabilité -> toast d'avertissement
    for (const s in G.inv.equip) {
      const id = G.inv.equip[s];
      if (!id) continue;
      const d = getDur(G.inv, id);
      const dmax = durMaxOf(id);
      if (d > 0 && d < dmax * 0.3) {
        G.warnToast = { name: `⚠️ ${ITEMS[id] ? ITEMS[id].name : id} : durabilité critique (${Math.round(d / dmax * 100)} %) — répare à la forge !`, t: 5 };
        break;
      }
    }
  }
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false; G.gameOver = true;
    G.runDeaths = (G.runDeaths || 0) + 1; // quêtes : victoires « sans faille »
    G.bomber = null; // la cinématique de l'ultime s'arrête avec le héros
    G.iceStorm = null; G.iceSpikes = []; G.iceFrost = []; G.snowCover = null;
    // snapshot des infos de mort pour l'écran game over
    const k = G.lastKiller;
    G.deathInfo = {
      killer: k ? (k.name || 'Inconnu') : 'Inconnu',
      killerType: k ? k.type : null,
      killerColor: k ? (k.glow || k.color || '#ff5252') : '#ff5252',
      world: curWorld().def ? curWorld().def.name : 'Inconnu',
      campaign: (CAMPAIGNS[G.campaign] || {}).name || '',
      wave: G.wave
    };
    // cinématique de mort : le héros s'effondre pendant 1,8s avant le game over
    G.state = 'dying'; G.deathT = 1.8;
    G.deathDir = Math.random() < 0.5 ? -1 : 1;
    G.stats.forgeUnlocked = true; // première mort : la forge s'ouvre au menu
    recordRun();
    // salve de mort : gerbe rouge, débris d'armure, onde de choc
    spawnParticles(p.x, p.y, '#ff1744', 30, 8);
    spawnParticles(p.x, p.y, '#78909c', 15, 5);
    G.rings.push({ x: p.x, y: p.y, r: p.r, maxR: 110, life: 40, maxLife: 40, color: '#ff1744' });
    G.screenFlash = 0.5; G.screenShake = 14;
  }
}
