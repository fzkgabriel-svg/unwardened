// Kaeloryn Studio — serveur officiel.
// Node.js natif : HTTP + SQLite (node:sqlite) + crypto (scrypt, sessions).
// Aucune dépendance externe. Lancement : node server.js [port]
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream, mkdirSync, readdirSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { db, q } from './db.js';

const ROOT = dirname(fileURLToPath(import.meta.url));

// .env local (site/.env) : SMTP_URL=..., MAIL_FROM=..., ADMIN_*=...
// les variables déjà définies dans l'environnement priment
try {
  const envFile = join(ROOT, '.env');
  if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* .env absent ou illisible : ignoré */ }
const PUB = join(ROOT, 'public');
const DATA = join(ROOT, 'data');
// zips de release versionnés dans le repo : contrairement à data/ (éphémère
// sur Render), ils survivent aux redéploiements
const PKG_DL = join(ROOT, 'downloads');
const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10);
const DEV = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
const SESSION_DAYS = 30;

// ---------- helpers HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.zip': 'application/zip', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const send = (res, code, body, type = 'application/json; charset=utf-8', headers = {}) => {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const json = (res, code, obj, headers) => send(res, code, obj, 'application/json; charset=utf-8', headers);
const readBody = req => new Promise((ok, no) => {
  let b = ''; req.on('data', c => { b += c; if (b.length > 8e6) { no(new Error('too large')); req.destroy(); } });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } });
  req.on('error', no);
});
const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

// ---------- mots de passe : scrypt + sel par utilisateur ----------
const SCRYPT = { N: 16384, r: 8, p: 1 };
function hashPass(pass, salt = crypto.randomBytes(16).toString('hex')) {
  const h = crypto.scryptSync(String(pass), salt, 64, SCRYPT).toString('hex');
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${h}`;
}
function verifyPass(pass, stored) {
  try {
    const [algo, N, r, p, salt, h] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const calc = crypto.scryptSync(String(pass), salt, 64, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(calc, Buffer.from(h, 'hex'));
  } catch (e) { return false; }
}

// ---------- sessions ----------
function newSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  q.insSession.run(token, userId, exp);
  res.setHeader('Set-Cookie', `ts_sess=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${DEV ? '' : '; Secure'}`);
}
function getSession(req) {
  const m = /ts_sess=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const s = q.sessByToken.get(m[1]);
  if (!s || s.expires_at < new Date().toISOString() || s.suspended) return null;
  return s;
}
const pubUser = u => u && ({ id: u.id, pseudo: u.pseudo, email: u.email, role: u.role,
  avatar: u.avatar ? `/avatar/${u.avatar}` : null, verified: !!u.verified,
  created_at: u.created_at });

// ---------- anti-abus : rate limit en mémoire ----------
const hits = new Map();
function rateLimit(key, max, winMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < winMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr); return true;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) { const f = a.filter(t => now - t < 3600e3); f.length ? hits.set(k, f) : hits.delete(k); } }, 600e3).unref();

// ---------- validation ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = s => String(s || '').trim();
function validPseudo(p) { return /^[A-Za-z0-9_\-\.]{3,20}$/.test(p); }
function validPass(p) { return typeof p === 'string' && p.length >= 8 && p.length <= 72; }

// ---------- jetons (vérification email / reset mdp) ----------
function makeToken(userId, kind, hours) {
  const t = crypto.randomBytes(24).toString('hex');
  q.insToken.run(t, userId, kind, new Date(Date.now() + hours * 3600e3).toISOString());
  return t;
}
function useToken(tok, kind) {
  const t = q.tokByToken.get(tok);
  if (!t || t.kind !== kind || t.used || t.expires_at < new Date().toISOString()) return null;
  q.useToken.run(tok); return t;
}
// ---------- envoi d'e-mails : client SMTP minimal (node:net/tls, zéro dépendance) ----------
// SMTP_URL=smtps://user:pass@hote:465  (TLS implicite — recommandé)
// SMTP_URL=smtp://user:pass@hote:25    (clair ; STARTTLS non géré)
// MAIL_FROM="Kaeloryn Studio <no-reply@domaine>" pour l'expéditeur.
const MAIL_FROM = process.env.MAIL_FROM || 'Kaeloryn Studio <no-reply@kaeloryn.studio>';
let smtpCfg = null;
try {
  if (process.env.SMTP_URL) {
    const u = new URL(process.env.SMTP_URL);
    smtpCfg = {
      secure: u.protocol === 'smtps:',
      user: decodeURIComponent(u.username || ''),
      pass: decodeURIComponent(u.password || ''),
      host: u.hostname, port: +(u.port || (u.protocol === 'smtps:' ? 465 : 25)),
    };
  }
} catch (e) { console.error('[smtp] SMTP_URL invalide :', e.message); }

function smtpSend({ to, subject, html }) {
  return new Promise((resolve, reject) => {
    const sock = smtpCfg.secure
      ? tls.connect(smtpCfg.port, smtpCfg.host, { servername: smtpCfg.host })
      : net.connect(smtpCfg.port, smtpCfg.host);
    sock.setTimeout(15000, () => sock.destroy(new Error('délai SMTP dépassé')));
    let buf = '', waiter = null, done = false;
    const finish = (err, r) => { if (!done) { done = true; try { sock.destroy(); } catch (e) {} err ? reject(err) : resolve(r); } };
    sock.on('error', finish);
    sock.on('data', d => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (waiter && waiter.re.test(line)) { const w = waiter; waiter = null; w.ok(line); }
      }
    });
    // attend une réponse définitive "CODE " (les lignes "CODE-" d'un multiline sont ignorées)
    const waitAny = () => new Promise(ok => { waiter = { re: /^[0-9]{3} /, ok }; });
    const cmd = async (line, code) => {
      sock.write(line + '\r\n');
      const r = await waitAny();
      if (r.slice(0, 3) !== code) throw new Error(`SMTP ${code} attendu après « ${line.slice(0, 60)} », reçu : ${r.slice(0, 140)}`);
      return r;
    };
    const b64 = s => Buffer.from(s, 'utf8').toString('base64');
    (async () => {
      const greet = await waitAny();
      if (!greet.startsWith('220')) throw new Error('SMTP : ' + greet.slice(0, 140));
      await cmd('EHLO kaeloryn.studio', '250');
      if (smtpCfg.user) {
        await cmd('AUTH LOGIN', '334');
        await cmd(b64(smtpCfg.user), '334');
        await cmd(b64(smtpCfg.pass), '235');
      }
      const mailFrom = MAIL_FROM.match(/<([^>]+)>/)?.[1] || (MAIL_FROM.includes('@') ? MAIL_FROM.trim() : 'no-reply@kaeloryn.studio');
      await cmd(`MAIL FROM:<${mailFrom}>`, '250');
      await cmd(`RCPT TO:<${to}>`, '250');
      await cmd('DATA', '354');
      const enc = s => '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
      const msg = [
        `From: ${MAIL_FROM}`, `To: ${to}`, `Subject: ${enc(subject)}`,
        'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64', '', Buffer.from(html, 'utf8').toString('base64'), '.',
      ].join('\r\n');
      sock.write(msg + '\r\n');
      const r = await waitAny();
      if (r.slice(0, 3) !== '250') throw new Error('SMTP DATA refusé : ' + r.slice(0, 140));
      try { sock.write('QUIT\r\n'); } catch (e) {}
      finish(null, true);
    })().catch(finish);
  });
}

// URL publique du site : PUBLIC_URL si définie, sinon dérivée de la requête
// (Render termine le TLS et transmet x-forwarded-proto/host)
const publicBase = req => process.env.PUBLIC_URL
  || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

// sans SMTP configuré : le lien est journalisé (mode dev) — jamais affiché en prod
// renvoie le statut d'envoi ('sent' | 'dev' | 'no-smtp' | 'err: …') pour le diagnostic API
const mailNote = async (kind, email, link) => {
  const tag = kind === 'verify' ? 'Vérification email' : 'Réinitialisation mot de passe';
  const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#d4b062">${tag} — Kaeloryn Studio</h2>
    <p>Bonjour,</p>
    <p>Cliquez sur le bouton ci-dessous pour ${kind === 'verify' ? 'vérifier votre adresse e-mail' : 'réinitialiser votre mot de passe'} :</p>
    <p style="text-align:center;margin:26px 0"><a href="${link}" style="background:#d4b062;color:#16130c;
      padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">${kind === 'verify' ? 'VÉRIFIER MON E-MAIL' : 'RÉINITIALISER'}</a></p>
    <p style="color:#888;font-size:12px">Ou copiez ce lien :<br><a href="${link}">${link}</a></p>
    <p style="color:#888;font-size:12px">Ce lien expire dans 24 h. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
  </div>`;
  if (smtpCfg) {
    try {
      await smtpSend({ to: email, subject: `${tag} — Kaeloryn Studio`, html });
      console.log(`[smtp] ${tag} envoyé à ${email}`);
      return 'sent';
    } catch (e) {
      console.error(`[smtp] échec ${tag} → ${email} :`, e.message);
      return 'err: ' + e.message;
    }
  }
  if (DEV) { console.log(`[mail:dev] ${tag} -> ${email}\n  ${link}`); return 'dev'; }
  console.warn(`[smtp] SMTP_URL non configuré — ${tag} pour ${email} NON envoyé`);
  return 'no-smtp';
};

// ---------- API ----------
const routes = [];
const route = (m, p, fn, opts = {}) => routes.push({ m, p, fn, ...opts });
const needAuth = fn => (req, res, b, s) => s ? fn(req, res, b, s) : json(res, 401, { error: 'Connexion requise' });
const needAdmin = fn => needAuth((req, res, b, s) =>
  s.role === 'admin' ? fn(req, res, b, s) : json(res, 403, { error: 'Accès administrateur requis' }));

route('POST', '/api/register', async (req, res, b) => {
  const ip = clientIp(req);
  if (!rateLimit('reg:' + ip, 5, 3600e3)) return json(res, 429, { error: 'Trop d\'inscriptions depuis cette adresse' });
  const pseudo = clean(b.pseudo), email = clean(b.email).toLowerCase(), pass = b.password;
  if (!validPseudo(pseudo)) return json(res, 400, { error: 'Pseudo invalide (3-20 caractères : lettres, chiffres, _ - .)' });
  if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'Adresse e-mail invalide' });
  if (!validPass(pass)) return json(res, 400, { error: 'Mot de passe : 8 caractères minimum' });
  if (q.userByPseudo.get(pseudo) || q.userByEmail.get(email)) return json(res, 409, { error: 'Pseudo ou e-mail déjà utilisé' });
  const r = q.insertUser.run(pseudo, email, hashPass(pass));
  const uid = Number(r.lastInsertRowid);
  const tok = makeToken(uid, 'verify', 24);
  const mail = await mailNote('verify', email, `${publicBase(req)}/account.html?verify=${tok}`);
  newSession(uid, res);
  json(res, 201, { ok: true, user: pubUser(q.userById.get(uid)), verifyToken: DEV ? tok : undefined, mail });
});

route('POST', '/api/login', async (req, res, b) => {
  const ip = clientIp(req);
  if (!rateLimit('login:' + ip, 10, 600e3)) return json(res, 429, { error: 'Trop de tentatives — réessayez plus tard' });
  const email = clean(b.email).toLowerCase(), pass = b.password;
  const u = q.userByEmail.get(email) || q.userByPseudo.get(clean(b.email));
  // délai constant pour ne pas révéler l'existence du compte
  const okPass = u && verifyPass(pass, u.pass);
  await new Promise(r => setTimeout(r, 120));
  if (!u || !okPass) return json(res, 401, { error: 'Identifiants incorrects' });
  if (u.suspended) return json(res, 403, { error: 'Ce compte est suspendu' });
  newSession(u.id, res);
  json(res, 200, { ok: true, user: pubUser(q.userById.get(u.id)) });
});

route('POST', '/api/logout', (req, res) => {
  const m = /ts_sess=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (m) q.delSession.run(m[1]);
  res.setHeader('Set-Cookie', 'ts_sess=; HttpOnly; Path=/; Max-Age=0');
  json(res, 200, { ok: true });
});

route('GET', '/api/me', needAuth((req, res, b, s) => json(res, 200, { user: pubUser(s) })));

route('POST', '/api/profile', needAuth((req, res, b, s) => {
  const pseudo = clean(b.pseudo);
  if (pseudo && pseudo !== s.pseudo) {
    if (!validPseudo(pseudo)) return json(res, 400, { error: 'Pseudo invalide' });
    const clash = q.userByPseudo.get(pseudo);
    if (clash && clash.id !== s.id) return json(res, 409, { error: 'Pseudo déjà pris' });
    q.setPseudo.run(pseudo, s.id);
  }
  if (typeof b.avatar === 'string' && b.avatar) {
    const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.avatar);
    if (!m || m[2].length > 400000) return json(res, 400, { error: 'Image invalide (max ~300 Ko, png/jpg/webp)' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const fn = `u${s.id}.${ext}`;
    writeFileSync(join(DATA, 'avatars', fn), Buffer.from(m[2], 'base64'));
    q.setAvatar.run(fn, s.id);
  }
  json(res, 200, { ok: true, user: pubUser(q.userById.get(s.id)) });
}));

route('POST', '/api/forgot', async (req, res, b) => {
  const ip = clientIp(req);
  if (!rateLimit('forgot:' + ip, 5, 3600e3)) return json(res, 429, { error: 'Trop de demandes' });
  const u = q.userByEmail.get(clean(b.email).toLowerCase());
  let tok, mail = 'no-account';
  if (u) {
    tok = makeToken(u.id, 'reset', 1);
    mail = await mailNote('reset', u.email, `${publicBase(req)}/account.html?reset=${tok}`);
  }
  await new Promise(r => setTimeout(r, 100));
  json(res, 200, { ok: true, devToken: DEV && u ? tok : undefined, mail });
});

route('POST', '/api/reset', async (req, res, b) => {
  const t = useToken(clean(b.token), 'reset');
  if (!t || !validPass(b.password)) return json(res, 400, { error: 'Lien invalide ou expiré' });
  q.setPass.run(hashPass(b.password), t.user_id);
  q.delUserSessions.run(t.user_id); // déconnecte toutes les sessions
  json(res, 200, { ok: true });
});

route('GET', '/api/verify', (req, res) => {
  const tok = new URL(req.url, 'http://x').searchParams.get('token') || '';
  const t = useToken(tok, 'verify');
  if (!t) return send(res, 400, '<h1>Lien invalide ou expiré</h1>', 'text/html; charset=utf-8');
  q.setVerified.run(t.user_id);
  send(res, 200, '<h1 style="font-family:sans-serif">E-mail vérifié ! Vous pouvez fermer cette page.</h1>', 'text/html; charset=utf-8');
});

// renvoi de l'e-mail de vérification (réservé aux comptes non vérifiés)
route('POST', '/api/resend-verify', needAuth(async (req, res, b, s) => {
  const ip = clientIp(req);
  if (!rateLimit('rverify:' + s.id, 3, 3600e3)) return json(res, 429, { error: 'Trop de renvois — réessayez plus tard' });
  const u = q.userById.get(s.id);
  if (u.verified) return json(res, 400, { error: 'E-mail déjà vérifié' });
  const tok = makeToken(s.id, 'verify', 24);
  const mail = await mailNote('verify', u.email, `${publicBase(req)}/account.html?verify=${tok}`);
  json(res, 200, { ok: true, devToken: DEV ? tok : undefined, mail });
}));

route('GET', '/api/news', (req, res) => {
  const list = q.allNews.all().map(n => ({ ...n, image: n.image || null }));
  json(res, 200, { news: list });
});

// ---------- admin ----------
route('GET', '/api/admin/stats', needAdmin((req, res) => json(res, 200, {
  users: q.countUsers.get().c, news: q.countNews.get().c,
  downloads: q.countDownloads.get().c, recent: q.recentDownloads.all()
})));
route('GET', '/api/admin/users', needAdmin((req, res) => json(res, 200, { users: q.allUsers.all() })));
route('POST', '/api/admin/users/:id/suspend', needAdmin((req, res, b, s, m) => {
  const u = q.userById.get(+m[1]); if (!u) return json(res, 404, { error: 'Introuvable' });
  if (u.id === s.id) return json(res, 400, { error: 'Vous ne pouvez pas vous suspendre' });
  q.setSuspended.run(u.suspended ? 0 : 1, u.id);
  if (u.suspended) {} else q.delUserSessions.run(u.id);
  json(res, 200, { ok: true, suspended: !u.suspended });
}));
route('POST', '/api/admin/users/:id/role', needAdmin((req, res, b, s, m) => {
  if (+m[1] === s.id) return json(res, 400, { error: 'Vous ne pouvez pas modifier votre propre rôle' });
  const role = b.role === 'admin' ? 'admin' : 'user';
  q.setRole.run(role, +m[1]); json(res, 200, { ok: true });
}));
route('DELETE', '/api/admin/users/:id', needAdmin((req, res, b, s, m) => {
  const id = +m[1];
  if (id === s.id) return json(res, 400, { error: 'Suppression de son propre compte impossible' });
  q.delUser.run(id); json(res, 200, { ok: true });
}));
route('POST', '/api/admin/news', needAdmin((req, res, b) => {
  const title = clean(b.title), body = clean(b.body);
  if (!title || !body) return json(res, 400, { error: 'Titre et contenu requis' });
  let img = clean(b.image);
  if (img.startsWith('data:image/')) {
    const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(img);
    if (!m || m[2].length > 1.5e6) return json(res, 400, { error: 'Image trop lourde (max ~1 Mo)' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const fn = `news_${Date.now()}.${ext}`;
    writeFileSync(join(DATA, 'news', fn), Buffer.from(m[2], 'base64'));
    img = '/newsimg/' + fn;
  }
  const r = q.insNews.run(title.slice(0, 200), body.slice(0, 20000), img || null);
  json(res, 201, { ok: true, id: Number(r.lastInsertRowid) });
}));
route('PUT', '/api/admin/news/:id', needAdmin((req, res, b, s, m) => {
  const n = q.newsById.get(+m[1]); if (!n) return json(res, 404, { error: 'Introuvable' });
  const title = clean(b.title) || n.title, body = clean(b.body) || n.body;
  let img = b.image === undefined ? n.image : clean(b.image);
  if (img && img.startsWith('data:image/')) {
    const mm = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(img);
    if (!mm || mm[2].length > 1.5e6) return json(res, 400, { error: 'Image trop lourde' });
    const ext = mm[1] === 'jpeg' ? 'jpg' : mm[1];
    const fn = `news_${Date.now()}.${ext}`;
    writeFileSync(join(DATA, 'news', fn), Buffer.from(mm[2], 'base64'));
    img = '/newsimg/' + fn;
  }
  q.updNews.run(title.slice(0, 200), body.slice(0, 20000), img || null, n.id);
  json(res, 200, { ok: true });
}));
route('DELETE', '/api/admin/news/:id', needAdmin((req, res, b, s, m) => {
  q.delNews.run(+m[1]); json(res, 200, { ok: true });
}));
// releases : métadonnées gérées ici ; le fichier est déposé dans data/downloads
// via tools/package.js (qui calcule taille + SHA-256).
route('POST', '/api/admin/releases', needAdmin((req, res, b) => {
  const version = clean(b.version), filename = clean(b.filename);
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[\w.\-]+\.zip$/.test(filename))
    return json(res, 400, { error: 'version x.y.z et filename.zip requis' });
  const path = [join(DATA, 'downloads', filename), join(PKG_DL, filename)].find(existsSync);
  if (!path) return json(res, 400, { error: 'Fichier absent de data/downloads ou downloads/ — lancez tools/package.js' });
  const st = statSync(path);
  const sha = crypto.createHash('sha256').update(readFileSync(path)).digest('hex');
  const cur = b.current ? 1 : 0;
  if (cur) q.setCurrent.run();
  const r = q.insRelease.run(version, filename, st.size, sha,
    clean(b.notes).slice(0, 4000), clean(b.min_spec).slice(0, 300), clean(b.rec_spec).slice(0, 300), cur);
  json(res, 201, { ok: true, id: Number(r.lastInsertRowid), sha256: sha });
}));
route('POST', '/api/admin/releases/:id/current', needAdmin((req, res, b, s, m) => {
  q.setCurrent.run(); q.setCurId.run(+m[1]); json(res, 200, { ok: true });
}));
route('DELETE', '/api/admin/releases/:id', needAdmin((req, res, b, s, m) => {
  q.delRelease.run(+m[1]); json(res, 200, { ok: true });
}));

// ---------- public : version du jeu + téléchargement ----------
route('GET', '/api/game/version', (req, res) => {
  const r = q.curRelease.get();
  if (!r) return json(res, 200, { available: false });
  json(res, 200, { available: true, version: r.version, size: r.size,
    sha256: r.sha256, notes: r.notes, min_spec: r.min_spec, rec_spec: r.rec_spec,
    url: `/download/${r.filename}`, updated: r.created_at });
});
route('GET', '/api/game/releases', (req, res) => {
  json(res, 200, { releases: q.allReleases.all().map(r => ({ ...r, url: `/download/${r.filename}` })) });
});
route('GET', '/download/:file', (req, res) => {
  const fn = normalize(req.url.split('/download/')[1] || '').replace(/\\/g, '/');
  if (!/^[\w.\-]+\.zip$/.test(fn)) return json(res, 400, { error: 'Fichier invalide' });
  const path = [join(DATA, 'downloads', fn), join(PKG_DL, fn)].find(existsSync);
  if (!path) return json(res, 404, { error: 'Version introuvable' });
  const rel = q.allReleases.all().find(r => r.filename === fn);
  q.logDownload.run(getSession(req)?.id || null, rel?.version || null, clientIp(req));
  const st = statSync(path);
  res.writeHead(200, { 'Content-Type': 'application/zip',
    'Content-Length': st.size, 'Content-Disposition': `attachment; filename="${fn}"`,
    'X-Checksum-Sha256': rel?.sha256 || '' });
  createReadStream(path).pipe(res);
});

// ---------- JEU : authentification par token + sauvegarde cloud + classement ----------
// Le jeu tourne sur une autre origine (localhost:8000) : authentification par
// Authorization: Bearer <session token> et CORS restreint à cette origine.
// origines du jeu autorisées à appeler l'API : local (python http.server)
// et version en ligne (Netlify). Séparées par des virgules via GAME_ORIGINS.
const GAME_ORIGINS = (process.env.GAME_ORIGINS ||
  'http://localhost:8000,https://unwardened.netlify.app').split(',').map(s => s.trim());
function gameCors(res, origin) {
  // sans Origin (curl, même site) ou origine connue → on répond ; sinon on bloque
  if (!origin || GAME_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || GAME_ORIGINS[0]);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
}
function getGameSession(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const s = q.sessByToken.get(m[1]);
  if (!s || s.expires_at < new Date().toISOString() || s.suspended) return null;
  return s;
}
const needGame = fn => (req, res, b) => {
  const s = getGameSession(req);
  return s ? fn(req, res, b, s) : json(res, 401, { error: 'Connexion jeu requise' });
};

route('POST', '/api/game/login', async (req, res, b) => {
  const ip = clientIp(req);
  if (!rateLimit('glogin:' + ip, 10, 600e3)) return json(res, 429, { error: 'Trop de tentatives — réessayez plus tard' });
  const pseudo = clean(b.pseudo || b.email), pass = b.password;
  const u = q.userByPseudo.get(pseudo) || q.userByEmail.get(clean(pseudo).toLowerCase());
  const okPass = u && verifyPass(pass, u.pass);
  await new Promise(r => setTimeout(r, 120));
  if (!u || !okPass) return json(res, 401, { error: 'Identifiants incorrects' });
  if (u.suspended) return json(res, 403, { error: 'Ce compte est suspendu' });
  // session SANS cookie : le jeu garde le token en localStorage
  const token = crypto.randomBytes(32).toString('hex');
  q.insSession.run(token, u.id, new Date(Date.now() + SESSION_DAYS * 864e5).toISOString());
  json(res, 200, { ok: true, token, user: pubUser(q.userById.get(u.id)) });
});

route('POST', '/api/game/logout', needGame((req, res, b, s) => {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (m) q.delSession.run(m[1]);
  json(res, 200, { ok: true });
}));

// ---------- score officiel : calculé côté serveur depuis les stats brutes ----------
// Le client envoie des compteurs ; le serveur borne chaque valeur puis applique
// une formule fixe. Le score n'est JAMAIS fourni par le client.
function computeScore(st) {
  const lvl = Math.min(200, Math.max(1, Math.floor(+st.level) || 1));
  const worlds = Math.min(6, Math.max(0, Math.floor(+st.worldsDone) || 0));
  const bosses = Math.min(60, Math.max(0, Math.floor(+st.bosses) || 0));
  const achv = Math.min(100, Math.max(0, Math.floor(+st.achievements) || 0));
  const playMin = Math.min(20000, Math.max(0, Math.floor((+st.playtime || 0) / 60)));
  return {
    level: lvl, worlds_done: worlds, bosses, achievements: achv, playtime: playMin * 60,
    score: lvl * 100 + worlds * 5000 + bosses * 800 + achv * 300 + playMin * 2
  };
}

route('GET', '/api/game/save', needGame((req, res, b, s) => {
  const sv = q.saveByUser.get(s.id);
  if (!sv) return json(res, 404, { error: 'Aucune sauvegarde cloud' });
  let payload = null;
  try { payload = JSON.parse(sv.payload); } catch (e) {}
  json(res, 200, { version: sv.version, updated_at: sv.updated_at, payload });
}));

route('PUT', '/api/game/save', needGame((req, res, b, s) => {
  const ip = clientIp(req);
  if (!rateLimit('gsave:' + s.id, 30, 600e3)) return json(res, 429, { error: 'Synchronisation trop fréquente' });
  const payload = b.payload;
  if (!payload || typeof payload !== 'object') return json(res, 400, { error: 'Payload invalide' });
  const raw = JSON.stringify(payload);
  if (raw.length > 400000) return json(res, 413, { error: 'Sauvegarde trop volumineuse' });
  const baseVersion = Math.floor(+b.baseVersion) || 0;
  const sv = q.saveByUser.get(s.id);
  const curVersion = sv ? sv.version : 0;
  // gestion de conflit : le client DOIT fournir la version qu'il a lue.
  // Si les versions divergent, on refuse et on renvoie la version serveur —
  // le client décide (écraser / fusionner / garder le local).
  if (baseVersion !== curVersion) {
    return json(res, 409, { conflict: true, version: curVersion,
      updated_at: sv ? sv.updated_at : null, hasSave: !!sv });
  }
  q.insSave.run(s.id, raw);
  // stats publiques : extraites du payload (stats du jeu), score recalculé serveur
  const st = (payload.stats && typeof payload.stats === 'object') ? payload.stats : {};
  const sc = computeScore(st);
  q.upsertStats.run(s.id, sc.level, sc.worlds_done, sc.bosses, sc.achievements, sc.playtime, sc.score);
  json(res, 200, { ok: true, version: curVersion + 1 });
}));

// ---------- classement public ----------
route('GET', '/api/leaderboard', (req, res, b, s, m) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const qstr = clean(u.searchParams.get('q'));
  if (qstr) {
    const like = '%' + qstr.replace(/[\\%_]/g, c => '\\' + c) + '%';
    return json(res, 200, { players: q.searchLeaderboard.all(like) });
  }
  const limit = Math.min(100, Math.max(1, Math.floor(+u.searchParams.get('limit')) || 50));
  const offset = Math.max(0, Math.floor(+u.searchParams.get('offset')) || 0);
  const players = q.leaderboard.all(limit, offset);
  const total = q.countLeaderboard.get().c;
  // rang du joueur connecté (si token fourni) même hors page affichée
  let me = null;
  const gs = getGameSession(req);
  if (gs) {
    const row = q.statsByUser.get(gs.id);
    if (row && row.score > 0) {
      const above = db.prepare('SELECT COUNT(*) c FROM player_stats ps JOIN users u ON u.id=ps.user_id WHERE u.suspended=0 AND ps.score > ?').get(row.score).c;
      me = { rank: above + 1, score: row.score, level: row.level, worlds_done: row.worlds_done };
    }
  }
  json(res, 200, { players, total, limit, offset, me });
});

// profil public : aucune donnée privée (pas d'email)
route('GET', '/api/player/:pseudo', (req, res, b, s, m) => {
  const st = q.publicStats.get(decodeURIComponent(m[1]));
  if (!st) return json(res, 404, { error: 'Joueur introuvable' });
  const rank = st.score > 0
    ? db.prepare(`SELECT COUNT(*) c FROM player_stats ps JOIN users u ON u.id = ps.user_id
                  WHERE u.suspended = 0 AND ps.score > ?`).get(st.score).c + 1
    : null;
  json(res, 200, { player: {
    pseudo: st.pseudo, avatar: st.avatar ? `/avatar/${st.avatar}` : null,
    score: st.score, level: st.level, worlds_done: st.worlds_done,
    bosses: st.bosses, achievements: st.achievements,
    playtime: st.playtime, updated_at: st.updated_at, member_since: st.created_at,
    rank
  }});
});

// ---------- dispatch ----------
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(u.pathname);
    // CORS pour les routes consommées par le jeu (autre origine) :
    // préflight OPTIONS + en-têtes sur les réponses
    const isGameApi = pathname.startsWith('/api/game/') || pathname === '/api/leaderboard'
      || pathname.startsWith('/api/player/');
    if (isGameApi) {
      gameCors(res, req.headers.origin);
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    }
    if (pathname.startsWith('/api/') || pathname.startsWith('/download/')) {
      for (const r of routes) {
        const m = pathname.match(new RegExp('^' + r.p.replace(/:[^/]+/g, '([^/]+)') + '$'));
        if (r.m === req.method && m) {
          const b = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
          return r.fn(req, res, b, getSession(req), m);
        }
      }
      return json(res, 404, { error: 'Route inconnue' });
    }
    // robots.txt / sitemap.xml générés avec le vrai domaine de la requête
    if (pathname === '/robots.txt') {
      const host = req.headers.host || 'localhost';
      return send(res, 200,
        `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\nDisallow: /download/\nSitemap: https://${host}/sitemap.xml\n`,
        'text/plain; charset=utf-8');
    }
    if (pathname === '/sitemap.xml') {
      const host = req.headers.host || 'localhost';
      const pages = ['/', '/game.html', '/news.html', '/classement.html', '/community.html', '/account.html'];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        pages.map((p, i) => `  <url><loc>https://${host}${p}</loc><priority>${(1 - i * 0.1).toFixed(1)}</priority></url>`).join('\n') +
        `\n</urlset>\n`;
      return send(res, 200, xml, 'application/xml; charset=utf-8');
    }
    // URLs propres : /classement et /joueur/<pseudo> → pages statiques
    let fp;
    if (pathname === '/classement') fp = '/classement.html';
    else if (/^\/joueur\/[^/]+\/?$/.test(pathname)) fp = '/joueur.html';
    else fp = pathname === '/' ? '/index.html' : pathname;
    fp = normalize(fp).replace(/\\/g, '/');
    if (fp.startsWith('/avatar/')) fp = join('/data/avatars', fp.slice(8));
    else if (fp.startsWith('/newsimg/')) fp = join('/data/news', fp.slice(9));
    else fp = join('/public', fp);
    const abs = join(ROOT, fp);
    if (!abs.startsWith(ROOT) || !existsSync(abs) || !statSync(abs).isFile())
      return send(res, 404, readFileSync(join(PUB, '404.html'), 'utf8'), MIME['.html']);
    res.writeHead(200, { 'Content-Type': MIME[extname(abs)] || 'application/octet-stream' });
    createReadStream(abs).pipe(res);
  } catch (e) {
    json(res, 500, { error: 'Erreur interne' });
    console.error(e);
  }
});
mkdirSync(join(DATA, 'news'), { recursive: true });

// ---------- seed au premier démarrage (utile pour les déploiements éphémères) ----------
function seed() {
  try {
    // 1) admin depuis les variables d'environnement (ADMIN_PSEUDO/EMAIL/PASS)
    if (process.env.ADMIN_PSEUDO && process.env.ADMIN_EMAIL && process.env.ADMIN_PASS
        && process.env.ADMIN_PASS.length >= 8 && q.countUsers.get().c === 0) {
      const salt = crypto.randomBytes(16).toString('hex');
      const h = crypto.scryptSync(process.env.ADMIN_PASS, salt, 64, SCRYPT).toString('hex');
      const r = q.insertUser.run(process.env.ADMIN_PSEUDO, process.env.ADMIN_EMAIL.toLowerCase(),
        `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${h}`);
      q.setRole.run('admin', Number(r.lastInsertRowid));
      q.setVerified.run(Number(r.lastInsertRowid));
      console.log(`[seed] admin créé : ${process.env.ADMIN_PSEUDO}`);
    }
    // 2) releases : enregistrer les ZIP de data/downloads ET du dossier
    // versionné downloads/ (persistant sur les hébergements éphémères)
    const seen = new Set(q.allReleases.all().map(r => r.filename));
    for (const dir of [join(DATA, 'downloads'), PKG_DL]) {
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!/^[\w.\-]+\.zip$/.test(f) || seen.has(f)) continue;
        seen.add(f);
        const p = join(dir, f);
        const m = /v(\d+\.\d+\.\d+)/.exec(f);
        const version = m ? m[1] : f.replace(/\.zip$/, '');
        const sha = crypto.createHash('sha256').update(readFileSync(p)).digest('hex');
        q.insRelease.run(version, f, statSync(p).size, sha, '', '', '', 0);
        console.log(`[seed] release enregistrée : ${f}`);
      }
    }
    if (!q.curRelease.get()) {
      const rel = q.allReleases.all();
      if (rel.length) q.setCurId.run(rel[rel.length - 1].id);
    }
  } catch (e) { console.error('[seed]', e.message); }
}
seed();

server.listen(PORT, () => console.log(`Kaeloryn Studio — http://localhost:${PORT}`));
