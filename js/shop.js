// ---------- BOUTIQUE : matériaux achetés en Émeraudes, stock limité par jour ----------
// Scène immersive : intérieur de boutique, marchand animé, pedestaux,
// panneau de détail, particules et compte à rebours jusqu'au reset de minuit.
import { G, ctx, W, H, TAU } from './state.js';
import { roundRect, drawMatIcon, hexA } from './utils.js';
import { MATS, addMaterial, loadInv, saveInv } from './inventory.js';
import { MODULES, MOD_IDS, ownModule, modState, drawModuleIcon } from './modules.js';
import { diffProg } from './difficulty.js';
import { sfxClick, sfxPickup, sfxBuy, sfxDeny, sfxTab } from './audio.js';

// ---------- DÉBLOCAGE : l'onglet MODULES s'ouvre après le niveau 4 ----------
// « niveau 4 » = le 4e territoire de campagne, LES ÉGOUTS (index 3) — sa
// récompense de victoire est justement le système de modules. Il faut
// l'avoir terminé en Normal (le Difficile/Expert l'exige déjà).
export function modsUnlocked() {
  try { return !!diffProg(3).n; } catch { return false; }
}

// catalogue : clef = matériau vendu (JAMAIS 'emeraude' — on n'achète pas la monnaie)
// stock: null = illimité · sinon unités max par jour
// maxQty: quantité max par achat
// tag = étiquette de rareté affichée (identité visuelle par matériau)
export const SHOP = {
  cuir:    { price: 1,  stock: null, maxQty: 99, tag: 'Commun',     tagCol: '#b0bec5', desc: 'Cuir tanné des Terres Oubliées. Résiste à l\'usure, imperméable à la boue.' },
  fer:     { price: 2,  stock: null, maxQty: 99, tag: 'Commun',     tagCol: '#b0bec5', desc: 'Minerai brut.forger en lames et armures. La base de tout artisanat.' },
  or:      { price: 8,  stock: 25,   maxQty: 25,  tag: 'Peu commun', tagCol: '#ffd740', desc: 'Lingots précieux aux reflets chauds. Prisés des nobles et des temples.' },
  essence: { price: 16, stock: 15,   maxQty: 15,  tag: 'Rare',       tagCol: '#ce93d8', desc: 'Sève condensée des mondes profonds. Pulse doucement, presque vivante.' },
  cristal: { price: 20, stock: 12,   maxQty: 12,  tag: 'Rare',       tagCol: '#4fc3f7', desc: 'Gemmes de glace et de foudre. Conduisent la lumière comme un cœur.' },
};

// bouton 💰 BOUTIQUE à côté des pastilles MUSIQUE / EFFETS (coin haut-droit)
// plus grand et doré — laisse une marge avant la pastille MUSIQUE
export const SHOP_BTN = { x: W - 402, y: 8, w: 190, h: 34 };
export function shopButtonAt(x, y) {
  if (G.state !== 'menu' || G.menuView !== 'main') return false;
  const r = SHOP_BTN;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
export function drawShopBtn() {
  if (G.state !== 'menu' || G.menuView !== 'main') return;
  const r = SHOP_BTN;
  const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w && G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
  const t = G.time || 0;
  ctx.save();
  // halo doré au survol + lueur permanente discrète
  if (hov) {
    const hg = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 4, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8);
    hg.addColorStop(0, 'rgba(255,215,64,0.30)'); hg.addColorStop(1, 'rgba(255,215,64,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  // corps : dégradé sombre chaud
  const bg = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  bg.addColorStop(0, hov ? 'rgba(58,46,18,0.95)' : 'rgba(30,24,12,0.85)');
  bg.addColorStop(1, 'rgba(14,11,6,0.9)');
  ctx.fillStyle = bg;
  roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
  // bordure dorée (plus vive au survol)
  ctx.strokeStyle = hov ? 'rgba(255,215,64,0.85)' : 'rgba(212,176,98,0.45)'; ctx.lineWidth = hov ? 1.6 : 1;
  roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 10); ctx.stroke();
  // liseré doré en haut
  ctx.fillStyle = hov ? 'rgba(255,215,64,0.35)' : 'rgba(212,176,98,0.18)';
  roundRect(r.x + 8, r.y + 3, r.w - 16, 2.5, 2); ctx.fill();
  // pièce animée : ellipse dorée qui scintille
  const cx = r.x + 24, cy = r.y + r.h / 2;
  const tw = 0.75 + 0.25 * Math.sin(t * 3);
  const cg = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 11);
  cg.addColorStop(0, `rgba(255,236,160,${tw})`); cg.addColorStop(0.6, '#ffd740'); cg.addColorStop(1, '#b8860b');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(cx, cy, 10.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,10,0.7)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(120,80,10,0.55)'; ctx.font = 'bold 8px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('$', cx, cy + 3);
  // texte
  ctx.textAlign = 'left';
  ctx.fillStyle = hov ? '#ffe9a3' : '#e8d9a8';
  ctx.font = '700 12.5px Inter, sans-serif'; ctx.letterSpacing = '1.2px';
  ctx.fillText('BOUTIQUE', r.x + 44, r.y + r.h / 2 - 2);
  ctx.fillStyle = hov ? 'rgba(255,233,163,0.75)' : 'rgba(200,180,130,0.55)';
  ctx.font = '8.5px Inter, sans-serif'; ctx.letterSpacing = '0.4px';
  ctx.fillText('MATÉRIAUX + MODULES', r.x + 44, r.y + r.h / 2 + 11);
  ctx.restore();
}

// ---------- STOCK QUOTIDIEN ----------
function today() { return new Date().toLocaleDateString('en-CA'); } // YYYY-MM-DD local
export function shopDay(inv) {
  inv.shop = inv.shop || { day: '', bought: {} };
  if (inv.shop.day !== today()) { inv.shop.day = today(); inv.shop.bought = {}; saveInv(inv); }
  return inv.shop;
}
export function shopStockLeft(inv, key) {
  const cfg = SHOP[key];
  if (!cfg || cfg.stock == null) return Infinity;
  const bought = (shopDay(inv).bought[key]) || 0;
  return Math.max(0, cfg.stock - bought);
}
export function emeralds(inv) { return inv.mats.emeraude || 0; }

// temps restant avant le prochain minuit local (secondes)
export function shopCountdown() {
  const n = new Date();
  const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0);
  return Math.max(0, Math.floor((mid - n) / 1000));
}

// ---------- MODULES À VENTE : tirage quotidien de 4 modules au sort ----------
// Chaque jour à minuit, 4 modules sont tirés aléatoirement parmi ceux en
// vente (price > 0). Le tirage est déterministe (seed = date) : il est
// identique pour tout le monde ce jour-là et ne change pas en relançant
// le jeu. Chaque module n'est achetable qu'UNE SEULE FOIS (anti-doublon).
export const MOD_POOL = MOD_IDS.filter(id => MODULES[id].price > 0);
export const MOD_DAY_COUNT = 4;
// RNG déterministe (mulberry32) pour un tirage stable dans la journée
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// les 4 modules du jour (triés par rareté décroissante pour la mise en page)
export function modShopToday() {
  const d = new Date();
  const seed = hashStr(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  const rng = mulberry32(seed);
  const pool = [...MOD_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const rarRank = { 'Légendaire': 0, 'Mythique': 0, 'Épique': 1, 'Rare': 2, 'Commun': 3 };
  return pool.slice(0, MOD_DAY_COUNT)
    .sort((a, b) => (rarRank[MODULES[a].rar] ?? 9) - (rarRank[MODULES[b].rar] ?? 9));
}
export const RAR_COL = { 'Commun': '#c0a878', 'Rare': '#a9c6e2', 'Épique': '#b388ff', 'Légendaire': '#ffd54f', 'Mythique': '#ff8a65' };
// un module est achetable s'il est dans le tirage du jour, pas possédé,
// et que le joueur a assez d'émeraudes — une seule fois par compte
export function modOnSaleToday(inv, id) { return !!(inv && modShopToday().includes(id)); }
export function buyModule(inv, id) {
  const m = MODULES[id];
  if (!m || m.price <= 0) return { ok: false, msg: 'Module indisponible' };
  if (!modsUnlocked()) return { ok: false, msg: 'Réussissez le niveau 4 (LES ÉGOUTS) pour débloquer les modules' };
  if (!modShopToday().includes(id)) return { ok: false, msg: 'Pas en vente aujourd\'hui — revenez demain !' };
  const ms = modState(inv);
  if (ms.owned.includes(id)) return { ok: false, msg: 'Déjà possédé' };
  if ((inv.mats.emeraude || 0) < m.price) return { ok: false, msg: `Il faut ${m.price} émeraudes` };
  inv.mats.emeraude -= m.price;
  ownModule(inv, id);
  saveInv(inv);
  return { ok: true, msg: `MODULE ${m.name.toUpperCase()} DÉBLOQUÉ !` };
}

// ---------- ACHAT ----------
export function buyMaterial(inv, key, qty = 1) {
  const cfg = SHOP[key];
  if (!cfg) return { ok: false, msg: 'Article inconnu' };
  qty = Math.max(1, Math.min(qty | 0, cfg.maxQty));
  const left = shopStockLeft(inv, key);
  if (qty > left) return { ok: false, msg: left <= 0 ? 'Épuisé aujourd\'hui' : `Stock : ${left} restant${left > 1 ? 's' : ''}` };
  const cost = cfg.price * qty;
  if (emeralds(inv) < cost) return { ok: false, msg: `Il faut ${cost} émeraudes` };
  inv.mats.emeraude -= cost;
  addMaterial(inv, key, qty);
  const sd = shopDay(inv);
  sd.bought[key] = (sd.bought[key] || 0) + qty;
  saveInv(inv);
  return { ok: true, msg: `+${qty} ${MATS[key].name}`, cost };
}

// ---------- CLICS ----------
// G.shopSel = matériau sélectionné (panneau de détail)
// G.shopQty[key] = quantité choisie ; G.shopConfirm = {key, qty, cost} en attente
export function shopClickAt(x, y) {
  const inv = G.inv;
  if (!inv) return null;
  const L = shopLayout();
  if (inR(L.close, x, y)) { G.shopOpen = false; G.shopConfirm = null; G.shopSel = null; G._shopWasOpen = false; return 'close'; }
  // confirmation d'achat : intercepte les clics
  if (G.shopConfirm) {
    if (inR(L.confirmBtn, x, y)) {
      const cf = G.shopConfirm;
      G.shopConfirm = null;
      const r = cf.mod ? buyModule(inv, cf.mod) : buyMaterial(inv, cf.key, cf.qty);
      if (r.ok) {
        sfxBuy();
        G.shopFlash = { msg: r.msg, t: G.time };
        G.shopMood = 'joy'; G.shopMoodT = G.time;
        G.shopBurst = { x: L.balance.x + 30, y: L.balance.y + 15, t: G.time, col: '#69f0ae' };
      } else {
        G.shopFlash = { msg: r.msg, t: G.time, bad: true };
        G.shopMood = 'sad'; G.shopMoodT = G.time;
        sfxClick();
      }
      return r.ok ? 'buy' : 'deny';
    }
    if (inR(L.confirmNo, x, y)) { G.shopConfirm = null; sfxClick(); return 'deny'; }
    return 'inside';
  }
  // onglets MATÉRIAUX / MODULES (MODULES verrouillé avant le niveau 4)
  if (inR(L.tabs.mats, x, y)) { setShopTab('mats'); return 'tab'; }
  if (inR(L.tabs.mods, x, y)) {
    if (!modsUnlocked()) {
      G.shopFlash = { msg: '🔒 Réussissez le niveau 4 (LES ÉGOUTS) pour débloquer les modules', t: G.time, bad: true };
      sfxDeny(); return 'deny';
    }
    setShopTab('mods'); return 'tab';
  }
  // ===== onglet MODULES : reliquaire =====
  if ((G.shopTab || 'mats') === 'mods') {
    // clic sur une carte -> panneau de détail
    for (const cd of L.modCards) {
      if (inR(cd, x, y)) {
        G.shopModSel = G.shopModSel === cd.id ? null : cd.id;
        sfxClick(); return 'sel';
    }
    }
    // panneau de détail : bouton ACHETER
    const mid = G.shopModSel;
    if (mid && MODULES[mid] && modShopToday().includes(mid)) {
      if (inR(L.modBuy, x, y)) {
        const m = MODULES[mid];
        const owned = modState(inv).owned.includes(mid);
        if (owned) { G.shopFlash = { msg: `${m.name} : déjà possédé`, t: G.time, bad: true }; sfxDeny(); return 'deny'; }
        if ((inv.mats.emeraude || 0) < m.price) { G.shopFlash = { msg: `Il faut ${m.price} émeraudes pour ${m.name}`, t: G.time, bad: true }; G.shopMood = 'sad'; G.shopMoodT = G.time; sfxDeny(); return 'deny'; }
        G.shopConfirm = { mod: mid, cost: m.price };
        sfxClick(); return 'buy';
      }
    }
    return inR(L.scene, x, y) ? 'inside' : 'close';
  }
  // clic sur un piédestal -> sélection pour le panneau de détail
  for (const ped of L.peds) {
    if (inR(ped, x, y)) {
      G.shopSel = G.shopSel === ped.key ? null : ped.key;
      sfxClick();
      return 'sel';
    }
  }
  // panneau de détail : contrôles quantité + achat
  const key = G.shopSel;
  if (key && SHOP[key]) {
    if (inR(L.minus, x, y)) { setQty(key, -1); sfxClick(); return 'qty'; }
    if (inR(L.plus, x, y)) { setQty(key, +1); sfxClick(); return 'qty'; }
    if (inR(L.buy, x, y)) {
      const qty = G.shopQty[key] || 1;
      const cost = SHOP[key].price * qty;
      const left = shopStockLeft(inv, key);
      if (qty > left || emeralds(inv) < cost) {
        const r = buyMaterial(inv, key, qty);
        G.shopFlash = { msg: r.msg, t: G.time, bad: true };
        G.shopMood = 'sad'; G.shopMoodT = G.time;
        sfxDeny();
        return 'deny';
      }
      if (cost >= 12) { G.shopConfirm = { key, qty, cost }; sfxClick(); }
      else {
        const r = buyMaterial(inv, key, qty);
        if (r.ok) {
          sfxBuy(); G.shopFlash = { msg: r.msg, t: G.time };
          G.shopMood = 'joy'; G.shopMoodT = G.time;
          G.shopBurst = { x: L.balance.x + 30, y: L.balance.y + 15, t: G.time, col: '#69f0ae' };
        } else {
          G.shopFlash = { msg: r.msg, t: G.time, bad: true };
          G.shopMood = 'sad'; G.shopMoodT = G.time;
          sfxDeny();
        }
      }
      return 'buy';
    }
  }
  return inR(L.scene, x, y) ? 'inside' : 'close';
}
function setQty(key, d) {
  const left = shopStockLeft(G.inv, key);
  const max = Math.min(SHOP[key].maxQty, left === Infinity ? SHOP[key].maxQty : left);
  const cur = G.shopQty[key] || 1;
  G.shopQty[key] = Math.max(1, Math.min(max, cur + d));
}
function setShopTab(tab) {
  if ((G.shopTab || 'mats') === tab) return;
  G.shopTab = tab; G.shopTabT = G.time || 0;
  G.shopSel = null; G.shopModSel = null; G.shopConfirm = null;
  sfxTab(); // glissement de parchemin entre les onglets de la boutique
}
function inR(r, x, y) { return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

// ---------- LAYOUT (partagé dessin / clic) ----------
export function shopLayout() {
  const keys = Object.keys(SHOP);
  // scène complète écran : marchand à gauche, comptoir + pedestals à droite
  const scene = { x: 0, y: 0, w: W, h: H };
  const mx = 70, mw = 250;                    // zone marchand
  // pedestals : répartis sur le comptoir
  const pedY = 300, pedW = 168, pedH = 150, gap = 18;
  const totalW = keys.length * pedW + (keys.length - 1) * gap;
  const pedX0 = W / 2 - totalW / 2 + 40;
  const peds = keys.map((key, i) => ({
    key, x: pedX0 + i * (pedW + gap), y: pedY, w: pedW, h: pedH,
    icon: { x: pedX0 + i * (pedW + gap) + pedW / 2, y: pedY + 62 },
  }));
  // panneau de détail en bas
  const dy = 486, dw = 860, dx = W / 2 - dw / 2;
  return {
    scene,
    merchant: { x: mx, y: 120, w: mw, h: 330 },
    peds,
    detail: { x: dx, y: dy, w: dw, h: 128 },
    balance: { x: W - 320, y: 16, w: 210, h: 40 },
    timer: { x: W - 320, y: 62, w: 210, h: 24 },
    close: { x: W - 52, y: 14, w: 36, h: 36 },
    minus: { x: dx + dw - 360, y: dy + 74, w: 34, h: 34 },
    plus:  { x: dx + dw - 288, y: dy + 74, w: 34, h: 34 },
    buy:   { x: dx + dw - 240, y: dy + 68, w: 200, h: 44 },
    confirmBtn: { x: W / 2 - 130, y: H / 2 + 62, w: 120, h: 36 },
    confirmNo:  { x: W / 2 + 10,  y: H / 2 + 62, w: 120, h: 36 },
    confirmPanel: { x: W / 2 - 240, y: H / 2 - 118, w: 480, h: 236 },
    // onglets MATÉRIAUX / MODULES
    tabs: {
      mats: { x: W / 2 - 212, y: 80, w: 200, h: 32 },
      mods: { x: W / 2 + 12,  y: 80, w: 200, h: 32 },
    },
    // grille des modules (onglet MODULES) : les 4 modules tirés au sort
    // aujourd'hui, centrés en une seule ligne sous les onglets
    modCards: (() => {
      const today = modShopToday();
      const cols = today.length, cw = 232, ch = 150, gap = 16;
      const x0 = W / 2 - (cols * cw + (cols - 1) * gap) / 2, y0 = 130;
      return today.map((id, i) => ({
        id, x: x0 + i * (cw + gap), y: y0, w: cw, h: ch,
      }));
    })(),
    // panneau de détail module (bas d'écran, sous la grille)
    modDetail: { x: W / 2 - 430, y: H - 200, w: 860, h: 172 },
    modBuy: { x: W / 2 + 430 - 250, y: H - 200 + 62, w: 220, h: 44 },
  };
}

// ---------- DESSIN ----------
const C_GOLD = '#d4b062', C_MUT = '#a8b0bc', C_TXT = '#e8e0c8';
const RARITY_TAG = { commun: '#b0bec5', rare: '#4fc3f7', epique: '#ce93d8', legendaire: '#ffd740' };

export function drawShop() {
  const inv = G.inv;
  if (!inv) return;
  const L = shopLayout();
  const t = G.time;
  // animation d'ouverture : rejouée à chaque ouverture
  if (!G._shopWasOpen) { G._shopWasOpen = true; G._shopOpenT = t; }
  const openK = Math.min(1, (t - (G._shopOpenT ?? t)) / 0.35);
  const ease = 1 - Math.pow(1 - openK, 3);

  // ===== SCÈNE : intérieur de boutique chaleureuse =====
  // mur en bois sombre + lueur chaude centrale
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#171310'); wall.addColorStop(0.55, '#241a12'); wall.addColorStop(1, '#120d09');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
  // planches du mur (lignes verticales discrètes)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let x = 40; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 14, H * 0.62); ctx.stroke(); }
  // lueur chaude du comptoir
  const glow = ctx.createRadialGradient(W / 2, 330, 60, W / 2, 380, 560);
  glow.addColorStop(0, 'rgba(255,190,90,0.16)'); glow.addColorStop(0.6, 'rgba(255,160,60,0.06)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  // poussière dorée en suspension
  ctx.fillStyle = 'rgba(255,220,150,0.5)';
  for (let i = 0; i < 22; i++) {
    const px = (i * 197 + Math.sin(t * 0.3 + i) * 30 + W) % W;
    const py = (i * 131 + t * (4 + (i % 4)) + H * 2) % (H * 0.7);
    const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i * 2.1));
    ctx.globalAlpha = tw * 0.35;
    ctx.beginPath(); ctx.arc(px, py, 1 + (i % 3) * 0.5, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const wantTab = G.shopTab || 'mats';
  const tab = wantTab === 'mods' && !modsUnlocked() ? 'mats' : wantTab;
  // transition d'onglet : fondu + léger glissement du contenu
  const tabK = Math.min(1, (t - (G.shopTabT ?? t)) / 0.28);
  const tabEase = 1 - Math.pow(1 - tabK, 3);

  // ===== décor d'arrière-plan selon l'onglet =====
  if (tab === 'mods') {
    drawModBackdrop(t);
  } else {
    drawShelves(t);
    drawMerchant(L.merchant, t);
  }

  // ===== EN-TÊTE : titre + solde + compte à rebours + fermer =====
  ctx.textAlign = 'center';
  ctx.fillStyle = tab === 'mods' ? C_GOLD : C_GOLD;
  ctx.font = 'bold 24px Cinzel, serif';
  ctx.fillText(tab === 'mods' ? '✦ RELIQUAIRE DES MODULES' : '💰 BOUTIQUE DU MAÎTRE MARCHAND', W / 2, 44);
  ctx.fillStyle = C_MUT; ctx.font = 'italic 11.5px Inter, sans-serif';
  ctx.fillText(tab === 'mods'
    ? `Tirage du jour : ${MOD_DAY_COUNT} modules au hasard — chaque module ne s'achète qu'une seule fois`
    : 'Matériaux contre émeraudes — les stocks rares se renouvellent chaque jour', W / 2, 66);

  // ===== ONGLETS =====
  drawShopTabs(L, t, tab);
  // solde d'émeraudes
  const bal = L.balance;
  const eg = ctx.createLinearGradient(bal.x, bal.y, bal.x + bal.w, bal.y);
  eg.addColorStop(0, 'rgba(46,204,113,0.28)'); eg.addColorStop(1, 'rgba(46,204,113,0.08)');
  ctx.fillStyle = eg; roundRect(bal.x, bal.y, bal.w, bal.h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(105,240,174,0.55)'; ctx.lineWidth = 1.2;
  roundRect(bal.x, bal.y, bal.w, bal.h, 10); ctx.stroke();
  // scintillement de la balance après un achat
  const burst = G.shopBurst;
  const burstK = burst ? Math.max(0, 1 - (t - burst.t) / 0.8) : 0;
  drawMatIcon('emeraude', bal.x + 22, bal.y + bal.h / 2, 10);
  ctx.textAlign = 'left'; ctx.font = 'bold 16px Consolas, monospace';
  ctx.fillStyle = '#69f0ae';
  ctx.fillText(`${emeralds(inv)}`, bal.x + 38, bal.y + bal.h / 2 + 5);
  ctx.fillStyle = C_MUT; ctx.font = '10px Inter, sans-serif';
  ctx.fillText('émeraudes', bal.x + 100, bal.y + bal.h / 2 + 4);
  // particules de l'achat : émeraudes qui jaillissent de la balance
  if (burstK > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10 + burst.t * 3;
      const d = (1 - burstK) * 55;
      ctx.globalAlpha = burstK * 0.9;
      ctx.fillStyle = i % 2 ? '#69f0ae' : '#ffd740';
      ctx.beginPath(); ctx.arc(burst.x + Math.cos(a) * d, burst.y - 10 + Math.sin(a) * d * 0.6 - (1 - burstK) * 20, 2.2 * burstK + 0.6, 0, TAU); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // compte à rebours du reset quotidien
  const cd = shopCountdown();
  const hh = String(Math.floor(cd / 3600)).padStart(2, '0');
  const mm = String(Math.floor(cd % 3600 / 60)).padStart(2, '0');
  const ss = String(cd % 60).padStart(2, '0');
  const tm = L.timer;
  ctx.textAlign = 'center';
  ctx.fillStyle = cd < 3600 ? '#ffb74d' : C_MUT; ctx.font = '11px Inter, sans-serif';
  ctx.fillText(`↻ stock renouvelé dans ${hh}:${mm}:${ss}`, tm.x + tm.w / 2, tm.y + tm.h / 2 + 4);
  // bouton fermer
  const cl = L.close;
  const hovC = inR(cl, G.mouse.x, G.mouse.y);
  ctx.fillStyle = hovC ? 'rgba(200,60,50,0.85)' : 'rgba(110,35,30,0.65)';
  roundRect(cl.x, cl.y, cl.w, cl.h, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
  roundRect(cl.x, cl.y, cl.w, cl.h, 9); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('✕', cl.x + cl.w / 2, cl.y + cl.h / 2 + 5);

  // ===== CONTENU DE L'ONGLET (transition fondu + glissement) =====
  ctx.save();
  ctx.globalAlpha = tabEase;
  ctx.translate(0, (1 - tabEase) * 16);
  if (tab === 'mods') {
    for (const cd of L.modCards) drawModCard(cd, t, inv);
    drawModDetail(L, inv, t);
  } else {
    drawCounter(t);
    for (const ped of L.peds) drawPedestal(ped, t, inv);
    if (G.shopSel && SHOP[G.shopSel]) drawDetail(L, inv, t);
    else drawHint(L);
  }
  ctx.restore();

  // ===== flash message =====
  const fl = G.shopFlash;
  if (fl && t - fl.t < 2.4) {
    const a = Math.min(1, (2.4 - (t - fl.t)) / 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = fl.bad ? '#ff8a80' : '#69f0ae';
    ctx.font = 'bold 13.5px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(fl.msg, W / 2, 92);
    ctx.globalAlpha = 1;
  }

  // ===== confirmation d'achat =====
  if (G.shopConfirm) {
    const cf = G.shopConfirm;
    const P = L.confirmPanel;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    const cEdge = C_GOLD;
    const cg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h);
    cg.addColorStop(0, '#33271a'); cg.addColorStop(1, '#1c140c');
    ctx.fillStyle = cg; roundRect(P.x, P.y, P.w, P.h, 14); ctx.fill();
    ctx.strokeStyle = cEdge; ctx.lineWidth = 2; roundRect(P.x, P.y, P.w, P.h, 14); ctx.stroke();
    // coin ornements
    ctx.fillStyle = C_GOLD;
    for (const [ox, oy] of [[P.x + 12, P.y + 12], [P.x + P.w - 12, P.y + 12], [P.x + 12, P.y + P.h - 12], [P.x + P.w - 12, P.y + P.h - 12]]) {
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = cEdge; ctx.font = 'bold 19px Cinzel, serif';
    ctx.fillText(cf.mod ? 'Confirmer l\'achat du module' : 'Confirmer l\'achat', W / 2, P.y + 40);
    // colonne icône à gauche, colonne texte alignée à gauche à droite
    const ix = P.x + 52, tx = P.x + 104;
    ctx.textAlign = 'left';
    if (cf.mod) {
      const m = MODULES[cf.mod];
      drawModuleIcon(cf.mod, ix, P.y + 102, 1.35);
      ctx.fillStyle = m.col; ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(m.name, tx, P.y + 92);
      ctx.fillStyle = C_MUT; ctx.font = '12px Inter, sans-serif';
      ctx.fillText(`${m.rar} · ${m.type.toUpperCase()} — module unique`, tx, P.y + 114);
      ctx.fillStyle = '#8d99ae'; ctx.font = '11.5px Inter, sans-serif';
      ctx.fillText(`Coût : ${cf.cost} émeraudes — solde après : ${emeralds(inv) - cf.cost} ◆`, tx, P.y + 148);
      ctx.fillStyle = C_MUT; ctx.font = '11px Inter, sans-serif';
      ctx.fillText('Équipe-le ensuite dans le menu MODULES', tx, P.y + 172);
    } else {
      const { key, qty, cost } = cf;
      const info = MATS[key], cfg = SHOP[key];
      drawMatIcon(key, ix, P.y + 102, 17);
      ctx.fillStyle = info.color || C_TXT; ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(`${qty} × ${info.name}`, tx, P.y + 92);
      ctx.fillStyle = '#8d99ae'; ctx.font = '11.5px Inter, sans-serif';
      ctx.fillText(`Coût : ${cost} émeraudes — solde après : ${emeralds(inv) - cost} ◆`, tx, P.y + 124);
      ctx.fillStyle = C_MUT; ctx.font = '11px Inter, sans-serif';
      ctx.fillText(`Stock restant : ${shopStockLeft(inv, key) - qty}/${cfg.stock == null ? '∞' : cfg.stock}`, tx, P.y + 148);
    }
    // filet séparateur au-dessus des boutons
    ctx.strokeStyle = 'rgba(255,215,64,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(P.x + 24, P.y + P.h - 68); ctx.lineTo(P.x + P.w - 24, P.y + P.h - 68); ctx.stroke();
    ctx.textAlign = 'center';
    for (const [r, label, col] of [[L.confirmBtn, '✔ ACHETER', '#2ecc71'], [L.confirmNo, '✕ ANNULER', '#a55']]) {
      const h = inR(r, G.mouse.x, G.mouse.y);
      ctx.fillStyle = h ? hexA(col, 0.9) : hexA(col, 0.55);
      roundRect(r.x, r.y, r.w, r.h, 9); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 5);
    }
  }

  // ===== animation d'ouverture : léger zoom + fondu =====
  if (openK < 1) {
    ctx.save();
    ctx.globalAlpha = openK;
    ctx.fillStyle = `rgba(5,4,8,${(1 - openK) * 0.7})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ---------- ÉTAGERES DÉCORATIVES (fond de la boutique) ----------
function drawShelves(t) {
  // deux étagères en haut à gauche et droite, garnies de bibelots
  const shelf = (sx, sy, sw, items) => {
    // planche
    ctx.fillStyle = '#3a2a1c';
    roundRect(sx, sy, sw, 12, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(sx, sy + 10, sw, 5, 2); ctx.fill();
    //supports
    ctx.fillStyle = '#2c1f14';
    ctx.fillRect(sx + 8, sy + 12, 8, 26); ctx.fillRect(sx + sw - 16, sy + 12, 8, 26);
    // objets posés
    items.forEach((it, i) => {
      const ix = sx + 22 + i * (sw - 44) / (items.length - 1);
      const bob = Math.sin(t * 1.8 + i * 2 + sx) * 2;
      ctx.save(); ctx.translate(ix, sy - 14 + bob);
      if (it === 'gem') {
        // petite gemme scintillante
        const tw = 0.6 + 0.4 * Math.sin(t * 4 + i);
        ctx.fillStyle = `rgba(140,220,255,${tw})`;
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, -2); ctx.lineTo(0, 8); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(2.5, -2); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill();
      } else if (it === 'potion') {
        ctx.fillStyle = '#7b1fa2';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4a148c'; ctx.fillRect(-2, -10, 4, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(-2, -1, 1.8, 0, TAU); ctx.fill();
      } else if (it === 'coin') {
        ctx.fillStyle = '#ffd740';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b8860b'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center';
        ctx.fillText('◆', 0, 3);
      } else if (it === 'book') {
        ctx.fillStyle = '#6d4c41'; roundRect(-7, -10, 14, 10, 2); ctx.fill();
        ctx.fillStyle = '#ffd740'; ctx.fillRect(-7, -10, 14, 2);
      } else {
        // objet générique : silhouette de matériau
        drawMatIcon(it, 0, 0, 7);
      }
      ctx.restore();
    });
  };
  // étagère gauche-haut (au-dessus du marchand)
  shelf(60, 86, 240, ['cristal', 'or', 'essence']);
  // étagère droite-haut
  shelf(W - 320, 86, 260, ['or', 'gem', 'book', 'potion']);
  // petite étagère au-dessus du panneau de détail
  shelf(W / 2 - 300, 150, 200, ['cuir', 'fer']);
  shelf(W / 2 + 100, 150, 200, ['essence', 'cristal']);
}

// ---------- MARCHAND ANIMÉ ----------
function drawMerchant(r, t) {
  const mx = r.x + r.w / 2, baseY = r.y + r.h;
  const bob = Math.sin(t * 1.6) * 3;
  const mood = G.shopMood;
  const moodK = mood ? Math.max(0, 1 - (t - (G.shopMoodT || 0)) / 2) : 0;
  ctx.save();
  ctx.translate(mx, baseY + bob * 0.3);
  // ombre au sol
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(0, 6 - bob * 0.3, 60, 12, 0, 0, TAU); ctx.fill();
  // corps : robe sombre à capuchon
  const robe = ctx.createLinearGradient(-40, -140, 40, 0);
  robe.addColorStop(0, '#4a3428'); robe.addColorStop(1, '#2c1f14');
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-38, 0);
  ctx.quadraticCurveTo(-44, -80, -30, -120);
  ctx.quadraticCurveTo(-26, -140, 0, -146);
  ctx.quadraticCurveTo(26, -140, 30, -120);
  ctx.quadraticCurveTo(44, -80, 38, 0);
  ctx.closePath(); ctx.fill();
  // capuche + visage
  ctx.fillStyle = '#3a2a1e';
  ctx.beginPath(); ctx.arc(0, -128, 26, Math.PI, 0); ctx.fill();
  ctx.fillStyle = mood === 'sad' ? '#5a3a30' : '#e8c39a'; // teint du visage selon humeur
  ctx.beginPath(); ctx.arc(0, -122, 15, 0, TAU); ctx.fill();
  // yeux : expriment l'humeur
  ctx.fillStyle = '#2c1f14';
  const blink = (t % 3.7) < 0.12 ? 0.3 : 1;
  ctx.beginPath(); ctx.ellipse(-5, -124, 2.2, 2.4 * blink, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, -124, 2.2, 2.4 * blink, 0, 0, TAU); ctx.fill();
  if (mood === 'sad' && moodK > 0) {
    ctx.strokeStyle = '#2c1f14'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, -116, 4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  } else {
    ctx.strokeStyle = '#2c1f14'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, -118, mood === 'joy' ? 6 : 4, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  // barbe
  ctx.fillStyle = '#c9b8a8';
  ctx.beginPath(); ctx.moveTo(-10, -112); ctx.quadraticCurveTo(0, -96, 10, -112); ctx.quadraticCurveTo(0, -106, -10, -112); ctx.fill();
  // ceinture + bourse à émeraudes
  ctx.fillStyle = '#6d4c30'; ctx.fillRect(-30, -52, 60, 8);
  ctx.fillStyle = '#1a120c';
  ctx.beginPath(); ctx.arc(24, -44, 9, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(24, -44, 9, 0, TAU); ctx.stroke();
  // lueur verte de la bourse (pulsation)
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(105,240,174,${0.35 + pulse * 0.3})`;
  ctx.beginPath(); ctx.arc(24, -44, 4.5, 0, TAU); ctx.fill();
  // bras qui fait signe quand content
  if (mood === 'joy' && moodK > 0) {
    const wave = Math.sin(t * 8) * 0.3;
    ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(26, -80); ctx.quadraticCurveTo(46, -95, 52, -115 + wave * 20); ctx.stroke();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(52, -115 + wave * 20, 5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- COMPToir (bois verni + outils) ----------
function drawCounter(t) {
  const cy = 452;
  // plateau du comptoir
  const cg = ctx.createLinearGradient(0, cy, 0, cy + 26);
  cg.addColorStop(0, '#5d4037'); cg.addColorStop(1, '#3e2a1c');
  ctx.fillStyle = cg;
  roundRect(60, cy, W - 120, 30, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,210,140,0.12)';
  roundRect(60, cy, W - 120, 6, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
  roundRect(60, cy, W - 120, 30, 8); ctx.stroke();
  // petit marteau + balance posés sur le comptoir
  ctx.save(); ctx.translate(W - 160, cy - 8);
  ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
  ctx.fillStyle = '#78909c';
  ctx.fillRect(-18, -8, 8, 8); ctx.fillRect(10, -8, 8, 8);
  ctx.restore();
  // lanterne suspendue au-dessus du comptoir (lumière chaude animée)
  const lx = W / 2, ly = 210 + Math.sin(t * 1.2) * 3;
  ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - 16); ctx.stroke();
  const lg2 = ctx.createRadialGradient(lx, ly, 4, lx, ly, 70);
  lg2.addColorStop(0, 'rgba(255,200,110,0.30)'); lg2.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = lg2; ctx.beginPath(); ctx.arc(lx, ly, 70, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffca7a';
  ctx.beginPath(); ctx.arc(lx, ly, 7 + Math.sin(t * 7) * 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5d4037';
  roundRect(lx - 10, ly + 6, 20, 14, 4); ctx.fill();
}

// ---------- PEDESTAL (un matériau exposé) ----------
function drawPedestal(ped, t, inv) {
  const { x, y, w, h } = ped;
  const key = ped.key, cfg = SHOP[key], info = MATS[key];
  const sel = G.shopSel === key;
  const hov = inR(ped, G.mouse.x, G.mouse.y);
  const left = shopStockLeft(inv, key);
  const soldOut = left <= 0;
  // socle : pierre + plateau bois
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 8, w * 0.46, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4a3a28';
  ctx.fillRect(x + 8, y + h - 34, w - 16, 34);
  ctx.fillStyle = '#5d4530';
  roundRect(x, y + h - 44, w, 14, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.2;
  roundRect(x, y + h - 44, w, 14, 5); ctx.stroke();
  // halo de sélection / survol teinté par rareté
  if (sel || hov) {
    const col = cfg.tagCol;
    const pulse = sel ? 0.5 + 0.3 * Math.sin(t * 4) : 0.3;
    const hg = ctx.createRadialGradient(x + w / 2, y + 60, 10, x + w / 2, y + 60, w * 0.6);
    hg.addColorStop(0, hexA(col, pulse * 0.35)); hg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = hg; ctx.fillRect(x - 10, y - 20, w + 20, h + 60);
    ctx.strokeStyle = hexA(col, sel ? 0.9 : 0.5); ctx.lineWidth = sel ? 2.4 : 1.4;
    roundRect(x - 4, y - 4, w + 8, h + 8, 12); ctx.stroke();
  }
  // icône flottante animée + lueur pour les rares
  const bob = Math.sin(t * 2 + x * 0.05) * 5;
  const icY = y + 66 + bob;
  if (cfg.stock != null || cfg.price >= 8) {
    // halo de rareté autour de l'icône
    const rg = ctx.createRadialGradient(x + w / 2, icY, 6, x + w / 2, icY, 44);
    rg.addColorStop(0, hexA(cfg.tagCol, 0.28)); rg.addColorStop(1, hexA(cfg.tagCol, 0));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x + w / 2, icY, 44, 0, TAU); ctx.fill();
  }
  drawMatIcon(key, x + w / 2, icY, 22);
  // reflet qui balaie l'icône (objets précieux)
  const sweep = ((t * 0.5 + x * 0.01) % 2) - 1;
  ctx.save();
  ctx.beginPath(); ctx.arc(x + w / 2, icY, 24, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x + w / 2 + sweep * 26, icY - 24); ctx.lineTo(x + w / 2 + sweep * 26, icY + 24); ctx.stroke();
  ctx.restore();
  // nom + tag rareté
  ctx.textAlign = 'center';
  ctx.fillStyle = info.color || C_TXT; ctx.font = 'bold 13.5px Inter, sans-serif';
  ctx.fillText(info.name, x + w / 2, y + 118);
  ctx.fillStyle = cfg.tagCol; ctx.font = 'bold 9.5px Inter, sans-serif'; ctx.letterSpacing = '1px';
  ctx.fillText(cfg.tag.toUpperCase(), x + w / 2, y + 132);
  // prix + stock
  ctx.fillStyle = '#69f0ae'; ctx.font = 'bold 13px Consolas, monospace';
  ctx.fillText(`${cfg.price} ◆/u`, x + w / 2, y + h - 58);
  ctx.fillStyle = soldOut ? '#ff8a80' : C_MUT; ctx.font = '10px Inter, sans-serif';
  ctx.fillText(cfg.stock == null ? 'stock ∞' : soldOut ? 'ÉPUISÉ' : `reste ${left}/${cfg.stock}`, x + w / 2, y + h - 42);
  // étiquette "sélectionner"
  if (hov && !sel) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '10px Inter, sans-serif';
    ctx.fillText('▼ cliquer', x + w / 2, y - 10);
  }
}

// ---------- HINT (aucune sélection) ----------
function drawHint(L) {
  const d = L.detail;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = C_MUT;
  ctx.font = 'italic 13px Inter, sans-serif';
  ctx.fillText('👆 Sélectionnez un matériau sur le comptoir pour voir son aperçu et l\'acheter', W / 2, d.y + d.h / 2 + 4);
}

// ---------- PANNEAU DE DÉTAIL (matériau sélectionné) ----------
function drawDetail(L, inv, t) {
  const key = G.shopSel, cfg = SHOP[key], info = MATS[key];
  const d = L.detail;
  const qty = G.shopQty[key] || 1;
  const left = shopStockLeft(inv, key);
  const cost = cfg.price * qty;
  const afford = emeralds(inv) >= cost && qty <= left;
  // panneau boisé
  const dg = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
  dg.addColorStop(0, '#33271a'); dg.addColorStop(1, '#1c140c');
  ctx.fillStyle = dg; roundRect(d.x, d.y, d.w, d.h, 12); ctx.fill();
  ctx.strokeStyle = hexA(cfg.tagCol, 0.7); ctx.lineWidth = 1.6;
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.stroke();
  // grande icône animée à gauche
  const ix = d.x + 66, iy = d.y + d.h / 2;
  const bob = Math.sin(t * 2.2) * 4;
  const ig = ctx.createRadialGradient(ix, iy + bob, 6, ix, iy + bob, 46);
  ig.addColorStop(0, hexA(cfg.tagCol, 0.3)); ig.addColorStop(1, hexA(cfg.tagCol, 0));
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy + bob, 46, 0, TAU); ctx.fill();
  drawMatIcon(key, ix, iy + bob, 30);
  // nom + rareté + description
  ctx.textAlign = 'left';
  ctx.fillStyle = info.color || C_TXT; ctx.font = 'bold 17px Inter, sans-serif';
  ctx.fillText(info.name, d.x + 118, d.y + 34);
  ctx.fillStyle = cfg.tagCol; ctx.font = 'bold 10px Inter, sans-serif'; ctx.letterSpacing = '1.5px';
  ctx.fillText(cfg.tag.toUpperCase(), d.x + 118 + ctx.measureText(info.name).width + 12, d.y + 33);
  ctx.fillStyle = '#9aa5b1'; ctx.font = '11px Inter, sans-serif';
  ctx.fillText(info.desc || '', d.x + 118, d.y + 54);
  // stock + prix unitaire
  ctx.fillStyle = left <= 0 ? '#ff8a80' : '#69f0ae'; ctx.font = 'bold 12px Consolas, monospace';
  ctx.fillText(cfg.stock == null ? 'stock illimité' : `stock : ${left}/${cfg.stock} aujourd'hui`, d.x + 118, d.y + 76);
  ctx.fillStyle = C_MUT; ctx.font = '11px Inter, sans-serif';
  ctx.fillText(`${cfg.price} ◆ / unité`, d.x + 118, d.y + 94);
  // coût total de la sélection (colonne de gauche, sous le prix unitaire)
  ctx.fillStyle = afford ? '#69f0ae' : '#ff8a80'; ctx.font = 'bold 12.5px Consolas, monospace';
  ctx.fillText(`×${qty} = ${cost} ◆`, d.x + 118, d.y + 112);
  // sélecteur quantité (texte centré verticalement dans la casse)
  const qy = d.y + d.h / 2 + 24;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(L.minus.x - 8, L.minus.y - 4, L.plus.x + L.plus.w - L.minus.x + 16, L.minus.h + 8, 9); ctx.fill();
  const mq = inR(L.minus, G.mouse.x, G.mouse.y), pq = inR(L.plus, G.mouse.x, G.mouse.y);
  ctx.fillStyle = mq ? '#fff' : C_MUT; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('−', L.minus.x + L.minus.w / 2, qy + 4);
  ctx.fillStyle = C_TXT; ctx.font = 'bold 13px Consolas, monospace';
  ctx.fillText(`×${qty}`, (L.minus.x + L.minus.w + L.plus.x) / 2, qy + 4);
  ctx.fillStyle = pq ? '#fff' : C_MUT;
  ctx.fillText('+', L.plus.x + L.plus.w / 2, qy + 4);
  // bouton acheter
  const b = L.buy, bh = inR(b, G.mouse.x, G.mouse.y);
  ctx.fillStyle = afford ? (bh ? 'rgba(46,204,113,0.9)' : 'rgba(46,204,113,0.55)') : 'rgba(255,255,255,0.08)';
  roundRect(b.x, b.y, b.w, b.h, 9); ctx.fill();
  ctx.strokeStyle = afford ? '#69f0ae' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
  roundRect(b.x, b.y, b.w, b.h, 9); ctx.stroke();
  ctx.fillStyle = afford ? '#fff' : '#6f7378'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(left <= 0 ? 'ÉPUISÉ' : `🛒 ACHETER · ${cost} ◆`, b.x + b.w / 2, b.y + b.h / 2 + 5);
}

// ---------- ONGLETS MATÉRIAUX / MODULES ----------
function drawShopTabs(L, t, tab) {
  const modsOk = modsUnlocked();
  for (const [key, label, icon, col] of [
    ['mats', 'MATÉRIAUX', '💰', '#d4b062'],
    ['mods', modsOk ? 'MODULES' : 'MODULES 🔒', '✦', modsOk ? '#d8b45a' : '#5a6472'],
  ]) {
    const r = L.tabs[key], act = tab === key;
    const locked = key === 'mods' && !modsOk;
    const hov = !locked && inR(r, G.mouse.x, G.mouse.y);
    ctx.save();
    // fond : verre sombre, actif = lueur de sa couleur
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, act ? hexA(col, 0.30) : hov ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.045)');
    g.addColorStop(1, act ? hexA(col, 0.12) : 'rgba(255,255,255,0.02)');
    ctx.fillStyle = g; roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = act ? hexA(col, 0.9) : hov ? hexA(col, 0.5) : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = act ? 2 : 1.2;
    roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 10); ctx.stroke();
    // soulignement animé sous l'onglet actif
    if (act) {
      ctx.fillStyle = hexA(col, 0.55 + 0.3 * Math.sin(t * 5));
      roundRect(r.x + r.w / 2 - 34, r.y + r.h - 4, 68, 3, 2); ctx.fill();
    }
    ctx.fillStyle = locked ? '#5a6472' : act ? '#fff' : hov ? '#cfd8dc' : '#8d99ae';
    ctx.font = '700 12.5px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${icon}  ${label}`, r.x + r.w / 2, r.y + r.h / 2 + 4.5);
    if (locked) {
      ctx.fillStyle = '#7d8aa0'; ctx.font = '9px Inter, sans-serif';
      ctx.fillText('NIVEAU 4 À TERMINER', r.x + r.w / 2, r.y + r.h + 13);
    }
    ctx.restore();
  }
}

// ---------- FOND « RELIQUAIRE » : cuir sombre, poussières d'or, sceau runique ----------
function drawModBackdrop(t) {
  // voile chaud par-dessus le mur : dégradé cuir profond
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(16,12,7,0.78)'); bg.addColorStop(0.55, 'rgba(26,20,11,0.72)'); bg.addColorStop(1, 'rgba(12,9,5,0.85)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // halo central ambre
  const cg = ctx.createRadialGradient(W / 2, 300, 60, W / 2, 340, 620);
  cg.addColorStop(0, 'rgba(216,164,74,0.10)'); cg.addColorStop(0.6, 'rgba(160,110,50,0.06)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  // sceau runique géant en filigrane, rotation très lente
  ctx.save();
  ctx.translate(W / 2, 330); ctx.rotate(t * 0.03); ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#d8b45a'; ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  ctx.beginPath(); ctx.arc(0, 0, 210, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(0, 0, 236, 0, TAU); ctx.stroke();
  for (let k = 0; k < 16; k++) {
    const a = k * TAU / 16;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 210, Math.sin(a) * 210);
    ctx.lineTo(Math.cos(a) * 222, Math.sin(a) * 222);
    ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
  // poussières d'or en suspension
  ctx.save();
  for (let i = 0; i < 34; i++) {
    const px = (i * 173 + Math.sin(t * 0.5 + i * 1.3) * 42 + W * 3) % (W + 60) - 30;
    const py = (i * 211 + t * (3 + (i % 5) * 2) + H * 2) % (H * 0.9);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + i * 2.1));
    ctx.globalAlpha = tw * 0.4;
    ctx.fillStyle = i % 3 === 0 ? '#f4dc9a' : i % 3 === 1 ? '#d8b45a' : '#b388ff';
    const s = 0.8 + (i % 3) * 0.6;
    ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

// ---------- CARTE MODULE (grille holographique) ----------
function drawModCard(cd, t, inv) {
  const m = MODULES[cd.id];
  const owned = modState(inv).owned.includes(cd.id);
  const hov = inR(cd, G.mouse.x, G.mouse.y) && !owned;
  const sel = G.shopModSel === cd.id;
  const afford = emeralds(inv) >= m.price;
  const col = RAR_COL[m.rar] || m.col;
  const { x, y, w, h } = cd;
  ctx.save();
  // relief au survol : translation + ombre chaude
  const lift = hov ? -4 : sel ? -2 : 0;
  ctx.translate(0, lift);
  // halo de rareté (pulse lent, plus fort au survol/sélection)
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + x * 0.02);
  const hg = ctx.createRadialGradient(x + w / 2, y + h / 2, 8, x + w / 2, y + h / 2, w * 0.75);
  hg.addColorStop(0, hexA(col, (hov || sel ? 0.22 : 0.10) + pulse * 0.06));
  hg.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = hg; ctx.fillRect(x - 14, y - 14 + lift, w + 28, h + 28);
  // corps de la carte : parchemin sombre veiné
  const cg = ctx.createLinearGradient(x, y, x, y + h);
  cg.addColorStop(0, owned ? 'rgba(34,26,15,0.9)' : hov ? hexA(col, 0.10) : 'rgba(28,22,13,0.88)');
  cg.addColorStop(1, 'rgba(14,11,7,0.92)');
  ctx.fillStyle = cg;
  roundRect(x, y, w, h, 10); ctx.fill();
  // bordure bronze fine + liseré rareté en haut
  ctx.strokeStyle = owned ? 'rgba(105,240,174,0.5)' : hexA(col, hov ? 0.9 : sel ? 0.75 : 0.35 + pulse * 0.12);
  ctx.lineWidth = hov || sel ? 1.8 : 1.2;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 10); ctx.stroke();
  const lg = ctx.createLinearGradient(x + 8, y, x + w - 8, y);
  lg.addColorStop(0, hexA(col, owned ? 0.7 : 0.22)); lg.addColorStop(0.5, hexA(col, 0.1)); lg.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = lg; roundRect(x + 8, y + 2, w - 16, 2, 2); ctx.fill();
  // médaillon gravé + icône de relique animée
  const icx = x + w / 2, icy = y + 46 + Math.sin(t * 2.2 + x * 0.04) * 3;
  ctx.strokeStyle = hexA(col, owned ? 0.4 : 0.15); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(icx, icy, 27, 0, TAU); ctx.stroke();
  ctx.strokeStyle = hexA(col, owned ? 0.15 : 0.06); ctx.lineWidth = 0.7;
  ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.arc(icx, icy, 30, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(icx, icy);
  const sc = (hov ? 1.12 : 1) * (1 + Math.sin(t * 3 + x) * 0.03);
  ctx.scale(sc, sc);
  if (owned) { ctx.shadowColor = '#69f0ae'; ctx.shadowBlur = 10; }
  drawModuleIcon(cd.id, 0, 2, 1.15);
  ctx.restore();
  // nom (tronqué proprement)
  ctx.textAlign = 'center';
  ctx.fillStyle = owned ? '#69f0ae' : '#e8f0f8';
  ctx.font = '700 11.5px Inter, sans-serif';
  ctx.fillText(m.name.length > 20 ? m.name.slice(0, 19) + '…' : m.name, x + w / 2, y + 84, w - 14);
  // rareté + type
  ctx.font = '700 8.5px Inter, sans-serif'; ctx.letterSpacing = '1px';
  ctx.fillStyle = col;
  ctx.fillText(`${m.rar.toUpperCase()} · ${m.type === 'actif' ? 'ACTIF' : 'PASSIF'}`, x + w / 2, y + 100);
  ctx.letterSpacing = '0px';
  // prix + stock
  ctx.font = 'bold 11.5px Consolas, monospace';
  ctx.fillStyle = owned ? '#69f0ae' : afford ? '#ffd740' : '#6f7378';
  ctx.fillText(owned ? '✔ POSSÉDÉ' : `${m.price} ◆`, x + w / 2, y + 118);
  if (!owned) {
    ctx.fillStyle = 'rgba(160,200,230,0.65)';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('✦ tirage du jour — unique', x + w / 2, y + 131);
    if (sel) {
      ctx.fillStyle = col; ctx.font = '8.5px Inter, sans-serif';
      ctx.fillText('▼ détails', x + w / 2, y - 8);
    }
  }
  ctx.restore();
}

// ---------- PANNEAU DE DÉTAIL MODULE ----------
function drawModDetail(L, inv, t) {
  const d = L.modDetail;
  const mid = G.shopModSel;
  if (!mid || !MODULES[mid] || !modShopToday().includes(mid)) {
    // hint
    ctx.fillStyle = 'rgba(216,180,90,0.05)';
    roundRect(d.x, d.y, d.w, d.h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(216,180,90,0.25)'; ctx.lineWidth = 1;
    roundRect(d.x, d.y, d.w, d.h, 12); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(216,180,90,0.6)';
    ctx.font = 'italic 12.5px Georgia, serif';
    ctx.fillText('✦ Sélectionnez un module pour déchiffrer sa page de grimoire ✦', W / 2, d.y + d.h / 2 + 4);
    return;
  }
  const m = MODULES[mid];
  const owned = modState(inv).owned.includes(mid);
  const col = RAR_COL[m.rar] || m.col;
  const afford = emeralds(inv) >= m.price && !owned;
  // page de grimoire : cuir sombre + double filet bronze
  const dg = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.h);
  dg.addColorStop(0, 'rgba(32,25,14,0.95)'); dg.addColorStop(1, 'rgba(18,14,8,0.95)');
  ctx.fillStyle = dg; roundRect(d.x, d.y, d.w, d.h, 12); ctx.fill();
  ctx.strokeStyle = hexA(col, 0.8); ctx.lineWidth = 1.6;
  roundRect(d.x, d.y, d.w, d.h, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(216,180,90,0.35)'; ctx.lineWidth = 1;
  roundRect(d.x + 6, d.y + 6, d.w - 12, d.h - 12, 9); ctx.stroke();
  // veines de parchemin + lueur de relique
  ctx.save(); roundRect(d.x, d.y, d.w, d.h, 12); ctx.clip();
  const vg = ctx.createRadialGradient(d.x + d.w * 0.3, d.y + 40, 10, d.x + d.w * 0.3, d.y + 40, 300);
  vg.addColorStop(0, hexA(col, 0.07)); vg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vg; ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.restore();
  // grande icône animée à gauche — médaillon de relique
  const ix = d.x + 74, iy = d.y + d.h / 2 + 4;
  const bob = Math.sin(t * 2.4) * 4;
  const ig = ctx.createRadialGradient(ix, iy + bob, 6, ix, iy + bob, 56);
  ig.addColorStop(0, hexA(col, 0.4)); ig.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy + bob, 56, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(ix, iy + bob); ctx.scale(1.7, 1.7);
  drawModuleIcon(mid, 0, 2, 1);
  ctx.restore();
  // nom + badges
  const tx = d.x + 140;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f0e6d0'; ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText(m.name, tx, d.y + 32);
  const badgeW = { 'ACTIF': '#ffab40', 'PASSIF': '#69f0ae' }[m.type.toUpperCase()] || '#90a4ae';
  ctx.fillStyle = col; ctx.font = '700 10px Inter, sans-serif'; ctx.letterSpacing = '1.2px';
  ctx.fillText(`${m.rar.toUpperCase()}`, tx + ctx.measureText(m.name).width + 12, d.y + 31);
  ctx.letterSpacing = '0px';
  // pastille type
  ctx.fillStyle = hexA(badgeW, 0.18); roundRect(tx, d.y + 44, m.type === 'actif' ? 62 : 74, 18, 9); ctx.fill();
  ctx.strokeStyle = badgeW; ctx.lineWidth = 1; roundRect(tx, d.y + 44, m.type === 'actif' ? 62 : 74, 18, 9); ctx.stroke();
  ctx.fillStyle = badgeW; ctx.font = '700 9.5px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(m.type === 'actif' ? '✦ ACTIF [X]' : '✚ PASSIF AUTO', tx + (m.type === 'actif' ? 31 : 37), d.y + 57);
  ctx.textAlign = 'left';
  // description complète (retour à la ligne si besoin)
  ctx.fillStyle = '#c9b896'; ctx.font = 'italic 11px Georgia, serif';
  wrapText(m.desc, tx, d.y + 76, d.w - 380, 14);
  // stats : recharge + amélioration + stock
  const statY = d.y + 116;
  ctx.fillStyle = '#9a8a66'; ctx.font = '10.5px Georgia, serif';
  const cdTxt = m.cd > 0 ? `recharge ${m.cd} s · s'améliore niv 1→3` : 'effet permanent · s\'améliore niv 1→3';
  ctx.fillText(cdTxt, tx, statY);
  ctx.fillStyle = '#69f0ae'; ctx.font = 'bold 11px Consolas, monospace';
  ctx.fillText(owned ? '✔ DÉJÀ POSSÉDÉ — ACHAT UNIQUE' : '✦ en vente aujourd\'hui', tx + 250, statY);
  // bouton ACHETER
  const b = L.modBuy;
  const hov = inR(b, G.mouse.x, G.mouse.y);
  ctx.fillStyle = owned ? 'rgba(105,240,174,0.15)' : afford ? (hov ? hexA(col, 0.95) : hexA(col, 0.6)) : 'rgba(255,255,255,0.07)';
  roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
  ctx.strokeStyle = owned ? '#69f0ae' : afford ? col : 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.6; roundRect(b.x, b.y, b.w, b.h, 10); ctx.stroke();
  ctx.fillStyle = owned ? '#69f0ae' : afford ? '#fff' : '#6f7378';
  ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(owned ? '✔ DÉJÀ DANS VOTRE INVENTAIRE' : afford ? `✦ ACHETER · ${m.price} ◆` : `IL FAUT ${m.price} ◆`, b.x + b.w / 2, b.y + b.h / 2 + 5);
  // équiper -> rappel menu modules
  if (!owned) {
    ctx.fillStyle = 'rgba(160,200,230,0.5)'; ctx.font = '9.5px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Équipe-le ensuite dans le menu MODULES (1 actif + jusqu\'à 2 passifs)', b.x + b.w / 2, b.y + b.h + 14);
  }
}

// retour à la ligne simple pour les descriptions de modules
function wrapText(text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); line = wd; yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}
