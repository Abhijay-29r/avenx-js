import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { setupDOMMock, teardownDOMMock, MockDOMElement } from '../helpers/dom-mock.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

async function runTests() {
  console.log('🧪 Testing Runtime Custom Directives API in AvenxApp...');

  setupDOMMock();

  try {
    // 1. Verify app.directive registration API
    console.log('  Testing app.directive registration API...');
    const app = new AvenxApp({ target: 'div' });
    let mountedCalled = false;
    let updatedCalled = false;
    let unmountedCalled = false;
    let mountedEl = null;
    let mountedBinding = null;
    let updatedBinding = null;
    let unmountedBinding = null;

    app.directive('custom-test', {
      mounted(el, binding) {
        mountedCalled = true;
        mountedEl = el;
        mountedBinding = binding;
      },
      updated(el, binding) {
        updatedCalled = true;
        updatedBinding = binding;
      },
      unmounted(el, binding) {
        unmountedCalled = true;
        unmountedBinding = binding;
      }
    });

    let sameValueUpdatedCalls = 0;

    app.directive('same-value-test', {
      mounted() {},
      updated() {
        sameValueUpdatedCalls++;
      }
    });

    assert.ok(app.directives.has('custom-test'), 'custom-test directive should be registered in app.directives');

    // 2. Verify focus directive makes the target input gain focus upon load
    console.log('  Testing focus directive target focus on load...');
    let focusCalled = false;
    app.directive('focus', {
      mounted(el) {
        el.focus = () => {
          focusCalled = true;
        };
        el.focus();
      }
    });

    class FocusComponent extends AvenxComponent {
      constructor() {
        super({});
      }
      render() {
        return '<input data-ax-focus></input>';
      }
    }

    app.register('FocusComponent', FocusComponent);
    app.mount('FocusComponent', 'div');

    assert.ok(focusCalled, 'The focus hook should be called and input should gain focus');

    // 3. Verify custom directive lifecycle (mounted, updated, unmounted) and bindings
    console.log('  Testing custom-test directive lifecycle hooks...');
    class LifecycleComponent extends AvenxComponent {
      constructor() {
        super({ stateVal: 'initial' });
      }
      render() {
        return `<div data-ax-custom-test="stateVal">Text</div>`;
      }
    }

    class SameValueComponent extends AvenxComponent {
      constructor() {
        super({ stateVal: 'same-value' });
      }

      render() {
        return `<div data-ax-same-value-test="stateVal">Text</div>`;
      }
    }

    const sameValueComp = new SameValueComponent({});
    sameValueComp.$app = app;

    const sameValueTarget = new MockDOMElement('div');
    sameValueComp.mount(sameValueTarget);

    // Assign the same value again
    sameValueComp.state.stateVal = 'same-value';

    // Wait for the batched update
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(
      sameValueUpdatedCalls,
      0,
      'updated hook should not be called when directive value remains unchanged'
    );

    const lifeComp = new LifecycleComponent({});
    lifeComp.$app = app;

    const targetEl = new MockDOMElement('div');
    lifeComp.mount(targetEl);

    assert.ok(mountedCalled, 'mounted hook should have been called');
    assert.strictEqual(mountedEl.tagName, 'DIV');
    assert.deepStrictEqual(mountedBinding, { value: 'initial', expression: 'stateVal' });

    // Update stateVal to trigger updated hook
    lifeComp.state.stateVal = 'updated-value';
    // Wait for batch update
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.ok(updatedCalled, 'updated hook should have been called when bound value shifts');
    assert.deepStrictEqual(updatedBinding, { value: 'updated-value', oldValue: 'initial', expression: 'stateVal' });

    // Unmount component to trigger unmounted hook
    lifeComp.unmount();
    assert.ok(unmountedCalled, 'unmounted hook should have been called');
    assert.deepStrictEqual(unmountedBinding, { value: 'updated-value', oldValue: 'updated-value', expression: 'stateVal' });

    // 4. Verify compiler template checks reject undeclared identifiers in custom directives
    console.log('  Testing compiler validation for custom directives...');
    const cp = new ComponentParser(new StyleProcessor());
    const tempFile = path.join(__dirname, 'TempCustomDirComp.component.js');

    const tempContent = `
      <div data-ax-custom-test="undeclaredCustomVar">Hello</div>
    `;
    fs.writeFileSync(tempFile, tempContent, 'utf-8');

    let loggedWarning = false;
    const originalLoggerWarn = logger.warn;
    logger.warn = (msg) => {
      if (msg.includes('Undeclared variable') && msg.includes('undeclaredCustomVar')) {
        loggedWarning = true;
      }
    };

    cp.parse(tempFile, 'TempCustomDirComp');

    // Restore logger and clean up
    logger.warn = originalLoggerWarn;
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

    assert.ok(loggedWarning, 'Compiler should warn about undeclared variables inside custom directives');

    console.log('  ✅ Custom Directives unit tests successfully passed!');
  } catch (error) {
    console.error('❌ Custom Directives tests failed!');
    console.error(error);
    process.exit(1);
  } finally {
    teardownDOMMock();
  }
}

runTests();
