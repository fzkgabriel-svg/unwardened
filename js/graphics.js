// Point d'entrée unique du rendu : le code est découpé par domaine
// dans js/gfx/ — tous les imports existants ('./graphics.js') restent valides.
export * from './gfx/atmosphere.js';  // grain, cycle jour/nuit, fond
export * from './gfx/terrain.js';     // sol, lacs, ponts, décor, régénération
export * from './gfx/obstacles.js';   // montagnes et rochers
export * from './gfx/buildings.js';   // bâtiments du monde
export * from './gfx/worldfx.js';     // portails, fioles, projectiles, feux, effets
export * from './gfx/entities.js';    // héros, monstres, armes, ataques spéciales
export * from './gfx/cinematic.js';   // nuages d'intro, B-2, bombe atomique, champignon
