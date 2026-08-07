import assert from 'assert';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

const mockElement = {
  innerHTML: '',
  querySelector: () => null,
  querySelectorAll: () => [],
  dispatchEvent: () => {},
  attributes: [],
  hasAttribute: () => false,
  setAttribute: () => {},
  removeAttribute: () => {},
  appendChild: () => {},
  removeChild: () => {},
  replaceWith: () => {},
  childNodes: [],
  __avenx_comp_instance: null,
};

global.document = {
  querySelector: () => mockElement,
};

global.DOMParser = class {
  parseFromString() {
    return { body: mockElement };
  }
};

global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

(async () => {
  try {
    console.log('🧪 Testing $nextTick...');

    const comp = new AvenxComponent({ n: 0 }, {}, {}, '<div>{{state.n}}</div>', {});
    comp.__setMountTarget(mockElement);
    comp.__afterMount();

    let callbackRan = false;
    comp.state.n = 1;
    comp.$nextTick(() => {
      callbackRan = true;
    });

    assert.strictEqual(callbackRan, false, 'callback must not run synchronously');
    await comp.$nextTick();
    assert.strictEqual(callbackRan, true, 'callback must run after flush');

    // Alias still works
    let aliasRan = false;
    await comp.nextTick(() => {
      aliasRan = true;
    });
    // nextTick with callback returns void; wait one more tick to ensure flush completed
    await comp.$nextTick();
    assert.strictEqual(aliasRan, true, 'nextTick alias must invoke callback after flush');

    console.log('✅ $nextTick tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ $nextTick tests failed:', err);
    process.exit(1);
  }
})();
