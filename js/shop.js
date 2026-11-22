// ---------- BOUTIQUE : matériaux achetés en Émeraudes, stock limité par jour ----------
// Évolutif : ajouter une entrée dans SHOP suffit (prix, stock/jour, quantité max).
import { G, ctx, W, H, TAU } from './state.js';
import { roundRect, drawMatIcon, hexA } from './utils.js';
import { MATS, addMaterial, loadInv, saveInv } from './inventory.js';
import { sfxClick, sfxPickup } from './audio.js';

// catalogue : clef = matériau vendu (JAMAIS 'emeraude' — on n'achète pas la monnaie)
// stock: null = illimité · sinon unités max par jour
// maxQty: quantité max par achat
export const SHOP = {
  cuir:    { price: 1,  stock: null, maxQty: 99, tag: 'Commun' },
  fer:     { price: 2,  stock: null, maxQty: 99, tag: 'Commun' },
  or:      { price: 4,  stock: 25,   maxQty: 25,  tag: 'Peu commun' },
  essence: { price: 8,  stock: 15,   maxQty: 15,  tag: 'Rare' },
  cristal: { price: 10, stock: 12,   maxQty: 12,  tag: 'Rare' },
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
// inv.shop = { day: 'YYYY-MM-DD', bought: { mat: qté } } — persisté en localStorage,
// donc le stock se réinitialise à minuit même après fermeture du jeu.
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

// ---------- ACHAT ----------
// retourne { ok, msg } — le coût est vérifié AVANT toute déduction
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
// G.shopQty[key] = quantité choisie ; G.shopConfirm = {key, qty, cost} en attente
export function shopClickAt(x, y) {
  const inv = G.inv;
  if (!inv) return null;
  const L = shopLayout();
  if (inR(L.close, x, y)) { G.shopOpen = false; G.shopConfirm = null; return 'close'; }
  // confirmation d'achat en cours : elle intercepte les clics
  if (G.shopConfirm) {
    if (inR(L.confirmBtn, x, y)) {
      const { key, qty } = G.shopConfirm;
      G.shopConfirm = null;
      const r = buyMaterial(inv, key, qty);
      if (r.ok) { sfxPickup(); G.shopFlash = { msg: r.msg, t: G.time }; }
      else { G.shopFlash = { msg: r.msg, t: G.time, bad: true }; sfxClick(); }
      return r.ok ? 'buy' : 'deny';
    }
    if (inR(L.confirmNo, x, y)) { G.shopConfirm = null; sfxClick(); return 'deny'; }
    return 'inside';
  }
  for (const row of L.rows) {
    const key = row.key;
    if (inR(row.minus, x, y)) { setQty(key, -1); sfxClick(); return 'qty'; }
    if (inR(row.plus, x, y)) { setQty(key, +1); sfxClick(); return 'qty'; }
    if (inR(row.buy, x, y)) {
      const qty = G.shopQty[key] || 1;
      const cost = SHOP[key].price * qty;
      const left = shopStockLeft(inv, key);
      if (qty > left || emeralds(inv) < cost) {
        const r = buyMaterial(inv, key, qty); // échoue -> message d'erreur
        G.shopFlash = { msg: r.msg, t: G.time, bad: true };
        sfxClick();
        return 'deny';
      }
      // achat important -> confirmation ; petit achat -> direct
      if (cost >= 12) { G.shopConfirm = { key, qty, cost }; sfxClick(); }
      else {
        const r = buyMaterial(inv, key, qty);
        if (r.ok) { sfxPickup(); G.shopFlash = { msg: r.msg, t: G.time }; }
        else { G.shopFlash = { msg: r.msg, t: G.time, bad: true }; }
      }
      return 'buy';
    }
  }
  return inR(L.panel, x, y) ? 'inside' : 'close';
}
function setQty(key, d) {
  const max = Math.min(SHOP[key].maxQty, shopStockLeft(G.inv, key) === Infinity ? SHOP[key].maxQty : shopStockLeft(G.inv, key));
  const cur = G.shopQty[key] || 1;
  G.shopQty[key] = Math.max(1, Math.min(max, cur + d));
}
function inR(r, x, y) { return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

// ---------- LAYOUT (partagé dessin / clic) ----------
export function shopLayout() {
  const pw = 720, ph = 520, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
  const keys = Object.keys(SHOP);
  const rowH = 78, y0 = py + 108;
  const rows = keys.map((key, i) => {
    const y = y0 + i * (rowH + 8);
    const rx = px + 30, rw = pw - 60;
    return {
      key, x: rx, y, w: rw, h: rowH,
      minus: { x: rx + rw - 268, y: y + rowH / 2 - 15, w: 30, h: 30 },
      plus:  { x: rx + rw - 232, y: y + rowH / 2 - 15, w: 30, h: 30 },
      buy:   { x: rx + rw - 186, y: y + rowH / 2 - 15, w: 160, h: 30 },
    };
  });
  const by = py + ph - 60;
  return {
    panel: { x: px, y: py, w: pw, h: ph },
    close: { x: px + pw - 44, y: py + 12, w: 32, h: 32 },
    rows,
    confirmBtn: { x: W / 2 - 130, y: H / 2 + 60, w: 120, h: 36 },
    confirmNo:  { x: W / 2 + 10,  y: H / 2 + 60, w: 120, h: 36 },
    emeraldBadge: { x: px + pw - 190, y: py + 16, w: 160, h: 34 },
  };
}

// ---------- DESSIN ----------
const C_GOLD = '#d4b062', C_MUT = '#a8b0bc', C_TXT = '#e8e0c8';
export function drawShop() {
  const inv = G.inv;
  if (!inv) return;
  const L = shopLayout();
  const t = G.time;
  // fond assombri
  ctx.fillStyle = 'rgba(5,6,10,0.72)'; ctx.fillRect(0, 0, W, H);
  // panneau principal : bois sombre + filet doré
  ctx.save();
  const pg = ctx.createLinearGradient(0, L.panel.y, 0, L.panel.y + L.panel.h);
  pg.addColorStop(0, '#2a2118'); pg.addColorStop(1, '#1a140e');
  ctx.fillStyle = pg;
  roundRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, 14); ctx.fill();
  ctx.strokeStyle = C_GOLD; ctx.lineWidth = 2;
  roundRect(L.panel.x + 1, L.panel.y + 1, L.panel.w - 2, L.panel.h - 2, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(212,176,98,0.35)'; ctx.lineWidth = 1;
  roundRect(L.panel.x + 6, L.panel.y + 6, L.panel.w - 12, L.panel.h - 12, 10); ctx.stroke();
  // coins dorés
  ctx.fillStyle = C_GOLD;
  for (const [cx, cy] of [[L.panel.x + 10, L.panel.y + 10], [L.panel.x + L.panel.w - 10, L.panel.y + 10],
                         [L.panel.x + 10, L.panel.y + L.panel.h - 10], [L.panel.x + L.panel.w - 10, L.panel.y + L.panel.h - 10]]) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
  }
  // titre
  ctx.textAlign = 'center';
  ctx.fillStyle = C_GOLD; ctx.font = 'bold 26px Cinzel, serif';
  ctx.fillText('💰 BOUTIQUE DU MAÎTRE MARCHAND', W / 2, L.panel.y + 44);
  ctx.fillStyle = C_MUT; ctx.font = 'italic 12px Inter, sans-serif';
  ctx.fillText('Matériaux contre émeraudes — le stock rare se renouvelle chaque jour à minuit', W / 2, L.panel.y + 66);
  // badge émeraudes
  const eb = L.emeraldBadge;
  const eg = ctx.createLinearGradient(eb.x, eb.y, eb.x + eb.w, eb.y);
  eg.addColorStop(0, 'rgba(46,204,113,0.25)'); eg.addColorStop(1, 'rgba(46,204,113,0.08)');
  ctx.fillStyle = eg; roundRect(eb.x, eb.y, eb.w, eb.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(46,204,113,0.6)'; ctx.lineWidth = 1.2;
  roundRect(eb.x, eb.y, eb.w, eb.h, 8); ctx.stroke();
  drawMatIcon('emeraude', eb.x + 20, eb.y + eb.h / 2, 9);
  ctx.textAlign = 'left'; ctx.font = 'bold 14px Consolas, monospace';
  ctx.fillStyle = '#69f0ae';
  ctx.fillText(`${emeralds(inv)}`, eb.x + 34, eb.y + eb.h / 2 + 5);
  ctx.fillStyle = C_MUT; ctx.font = '10px Inter, sans-serif';
  ctx.fillText('disponibles', eb.x + 92, eb.y + eb.h / 2 + 4);
  // bouton fermer
  const cl = L.close;
  const hov = G.mouse.x >= cl.x && G.mouse.x <= cl.x + cl.w && G.mouse.y >= cl.y && G.mouse.y <= cl.y + cl.h;
  ctx.fillStyle = hov ? 'rgba(200,60,50,0.8)' : 'rgba(120,40,35,0.7)';
  roundRect(cl.x, cl.y, cl.w, cl.h, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('✕', cl.x + cl.w / 2, cl.y + cl.h / 2 + 5);

  // ---------- lignes de matériaux ----------
  for (const row of L.rows) {
    const key = row.key, cfg = SHOP[key], info = MATS[key];
    const qty = G.shopQty[key] || 1;
    const left = shopStockLeft(inv, key);
    const leftTxt = cfg.stock == null ? '∞ stock' : `${left}/${cfg.stock} aujourd'hui`;
    const cost = cfg.price * qty;
    const afford = emeralds(inv) >= cost && qty <= left;
    // carte
    const hovR = G.mouse.x >= row.x && G.mouse.x <= row.x + row.w && G.mouse.y >= row.y && G.mouse.y <= row.y + row.h;
    ctx.fillStyle = hovR ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.035)';
    roundRect(row.x, row.y, row.w, row.h, 10); ctx.fill();
    ctx.strokeStyle = hexA(info.color || '#888', 0.5); ctx.lineWidth = 1.2;
    roundRect(row.x, row.y, row.w, row.h, 10); ctx.stroke();
    // icône + nom + rareté
    drawMatIcon(key, row.x + 34, row.y + row.h / 2, 13);
    ctx.textAlign = 'left';
    ctx.fillStyle = info.color || C_TXT; ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(info.name, row.x + 60, row.y + 30);
    ctx.fillStyle = C_MUT; ctx.font = '10.5px Inter, sans-serif';
    ctx.fillText(cfg.tag, row.x + 60, row.y + 46);
    // description courte + stock
    ctx.fillStyle = '#8d99ae'; ctx.font = '10px Inter, sans-serif';
    ctx.fillText(leftTxt, row.x + 60, row.y + 62);
    // prix unitaire
    ctx.fillStyle = '#69f0ae'; ctx.font = 'bold 12px Consolas, monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${cfg.price} ◆ /u`, row.x + row.w - 200, row.y + 30);
    // sélecteur quantité : − qté +
    const qy = row.y + row.h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(row.minus.x - 6, qy - 15, 218, 30, 8); ctx.fill();
    const qm = row.minus, qp = row.plus;
    const qh = G.mouse;
    ctx.fillStyle = qh.x >= qm.x && qh.x <= qm.x + qm.w && qh.y >= qm.y && qh.y <= qm.y + qm.h ? '#fff' : C_MUT;
    ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('−', qm.x + qm.w / 2, qy + 5);
    ctx.fillStyle = C_TXT; ctx.font = 'bold 13px Consolas, monospace';
    ctx.fillText(`×${qty}`, (qm.x + qm.w + qp.x) / 2, qy + 5);
    ctx.fillStyle = qh.x >= qp.x && qh.x <= qp.x + qp.w && qh.y >= qp.y && qh.y <= qp.y + qp.h ? '#fff' : C_MUT;
    ctx.fillText('+', qp.x + qp.w / 2, qy + 5);
    // bouton acheter
    const b = row.buy;
    const bh = G.mouse.x >= b.x && G.mouse.x <= b.x + b.w && G.mouse.y >= b.y && G.mouse.y <= b.y + b.h;
    ctx.fillStyle = afford ? (bh ? 'rgba(46,204,113,0.85)' : 'rgba(46,204,113,0.55)') : 'rgba(255,255,255,0.07)';
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = afford ? '#69f0ae' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.4;
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.stroke();
    ctx.fillStyle = afford ? '#fff' : '#6f7378'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(left <= 0 ? 'ÉPUISÉ' : `ACHETER · ${cost} ◆`, b.x + b.w / 2, qy + 5);
  }
  // message flash (succès / erreur)
  const fl = G.shopFlash;
  if (fl && G.time - fl.t < 2.2) {
    const a = Math.min(1, (2.2 - (G.time - fl.t)) / 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = fl.bad ? '#ff8a80' : '#69f0ae';
    ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(fl.msg, W / 2, L.panel.y + L.panel.h - 16);
    ctx.globalAlpha = 1;
  }
  // ---------- confirmation d'achat ----------
  if (G.shopConfirm) {
    const { key, qty, cost } = G.shopConfirm;
    const info = MATS[key], cfg = SHOP[key];
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    const cw = 460, ch = 240, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
    const cg = ctx.createLinearGradient(0, cy, 0, cy + ch);
    cg.addColorStop(0, '#33271a'); cg.addColorStop(1, '#1c140c');
    ctx.fillStyle = cg; roundRect(cx, cy, cw, ch, 12); ctx.fill();
    ctx.strokeStyle = C_GOLD; ctx.lineWidth = 2; roundRect(cx, cy, cw, ch, 12); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = C_GOLD; ctx.font = 'bold 18px Cinzel, serif';
    ctx.fillText('Confirmer l\'achat', W / 2, cy + 40);
    drawMatIcon(key, W / 2 - 120, cy + 100, 14);
    ctx.fillStyle = info.color || C_TXT; ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(`${qty} × ${info.name}`, W / 2 - 60, cy + 95);
    ctx.fillStyle = C_MUT; ctx.font = '12px Inter, sans-serif';
    ctx.fillText(`Coût : ${cost} émeraudes — stock restant après : ${shopStockLeft(inv, key) - qty}/${cfg.stock == null ? '∞' : cfg.stock}`,
      W / 2, cy + 128);
    // boutons
    for (const [r, label, col] of [[L.confirmBtn, '✔ ACHETER', '#2ecc71'], [L.confirmNo, '✕ ANNULER', '#a55']]) {
      const h = G.mouse.x >= r.x && G.mouse.x <= r.x + r.w && G.mouse.y >= r.y && G.mouse.y <= r.y + r.h;
      ctx.fillStyle = h ? hexA(col, 0.85) : hexA(col, 0.5);
      roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 5);
    }
  }
  ctx.restore();
}
