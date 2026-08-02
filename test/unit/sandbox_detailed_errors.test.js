import assert from 'assert';
import { DynamicEvaluator } from '../../lib/core/security/evaluator.js';

function testDetailedSandboxErrorMessages() {
  console.log('🧪 Testing detailed sandbox error messages for restricted global objects...');

  const evaluator = new DynamicEvaluator();
  const testGlobals = [
    'localStorage',
    'window',
    'document',
    'location',
    'sessionStorage',
    'fetch',
    'alert',
    'setTimeout',
    'setInterval',
  ];

  for (const name of testGlobals) {
    // Expression evaluation test
    assert.throws(
      () => evaluator.evaluateExpression(`${name}.getItem('token')`, {}),
      (err) => {
        const isAvxR15 = err.code === 'AVX_R15';
        const hasViolationPrefix = err.message.includes('[Avenx Sandbox Violation]');
        const hasBlockedName = err.message.includes(`Access to global object "${name}" is restricted inside templates`);
        const hasGuideline = err.message.includes('Decouple browser APIs into component methods');
        return isAvxR15 && hasViolationPrefix && hasBlockedName && hasGuideline;
      },
      `Evaluating "${name}" should throw detailed Avenx Sandbox Violation error`
    );

    // Direct identifier reference test
    assert.throws(
      () => evaluator.evaluateExpression(name, {}),
      (err) => {
        return (
          err.code === 'AVX_R15' &&
          err.message.includes('[Avenx Sandbox Violation]') &&
          err.message.includes(`Access to global object "${name}" is restricted inside templates`)
        );
      },
      `Referencing "${name}" directly should throw detailed sandbox violation`
    );
  }

  console.log('  ✅ Detailed error messages for restricted global object access verified!');
}

function testRestrictedGlobalAssignment() {
  console.log('🧪 Testing assignment block for restricted globals...');

  const evaluator = new DynamicEvaluator();
  assert.throws(
    () => evaluator.executeStatement('localStorage = null', {}),
    (err) => {
      return (
        err.code === 'AVX_R15' &&
        err.message.includes('[Avenx Sandbox Violation]') &&
        err.message.includes('Access to global object "localStorage" is restricted inside templates')
      );
    },
    'Assigning to restricted global should throw detailed sandbox violation'
  );

  console.log('  ✅ Restricted global assignment protection verified!');
}

function testNormalScopeAndWhitelistedGlobals() {
  console.log('🧪 Testing normal component scope and whitelisted globals...');

  const evaluator = new DynamicEvaluator();
  const scope = {
    user: { name: 'Alice' },
    undefinedField: undefined,
  };

  // Scoped property access
  assert.strictEqual(evaluator.evaluateExpression('user.name', scope), 'Alice');

  // Undefined component state property should evaluate to undefined without security exception
  assert.strictEqual(evaluator.evaluateExpression('user.nonExistent', scope), undefined);
  assert.strictEqual(evaluator.evaluateExpression('undefinedField', scope), undefined);
  assert.strictEqual(evaluator.evaluateExpression('unknownVariable', scope), undefined);

  // Whitelisted globals
  assert.strictEqual(evaluator.evaluateExpression('Math.max(10, 20)', scope), 20);
  assert.strictEqual(evaluator.evaluateExpression('JSON.stringify({ a: 1 })', scope), '{"a":1}');

  console.log('  ✅ Normal component scope and whitelisted globals evaluated correctly!');
}

try {
  testDetailedSandboxErrorMessages();
  testRestrictedGlobalAssignment();
  testNormalScopeAndWhitelistedGlobals();
  console.log('🎉 All detailed sandbox error message tests passed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Detailed sandbox error message tests failed!');
  console.error(error);
  process.exit(1);
}
