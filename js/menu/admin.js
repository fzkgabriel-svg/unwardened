import { G, ctx, W, H, TAU, saveStats, finalWave } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { regenerateDecor } from '../graphics.js';
import { ACHIEVEMENTS, unlocked, achievementCount, checkAchievements, achInfo, isClaimed, claimReward, achTabList, unclaimedInTab, adminUnlockAll } from '../achievements.js';
import { ITEMS, MATS, canCraft, craft, toggleEquip, equipBonuses, getDur, canRepair, repairItem, repairCost, loadInv, addMaterial, modeInfo, addWmodeXp, modeMult, MODE_MAX_LVL, setInvNoSave } from '../inventory.js';
import { spawnEnemy, spawnFinalBoss } from '../enemies.js';
import { gainXp } from '../player.js';
import { curWorld, syncCamera, regenerateWorld, reloadWorlds, campaignStart } from '../world.js';
import { sfxCraft, sfxRepair, sfxEquip, sfxConfirm, sfxClick } from '../audio.js';
import { MAX_SLOTS, activeSlot, allSlots, slotMeta, slotSummary, createChar, selectChar, deselectChar, resetChar, fmtPlaytime, fmtDate, checkAdminPass, adminOK as _adminOK, adminList, adminWipeAll, adminLock } from '../chars.js';
import { inR, fitText, wrapLines, hexA, fmtTime, overline, panel, overlineCentered, drawMenuButton, drawAdminPwInput, menuButtons, menuButtonAt, adminUnlocked, campaignUnlocked, UI, SERIF, C_TEXT, C_MUTED, C_GOLD, MENU_X, MENU_W, MENU_ITEMS } from './common.js';

// ==================== PANNEAU ADMIN ====================
export function adminClickAt(x, y) {
  if (!adminUnlocked()) {
    if (G.adminInput) return 'input';
    return null;
  }
  const back = { x: 30, y: H - 60, w: 160, h: 40 };
  if (inR(back, x, y)) { G.menuView = 'characters'; return 'back'; }
  const wipe = { x: W - 260, y: H - 60, w: 230, h: 40 };
  if (inR(wipe, x, y)) {
    if (G.resetConfirm === 99) { adminWipeAll(); G.resetConfirm = -1; return 'wipe'; }
    G.resetConfirm = 99; return 'askwipe';
  }
  // boutons « tout débloquer » et « sans cooldowns »
  const ub = { x: W / 2 - 280, y: H - 112, w: 270, h: 44 };
  if (inR(ub, x, y)) { adminUnlockAll(); G.adminUnlockFx = G.time; G.adminMsg = { text: 'TOUT DÉBLOQUÉ !', t: G.time }; return 'unlockall'; }
  const nb = { x: W / 2 + 10, y: H - 112, w: 270, h: 44 };
  if (inR(nb, x, y)) { G.adminNoCd = !G.adminNoCd; return 'nocd'; }
  // reset individuel d'un slot
  for (let i = 0; i < MAX_SLOTS; i++) {
    const r = { x: W / 2 - 330, y: 330 + i * 78, w: 120, h: 36 };
    if (slotMeta(i) && inR(r, x, y)) {
      if (G.resetConfirm === i) { resetChar(i); G.resetConfirm = -1; return 'reset'; }
      G.resetConfirm = i; return 'askreset';
    }
  }
  if (G.resetConfirm >= 0) G.resetConfirm = -1; // clic ailleurs = annule la confirmation
  return null;
}

export function drawAdmin() {
  ctx.fillStyle = 'rgba(8,4,4,0.96)'; ctx.fillRect(0, 0, W, H);
  // l'animation du cadenas joue D'ABORD : le panneau s'ouvre une fois terminée
  if (adminUnlocked()) {
    const at = G.time - G.adminUnlockT;
    if (at >= 0 && at < 1.4) { drawPadlockAnim(); return; }
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = '600 36px Inter, sans-serif';
  ctx.fillText('⚠ PANNEAU ADMIN', W / 2, 70);
  ctx.fillStyle = '#a89f7c'; ctx.font = '15px Inter, sans-serif';
  ctx.fillText('Gestion locale des personnages — données stockées sur cet appareil', W / 2, 100);

  if (!adminUnlocked()) {
    if (G.adminInput) drawAdminPwInput();
    return;
  }

  // en-tête du tableau
  ctx.textAlign = 'left'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.fillStyle = '#78909c';
  const cols = [60, 240, 200, 160, 140, 120];
  const heads = ['#', 'HÉROS', 'TEMPS DE JEU', 'DERNIÈRE CONNEXION', 'RECORDS', ''];
  let cx = W / 2 - 480;
  heads.forEach((h, i) => { ctx.fillText(h, cx, 145); cx += cols[i]; });
  ctx.strokeStyle = 'rgba(239,83,80,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 480, 155); ctx.lineTo(W / 2 + 480, 155); ctx.stroke();

  for (let i = 0; i < MAX_SLOTS; i++) {
    const meta = slotMeta(i), s = slotSummary(i);
    const ry = 195 + i * 78;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
    roundRect(W / 2 - 490, ry - 26, 980, 70, 8); ctx.fill();
    cx = W / 2 - 480;
    ctx.font = 'bold 16px Consolas, monospace'; ctx.fillStyle = '#90a4ae';
    ctx.fillText(String(i + 1), cx, ry + 6); cx += cols[0];
    if (!meta) {
      ctx.font = '16px Inter, sans-serif'; ctx.fillStyle = '#546e7a';
      ctx.fillText('— emplacement vide —', cx, ry + 6);
      continue;
    }
    ctx.font = 'bold 17px Inter, sans-serif'; ctx.fillStyle = '#ffd740';
    ctx.fillText(meta.name, cx, ry + 6); cx += cols[1];
    ctx.font = '15px Inter, sans-serif'; ctx.fillStyle = '#e0e0e0';
    ctx.fillText(fmtPlaytime(s.playtime), cx, ry + 6); cx += cols[2];
    ctx.fillStyle = '#a89f7c';
    ctx.fillText(fmtDate(s.lastPlayed), cx, ry + 6); cx += cols[3];
    ctx.fillStyle = '#80cbc4';
    ctx.fillText(`Vague ${s.bestWave || 0} · ${s.totalKills || 0} kills`, cx, ry + 6); cx += cols[4];
    // bouton reset
    const confirming = G.resetConfirm === i;
    const rb = { x: cx, y: ry - 20, w: confirming ? 170 : 120, h: 36 };
    const hov = G.mouse.x >= rb.x && G.mouse.x <= rb.x + rb.w && G.mouse.y >= rb.y && G.mouse.y <= rb.y + rb.h;
    ctx.fillStyle = confirming ? 'rgba(183,28,28,0.85)' : (hov ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.15)');
    roundRect(rb.x, rb.y, rb.w, rb.h, 8); ctx.fill();
    ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1.5; roundRect(rb.x, rb.y, rb.w, rb.h, 8); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(confirming ? '⚠ CONFIRMER ?' : '🗑 RÉINITIALISER', rb.x + rb.w / 2, rb.y + 24);
  }

  // total + boutons
  const total = slots_playtime_total();
  ctx.textAlign = 'center'; ctx.fillStyle = '#78909c'; ctx.font = '14px Inter, sans-serif';
  ctx.fillText(`Temps de jeu cumulé sur l'appareil : ${fmtPlaytime(total)}`, W / 2, 500);

  // confirmation wipe global
  const wipe = { x: W - 260, y: H - 60, w: 230, h: 40 };
  const wipeConfirm = G.resetConfirm === 99;
  const whov = G.mouse.x >= wipe.x && G.mouse.x <= wipe.x + wipe.w && G.mouse.y >= wipe.y && G.mouse.y <= wipe.y + wipe.h;
  ctx.fillStyle = wipeConfirm ? 'rgba(183,28,28,0.9)' : (whov ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.15)');
  roundRect(wipe.x, wipe.y, wipe.w, wipe.h, 8); ctx.fill();
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1.5; roundRect(wipe.x, wipe.y, wipe.w, wipe.h, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText(wipeConfirm ? '⚠ TOUT EFFACER ?' : '☠ TOUT EFFACER', wipe.x + wipe.w / 2, wipe.y + 26);

  const back = { x: 30, y: H - 60, w: 160, h: 40 };
  const bhov = G.mouse.x >= back.x && G.mouse.x <= back.x + back.w && G.mouse.y >= back.y && G.mouse.y <= back.y + back.h;
  ctx.fillStyle = bhov ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)';
  roundRect(back.x, back.y, back.w, back.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; roundRect(back.x, back.y, back.w, back.h, 8); ctx.stroke();
  ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText('← PERSONNAGES', back.x + back.w / 2, back.y + 26);

  // ---- boutons utilitaires : tout débloquer + cooldowns désactivés ----
  const drawUtilBtn = (r, label, sub, color, active) => {
    const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w && G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
    ctx.fillStyle = active ? hexA(color, 0.35) : (hov ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)');
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = active ? color : (hov ? '#fff' : 'rgba(255,255,255,0.25)');
    ctx.lineWidth = active ? 2.5 : 1.5;
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.stroke();
    ctx.fillStyle = active ? color : '#fff'; ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(label, r.x + r.w / 2, r.y + 20);
    ctx.fillStyle = active ? color : '#90a4ae'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText(sub, r.x + r.w / 2, r.y + 37);
  };
  // bouton « tout débloqué » : VERT quand tout est débloqué (état persisté)
  // ou pendant les 3 s qui suivent le clic (flash de confirmation)
  const st = G.stats || {};
  const allDone = !!(st.campaignDone && st.campaignDone[0] && st.campaignDone[1] && st.campaignDone[2]
    && st.campaignDone[3] && st.campaignDone[4] && st.iceUlt && st.hellUlt && st.bowUnlocked);
  const justClicked = G.adminUnlockFx !== undefined && G.time - G.adminUnlockFx < 3;
  const unlockOn = allDone || justClicked;
  drawUtilBtn({ x: W / 2 - 280, y: H - 112, w: 270, h: 44 },
    unlockOn ? '✅ TOUT EST DÉBLOQUÉ' : '🔓 TOUT DÉBLOQUER',
    unlockOn ? 'campagnes · armes · objets · succès' : 'mondes + armes + objets + succès',
    unlockOn ? '#69f0ae' : '#ffd740', unlockOn);
  drawUtilBtn({ x: W / 2 + 10, y: H - 112, w: 270, h: 44 },
    G.adminNoCd ? '⚡ COOLDOWNS : ON' : '⚡ COOLDOWNS : OFF',
    'clic = activer / désactiver', G.adminNoCd ? '#69f0ae' : '#78909c', G.adminNoCd);
  // toast de confirmation (ex. « TOUT DÉBLOQUÉ ! »)
  if (G.adminMsg && G.time - G.adminMsg.t < 3) {
    const fade = Math.min(1, (3 - (G.time - G.adminMsg.t)) / 0.4);
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(20,16,4,0.92)';
    roundRect(W / 2 - 200, H - 178, 400, 46, 10); ctx.fill();
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2;
    roundRect(W / 2 - 200, H - 178, 400, 46, 10); ctx.stroke();
    ctx.fillStyle = '#ffd740'; ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(G.adminMsg.text, W / 2, H - 149);
    ctx.globalAlpha = 1;
  }
  drawPadlockAnim(); // cadenas qui s'ouvre si le mot de passe vient d'être validé
}
function slots_playtime_total() {
  let t = 0;
  for (let i = 0; i < MAX_SLOTS; i++) { const m = slotMeta(i); if (m) t += m.playtime; }
  return t;
}

// ==================== MENU DE TRICHE ADMIN (EN JEU) ====================
// Accessible uniquement si le mot de passe admin a été validé (adminOK).
// Le jeu est mis en pause tant qu'il est ouvert (voir main.js).

const ADMIN_BASE = [
  // [id, label, catégorie]
  ['xp',        '⭐ +2 000 XP',        'ress'],
  ['level',     '🌟 +3 NIVEAUX',       'ress'],
  ['hp',        '❤️ PV COMPLETS',      'ress'],
  ['maxhp',     '❤️ +25 PV MAX',       'ress'],
  ['ult',       '☢️ ULTIME 100 %',      'ress'],
  ['potions',   '🧪 +10 FIOLES',       'ress'],
  ['god',       '😇 INVINCIBLE',       'ress'],
  ['wave',      '🏰 +1 VAGUE',         'monde'],
  ['skip',      '⏩ PASSER LA VAGUE',   'monde'],
  ['killall',   '💀 TOUT TUER',        'monde'],
  ['unlockall', '🔓 TOUT DÉBLOQUER',   'monde'],
  ['relock',    '🔒 REVERROUILLER',    'monde'],
];
// apparitions adaptées à la campagne en cours
const SPAWN_C0 = [
  ['spawn_slime',   '🟢 Slime',        'spawn'],
  ['spawn_bat',     '🟣 Chauve-souris','spawn'],
  ['spawn_spider',  '🕷️ Araignée',     'spawn'],
  ['spawn_witch',   '🧙 Sorcière',     'spawn'],
  ['spawn_brute',   '🟠 Brute',        'spawn'],
  ['spawn_golem',   '🪨 Golem',        'spawn'],
  ['spawn_boss',    '👹 BOSS',         'spawn'],
  ['spawn_final',   '👑 BOSS FINAL',   'spawn']
];
const SPAWN_C1 = [
  ['spawn_yeti',    '🐺 Yéti',               'spawn'],
  ['spawn_hunter',  '🏹 Chasseur Gelé',       'spawn'],
  ['spawn_crypt',   '👾 Créature des Grottes','spawn'],
  ['spawn_glacier', '🧊 Géant des Glaces',    'spawn'],
  ['spawn_alpha',   '👹 Alpha des Neiges',    'spawn'],
  ['spawn_bossglace','❄️ Boss de Glace',     'spawn'],
  ['spawn_bosscryo','🧊 Souveraine Cryo',     'spawn'],
  ['spawn_final',   '☄️ SOUVERAIN DE GLACE',  'spawn']
];
const SPAWN_C2 = [
  ['spawn_imp',      '😈 Diablotin',          'spawn'],
  ['spawn_hound',    '🐺 Mastiff des Enfers', 'spawn'],
  ['spawn_cultist',  '🕯️ Acolyte',           'spawn'],
  ['spawn_demon',    '👿 Démon',              'spawn'],
  ['spawn_golem_enf','🌋 Golem de Braise',    'spawn'],
  ['spawn_boss_enf', '😈 Démon Seigneur',     'spawn'],
  ['spawn_priest',   '🧛 Prêtre des Enfers',  'spawn'],
  ['spawn_final',    '🔥 LE BARON DE L\'ENFER','spawn']
];
const SPAWN_C3 = [
  ['spawn_rat',      '🐀 Rat Géant',          'spawn'],
  ['spawn_crapaud',  '🐸 Crapaud',            'spawn'],
  ['spawn_ver',      '🪱 Ver des Profondeurs','spawn'],
  ['spawn_vase',     '🫙 Vase Toxique',       'spawn'],
  ['spawn_chanter',  '🎵 Chanteur',           'spawn'],
  ['spawn_matr',     '👑 Matriarche',         'spawn'],
  ['spawn_bossegout','👑 Roi des Rats',       'spawn'],
  ['spawn_final',    '☣️ LE TYRAN DES PROFONDEURS','spawn']
];
const SPAWN_C4 = [
  ['spawn_alien',    '👽 Alien Rampant',      'spawn'],
  ['spawn_drone',    '🛸 Drone de Chasse',    'spawn'],
  ['spawn_tentacule','🦑 Tentacule',          'spawn'],
  ['spawn_cristal',  '💎 Cristal Vivant',     'spawn'],
  ['spawn_overlord', '👑 Dominator',          'spawn'],
  ['spawn_bossvoid', '🛸 Seigneur Stellaire', 'spawn'],
  ['spawn_bossv2',   '👾 Overlord',           'spawn'],
  ['spawn_final',    '🕳️ L\'ABOMINATION COSMIQUE','spawn']
];
function adminCheats() {
  return [...ADMIN_BASE, ...(G.campaign === 4 ? SPAWN_C4 : G.campaign === 3 ? SPAWN_C3 : G.campaign === 2 ? SPAWN_C2 : G.campaign === 1 ? SPAWN_C1 : SPAWN_C0)];
}
const SPAWN_TYPES = {
  spawn_slime: 'slime', spawn_bat: 'bat', spawn_spider: 'spider',
  spawn_witch: 'witch', spawn_brute: 'brute', spawn_golem: 'golem',
  spawn_yeti: 'yeti', spawn_hunter: 'hunter', spawn_crypt: 'crypt',
  spawn_glacier: 'glacier', spawn_alpha: 'alpha',
  spawn_bossglace: 'bossGlace', spawn_bosscryo: 'bossCryo',
  spawn_imp: 'imp', spawn_hound: 'hound', spawn_cultist: 'cultist',
  spawn_demon: 'demon', spawn_golem_enf: 'golemEnf',
  spawn_boss_enf: 'bossEnf', spawn_priest: 'priest',
  spawn_rat: 'rat', spawn_crapaud: 'crapaud', spawn_ver: 'ver',
  spawn_vase: 'vase', spawn_chanter: 'chanter', spawn_matr: 'matriarche',
  spawn_bossegout: 'bossEgout',
  spawn_alien: 'alien', spawn_drone: 'drone', spawn_tentacule: 'tentacule',
  spawn_cristal: 'cristal', spawn_overlord: 'overlord',
  spawn_bossvoid: 'bossVoid', spawn_bossv2: 'overlord'
};

function adminCheatRects() {
  // panneau centré : 3 colonnes de catégories
  const pw = 620, ph = 500, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
  const cheats = adminCheats();
  const cats = ['ress', 'monde', 'spawn'];
  const cols = cats.map((c, i) => ({ cat: c, x: px + 20 + i * ((pw - 40) / 3), w: (pw - 40) / 3 - 12 }));
  const btns = {};
  for (const c of cheats) {
    const col = cols.find(cc => cc.cat === (c[2] === 'ress' ? 'ress' : c[2] === 'monde' ? 'monde' : 'spawn'));
    const idx = cheats.filter(o => o[2] === c[2]).indexOf(c);
    const rowH = 40, top = py + 66;
    btns[c[0]] = { x: col.x + 6, y: top + idx * (rowH + 8), w: col.w - 12, h: rowH };
  }
  return { px, py, pw, ph, btns, close: { x: px + pw - 44, y: py + 10, w: 32, h: 32 } };
}

export function adminMenuClickAt(x, y) {
  const L = adminCheatRects();
  if (inR(L.close, x, y)) { G.adminMenu = false; return 'close'; }
  for (const c of adminCheats()) {
    if (inR(L.btns[c[0]], x, y)) { applyAdminCheat(c[0]); return c[0]; }
  }
  return 'inside';
}

function applyAdminCheat(id) {
  const p = G.player;
  switch (id) {
    case 'xp': gainXp(2000); break;
    case 'level': for (let i = 0; i < 3; i++) gainXp(p.xpNext); break;
    case 'hp': p.hp = p.maxHp; break;
    case 'maxhp': p.maxHp += 25; p.hp = p.maxHp; break;
    case 'ult': p.ultCharge = 100; break;
    case 'potions': p.potions = p.maxPotions; break;
    case 'god': G.godMode = !G.godMode; break;
    case 'wave':
      if (G.wave >= finalWave()) break; // pas au-delà de la vague finale
      G.wave++;
      G.waveKills = 0;
      G.waveTarget = 6 + G.wave * 2;
      G.wavePause = 2.5;
      break;
    case 'skip':
      // complète le quota de la vague en cours -> transition immédiate
      // (impossible à la vague finale : le boss doit être vaincu)
      if (G.wave < finalWave()) G.waveKills = G.waveTarget;
      break;
    case 'killall':
      for (const e of [...G.enemies]) { e.hp = 0; }
      break;
    case 'unlockall': // même effet que le bouton du panneau admin : tout débloqué + sauvegardé
      adminUnlockAll();
      G.warnToast = { name: '🔓 TOUT DÉBLOQUÉ !', t: 6 };
      break;
    case 'relock':
      adminLock(); // le mot de passe sera redemandé à la prochaine ouverture
      G.adminMenu = false;
      break;
    default:
      if (SPAWN_TYPES[id]) {
        for (let i = 0; i < 3; i++) spawnEnemy(SPAWN_TYPES[id]);
      } else if (id === 'spawn_boss') {
        spawnEnemy(G.campaign === 4 ? 'bossVoid' : G.campaign === 3 ? 'bossEgout' : G.campaign === 2 ? 'bossEnf' : G.campaign === 1 ? 'bossGlace' : 'boss'); // boss adapté à la campagne
      } else if (id === 'spawn_final') {
        spawnFinalBoss(); // le vrai boss final de la campagne
      }
  }
}

// ---------- bouton admin 🛠 (tout en haut à droite) ----------
export const ADMIN_BTN = { x: W - 96, y: 8, w: 88, h: 34 };
export function adminButtonAt(x, y) {
  const r = ADMIN_BTN;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
export function drawAdminButton() {
  const r = ADMIN_BTN;
  const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w &&
              G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
  const unlocked = adminUnlocked();
  ctx.save();
  ctx.fillStyle = G.adminMenu ? 'rgba(120,20,20,0.95)' : (unlocked ? (hov ? 'rgba(90,20,20,0.95)' : 'rgba(60,14,14,0.9)') : 'rgba(30,30,34,0.85)');
  ctx.strokeStyle = unlocked ? '#ef5350' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = (hov || G.adminMenu) ? 3 : 2;
  ctx.shadowColor = unlocked ? 'rgba(239,83,80,0.8)' : 'transparent';
  ctx.shadowBlur = hov ? 18 : 8;
  const rad = 10;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + rad);
  ctx.quadraticCurveTo(r.x, r.y, r.x + rad, r.y);
  ctx.lineTo(r.x + r.w - rad, r.y);
  ctx.quadraticCurveTo(r.x + r.w, r.y, r.x + r.w, r.y + rad);
  ctx.lineTo(r.x + r.w, r.y + r.h - rad);
  ctx.quadraticCurveTo(r.x + r.w, r.y + r.h, r.x + r.w - rad, r.y + r.h);
  ctx.lineTo(r.x + rad, r.y + r.h);
  ctx.quadraticCurveTo(r.x, r.y + r.h, r.x, r.y + r.h - rad);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.font = unlocked ? 'bold 15px Inter, sans-serif' : 'bold 12px Inter, sans-serif';
  ctx.fillStyle = unlocked ? '#ffcdd2' : '#78909c';
  ctx.fillText(unlocked ? '🛠 ADMIN' : '🔒 ADMIN', r.x + r.w / 2, r.y + r.h / 2 + 5);
  ctx.restore();
}

// animation du cadenas qui s'ouvre après un bon mot de passe admin (~1,4 s)
function drawPadlockAnim() {
  const t = G.time - G.adminUnlockT;
  if (t < 0 || t > 1.4) return;
  const cx = W / 2, cy = H / 2 - 60;
  const open = Math.min(1, t / 0.7);          // 0 -> 1 : le pêne se soulève
  const fade = t > 1.0 ? (1.4 - t) / 0.4 : 1; // fondu final
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(cx, cy);
  // halo
  const hg = ctx.createRadialGradient(0, 0, 10, 0, 0, 130);
  hg.addColorStop(0, `rgba(255,215,64,${0.35 * fade})`); hg.addColorStop(1, 'rgba(255,215,64,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, 0, 130, 0, TAU); ctx.fill();
  // anse (pêne) : pivote et se soulève
  ctx.save();
  ctx.translate(-16, -8);
  ctx.rotate(-open * 0.9);
  ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(16, -14, 16, Math.PI, 0); ctx.stroke();
  ctx.restore();
  // corps du cadenas
  ctx.fillStyle = '#ffd740';
  roundRect(-26, -8, 52, 44, 8); ctx.fill();
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2;
  roundRect(-26, -8, 52, 44, 8); ctx.stroke();
  // trou de serrure + reflet
  ctx.fillStyle = '#3e2723';
  ctx.beginPath(); ctx.arc(0, 8, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(-9, -2, 4, 0, TAU); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.shadowColor = 'rgba(255,215,64,0.9)'; ctx.shadowBlur = 16;
  ctx.fillText('🔓 ACCÈS AUTORISÉ', 0, 62);
  ctx.restore();
}

export function drawAdminMenu() {
  // saisie du mot de passe admin en jeu : prompt par-dessus le jeu (en pause)
  if (G.adminInput) { drawAdminPwInput(); return; }
  if (!G.adminMenu) return;
  // l'animation du cadenas joue D'ABORD : le panneau de triche s'ouvre après
  const at = G.time - G.adminUnlockT;
  if (at >= 0 && at < 1.4) { drawPadlockAnim(); return; }
  const L = adminCheatRects();
  // voile sombre mais transparent (le jeu est en pause derrière)
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(12,6,6,0.97)';
  roundRect(L.px, L.py, L.pw, L.ph, 14); ctx.fill();
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(239,83,80,0.5)'; ctx.shadowBlur = 16;
  roundRect(L.px, L.py, L.pw, L.ph, 14); ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('🛠 MENU ADMIN', W / 2, L.py + 36);
  ctx.fillStyle = '#78909c'; ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`Triche — ${G.campaign === 4 ? 'L\'ESPACE 🛸' : G.campaign === 3 ? 'LES ÉGOUTS 🗑️' : G.campaign === 2 ? 'LES ENFERS 🔥' : G.campaign === 1 ? 'LA TERRE GELÉE ❄️' : 'LES TERRES OUBLIÉES 🌿'} • jeu en pause • \` pour fermer`, W / 2, L.py + 56);

  // titres de colonnes (le premier bouton 'spawn' varie selon la campagne)
  const catTitles = { ress: '⚡ RESSOURCES', monde: '🌍 MONDE', spawn: '👾 APPARAÎTRE' };
  const firstSpawn = adminCheats().find(c => c[2] === 'spawn')[0];
  const colX = [L.btns.xp.x - 6, L.btns.wave.x - 6, L.btns[firstSpawn].x - 6];
  const colW = [L.btns.xp.w + 12, L.btns.wave.w + 12, L.btns[firstSpawn].w + 12];
  ['ress', 'monde', 'spawn'].forEach((c, i) => {
    ctx.fillStyle = '#ffd740'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(catTitles[c], colX[i] + colW[i] / 2, L.py + 84);
    ctx.strokeStyle = 'rgba(255,215,64,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(colX[i], L.py + 92); ctx.lineTo(colX[i] + colW[i], L.py + 92); ctx.stroke();
  });

  // boutons
  for (const c of adminCheats()) {
    const r = L.btns[c[0]];
    const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w && G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
    const active = (c[0] === 'god' && G.godMode);
    ctx.fillStyle = active ? 'rgba(76,175,80,0.55)' : (hov ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.14)');
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = active ? '#81c784' : (hov ? '#ff8a80' : 'rgba(239,83,80,0.5)');
    ctx.lineWidth = hov ? 2 : 1.2;
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.fillStyle = active ? '#c8e6c9' : '#fff';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(c[1] + (active ? ' ✓' : ''), r.x + r.w / 2, r.y + r.h / 2 + 5);
  }

  // bouton fermer
  const cl = L.close, chov = G.mouse.x >= cl.x && G.mouse.x <= cl.x + cl.w && G.mouse.y >= cl.y && G.mouse.y <= cl.y + cl.h;
  ctx.fillStyle = chov ? 'rgba(239,83,80,0.8)' : 'rgba(239,83,80,0.3)';
  roundRect(cl.x, cl.y, cl.w, cl.h, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillText('✕', cl.x + cl.w / 2, cl.y + 23);
  drawPadlockAnim(); // cadenas qui s'ouvre si le mot de passe vient d'être validé
}

