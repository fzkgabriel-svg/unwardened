import { G, ctx, W, H, TAU, finalWave } from './state.js';
import { roundRect, drawFlaskIcon, drawItemIcon } from './utils.js';
import { curWorld, RARITY_COLOR } from './world.js';
import { playerAngle } from './attacks.js';
import { ITEMS, getDur } from './inventory.js';

// Barre de statut stylée : fond sombre, dégradé, reflet, stries animées, bordure
function drawBar(x, y, w, h, frac, c1, c2, glowColor = null) {
  frac = Math.max(0, Math.min(1, frac));
  // halo optionnel (barre pleine / importante)
  if (glowColor && frac > 0.02) {
    ctx.shadowColor = glowColor; ctx.shadowBlur = 10;
  }
  // fond
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(x - 2.5, y - 2.5, w + 5, h + 5, h / 2 + 3); ctx.fill();
  ctx.fillStyle = '#14141f';
  roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0;

  if (frac > 0.005) {
    ctx.save();
    roundRect(x, y, w, h, h / 2); ctx.clip();
    // remplissage dégradé
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * frac, h);
    ctx.restore();
  }
  // bordure
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
  roundRect(x, y, w, h, h / 2); ctx.stroke();
}

export function drawHUD() {
  const p = G.player;
  // bandeau supérieur : dégradé parchemin sombre au lieu d'un bloc noir
  const band = ctx.createLinearGradient(0, 0, 0, 130);
  band.addColorStop(0, 'rgba(12,9,4,0.72)');
  band.addColorStop(0.75, 'rgba(12,9,4,0.45)');
  band.addColorStop(1, 'rgba(12,9,4,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 140);
  // filet doré sous le bandeau
  ctx.fillStyle = 'rgba(212,175,55,0.35)';
  ctx.fillRect(0, 138, W, 1.5);
  ctx.textAlign = 'left'; ctx.font = 'bold 15px Georgia, serif'; ctx.fillStyle = '#e8d9b0';
  const waveLabel = G.wave >= finalWave() ? 'VAGUE FINALE' : `Vague ${G.wave}  [${G.waveKills}/${G.waveTarget}]`;
  ctx.fillText(`${waveLabel}   Niveau ${p.level}   Nombre de kills: ${G.kills}`, 18, 24);

  // Timer de partie (haut au centre)
  const t = Math.floor(G.runTime);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  const timeLabel = `⏱ ${mm}:${ss}`;
  ctx.font = 'bold 15px Inter, sans-serif';
  const tw = ctx.measureText(timeLabel).width + 26;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(W / 2 - tw / 2, 8, tw, 26, 13); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  roundRect(W / 2 - tw / 2, 8, tw, 26, 13); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#e0f7fa';
  ctx.fillText(timeLabel, W / 2, 26);

  // indicateur de poison
  if (p.poisonT > 0) {
    ctx.font = 'bold 12px Consolas, monospace'; ctx.fillStyle = '#a4d94e'; ctx.textAlign = 'center';
    ctx.fillText(`POISON ${p.poisonT.toFixed(1)}s`, W / 2, 52);
  }

  // PV
  ctx.font = '11px Georgia, serif'; ctx.fillStyle = '#c9b98a'; ctx.fillText('PV', 18, 66);
  const hpFrac = Math.max(0, p.hp / p.maxHp);
  const lowHp = hpFrac <= 0.3;
  drawBar(48, 54, 220, 14, hpFrac,
    lowHp ? '#e57373' : '#aed581',
    lowHp ? '#8e2424' : '#33691e',
    lowHp ? '#ff1744' : null);
  // compteur PV intégré à droite de la barre, centré verticalement
  ctx.font = 'bold 12px Consolas, monospace'; ctx.textAlign = 'right';
  ctx.fillStyle = '#f5eeda';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5;
  const hpText = `${Math.ceil(p.hp)}/${p.maxHp}`;
  ctx.strokeText(hpText, 262, 65);
  ctx.fillText(hpText, 262, 65);

  // XP
  drawBar(48, 76, 220, 7, p.xp / p.xpNext, '#90caf9', '#1a3a6b', '#64b5f6');
  // XP manquante avant le niveau suivant
  ctx.fillStyle = '#a8c8e8'; ctx.font = 'bold 11px Consolas, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`+${p.xpNext - p.xp} XP`, 276, 84);

  // Barre de charge de l'ultime active (Bombe / Pluie de Glace / Colère Infernale)
  const ultSel = G.stats.ultSel || 'nuke';
  const ultInfo = ultSel === 'glace' && G.stats.iceUlt
    ? { name: 'PLUIE DE GLACE', col: '#b3e5fc', ready: '#81d4fa', barA: '#e1f5fe', barB: '#0277bd', glow: '#0288d1' }
    : ultSel === 'hell' && G.stats.hellUlt
      ? { name: 'TITAN DE FEU', col: '#ffab91', ready: '#ff7043', barA: '#ffe0b2', barB: '#bf360c', glow: '#e64a19' }
      : { name: 'BOMBE ATOMIQUE', col: '#b0a488', ready: '#ff8a65', barA: '#ffcc80', barB: '#7a2e0e', glow: '#ff5722' };
  const ultName = ultInfo.name, ultCol = ultInfo.col;
  ctx.textAlign = 'left'; ctx.font = '12px Georgia, serif';
  const ultReady = p.ultCharge >= 100;
  ctx.fillStyle = ultReady ? ultInfo.ready : ultCol;
  ctx.fillText(`[F] ${ultName}`, 18, 110);
  drawBar(160, 98, 220, 12, p.ultCharge / 100,
    ultInfo.barA, ultInfo.barB,
    ultReady ? ultInfo.glow : null);
  ctx.fillStyle = '#f5eeda'; ctx.font = 'bold 12px Consolas, monospace';
  ctx.fillText(`${Math.floor(p.ultCharge)}%`, 390, 109);
  if (ultReady) {
    ctx.fillStyle = ultInfo.ready; ctx.font = 'bold 14px Inter, sans-serif';
    ctx.globalAlpha = 0.6 + Math.sin(G.time * 6) * 0.4;
    ctx.fillText('PRÊT !', 490, 109);
    ctx.globalAlpha = 1;
  }

  // Bouton inventaire de fioles (HUD, en haut à droite)
  const bx = W - 140, by = 60, bw2 = 122, bh2 = 34;
  const hasPotions = p.potions > 0, full = p.potions >= p.maxPotions;
  const pg = ctx.createLinearGradient(bx, by, bx, by + bh2);
  pg.addColorStop(0, 'rgba(90,25,50,0.9)'); pg.addColorStop(1, 'rgba(45,12,28,0.95)');
  ctx.fillStyle = pg;
  roundRect(bx, by, bw2, bh2, 10); ctx.fill();
  ctx.strokeStyle = full ? '#ff80ab' : hasPotions ? 'rgba(255,128,171,0.7)' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = (full || hasPotions) ? 2 : 1;
  ctx.shadowColor = 'rgba(255,128,171,0.8)'; ctx.shadowBlur = hasPotions ? 12 : 0;
  roundRect(bx, by, bw2, bh2, 10); ctx.stroke();
  ctx.shadowBlur = 0;
  // icône fiole
  drawFlaskIcon(bx + 20, by + bh2 / 2 + 1, 0.85, hasPotions);
  // compteur
  ctx.textAlign = 'left'; ctx.font = 'bold 11px Consolas, monospace'; ctx.fillStyle = '#ff9ebb';
  ctx.fillText('FIOLES', bx + 38, by + 14);
  ctx.font = 'bold 17px Consolas, monospace';
  ctx.fillStyle = hasPotions ? '#fff' : '#888';
  ctx.fillText(`${p.potions}/${p.maxPotions}`, bx + 38, by + 29);
  // badge touche W
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(bx + bw2 - 30, by + 7, 22, 20, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
  roundRect(bx + bw2 - 30, by + 7, 22, 20, 5); ctx.stroke();
  ctx.fillStyle = '#ff9ebb'; ctx.font = 'bold 13px Consolas, monospace'; ctx.textAlign = 'center';
  ctx.fillText('W', bx + bw2 - 19, by + 21);
  // overlay cooldown fiole
  if (p.potionCooldown > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(bx, by, bw2, bh2, 10); ctx.fill();
    ctx.fillStyle = '#ff9ebb'; ctx.font = 'bold 14px Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${p.potionCooldown.toFixed(1)}s`, bx + bw2 / 2, by + bh2 / 2 + 5);
  }
  // ---------- Slots de mode d'attaque (bas gauche) ----------
  // pendant le TITAN DE FEU : les armes sont remplacées par LASER (clic gauche)
  // et VOLCAN (clic droit, une seule fois par transformation)
  const titan = p.ultActive > 0;
  const slots = titan ? [
    { mode: -1, cd: p.attackCooldown, cd2: 0, icon: 'laser', key: 'G', sub: null },
    { mode: -2, cd: 0, cd2: p.handUsed ? 0 : p.handCd, icon: 'volcano', key: 'D', sub: null, used: p.handUsed }
  ] : [
    { mode: 1, cd: p.attackCooldown, cd2: p.spinCooldown, icon: 'sword', key: '&', sub: 'D', subColor: '#ff9100' },
    { mode: 3, cd: p.attackCooldown, cd2: p.shieldCd,  icon: 'lance', key: 'é', sub: 'D', subColor: '#4fc3f7' }
  ];
  slots.forEach((s, i) => {
    const x = 18 + i * 110, y = H - 78, w = 96, h = 64;
    const active = titan || p.attackMode === s.mode;
    // le volcan est "épuisé" après usage : slot grisé
    const spent = s.used;
    ctx.fillStyle = active ? 'rgba(45,55,85,0.9)' : 'rgba(0,0,0,0.55)';
    roundRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = active ? '#ffd740' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = active ? 2.5 : 1.5;
    if (active) { ctx.shadowColor = 'rgba(255,215,64,0.7)'; ctx.shadowBlur = 10; }
    roundRect(x, y, w, h, 10); ctx.stroke();
    ctx.shadowBlur = 0;
    // numéro de touche
    ctx.fillStyle = active ? '#ffd740' : '#777'; ctx.font = 'bold 14px Consolas, monospace'; ctx.textAlign = 'left';
    ctx.fillText(s.key, x + 10, y + 20);
    // icône
    drawAttackIcon(s.icon, x + w / 2 + 7, y + 39, active ? '#fff' : '#90a4ae');
    // badge secondaire (clic droit : rotation ou dôme) avec son cooldown
    if (s.sub) {
      const subReady = s.cd2 <= 0;
      ctx.fillStyle = subReady ? s.subColor + '40' : 'rgba(255,255,255,0.08)';
      roundRect(x + w - 27, y + h - 27, 21, 19, 5); ctx.fill();
      ctx.strokeStyle = subReady ? s.subColor : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      roundRect(x + w - 27, y + h - 27, 21, 19, 5); ctx.stroke();
      ctx.fillStyle = subReady ? s.subColor : '#666'; ctx.font = 'bold 12px Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillText(s.sub, x + w - 16.5, y + h - 14);
      // temps de recharge restant
      if (s.cd2 > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        roundRect(x + w - 27, y + h - 27, 21, 19, 5); ctx.fill();
        ctx.fillStyle = s.subColor; ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText(s.cd2.toFixed(0), x + w - 16.5, y + h - 14);
      }
    }
    // overlay cooldown
    if (s.cd > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(x, y, w, h, 10); ctx.fill();
      ctx.fillStyle = '#ff8a80'; ctx.font = 'bold 16px Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillText(s.cd.toFixed(1), x + w / 2, y + h / 2 + 5);
    }
    // volcan épuisé : recouvrement "utilisé" (une seule fois par transformation)
    if (s.used) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(x, y, w, h, 10); ctx.fill();
      ctx.fillStyle = '#81c784'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('✓ UTILISÉ', x + w / 2, y + h / 2 + 5);
    }
    // verrou de changement d'arme : 2s sans attaque, affiché sur les deux slots
    if (p.switchLock > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(x, y, w, h, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,64,0.7)'; ctx.lineWidth = 1.5;
      roundRect(x, y, w, h, 10); ctx.stroke();
      ctx.fillStyle = '#ffd740'; ctx.font = 'bold 15px Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillText(`⏳ ${p.switchLock.toFixed(1)}`, x + w / 2, y + h / 2 + 5);
    }
  });

  drawBossBar();
  drawMinimap();
  drawEquipPanel();
}

// ---------- Barre de vie du boss final (grand bandeau centré) ----------
function drawBossBar() {
  const e = G.enemies.find(en => en.type === 'finalBoss' || en.type === 'finalBossGlace' || en.type === 'finalBossEnfer'
    || en.type === 'finalBossEgout' || en.type === 'finalBossSpace');
  if (!e) return;
  const frozen = e.type === 'finalBossGlace';
  const hell = e.type === 'finalBossEnfer';
  const sewer = e.type === 'finalBossEgout';
  const space = e.type === 'finalBossSpace';
  const name = hell ? '☠ BOSS FINAL — LE BARON DE L\'ENFER ☠' : frozen ? '☠ BOSS FINAL — SOUVERAIN DE GLACE ☠'
    : sewer ? '☠ BOSS FINAL — LE TYRAN DES PROFONDEURS ☠' : space ? '☠ BOSS FINAL — L\'ABOMINATION COSMIQUE ☠' : '☠ BOSS FINAL — SEIGNEUR OUBLIÉ ☠';
  const tint = hell ? '255,112,67' : frozen ? '129,212,250' : sewer ? '174,234,0' : space ? '179,157,219' : '224,64,251';
  const bw = 640, bh = 24, bx = W / 2 - bw / 2, by = 46;
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px Georgia, serif'; ctx.fillStyle = hell ? '#ffab91' : frozen ? '#81d4fa' : sewer ? '#dce775' : space ? '#e1bee7' : '#e040fb';
  ctx.shadowColor = `rgba(${tint},0.8)`; ctx.shadowBlur = 10;
  ctx.fillText(name, W / 2, by - 8);
  ctx.shadowBlur = 0;
  // cadre
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  roundRect(bx - 4, by - 4, bw + 8, bh + 8, 9); ctx.fill();
  ctx.strokeStyle = `rgba(${tint},0.85)`; ctx.lineWidth = 2;
  roundRect(bx - 4, by - 4, bw + 8, bh + 8, 9); ctx.stroke();
  // remplissage dégradé
  const f = Math.max(0, e.hp / e.maxHp);
  if (f > 0.005) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    if (frozen) { g.addColorStop(0, '#01579b'); g.addColorStop(0.6, '#0288d1'); g.addColorStop(1, '#81d4fa'); }
    else if (hell) { g.addColorStop(0, '#4a0d0d'); g.addColorStop(0.6, '#c62828'); g.addColorStop(1, '#ff7043'); }
    else if (sewer) { g.addColorStop(0, '#1b3a00'); g.addColorStop(0.6, '#558b2f'); g.addColorStop(1, '#dce775'); }
    else if (space) { g.addColorStop(0, '#1a0033'); g.addColorStop(0.6, '#6a1b9a'); g.addColorStop(1, '#e1bee7'); }
    else { g.addColorStop(0, '#4a148c'); g.addColorStop(0.6, '#8e24aa'); g.addColorStop(1, '#e040fb'); }
    ctx.fillStyle = g;
    ctx.save();
    roundRect(bx, by, bw * f, bh, 6); ctx.fill();
    ctx.restore();
    // stries de la barre
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 1; i < 8; i++) ctx.fillRect(bx + (bw * f / 8) * i, by, 2, bh);
  }
  // marqueurs de phase : traits à 66 % et 33 % de PV
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const cut of [0.66, 0.33]) {
    const mx = bx + bw * cut;
    ctx.fillRect(mx - 1, by - 2, 2, bh + 4);
  }
  ctx.font = 'bold 12px Consolas, monospace'; ctx.fillStyle = '#fff';
  ctx.fillText(`${Math.ceil(e.hp)} / ${e.maxHp}`, W / 2, by + bh / 2 + 4);
  // phase courante (le boss final passe en phase 2 à 66 %, phase 3 à 33 %)
  const ph = (e.phase || 0) + 1;
  const phNames = hell ? ['', 'FUREUR DU BARON', 'RAGE DE L\'ENFER']
    : frozen ? ['', 'GLACIATION', 'FUREUR GLACIALE']
    : sewer ? ['', 'FURIE TOXIQUE', 'FUREUR DU TYRAN']
    : space ? ['', 'FUREUR COSMIQUE', 'ABOMINATION']
    : ['', 'COLÈRE ANCESTRALE', 'FUREUR DU ROI OUBLIÉ'];
  if (e.phase) {
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = hell ? '#ffab91' : frozen ? '#b3e5fc' : sewer ? '#dce775' : space ? '#e1bee7' : '#ce93d8';
    ctx.fillText(`PHASE ${ph} — ${phNames[e.phase]}`, W / 2, by - 22);
  }
}

// ---------- Panneau équipement (côté droit du HUD, sous les fioles) ----------
function drawEquipPanel() {
  const inv = G.inv;
  if (!inv || !inv.equip) return;
  const slots = [['weapon', 'ARME'], ['armor', 'ARMURE'], ['charm', 'TALISMAN'], ['boots', 'BOTTES']];
  const px = W - 168, py = 102, pw = 154, rowH = 44;
  const ph = 30 + slots.length * rowH + 8;
  // cadre
  ctx.fillStyle = 'rgba(8,10,6,0.62)';
  roundRect(px, py, pw, ph, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,0.4)'; ctx.lineWidth = 1;
  roundRect(px, py, pw, ph, 10); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c9b98a'; ctx.font = 'bold 10px Georgia, serif';
  ctx.fillText('ÉQUIPEMENT', px + 12, py + 17);
  slots.forEach(([slot, label], i) => {
    const ry = py + 28 + i * rowH;
    const id = inv.equip[slot], it = id ? ITEMS[id] : null;
    // fond de ligne
    ctx.fillStyle = it ? 'rgba(255,215,64,0.07)' : 'rgba(255,255,255,0.03)';
    roundRect(px + 6, ry, pw - 12, rowH - 6, 7); ctx.fill();
    if (it) {
      const dur = getDur(inv, id);
      drawItemIcon(it, px + 22, ry + (rowH - 6) / 2, 11);
      ctx.fillStyle = '#ffe9a3'; ctx.font = 'bold 10px Inter, sans-serif';
      const name = it.name.length > 15 ? it.name.slice(0, 14) + '…' : it.name;
      ctx.fillText(name, px + 38, ry + 14);
      ctx.fillStyle = '#8d99ae'; ctx.font = '8px Inter, sans-serif';
      ctx.fillText(label, px + 38, ry + 25);
      // barre de durabilité
      const dbx = px + 38, dbw = pw - 60, dby = ry + 31;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(dbx, dby, dbw, 5, 2.5); ctx.fill();
      const dc = dur > 50 ? '#69f0ae' : dur > 25 ? '#ffd740' : '#ff5252';
      ctx.fillStyle = dc;
      if (dur > 0) { roundRect(dbx, dby, dbw * dur / 100, 5, 2.5); ctx.fill(); }
      ctx.fillStyle = '#8d99ae'; ctx.font = '7px Inter, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(dur <= 0 ? 'CASSÉ' : `${Math.round(dur)}%`, px + pw - 12, dby + 5);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#546e7a'; ctx.font = 'italic 10px Inter, sans-serif';
      ctx.fillText(`${label} : —`, px + 38, ry + 21);
    }
  });
}

// ---------- Minimap : position du joueur, bâtiments et portails dans le monde ----------
function drawMinimap() {
  const w = curWorld();
  if (!w) return;
  const mw = 148, mh = 99; // ratio monde 5400x3600 = 1.5
  const mx = W - mw - 14, my = H - mh - 92;
  // cadre
  ctx.fillStyle = 'rgba(8,10,6,0.72)';
  roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,0.55)'; ctx.lineWidth = 1.5;
  roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.stroke();
  // fond du monde
  ctx.save();
  roundRect(mx, my, mw, mh, 5); ctx.clip();
  const hellMap = (w.def && w.def.biome === 'hell') || G.campaign === 2;
  const frozenMap = (w.def && w.def.biome === 'ice') || G.campaign === 1;
  const sewerMap = (w.def && w.def.biome === 'sewer') || G.campaign === 3;
  const spaceMap = (w.def && w.def.biome === 'space') || G.campaign === 4;
  ctx.fillStyle = hellMap ? 'rgba(52,16,10,0.92)' : frozenMap ? 'rgba(214,232,244,0.92)'
    : sewerMap ? 'rgba(38,42,26,0.92)' : spaceMap ? 'rgba(10,8,30,0.95)'
    : 'rgba(60,84,46,0.9)';
  ctx.fillRect(mx, my, mw, mh);
  const sx = wx => mx + (wx / w.w) * mw;
  const sy = wy => my + (wy / w.h) * mh;
  // lacs : ellipses bleues (infranchissables hors pont)
  for (const l of w.lakes || []) {
    ctx.fillStyle = 'rgba(50,120,190,0.75)';
    ctx.beginPath();
    ctx.ellipse(sx(l.x), sy(l.y), Math.max(2, (l.rx / w.w) * mw), Math.max(1.5, (l.ry / w.h) * mh), 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,200,240,0.5)'; ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // bâtiments : visibles seulement une fois découverts
  for (const b of w.buildings) {
    if (!b.seen) continue;
    ctx.fillStyle = b.looted ? 'rgba(105,240,174,0.55)' : RARITY_COLOR[b.def.rarity];
    ctx.fillRect(sx(b.x) - 1.5, sy(b.y) - 1.5, 3, 3);
  }
  // obstacles : petits points gris (rochers / montagnes)
  for (const o of w.obstacles || []) {
    ctx.fillStyle = 'rgba(130,125,115,0.8)';
    ctx.beginPath(); ctx.arc(sx(o.x), sy(o.y), Math.max(1.2, o.r / 45), 0, TAU); ctx.fill();
  }
  // portails : violet = sortie, bleu = retour
  for (const [po, c] of [[w.portal, '#e040fb'], [w.returnPortal, '#4fc3f7']]) {
    if (!po) continue;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(sx(po.x), sy(po.y), 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx(po.x), sy(po.y), 4.5, 0, TAU); ctx.stroke();
  }
  // boss final : gros point pulsant (violet / orange infernal selon la campagne)
  for (const en of G.enemies) {
    if (en.type !== 'finalBoss' && en.type !== 'finalBossGlace' && en.type !== 'finalBossEnfer'
      && en.type !== 'finalBossEgout' && en.type !== 'finalBossSpace') continue;
    const bx = sx(en.x), by = sy(en.y);
    const pulse = 4 + Math.sin(G.time * 6) * 1.6;
    const hellBoss = en.type === 'finalBossEnfer';
    const sewerBoss = en.type === 'finalBossEgout';
    const spaceBoss = en.type === 'finalBossSpace';
    const c0 = hellBoss ? '255,112,67' : sewerBoss ? '174,234,0' : spaceBoss ? '179,157,219' : '224,64,251';
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, pulse * 3);
    g.addColorStop(0, `rgba(${c0},0.95)`); g.addColorStop(0.5, `rgba(${c0},0.55)`); g.addColorStop(1, `rgba(${c0},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, pulse * 3, 0, TAU); ctx.fill();
    ctx.fillStyle = hellBoss ? '#fff3e0' : sewerBoss ? '#f9fbe7' : spaceBoss ? '#ede7f6' : '#f3e5f5';
    ctx.beginPath(); ctx.arc(bx, by, pulse * 0.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = hellBoss ? '#ff7043' : sewerBoss ? '#aeea00' : spaceBoss ? '#b388ff' : '#e040fb'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bx, by, pulse + 2.5, 0, TAU); ctx.stroke();
  }
  // rectangle de la zone visible (caméra)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(sx(G.camX || 0), sy(G.camY || 0), (W / w.w) * mw, (H / w.h) * mh);
  // joueur : flèche orientée vers la visée
  const p = G.player;
  ctx.save();
  ctx.translate(sx(p.x), sy(p.y));
  ctx.rotate(playerAngle());
  ctx.fillStyle = '#ffd740';
  ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(5, 0); ctx.lineTo(-3.5, -3); ctx.lineTo(-1.5, 0); ctx.lineTo(-3.5, 3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // étiquette
  ctx.font = 'bold 10px Consolas, monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232,217,176,0.7)';
  ctx.fillText(w.def.name.toUpperCase(), mx, my - 8);
}

// notification de succès débloqué (bandeau doré en haut au centre)
export function drawAchToast() {
  const t = G.achToast;
  if (!t) return;
  const a = Math.min(1, t.t / 0.4, (3.5 - t.t) / 0.3 + 1); // fade in/out
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  const label = `SUCCÈS DÉBLOQUÉ : ${t.name}`;
  ctx.font = 'bold 17px Georgia, serif';
  const tw = ctx.measureText(label).width;
  const bw = tw + 70, bh = 40, bx = W / 2 - bw / 2, by = 64;
  const g = ctx.createLinearGradient(bx, by, bx, by + bh);
  g.addColorStop(0, 'rgba(80,60,10,0.95)'); g.addColorStop(1, 'rgba(40,30,5,0.95)');
  ctx.fillStyle = g;
  roundRect(bx, by, bw, bh, 12); ctx.fill();
  ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255,215,64,0.8)'; ctx.shadowBlur = 14;
  roundRect(bx, by, bw, bh, 12); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a3';
  ctx.font = '22px serif';
  ctx.fillText(t.icon, bx + 26, by + 28);
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText(label, bx + bw / 2 + 12, by + 26);
  ctx.restore();
}

// avertissement orange (ex. équipement à moins de 20 % de durabilité)
export function drawWarnToast() {
  const t = G.warnToast;
  if (!t) return;
  const a = Math.min(1, t.t / 0.4, (6 - t.t) / 0.3 + 1); // fade in/out
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.font = 'bold 16px Inter, sans-serif';
  const tw = ctx.measureText(t.name).width;
  const bw = tw + 60, bh = 38, bx = W / 2 - bw / 2, by = 64;
  const g = ctx.createLinearGradient(bx, by, bx, by + bh);
  g.addColorStop(0, 'rgba(90,50,5,0.95)'); g.addColorStop(1, 'rgba(45,22,3,0.95)');
  ctx.fillStyle = g;
  roundRect(bx, by, bw, bh, 12); ctx.fill();
  ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255,152,0,0.8)'; ctx.shadowBlur = 12;
  roundRect(bx, by, bw, bh, 12); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe0b2';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText(t.name, bx + bw / 2, by + 24);
  ctx.restore();
}

// icônes détaillées des modes d'attaque
function drawAttackIcon(kind, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'laser') {
    // laser du Titan de Feu : canon orange + faisceau
    ctx.rotate(-Math.PI / 4);
    // faisceau
    ctx.strokeStyle = 'rgba(255,140,60,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(4, -16); ctx.lineTo(4, 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,245,220,0.95)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(4, -16); ctx.lineTo(4, 8); ctx.stroke();
    // corps du canon
    const lg = ctx.createLinearGradient(0, 10, 0, -8);
    lg.addColorStop(0, '#bf360c'); lg.addColorStop(0.6, '#ff7043'); lg.addColorStop(1, '#ffd740');
    ctx.fillStyle = lg;
    ctx.strokeStyle = '#5d1303'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.lineTo(6, -4); ctx.lineTo(10, -8);
    ctx.lineTo(10, -11); ctx.lineTo(-10, -11); ctx.lineTo(-10, -8); ctx.lineTo(-6, -4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // batterie + poignée
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-11, 10, 7, 6);
    ctx.fillStyle = '#ffd740';
    ctx.beginPath(); ctx.arc(0, 14, 2.4, 0, TAU); ctx.fill();
  } else if (kind === 'volcano') {
    // volcan du Titan de Feu : cône + cratère de lave
    // cône
    const vg = ctx.createLinearGradient(0, -10, 0, 12);
    vg.addColorStop(0, '#5d4037'); vg.addColorStop(1, '#3e2723');
    ctx.fillStyle = vg;
    ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-13, 12); ctx.lineTo(-4, -8); ctx.lineTo(4, -8); ctx.lineTo(13, 12);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // cratère : lave bouillonnante
    const cg = ctx.createRadialGradient(0, -9, 1, 0, -9, 7);
    cg.addColorStop(0, '#fff9c4'); cg.addColorStop(0.5, '#ff5722'); cg.addColorStop(1, 'rgba(183,28,28,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, -9, 7, 0, TAU); ctx.fill();
    // projections de lave
    ctx.fillStyle = '#ffab00';
    ctx.beginPath(); ctx.arc(-9, -2, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 0, 1.8, 0, TAU); ctx.fill();
  } else if (kind === 'sword') {
    // épée + rotation : lame ornée, fuller, garde à quillons, lames orbitales en filigrane
    ctx.rotate(-Math.PI / 4);
    // filigrane : 2 mini-lames orbitales autour de la lame
    ctx.strokeStyle = 'rgba(255,215,64,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0.6, 2.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI + 0.6, Math.PI + 2.2); ctx.stroke();
    // lame : triangle acier dégradé avec tranchants
    const lg = ctx.createLinearGradient(0, 8, 0, -14);
    lg.addColorStop(0, '#78909c'); lg.addColorStop(0.5, '#eceff1'); lg.addColorStop(1, '#b0bec5');
    ctx.fillStyle = lg;
    ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2.2, 6); ctx.lineTo(2.2, 6); ctx.lineTo(1.4, -8); ctx.lineTo(0, -14); ctx.lineTo(-1.4, -8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // fuller central
    ctx.strokeStyle = 'rgba(55,71,79,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -9); ctx.stroke();
    // liseré doré
    ctx.strokeStyle = 'rgba(255,215,64,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(-1.2, -8); ctx.stroke();
    // garde à quillons dorée
    ctx.fillStyle = '#ffd740'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -1); ctx.lineTo(8, -1); ctx.lineTo(7, 1.5); ctx.lineTo(-7, 1.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-8, 0.2, 2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(8, 0.2, 2, 0, TAU); ctx.fill(); ctx.stroke();
    // poignée cuir + pommeau
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-2, 6, 4, 7);
    ctx.fillStyle = '#ffd740';
    ctx.beginPath(); ctx.arc(0, 14, 2.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1; ctx.stroke();
  } else {
    // bouclier + lance : grand bouclier bossu avec gemme, lance en diagonale
    // lance (derrière le bouclier)
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-12, 13); ctx.lineTo(11, -12); ctx.stroke();
    // virole dorée
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(6, -7); ctx.lineTo(9, -10); ctx.stroke();
    // pointe de lance acier
    ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#78909c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(11, -12); ctx.lineTo(17, -18); ctx.lineTo(13, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // bouclier rond bombé
    const sg = ctx.createRadialGradient(-4, -5, 2, -3, 0, 12);
    sg.addColorStop(0, '#eceff1'); sg.addColorStop(0.55, '#90a4ae'); sg.addColorStop(1, '#455a64');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(-4, 1, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2; ctx.stroke();
    // bordure bronze
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-4, 1, 9, 0, TAU); ctx.stroke();
    // croix + gemme centrale
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-11, 1); ctx.lineTo(3, 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-4, 8); ctx.stroke();
    ctx.fillStyle = '#1565c0';
    ctx.beginPath(); ctx.arc(-4, 1, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0d47a1'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}
