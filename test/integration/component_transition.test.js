import assert from 'assert';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';

class MockDOMElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.childNodes = [];
    this.innerHTML = '';
    this.parentNode = null;
    this._transitionName = null;
    this.nodeType = 1; // Node.ELEMENT_NODE
  }
  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
  }
  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
  }
  insertBefore(newChild, refChild) {
    newChild.parentNode = this;
    const idx = this.childNodes.indexOf(refChild);
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, newChild);
    } else {
      this.childNodes.push(newChild);
    }
  }
  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
  querySelectorAll() {
    return [];
  }
  hasAttribute() {
    return false;
  }
  setAttribute() {}
  removeAttribute() {}
  dispatchEvent() {}
}

(async () => {
  try {
    console.log('🧪 Testing Component Transition Lifecycle Hooks...');

    global.DOMParser = class {
      parseFromString() {
        return { body: new MockDOMElement('div') };
      }
    };
    global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

    // Setup simple document mock
    const appRoot = new MockDOMElement('div');
    global.document = {
      querySelector: () => appRoot,
      querySelectorAll: () => [],
    };

    let hashListeners = [];
    global.window = {
      addEventListener: (event, cb) => {
        if (event === 'hashchange') hashListeners.push(cb);
      },
      removeEventListener: (event, cb) => {
        if (event === 'hashchange') hashListeners = hashListeners.filter((l) => l !== cb);
      },
      location: {
        _hash: '',
        get hash() {
          return this._hash;
        },
        set hash(val) {
          this._hash = val;
          hashListeners.forEach((listener) => listener());
        },
      },
    };

    // Test Case 1: Transition Hooks Firing and Delayed Promise Blocking
    await (async () => {
      let enterCalled = false;
      let beforeLeaveCalled = false;
      let leaveCalled = false;
      let resolveBeforeLeave;
      const beforeLeavePromise = new Promise((resolve) => {
        resolveBeforeLeave = resolve;
      });

      class TransitionComponent extends AvenxComponent {
        constructor(bridges, props) {
          super({}, {}, bridges, '<div>Test</div>', {}, props);
        }
        onEnter() {
          enterCalled = true;
        }
        onBeforeLeave() {
          beforeLeaveCalled = true;
          return beforeLeavePromise;
        }
        onLeave() {
          leaveCalled = true;
        }
      }

      const parentEl = new MockDOMElement('div');
      const childEl = new MockDOMElement('div');
      parentEl.appendChild(childEl);

      const comp = new TransitionComponent({});
      comp.mount(childEl);

      assert.strictEqual(enterCalled, true, 'onEnter should be called upon mount');
      assert.strictEqual(beforeLeaveCalled, false, 'onBeforeLeave should not be called yet');

      const unmountPromise = comp.unmount();
      assert.strictEqual(beforeLeaveCalled, true, 'onBeforeLeave should be called upon unmount');
      assert.strictEqual(leaveCalled, false, 'onLeave should not be called before Promise resolves');
      assert.ok(unmountPromise instanceof Promise, 'unmount should return a Promise');

      // Resolve the promise
      resolveBeforeLeave();
      await unmountPromise;

      assert.strictEqual(leaveCalled, true, 'onLeave should be called after Promise resolves');
    })();

    // Test Case 2: Page transition delay in AvenxApp
    await (async () => {
      let resolvePageLeave;
      const pageLeavePromise = new Promise((resolve) => {
        resolvePageLeave = resolve;
      });

      let page1LeaveHookCalled = false;
      let page2EnterHookCalled = false;

      class Page1 extends AvenxPage {
        constructor(bridges, componentRegistry) {
          super({}, {}, bridges, '<div>Page 1</div>', {}, componentRegistry);
        }
        onBeforeLeave() {
          page1LeaveHookCalled = true;
          return pageLeavePromise;
        }
      }

      class Page2 extends AvenxPage {
        constructor(bridges, componentRegistry) {
          super({}, {}, bridges, '<div>Page 2</div>', {}, componentRegistry);
        }
        onEnter() {
          page2EnterHookCalled = true;
        }
      }

      const app = new AvenxApp({ target: '#app' });
      app.registerPage('Page1', Page1);
      app.registerPage('Page2', Page2);

      app.initRouter({
        '#/page1': 'Page1',
        '#/page2': 'Page2',
      });

      window.location.hash = '#/page1';
      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(app.activePage instanceof Page1, 'Active page should be Page1');

      window.location.hash = '#/page2';
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Page 1 is unmounting, but pageLeavePromise is still pending
      assert.strictEqual(page1LeaveHookCalled, true, 'onBeforeLeave hook on Page1 should be called');
      assert.ok(app.activePage instanceof Page1, 'Active page should still be Page1 due to delay');
      assert.strictEqual(page2EnterHookCalled, false, 'Page2 should not have entered yet');

      // Resolve Page 1 leave Promise
      resolvePageLeave();
      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(app.activePage instanceof Page2, 'Active page should transition to Page2 after resolution');
      assert.strictEqual(page2EnterHookCalled, true, 'Page2 onEnter hook should be called after transition');
    })();

    console.log('  ✅ Component Transition Lifecycle Hooks tests passed!');
  } catch (error) {
    console.error('❌ Component Transition Lifecycle Hooks tests failed!');
    console.error(error);
    process.exit(1);
  }
})();
