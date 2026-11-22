// js/world_data.js — tables de données des mondes (extraites de world.js)
// CONFIG, WORLDS, CAMPAIGNS, BUILDING_TYPES, tables de butin, raretés.

// ---------- CONFIGURATION CENTRALISÉE ----------
export const CONFIG = {
  worldW: 5400,          // largeur du monde en pixels
  worldH: 3600,          // hauteur du monde
  sectorW: 1200,         // taille d'un secteur
  sectorH: 800,
  buildingDensity: 1.0,  // bâtiments par secteur en moyenne
  minBuildingDist: 560,  // distance minimale entre deux bâtiments
  edgeMargin: 140,       // marge depuis les bords du monde
  portalWave: 50,        // la vague à terminer pour débloquer le portail
  portalDist: 340,       // distance d'apparition du portail
  interactDist: 130,     // distance d'interaction (loot / portail)
};


// ---------- DÉFINITION DES MONDES ----------
export const WORLDS = [
  {
    name: 'Les Terres Oubliées',
    biome: 'plain',
    ground: '#4c6b34', groundDark: '#3a5227', field: '#5d7a3c',
    blobA: 'rgba(90,130,60,0.20)', blobB: 'rgba(60,100,45,0.18)', blobC: 'rgba(120,150,70,0.14)',
    decor: ['grass', 'grass', 'grass', 'flower', 'flower', 'flower', 'tree', 'tree', 'bigtree', 'bush', 'bush', 'fern', 'rock', 'rock', 'shroom', 'stump', 'fence', 'lantern', 'barrel', 'path'],
    wall: '#8d6e63', wallDark: '#6d4c41', roof: '#5d4037', roofAlt: '#795548', trim: '#ffd740',
    window: '#ffe082', door: '#4e342e',
  },
  {
    name: 'Le Royaume de Glace',
    biome: 'ice',
    ground: '#7fa8c9', groundDark: '#5d87a8', field: '#9cc3dd',
    blobA: 'rgba(160,210,240,0.22)', blobB: 'rgba(120,180,220,0.18)', blobC: 'rgba(200,230,250,0.15)',
    decor: ['snow', 'snow', 'snow', 'grass', 'pine', 'pine', 'pine', 'bigtree', 'crystal', 'crystal', 'icicle', 'icecliff', 'frozenbush', 'rock', 'rock', 'snowdrift'],
    wall: '#eceff1', wallDark: '#b0bec5', roof: '#90caf9', roofAlt: '#64b5f6', trim: '#4fc3f7',
    window: '#b3e5fc', door: '#37474f',
  },
  // ---------- CAMPAGNE 2 : THE FROZEN LAND (mondes 2 et 3) ----------
  {
    name: 'The Frozen Land',
    biome: 'ice',
    ground: '#e8f1f8', groundDark: '#c3d5e4', field: '#f4f9fd',
    blobA: 'rgba(255,255,255,0.30)', blobB: 'rgba(160,200,230,0.20)', blobC: 'rgba(200,225,245,0.22)',
    decor: ['snow', 'snow', 'snow', 'snow', 'pine', 'pine', 'pine', 'bigtree', 'crystal', 'crystal', 'crystal', 'icicle', 'icecliff', 'frozenbush', 'rock', 'snowdrift', 'icearch'],
    wall: '#eceff1', wallDark: '#b0bec5', roof: '#90caf9', roofAlt: '#64b5f6', trim: '#4fc3f7',
    window: '#b3e5fc', door: '#37474f',
  },
  {
    name: 'Les Profondeurs Gelées',
    biome: 'ice',
    ground: '#dfe9f2', groundDark: '#b8c9d8', field: '#eef4fa',
    blobA: 'rgba(220,238,250,0.28)', blobB: 'rgba(140,185,215,0.20)', blobC: 'rgba(180,210,235,0.20)',
    decor: ['snow', 'snow', 'pine', 'pine', 'pine', 'bigtree', 'crystal', 'crystal', 'icicle', 'icecliff', 'frozenbush', 'rock', 'snowdrift', 'icearch'],
    wall: '#dfe9f2', wallDark: '#a9bccd', roof: '#7fb3d5', roofAlt: '#5b8fb5', trim: '#81d4fa',
    window: '#e1f5fe', door: '#263238',
  },
  // ---------- CAMPAGNE 3 : LES ENFERS (mondes 4 et 5) ----------
  {
    name: 'Les Enfers',
    biome: 'hell',
    ground: '#3d1f1c', groundDark: '#2a1210', field: '#4a2420',
    blobA: 'rgba(160,50,20,0.22)', blobB: 'rgba(120,25,60,0.20)', blobC: 'rgba(200,90,20,0.14)',
    decor: ['crack', 'crack', 'crack', 'bone', 'bone', 'bone', 'obsid', 'obsid', 'fire', 'fire', 'deadwood', 'rock', 'ash', 'basalt', 'magmavein', 'sulfur', 'firegrass', 'skull'],
    wall: '#4a2622', wallDark: '#2e1512', roof: '#6d1f1f', roofAlt: '#8a2a1a', trim: '#ff7043',
    window: '#ffab40', door: '#1a0d0b',
  },
  {
    name: 'Le Trône de Cendres',
    biome: 'hell',
    ground: '#331a18', groundDark: '#200e0d', field: '#3f1d1b',
    blobA: 'rgba(200,60,15,0.25)', blobB: 'rgba(140,20,70,0.22)', blobC: 'rgba(90,20,110,0.16)',
    decor: ['crack', 'crack', 'crack', 'bone', 'bone', 'obsid', 'obsid', 'obsid', 'fire', 'fire', 'deadwood', 'deadwood', 'ash', 'ash', 'basalt', 'basalt', 'magmavein', 'sulfur', 'sulfur', 'firegrass', 'skull', 'skull', 'rock'],
    wall: '#3a1c1a', wallDark: '#241010', roof: '#5c1818', roofAlt: '#7a2418', trim: '#ff5252',
    window: '#ff8a65', door: '#140a09',
  },
  // ---------- CAMPAGNE 4 : LES ÉGOUTS (mondes 6 et 7) ----------
  {
    name: 'Les Égouts',
    biome: 'sewer',
    ground: '#2e3b2a', groundDark: '#1d2718', field: '#37452f',
    blobA: 'rgba(90,140,60,0.22)', blobB: 'rgba(60,110,50,0.18)', blobC: 'rgba(140,170,70,0.14)',
    decor: ['slime', 'slime', 'slime', 'bones', 'bones', 'pipe', 'pipe', 'grate', 'grate', 'mush', 'mush', 'rock', 'rat', 'water', 'roots', 'drip', 'pipe2', 'cage', 'banner', 'glowshroom', 'tunnel'],
    wall: '#4a5a3a', wallDark: '#2e3a24', roof: '#5a6a42', roofAlt: '#6e7f52', trim: '#9ccc65',
    window: '#c5e1a5', door: '#26301c',
  },
  {
    name: 'Les Profondeurs',
    biome: 'sewer',
    ground: '#26301f', groundDark: '#161e12', field: '#2f3a28',
    blobA: 'rgba(80,130,55,0.24)', blobB: 'rgba(50,100,45,0.20)', blobC: 'rgba(120,160,60,0.15)',
    decor: ['slime', 'slime', 'slime', 'slime', 'bones', 'bones', 'pipe', 'pipe', 'grate', 'grate', 'grate', 'mush', 'mush', 'rat', 'rat', 'water', 'water', 'roots', 'drip', 'drip', 'pipe2', 'cage', 'banner', 'glowshroom', 'glowshroom', 'tunnel', 'rock'],
    wall: '#3d4c2f', wallDark: '#24301c', roof: '#4a5a36', roofAlt: '#5d6d45', trim: '#8bc34a',
    window: '#aed581', door: '#1c2415',
  },
  // ---------- CAMPAGNE 5 : L'ESPACE (mondes 8 et 9) ----------
  {
    name: 'La Lune',
    biome: 'space',
    ground: '#3a3f4a', groundDark: '#262a33', field: '#454b58',
    blobA: 'rgba(90,110,160,0.22)', blobB: 'rgba(60,80,140,0.18)', blobC: 'rgba(140,150,190,0.14)',
    decor: ['crater', 'crater', 'crater', 'rock', 'rock', 'debris', 'debris', 'debris', 'meteor', 'star', 'shard', 'crystal', 'crystal', 'floatrock', 'cosmictree', 'energycrystal', 'holo', 'alienflora', 'ruinpillar'],
    wall: '#5a6272', wallDark: '#3a4150', roof: '#6e7688', roofAlt: '#4a5162', trim: '#90caf9',
    window: '#bbdefb', door: '#232833',
  },
  {
    name: 'La Station Perdue',
    biome: 'space',
    ground: '#2e3340', groundDark: '#1d212c', field: '#3a4050',
    blobA: 'rgba(80,90,150,0.24)', blobB: 'rgba(50,60,120,0.20)', blobC: 'rgba(130,140,200,0.15)',
    decor: ['crater', 'crater', 'debris', 'debris', 'debris', 'meteor', 'meteor', 'star', 'star', 'shard', 'shard', 'crystal', 'crystal', 'crystal', 'floatrock', 'floatrock', 'cosmictree', 'cosmictree', 'energycrystal', 'holo', 'holo', 'alienflora', 'alienflora', 'ruinpillar', 'rock'],
    wall: '#4e5566', wallDark: '#2e3444', roof: '#6a7b95', roofAlt: '#3d4a63', trim: '#64b5f6',
    window: '#90caf9', door: '#1c2030',
  },
];

// ---------- CAMPAGNES : chaque campagne possède 2 mondes (portails internes) ----------
export const CAMPAIGNS = [
  { id: 0, name: 'Les Terres Oubliées', worlds: [0, 1], diff: 'NORMAL' },
  { id: 1, name: 'The Frozen Land',    worlds: [2, 3], diff: 'MOYEN' },
  { id: 2, name: 'Les Enfers',         worlds: [4, 5], diff: 'IMPOSSIBLE' },
  { id: 3, name: 'Les Égouts',         worlds: [6, 7], diff: 'TERRIFIANT' },
  { id: 4, name: 'L\'Espace',          worlds: [8, 9], diff: 'CATASTROPHIQUE' },
];
export function campaignOf(idx) { return idx >= 8 ? 4 : idx >= 6 ? 3 : idx >= 4 ? 2 : idx >= 2 ? 1 : 0; }
export function campaignStart(c) { return [0, 2, 4, 6, 8][c] || 0; }
export function campaignEnd(c) { return [2, 4, 6, 8, 10][c] || 2; } // borne exclusive


// ---------- BIBLIOTHÈQUE DE BÂTIMENTS ----------
export const BUILDING_TYPES = [
  { id: 'cabin',     name: 'Cabane',              cat: 'petite',     rarity: 'commun',     w: 120, h: 90,  weight: 30, loot: 'cabin',     camp: 0 },
  { id: 'house',     name: 'Maison abandonnée',   cat: 'maison',     rarity: 'commun',     w: 175, h: 125, weight: 22, loot: 'house',     camp: 0 },
  { id: 'ruins',     name: 'Ruines',              cat: 'ruine',      rarity: 'commun',     w: 150, h: 110, weight: 16, loot: 'ruins',     camp: 0 },
  { id: 'warehouse', name: 'Entrepôt',            cat: 'industriel', rarity: 'rare',       w: 235, h: 155, weight: 12, loot: 'warehouse', camp: 0 },
  { id: 'factory',   name: 'Usine',               cat: 'industriel', rarity: 'rare',       w: 265, h: 175, weight: 9,  loot: 'factory',   camp: 0 },
  { id: 'gas',       name: 'Station-service',     cat: 'industriel', rarity: 'epique',     w: 205, h: 140, weight: 7,  loot: 'gas',       camp: 0 },
  { id: 'shrine',    name: 'Sanctuaire ancien',   cat: 'rare',       rarity: 'legendaire', w: 145, h: 145, weight: 4,  loot: 'shrine',    camp: 0 },
  { id: 'mill',      name: 'Moulin abandonné',    cat: 'industriel', rarity: 'rare',       w: 150, h: 170, weight: 10, loot: 'warehouse', camp: 0, drawAs: 'tower' },
  { id: 'watcht',    name: 'Tour de guet',        cat: 'industriel', rarity: 'rare',       w: 70,  h: 185, weight: 11, loot: 'warehouse', camp: 0, drawAs: 'tower' },
  { id: 'camp2',     name: 'Camp de bûcherons',   cat: 'petite',     rarity: 'commun',     w: 105, h: 80,  weight: 18, loot: 'cabin',     camp: 0, drawAs: 'cabin' },
  // ---------- structures hivernales (campagne 2 uniquement) ----------
  { id: 'chalet',    name: 'Chalet enneigé',      cat: 'maison',     rarity: 'commun',     w: 165, h: 115, weight: 26, loot: 'house',  camp: 1, drawAs: 'house' },
  { id: 'camp',      name: 'Campement de chasse', cat: 'petite',     rarity: 'commun',     w: 110, h: 80,  weight: 22, loot: 'cabin',  camp: 1, drawAs: 'cabin' },
  { id: 'watch',     name: 'Tour de guet glacée', cat: 'industriel', rarity: 'rare',       w: 70,  h: 190, weight: 12, loot: 'warehouse', camp: 1, drawAs: 'tower' },
  { id: 'lab',       name: 'Labo abandonné',      cat: 'industriel', rarity: 'rare',       w: 220, h: 150, weight: 10, loot: 'factory', camp: 1, drawAs: 'warehouse' },
  { id: 'mine',      name: 'Mine gelée',          cat: 'industriel', rarity: 'epique',     w: 240, h: 160, weight: 8,  loot: 'gas',    camp: 1, drawAs: 'gas' },
  { id: 'fort',      name: 'Forteresse gelée',    cat: 'rare',       rarity: 'legendaire', w: 280, h: 190, weight: 5,  loot: 'shrine', camp: 1, drawAs: 'warehouse' },
  { id: 'icearch',   name: 'Arche de glace',      cat: 'ruine',      rarity: 'rare',       w: 190, h: 120, weight: 14, loot: 'ruins',  camp: 1, drawAs: 'arch' },
  { id: 'grave',     name: 'Cimetière glacé',     cat: 'petite',     rarity: 'commun',     w: 130, h: 95,  weight: 20, loot: 'cabin',  camp: 1, drawAs: 'house' },
  { id: 'relay',     name: 'Relais abandonné',    cat: 'industriel', rarity: 'epique',     w: 95,  h: 210, weight: 7,  loot: 'factory', camp: 1, drawAs: 'tower' },
  { id: 'castle',    name: 'Château enneigé',     cat: 'rare',       rarity: 'legendaire', w: 320, h: 210, weight: 3,  loot: 'shrine',  camp: 1, drawAs: 'castle' },
  // ---------- structures infernales (campagne 3 uniquement) ----------
  { id: 'temple',    name: 'Temple des Braises',  cat: 'ruine',      rarity: 'commun',     w: 160, h: 115, weight: 24, loot: 'ruins',    camp: 2, drawAs: 'ruins' },
  { id: 'forge',     name: 'Forge des Damnés',    cat: 'industriel', rarity: 'commun',     w: 150, h: 105, weight: 22, loot: 'cabin',    camp: 2, drawAs: 'factory' },
  { id: 'mansion',   name: 'Manoir Maudit',       cat: 'maison',     rarity: 'rare',       w: 185, h: 130, weight: 16, loot: 'house',    camp: 2, drawAs: 'house' },
  { id: 'crypt',     name: 'Crypte Ardente',      cat: 'petite',     rarity: 'commun',     w: 125, h: 95,  weight: 20, loot: 'cabin',    camp: 2, drawAs: 'cabin' },
  { id: 'altar',     name: 'Autel de Sang',       cat: 'rare',       rarity: 'epique',     w: 110, h: 110, weight: 12, loot: 'shrine',   camp: 2, drawAs: 'shrine' },
  { id: 'bastion',   name: 'Bastion de Cendres',  cat: 'industriel', rarity: 'epique',     w: 230, h: 150, weight: 9,  loot: 'warehouse', camp: 2, drawAs: 'warehouse' },
  { id: 'helltower', name: 'Tour du Trône',       cat: 'industriel', rarity: 'rare',       w: 75,  h: 200, weight: 10, loot: 'factory',  camp: 2, drawAs: 'tower' },
  { id: 'hellcastle',name: 'Château des Enfers',  cat: 'rare',       rarity: 'legendaire', w: 320, h: 210, weight: 3,  loot: 'shrine',   camp: 2, drawAs: 'castle' },
  // ---------- structures des ÉGOUTS (campagne 4 uniquement) ----------
  { id: 'culvert',   name: 'Buse effondrée',      cat: 'ruine',      rarity: 'commun',     w: 170, h: 120, weight: 24, loot: 'ruins',     camp: 3, drawAs: 'arch' },
  { id: 'pump',      name: 'Station de pompage',  cat: 'industriel', rarity: 'commun',     w: 200, h: 140, weight: 20, loot: 'warehouse', camp: 3, drawAs: 'warehouse' },
  { id: 'nest',      name: 'Terrier de rats',     cat: 'petite',     rarity: 'commun',     w: 110, h: 85,  weight: 22, loot: 'cabin',     camp: 3, drawAs: 'cabin' },
  { id: 'grotto',    name: 'Grotte à champignons',cat: 'rare',       rarity: 'rare',       w: 160, h: 110, weight: 15, loot: 'house',     camp: 3, drawAs: 'house' },
  { id: 'cistern',   name: 'Citerne',             cat: 'industriel', rarity: 'rare',       w: 220, h: 150, weight: 11, loot: 'factory',   camp: 3, drawAs: 'factory' },
  { id: 'canal',     name: 'Écluse abandonnée',   cat: 'industriel', rarity: 'epique',     w: 240, h: 160, weight: 9,  loot: 'gas',       camp: 3, drawAs: 'gas' },
  { id: 'hive',      name: 'Rucher des Profondeurs', cat: 'rare',    rarity: 'epique',     w: 130, h: 130, weight: 10, loot: 'shrine',    camp: 3, drawAs: 'shrine' },
  { id: 'sewcastle', name: 'Forteresse des Égoûts',cat: 'rare',      rarity: 'legendaire', w: 320, h: 210, weight: 3,  loot: 'shrine',    camp: 3, drawAs: 'castle' },
  // ---------- structures de L'ESPACE (campagne 5 uniquement) ----------
  { id: 'domes',     name: 'Dôme lunaire',        cat: 'rare',       rarity: 'commun',     w: 180, h: 120, weight: 22, loot: 'house',     camp: 4, drawAs: 'house' },
  { id: 'lander',    name: 'Épave d\'atterrisseur',cat:'industriel',rarity: 'commun',     w: 190, h: 130, weight: 20, loot: 'warehouse', camp: 4, drawAs: 'warehouse' },
  { id: 'relay',     name: 'Relais orbital',      cat: 'industriel', rarity: 'rare',       w: 90,  h: 220, weight: 12, loot: 'factory',   camp: 4, drawAs: 'factory' },
  { id: 'greenhouse',name: 'Serre abandonnée',    cat: 'maison',     rarity: 'rare',       w: 160, h: 110, weight: 14, loot: 'cabin',     camp: 4, drawAs: 'cabin' },
  { id: 'lab',       name: 'Laboratoire spatial', cat: 'industriel', rarity: 'epique',     w: 230, h: 155, weight: 10, loot: 'factory',   camp: 4, drawAs: 'warehouse' },
  { id: 'reactor',   name: 'Réacteur désaffecté', cat: 'industriel', rarity: 'epique',     w: 200, h: 200, weight: 8,  loot: 'gas',       camp: 4, drawAs: 'gas' },
  { id: 'monolith',  name: 'Monolithe',           cat: 'ruine',      rarity: 'epique',     w: 120, h: 190, weight: 9,  loot: 'shrine',    camp: 4, drawAs: 'shrine' },
  { id: 'station',   name: 'Grande Station',      cat: 'rare',       rarity: 'legendaire', w: 330, h: 200, weight: 3,  loot: 'shrine',    camp: 4, drawAs: 'castle' },
];
// bonus de fouille : XP garanti + fiole selon la rareté du bâtiment
export const LOOT_BONUS = {
  cabin:     { xp: [8, 15],   xpCh: 1, potionCh: 0.10 },
  house:     { xp: [12, 22],  xpCh: 1, potionCh: 0.15 },
  ruins:     { xp: [15, 28],  xpCh: 1, potionCh: 0.20 },
  warehouse: { xp: [25, 45],  xpCh: 1, potionCh: 0.35 },
  factory:   { xp: [35, 60],  xpCh: 1, potionCh: 0.45 },
  gas:       { xp: [40, 70],  xpCh: 1, potionCh: 0.55 },
  shrine:    { xp: [80, 140], xpCh: 1, potionCh: 0.90 },
};
// bonus de butin hivernal : plus généreux (la campagne 2 rapporte davantage)
export const LOOT_BONUS_FROZEN = {
  cabin:     { xp: [15, 25],  xpCh: 1, potionCh: 0.18 },
  house:     { xp: [20, 35],  xpCh: 1, potionCh: 0.25 },
  ruins:     { xp: [25, 45],  xpCh: 1, potionCh: 0.30 },
  warehouse: { xp: [40, 65],  xpCh: 1, potionCh: 0.50 },
  factory:   { xp: [55, 85],  xpCh: 1, potionCh: 0.60 },
  gas:       { xp: [60, 100], xpCh: 1, potionCh: 0.70 },
  shrine:    { xp: [120, 200],xpCh: 1, potionCh: 1.0 },
};
// butin des Enfers : le plus généreux des trois campagnes
export const LOOT_BONUS_HELL = {
  cabin:     { xp: [25, 40],  xpCh: 1, potionCh: 0.25 },
  house:     { xp: [35, 55],  xpCh: 1, potionCh: 0.35 },
  ruins:     { xp: [40, 70],  xpCh: 1, potionCh: 0.40 },
  warehouse: { xp: [60, 95],  xpCh: 1, potionCh: 0.60 },
  factory:   { xp: [80, 120], xpCh: 1, potionCh: 0.70 },
  gas:       { xp: [90, 140], xpCh: 1, potionCh: 0.80 },
  shrine:    { xp: [160, 260],xpCh: 1, potionCh: 1.0 },
};
// butin des Égouts et de l'Espace : encore plus généreux
export const LOOT_BONUS_DEEP = {
  cabin:     { xp: [40, 65],  xpCh: 1, potionCh: 0.35 },
  house:     { xp: [55, 85],  xpCh: 1, potionCh: 0.45 },
  ruins:     { xp: [60, 105], xpCh: 1, potionCh: 0.50 },
  warehouse: { xp: [85, 130], xpCh: 1, potionCh: 0.70 },
  factory:   { xp: [110, 165],xpCh: 1, potionCh: 0.80 },
  gas:       { xp: [120, 185],xpCh: 1, potionCh: 0.90 },
  shrine:    { xp: [200, 340],xpCh: 1, potionCh: 1.0 },
};

export const RARITY_COLOR = { commun: '#9e9e9e', rare: '#4fc3f7', epique: '#ba68c4', legendaire: '#ffd740' };
