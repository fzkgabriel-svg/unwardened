// js/menu/quests.js — écran QUÊTES : colonne quotidienne (émeraudes)
// + colonne hebdomadaire (coffres → modules aléatoires, reset lundi minuit)
import { G, ctx, W, H } from '../state.js';
import { roundRect } from '../utils.js';
import { dailyQuests, questState, claimQuest, questCountdown, weeklyQuests, weeklyQuestState, claimWeekly, weekCountdown, weeklyDone } from '../quests.js';
import { inR, overlineCentered, drawMenuButton, menuButtons, hexA, UI, SERIF, C_TEXT, C_MUTED, C_GOLD } from './common.js';
import { sfxConfirm, sfxDeny } from '../audio.js';

const CW = 1120, CH = 490;
// deux colonnes : x, w
const COLS = [{ x: 30, w: 525 }, { x: 595, w: 495 }];

function colOf(i) { return i < 3 ? COLS[0] : COLS[1]; }

export function questsButtons() {
  const cx = W / 2 - CW / 2, cy = H / 2 - CH / 2 - 6;
  const rows = [];
  dailyQuests().forEach((q, i) => {
    const c = colOf(i);
    rows.push({ id: q.id, kind: 'day', i,
      claim: { x: cx + c.x + c.w - 160, y: cy + 122 + i * 100 + 26, w: 130, h: 38 } });
  });
  weeklyQuests().forEach((q, i) => {
    const c = COLS[1];
    rows.push({ id: q.id, kind: 'week', i,
      claim: { x: cx + c.x + c.w - 160, y: cy + 122 + i * 100 + 26, w: 130, h: 38 } });
  });
  return { cx, cy, rows, back: menuButtons().back };
}

export function questsClickAt(x, y) {
  const b = questsButtons();
  if (inR(b.back, x, y)) return 'back';
  for (const r of b.rows) {
    if (!inR(r.claim, x, y)) continue;
    if (r.kind === 'week') {
      const res = claimWeekly(r.id);
      if (res.ok) sfxConfirm(); else sfxDeny();
      return res.ok ? 'chest' : 'deny';
    }
    const res = claimQuest(r.id);
    if (res.ok) sfxConfirm(); else sfxDeny();
    return res.ok ? 'claim' : 'deny';
  }
  return null;
}

// ---------- dessin d'une carte de quête ----------
function drawQuestCard(x, y, w, h, q, st, claimBtn, rewardLabel, rewardCol, claimed, isWeek) {
  ctx.fillStyle = claimed ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)';
  roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = claimed ? 'rgba(255,255,255,0.07)'
    : st.done ? hexA('#69f0ae', 0.55) : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = st.done && !st.claimed ? 1.6 : 1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = `700 18px ${UI}`; ctx.fillStyle = claimed ? C_MUTED : C_TEXT;
  ctx.fillText(`${q.icon} ${q.label}`, x + 18, y + 30);
  ctx.font = `12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText(q.desc, x + 18, y + 50);

  // progression
  const bx = x + 18, bw = w - 36 - 170;
  const by = y + 62;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(bx, by, bw, 9, 5); ctx.fill();
  const pct = Math.min(1, st.cur / q.target);
  if (pct > 0) {
    ctx.fillStyle = st.done ? '#69f0ae' : '#d4b062';
    roundRect(bx, by, Math.max(9, bw * pct), 9, 5); ctx.fill();
  }
  ctx.font = `600 10px ${UI}`; ctx.fillStyle = C_MUTED;
  const lbl = q.metric === 'dmg' ? `${Math.floor(st.cur).toLocaleString('fr-FR')}/${q.target.toLocaleString('fr-FR')}`
    : `${Math.floor(st.cur)}/${q.target}`;
  ctx.fillText(lbl, bx + bw + 8, by + 8);

  // récompense
  ctx.textAlign = 'right'; ctx.font = `700 12px ${UI}`;
  ctx.fillStyle = rewardCol;
  ctx.fillText(rewardLabel, x + w - 14, y + 30);
  if (isWeek) {
    ctx.font = `10px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText('COFFRE → MODULE', x + w - 14, y + 46);
  }

  // bouton
  const hov = inR(claimBtn, G.mouse.x, G.mouse.y);
  ctx.save();
  if (claimed) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(claimBtn.x, claimBtn.y, claimBtn.w, claimBtn.h, 8); ctx.fill();
    ctx.fillStyle = C_MUTED; ctx.font = `600 11px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText('✔ FAIT', claimBtn.x + claimBtn.w / 2, claimBtn.y + claimBtn.h / 2 + 4);
  } else if (st.done) {
    ctx.fillStyle = hexA('#2e7d52', hov ? 1 : 0.9);
    roundRect(claimBtn.x, claimBtn.y, claimBtn.w, claimBtn.h, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 12px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText('RÉCLAMER', claimBtn.x + claimBtn.w / 2, claimBtn.y + claimBtn.h / 2 + 4);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(claimBtn.x, claimBtn.y, claimBtn.w, claimBtn.h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
    roundRect(claimBtn.x + 0.5, claimBtn.y + 0.5, claimBtn.w - 1, claimBtn.h - 1, 8); ctx.stroke();
    ctx.fillStyle = C_MUTED; ctx.font = `600 11px ${UI}`; ctx.textAlign = 'center';
    ctx.fillText('EN COURS…', claimBtn.x + claimBtn.w / 2, claimBtn.y + claimBtn.h / 2 + 4);
  }
  ctx.restore();
}

function drawColumn(cx, col, title, sub, quests, getState, isWeek, startY, rowH, rows) {
  const { x, w } = col;
  ctx.textAlign = 'left';
  ctx.font = `700 15px ${UI}`; ctx.fillStyle = C_GOLD;
  ctx.fillText(title, cx + x + 4, startY - 12);
  ctx.font = `600 11px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.textAlign = 'right';
  ctx.fillText(sub, cx + x + w - 4, startY - 12);
  quests.forEach((q, i) => {
    const st = getState(q);
    const ry = startY + i * rowH;
    const row = rows.find(r => r.id === q.id && r.kind === (isWeek ? 'week' : 'day'));
    drawQuestCard(cx + x, ry, w, rowH - 10, q, st, row ? row.claim : { x: 0, y: 0, w: 0, h: 0 },
      isWeek ? '🎁 COFFRE' : `+${q.rew} ◆`, isWeek ? '#ffb74d' : '#69f0ae', st.claimed, isWeek);
  });
}

export function drawQuestsView() {
  const b = questsButtons();
  const { cx, cy } = b;
  ctx.fillStyle = 'rgba(15,17,19,0.94)';
  roundRect(cx, cy, CW, CH, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(cx + 0.5, cy + 0.5, CW - 1, CH - 1, 14); ctx.stroke();

  ctx.textAlign = 'center';
  overlineCentered('MISSIONS', W / 2, cy + 34);
  ctx.save();
  ctx.fillStyle = C_TEXT; ctx.font = `600 26px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillText('QUÊTES', W / 2 + 1, cy + 66);
  ctx.restore();

  // compte à rebours quotidien + hebdo
  const fmtCd = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}h${String(m).padStart(2, '0')}`; };
  ctx.font = `600 12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText(`Quotidiennes : reset dans ${fmtCd(questCountdown())}  ·  Hebdomadaires : reset lundi dans ${fmtCd(weekCountdown())}`, W / 2, cy + 90);

  // séparateur central
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(cx + (COLS[0].x + COLS[0].w + COLS[1].x) / 2, cy + 112, 1, CH - 112 - 70);

  const startY = cy + 122, rowH = 100;
  const days = dailyQuests(), wks = weeklyQuests();
  drawColumn(cx, COLS[0], '☀ QUOTIDIENNES', 'récompenses en émeraudes', days, questState, false, startY, rowH, b.rows);
  drawColumn(cx, COLS[1], '📅 HEBDOMADAIRES', 'coffres → modules aléatoires', wks, weeklyQuestState, true, startY, rowH, b.rows);

  // pied : progression des deux listes
  const dd = days.filter(q => questState(q).done).length;
  const wd = weeklyDone();
  ctx.font = `600 12px ${UI}`; ctx.fillStyle = C_GOLD; ctx.textAlign = 'center';
  ctx.fillText(`${dd}/3 quêtes du jour terminées  ·  ${wd}/3 quêtes de la semaine terminées`, W / 2, cy + CH - 40);

  drawMenuButton(b.back, '← RETOUR', '#455a64', '#90a4ae', false);
}
