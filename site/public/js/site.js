// Kaeloryn Studio — JS partagé : logo, navigation, particules, session, API.
export const LOGO_SVG = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f0d492"/><stop offset=".5" stop-color="#d4b062"/><stop offset="1" stop-color="#8a6f3a"/>
  </linearGradient></defs>
  <path d="M32 4 L54 18 V46 L32 60 L10 46 V18 Z" stroke="url(#lg)" stroke-width="2.5" fill="rgba(212,176,98,.08)"/>
  <path d="M32 14 L44 21 V35 L32 42 L20 35 V21 Z" stroke="url(#lg)" stroke-width="1.5" fill="none" opacity=".7"/>
  <path d="M32 22 L37 25 V31 L32 34 L27 31 V25 Z" fill="url(#lg)"/>
  <circle cx="32" cy="28" r="2.2" fill="#0d0f16"/>
</svg>`;

export const NAV = [
  ['/', 'Accueil'], ['/game.html', 'Le Jeu'], ['/wiki.html', 'Wiki'],
  ['/news.html', 'Actualités'], ['/classement.html', 'Classement'],
  ['/community.html', 'Communauté'], ['/account.html', 'Mon Compte']
];

// ---------- particules magiques ----------
export function startParticles() {
  const cv = document.getElementById('fx'); if (!cv) return;
  const cx = cv.getContext('2d');
  let W, H, ps = [];
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  resize(); addEventListener('resize', resize);
  const N = Math.min(70, Math.floor(innerWidth / 18));
  for (let i = 0; i < N; i++) ps.push({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight,
    r: Math.random() * 1.8 + 0.4, vy: -(Math.random() * 0.35 + 0.08),
    vx: (Math.random() - 0.5) * 0.15, a: Math.random() * Math.PI * 2,
    hue: Math.random() < 0.75 ? '212,176,98' : '140,180,255'
  });
  (function loop() {
    cx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.y += p.vy; p.x += p.vx + Math.sin(p.a += 0.01) * 0.12;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      if (p.x < -4) p.x = W + 4; if (p.x > W + 4) p.x = -4;
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7);
      cx.fillStyle = `rgba(${p.hue},${0.25 + 0.35 * Math.sin(p.a * 2)})`;
      cx.fill();
    }
    requestAnimationFrame(loop);
  })();
}

// ---------- API ----------
export async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', ...opts,
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
  return d;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = iso => iso ? new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR',
  { day: 'numeric', month: 'long', year: 'numeric' }) : '';
export const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo'
  : n > 1024 ? Math.round(n / 1024) + ' Ko' : n + ' o';

// ---------- session courante ----------
let _me = undefined;
export async function me() {
  if (_me !== undefined) return _me;
  try { _me = (await api('/api/me')).user; } catch (e) { _me = null; }
  return _me;
}
export function setMe(u) { _me = u; }

// ---------- injection nav + footer ----------
export async function mountChrome(active) {
  const here = location.pathname.replace(/\.html$/, '') || '/';
  const act = active || (here === '/' ? '/' : here);
  const user = await me();
  const nav = document.getElementById('navlinks');
  if (nav) nav.innerHTML = NAV.map(([h, l]) =>
    `<a class="nl${act === h || (h !== '/' && act.startsWith(h)) ? ' on' : ''}" href="${h}">${l}</a>`).join('')
    + (user?.role === 'admin' ? `<a class="nl" href="/admin.html" style="color:var(--gold)">ADMIN</a>` : '');
  const auth = document.getElementById('navauth');
  if (auth) auth.innerHTML = user
    ? `<a class="btn small ghost" href="/account.html">${esc(user.pseudo)}</a>
       <a class="btn small" href="https://unwardened.netlify.app" target="_blank" rel="noopener">▶ JOUER</a>`
    : `<a class="btn small ghost" href="/account.html">CONNEXION</a>
       <a class="btn small" href="https://unwardened.netlify.app" target="_blank" rel="noopener">▶ JOUER</a>`;
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
}
export function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
