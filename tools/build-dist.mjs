// Build de déploiement Netlify : bundle le jeu en UN SEUL fichier JS
// minifié (dist/js/main.js) + copie les assets statiques.
// Le code source reste lisible dans js/ pour le dev local, mais le site
// public ne sert plus que le bundle compacté — fini le « view-source ».
// Usage : node tools/build-dist.mjs   (appelé par netlify.toml)
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(resolve(dist, 'js'), { recursive: true });

// 1) Bundle + minification (identifiants, syntaxe, whitespace)
execSync(
  'npx -y esbuild@0.25.0 js/main.js --bundle --minify --format=esm ' +
  '--outfile=dist/js/main.js --log-level=warning',
  { cwd: root, stdio: 'inherit', shell: true }
);

// 2) Assets statiques (mêmes chemins relatifs que la source)
for (const f of ['index.html', 'css', 'fonts', '_headers']) {
  cpSync(resolve(root, f), resolve(dist, f), { recursive: true });
}

console.log('✔ dist/ prêt — bundle minifié + assets copiés.');
