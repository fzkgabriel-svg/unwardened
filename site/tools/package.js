// Package le jeu en ZIP dans site/data/downloads/ et enregistre la release en DB.
// Usage : node tools/package.js "notes de patch" "config min" "config reco"
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { q } from '../db.js';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SITE, '..', '..');           // racine du jeu
const DL = join(SITE, '..', 'data', 'downloads');
mkdirSync(DL, { recursive: true });

const src = readFileSync(join(ROOT, 'js', 'state.js'), 'utf8');
const version = /VERSION\s*=\s*'([\d.]+)'/.exec(src)?.[1];
if (!version) { console.error('VERSION introuvable dans js/state.js'); process.exit(1); }

const filename = `les-terres-oubliees-v${version}.zip`;
const zipPath = join(DL, filename);
const staging = join(DL, '_staging');
mkdirSync(staging, { recursive: true });

// copie des fichiers du jeu dans un dossier staging/jeu/
const GAME_DIR = join(staging, 'LesTerresOubliees');
mkdirSync(GAME_DIR, { recursive: true });
const { cpSync, rmSync } = await import('node:fs');
rmSync(GAME_DIR, { recursive: true, force: true });
mkdirSync(GAME_DIR, { recursive: true });
for (const item of ['index.html', 'css', 'js', 'fonts']) {
  cpSync(join(ROOT, item), join(GAME_DIR, item), { recursive: true });
}
const { writeFileSync } = await import('node:fs');
// Lanceurs : Jouer.bat ouvre le jeu dans le navigateur par double-clic
writeFileSync(join(GAME_DIR, 'Jouer.bat'),
  '@echo off\r\n' +
  'title Les Terres Oubliees\r\n' +
  'start "" "%~dp0index.html"\r\n');
// README dans le zip
writeFileSync(join(GAME_DIR, 'LISEZMOI.txt'),
  `LES TERRES OUBLIEES v${version}\n============================\n\n` +
  `Kaeloryn Studio — Forge Your Own Legend\n\n` +
  `POUR JOUER :\n` +
  `1. Double-cliquez sur « Jouer.bat » — le jeu s'ouvre dans votre navigateur.\n` +
  `   (ou ouvrez directement index.html avec Chrome/Edge/Firefox recent)\n` +
  `2. Jouez ! Les sauvegardes sont conservees localement par le navigateur.\n\n` +
  `Le jeu fonctionne hors-ligne, aucun serveur requis.\n` +
  `Garder ce dossier entier ensemble.\n`);

// zip via PowerShell Compress-Archive
const ps = `$src='${staging.replace(/'/g, "''")}'; $dst='${zipPath.replace(/'/g, "''")}';` +
  ` if (Test-Path $dst) { Remove-Item $dst -Force };` +
  ` Compress-Archive -Path "$src\\*" -DestinationPath $dst -CompressionLevel Optimal`;
execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
rmSync(staging, { recursive: true, force: true });

const size = statSync(zipPath).size;
const sha = crypto.createHash('sha256').update(readFileSync(zipPath)).digest('hex');
// argv : [notes de patch] [config min] [config reco]
const notesTxt = process.argv[2] || '';
const minSpec = process.argv[3] || '';
const recSpec = process.argv[4] || '';

// remplace toute release existante du même numéro
const existing = q.allReleases.all().find(r => r.version === version);
if (existing) q.delRelease.run(existing.id);
q.setCurrent.run();
const r = q.insRelease.run(version, filename, size, sha, notesTxt, minSpec, recSpec, 1);
console.log(`✔ v${version} packagée : ${filename} (${(size / 1048576).toFixed(1)} Mo)`);
console.log(`  SHA-256 : ${sha}`);
console.log(`  release id : ${r.lastInsertRowid} — définie comme version actuelle.`);
console.log(`  Pensez à publier une actualité pour l'annoncer.`);
