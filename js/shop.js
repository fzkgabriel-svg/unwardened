// ---------- BOUTIQUE : matériaux achetés en Émeraudes, stock limité par jour ----------
// Scène immersive : intérieur de boutique, marchand animé, pedestaux,
// panneau de détail, particules et compte à rebours jusqu'au reset de minuit.
import { G, ctx, W, H, TAU } from './state.js';
import { roundRect, drawMatIcon, hexA } from './utils.js';
import { MATS, addMaterial, loadInv, saveInv } from './inventory.js';
import { sfxClick, sfxPickup } from './audio.js';

// catalogue : clef = matériau vendu (JAMAIS 'emeraude' — on n'achète pas la monnaie)
// stock: null = illimité · sinon unités max par jour
// maxQty: quantité max par achat
// tag = étiquette de rareté affichée (identité visuelle par matériau)
export const SHOP = {
  cuir:    { price: 1,  stock: null, maxQty: 99, tag: 'Commun',     tagCol: '#b0bec5', desc: 'Cuir tanné des Terres Oubliées. Résiste à l\'usure, imperméable à la boue.' },
  fer:     { price: 2,  stock: null, maxQty: 99, tag: 'Commun',     tagCol: '#b0bec5', desc: 'Minerai brut.forger en lames et armures. La base de tout artisanat.' },
  or:      { price: 4,  stock: 25,   maxQty: 25,  tag: 'Peu commun', tagCol: '#ffd740', desc: 'Lingots précieux aux reflets chauds. Prisés des nobles et des temples.' },
  essence: { price: 8,  stock: 15,   maxQty: 15,  tag: 'Rare',       tagCol: '#ce93d8', desc: 'Sève condensée des mondes profonds. Pulse doucement, presque vivante.' },
  cristal: { price: 10, stock: 12,   maxQty: 12,  tag: 'Rare',       tagCol: '#4fc3f7', desc: 'Gemmes de glace et de foudre. Conduisent la lumière comme un cœur.' },
};

// bouton 💰 à côté des pastilles MUSIQUE / EFFETS (coin haut-droit)
export const SHOP_BTN = { x: W * 0.77 - 96, y: 8, w: 88, h: 30 };
export function shopButtonAt(x, y) {
  const r = SHOP_BTN;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
export function drawShopBtn() {
  const r = SHOP_BTN;
  const hov = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w && G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
  ctx.save();
  ctx.fillStyle = hov ? 'rgba(30,32,36,0.9)' : 'rgba(12,14,16,0.75)';
  roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  ctx.strokeStyle = hov ? 'rgba(105,240,174,0.5)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 8); ctx.stroke();
  ctx.fillStyle = '#69f0ae'; ctx.font = '15px serif'; ctx.textAlign = 'center';
  ctx.fillText('💰', r.x + 20, r.y + r.h / 2 + 5);
  ctx.fillStyle = hov ? '#e8e2d2' : '#8d99ae';
  ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.letterSpacing = '0.8px';
  ctx.fillText('BOUTIQUE', r.x + 34, r.y + r.h / 2 + 3.5);
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
      const { key, qty } = G.shopConfirm;
      G.shopConfirm = null;
      const r = buyMaterial(inv, key, qty);
      if (r.ok) {
        sfxPickup();
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
        sfxClick();
        return 'deny';
      }
      if (cost >= 12) { G.shopConfirm = { key, qty, cost }; sfxClick(); }
      else {
        const r = buyMaterial(inv, key, qty);
        if (r.ok) {
          sfxPickup(); G.shopFlash = { msg: r.msg, t: G.time };
          G.shopMood = 'joy'; G.shopMoodT = G.time;
          G.shopBurst = { x: L.balance.x + 30, y: L.balance.y + 15, t: G.time, col: '#69f0ae' };
        } else {
          G.shopFlash = { msg: r.msg, t: G.time, bad: true };
          G.shopMood = 'sad'; G.shopMoodT = G.time;
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
    minus: { x: dx + dw - 330, y: dy + 74, w: 34, h: 34 },
    plus:  { x: dx + dw - 288, y: dy + 74, w: 34, h: 34 },
    buy:   { x: dx + dw - 240, y: dy + 68, w: 200, h: 44 },
    confirmBtn: { x: W / 2 - 130, y: H / 2 + 90, w: 120, h: 36 },
    confirmNo:  { x: W / 2 + 10,  y: H / 2 + 90, w: 120, h: 36 },
    confirmPanel: { x: W / 2 - 230, y: H / 2 - 110, w: 460, h: 220 },
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

  // ===== ÉTAGÈRES décoratives en arrière-plan =====
  drawShelves(t);

  // ===== MARCHAND =====
  drawMerchant(L.merchant, t);

  // ===== EN-TÊTE : titre + solde + compte à rebours + fermer =====
  ctx.textAlign = 'center';
  ctx.fillStyle = C_GOLD; ctx.font = 'bold 24px Cinzel, serif';
  ctx.fillText('💰 BOUTIQUE DU MAÎTRE MARCHAND', W / 2, 44);
  ctx.fillStyle = C_MUT; ctx.font = 'italic 11.5px Inter, sans-serif';
  ctx.fillText('Matériaux contre émeraudes — les stocks rares se renouvellent chaque jour', W / 2, 66);
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

  // ===== COMPToir + pedestals =====
  drawCounter(t);
  for (const ped of L.peds) drawPedestal(ped, t, inv);

  // ===== PANNEAU DE DÉTAIL =====
  if (G.shopSel && SHOP[G.shopSel]) drawDetail(L, inv, t);
  else drawHint(L);

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
    const { key, qty, cost } = G.shopConfirm;
    const info = MATS[key], cfg = SHOP[key];
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    const P = L.confirmPanel;
    const cg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h);
    cg.addColorStop(0, '#33271a'); cg.addColorStop(1, '#1c140c');
    ctx.fillStyle = cg; roundRect(P.x, P.y, P.w, P.h, 14); ctx.fill();
    ctx.strokeStyle = C_GOLD; ctx.lineWidth = 2; roundRect(P.x, P.y, P.w, P.h, 14); ctx.stroke();
    // coin ornements
    ctx.fillStyle = C_GOLD;
    for (const [ox, oy] of [[P.x + 12, P.y + 12], [P.x + P.w - 12, P.y + 12], [P.x + 12, P.y + P.h - 12], [P.x + P.w - 12, P.y + P.h - 12]]) {
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = C_GOLD; ctx.font = 'bold 19px Cinzel, serif';
    ctx.fillText('Confirmer l\'achat', W / 2, P.y + 42);
    drawMatIcon(key, W / 2 - 130, P.y + 105, 16);
    ctx.fillStyle = info.color || C_TXT; ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(`${qty} × ${info.name}`, W / 2 - 60, P.y + 100);
    ctx.fillStyle = C_MUT; ctx.font = '12px Inter, sans-serif';
    ctx.fillText(`Coût : ${cost} émeraudes — solde après : ${emeralds(inv) - cost} ◆`,
      W / 2, P.y + 132);
    ctx.fillStyle = '#8d99ae'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`Stock restant : ${shopStockLeft(inv, key) - qty}/${cfg.stock == null ? '∞' : cfg.stock}`,
      W / 2, P.y + 152);
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
  // sélecteur quantité
  const qy = d.y + d.h / 2 + 8;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(L.minus.x - 8, L.minus.y - 4, L.plus.x + L.plus.w - L.minus.x + 16, L.minus.h + 8, 9); ctx.fill();
  const mq = inR(L.minus, G.mouse.x, G.mouse.y), pq = inR(L.plus, G.mouse.x, G.mouse.y);
  ctx.fillStyle = mq ? '#fff' : C_MUT; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('−', L.minus.x + L.minus.w / 2, qy + 4);
  ctx.fillStyle = C_TXT; ctx.font = 'bold 13px Consolas, monospace';
  ctx.fillText(`×${qty}`, (L.minus.x + L.minus.w + L.plus.x) / 2, qy + 4);
  ctx.fillStyle = pq ? '#fff' : C_MUT;
  ctx.fillText('+', L.plus.x + L.plus.w / 2, qy + 4);
  // coût total
  ctx.fillStyle = afford ? '#69f0ae' : '#ff8a80'; ctx.font = 'bold 13px Consolas, monospace'; ctx.textAlign = 'right';
  ctx.fillText(`TOTAL : ${cost} ◆`, L.buy.x - 14, qy + 4);
  // bouton acheter
  const b = L.buy, bh = inR(b, G.mouse.x, G.mouse.y);
  ctx.fillStyle = afford ? (bh ? 'rgba(46,204,113,0.9)' : 'rgba(46,204,113,0.55)') : 'rgba(255,255,255,0.08)';
  roundRect(b.x, b.y, b.w, b.h, 9); ctx.fill();
  ctx.strokeStyle = afford ? '#69f0ae' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
  roundRect(b.x, b.y, b.w, b.h, 9); ctx.stroke();
  ctx.fillStyle = afford ? '#fff' : '#6f7378'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(left <= 0 ? 'ÉPUISÉ' : `🛒 ACHETER · ${cost} ◆`, b.x + b.w / 2, b.y + b.h / 2 + 5);
}
