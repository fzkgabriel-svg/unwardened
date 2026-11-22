// js/gfx/entities.js — point d'entrée : ré-exporte les sprites découpés par domaine
export * from './enemies_draw.js';   // drawEnemy (dispatch par biome) + ombre
export * from './enemy_ice.js';      // Terres gelées
export * from './enemy_hell.js';     // Enfers
export * from './enemy_sewer.js';    // Égouts
export * from './enemy_space.js';    // Espace
export * from './player_draw.js';    // drawPlayer + apparitions + spin
export * from './combat_draw.js';    // drawSlashArc + drawUltFlash
