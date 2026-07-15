import { describe, test, expect } from './test-utils.js';
import { TUTORIAL_STEPS, stepApplies, createTutorialController } from '../public/src/ui/tutorial.js';

// #200 — le tutoriel s'adapte au palier : les étapes de règle avancée ne
// doivent apparaître que si la mécanique correspondante est active.
describe('tutoriel adapté au palier (#200)', () => {
  const ids = rules => createStepsIds(rules);
  function createStepsIds(rules) {
    return TUTORIAL_STEPS.filter(s => stepApplies(s, rules)).map(s => s.id);
  }

  test('stepApplies : étapes sans requires toujours montrées', () => {
    expect(stepApplies({ id: 'intro' }, {})).toBe(true);
    expect(stepApplies({ id: 'goal' }, { coverage: false })).toBe(true);
  });

  test('stepApplies : chaque règle avancée dépend de son flag', () => {
    expect(stepApplies({ requires: 'coverage' }, { coverage: true })).toBe(true);
    expect(stepApplies({ requires: 'coverage' }, { coverage: false })).toBe(false);
    expect(stepApplies({ requires: 'oneTwo' }, { oneTwo: false })).toBe(false);
    expect(stepApplies({ requires: 'special' }, { wings: true })).toBe(true);
    expect(stepApplies({ requires: 'special' }, { penaltySpot: true })).toBe(true);
    expect(stepApplies({ requires: 'special' }, { wings: false, penaltySpot: false })).toBe(false);
    expect(stepApplies({ requires: 'powers' }, { powers: true })).toBe(true);
  });

  test('Découverte : aucune règle avancée dans le parcours', () => {
    const seen = ids({ coverage: false, oneTwo: false, wings: false, penaltySpot: false, powers: false });
    ['rule-coverage', 'rule-unedeux', 'rule-special', 'rule-powers'].forEach(id => {
      expect(seen.includes(id)).toBe(false);
    });
    // mais les gestes de base restent
    expect(seen.includes('select-pawn')).toBe(true);
    expect(seen.includes('goal')).toBe(true);
  });

  test('Classique : couverture + une-deux, mais ni cases spéciales ni pouvoirs (formation sans pouvoir)', () => {
    const seen = ids({ coverage: true, oneTwo: true, wings: false, penaltySpot: false, powers: false });
    expect(seen.includes('rule-coverage')).toBe(true);
    expect(seen.includes('rule-unedeux')).toBe(true);
    expect(seen.includes('rule-special')).toBe(false);
    expect(seen.includes('rule-powers')).toBe(false);
  });

  test('Expert (avec pouvoirs) : toutes les étapes de règle sont montrées', () => {
    const seen = ids({ coverage: true, oneTwo: true, wings: true, penaltySpot: true, powers: true });
    ['rule-coverage', 'rule-unedeux', 'rule-special', 'rule-powers'].forEach(id => {
      expect(seen.includes(id)).toBe(true);
    });
  });

  test('le contrôleur filtre le parcours et cale progressLabel sur les étapes retenues', () => {
    const ctrl = createTutorialController();
    ctrl.start({ coverage: false, oneTwo: false, wings: false, penaltySpot: false, powers: false });
    const total = TUTORIAL_STEPS.filter(s => stepApplies(s, {})).length;
    expect(ctrl.progressLabel()).toBe(`Étape 1/${total}`);
    // sans filtre (start sans rules) = liste complète
    const ctrl2 = createTutorialController();
    ctrl2.start();
    expect(ctrl2.progressLabel()).toBe(`Étape 1/${TUTORIAL_STEPS.length}`);
  });
});
