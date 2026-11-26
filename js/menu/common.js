// js/menu/common.js — helpers et constantes partagés des menus
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, drawMatIcon, drawItemIcon, itemTier } from '../utils.js';
import { adminOK as _adminOK } from '../chars.js';
import { sfxHover } from '../audio.js';

export function adminUnlocked() { return _adminOK; }
// Géométrie des boutons du menu (partagée avec le hit-test)
export const MENU_X = 96, MENU_W = 300;
export const MENU_ITEMS = [
  ['play', 'JOUER'], ['perso', 'HÉROS'], ['forge', 'FORGE'],
  ['tutoriel', 'TUTORIEL'], ['quests', 'QUÊTES'], ['stats', 'STATISTIQUES'], ['modules', 'MODULES'], ['ach', 'SUCCÈS']
];
export function menuButtons() {
  const b = {};
  let y = 262;
  MENU_ITEMS.forEach(([k], i) => {
    const h = i === 0 ? 48 : 40;
    b[k] = { x: MENU_X, y, w: MENU_W, h };
    y += h + (i === 0 ? 10 : 4);
  });
  b.back = { x: W / 2 - 140, y: H / 2 + 245, w: 280, h: 54 };
  return b;
}

export function menuButtonAt(x, y) {
  const b = menuButtons();
  if (G.menuView === 'stats' || G.menuView === 'achievements' || G.menuView === 'modules' || G.menuView === 'quests' || G.menuView === 'card') {
    return inR(b.back, x, y) ? 'back' : null;
  }
  for (const [k] of MENU_ITEMS) if (inR(b[k], x, y)) return k;
  return null;
}

export const UI = 'Inter, sans-serif';
export const SERIF = 'Cinzel, Georgia, serif';
export const C_TEXT = '#efe8d6', C_MUTED = '#8f8a7e', C_GOLD = '#d4b062';

export function overline(text, x, y, color = C_GOLD) {
  ctx.save();
  ctx.font = `600 11px ${UI}`; ctx.letterSpacing = '3px';
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}

export function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12); ctx.stroke();
}

// bouton générique sobre (retour, pause, popups) : plein si primary, sinon contour
export function drawMenuButton(r, label, c1, c2, primary) {
  const hov = inR(r, G.mouse.x, G.mouse.y);
  // micro-son de survol : une seule fois par bouton survolé
  const hid = label + '@' + Math.round(r.x) + ',' + Math.round(r.y);
  if (hov && G._uiHov !== hid) { G._uiHov = hid; sfxHover(); }
  else if (!hov && G._uiHov === hid) G._uiHov = null;
  ctx.save();
  if (primary) {
    ctx.fillStyle = hexA(c1, hov ? 1 : 0.88);
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
  } else {
    ctx.fillStyle = hov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = hov ? hexA(c2, 0.7) : 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
    roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 10); ctx.stroke();
  }
  const fs = r.h < 50 ? 13 : 15;
  ctx.textAlign = 'center';
  ctx.font = `600 ${fs}px ${UI}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = primary ? (c1 === C_GOLD ? '#16130c' : '#fff') : (hov ? C_TEXT : '#cfc8b6');
  ctx.fillText(label, r.x + r.w / 2 + 1, r.y + r.h / 2 + fs * 0.36);
  ctx.restore();
}

// tronque un texte avec ellipse pour tenir dans maxW (police courante conservée)
export function fitText(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// découpe un texte en lignes tenant dans maxW (police ctx courante)
export function wrapLines(text, maxW) {
  const lines = []; let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function fmtTime(t) {
  t = Math.floor(t);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}`;
  return `${m} min`;
}

export function overlineCentered(text, x, y, color = C_GOLD) {
  ctx.save(); ctx.textAlign = 'center';
  ctx.font = `600 11px ${UI}`; ctx.letterSpacing = '3px';
  ctx.fillStyle = color; ctx.fillText(text, x + 1.5, y);
  ctx.restore();
}

export function drawAdminPwInput() {
  const inp = G.adminInput;
  const w = 440, h = 200, x = W / 2 - w / 2, y = H / 2 - h / 2;
  // tremblement rouge si le dernier mot de passe était incorrect
  const err = G.adminPwErr, shake = err ? Math.sin(G.time * 55) * 5 * Math.max(0, 1 - (G.time - G.adminPwErrT) / 0.6) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(shake, 0);
  ctx.fillStyle = 'rgba(14,8,8,0.97)';
  roundRect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = err ? '#ff1744' : '#ef5350'; ctx.lineWidth = 2;
  roundRect(x, y, w, h, 14); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef5350'; ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('⚠ ACCÈS ADMIN', W / 2, y + 44);
  ctx.fillStyle = '#a89f7c'; ctx.font = '14px Inter, sans-serif';
  ctx.fillText('Entrez le mot de passe administrateur', W / 2, y + 70);
  const fx = x + 40, fy = y + 88, fw = w - 80, fh = 40;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(fx, fy, fw, fh, 8); ctx.fill();
  ctx.strokeStyle = err ? '#ff1744' : 'rgba(239,83,80,0.6)'; ctx.lineWidth = 1.5;
  roundRect(fx, fy, fw, fh, 8); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Consolas, monospace';
  const dots = '•'.repeat(inp.text.length) + (Math.floor(G.time * 2.5) % 2 === 0 ? '|' : ' ');
  ctx.fillText(dots || ' ', fx + 14, fy + 28);
  if (G.adminChecking) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd740'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText('VÉRIFICATION AUPRÈS DU SERVEUR…', W / 2, y + h - 42);
  } else if (err) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#ff5252'; ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('✕ MOT DE PASSE INCORRECT', W / 2, y + h - 42);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#78909c'; ctx.font = '13px Inter, sans-serif';
  ctx.fillText('Échap pour annuler', W / 2, y + h - 16);
  ctx.restore();
}

// ---------- portes de progression ----------
// le tutoriel est sauvegardé globalement (toutes characters confondues)
function tutDone() {
  try { const t = JSON.parse(localStorage.getItem('rpg2d_tut') || 'null'); return !!(t && t.done); }
  catch (e) { return false; }
}
// une première connexion doit passer par le tutoriel avant la campagne ;
// les anciens personnages (progression existante) sont dispensés
export function tutorialRequired() {
  const s = G.stats || {};
  return !tutDone() && !(s.games > 0 || s.bestWave > 0 ||
    (s.campaignDone && Object.values(s.campaignDone).some(Boolean)));
}
// la forge se débloque à la première mort (recordRun compte aussi la victoire)
export function forgeUnlocked() {
  const s = G.stats || {};
  return !!(s.forgeUnlocked || s.games > 0 || s.runs > 0);
}
export function campaignUnlocked(c) {
  if (tutorialRequired()) return false; // tutoriel obligatoire d'abord
  if (c === 0) return true;
  // chaque campagne se débloque en terminant la précédente
  return !!(G.stats.campaignDone && G.stats.campaignDone[c - 1]);
}

