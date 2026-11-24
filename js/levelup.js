// js/levelup.js — niveau global du joueur (1 → 1000), XP, paliers de récompenses
// L'XP globale est distincte de l'XP de campagne : elle récompense les
// victoires, les boss, les déblocages et les succès — jamais le farm.
import { G, saveStats } from './state.js';
import { MAX_LEVEL, REWARD_EVERY, gLevel, gXpNeed, card, rewardsAtLevel, isOwned } from './cosmetics.js';
import { sfxLevel, sfxVictory } from './audio.js';
import { addDamageText, spawnParticles } from './effects.js';

export { MAX_LEVEL, REWARD_EVERY };

// ---------- sources d'XP (anti-abus : seulement les étapes fortes) ----------
// victoire de campagne : base × monde × difficulté
export function xpForVictory(campaign, difficulty) {
  const world = campaign + 1;
  const diffMult = difficulty === 2 ? 2.0 : difficulty === 1 ? 1.5 : 1.0;
  return Math.round((100 + world * 60) * diffMult);
}
export const XP_BOSS = 15;        // boss de vague (×5)
export const XP_MINIBOSS = 6;     // mini-boss (×3)
export const XP_FINAL_BOSS = 60;  // boss final de campagne
export const XP_WORLD = 80;       // nouveau monde débloqué
export const XP_ACHIEVEMENT = 25; // succès réclamé

// ---------- progression ----------
// file d'événements de niveau pour les animations (lus par le HUD/effets)
export function gainGlobalXp(amount) {
  G.stats = G.stats || {};
  G.stats.gxp = G.stats.gxp || 0;
  G.stats.glevel = G.stats.glevel || 1;
  if (gLevel() >= MAX_LEVEL) return 0;
  let xp = Math.max(0, Math.round(amount));
  let gained = 0;
  while (xp > 0 && gLevel() < MAX_LEVEL) {
    const need = gXpNeed();
    if (G.stats.gxp + xp < need) { G.stats.gxp += xp; gained += xp; xp = 0; break; }
    xp -= (need - G.stats.gxp);
    G.stats.gxp = 0;
    G.stats.glevel = gLevel() + 1;
    gained += need - G.stats.gxp; // approximatif, suffisant pour l'UI
    onLevelUp(G.stats.glevel);
    if (G.stats.glevel >= MAX_LEVEL) break;
  }
  if (gLevel() >= MAX_LEVEL) { G.stats.gxp = 0; }
  if (gained > 0) saveStats();
  return gained;
}

// palier franchi : déblocage du cosmétique du palier + célébration
function onLevelUp(lvl) {
  const p = G.player;
  sfxLevel();
  if (p) {
    addDamageText(p.x, p.y - 60, `NIVEAU ${lvl} !`, '#ffd54f');
    spawnParticles(p.x, p.y, '#ffd54f', 30, 7);
  }
  // palier ×25 : la récompense cosmetics du niveau s'ouvre
  if (lvl % REWARD_EVERY === 0 && lvl <= MAX_LEVEL) {
    const rewards = rewardsAtLevel(lvl);
    if (rewards.length) {
      for (const r of rewards) if (!isOwned(r.id)) card().owned.push(r.id);
      sfxVictory();
      const names = rewards.map(r => `${r.icon} ${r.nom}`).join(', ');
      G.questsToast = { icon: '🎁', msg: `NIVEAU ${lvl} — récompense : ${names}`, t: 5 };
      G.levelToast = { lvl, rewards, t: 5 };
      saveStats();
    }
  } else {
    G.levelToast = { lvl, rewards: null, t: 3 };
  }
}

// ---------- notification de montée de niveau ----------
// G.levelToast = { lvl, rewards, t } — décrémenté dans main.js, dessiné par hud/toasts.js
