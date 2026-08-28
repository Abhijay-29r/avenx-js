import assert from 'assert';
import { DynamicEvaluator } from '../../lib/core/security/evaluator.js';

/**
 * Regression coverage for the sandbox's prototype-pollution guard being a word
 * blocklist over the expression source. It rejected the literal identifiers
 * `constructor`, `__proto__` and `prototype`, which a computed access such as
 * `Object.getPrototypeOf({})` or `Object['proto' + 'type']` walks straight
 * past, so a one-line expression could mutate Object.prototype for the whole
 * application.
 */

const evaluator = new DynamicEvaluator();

/**
 * Asserts an expression is rejected by the sandbox.
 * @param {string} expression - Expression source.
 * @param {object} [scope] - Evaluation scope.
 */
function assertBlocked(expression, scope = {}) {
  assert.throws(
    () => evaluator.evaluateExpression(expression, scope),
    (err) => err && err.code === 'AVX_R15',
    `expression should be blocked: ${expression}`,
  );
}

/**
 * Reaching a shared prototype must be refused however it is spelled.
 */
function testPrototypePollutionIsBlocked() {
  console.log('🧪 Testing prototype pollution routes are blocked...');

  const attempts = [
    'Object.assign(Object.getPrototypeOf({}), { polluted: 1 })',
    "Object.defineProperty(Object.getPrototypeOf({}), 'polluted2', { value: 1 })",
    'Object.assign(Object.getPrototypeOf([]), { polluted3: 1 })',
    "Object['proto' + 'type']",
    'Object.getPrototypeOf(Object.getPrototypeOf([]))',
    "Object.getPrototypeOf('literal')",
    'Object.getPrototypeOf(user)',
    'Object.setPrototypeOf(Object.getPrototypeOf({}), null)',
  ];

  for (const attempt of attempts) {
    assertBlocked(attempt, { user: { name: 'Ada' } });
  }

  // Nothing may have leaked through while the attempts ran.
  assert.strictEqual({}.polluted, undefined, 'Object.prototype must not be polluted');
  assert.strictEqual({}.polluted2, undefined, 'Object.prototype must not be polluted');
  assert.strictEqual([].polluted3, undefined, 'Array.prototype must not be polluted');

  console.log(`  ✅ ${attempts.length} pollution routes blocked.`);
}

/**
 * The existing structural guards must still hold.
 */
function testStructuralIdentifiersStillBlocked() {
  console.log('🧪 Testing literal structural identifiers are still blocked...');

  assertBlocked('({}).__proto__');
  assertBlocked('({}).constructor');
  assertBlocked('[].constructor');

  console.log('  ✅ Literal structural identifiers still blocked.');
}

/**
 * Ordinary template expressions must keep working.
 */
function testLegitimateExpressionsStillWork() {
  console.log('🧪 Testing legitimate expressions are unaffected...');

  const scope = {
    user: { name: 'Ada', tags: ['a', 'b'] },
    items: [3, 1, 2],
    count: 2,
  };

  const cases = [
    ['user.name.length', 3],
    ["items.slice().sort().join('')", '123'],
    ['items.filter((n) => n > 1).length', 2],
    ["Object.keys({ a: 1, b: 2 }).join(',')", 'a,b'],
    ['Object.entries({ a: 1 }).length', 1],
    ['JSON.stringify(Object.assign({}, { a: 1 }))', '{"a":1}'],
    ['Math.round(1.6) + count', 4],
    ["'ab'.toUpperCase()", 'AB'],
    ['new Date(0).getUTCFullYear()', 1970],
    ["new Map([['a', 1]]).get('a')", 1],
    ['new Set([1, 1, 2]).size', 2],
    ['user.tags.map((t) => t.toUpperCase()).join("-")', 'A-B'],
    ["[1, 2].includes(count) ? 'yes' : 'no'", 'yes'],
  ];

  for (const [expression, expected] of cases) {
    assert.strictEqual(
      evaluator.evaluateExpression(expression, scope),
      expected,
      `expression should evaluate normally: ${expression}`,
    );
  }

  console.log(`  ✅ ${cases.length} legitimate expressions still evaluate.`);
}

/**
 * Setting the prototype of a throwaway object is not pollution and must work,
 * but must never be able to target a shared prototype.
 */
function testNonSharedPrototypeMutationIsUnaffected() {
  console.log('🧪 Testing non-shared prototype mutation is unaffected...');

  const result = evaluator.evaluateExpression('Object.setPrototypeOf({}, { marker: 1 }).marker', {});
  assert.strictEqual(result, 1, 'mutating a local object should still be allowed');
  assert.strictEqual({}.marker, undefined, 'the shared prototype must be untouched');

  console.log('  ✅ Local prototype mutation unaffected.');
}

try {
  testPrototypePollutionIsBlocked();
  testStructuralIdentifiersStillBlocked();
  testLegitimateExpressionsStillWork();
  testNonSharedPrototypeMutationIsUnaffected();
  console.log('🎉 All sandbox prototype pollution tests passed successfully!');
} catch (err) {
  console.error('❌ Sandbox prototype pollution test failed:', err);
  process.exit(1);
}
