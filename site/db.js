// Base de données SQLite (node:sqlite, natif Node 22+) — aucun module externe.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
mkdirSync(DIR, { recursive: true });
mkdirSync(join(DIR, 'downloads'), { recursive: true });
mkdirSync(join(DIR, 'avatars'), { recursive: true });

export const db = new DatabaseSync(join(DIR, 'tesseract.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass TEXT NOT NULL,               -- scrypt$N$r$p$salt$hash
  role TEXT NOT NULL DEFAULT 'user',-- 'user' | 'admin'
  avatar TEXT,                      -- nom de fichier dans data/avatars
  verified INTEGER NOT NULL DEFAULT 0,
  suspended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,               -- 'verify' | 'reset'
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image TEXT,                       -- data URL ou chemin /img/...
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,           -- fichier dans data/downloads
  size INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  notes TEXT,
  min_spec TEXT,
  rec_spec TEXT,
  current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS downloads_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  version TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);
`);

export const q = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userByPseudo: db.prepare('SELECT * FROM users WHERE pseudo = ?'),
  userById: db.prepare('SELECT id,pseudo,email,role,avatar,verified,suspended,created_at FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (pseudo,email,pass) VALUES (?,?,?)'),
  allUsers: db.prepare('SELECT id,pseudo,email,role,verified,suspended,created_at FROM users ORDER BY id DESC'),
  setSuspended: db.prepare('UPDATE users SET suspended = ? WHERE id = ?'),
  setRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),
  delUser: db.prepare('DELETE FROM users WHERE id = ?'),
  insSession: db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)'),
  sessByToken: db.prepare(`SELECT s.token, s.expires_at, u.id, u.pseudo, u.email, u.role, u.avatar, u.verified, u.suspended
                           FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`),
  delSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  delUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  insToken: db.prepare('INSERT INTO tokens (token,user_id,kind,expires_at) VALUES (?,?,?,?)'),
  tokByToken: db.prepare('SELECT * FROM tokens WHERE token = ?'),
  useToken: db.prepare('UPDATE tokens SET used = 1 WHERE token = ?'),
  setVerified: db.prepare('UPDATE users SET verified = 1 WHERE id = ?'),
  setPass: db.prepare('UPDATE users SET pass = ? WHERE id = ?'),
  setPseudo: db.prepare('UPDATE users SET pseudo = ? WHERE id = ?'),
  setAvatar: db.prepare('UPDATE users SET avatar = ? WHERE id = ?'),
  insNews: db.prepare('INSERT INTO news (title,body,image) VALUES (?,?,?)'),
  updNews: db.prepare("UPDATE news SET title=?, body=?, image=?, updated_at=datetime('now') WHERE id=?"),
  delNews: db.prepare('DELETE FROM news WHERE id = ?'),
  newsById: db.prepare('SELECT * FROM news WHERE id = ?'),
  allNews: db.prepare('SELECT * FROM news ORDER BY created_at DESC'),
  insRelease: db.prepare('INSERT INTO releases (version,filename,size,sha256,notes,min_spec,rec_spec,current) VALUES (?,?,?,?,?,?,?,?)'),
  allReleases: db.prepare('SELECT * FROM releases ORDER BY created_at DESC'),
  curRelease: db.prepare('SELECT * FROM releases WHERE current = 1 ORDER BY id DESC LIMIT 1'),
  setCurrent: db.prepare('UPDATE releases SET current = 0'),
  setCurId: db.prepare('UPDATE releases SET current = 1 WHERE id = ?'),
  delRelease: db.prepare('DELETE FROM releases WHERE id = ?'),
  logDownload: db.prepare('INSERT INTO downloads_log (user_id,version,ip) VALUES (?,?,?)'),
  countUsers: db.prepare('SELECT COUNT(*) c FROM users'),
  countNews: db.prepare('SELECT COUNT(*) c FROM news'),
  countDownloads: db.prepare('SELECT COUNT(*) c FROM downloads_log'),
  recentDownloads: db.prepare(`SELECT d.created_at, d.version, u.pseudo FROM downloads_log d
                                LEFT JOIN users u ON u.id = d.user_id ORDER BY d.id DESC LIMIT 20`)
};
