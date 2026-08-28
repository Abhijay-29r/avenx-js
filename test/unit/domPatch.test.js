import assert from 'assert';
import { DomPatcher } from '../../lib/core/renderer/domPatch.js';
import { MockDOMElement, setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';

/**
 * Wraps an element's setAttribute with a call recorder so tests can assert
 * whether a redundant class write happened.
 * @param {MockDOMElement} element
 * @returns {{ calls: string[], restore: () => void }}
 */
function spySetAttribute(element) {
  const calls = [];
  const original = element.setAttribute.bind(element);
  element.setAttribute = (name, value) => {
    calls.push(name);
    return original(name, value);
  };
  return {
    calls,
    restore: () => {
      element.setAttribute = original;
    },
  };
}

/**
 * Patches `html` into a fresh target and returns the patched container div.
 * @param {DomPatcher} patcher
 * @param {string} html
 * @returns {MockDOMElement}
 */
function patchContainer(patcher, html) {
  const target = new MockDOMElement('div');
  patcher.patch(target, html);
  return target.childNodes[0];
}

function testClassTokenEqualitySkipsRedundantWrites() {
  console.log('🧪 Testing DomPatcher class token equality skips redundant writes...');
  setupDOMMock();

  try {
    const patcher = new DomPatcher();
    const container = patchContainer(patcher, '<div class="btn active"><span>x</span></div>');

    // 1. Same tokens, different order: no class write.
    let spy = spySetAttribute(container);
    patcher.patch(container.parentNode || container, '<div class="active btn"><span>x</span></div>');
    assert.ok(
      !spy.calls.includes('class'),
      'Reordering identical class tokens should not trigger a class write',
    );
    spy.restore();

    // 2. Extra whitespace: no class write.
    spy = spySetAttribute(container);
    patcher.patch(container.parentNode || container, '<div class="btn   active"><span>x</span></div>');
    assert.ok(
      !spy.calls.includes('class'),
      'Extra whitespace between identical class tokens should not trigger a class write',
    );
    spy.restore();

    // 3. Genuine class change: write happens.
    spy = spySetAttribute(container);
    patcher.patch(container.parentNode || container, '<div class="btn primary"><span>x</span></div>');
    assert.ok(spy.calls.includes('class'), 'A real class change should trigger a class write');
    assert.strictEqual(container.getAttribute('class'), 'btn primary', 'Class should be updated to new value');
    spy.restore();

    // 4. Duplicate tokens normalize to the same set: no write.
    spy = spySetAttribute(container);
    patcher.patch(container.parentNode || container, '<div class="primary primary btn btn"><span>x</span></div>');
    assert.ok(
      !spy.calls.includes('class'),
      'Duplicate tokens should normalize to the same class set without a write',
    );
    spy.restore();

    console.log('  ✅ DomPatcher class token equality tests passed!');
  } finally {
    teardownDOMMock();
  }
}

function testClassRemovalStillWorks() {
  console.log('🧪 Testing DomPatcher class attribute removal...');
  setupDOMMock();

  try {
    const patcher = new DomPatcher();
    const container = patchContainer(patcher, '<div class="btn active"><span>x</span></div>');
    patcher.patch(container.parentNode || container, '<div><span>x</span></div>');

    assert.strictEqual(
      container.hasAttribute('class'),
      false,
      'Class attribute should be removed when absent from the new markup',
    );

    console.log('  ✅ DomPatcher class removal test passed!');
  } finally {
    teardownDOMMock();
  }
}

try {
  testClassTokenEqualitySkipsRedundantWrites();
  testClassRemovalStillWorks();
  console.log('✅ domPatch class-token comparison tests passed!');
} catch (err) {
  console.error('❌ domPatch class-token comparison tests FAILED:', err.message);
  process.exitCode = 1;
}
