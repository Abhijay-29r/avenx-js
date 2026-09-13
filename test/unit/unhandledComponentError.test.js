/**
 * An error must never become an empty component.
 *
 * `#reportError` walks the parent chain looking for `onErrorCaptured`, then
 * hands what is left to `AvenxApp._handleError`. That method iterated the
 * registered error handlers -- and an application that registers none is the
 * default, because `avenx init` does not write an `onError` call and nothing
 * requires one.
 *
 * So the loop body never ran, the error was dropped, and the component was
 * left with whatever the failed render had produced: nothing. A blank page
 * with no exception, no console output and no warning is the worst diagnostic
 * a framework can give, and it is how a broken rendering path stayed invisible.
 *
 * These tests hold the floor: an unhandled error is always reported somewhere a
 * developer can see it, and registering a handler still suppresses the default.
 */
import test from 'node:test';
import assert from 'node:assert';
import '../helpers/register-happy-dom.js';

import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

/**
 * Builds a component class whose render throws.
 * @param {string} message - The error message to throw.
 * @returns {Function} The component class.
 */
function explodingComponent(message) {
  return class Boom extends AvenxComponent {
    /**
     * @param {object} bridges - Bridges.
     * @param {object} props - Props.
     */
    constructor(bridges, props) {
      super({ n: 1 }, {}, bridges, '<div><p>never rendered</p></div>', {}, props, {}, {}, {});
    }

    /**
     * @returns {string} Never returns.
     */
    render() {
      throw new Error(message);
    }
  };
}

/**
 * Captures everything the logger reports while running a function.
 * @param {Function} run - The function to run.
 * @returns {Promise<string[]>} The captured messages.
 */
async function captureLogger(run) {
  const captured = [];
  const original = { error: console.error, warn: console.warn };
  console.error = (...args) => captured.push(args.join(' '));
  console.warn = (...args) => captured.push(args.join(' '));
  logger.configure({ level: 'error' });
  try {
    await run();
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    console.error = original.error;
    console.warn = original.warn;
  }
  return captured;
}

test('an unhandled component error reaches the developer', async (t) => {
  await t.test('is reported when the application registers no error handler', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = new AvenxApp({ target: '#app' });
    app.register('Boom', explodingComponent('render exploded'));

    const captured = await captureLogger(() => app.mount('Boom'));

    assert.ok(
      captured.some((line) => line.includes('render exploded')),
      `the thrown message should be reported; captured: ${JSON.stringify(captured)}`,
    );
  });

  await t.test('names the component and the origin so the report is actionable', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = new AvenxApp({ target: '#app' });
    app.register('Boom', explodingComponent('boom two'));

    const captured = await captureLogger(() => app.mount('Boom'));
    const report = captured.join('\n');

    assert.ok(report.includes('Boom'), `the report should name the component; got: ${report}`);
    assert.ok(report.includes('runUpdate'), `the report should name the origin; got: ${report}`);
  });

  await t.test('is reported when no application is reachable at all', async () => {
    // `$app` walks the parent chain and then the DOM. A component mounted on
    // its own reaches neither, which used to end #reportError with nothing
    // done -- the second way an error could disappear.
    document.body.innerHTML = '<div id="solo"></div>';
    const Boom = explodingComponent('no app here');
    const instance = new Boom({}, {});

    const captured = await captureLogger(() => instance.mount(document.querySelector('#solo')));

    assert.ok(
      captured.some((line) => line.includes('no app here')),
      `an app-less component should still report; captured: ${JSON.stringify(captured)}`,
    );
  });

  await t.test('stays silent when the application handles the error itself', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = new AvenxApp({ target: '#app' });
    const seen = [];
    app.onError((error, component, origin) => {
      seen.push({ message: error.message, component: component?.constructor?.name, origin });
    });
    app.register('Boom', explodingComponent('handled here'));

    const captured = await captureLogger(() => app.mount('Boom'));

    assert.strictEqual(seen.length, 1, 'the registered handler should receive the error');
    assert.strictEqual(seen[0].message, 'handled here');
    assert.strictEqual(seen[0].component, 'Boom');
    assert.ok(
      !captured.some((line) => line.includes('handled here')),
      `a handled error should not also be logged by default; captured: ${JSON.stringify(captured)}`,
    );
  });
});
