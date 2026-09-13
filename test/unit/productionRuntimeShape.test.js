/**
 * What a component does in a process shaped like a production bundle.
 *
 * @avenx-no-dev-runtime
 *
 * Every other test file in this suite runs with the expression interpreter and
 * the string renderer installed by the runner, because a test builds components
 * directly and nothing compiled their expressions. That is a reasonable default
 * and it has one expensive consequence: no test could observe what happens when
 * those capabilities are *absent*, which is the shape every `avenx build`
 * output has unless the build decided otherwise.
 *
 * A component whose template the IR refused, in a bundle that did not link the
 * string renderer, used to throw an error that nothing reported -- and the
 * result was a mounted, empty element with a clean console. A full green suite
 * could not see it, because no process in the suite had that shape.
 *
 * This file declares the marker above and runs bare. It asserts the two
 * properties that make the condition survivable: it is raised as its own
 * diagnostic, and it is reported rather than swallowed.
 */
import assert from 'assert';
import { Window } from 'happy-dom';
import { hasStringRenderer } from '../../lib/core/renderer/stringRenderer.js';
import { AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';

console.log('🧪 Testing runtime behaviour without the development runtime...');

// The premise of the file. If the runner ever installs the dev runtime here
// again, every assertion below becomes vacuous, so this is checked rather than
// assumed.
assert.strictEqual(
  hasStringRenderer(),
  false,
  'this file declares @avenx-no-dev-runtime and must run without the string renderer installed',
);
console.log('  ✅ the process is shaped like a production bundle');

const window = new Window({ url: 'http://localhost/' });
globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.CustomEvent = window.CustomEvent;
globalThis.Event = window.Event;
globalThis.DOMParser = window.DOMParser;

const { AvenxApp } = await import('../../lib/core/runtime/AvenxApp.js');
const { AvenxComponent } = await import('../../lib/core/runtime/AvenxComponent.js');
const { logger } = await import('../../lib/core/runtime/AvenxLogger.js');

/** A component with no render program, so it needs the renderer that is absent. */
class Uncompiled extends AvenxComponent {
  /**
   * @param {object} bridges - Bridges.
   * @param {object} props - Props.
   */
  constructor(bridges, props) {
    super({ n: 1 }, {}, bridges, '<div><p>text</p></div>', {}, props, {}, {}, {});
  }
}

document.body.innerHTML = '<div id="app"></div>';

const captured = [];
const originalError = console.error;
console.error = (...args) => captured.push(args.join(' '));
logger.configure({ level: 'error' });

try {
  const app = new AvenxApp({ target: '#app' });
  app.register('Uncompiled', Uncompiled);
  app.mount('Uncompiled');
  await new Promise((resolve) => setTimeout(resolve, 30));
} finally {
  console.error = originalError;
}

const report = captured.join('\n');

// The failure must be visible. This is the assertion that would have failed
// before the fix: the element was empty and `captured` was empty too.
assert.ok(
  report.length > 0,
  'a component that cannot render must report something; a silent empty element is the defect this file exists for',
);
console.log('  ✅ a component that cannot render reports rather than going quiet');

assert.ok(
  report.includes(AvenxErrorCodes.RENDERER_UNAVAILABLE) || report.includes(AvenxErrorCodes.COMPONENT_RENDER_ABORTED),
  `the report should carry AVX_R34 or AVX_R33; got: ${report}`,
);
console.log('  ✅ the report carries a diagnostic code a developer can look up');

assert.ok(report.includes('Uncompiled'), `the report should name the component; got: ${report}`);
console.log('  ✅ the report names the component that failed');

console.log('✅ All production-shape runtime tests passed!');
