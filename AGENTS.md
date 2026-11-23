# RPG 2D - Les Terres Oubliées

Jeu HTML5 Canvas / JavaScript ES modules. Servi en HTTP (ES modules incompatibles avec `file://`) via `python -m http.server` ou le lanceur « Lancer les Terres Oubliees.bat » sur le Bureau (chemin absolu vers ce dossier, port 8000).

## Versioning (règle utilisateur)
- `VERSION` dans `js/state.js`, format `MAJEUR.MINEUR.PATCH`.
- Petite mise à jour / correctif → incrémenter le **dernier chiffre** (patch).
- Changement important / nouvelle feature → incrémenter le **deuxième chiffre** (mineur).
- Le **premier chiffre reste 1** — l'utilisateur décide seul quand le changer (vraie avancée majeure).

## Tests
- Pages `test_*.html` à la racine pour tests headless Chrome : `--headless --dump-dom http://localhost:8000/test_x.html`.
- Le canvas `#game` doit exister dans les pages de test (state.js le requiert).
- `G.time` n'avance pas de façon fiable en headless (limite de test, pas un bug).

## Structure
- `js/state.js` : état global `G`, canvas, VERSION.
- `js/world.js` : génération procédurale (seed), secteurs, bâtiments, obstacles (rochers/montagnes), lacs+ponts, portails, `resolveObstacles` (collision joueur/ennemis).
- `js/graphics.js` : rendu monde/entités/HUD decor, `drawTerrain` (canvas pré-rendu), montagnes, lacs, bombe B-2.
- `js/menu.js` : orchestrateur menus ; sous-modules `js/menu/` (flow, forge, forge_state, forge_craft, forge_gear, forge_fx, heros, achv, admin, campaign, end, common). Forge = 3 onglets (FORGER/INVENTAIRE/PERSONNAGE) avec sous-onglets de catégories, recherche, tri, fiche détail, améliorations d'armes.
- `js/inventory.js` : mats, items (rareté `rar`, slots weapon/armor/helm/gloves/charm/boots/conso), craft, équipement, durabilité, buffs consommables.
- `js/achievements.js` : 34 succès, raretés, récompenses.
- `js/tutorial.js` : tutoriel 12 étapes (retour menu, Entrée = étape suivante, cooldown 2,5 s).
- `js/hud.js` : orchestrateur HUD ; sous-modules `js/hud/` (frame, profile, skills, boss, map, equip, toasts) — HUD médiéval fantastique. Minimap : bâtiments = brouillard de guerre, lacs, obstacles.
- `js/main.js` : game loop, collisions, update.

## Site officiel (site/)
- Backend Node.js pur (node:http + node:sqlite, zéro dépendance) : `node site/server.js 8080` (Node ≥22.5 requis, binaire : `%LOCALAPPDATA%\Programs\nodejs\node.exe`).
- Frontend statique dans `site/public/` (index, game, news, community, account, admin).
- Données dans `site/data/` (gitignoré) : `tesseract.db`, `downloads/`, `avatars/`, `news/`.
- Outils : `node site/tools/mkadmin.js <pseudo> <email> <mdp>` (crée un admin) ; `node site/tools/package.js "notes" "min" "rec"` (zippe le jeu depuis js/state.js VERSION → data/downloads + release courante).
- Auth : scrypt + sessions cookie HttpOnly, rate-limit login/register, tokens verify/reset (mode dev : liens loggés en console, SMTP à brancher via SMTP_URL).
- Version jeu affichée via `GET /api/game/version` ; téléchargement `/download/<fichier>.zip` (loggé + header X-Checksum-Sha256).
