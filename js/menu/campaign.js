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
import { startGame } from './flow.js';

// ==================== SÉLECTION DE CAMPAGNE (v2.0.0) ====================
// Grande carte : deux campagnes reliées par un chemin. La campagne 2
// (The Frozen Land) se débloque après avoir vaincu le boss final de la 1.


const CAMPAIGN_INFO = {
  0: {
    icon: '🌿', diff: '★ NORMAL', diffColor: '#69f0ae',
    desc: 'Les Terres Oubliées : plaines verdoyantes, ruines anciennes et la sombre tanière du Seigneur Oublié. Vainquez-le pour découvrir ce qui se cache au-delà.',
    boss: 'Seigneur Oublié', worlds: '2 mondes · 20 vagues'
  },
  1: {
    icon: '🏰', diff: '★★ MOYEN', diffColor: '#ffd740',
    desc: 'La Terre Gelée : une étendue enneigée hostile. Prédateurs des neiges, géants de glace, créatures des grottes et tempêtes mortelles. Le Souverain de Glace vous attend au sommet — et un coffre vous attend après lui.',
    boss: 'Souverain de Glace', worlds: '2 mondes · 25 vagues · boss exclusifs'
  },
  2: {
    icon: '🔥', diff: '★★★ DIFFICILE', diffColor: '#ff7043',
    desc: 'Les Enfers : un royaume de braise et de damnation. Diablotins, mâtifs enragés, acolytes, démons et golems de lave. Le Baron de l\'Enfer vous attend sur son trône de cendres — et un pouvoir infernal vous attend après lui.',
    boss: 'Le Baron de l\'Enfer', worlds: '2 mondes · 30 vagues · boss dès la vague 20'
  },
  3: {
    icon: '🗑️', diff: '★★★★ TRÈS DIFFICILE', diffColor: '#aeea00',
    desc: 'Les Égouts : les profondeurs putrides sous la ville. Rats géants, crapauds, vers des profondeurs, vases toxiques et chanters démoniaques. Le Tyran des Profondeurs règne sur les flots d\'acide.',
    boss: 'Le Tyran des Profondeurs', worlds: '2 mondes · 35 vagues · boss dès la vague 25'
  },
  4: {
    icon: '🛸', diff: '★★★★★ EXPERT', diffColor: '#b388ff',
    desc: 'L\'Espace : un avant-poste perdu à des années-lumière de la Terre. Aliens rampants, drones de chasse, tentacules stellaires et cristaux vivants. L\'Abomination Cosmique dévore les étoiles.',
    boss: 'L\'Abomination Cosmique', worlds: '2 mondes · 40 vagues · boss dès la vague 30'
  }
};

const CAMP_NAMES = ['LES TERRES OUBLIÉES', 'LA TERRE GELÉE', 'LES ENFERS', 'LES ÉGOUTS', 'L\'ESPACE'];
const CAMP_COLORS = ['76,175,80', '79,195,247', '255,87,34', '174,234,0', '179,157,219'];
const CAMP_TINTS = ['#1b3a24', '#123047', '#3a1408', '#1a2e00', '#170a2e'];
const CAMP_TEXT = ['#a5d6a7', '#b3e5fc', '#ffab91', '#dce775', '#e1bee7'];

function campaignNodes() {
  // 5 campagnes en zigzag : la carte s'élargit vers la droite
  return {
    0: { x: W / 2 - 520, y: 280, r: 58 },
    1: { x: W / 2 - 260, y: 205, r: 58 },
    2: { x: W / 2,      y: 280, r: 58 },
    3: { x: W / 2 + 260, y: 205, r: 58 },
    4: { x: W / 2 + 520, y: 280, r: 58 }
  };
}
// fiche détaillée + bouton jouer (géométrie partagée dessin / clic)
function campaignFiche() { return { x: W / 2 - 360, y: H / 2 + 92, w: 720, h: 148 }; }
function campaignPlayBtn() {
  const f = campaignFiche();
  return { x: f.x + f.w - 236, y: f.y + 52, w: 212, h: 44 };
}

export function campaignClickAt(x, y) {
  const N = campaignNodes();
  const back = { x: 30, y: H - 60, w: 160, h: 40 };
  if (inR(back, x, y)) { G.menuView = 'main'; return 'back'; }
  const play = campaignPlayBtn();
  if (inR(play, x, y)) {
    const c = G.campaignSel;
    if (c !== null && c !== undefined && campaignUnlocked(c)) {
      G.campaign = c;
      startGame(); // lance directement (popup durabilité possible par-dessus)
      return 'play';
    }
    return 'locked';
  }
  for (const c of [0, 1, 2, 3, 4]) {
    const n = N[c];
    if (Math.hypot(x - n.x, y - n.y) < n.r + 26) { G.campaignSel = c; return 'select'; }
  }
  return null;
}

function wrapText(text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); line = w; yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawCampaign() {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a1a12'); bg.addColorStop(0.5, '#081420'); bg.addColorStop(1, '#040a14');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd740'; ctx.font = '600 44px Inter, sans-serif';
  ctx.shadowColor = 'rgba(255,215,64,0.4)'; ctx.shadowBlur = 18;
  ctx.fillText('🗺️  CAMPAGNES', W / 2, 74);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#a89f7c'; ctx.font = 'italic 15px Inter, sans-serif';
  ctx.fillText('Choisissez votre terrain de chasse — chaque campagne a ses mondes, ses monstres et son boss', W / 2, 104);

  const N = campaignNodes();
  const sel = G.campaignSel === undefined ? null : G.campaignSel;

  // chemin pointillé animé reliant les cinq îles en chaîne
  const seg = (a, b) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 55;
    ctx.save();
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = -G.time * 30;
    ctx.strokeStyle = 'rgba(255,215,64,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
    ctx.restore();
    return { mx, my };
  };
  for (let i = 0; i < 4; i++) {
    const s = seg(N[i], N[i + 1]);
    if (campaignUnlocked(i + 1)) {
      ctx.fillStyle = '#ffd740'; ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText('✓', s.mx, s.my + 8);
    }
  }

  for (const c of [0, 1, 2, 3, 4]) {
    const n = N[c], info = CAMPAIGN_INFO[c], unlocked = campaignUnlocked(c);
    const isSel = sel === c;
    const hc = CAMP_COLORS[c];
    const hg = ctx.createRadialGradient(n.x, n.y, n.r * 0.4, n.x, n.y, n.r * 1.5);
    hg.addColorStop(0, `rgba(${hc},${isSel ? 0.4 : 0.18})`); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = unlocked ? CAMP_TINTS[c] : '#1a1a1e';
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = isSel ? '#ffd740' : (unlocked ? `rgba(${hc},0.7)` : 'rgba(255,255,255,0.15)');
    ctx.lineWidth = isSel ? 4 : 2;
    ctx.stroke();
    ctx.font = `${n.r * 0.6}px serif`;
    ctx.globalAlpha = unlocked ? 1 : 0.35;
    ctx.fillText(info.icon, n.x, n.y + n.r * 0.22);
    ctx.globalAlpha = 1;
    if (!unlocked) {
      ctx.font = '34px serif';
      ctx.fillText('🔒', n.x, n.y - n.r * 0.55);
      ctx.fillStyle = '#78909c'; ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(`TERMINER LA CAMPAGNE ${c}`, n.x, n.y + n.r + 22);
    }
    ctx.fillStyle = unlocked ? '#fff' : '#546e7a'; ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText(CAMP_NAMES[c], n.x, n.y - n.r - 14);
    ctx.fillStyle = unlocked ? info.diffColor : '#455a64'; ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(info.diff, n.x, n.y + n.r + (unlocked ? 40 : 42));
    if (isSel) {
      ctx.fillStyle = '#ffd740'; ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('▼ sélectionnée', n.x, n.y + n.r + 58);
    }
  }

  // fiche détaillée
  const c = sel === null ? 0 : sel;
  const info = CAMPAIGN_INFO[c], unlocked = campaignUnlocked(c);
  const f = campaignFiche();
  const fx = f.x, fy = f.y, fw = f.w, fh = f.h;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(fx, fy, fw, fh, 14); ctx.fill();
  ctx.strokeStyle = `rgba(${CAMP_COLORS[c]},0.6)`; ctx.lineWidth = 2;
  roundRect(fx, fy, fw, fh, 14); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = CAMP_TEXT[c]; ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillText(`${info.icon}  ${CAMP_NAMES[c]}`, fx + 26, fy + 34);
  ctx.fillStyle = info.diffColor; ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText(info.diff, fx + fw - 26 - ctx.measureText(info.diff).width, fy + 32);
  ctx.fillStyle = '#cfd8dc'; ctx.font = '14px Inter, sans-serif';
  wrapText(info.desc, fx + 26, fy + 62, fw - 320, 18);
  ctx.fillStyle = '#78909c'; ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`Boss final : ${info.boss}  ·  ${info.worlds}`, fx + 26, fy + fh - 14);

  const pb = campaignPlayBtn();
  ctx.save();
  if (!unlocked) ctx.globalAlpha = 0.55;
  ctx.fillStyle = unlocked ? 'rgba(76,175,80,0.85)' : 'rgba(80,80,80,0.6)';
  roundRect(pb.x, pb.y, pb.w, pb.h, 10); ctx.fill();
  ctx.strokeStyle = unlocked ? '#81c784' : '#546e7a'; ctx.lineWidth = 2;
  roundRect(pb.x, pb.y, pb.w, pb.h, 10); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(unlocked ? `▶  JOUER — CAMPAGNE ${c + 1}` : '🔒  CAMPAGNE VERROUILLÉE', pb.x + pb.w / 2, pb.y + 28);
  ctx.restore();
  const back = { x: 30, y: H - 60, w: 160, h: 40 };
  const bhov = inR(back, G.mouse.x, G.mouse.y);
  ctx.fillStyle = bhov ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)';
  roundRect(back.x, back.y, back.w, back.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
  roundRect(back.x, back.y, back.w, back.h, 8); ctx.stroke();
  ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('← MENU', back.x + back.w / 2, back.y + 26);
}
