// Kaeloryn Studio — client réseau : compte, sauvegarde cloud, classement.
// Le jeu tourne sur http://localhost:8000, le site sur :8080 → fetch cross-origin
// avec Bearer token (session créée via /api/game/login, conservée en localStorage).
import { G, VERSION } from './state.js';
import { storeKey, activeSlot } from './chars.js';

const API = (typeof location !== 'undefined' && location.port === '8080')
  ? '' // le jeu est servi par le site lui-même
  : 'http://localhost:8080';
export const SITE_URL = API || (typeof location !== 'undefined' ? location.origin : 'http://localhost:8080');
const ACC_KEY = 'rpg2d_account';

export const net = {
  token: null, pseudo: null, uid: null,
  status: 'offline',      // offline | connecting | connected | error
  cloudVersion: 0,        // dernière version serveur connue
  cloudUpdatedAt: null,
  lastSync: 0,            // timestamp du dernier upload réussi
  lastLocalSave: 0,       // timestamp de la dernière sauvegarde locale
  lb: null, lbTotal: 0, lbLoading: false,
  msg: '',                // message d'état affiché dans l'UI
};

function loadAccount() {
  try {
    const d = JSON.parse(localStorage.getItem(ACC_KEY) || 'null');
    if (d && d.token) { net.token = d.token; net.pseudo = d.pseudo; net.uid = d.uid; }
  } catch (e) {}
}
function saveAccount() {
  try {
    localStorage.setItem(ACC_KEY, JSON.stringify({ token: net.token, pseudo: net.pseudo, uid: net.uid }));
  } catch (e) {}
}
export function logoutAccount() {
  if (net.token) api('/api/game/logout', { method: 'POST' }).catch(() => {});
  net.token = net.pseudo = net.uid = null; net.status = 'offline';
  net.cloudVersion = 0; net.msg = '';
  try { localStorage.removeItem(ACC_KEY); } catch (e) {}
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json',
      ...(net.token ? { Authorization: 'Bearer ' + net.token } : {}),
      ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export async function login(pseudo, pass) {
  net.status = 'connecting'; net.msg = '';
  try {
    const { status, data } = await api('/api/game/login', {
      method: 'POST', body: JSON.stringify({ pseudo, password: pass }) });
    if (status === 200 && data.token) {
      net.token = data.token; net.pseudo = data.user.pseudo; net.uid = data.user.id;
      saveAccount(); net.status = 'connected';
      // découvre la version cloud pour les prochains uploads
      const sv = await api('/api/game/save');
      if (sv.status === 200) { net.cloudVersion = sv.data.version; net.cloudUpdatedAt = sv.data.updated_at; }
      else net.cloudVersion = 0;
      net.msg = 'Connecté en tant que ' + net.pseudo;
      return true;
    }
    net.status = 'error'; net.msg = data.error || 'Connexion refusée';
    return false;
  } catch (e) {
    net.status = 'error'; net.msg = 'Serveur injoignable — joue hors ligne';
    return false;
  }
}

// ---------- sauvegarde : snapshot des clés localStorage du personnage ----------
const SNAP_KEYS = slot => [
  storeKey('stats'), storeKey('inv_v3'), storeKey('worlds_v1'),
  `rpg2d_c${slot}_achievements`, 'rpg2d_slots',
];
function buildPayload() {
  const slot = activeSlot();
  const keys = {};
  for (const k of SNAP_KEYS(slot >= 0 ? slot : 0)) {
    try { const v = localStorage.getItem(k); if (v != null) keys[k] = v; } catch (e) {}
  }
  const st = G.stats || {};
  // stats brutes pour le score serveur (plafonnées côté serveur)
  let worldsDone = 0;
  try {
    const w = JSON.parse(localStorage.getItem(storeKey('worlds_v1')) || '{}');
    for (const wd of Object.values(w.worlds || {}))
      if (wd && (wd.done || wd.won || wd.victory || wd.bossDead)) worldsDone++;
  } catch (e) {}
  let achv = 0;
  try {
    const a = JSON.parse(localStorage.getItem(`rpg2d_c${slot >= 0 ? slot : 0}_achievements`) || '{}');
    achv = Object.values(a.claimed || a.done || a).filter(Boolean).length;
  } catch (e) {}
  return {
    gameVersion: VERSION, slot, savedAt: Date.now(), keys,
    stats: {
      level: st.bestLevel || 1, worldsDone,
      bosses: st.totalBossKills || 0, achievements: achv,
      playtime: st.totalPlayTime || 0,
    },
  };
}
function applyPayload(p) {
  if (!p || !p.keys) return false;
  let n = 0;
  for (const [k, v] of Object.entries(p.keys)) {
    try { localStorage.setItem(k, v); n++; } catch (e) {}
  }
  return n > 0;
}

// ---------- synchronisation ----------
let syncing = false, dirty = false;
export async function syncCloud(force = false) {
  if (!net.token || syncing) { if (net.token) dirty = true; return; }
  if (net.status !== 'connected') return;
  syncing = true; net.msg = 'Synchronisation…';
  try {
    const payload = buildPayload();
    const { status, data } = await api('/api/game/save', {
      method: 'PUT', body: JSON.stringify({ baseVersion: net.cloudVersion, payload }) });
    if (status === 200) {
      net.cloudVersion = data.version; net.lastSync = Date.now();
      net.msg = 'Sauvegarde synchronisée';
    } else if (status === 409 && data.conflict) {
      // CONFLIT : on compare les dates — jamais d'écrasement aveugle.
      const sv = await api('/api/game/save');
      if (sv.status === 200 && sv.data.payload) {
        const cloudAt = Date.parse(sv.data.updated_at.replace(' ', 'T') + 'Z') || 0;
        const localAt = net.lastLocalSave || payload.savedAt;
        if (cloudAt > localAt && sv.data.version > net.cloudVersion) {
          // le cloud est plus récent → on le restaure en local
          if (applyPayload(sv.data.payload)) {
            net.cloudVersion = sv.data.version; net.cloudUpdatedAt = sv.data.updated_at;
            net.msg = 'Progression cloud plus récente — restaurée';
            try { location.reload(); } catch (e) {}
          }
        } else {
          // le local est plus récent → on renvoie avec la bonne version
          net.cloudVersion = sv.data.version;
          const up = await api('/api/game/save', {
            method: 'PUT', body: JSON.stringify({ baseVersion: net.cloudVersion, payload }) });
          if (up.status === 200) { net.cloudVersion = up.data.version; net.lastSync = Date.now(); net.msg = 'Sauvegarde synchronisée'; }
        }
      }
    } else if (status === 401) {
      logoutAccount(); net.msg = 'Session expirée — reconnecte-toi';
    } else {
      net.msg = 'Sync impossible (' + status + ') — sauvegarde locale conservée';
    }
  } catch (e) {
    net.msg = 'Serveur injoignable — sauvegarde locale conservée';
    net.status = 'error';
  } finally { syncing = false; }
  if (dirty) { dirty = false; syncCloud(true); }
}
// sync auto : appelée périodiquement depuis la boucle de jeu
let lastAuto = 0;
export function maybeAutoSync() {
  if (!net.token || net.status !== 'connected') return;
  const now = Date.now();
  if (now - lastAuto > 45000 && now - net.lastSync > 45000) { lastAuto = now; syncCloud(); }
}
export function noteLocalSave() { net.lastLocalSave = Date.now(); }

// ---------- classement + profil (publics) ----------
export async function fetchLeaderboard(offset = 0, q = '') {
  net.lbLoading = true;
  try {
    const qs = (q ? `?q=${encodeURIComponent(q)}` : `?limit=50&offset=${offset}`);
    const { status, data } = await api('/api/leaderboard' + qs);
    if (status === 200) { net.lb = data.players || []; net.lbTotal = data.total || 0; net.lbMe = data.me || null; }
    else net.lb = [];
  } catch (e) { net.lb = []; net.lbTotal = 0; }
  net.lbLoading = false;
}
export async function fetchPlayer(pseudo) {
  try {
    const { status, data } = await api('/api/player/' + encodeURIComponent(pseudo));
    return status === 200 ? data.player : null;
  } catch (e) { return null; }
}

loadAccount();
// vérifie la session au démarrage (silencieux)
if (net.token) api('/api/game/save').then(({ status }) => {
  if (status === 401) logoutAccount();
  else if (status === 200 || status === 404) net.status = 'connected';
  else net.status = 'error';
}).catch(() => { net.status = 'error'; });
