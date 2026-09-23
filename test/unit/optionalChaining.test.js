/**
 * @file optionalChaining.test.js
 * @description `?.` short-circuits the chain it belongs to, not just its link.
 *
 * `user?.profile.name` is `undefined` when `user` is nullish, because the
 * `name` read never happens -- that is what an optional chain means, and it is
 * the form the docs recommend for guarding state that is not loaded yet. Both
 * halves of the pipeline used to skip only the link carrying `?.` and then read
 * `name` off `undefined`, so the expression threw instead.
 *
 * Each case is checked against what JavaScript itself does, because the two
 * Avenx paths agreed with each other while both were wrong. The chain must
 * still throw where JavaScript throws: a link short-circuits when the value
 * before `?.` is nullish, not when a later property happens to be missing.
 */

import assert from 'assert';
import { parseExpression } from '../../lib/core/expression/parser.js';
import { evaluate } from '../../lib/core/expression/evaluator.js';
import { compileExpressionToSource } from '../../lib/compiler/codegen/expression.js';
import * as ops from '../../lib/core/expression/ops.js';

const RUNTIME = {
  axRead: ops.readMember,
  axWrite: ops.writeMember,
  axCall: ops.callFunction,
  axNew: ops.construct,
  axGet: ops.readIdentifier,
  axSet: ops.writeIdentifier,
  axTypeof: ops.typeofIdentifier,
  axKey: ops.guardKey,
  axIn: ops.hasIn,
};
const RUNTIME_NAMES = Object.keys(RUNTIME);
const RUNTIME_VALUES = RUNTIME_NAMES.map((name) => RUNTIME[name]);

/**
 * A fresh scope, with a log the cases use to record what was evaluated.
 * @returns {object} The scope.
 */
function makeScope() {
  const log = [];
  return {
    log,
    /**
     * Records a value and hands it back, so a case can assert on what ran.
     * @param {any} value - The value to record.
     * @returns {any} The same value.
     */
    tap(value) {
      log.push(String(value));
      return value;
    },
    missing: null,
    blank: undefined,
    shallow: {},
    user: { profile: { name: 'Ada', tags: ['a', 'b'] }, greet() { return this.profile.name; } },
    factory: { make: () => ({ open: () => 'open' }) },
    nothing: () => null,
    rows: [{ v: 1 }, { v: 2 }],
  };
}

/**
 * Evaluates one source three ways: natively, interpreted, and compiled.
 * @param {string} source - The expression source.
 * @returns {{native: string, interpreted: string, compiled: string, logs: string[]}}
 *   A comparable outcome per path, and the side effects each one recorded.
 */
function threeWays(source) {
  /**
   * Runs one path, folding a throw into a comparable marker.
   * @param {Function} run - The path to run.
   * @returns {string} The value as JSON, or the error's type.
   */
  const outcome = (run) => {
    try {
      return JSON.stringify(run());
    } catch (error) {
      return `threw ${error.constructor.name}`;
    }
  };

  const nativeScope = makeScope();
  const interpretedScope = makeScope();
  const compiledScope = makeScope();

  const names = Object.keys(nativeScope).filter((name) => name !== 'log');
  const native = outcome(() =>
    // The reference answer is JavaScript's own, so the case says what `?.`
    // means rather than what Avenx currently does with it.
    new Function(...names, `return (${source});`)(...names.map((name) => nativeScope[name])),
  );
  const interpreted = outcome(() => evaluate(parseExpression(source), interpretedScope));
  const compiled = outcome(() =>
    new Function(...RUNTIME_NAMES, `return ${compileExpressionToSource(source)};`)(...RUNTIME_VALUES)(
      compiledScope,
    ),
  );

  return {
    native,
    interpreted,
    compiled,
    logs: [nativeScope.log.join(','), interpretedScope.log.join(','), compiledScope.log.join(',')],
  };
}

try {
  console.log('🧪 Testing optional chains short-circuit the whole chain...');

  const CASES = [
    // The chain stops at the nullish link: nothing after it is read or called.
    'missing?.profile.name',
    'missing?.profile.name.length',
    'missing?.profile.greet()',
    'missing?.profile[0].name',
    'blank?.a.b.c',
    'nothing()?.profile.name',
    'missing?.().name',
    'missing?.profile.name ?? "anonymous"',
    'typeof missing?.profile.name',
    '`${missing?.profile.name}`',
    'rows?.map((row) => missing?.a.b ?? row.v).join("-")',

    // Arguments after the short circuit are not evaluated either.
    'missing?.profile.greet(tap("arg"))',
    'missing?.greet(tap("arg"))',
    'nothing()?.profile.greet(tap("arg"))',

    // A missing property is not a short circuit: these still throw, as they do
    // in JavaScript.
    'shallow?.profile.name',
    'shallow?.profile.greet()',
    'user?.profile.absent.name',
    'user.profile?.absent.name',

    // Chains that resolve, including the receiver of a method call.
    'user?.profile.name',
    'user?.profile.tags[1]',
    'user?.greet()',
    'user.profile?.tags.join("-")',
    'user?.greet?.()',
    'factory?.make().open()',
    'factory.make()?.open()',
    'factory?.make?.()?.open?.()',
    'user?.profile[tap("name")]',
    'user?.["profile"].name',
    '(user?.profile).name',

    // Chains with no `?.` at all must be unaffected.
    'user.profile.name',
    'user.greet()',
    'factory.make().open()',
    'rows.map((row) => row.v).join("-")',
  ];

  for (const source of CASES) {
    const { native, interpreted, compiled, logs } = threeWays(source);
    assert.strictEqual(
      interpreted,
      native,
      `interpreter disagrees with JavaScript for ${JSON.stringify(source)}: ${interpreted} vs ${native}`,
    );
    assert.strictEqual(
      compiled,
      native,
      `compiled closure disagrees with JavaScript for ${JSON.stringify(source)}: ${compiled} vs ${native}`,
    );
    assert.strictEqual(
      new Set(logs).size,
      1,
      `side effects differ for ${JSON.stringify(source)}: ${JSON.stringify(logs)}`,
    );
  }
  console.log(`  ✅ ${CASES.length} chains agree with JavaScript, on value, throw and side effects`);

  // A chain is not an assignment target, which is also what JavaScript says.
  for (const source of ['missing?.profile = 1', 'missing?.profile.name = 1', 'missing?.profile++']) {
    assert.throws(
      () => parseExpression(source),
      /Invalid (assignment|update) target/,
      `expected ${JSON.stringify(source)} to be refused`,
    );
  }
  console.log('  ✅ an optional chain is refused as an assignment or update target');

  // The chain boundary is the parse's, so a guarded key is still guarded.
  assert.throws(
    () => evaluate(parseExpression('user?.profile.constructor'), makeScope()),
    /blocked for security reasons/,
  );
  assert.throws(() => compileExpressionToSource('user?.profile.constructor'), /blocked for security reasons/);
  console.log('  ✅ forbidden keys are still refused inside a chain');

  console.log('  ✅ Optional chaining tests passed!');
} catch (error) {
  console.error('❌ Optional chaining tests failed!');
  console.error(error);
  process.exit(1);
}
