import test from 'node:test';
import assert from 'node:assert';
import '../helpers/register-happy-dom.js';

import { DeferManager } from '../../lib/core/renderer/deferManager.js';
import { TemplateRenderer } from '../../lib/core/renderer/renderTemplate.js';
import { DynamicEvaluator } from '../../lib/core/security/evaluator.js';
import { EventBinder } from '../../lib/core/events/bindEvents.js';

test('DeferManager runtime deferred loading', async (t) => {
  const evaluator = new DynamicEvaluator();
  const renderer = new TemplateRenderer();
  const eventBinder = new EventBinder();

  await t.test('initializes placeholder and swaps on interaction trigger', () => {
    const deferManager = new DeferManager(evaluator, renderer, eventBinder);
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-ax-defer="true" data-ax-defer-when="interaction" id="container">
        <template data-ax-defer-placeholder><span id="ph">Placeholder Content</span></template>
        <template data-ax-defer-content><div id="real">Real Content</div></template>
      </div>
    `.trim();

    deferManager.process(root, {}, {});

    const container = root.querySelector('#container');
    assert.strictEqual(container.querySelector('#ph') !== null, true, 'Placeholder should be initially rendered');
    assert.strictEqual(container.querySelector('#real'), null, 'Deferred content should not be rendered yet');
    assert.strictEqual(deferManager.isLoaded(container), false);

    // Simulate click interaction
    container.dispatchEvent(new Event('click'));

    assert.strictEqual(deferManager.isLoaded(container), true);
    assert.strictEqual(container.querySelector('#real') !== null, true, 'Real content should be mounted');
    assert.strictEqual(container.querySelector('#ph'), null, 'Placeholder should be removed');
  });

  await t.test('loads deferred content on timer trigger', async () => {
    const deferManager = new DeferManager(evaluator, renderer, eventBinder);
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-ax-defer="true" data-ax-defer-when="timer(20)" id="container">
        <template data-ax-defer-placeholder><span id="ph">Waiting...</span></template>
        <template data-ax-defer-content><div id="real">Timer Loaded</div></template>
      </div>
    `.trim();

    deferManager.process(root, {}, {});

    const container = root.querySelector('#container');
    assert.strictEqual(container.querySelector('#ph') !== null, true);
    assert.strictEqual(deferManager.isLoaded(container), false);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(deferManager.isLoaded(container), true);
    assert.strictEqual(container.querySelector('#real') !== null, true);
  });

  await t.test('loads deferred content on reactive condition trigger', () => {
    const deferManager = new DeferManager(evaluator, renderer, eventBinder);
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-ax-defer="true" data-ax-defer-when="state.isReady" id="container">
        <template data-ax-defer-placeholder><span id="ph">Not Ready</span></template>
        <template data-ax-defer-content><div id="real">Ready Now</div></template>
      </div>
    `.trim();

    // First process with isReady = false
    deferManager.process(root, {}, { isReady: false });
    const container = root.querySelector('#container');
    assert.strictEqual(container.querySelector('#ph') !== null, true);
    assert.strictEqual(deferManager.isLoaded(container), false);

    // Second process with isReady = true
    deferManager.process(root, {}, { isReady: true });
    assert.strictEqual(deferManager.isLoaded(container), true);
    assert.strictEqual(container.querySelector('#real') !== null, true);
  });

  await t.test('loads deferred content on idle trigger', async () => {
    const deferManager = new DeferManager(evaluator, renderer, eventBinder);
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-ax-defer="true" data-ax-defer-when="idle" id="container">
        <template data-ax-defer-content><div id="real">Idle Loaded</div></template>
      </div>
    `.trim();

    deferManager.process(root, {}, {});
    const container = root.querySelector('#container');

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(deferManager.isLoaded(container), true);
    assert.strictEqual(container.querySelector('#real') !== null, true);
  });
});
