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
import { pickCharacter } from './flow.js';

// ==================== SÉLECTION DES PERSONNAGES ====================
// 3 emplacements : carte remplie = héros existant, carte vide = création
function charCards() {
  const cw = 350, ch = 425, gap = 30, y = 145;
  const total = cw * MAX_SLOTS + gap * (MAX_SLOTS - 1);
  const x0 = W / 2 - total / 2;
  return Array.from({ length: MAX_SLOTS }, (_, i) => ({
    x: x0 + i * (cw + gap), y, w: cw, h: ch,
    play:  { x: x0 + i * (cw + gap) + 30, y: y + ch - 66, w: 92, h: 40 },
    menu:  { x: x0 + i * (cw + gap) + 132, y: y + ch - 66, w: 92, h: 40 },
    reset: { x: x0 + i * (cw + gap) + 234, y: y + ch - 66, w: 86, h: 40 },
    gear: { x: W - 66, y: H - 66, w: 46, h: 46 }
  }));
}

export function charClickAt(x, y) {
  // modale de confirmation de reset prioritaire
  if (G.resetConfirm >= 0) {
    const m = resetModalRect();
    if (inR(m.no, x, y)) { G.resetConfirm = -1; return 'cancel'; }
    if (inR(m.yes, x, y)) {
      const i = G.resetConfirm; G.resetConfirm = -1;
      if (activeSlot() === i) deselectChar();
      resetChar(i); sfxClick(); return 'reset';
    }
    return 'modal';
  }
  // saisie du nom : clic = rien (la validation se fait au clavier)
  if (G.charInput) return 'input';
  const cards = charCards();
  for (let i = 0; i < MAX_SLOTS; i++) {
    const c = cards[i], meta = slotMeta(i);
    if (meta) {
      if (inR(c.play, x, y)) { pickCharacter(i); G.menuView = 'campaign'; G.campaignSel = G.campaign || 0; return 'play'; }
      if (inR(c.menu, x, y)) { pickCharacter(i); G.menuView = 'main'; return 'menu'; }
      if (inR(c.reset, x, y)) { G.resetConfirm = i; return 'askreset'; }
      // clic sur la carte (hors boutons) = sélection → menu principal
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        pickCharacter(i); G.menuView = 'main'; return 'select';
      }
    } else {
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        G.charInput = { slot: i, text: `ma survie ${i + 1}` }; return 'new';
      }
    }
  }
  if (inR(cards[0].gear, x, y)) {
    if (adminUnlocked()) { G.menuView = 'admin'; return 'admin'; }
    G.adminInput = { text: '' }; G.adminPwErr = false; return 'adminpw';
  }
  return null;
}

function resetModalRect() {
  const w = 460, h = 210, x = W / 2 - w / 2, y = H / 2 - h / 2;
  return {
    x, y, w, h,
    yes: { x: W / 2 - 170, y: y + h - 62, w: 150, h: 44 },
    no:  { x: W / 2 + 20,  y: y + h - 62, w: 150, h: 44 }
  };
}

export function drawCharacters() {
  ctx.textAlign = 'center';

  // titre
  overlineCentered('SÉLECTION DU PERSONNAGE', W / 2, 48);
  ctx.save();
  ctx.font = `600 38px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = C_TEXT;
  ctx.fillText('CHOISISSEZ VOTRE HÉROS', W / 2, 90);
  ctx.restore();
  ctx.fillStyle = C_MUTED; ctx.font = `14px ${UI}`;
  ctx.fillText(`${MAX_SLOTS} emplacements — chaque héros possède sa propre sauvegarde`, W / 2, 118);

  const cards = charCards();
  for (let i = 0; i < MAX_SLOTS; i++) {
    const c = cards[i], meta = slotMeta(i);
    const hov = inR(c, G.mouse.x, G.mouse.y);
    // carte
    ctx.fillStyle = hov ? 'rgba(22,24,27,0.95)' : 'rgba(15,17,19,0.93)';
    roundRect(c.x, c.y, c.w, c.h, 14); ctx.fill();
    ctx.strokeStyle = hov ? 'rgba(212,176,98,0.6)' : 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    roundRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, 14); ctx.stroke();

    if (!meta) {
      // emplacement vide
      const mx = c.x + c.w / 2, my = c.y + c.h / 2 - 34;
      ctx.strokeStyle = hov ? C_GOLD : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my); ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my + 9); ctx.stroke();
      ctx.fillStyle = hov ? C_TEXT : '#a39d8e';
      ctx.font = `600 17px ${UI}`;
      ctx.fillText('Nouvelle aventure', mx, c.y + c.h / 2 + 22);
      ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
      ctx.fillText('Cliquez pour créer un héros', mx, c.y + c.h / 2 + 46);
      continue;
    }

    const s = slotSummary(i);
    const mx = c.x + c.w / 2;
    // monogramme du héros
    ctx.fillStyle = 'rgba(212,176,98,0.08)';
    ctx.beginPath(); ctx.arc(mx, c.y + 78, 36, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(212,176,98,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = C_GOLD; ctx.font = `600 30px ${SERIF}`;
    ctx.fillText((meta.name.trim()[0] || '?').toUpperCase(), mx, c.y + 89);
    // nom + badge "en cours" si c'est le personnage actif
    ctx.fillStyle = C_TEXT; ctx.font = `600 22px ${UI}`;
    ctx.fillText(fitText(meta.name, c.w - 48), mx, c.y + 150);
    if (activeSlot() === i) {
      ctx.font = `600 10px ${UI}`;
      const bw = 84;
      ctx.fillStyle = 'rgba(105,240,174,0.1)';
      roundRect(mx - bw / 2, c.y + 162, bw, 20, 10); ctx.fill();
      ctx.save(); ctx.letterSpacing = '1.5px';
      ctx.fillStyle = '#7ed9a8'; ctx.fillText('EN COURS', mx + 1, c.y + 176);
      ctx.restore();
    }
    // stats
    const rows = [
      ['Temps de jeu', fmtPlaytime(s.playtime)],
      ['Dernière connexion', fmtDate(s.lastPlayed)],
      ['Meilleure vague', s.bestWave || '—'],
      ['Ennemis vaincus', s.totalKills || '—'],
      ['Niveau max', s.bestLevel || '—'],
      ['Parties jouées', s.totalRuns || '—']
    ];
    rows.forEach((r, j) => {
      const ry = c.y + 214 + j * 25;
      if (j) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(c.x + 30, ry - 17, c.w - 60, 1); }
      ctx.textAlign = 'left'; ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
      ctx.fillText(r[0], c.x + 30, ry);
      ctx.textAlign = 'right'; ctx.font = `600 13px ${UI}`; ctx.fillStyle = C_TEXT;
      ctx.fillText(fitText(String(r[1]), 150), c.x + c.w - 30, ry);
    });
    ctx.textAlign = 'center';
    // boutons JOUER / MENU / RÉINITIALISER
    drawMiniButton(c.play, 'JOUER', C_GOLD, C_GOLD, true);
    drawMiniButton(c.menu, 'MENU', '#90a4ae', '#cfd8dc');
    drawMiniButton(c.reset, 'RESET', '#e57373', '#ef9a9a');
  }

  // entrée admin discrète (engrenage en bas à droite)
  const gear = cards[0].gear, ghov = inR(gear, G.mouse.x, G.mouse.y);
  ctx.fillStyle = ghov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
  roundRect(gear.x, gear.y, gear.w, gear.h, 10); ctx.fill();
  ctx.strokeStyle = ghov ? 'rgba(212,176,98,0.6)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  roundRect(gear.x + 0.5, gear.y + 0.5, gear.w - 1, gear.h - 1, 10); ctx.stroke();
  ctx.fillStyle = ghov ? C_GOLD : '#6f7378'; ctx.font = `20px ${UI}`;
  ctx.fillText('⚙', gear.x + gear.w / 2, gear.y + 30);

  // saisie du nom / modale reset / panneau mot de passe admin par-dessus
  if (G.charInput) drawNameInput();
  if (G.adminInput && !adminUnlocked()) drawAdminPwInput();
  if (G.resetConfirm >= 0) drawResetModal();
}

function drawMiniButton(r, label, c1, c2, primary) {
  const hov = inR(r, G.mouse.x, G.mouse.y);
  ctx.save();
  if (primary) {
    ctx.fillStyle = hexA(c1, hov ? 1 : 0.9);
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  } else {
    ctx.fillStyle = hexA(c1, hov ? 0.16 : 0.06);
    roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = hexA(c2, hov ? 0.6 : 0.25); ctx.lineWidth = 1;
    roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 8); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.font = `600 12px ${UI}`; ctx.letterSpacing = '1.5px';
  ctx.fillStyle = primary ? (c1 === C_GOLD ? '#16130c' : '#fff') : (hov ? '#fff' : hexA(c2, 0.95));
  ctx.fillText(label, r.x + r.w / 2 + 1, r.y + r.h / 2 + 4.5);
  ctx.restore();
}

function drawNameInput() {
  const inp = G.charInput, meta = slotMeta(inp.slot);
  const w = 480, h = 190, x = W / 2 - w / 2, y = H / 2 - h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8,14,10,0.97)';
  roundRect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2;
  roundRect(x, y, w, h, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd740'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('NOUVEAU HÉROS', W / 2, y + 42);
  ctx.fillStyle = '#a89f7c'; ctx.font = '14px Inter, sans-serif';
  ctx.fillText(`Emplacement ${inp.slot + 1} — tapez un nom (Entrée pour valider)`, W / 2, y + 68);
  // champ texte
  const fx = x + 40, fy = y + 88, fw = w - 80, fh = 44;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(fx, fy, fw, fh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
  roundRect(fx, fy, fw, fh, 8); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Inter, sans-serif';
  const shown = inp.text + (Math.floor(G.time * 2.5) % 2 === 0 ? '|' : ' ');
  ctx.fillText(shown || ' ', fx + 14, fy + 30);
  ctx.textAlign = 'center'; ctx.fillStyle = '#78909c'; ctx.font = '13px Inter, sans-serif';
  ctx.fillText('Échap pour annuler', W / 2, y + h - 18);
}

function drawResetModal() {
  const i = G.resetConfirm, meta = slotMeta(i);
  const m = resetModalRect();
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(16,6,6,0.97)';
  roundRect(m.x, m.y, m.w, m.h, 14); ctx.fill();
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 2;
  roundRect(m.x, m.y, m.w, m.h, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('RÉINITIALISER LE HÉROS ?', W / 2, m.y + 48);
  ctx.fillStyle = '#e0e0e0'; ctx.font = '15px Inter, sans-serif';
  ctx.fillText(`« ${meta ? meta.name : ''} » — toutes ses données seront`, W / 2, m.y + 82);
  ctx.fillText('définitivement effacées (inventaire, succès, mondes, stats).', W / 2, m.y + 106);
  ctx.fillStyle = '#ffb74d'; ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText('Cette action est irréversible.', W / 2, m.y + 132);
  drawMiniButton(m.no, 'ANNULER', '#455a64', '#90a4ae');
  drawMiniButton(m.yes, 'CONFIRMER', '#c62828', '#ef9a9a', true);
}

