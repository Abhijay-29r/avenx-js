import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

/**
 * Tests this.$slots.has() against transcluded default and named slot content.
 */
function testSlotsHasDefaultAndNamed() {
  console.log('🧪 Testing $slots.has()...');

  const component = new AvenxComponent(
    {},
    {},
    {},
    '<div><slot></slot><slot name="footer"></slot></div>',
  );
  const root = document.createElement('div');
  const defaultNode = document.createElement('span');
  defaultNode.textContent = 'body';
  const footerNode = document.createElement('span');
  footerNode.setAttribute('slot', 'footer');
  footerNode.textContent = 'footer';
  root.appendChild(defaultNode);
  root.appendChild(footerNode);

  component.__setMountTarget(root);

  assert.strictEqual(component.$slots.has('default'), true, 'default slot should be present');
  assert.strictEqual(component.$slots.has(), true, 'has() with no args should check default');
  assert.strictEqual(component.$slots.has('footer'), true, 'named footer slot should be present');
  assert.strictEqual(component.$slots.has('missing'), false, 'missing named slot should be false');

  console.log('  ✅ $slots.has() reports default and named slot presence.');
}

function testSlotsHasEmpty() {
  console.log('🧪 Testing $slots.has() with no slot content...');

  const component = new AvenxComponent({}, {}, {}, '<div><slot></slot></div>');
  const root = document.createElement('div');
  component.__setMountTarget(root);

  assert.strictEqual(component.$slots.has('default'), false);
  assert.strictEqual(component.$slots.has('footer'), false);

  console.log('  ✅ $slots.has() is false when no content was passed.');
}

testSlotsHasDefaultAndNamed();
testSlotsHasEmpty();

console.log('✅ All $slots.has() tests passed.');
