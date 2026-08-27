import assert from 'assert';
import { StateFactory, toRaw, isReactive, markRaw } from '../../lib/core/index.js';
import { RAW_SYMBOL, NON_REACTIVE_SYMBOL } from '../../lib/core/reactive/proxyHandler.js';

console.log('🧪 Testing toRaw / isReactive / markRaw utilities...');

try {
  const factory = new StateFactory();
  const state = factory.create({
    count: 1,
    nested: { ok: true },
  });

  assert.strictEqual(isReactive(state), true, 'state proxy should be reactive');
  assert.strictEqual(isReactive(state.nested), true, 'nested object should be reactive when accessed');
  assert.strictEqual(isReactive({ plain: true }), false, 'plain object should not be reactive');
  assert.strictEqual(isReactive(null), false);

  const raw = toRaw(state);
  assert.strictEqual(raw[RAW_SYMBOL], undefined, 'raw object should not expose RAW_SYMBOL getter path as nested');
  assert.notStrictEqual(raw, state, 'toRaw should unwrap the proxy');
  assert.strictEqual(raw.count, 1);
  assert.strictEqual(toRaw(42), 42);
  assert.strictEqual(toRaw(null), null);

  const chart = markRaw({ points: [1, 2, 3], id: 'chart-1' });
  assert.strictEqual(chart[NON_REACTIVE_SYMBOL], true, 'markRaw should set NON_REACTIVE_SYMBOL');

  const withRaw = factory.create({
    chart,
    label: 'demo',
  });
  assert.strictEqual(isReactive(withRaw), true);
  assert.strictEqual(withRaw.chart, chart, 'marked raw object must keep identity');
  assert.strictEqual(isReactive(withRaw.chart), false, 'marked raw object must not become a proxy');

  console.log('✅ reactivity raw utilities tests passed!');
} catch (error) {
  console.error('❌ reactivity raw utilities tests failed!');
  console.error(error);
  process.exit(1);
}
