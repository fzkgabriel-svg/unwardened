import { G, canvas, W, H } from './state.js';
import { startGame, menuButtonAt, gameOverButtonAt, victoryButtonAt, pauseButtonAt, playAgain, nextWorld, resetToMenu, toCampaign, requestResume, forgeClickAt, forgeWheel, achClickAt, achWheel, charClickAt, adminClickAt, switchCharacter, reloadPersistence, durWarnClickAt, durWarnAction, campaignClickAt, campaignPlayBtn } from './menu.js';
import { checkAdminPass, createChar } from './chars.js';
import { adminMenuClickAt, adminButtonAt, adminUnlocked } from './menu.js';
import { usePotion } from './player.js';
import { tryInteract } from './world.js';
import { ensureAudio, audioButtonAt, audioPanelClickAt, audioPanelDragAt, audioPanelDragEnd, sfxClick, sfxConfirm, sfxOpen, sfxClose, sfxTab } from './audio.js';
import { shopButtonAt, shopClickAt, shopDay } from './shop.js';
import { startTutorial, tutorialEnter, tutorialClickAt } from './tutorial.js';
import { bowUnlocked } from './bow.js';
import { weaponAllowed, loadoutOf, WEAPON_MODES } from './inventory.js';
import { activateModule, modulesUnlocked } from './modules.js';
import { modClickAt, modWheel } from './menu/modules.js';

export function initInput() {
  window.addEventListener('keydown', e => {
    ensureAudio(); // geste utilisateur : débloque l'AudioContext
    if (e.repeat) return; // ignore l'auto-repeat : une pression = une action
    const k = e.key.toLowerCase();
    // saisie texte : nom de personnage ou mot de passe admin (prioritaire)
    if (G.charInput) {
      if (k === 'enter') {
        const { slot, text } = G.charInput; G.charInput = null;
        if (text.trim() && createChar(slot, text.trim())) { reloadPersistence(); G.menuView = 'main'; }
        sfxConfirm();
      } else if (k === 'escape') { G.charInput = null; sfxClick(); }
      else if (k === 'backspace') G.charInput.text = G.charInput.text.slice(0, -1);
      else if (e.key.length === 1 && G.charInput.text.length < 14 && /[\w\s\-']/i.test(e.key)) G.charInput.text += e.key;
      return;
    }
    if (G.adminInput) {
      if (k === 'enter') {
        const ok = checkAdminPass(G.adminInput.text); G.adminInput = null;
        if (ok) {
          G.adminUnlockT = G.time; // animation du cadenas qui s'ouvre
          sfxConfirm();
          if (G.state === 'menu') G.menuView = 'admin';
          else G.adminMenu = true; // en jeu : mot de passe → menu de triche direct
        } else { G.adminPwErr = true; G.adminPwErrT = G.time; sfxClick(); }
      } else if (k === 'escape') { G.adminInput = null; sfxClick(); }
      else if (k === 'backspace') G.adminInput.text = G.adminInput.text.slice(0, -1);
      else if (e.key.length === 1 && G.adminInput.text.length < 24 && !e.ctrlKey && !e.metaKey) G.adminInput.text += e.key;
      return;
    }
    // recherche d'inventaire (forge > onglet inventaire, champ actif)
    if (G.invQueryFocus) {
      if (k === 'enter' || k === 'escape') { G.invQueryFocus = false; sfxClick(); }
      else if (k === 'backspace') G.invQuery = (G.invQuery || '').slice(0, -1);
      else if (e.key.length === 1 && (G.invQuery || '').length < 24 && !e.ctrlKey && !e.metaKey) G.invQuery = (G.invQuery || '') + e.key;
      return;
    }
    // recherche dans le registre des succès (menu > succès, champ actif)
    if (G.achQueryFocus && G.menuView === 'achievements') {
      if (k === 'enter' || k === 'escape') { G.achQueryFocus = false; sfxClick(); }
      else if (k === 'backspace') G.achQuery = (G.achQuery || '').slice(0, -1);
      else if (e.key.length === 1 && (G.achQuery || '').length < 24 && !e.ctrlKey && !e.metaKey) G.achQuery = (G.achQuery || '') + e.key;
      return;
    }
    G.keys[k] = true;
    if (G.state === 'menu') {
      if (G.menuView === 'characters') return; // écran de sélection : clics uniquement
      if (G.menuView === 'admin') { G.menuView = 'characters'; sfxClick(); return; }
      if (G.menuView === 'campaign') {
        // flèches : naviguer entre les territoires ; Entrée/Espace : lancer la campagne
        if (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown') {
          const d = (k === 'arrowleft' || k === 'arrowup') ? -1 : 1;
          G.campaignSel = ((G.campaignSel ?? 0) + d + 6) % 6;
          sfxClick();
        }
        if (k === 'enter' || k === ' ') {
          const pb = campaignPlayBtn();
          campaignClickAt(pb.x + pb.w / 2, pb.y + pb.h / 2);
        }
        return;
      }
      if (G.menuView !== 'main') { G.menuView = 'main'; sfxClick(); return; }
      if ((k === 'enter' || k === ' ')) { G.menuView = 'campaign'; G.campaignSel = G.campaign || 0; sfxConfirm(); }
    }
    if (k === 'enter' && G.tutorial && G.state === 'playing') { if (tutorialEnter()) sfxClick(); }
    // touche ` : menu de triche admin — mot de passe demandé si besoin
    if (k === '`' && (G.state === 'playing' || G.state === 'paused')) {
      if (adminUnlocked()) G.adminMenu = !G.adminMenu;
      else { G.adminInput = { text: '' }; G.adminPwErr = false; }
      sfxClick();
    }
    if (k === 'f' && G.state === 'playing') G.ultQueued = true;
    // armes du loadout : & = arme principale (emplacement 1), é = deuxième arme (emplacement 2)
    // 1/3/' = alias ; " = arc en priorité, 7/è = jugement du gardien en raccourci
    const slotKeys = { '&': 's1', '1': 's1', 'é': 's2', '3': 's2', "'": 's2' };
    if (slotKeys[k] && G.state === 'playing' && G.player.ultActive <= 0) { // titan de feu : armes scellées
      const wk = loadoutOf(G.inv)[slotKeys[k]];
      const target = wk ? WEAPON_MODES[wk] : null;
      if (target && G.player.attackMode !== target && weaponAllowed(G.inv, wk)) {
        G.player.attackMode = target;
        G.player.switchLock = 1.25; // 1,25s sans attaque après le changement d'arme
      }
    }
    if (k === '"' && G.state === 'playing' && G.player.ultActive <= 0) {
      const target = weaponAllowed(G.inv, 'arc') ? 5 : weaponAllowed(G.inv, 'lance') ? 3 : null;
      if (target && G.player.attackMode !== target) {
        G.player.attackMode = target;
        G.player.switchLock = 1.25;
      }
    }
    // jugement du gardien (arme légendaire) : touche 7 / è (même touche physique sur AZERTY)
    if ((k === '7' || k === 'è') && G.state === 'playing' && G.player.ultActive <= 0
        && G.player.attackMode !== 7 && G.stats.gardienUnlocked && weaponAllowed(G.inv, 'gardien')) {
      G.player.attackMode = 7;
      G.player.switchLock = 1.25;
    }
    // X : module actif équipé (prioritaire — plus de changement d'arme)
    if (k === 'x' && G.state === 'playing') activateModule();
    if (k === 'w' && G.state === 'playing') usePotion();
    if (k === 'e' && G.state === 'playing') tryInteract(); // fouiller un bâtiment / entrer dans un portail
    if ((k === 'r') && G.state === 'victory' && G.campaign < 5) nextWorld();
    else if ((k === 'r') && (G.state === 'gameover' || G.state === 'victory')) playAgain();
    if ((k === 'c') && G.state === 'victory') toCampaign();
    if (k === 'escape') {
      if (G.adminMenu) { G.adminMenu = false; sfxClick(); return; }
      if (G.state === 'playing') G.state = 'paused';
      else if (G.state === 'paused' && G.resumeTimer <= 0) requestResume();
      else if (G.state === 'gameover' || G.state === 'victory') resetToMenu();
    }
  });
  window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    G.mouse.x = (e.clientX - r.left) * (W / r.width);
    G.mouse.y = (e.clientY - r.top) * (H / r.height);
  }
  canvas.addEventListener('mousemove', e => {
    canvasPos(e);
    // drag d'un curseur audio : le volume suit la souris en temps réel
    if (G.audioOpen) audioPanelDragAt(G.mouse.x, G.mouse.y);
  });
  // relâcher le bouton termine le drag (même hors du canvas)
  window.addEventListener('mouseup', () => audioPanelDragEnd());
  // le drag continue même si la souris sort du canvas
  window.addEventListener('mousemove', e => {
    if (G.audioOpen) { canvasPos(e); audioPanelDragAt(G.mouse.x, G.mouse.y); }
  });
  canvas.addEventListener('mousedown', e => {
    ensureAudio();
    canvasPos(e);
    // menu de triche admin ouvert : il intercepte tous les clics
    if (G.adminMenu) {
      const act = adminMenuClickAt(G.mouse.x, G.mouse.y);
      if (act !== 'inside') sfxClick();
      return;
    }
    // saisie du mot de passe admin en cours : les clics sont ignorés
    if (G.adminInput) return;
    // bouton admin ⚠ : accessible en jeu à tout moment (mot de passe requis)
    if ((G.state === 'playing' || G.state === 'paused') && adminButtonAt(G.mouse.x, G.mouse.y)) {
      if (adminUnlocked()) { G.adminMenu = true; sfxClick(); }
      else { G.adminInput = { text: '' }; G.adminPwErr = false; sfxClick(); }
      return;
    }
    // boutique ouverte : elle intercepte tous les clics
    if (G.shopOpen) { shopClickAt(G.mouse.x, G.mouse.y); return; }
    // bouton 💰 boutique : uniquement depuis le menu principal
    if (G.state === 'menu' && shopButtonAt(G.mouse.x, G.mouse.y)) {
      G.shopOpen = true; G.audioOpen = false; G.shopQty = {}; G.shopConfirm = null; G.shopFlash = null;
      G.shopSel = null; G.shopModSel = null; G.shopTab = 'mats'; G.shopTabT = G.time;
      if (G.inv) shopDay(G.inv); // réinitialise le stock si nouveau jour
      sfxClick();
      return;
    }
    // panneau de réglages audio ouvert : il intercepte tous les clics
    if (G.audioOpen) { const ar = audioPanelClickAt(G.mouse.x, G.mouse.y); if (ar === 'close') sfxClose(); return; }
    // bouton ⚙ RÉGLAGES : ouvre le panneau (interrupteurs + volumes)
    if (['menu', 'playing', 'paused', 'gameover', 'victory'].includes(G.state)) {
      const ab = audioButtonAt(G.mouse.x, G.mouse.y);
      if (ab === 'opt') { G.audioOpen = true; sfxOpen(); return; }
    }
    if (G.state === 'menu') {
      // popup durabilité : intercepte tous les clics tant qu'elle est ouverte
      if (G.durWarn) {
        const a = durWarnClickAt(G.mouse.x, G.mouse.y);
        if (a === 'launch' || a === 'menu') { durWarnAction(a); sfxClick(); }
        else if (a === 'inside') sfxClick();
        return;
      }
      if (G.menuView === 'forge') {
        const act = forgeClickAt(G.mouse.x, G.mouse.y);
        if (act === 'back') { G.menuView = 'main'; sfxClick(); }
        else if (act === 'tab' || act === 'htab') sfxTab();
        else if (act) sfxClick();
        return;
      }
      if (G.menuView === 'achievements') {
        const act = achClickAt(G.mouse.x, G.mouse.y);
        if (act === 'back') { G.menuView = 'main'; sfxClick(); }
        else if (act) sfxClick();
        return;
      }
      if (G.menuView === 'stats') { G.menuView = 'main'; sfxClick(); return; }
      if (G.menuView === 'modules') {
        const act = modClickAt(G.mouse.x, G.mouse.y);
        if (act) sfxClick();
        return;
      }
      if (G.menuView === 'characters') {
        const act = charClickAt(G.mouse.x, G.mouse.y);
        if (act === 'play') { /* déjà géré dans charClickAt via startGame */ }
        else if (act === 'select') { /* menuView passé à 'main' dans charClickAt */ }
        else if (act) sfxClick();
        return;
      }
      if (G.menuView === 'admin') {
        const act = adminClickAt(G.mouse.x, G.mouse.y);
        if (act) sfxClick();
        return;
      }
      if (G.menuView === 'campaign') {
        const act = campaignClickAt(G.mouse.x, G.mouse.y);
        if (act === 'select' || act === 'back' || act === 'play') sfxClick();
        else if (act === 'locked') sfxClick();
        return;
      }
      if (G.menuView !== 'main') { G.menuView = 'main'; sfxClick(); return; }
      const btn = menuButtonAt(G.mouse.x, G.mouse.y);
      if (btn === 'perso') { switchCharacter(); sfxClick(); return; }
      if (btn === 'tutoriel') { startTutorial(); sfxConfirm(); return; }
      if (btn === 'stats') { G.menuView = 'stats'; sfxClick(); return; }
      if (btn === 'ach') { G.menuView = 'achievements'; sfxClick(); return; }
      if (btn === 'forge') { G.menuView = 'forge'; sfxClick(); return; }
      if (btn === 'modules') {
        if (modulesUnlocked()) { G.menuView = 'modules'; G.modSel = null; G.modViewT = G.time; sfxConfirm(); }
        else sfxClick(); // verrouillé : boss du monde 4 non vaincu
        return;
      }
      // JOUER (ou clic ailleurs) : on choisit la campagne AVANT de lancer
      G.menuView = 'campaign'; G.campaignSel = G.campaign || 0; sfxClick();
      return;
    }
    if (G.state === 'paused') {
      if (G.resumeTimer <= 0) { // pas de clic pendant le compte à rebours
        const btn = pauseButtonAt(G.mouse.x, G.mouse.y);
        if (btn === 'resume') { requestResume(); sfxClick(); }
        else if (btn === 'quit') { resetToMenu(); sfxClick(); }
      }
      return;
    }
    if (G.state === 'victory') {
      const btn = victoryButtonAt(G.mouse.x, G.mouse.y);
      if (btn === 'next') {
        if (G.campaign < 5) nextWorld(); else playAgain();
        sfxConfirm();
      }
      else if (btn === 'campaign') toCampaign();
      else if (btn === 'menu') { resetToMenu(); sfxClick(); }
      return;
    }
    if (G.state === 'gameover') {
      const btn = gameOverButtonAt(G.mouse.x, G.mouse.y);
      if (btn === 'replay') { playAgain(); sfxConfirm(); }
      else if (btn === 'menu') { resetToMenu(); sfxClick(); }
      return;
    }
    // tutoriel : les clics sur le panneau (boutons, zones) ne déclenchent pas d'attaque
    if (G.tutorial && G.state === 'playing') {
      if (tutorialClickAt(G.mouse.x, G.mouse.y)) { sfxClick(); return; }
    }
    if (e.button === 0) { G.attackQueued = true; G.attackHeld = true; }
    // clic droit : titan = main de feu, arc = singularité, sinon rotation (épée) / bouclier (lance)
    if (e.button === 2) {
      if (G.player.ultActive > 0) G.handQueued = true;
      else if (G.player.attackMode === 5) G.singQueued = true;
      else if (G.player.attackMode === 3) G.shieldQueued = true;
      else if (G.player.attackMode === 7) G.judgQueued = true; // Sentence ancestrale
      else G.spinQueued = true;
    }
  });
  // relâchement du clic gauche : déclenche le tir de l'arc (charge)
  const releaseAttack = () => { G.attackHeld = false; };
  canvas.addEventListener('mouseup', releaseAttack);
  window.addEventListener('mouseup', releaseAttack); // même hors canvas
  window.addEventListener('blur', releaseAttack);    // alt-tab pendant la charge = relâchement
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // molette : scroll dans la forge et la liste des succès
  canvas.addEventListener('wheel', e => {
    if (G.state === 'menu' && G.menuView === 'forge') {
      e.preventDefault();
      forgeWheel(e.deltaY);
    } else if (G.state === 'menu' && G.menuView === 'achievements') {
      e.preventDefault();
      achWheel(e.deltaY);
    } else if (G.state === 'menu' && G.menuView === 'modules') {
      e.preventDefault();
      modWheel(e.deltaY);
    }
  }, { passive: false });
}
