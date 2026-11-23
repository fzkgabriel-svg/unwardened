// Kaeloryn Studio — écrans en ligne : compte/connexion et classement général.
import { G, ctx, W, H, VERSION } from '../state.js';
import { roundRect } from '../utils.js';
import { net, login, logoutAccount, syncCloud, fetchLeaderboard, fetchPlayer } from '../net.js';
import { inR, fitText, hexA, overline, panel, overlineCentered, drawMenuButton, menuButtons, UI, SERIF, C_TEXT, C_MUTED, C_GOLD } from './common.js';

const GOLD = '#d4af37', SILVER = '#c0c0c8', BRONZE = '#cd8f5a';

// ---------- zone de saisie compte ----------
export function acctInputAt(x, y) {
  // retourne 'pseudo' | 'pass' | 'login' | 'logout' | 'sync' | 'back' | null
  const p = acctLayout();
  if (inR(p.fPseudo, x, y)) return 'pseudo';
  if (inR(p.fPass, x, y)) return 'pass';
  if (inR(p.btnLogin, x, y)) return 'login';
  if (inR(p.btnOut, x, y)) return 'logout';
  if (inR(p.btnSync, x, y)) return 'sync';
  if (inR(menuButtons().back, x, y)) return 'back';
  return null;
}
export function acctKey(k, e) {
  const ai = G.acctInput;
  if (k === 'escape') { G.acctInput = null; G.menuView = 'main'; return; }
  if (k === 'tab') { ai.focus = ai.focus ? 0 : 1; return; }
  if (k === 'enter') { acctSubmit(); return; }
  if (k === 'backspace') { const f = ai.focus ? 'pass' : 'pseudo'; ai[f] = ai[f].slice(0, -1); return; }
  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    const f = ai.focus ? 'pass' : 'pseudo';
    const max = f === 'pseudo' ? 20 : 72;
    if (ai[f].length < max && /[\w\-.'@]/i.test(e.key)) ai[f] += e.key;
  }
}
export function acctClick(x, y) {
  if (!G.acctInput) G.acctInput = { pseudo: '', pass: '', focus: 0 };
  const a = acctInputAt(x, y);
  if (a === 'pseudo' || a === 'pass') { G.acctInput.focus = a === 'pass' ? 1 : 0; return 'field'; }
  if (a === 'login') { acctSubmit(); return 'login'; }
  if (a === 'logout') { logoutAccount(); G.acctInput = null; return 'logout'; }
  if (a === 'sync') { syncCloud(true); return 'sync'; }
  if (a === 'back') { G.menuView = 'main'; G.acctInput = null; return 'back'; }
  return null;
}
function acctSubmit() {
  const ai = G.acctInput;
  if (!ai || net.status === 'connecting') return;
  if (!ai.pseudo.trim() || ai.pass.length < 8) { net.msg = 'Pseudo requis, mot de passe ≥ 8 caractères'; return; }
  login(ai.pseudo.trim(), ai.pass).then(ok => { if (ok) G.acctInput = null; });
}

function acctLayout() {
  const cw = 480, ch = 380, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2 - 20;
  return {
    cx, cy, cw, ch,
    fPseudo: { x: cx + 60, y: cy + 130, w: cw - 120, h: 40 },
    fPass: { x: cx + 60, y: cy + 190, w: cw - 120, h: 40 },
    btnLogin: { x: cx + 60, y: cy + 252, w: cw - 120, h: 40 },
    btnOut: { x: cx + 60, y: cy + 300, w: 140, h: 34 },
    btnSync: { x: cx + cw - 200, y: cy + 300, w: 140, h: 34 },
  };
}

export function drawAccountCard() {
  const p = acctLayout();
  panel(p.cx, p.cy, p.cw, p.ch);
  ctx.textAlign = 'center';
  overlineCentered('KAELORYN STUDIO', W / 2, p.cy + 44);
  ctx.save();
  ctx.fillStyle = C_TEXT; ctx.font = `600 26px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillText('COMPTE EN LIGNE', W / 2 + 1, p.cy + 78);
  ctx.restore();

  // état de connexion
  const stTxt = net.status === 'connected' ? `Connecté : ${net.pseudo}`
    : net.status === 'connecting' ? 'Connexion…'
    : net.status === 'error' ? 'Hors ligne / erreur' : 'Non connecté';
  const stCol = net.status === 'connected' ? '#7CFC9A' : net.status === 'connecting' ? C_GOLD : C_MUTED;
  ctx.font = `600 13px ${UI}`; ctx.fillStyle = stCol;
  ctx.fillText(fitText(stTxt, p.cw - 60), W / 2, p.cy + 108);
  if (net.msg) {
    ctx.font = `12px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText(fitText(net.msg, p.cw - 60), W / 2, p.cy + 126);
  }

  const ai = G.acctInput || { pseudo: '', pass: '', focus: 0 };
  // champs
  const drawField = (f, label, value, isPass, focused) => {
    ctx.fillStyle = focused ? 'rgba(212,175,55,0.10)' : 'rgba(255,255,255,0.05)';
    roundRect(f.x, f.y, f.w, f.h, 8); ctx.fill();
    ctx.strokeStyle = focused ? GOLD : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = focused ? 1.5 : 1; roundRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1, 8); ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = `10px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText(label, f.x + 12, f.y - 6);
    ctx.font = `15px ${UI}`; ctx.fillStyle = C_TEXT;
    const shown = isPass ? '•'.repeat(Math.min(value.length, 24)) : value;
    const blink = focused && (G.time * 2) % 1 < 0.5 ? '|' : '';
    ctx.fillText(fitText(shown + (focused ? blink : ''), f.w - 24), f.x + 14, f.y + f.h / 2 + 5);
  };
  drawField(p.fPseudo, 'PSEUDO DU SITE', ai.pseudo, false, ai.focus === 0 && !net.token);
  drawField(p.fPass, 'MOT DE PASSE', ai.pass, true, ai.focus === 1 && !net.token);

  // boutons
  const connected = net.status === 'connected';
  if (!connected) {
    drawMenuButton(p.btnLogin, 'SE CONNECTER', '#2e7d32', '#a5d6a7', !ai.pseudo.trim() || ai.pass.length < 8);
    ctx.font = `11px ${UI}`; ctx.fillStyle = C_MUTED; ctx.textAlign = 'center';
    ctx.fillText('Compte créé sur kaeloryn.studio — pas de mot de passe en clair', W / 2, p.btnLogin.y + p.btnLogin.h + 18);
  }
  if (connected) {
    drawMenuButton(p.btnSync, net.msg.startsWith('Synchronisation') ? 'SYNC…' : 'SYNC MAINTENANT', '#455a64', '#90a4ae', false);
    drawMenuButton(p.btnOut, 'DÉCONNEXION', '#7a2e2e', '#ef9a9a', false);
    ctx.font = `11px ${UI}`; ctx.fillStyle = C_MUTED; ctx.textAlign = 'center';
    ctx.fillText(`Sauvegarde cloud v${net.cloudVersion} · ${net.lastSync ? 'sync il y a ' + Math.max(0, Math.round((Date.now() - net.lastSync) / 1000)) + 's' : 'jamais synchronisée'}`,
      W / 2, p.btnOut.y + p.btnOut.h + 16);
  }
  drawMenuButton(menuButtons().back, '← RETOUR', '#455a64', '#90a4ae', false);
}

// ---------- classement général ----------
const LB = { offset: 0, q: '', meRank: null, opened: 0 };
export function lbClickAt(x, y) {
  const p = lbLayout();
  if (inR(p.search, x, y)) { LB.searchFocus = !LB.searchFocus; LB.q = LB.searchFocus ? LB.q : LB.q; return 'search'; }
  if (inR(p.prev, x, y) && LB.offset > 0) { LB.offset -= 50; fetchLeaderboard(LB.offset, LB.q); return 'prev'; }
  if (inR(p.next, x, y) && LB.offset + 50 < net.lbTotal) { LB.offset += 50; fetchLeaderboard(LB.offset, LB.q); return 'next'; }
  if (LB.searchFocus) { /* la frappe est gérée par lbKey */ }
  if (inR(menuButtons().back, x, y)) { G.menuView = 'main'; return 'back'; }
  return null;
}
export function lbKey(k, e) {
  if (k === 'escape') { G.menuView = 'main'; LB.searchFocus = false; return; }
  if (!LB.searchFocus) { if (k === 'pageup' || k === 'pageDown') {} return; }
  if (k === 'enter' || k === 'escape') { LB.searchFocus = false; fetchLeaderboard(0, LB.q); return; }
  if (k === 'backspace') LB.q = LB.q.slice(0, -1);
  else if (e.key && e.key.length === 1 && /[\w\-.' ]/i.test(e.key) && LB.q.length < 20) LB.q += e.key;
}
export function openLeaderboard() {
  LB.offset = 0; LB.q = ''; LB.searchFocus = false; LB.opened = G.time;
  G.menuView = 'leaderboard'; fetchLeaderboard(0, '');
}

function lbLayout() {
  const cw = 720, ch = 560, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2 - 20;
  return {
    cx, cy, cw, ch,
    table: { x: cx + 30, y: cy + 190, w: cw - 60, h: ch - 250 },
    search: { x: cx + 30, y: cy + 118, w: cw - 160, h: 34 },
    prev: { x: cx + cw - 230, y: cy + 118, w: 90, h: 34 },
    next: { x: cx + cw - 120, y: cy + 118, w: 90, h: 34 },
  };
}
function podiumCard(x, y, w, h, color, rank, name, score, lvl, worlds, isMe) {
  ctx.fillStyle = hexA(color, 0.10); roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = hexA(color, 0.55); ctx.lineWidth = 1.5;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 10); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `600 34px ${SERIF}`; ctx.fillStyle = color;
  ctx.fillText(String(rank), x + w / 2, y + 52);
  ctx.font = `600 16px ${UI}`; ctx.fillStyle = C_TEXT;
  ctx.fillText(fitText(name, w - 20), x + w / 2, y + 82);
  ctx.font = `600 22px ${UI}`; ctx.fillStyle = C_GOLD;
  ctx.fillText(score.toLocaleString('fr-FR'), x + w / 2, y + 118);
  ctx.font = `12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText(`Nv ${lvl} · ${worlds}/6 mondes`, x + w / 2, y + 140);
  if (isMe) { ctx.font = `600 10px ${UI}`; ctx.fillStyle = GOLD; ctx.fillText('★ VOUS', x + w / 2, y + 162); }
}
export function drawLeaderboardCard() {
  const p = lbLayout();
  const openT = Math.min(1, (G.time - LB.opened) / 0.35); // animation d'ouverture
  ctx.save(); ctx.globalAlpha = openT; ctx.translate(0, (1 - openT) * 18);
  panel(p.cx, p.cy, p.cw, p.ch);
  ctx.restore();
  ctx.textAlign = 'center';
  overlineCentered('COMPÉTITION', W / 2, p.cy + 40);
  ctx.save();
  ctx.fillStyle = C_TEXT; ctx.font = `600 28px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillText('CLASSEMENT GÉNÉRAL', W / 2 + 1, p.cy + 74);
  ctx.restore();

  // recherche + pagination
  ctx.fillStyle = LB.searchFocus ? 'rgba(212,175,55,0.10)' : 'rgba(255,255,255,0.05)';
  roundRect(p.search.x, p.search.y, p.search.w, p.search.h, 8); ctx.fill();
  ctx.strokeStyle = LB.searchFocus ? GOLD : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  roundRect(p.search.x + 0.5, p.search.y + 0.5, p.search.w - 1, p.search.h - 1, 8); ctx.stroke();
  ctx.textAlign = 'left'; ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('🔍', p.search.x + 12, p.search.y + 22);
  ctx.fillStyle = C_TEXT;
  const blink = LB.searchFocus && (G.time * 2) % 1 < 0.5 ? '|' : '';
  ctx.fillText(fitText((LB.q || 'Rechercher un joueur…') + (LB.searchFocus ? blink : ''), p.search.w - 40), p.search.x + 34, p.search.y + 22);
  drawMenuButton(p.prev, '←', '#455a64', '#90a4ae', LB.offset <= 0);
  drawMenuButton(p.next, '→', '#455a64', '#90a4ae', LB.offset + 50 >= net.lbTotal);
  ctx.textAlign = 'center'; ctx.font = `11px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText(`${net.lbTotal} joueurs classés`, W / 2, p.search.y + p.search.h + 16);

  // podium top 3
  const players = net.lb || [];
  if (players.length >= 3) {
    const pw = (p.cw - 60 - 24) / 3, py = p.cy + 165;
    podiumCard(p.cx + 30, py, pw, 175, GOLD, 1, players[0].pseudo, players[0].score, players[0].level, players[0].worlds_done, players[0].pseudo === net.pseudo);
    podiumCard(p.cx + 30 + pw + 12, py + 18, pw, 157, SILVER, 2, players[1].pseudo, players[1].score, players[1].level, players[1].worlds_done, players[1].pseudo === net.pseudo);
    podiumCard(p.cx + 30 + (pw + 12) * 2, py + 18, pw, 157, BRONZE, 3, players[2].pseudo, players[2].score, players[2].level, players[2].worlds_done, players[2].pseudo === net.pseudo);
  }

  // tableau
  const t = p.table;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(t.x, t.y, t.w, t.h, 8); ctx.fill();
  const cols = [t.x + 14, t.x + 60, t.x + t.w * 0.42, t.x + t.w * 0.60, t.x + t.w * 0.78];
  ctx.font = `600 10px ${UI}`; ctx.fillStyle = C_MUTED; ctx.textAlign = 'left';
  ['#', 'JOUEUR', 'NIVEAU', 'MONDES', 'SCORE'].forEach((h, i) => ctx.fillText(h, cols[i], t.y + 20));
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(t.x + 10, t.y + 28, t.w - 20, 1);
  const rows = players.slice(3); // top 3 déjà au podium
  const rowH = Math.min(30, (t.h - 40) / Math.max(1, Math.min(rows.length, 12)));
  const startRank = p.offset + 4;
  if (net.lbLoading) {
    ctx.textAlign = 'center'; ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText('Chargement du classement…', W / 2, t.y + t.h / 2);
  } else if (!players.length) {
    ctx.textAlign = 'center'; ctx.font = `600 15px ${SERIF}`; ctx.fillStyle = C_GOLD;
    ctx.fillText('Aucun explorateur classé', W / 2, t.y + t.h / 2 - 10);
    ctx.font = `12px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText('Sois le premier à inscrire ton nom dans les annales !', W / 2, t.y + t.h / 2 + 16);
    ctx.fillText('Crée un compte, connecte-toi en jeu et synchronise ta progression.', W / 2, t.y + t.h / 2 + 36);
  } else {
    rows.slice(0, Math.floor((t.h - 40) / rowH)).forEach((r, i) => {
      const ry = t.y + 40 + i * rowH;
      const isMe = r.pseudo === net.pseudo;
      if (isMe) { ctx.fillStyle = 'rgba(212,175,55,0.12)'; ctx.fillRect(t.x + 8, ry - rowH + 4, t.w - 16, rowH); }
      ctx.font = `600 ${isMe ? 13 : 12}px ${UI}`;
      ctx.fillStyle = isMe ? GOLD : C_MUTED; ctx.fillText(String(startRank + i), cols[0], ry);
      ctx.fillStyle = isMe ? GOLD : C_TEXT; ctx.fillText(fitText(r.pseudo, cols[2] - cols[1] - 10), cols[1], ry);
      ctx.fillStyle = C_TEXT; ctx.fillText(String(r.level), cols[2], ry);
      ctx.fillText(`${r.worlds_done}/6`, cols[3], ry);
      ctx.fillStyle = C_GOLD; ctx.fillText(r.score.toLocaleString('fr-FR'), cols[4], ry);
    });
  }
  // position du joueur connecté
  if (net.lbMe && net.pseudo) {
    ctx.font = `600 12px ${UI}`; ctx.fillStyle = GOLD;
    ctx.fillText(`★ Ta position : #${net.lbMe.rank} — score ${net.lbMe.score.toLocaleString('fr-FR')}`,
      W / 2, p.cy + p.ch - 14);
  }
  drawMenuButton(menuButtons().back, '← RETOUR', '#455a64', '#90a4ae', false);
}
