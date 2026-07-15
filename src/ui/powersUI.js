// ===================== POUVOIRS DE PION (UI) =====================
// Activation des pouvoirs spéciaux depuis le bouton « Utiliser : … » :
// Tir Puissant / Sprint (mode ciblage : le prochain clic plateau choisit la
// destination), Mur, Relais, et Repli adverse (overlay de choix de cible).
// La logique des pouvoirs vit dans engine/powers.js ; ce module est la vue.
//
// Extrait de main.js (#21, lot 6). Même pattern que initShop()/initShootout().
// Le mode ciblage (pendingPowerActivation) est la propriété de CE module ;
// main.js le consulte via isTargeting() dans son routeur de clics.

import { t } from './i18n.js';
import { displayNameForToken } from './playerIdentity.js';
import { moveSelectedToken, applyBallMovement } from '../engine/gameEngine.js';
import {
  POWER_TYPES, POWER_LABELS, canActivatePower, getPowerShotDestinations, activateTirPuissant,
  getSprintDestinations, activateSprint, activateMur, activateRelais,
  getValidRepliTargets, activateRepliAdverse
} from '../engine/powers.js';

/**
 * Initialise l'UI des pouvoirs et branche ses boutons.
 * @param {object} deps
 * @param {object} deps.els               objet partagé de références DOM (main.js).
 * @param {() => object} deps.getGameState  état de jeu courant.
 * @param {(s: object) => void} deps.setGameState  remplace l'état de jeu.
 * @param {(before: object) => void} deps.handlePostActionEffects  suites d'un coup
 *        validé par le moteur (overlays, IA, sync online, tutoriel).
 * @param {() => void} deps.render        re-render du plateau.
 * @param {() => string} deps.getMyTeam   équipe contrôlée par ce navigateur.
 * @param {() => object|null} deps.getMyResolvedLineup  composition résolue ou null.
 * @returns {{ isTargeting: () => boolean, handlePowerDestinationClick: (r: number, c: number) => void }}
 */
export function initPowers({ els, getGameState, setGameState, handlePostActionEffects, render, getMyTeam, getMyResolvedLineup }) {

  // Mode d'activation de pouvoir : quand non-null, le prochain clic sur une
  // case du plateau est interprété comme la destination du pouvoir en cours
  // d'activation (Tir Puissant, Sprint), plutôt qu'un déplacement normal.
  let pendingPowerActivation = null; // { tokenId, power } | null

  function wirePowers() {
    els.activatePowerBtn?.addEventListener('click', handleActivatePowerClick);
    els.cancelPowerTargetBtn?.addEventListener('click', () => {
      els.powerTargetOverlay.classList.remove('show');
      pendingPowerActivation = null;
    });
  }

  function handleActivatePowerClick() {
    const gameState = getGameState();
    const token = gameState.tokens.find(t => t.id === gameState.selectedTokenId);
    if (!token || !canActivatePower(gameState, token)) return;

    switch (token.power) {
      case POWER_TYPES.TIR_PUISSANT:
      case POWER_TYPES.SPRINT:
        // Ces deux pouvoirs ont besoin d'une destination : on bascule en mode
        // ciblage, le prochain clic plateau sera intercepté par
        // handlePowerDestinationClick() plutôt que traité normalement.
        pendingPowerActivation = { tokenId: token.id, power: token.power };
        highlightPowerDestinations(token);
        els.hintBar.textContent = t('{power} : choisis une case.', { power: t(POWER_LABELS[token.power]) });
        break;

      case POWER_TYPES.MUR: {
        const before = gameState;
        setGameState(activateMur(gameState, token.id));
        handlePostActionEffects(before);
        break;
      }

      case POWER_TYPES.RELAIS: {
        setGameState(activateRelais(gameState, token.id));
        // Pas de fin de tour ici : le joueur doit maintenant effectuer une
        // vraie passe normalement, confirmRelaisAfterPass() prendra le relais
        // au bon moment dans handlePostActionEffects.
        render();
        els.hintBar.textContent = t('Relais activé : pousse le ballon, tu pourras ensuite déplacer un second pion.');
        break;
      }

      case POWER_TYPES.REPLI_ADVERSE:
        openPowerTargetSelection(token);
        break;
    }
  }

  /**
   * Affiche les cases atteignables par Tir Puissant ou Sprint comme des
   * destinations spéciales (réutilise les classes CSS existantes des
   * marqueurs de déplacement/passe pour rester visuellement cohérent).
   */
  function highlightPowerDestinations(token) {
    const gameState = getGameState();
    const dests = token.power === POWER_TYPES.TIR_PUISSANT
      ? getPowerShotDestinations(gameState)
      : getSprintDestinations(gameState, token);

    document.querySelectorAll('.cell').forEach(cell => {
      const r = parseInt(cell.dataset.row, 10);
      const c = parseInt(cell.dataset.col, 10);
      const isDest = dests.some(([dr, dc]) => dr === r && dc === c);
      cell.classList.toggle('dest-power', isDest);
    });
  }

  function handlePowerDestinationClick(row, col) {
    const { tokenId, power } = pendingPowerActivation;
    const before = getGameState();
    let next = before;

    if (power === POWER_TYPES.TIR_PUISSANT) {
      next = activateTirPuissant(before, tokenId, row, col, applyBallMovement);
    } else if (power === POWER_TYPES.SPRINT) {
      next = activateSprint(before, tokenId, row, col, moveSelectedToken);
    }
    setGameState(next);

    document.querySelectorAll('.dest-power').forEach(cell => cell.classList.remove('dest-power'));
    pendingPowerActivation = null;

    if (next === before) {
      // Coup invalide (case hors des destinations autorisées) : on reste en
      // mode normal plutôt que de bloquer le joueur silencieusement.
      render();
      return;
    }

    handlePostActionEffects(before);
  }

  function openPowerTargetSelection(token) {
    const gameState = getGameState();
    const myTeam = getMyTeam();
    const myResolvedLineup = getMyResolvedLineup();
    const targets = getValidRepliTargets(gameState, token.team);
    els.powerTargetList.innerHTML = '';

    if (targets.length === 0) {
      els.powerTargetList.innerHTML = '<p class="profile-empty-note">Aucune cible valide.</p>';
    } else {
      targets.forEach(target => {
        const opt = document.createElement('div');
        opt.className = 'mercato-player-option';
        opt.textContent = displayNameForToken(target.id, myResolvedLineup ? { [myTeam]: myResolvedLineup } : null)
          || (target.isGK ? 'Gardien' : `Pion ${target.team}`);
        opt.addEventListener('click', () => {
          const before = getGameState();
          setGameState(activateRepliAdverse(before, token.id, target.id));
          els.powerTargetOverlay.classList.remove('show');
          pendingPowerActivation = null;
          handlePostActionEffects(before);
        });
        els.powerTargetList.appendChild(opt);
      });
    }

    els.powerTargetOverlay.classList.add('show');
  }

  wirePowers();

  return { isTargeting: () => !!pendingPowerActivation, handlePowerDestinationClick };
}
