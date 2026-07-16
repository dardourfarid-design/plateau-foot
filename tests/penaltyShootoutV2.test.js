import { describe, test, expect } from './test-utils.js';
import {
  SHOT_ZONES, WIDE_THRESHOLD,
  resolveShot, readKeeperZone, randomSweet,
  cpuGoalProbability, cpuPickZone, cpuOnTarget, cpuPlanShot, resolveCpuShot,
  createShootout, applyShot, playerShoot, cpuShootAgainstDive,
  goalsOf, isShootoutOver, shootoutWinner, isSuddenDeath
} from '../public/src/engine/penaltyShootoutV2.js';
import { TEAMS } from '../public/src/engine/constants.js';

// ===================== TESTS moteur tirs au but v2 =====================
// Couvre la résolution pure d'un tir (zone/jauge/gardien), les aléas isolés
// (RNG injectable) et les transitions d'état (score, alternance, fin de
// séance : clinch réglementaire + mort subite).

describe('resolveShot (pur)', () => {
  test('cadré + gardien dans la mauvaise zone => but', () => {
    expect(resolveShot({ zone: 'tl', power: 50, sweet: 50, keeperZone: 'br' })).toBe('goal');
  });

  test('cadré + gardien dans la bonne zone => arrêt', () => {
    expect(resolveShot({ zone: 'tl', power: 50, sweet: 50, keeperZone: 'tl' })).toBe('save');
  });

  test('jauge trop loin du sweet (> seuil) => raté, même si le coin est vide', () => {
    // écart = 40 > WIDE_THRESHOLD (33)
    expect(resolveShot({ zone: 'tr', power: 90, sweet: 50, keeperZone: 'bl' })).toBe('miss');
  });

  test('écart pile au seuil reste cadré (but si gardien ailleurs)', () => {
    expect(WIDE_THRESHOLD).toBe(33);
    expect(resolveShot({ zone: 'bc', power: 83, sweet: 50, keeperZone: 'tl' })).toBe('goal');
  });

  test('zone invalide => raté (garde)', () => {
    expect(resolveShot({ zone: 'plafond', power: 50, sweet: 50, keeperZone: 'tl' })).toBe('miss');
  });
});

describe('aléas isolés (RNG injectable)', () => {
  test('readKeeperZone : rng bas => le gardien lit la bonne zone', () => {
    // 0.01 < 0.10 + 55*0.004 => lecture correcte, renvoie la zone visée
    expect(readKeeperZone('tr', 55, () => 0.01)).toBe('tr');
  });

  test('readKeeperZone : rng haut => zone au hasard mais valide', () => {
    const z = readKeeperZone('tr', 55, () => 0.99);
    expect(SHOT_ZONES.includes(z)).toBe(true);
  });

  test('randomSweet reste dans [28, 72]', () => {
    expect(randomSweet(() => 0)).toBe(28);
    const hi = randomSweet(() => 1);
    expect(hi <= 72 && hi >= 28).toBe(true);
  });

  // #227 — le tir adverse est désormais JOUÉ (le joueur plonge), il n'est plus
  // tiré au dé. Le cadrage est calibré pour conserver l'équilibre historique.
  test('cpuGoalProbability reste la référence d équilibrage historique', () => {
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    expect(near(cpuGoalProbability(0), 0.52)).toBe(true);
    expect(near(cpuGoalProbability(55), 0.641)).toBe(true);
  });

  test('cpuOnTarget = p(but historique) x 6/5, borné à 1', () => {
    // p(cadré) à difficulté 55 = 0.641 * 6/5 = 0.7692
    expect(cpuOnTarget(55, () => 0.70)).toBe(true);
    expect(cpuOnTarget(55, () => 0.80)).toBe(false);
  });

  test('cpuPickZone reste dans les 6 zones', () => {
    expect(SHOT_ZONES.includes(cpuPickZone(() => 0))).toBe(true);
    expect(SHOT_ZONES.includes(cpuPickZone(() => 0.99))).toBe(true);
  });

  test('resolveCpuShot : arrêt si on plonge dans la bonne zone, sinon but', () => {
    const plan = { zone: 'tl', onTarget: true };
    expect(resolveCpuShot(plan, 'tl')).toBe('save');
    expect(resolveCpuShot(plan, 'br')).toBe('goal');
    // Tir non cadré : raté quel que soit le plongeon.
    expect(resolveCpuShot({ zone: 'tl', onTarget: false }, 'tl')).toBe('miss');
  });

  test('cpuPlanShot expose zone + cadrage (déterministe avec un RNG injecté)', () => {
    const plan = cpuPlanShot(55, () => 0.1); // 0.1 -> zone index 0, cadré
    expect(plan.zone).toBe(SHOT_ZONES[0]);
    expect(plan.onTarget).toBe(true);
  });
});

describe('état initial & applyShot', () => {
  test('createShootout cohérent', () => {
    const s = createShootout();
    expect(s.bestOf).toBe(5);
    expect(s.difficulty).toBe(55);
    expect(s.taker).toBe(TEAMS.BLEU);
    expect(s.over).toBe(false);
    expect(s.shots[TEAMS.BLEU]).toHaveLength(0);
  });

  test('un but incrémente le score et passe la main', () => {
    let s = createShootout();
    s = applyShot(s, 'goal');
    expect(s.score[TEAMS.BLEU]).toBe(1);
    expect(s.taker).toBe(TEAMS.ROUGE);
    expect(s.shots[TEAMS.BLEU]).toEqual(['goal']);
  });

  test('un arrêt et un raté ne marquent pas', () => {
    let s = createShootout();
    s = applyShot(s, 'save');
    expect(s.score[TEAMS.BLEU]).toBe(0);
    expect(goalsOf(s.shots[TEAMS.BLEU])).toBe(0);
    expect(s.shots[TEAMS.BLEU]).toEqual(['save']);
  });

  test('playerShoot enchaîne resolveShot + applyShot', () => {
    let s = createShootout();
    s = playerShoot(s, { zone: 'tl', power: 50, sweet: 50, keeperZone: 'tr' });
    expect(s.score[TEAMS.BLEU]).toBe(1);
  });

  test('cpuShootAgainstDive : le plongeon du joueur décide de l issue', () => {
    let s = createShootout();
    s = applyShot(s, 'goal');                            // Bleu marque -> au tour de Rouge
    const plan = { zone: 'tl', onTarget: true };
    const saved = cpuShootAgainstDive(s, plan, 'tl');    // bon plongeon -> arrêt
    expect(saved.score[TEAMS.ROUGE]).toBe(0);
    expect(saved.shots[TEAMS.ROUGE]).toEqual(['save']);
    const beaten = cpuShootAgainstDive(s, plan, 'br');   // mauvais côté -> but
    expect(beaten.score[TEAMS.ROUGE]).toBe(1);
    expect(beaten.shots[TEAMS.ROUGE]).toEqual(['goal']);
  });
});

describe('fin de séance', () => {
  test('clinch anticipé : Bleu marque tout, Rouge rate tout', () => {
    let s = createShootout();
    for (let i = 0; i < 10 && !s.over; i++) {
      s = s.taker === TEAMS.BLEU ? applyShot(s, 'goal') : applyShot(s, 'save');
    }
    expect(isShootoutOver(s)).toBe(true);
    expect(shootoutWinner(s)).toBe(TEAMS.BLEU);
    // 3-0 après 3 tirs de Bleu et 2 de Rouge => l'avance (3) dépasse le max de
    // Rouge (0 + 3 restants = 3) seulement à 3-0 sur le 3e tir bleu.
    expect(s.shots[TEAMS.BLEU].length <= 3).toBe(true);
  });

  test('égalité réglementaire puis mort subite tranchée', () => {
    let s = createShootout({ bestOf: 2 });
    // 2 tirs chacun, tous marqués -> 2-2
    s = applyShot(s, 'goal'); // B1
    s = applyShot(s, 'goal'); // R1
    s = applyShot(s, 'goal'); // B2
    s = applyShot(s, 'goal'); // R2
    expect(s.over).toBe(false);
    expect(isSuddenDeath(s)).toBe(false);
    s = applyShot(s, 'goal'); // B marque (3-2), Rouge pas encore tiré
    expect(s.over).toBe(false);
    expect(isSuddenDeath(s)).toBe(true);
    s = applyShot(s, 'miss'); // R rate -> paires égales, 3-2, Bleu gagne
    expect(s.over).toBe(true);
    expect(s.winner).toBe(TEAMS.BLEU);
  });

  test('un tir après la fin ne change plus rien', () => {
    let s = createShootout({ bestOf: 1 });
    s = applyShot(s, 'goal'); // B 1
    s = applyShot(s, 'miss'); // R 0 -> Bleu gagne 1-0
    expect(s.over).toBe(true);
    const frozen = s;
    s = applyShot(s, 'goal');
    expect(s).toBe(frozen);
  });
});
