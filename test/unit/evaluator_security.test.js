import assert from 'assert';
import { DynamicEvaluator } from '../../lib/core/security/evaluator.js';

try {
  console.log(
    'Testing DynamicEvaluator sandboxing, global variable restriction, and prototype pollution protection...',
  );

  const evaluator = new DynamicEvaluator();

  // =========================================================================
  //  1. Unsafe Globals Blocking
  // =========================================================================
  console.log('  Testing block of unsafe globals...');

  // Unsafe globals should throw AVX_R15 with detailed error message
  const unsafeGlobals = [
    'window',
    'document',
    'global',
    'globalThis',
    'process',
    'localStorage',
    'sessionStorage',
    'fetch',
    'XMLHttpRequest',
    'setTimeout',
    'setInterval',
    'eval',
    'Function',
  ];

  for (const glob of unsafeGlobals) {
    assert.throws(
      () => evaluator.evaluateExpression(glob, {}),
      (err) => err.code === 'AVX_R15' && err.message.includes(`Access to global object "${glob}" is restricted inside templates`),
      `Access to global "${glob}" via expression should throw detailed sandbox violation`
    );

    assert.throws(
      () => evaluator.executeStatement(`return ${glob}`, {}),
      (err) => err.code === 'AVX_R15' && err.message.includes(`Access to global object "${glob}" is restricted inside templates`),
      `Access to global "${glob}" via statement should throw detailed sandbox violation`
    );
  }

  console.log('    ✅ Unsafe globals successfully blocked.');

  // =========================================================================
  //  2. Prototype Pollution & Constructor Blocking
  // =========================================================================
  console.log('  Testing block of prototype/constructor access...');

  // Simple object in scope
  const scope = { user: { name: 'Alice' } };

  // Accessing prototype/constructor on scoped object should throw
  assert.throws(() => {
    evaluator.evaluateExpression('user.constructor', scope);
  }, /AVX_R15/);

  assert.throws(() => {
    evaluator.evaluateExpression('user.__proto__', scope);
  }, /AVX_R15/);

  // Accessing constructor on primitive value return should throw
  assert.throws(() => {
    evaluator.evaluateExpression('user.name.constructor', scope);
  }, /AVX_R15/);

  // Constructor access on inline literals should throw if evaluated via scope
  // Wait, inline literal like `({}).constructor` in expression `({}).constructor`
  // since `({})` is evaluated by JS engine directly, does the proxy intercept it?
  // Let's test if our wrapping catches it if the literal is part of a returned value.
  // E.g. `(() => ({}))().constructor`
  assert.throws(() => {
    evaluator.evaluateExpression('(() => ({}))().constructor', {});
  }, /AVX_R15/);

  // Assigning blocked properties should throw
  assert.throws(() => {
    evaluator.executeStatement('user.constructor = null', scope);
  }, /AVX_R15/);

  assert.throws(() => {
    evaluator.executeStatement('user.__proto__ = null', scope);
  }, /AVX_R15/);

  console.log('    ✅ Prototype pollution and constructor access blocked.');

  // =========================================================================
  //  3. Function Return Value Sandboxing (Recursive Wrapping)
  // =========================================================================
  console.log('  Testing function return value sandboxing...');

  const listScope = { items: ['apple', 'banana'] };

  // Native method slice returns a new array
  // We must ensure the new array is also sandboxed!
  const sliced = evaluator.evaluateExpression('items.slice(0)', listScope);
  assert.strictEqual(Array.isArray(sliced), true, 'Returned object should still be recognized as an array');

  // Since it is wrapped, accessing constructor on it must throw!
  assert.throws(() => {
    evaluator.evaluateExpression('items.slice(0).constructor', listScope);
  }, /AVX_R15/);

  console.log('    ✅ Function return values recursively sandboxed.');

  // =========================================================================
  //  4. Allowed Globals Whitelist
  // =========================================================================
  console.log('  Testing allowed globals whitelist...');

  // Math
  const max = evaluator.evaluateExpression('Math.max(5, 10)', {});
  assert.strictEqual(max, 10);

  // JSON
  const json = evaluator.evaluateExpression('JSON.stringify({ val: 42 })', {});
  assert.strictEqual(json, '{"val":42}');

  // Date
  const dateStr = evaluator.evaluateExpression('new Date(1000).toISOString()', {});
  assert.strictEqual(dateStr, '1970-01-01T00:00:01.000Z');

  // Array
  const isArr = evaluator.evaluateExpression('Array.isArray([])', {});
  assert.strictEqual(isArr, true);

  console.log('    ✅ Allowed globals still fully functional.');

  // =========================================================================
  //  5. Standard Evaluation / Scope Assignments
  // =========================================================================
  console.log('  Testing standard evaluation compatibility...');

  const counterScope = { count: 1 };
  evaluator.executeStatement('count++', counterScope);
  assert.strictEqual(counterScope.count, 2);

  const customThis = { prefix: 'test-' };
  const val = evaluator.evaluateExpression('this.prefix + value', { value: 'run' }, customThis);
  assert.strictEqual(val, 'test-run');

  console.log('    ✅ Standard compatibility preserved.');

  // =========================================================================
  //  6. HTML Sanitizer Policy Integration
  // =========================================================================
  console.log('  Testing DynamicEvaluator.sanitizeHTML with policy options...');

  const rawHtml = '<div><b>Bold Text</b><script>alert("xss")</script><img src="pic.png" style="color:red" /></div>';
  const defaultSanitized = evaluator.sanitizeHTML(rawHtml);
  assert.strictEqual(defaultSanitized.includes('<script>'), false, 'Default sanitizeHTML should strip script tags');

  const customPolicySanitized = evaluator.sanitizeHTML(rawHtml, {
    disallowedTags: ['img'],
    disallowedAttributes: ['style'],
  });
  assert.strictEqual(customPolicySanitized.includes('<img'), false, 'Custom policy should strip img tag');

  console.log('    ✅ DynamicEvaluator.sanitizeHTML policy integration passed.');

  console.log('All DynamicEvaluator security sandbox tests passed!');
} catch (error) {
  console.error('❌ DynamicEvaluator security sandbox tests failed!');
  console.error(error);
  process.exit(1);
}
