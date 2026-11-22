import { G } from './state.js';
import { addDamageText, spawnParticles } from './effects.js';
import { sfxPotion, sfxLevel, sfxPickup } from './audio.js';

export function gainXp(amount) {
  const p = G.player;
  p.xp += amount * (G.equip ? G.equip.xp : 1); // bonus XP de l'équipement
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = Math.floor(p.xpNext * 1.5);
    p.maxHp += 20;
    p.hp = p.maxHp;
    p.attackDamage += 8;
    p.spinDamage += 6;
    sfxLevel();
    addDamageText(p.x, p.y - 28, `NIVEAU ${p.level}!`, '#40c4ff');
  }
}

export function usePotion() {
  const p = G.player;
  if (p.potionCooldown > 0) {
    addDamageText(p.x, p.y - 24, 'Fiole en recharge…', '#ff9ebb');
    return;
  }
  if (p.potions <= 0) {
    addDamageText(p.x, p.y - 24, 'Pas de fiole!', '#ff5252');
    return;
  }
  if (p.hp >= p.maxHp) return; // PV plein : on garde la fiole
  // soin : 50 PV de base + bonus/vague progressif — +10 par vague les 9
  // premières, +15 de la vague 10 à 19, +20 à partir de la vague 20
  const n = Math.max(0, G.wave - 1); // vagues déjà survécues
  const waveBonus = Math.min(n, 9) * 10
    + Math.max(0, Math.min(n, 19) - 9) * 15
    + Math.max(0, n - 19) * 20;
  // bonus de soin selon le monde : +75 en Terre Gelée, +100 en Enfer,
  // +125 en Égouts, +150 dans l'Espace
  const campBonus = G.campaign === 4 ? 150 : G.campaign === 3 ? 125 : G.campaign === 2 ? 100 : G.campaign === 1 ? 75 : 0;
  const heal = Math.round((50 + waveBonus + campBonus) * (G.equip ? G.equip.potionMult : 1));
  p.potions--;
  G.potionsUsed++;
  sfxPotion();
  p.potionCooldown = 2.5;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  addDamageText(p.x, p.y - 24, `+${heal} PV`, '#69f0ae');
  // effet de guérison : anneau vert + étincelles montantes
  G.rings.push({ x: p.x, y: p.y, r: p.r + 4, maxR: p.r + 46, life: 22, maxLife: 22, color: '#69f0ae' });
  for (let i = 0; i < 18; i++) {
    G.particles.push({
      x: p.x + (Math.random() - 0.5) * 24, y: p.y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 1.5, vy: -2 - Math.random() * 3,
      life: 35 + Math.random() * 15, maxLife: 50,
      color: Math.random() < 0.6 ? '#69f0ae' : '#b9f6ca',
      r: 2 + Math.random() * 2.5
    });
  }
}
