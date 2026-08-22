import assert from 'assert';
import { AvenxSandbox } from '../../lib/core/security/sandbox.js';
import { DynamicEvaluator } from '../../lib/core/security/evaluator.js';

/**
 * Regression coverage for the sandbox patching `Function.prototype.constructor`
 * at import time. That altered a shared intrinsic for the whole realm, so any
 * unrelated library on the page saw `fn.constructor` throw — a common idiom in
 * type guards, polyfills and serializers.
 */

/**
 * Ordinary application code must be unaffected by importing the runtime.
 */
function testFunctionConstructorStillWorksOutsideTemplates() {
  console.log('🧪 Testing Function.prototype.constructor is untouched for application code...');

  /**
   * A plain application function.
   */
  function plain() {}
  const arrow = () => {};
  /**
   * A plain async application function.
   */
  async function asyncFn() {}

  assert.doesNotThrow(() => plain.constructor, 'accessing fn.constructor must not throw');
  assert.strictEqual(plain.constructor, Function, 'fn.constructor should still be Function');
  assert.strictEqual(plain.constructor.name, 'Function', 'the common fn.constructor.name idiom must work');
  assert.strictEqual(arrow.constructor, Function, 'arrow functions should be unaffected');
  assert.strictEqual(asyncFn.constructor.name, 'AsyncFunction', 'async detection idiom must work');

  // Type-guard and serializer style checks used widely by third-party libraries.
  assert.strictEqual({}.constructor, Object, 'Object literals should be unaffected');
  assert.strictEqual([].constructor, Array, 'Arrays should be unaffected');
  assert.ok(new Date().constructor === Date, 'Built-ins should be unaffected');

  const descriptor = Object.getOwnPropertyDescriptor(Function.prototype, 'constructor');
  assert.ok(descriptor, 'Function.prototype.constructor descriptor should exist');
  assert.strictEqual(typeof descriptor.get, 'undefined', 'no throwing getter should be installed');
  assert.strictEqual(descriptor.value, Function, 'the intrinsic must be left as the real Function');

  console.log('  ✅ Application code sees an unmodified Function.prototype.');
}

/**
 * The sandbox must still deny access to dynamic-code constructors from inside a
 * template, regardless of the route used to reach them.
 */
function testSandboxStillBlocksFunctionConstructor() {
  console.log('🧪 Testing the sandbox still blocks the Function constructor...');

  const evaluator = new DynamicEvaluator();
  const attempts = [
    'Math.max.constructor',
    "Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Math.max),'construc'+'tor').value",
    "Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Math.max),'construc'+'tor').value('return 1+1')",
    "Object.values({ f: Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Math.max),'construc'+'tor').value })[0]",
  ];

  for (const expression of attempts) {
    assert.throws(
      () => evaluator.evaluateExpression(expression, {}),
      (err) => err && err.code === 'AVX_R15',
      `expression should be blocked by the sandbox: ${expression}`,
    );
  }
  console.log(`  ✅ ${attempts.length} Function-constructor routes blocked.`);
}

/**
 * The proxy-level guard must not interfere with ordinary allowed globals.
 */
function testAllowedGlobalsStillUsable() {
  console.log('🧪 Testing allowed globals still work inside templates...');

  const evaluator = new DynamicEvaluator();

  assert.strictEqual(evaluator.evaluateExpression('Math.max(2, 5)', {}), 5);
  assert.strictEqual(evaluator.evaluateExpression('JSON.stringify({ a: 1 })', {}), '{"a":1}');
  assert.strictEqual(evaluator.evaluateExpression('[1, 2, 3].map(n => n * 2).join(",")', {}), '2,4,6');
  assert.strictEqual(evaluator.evaluateExpression('items.filter(i => i > 1).length', { items: [1, 2, 3] }), 2);
  assert.strictEqual(evaluator.evaluateExpression('new Date(0).getTime()', {}), 0, 'construction of allowed globals should work');

  console.log('  ✅ Allowed globals and callbacks still evaluate.');
}

/**
 * The sandbox proxy still guards structural property access.
 */
function testStructuralPropertiesStillGuarded() {
  console.log('🧪 Testing structural property access is still guarded...');

  const proxy = AvenxSandbox.createProxy({ value: 1 }, {});

  assert.throws(() => proxy.__proto__, /blocked for security reasons/, '__proto__ reads must be blocked');
  assert.throws(
    () => {
      proxy.__proto__ = {};
    },
    /blocked for security reasons/,
    '__proto__ writes must be blocked',
  );
  assert.throws(
    () => {
      proxy.prototype = {};
    },
    /blocked for security reasons/,
    'prototype writes must be blocked',
  );

  console.log('  ✅ Structural property guards intact.');
}

try {
  testFunctionConstructorStillWorksOutsideTemplates();
  testSandboxStillBlocksFunctionConstructor();
  testAllowedGlobalsStillUsable();
  testStructuralPropertiesStillGuarded();
  console.log('🎉 All sandbox global intrinsic tests passed successfully!');
} catch (err) {
  console.error('❌ Sandbox global intrinsic test failed:', err);
  process.exit(1);
}
