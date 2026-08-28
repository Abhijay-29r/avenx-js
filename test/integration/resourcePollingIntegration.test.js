import assert from 'assert';
import ExpressionParser from '../../lib/compiler/expressionParser.js';

console.log('🧪 Testing Resource pollInterval template parsing & component integration...');

function runTest() {
  try {
    const parser = new ExpressionParser();

    // 1. Self-closing tag with pollInterval
    const tpl1 = `<resource name="stats" handler="fetchStats()" pollInterval="5000" />`;
    const res1 = parser.parseResources(tpl1);
    assert.deepStrictEqual(res1.stats, { handler: 'fetchStats()', pollInterval: 5000 });

    // 2. Self-closing tag with :pollInterval
    const tpl2 = `<resource name="notifications" :handler="getNotifications()" :pollInterval="2500" />`;
    const res2 = parser.parseResources(tpl2);
    assert.deepStrictEqual(res2.notifications, { handler: 'getNotifications()', pollInterval: 2500 });

    // 3. Block syntax with pollInterval
    const tpl3 = `<resource name="serverHealth" pollInterval="10000">
      return fetchHealthStatus();
    </resource>`;
    const res3 = parser.parseResources(tpl3);
    assert.deepStrictEqual(res3.serverHealth, { handler: 'return fetchHealthStatus();', pollInterval: 10000 });

    // 4. Backward compatibility without pollInterval (should return string)
    const tpl4 = `<resource name="legacy" handler="getLegacy()" />`;
    const res4 = parser.parseResources(tpl4);
    assert.strictEqual(res4.legacy, 'getLegacy()');

    console.log('  ✅ Resource pollInterval integration & parsing tests passed!');
  } catch (error) {
    console.error('❌ Resource pollInterval integration test failed:', error);
    process.exit(1);
  }
}

runTest();
