// js/menu/quests.js — écran QUÊTES : 3 missions du jour, progression, réclamation
import { G, ctx, W, H } from '../state.js';
import { roundRect } from '../utils.js';
import { dailyQuests, questState, claimQuest, questCountdown } from '../quests.js';
import { inR, overlineCentered, drawMenuButton, menuButtons, hexA, UI, SERIF, C_TEXT, C_MUTED, C_GOLD } from './common.js';
import { sfxConfirm, sfxDeny } from '../audio.js';

const CW = 620, CH = 470;
export function questsButtons() {
  const cx = W / 2 - CW / 2, cy = H / 2 - CH / 2 - 20;
  const rows = dailyQuests().map((q, i) => ({
    id: q.id,
    claim: { x: cx + CW - 190, y: cy + 168 + i * 96 + 26, w: 150, h: 40 },
  }));
  return { cx, cy, rows, back: menuButtons().back };
}

export function questsClickAt(x, y) {
  const b = questsButtons();
  if (inR(b.back, x, y)) return 'back';
  for (const r of b.rows) {
    if (inR(r.claim, x, y)) {
      const res = claimQuest(r.id);
      if (res.ok) sfxConfirm(); else sfxDeny();
      return res.ok ? 'claim' : 'deny';
    }
  }
  return null;
}

export function drawQuestsView() {
  const b = questsButtons();
  const { cx, cy } = b;
  ctx.fillStyle = 'rgba(15,17,19,0.94)';
  roundRect(cx, cy, CW, CH, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(cx + 0.5, cy + 0.5, CW - 1, CH - 1, 14); ctx.stroke();

  ctx.textAlign = 'center';
  overlineCentered('MISSION DU JOUR', W / 2, cy + 38);
  ctx.save();
  ctx.fillStyle = C_TEXT; ctx.font = `600 28px ${SERIF}`; ctx.letterSpacing = '2px';
  ctx.fillText('QUÊTES QUOTIDIENNES', W / 2 + 1, cy + 74);
  ctx.restore();

  // compte à rebours jusqu'à minuit
  const cd = questCountdown();
  const hh = Math.floor(cd / 3600), mm = Math.floor((cd % 3600) / 60), ss = cd % 60;
  ctx.font = `600 12px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText(`Nouvelles quêtes dans ${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`, W / 2, cy + 98);

  const quests = dailyQuests();
  quests.forEach((q, i) => {
    const st = questState(q);
    const ry = cy + 122 + i * 96;
    const rh = 88;
    // carte de quête
    ctx.fillStyle = st.claimed ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)';
    roundRect(cx + 30, ry, CW - 60, rh, 12); ctx.fill();
    ctx.strokeStyle = st.claimed ? 'rgba(255,255,255,0.07)'
      : st.done ? hexA('#69f0ae', 0.55) : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = st.done && !st.claimed ? 1.6 : 1;
    roundRect(cx + 30.5, ry + 0.5, CW - 61, rh - 1, 12); ctx.stroke();

    // icône + nom + description
    ctx.textAlign = 'left';
    ctx.font = `700 22px ${UI}`; ctx.fillStyle = st.claimed ? C_MUTED : C_TEXT;
    ctx.fillText(`${q.icon} ${q.label}`, cx + 52, ry + 32);
    ctx.font = `13px ${UI}`; ctx.fillStyle = C_MUTED;
    ctx.fillText(q.desc, cx + 52, ry + 54);

    // progression : barre + fraction
    const bx = cx + 52, bw = CW - 60 - 52 - 40 - 170;
    const by = ry + 64;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(bx, by, bw, 10, 5); ctx.fill();
    const pct = Math.min(1, st.cur / q.target);
    if (pct > 0) {
      ctx.fillStyle = st.done ? '#69f0ae' : '#d4b062';
      roundRect(bx, by, Math.max(10, bw * pct), 10, 5); ctx.fill();
    }
    ctx.font = `600 11px ${UI}`; ctx.fillStyle = C_MUTED;
    const label = q.metric === 'dmg' ? `${Math.floor(st.cur).toLocaleString('fr-FR')} / ${q.target.toLocaleString('fr-FR')}`
      : `${Math.floor(st.cur)} / ${q.target}`;
    ctx.fillText(label, bx + bw + 10, by + 9);

    // récompense
    ctx.textAlign = 'right'; ctx.font = `700 13px ${UI}`;
    ctx.fillStyle = '#69f0ae';
    ctx.fillText(`+${q.rew} ◆`, cx + CW - 60 - 14, ry + 34);

    // bouton réclamer / statut
    const br = b.rows[i].claim;
    const hov = inR(br, G.mouse.x, G.mouse.y);
    ctx.save();
    if (st.claimed) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      roundRect(br.x, br.y, br.w, br.h, 8); ctx.fill();
      ctx.fillStyle = C_MUTED; ctx.font = `600 12px ${UI}`; ctx.textAlign = 'center';
      ctx.fillText('✔ RÉCLAMÉE', br.x + br.w / 2, br.y + br.h / 2 + 4);
    } else if (st.done) {
      ctx.fillStyle = hexA('#2e7d52', hov ? 1 : 0.9);
      roundRect(br.x, br.y, br.w, br.h, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 13px ${UI}`; ctx.textAlign = 'center';
      ctx.fillText(hov ? 'RÉCLAMER +' + q.rew + ' ◆' : 'RÉCLAMER', br.x + br.w / 2, br.y + br.h / 2 + 4);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(br.x, br.y, br.w, br.h, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
      roundRect(br.x + 0.5, br.y + 0.5, br.w - 1, br.h - 1, 8); ctx.stroke();
      ctx.fillStyle = C_MUTED; ctx.font = `600 12px ${UI}`; ctx.textAlign = 'center';
      ctx.fillText('EN COURS…', br.x + br.w / 2, br.y + br.h / 2 + 4);
    }
    ctx.restore();

  });

  // pied : progression globale
  const done = quests.filter(q => questState(q).done).length;
  ctx.font = `600 12px ${UI}`; ctx.fillStyle = C_GOLD; ctx.textAlign = 'center';
  ctx.fillText(`${done}/${quests.length} quêtes terminées aujourd'hui`, W / 2, cy + CH - 56);

  drawMenuButton(b.back, '← RETOUR', '#455a64', '#90a4ae', false);
}
