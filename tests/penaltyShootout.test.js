import { describe, test, expect } from './test-utils.js';
import {
  createShootout, shoot, isShootoutOver, shootoutWinner,
  SHOT_DIRECTIONS, randomDirection
} from '../src/engine/penaltyShootout.js';
import { TEAMS } from '../src/engine/constants.js';

describe('seance de tirs au but', () => {
  test('etat initial coherent', () => {
    const s = createShootout();
    expect(s.bestOf).toBe(5);
    expect(s.taker).toBe(TEAMS.BLEU);
    expect(s.over).toBe(false);
    expect(s.score[TEAMS.BLEU]).toBe(0);
  });

  test('but si tireur et gardien choisissent des directions differentes', () => {
    let s = createShootout();
    s = shoot(s, 'gauche', 'droite');
    expect(s.score[TEAMS.BLEU]).toBe(1);
    expect(s.taker).toBe(TEAMS.ROUGE); // alternance
  });

  test('arret si le gardien devine la direction', () => {
    let s = createShootout();
    s = shoot(s, 'centre', 'centre');
    expect(s.score[TEAMS.BLEU]).toBe(0);
    expect(s.history[0].scored).toBe(false);
  });

  test('clinch anticipe : bleu marque tout, rouge rate tout', () => {
    let s = createShootout();
    // Alterne bleu (marque) / rouge (rate) jusqu au clinch
    for (let i = 0; i < 10 && !s.over; i++) {
      s = s.taker === TEAMS.BLEU
        ? shoot(s, 'gauche', 'droite')  // bleu marque
        : shoot(s, 'centre', 'centre'); // rouge rate
    }
    expect(isShootoutOver(s)).toBe(true);
    expect(shootoutWinner(s)).toBe(TEAMS.BLEU);
    // Le clinch doit tomber avant les 5 tirs complets de chaque cote
    expect(s.shotsTaken[TEAMS.BLEU] <= 3).toBe(true);
  });

  test('egalite en reglementaire puis mort subite', () => {
    let s = createShootout({ bestOf: 2 });
    // 2 tirs chacun, tous marques -> 2-2, mort subite
    s = shoot(s, 'gauche', 'droite'); // B 1
    s = shoot(s, 'gauche', 'droite'); // R 1
    s = shoot(s, 'gauche', 'droite'); // B 2
    s = shoot(s, 'gauche', 'droite'); // R 2
    expect(s.over).toBe(false); // 2-2, on continue
    s = shoot(s, 'gauche', 'droite'); // B marque (3-2) mais rouge pas encore tire
    expect(s.over).toBe(false);
    s = shoot(s, 'centre', 'centre'); // R rate -> 3-2, paires egales, decide
    expect(s.over).toBe(true);
    expect(s.winner).toBe(TEAMS.BLEU);
  });

  test('un tir apres la fin ne change plus rien', () => {
    let s = createShootout({ bestOf: 1 });
    s = shoot(s, 'gauche', 'droite'); // B 1
    s = shoot(s, 'centre', 'centre'); // R 0 -> B gagne 1-0
    expect(s.over).toBe(true);
    const frozen = s;
    s = shoot(s, 'gauche', 'droite');
    expect(s).toBe(frozen);
  });

  test('randomDirection renvoie une direction valide', () => {
    const d = randomDirection(() => 0.9);
    expect(SHOT_DIRECTIONS.includes(d)).toBe(true);
  });
});
