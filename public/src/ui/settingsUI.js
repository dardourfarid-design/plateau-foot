// ===================== RÉGLAGES DE PARTIE =====================
// Persistance des réglages entre les sessions (#204/#205/#207) et reflet de
// ces réglages dans l'écran « Personnaliser la partie ».
//
// Extrait de main.js (#311).
//
// POURQUOI DES ACCESSEURS PLUTÔT QUE L'ÉTAT LUI-MÊME
// Les neuf réglages (gameMode, aiLevel, selectedRuleset…) sont lus dans une
// trentaine d'endroits de main.js, dont le cœur de la boucle de jeu. Les
// déplacer ici imposerait de réécrire tous ces points d'accès — beaucoup de
// churn sur du code de jeu déjà éprouvé, pour un gain de structure nul.
// Ce module manipule donc les réglages via un objet d'accès fourni par
// l'appelant : c'est la lecture/écriture du stockage et le rendu de l'UI qui
// sortent de main.js, pas l'état de la partie.

import { AI_LEVELS } from '../engine/ai.js';

const CONFIG_KEY = 'tm_lastConfig';

// Valeurs acceptées à la relecture. Un stockage corrompu ou écrit par une
// version antérieure ne doit jamais injecter une valeur que le moteur ne
// connaît pas : chaque champ est validé, sinon il garde son défaut.
const VALID = {
  gameMode: ['local', 'ai', 'online'],
  selectedRuleset: ['decouverte', 'classique', 'expert'],
  selectedVariant: ['standard', 'tactique'],
  selectedFormat: ['score', 'manche'],
  selectedGoals: [1, 3, 5, 99]
};

/**
 * @param {object} deps
 * @param {object} deps.els                     références DOM partagées.
 * @param {() => object} deps.getSettings       instantané des réglages courants.
 * @param {(patch: object) => void} deps.applySettings  applique les réglages relus.
 * @param {(on: boolean) => void} deps.setSoundEnabled  active/coupe le son.
 * @returns {{ saveLastConfig, restoreLastConfig, applyConfigToUI }}
 */
export function initSettings({ els, getSettings, applySettings, setSoundEnabled }) {

  function saveLastConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(getSettings()));
    } catch { /* stockage indispo : on ignore */ }
  }

  function restoreLastConfig() {
    let cfg = null;
    try { cfg = JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch { cfg = null; }
    if (!cfg || typeof cfg !== 'object') return;

    const patch = {};
    for (const [key, allowed] of Object.entries(VALID)) {
      if (allowed.includes(cfg[key])) patch[key] = cfg[key];
    }
    if (Object.values(AI_LEVELS).includes(cfg.aiLevel)) patch.aiLevel = cfg.aiLevel;
    for (const key of ['freePowersOn', 'hintsOn', 'soundOn']) {
      if (typeof cfg[key] === 'boolean') patch[key] = cfg[key];
    }

    applySettings(patch);
    if (typeof patch.soundOn === 'boolean') setSoundEnabled(patch.soundOn);
  }

  // Reflète l'état courant des réglages dans les boutons de l'écran de config,
  // pour que « Personnaliser » montre toujours les derniers choix.
  function applyConfigToUI() {
    const s = getSettings();
    const setActive = (container, val) => {
      if (!container) return;
      container.querySelectorAll('.setup-option').forEach(o =>
        o.classList.toggle('active', o.dataset.val === String(val)));
    };
    setActive(els.modeOptions, s.gameMode === 'ai' ? 'ai' : s.gameMode === 'online' ? 'online' : 'local');
    setActive(els.aiDifficultyOptions, s.aiLevel);
    setActive(els.rulesetOptions, s.selectedRuleset);
    setActive(els.variantOptions, s.selectedVariant);
    setActive(els.powersOptions, s.freePowersOn ? 'on' : 'off');
    setActive(els.formatOptions, s.selectedFormat);
    setActive(els.goalOptions, s.selectedGoals);
    setActive(els.hintsOptions, s.hintsOn ? 'on' : 'off');
    setActive(els.soundOptions, s.soundOn ? 'on' : 'off');

    // Visibilité des blocs selon le mode (réplique le handler de sélection de mode).
    els.aiDifficultyField?.classList.toggle('hidden', s.gameMode !== 'ai');
    els.onlineBlock?.classList.toggle('hidden', s.gameMode !== 'online');
    els.localAiBlock?.classList.toggle('hidden', s.gameMode === 'online');

    // État plié/déplié des Options avancées.
    if (els.advancedOptions) {
      els.advancedOptions.open = localStorage.getItem('tm_advancedOpen') === '1';
    }
  }

  return { saveLastConfig, restoreLastConfig, applyConfigToUI };
}
