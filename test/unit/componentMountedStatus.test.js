import assert from 'assert';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';

(async () => {
  try {
    setupDOMMock();

    class StatusComp extends AvenxComponent {
      constructor() {
        super({ n: 1 }, {}, {}, `<div>{{state.n}}</div>`, {});
      }
    }

    const comp = new StatusComp();
    assert.strictEqual(comp.$isMounted, false);
    assert.strictEqual(comp.$isUnmounted, false);

    const host = document.createElement('div');
    comp.mount(host);
    assert.strictEqual(comp.$isMounted, true);
    assert.strictEqual(comp.$isUnmounted, false);

    comp.unmount();
    assert.strictEqual(comp.$isMounted, false);
    assert.strictEqual(comp.$isUnmounted, true);

    teardownDOMMock();
    console.log('✅ $isMounted / $isUnmounted getters tests passed');
    process.exit(0);
  } catch (err) {
    teardownDOMMock();
    console.error('❌ $isMounted / $isUnmounted getters failed:', err);
    process.exit(1);
  }
})();
