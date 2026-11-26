// Mesure les temps de frame en jeu réel via CDP (Chrome headless).
// Usage : node tools/cdp-perf.mjs [secondes] [url]
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SECONDS = +(process.argv[2] || 75);
const URL_GAME = process.argv[3] || 'http://localhost:8000/';
const CDP = 'http://127.0.0.1:9223';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9223',
  '--user-data-dir=' + process.env.TEMP + '\\unw-perf-profile',
  '--window-size=1280,720', '--mute-audio', '--no-first-run', 'about:blank'
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });

async function jget(path, method = 'GET') {
  const r = await fetch(CDP + path, { method });
  return r.json();
}

// attend que CDP réponde
for (let i = 0; i < 60; i++) {
  try { await jget('/json/version'); break; } catch { await sleep(250); }
}

const target = await jget('/json/new?' + encodeURIComponent(URL_GAME), 'PUT');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0; const pend = new Map(); const events = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  else if (m.method) events.push(m);
};
function send(method, params = {}) {
  return new Promise(res => {
    const i = ++id; pend.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) return { __err: r.result.exceptionDetails.text + ' ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || '') };
  return r.result && r.result.result ? r.result.result.value : undefined;
}

await send('Page.enable'); await send('Runtime.enable');
await sleep(3500); // chargement modules

// 1) créer un perso + lancer + installer pilote auto + échantillonneur de frames
const setup = await ev(`(async () => {
  const S = await import('/js/state.js');
  const C = await import('/js/chars.js');
  const M = await import('/js/menu.js');
  const G = S.G;
  window.__G = G;
  if (C.activeSlot() < 0) { C.createChar(0, 'Perf'); C.selectChar(0); }
  if (G.state === 'menu') M.startGame();
  // pilote : déplacement en carré + attaque maintenue + soin régulier
  let dir = 0;
  const DIRS = [['z'], ['d'], ['s'], ['q']];
  setInterval(() => {
    for (const k of ['z','q','s','d']) G.keys[k] = false;
    for (const k of DIRS[dir % 4]) G.keys[k] = true;
    dir++;
  }, 2600);
  setInterval(() => {
    G.attackQueued = true; G.attackHeld = true;
    if (G.state === 'playing' || G.state === 'intro') {
      const p = G.player;
      if (p) { p.hp = p.maxHp; p.alive = true; }
    } else if (G.state === 'dying' || G.state === 'gameover' || G.state === 'victory') {
      try { M.playAgain(); } catch(e) {}
    }
  }, 200);
  // vise un ennemi proche pour les arcs/lancer
  setInterval(() => {
    const p = G.player; if (!p) return;
    let best = null, bd = 1e9;
    for (const en of G.enemies) { const d = (en.x-p.x)**2 + (en.y-p.y)**2; if (d < bd) { bd = d; best = en; } }
    if (best) { G.mouse.x = best.x - G.camX + S.W/2; G.mouse.y = best.y - G.camY + S.H/2; }
  }, 120);
  // échantillonneur : mesure les deltas rAF + snapshot diag sur spike
  window.__ft = { n: 0, spikes: [], recent: [], heapMin: 1e9, heapMax: 0 };
  let last = performance.now();
  function samp(t) {
    const d = t - last; last = t;
    window.__ft.n++;
    const mem = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0;
    if (mem > window.__ft.heapMax) window.__ft.heapMax = mem;
    if (mem < window.__ft.heapMin) window.__ft.heapMin = mem;
    if (d > 40) {
      const p = G.player || {};
      window.__ft.spikes.push({
        t: Math.round(t), d: Math.round(d * 10) / 10,
        st: G.state, wave: G.wave, en: G.enemies.length,
        pt: G.particles.length, txt: G.damageTexts.length, rg: G.rings.length,
        po: G.portals.length, evT: G.eventT, heap: Math.round(mem),
        atk: p.attackMode, boss: G.enemies.some(e => e.type && e.type.startsWith('finalBoss'))
      });
      if (window.__ft.spikes.length > 400) window.__ft.spikes.shift();
    }
    window.__ft.recent.push(d);
    if (window.__ft.recent.length > 900) window.__ft.recent.shift();
    requestAnimationFrame(samp);
  }
  requestAnimationFrame(samp);
  return 'ok state=' + G.state;
})()`);
console.log('setup:', JSON.stringify(setup));

await sleep(SECONDS * 1000);

const stats = await ev(`(() => {
  const f = window.__ft; if (!f) return { err: 'no sampler' };
  const r = f.recent.slice().sort((a,b)=>a-b);
  const q = p => r.length ? Math.round(r[Math.min(r.length-1, Math.floor(r.length*p))]) : 0;
  return {
    frames: f.n, dur_s: Math.round((r.reduce((a,b)=>a+b,0))/10)/100,
    avg: Math.round(r.reduce((a,b)=>a+b,0)/Math.max(1,r.length)*10)/10,
    p50: q(0.5), p95: q(0.95), p99: q(0.99), max: r.length ? Math.round(r[r.length-1]*10)/10 : 0,
    spikes_n: f.spikes.length, spikes: f.spikes.slice(-60),
    heapMin: Math.round(f.heapMin), heapMax: Math.round(f.heapMax),
    state: window.__G.state, wave: window.__G.wave
  };
})()`);
console.log(JSON.stringify(stats, null, 1));

ws.close(); chrome.kill();
process.exit(0);
