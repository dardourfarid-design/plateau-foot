// ===================== MICRO TEST RUNNER =====================
// Pas d'accès npm en environnement sandboxé -> on implémente un runner minimal
// avec une API volontairement compatible Vitest/Jest (describe/test/expect),
// pour pouvoir basculer vers Vitest sans réécrire un seul test le jour où
// l'environnement de build le permet (CI réelle, machine du développeur, etc.)

const results = { pass: 0, fail: 0, failures: [] };
let currentSuite = '';

export function describe(name, fn) {
  currentSuite = name;
  fn();
  currentSuite = '';
}

export function test(name, fn) {
  const fullName = currentSuite ? `${currentSuite} > ${name}` : name;
  try {
    fn();
    results.pass++;
    console.log(`  ✓ ${fullName}`);
  } catch (err) {
    results.fail++;
    results.failures.push({ name: fullName, error: err });
    console.log(`  ✗ ${fullName}`);
    console.log(`    ${err.message}`);
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => deepEqual(a[k], b[k]));
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (!deepEqual(actual, expected)) {
        throw new Error(`Attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Attendu null, reçu ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Attendu une valeur truthy, reçu ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Attendu une valeur falsy, reçu ${JSON.stringify(actual)}`);
    },
    toHaveLength(n) {
      if (!actual || actual.length !== n) {
        throw new Error(`Attendu une longueur de ${n}, reçu ${actual ? actual.length : 'undefined'}`);
      }
    },
    toContainEqual(expected) {
      const found = actual.some(item => deepEqual(item, expected));
      if (!found) {
        throw new Error(`Attendu que le tableau contienne ${JSON.stringify(expected)}`);
      }
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error(`Attendu > ${n}, reçu ${actual}`);
    }
  };
}

export function printSummary() {
  console.log('\n' + '─'.repeat(50));
  console.log(`${results.pass} test(s) réussi(s), ${results.fail} échoué(s)`);
  if (results.fail > 0) {
    console.log('\nÉchecs :');
    results.failures.forEach(f => console.log(`  - ${f.name}: ${f.error.message}`));
  }
  console.log('─'.repeat(50));
  return results.fail === 0;
}
