/**
 * @file listRowEventRefresh.test.js
 * @description A list row that carries an event handler must still be removed
 * when its item leaves the list.
 *
 * `TemplateInstance.refresh()` walked every binding and set `watcher.dirty`.
 * An event op has no watcher -- `#createBinding` attaches the listener once and
 * returns before one is created -- so the walk threw `TypeError: Cannot set
 * properties of null`.
 *
 * `ForBinding.update()` calls `refresh()` on a reused row whose locals changed,
 * and it does so *between* moving the reused rows and disposing the stale ones.
 * The throw therefore aborted reconciliation at exactly the point where the
 * removals happen: the surviving rows were reordered correctly, every removed
 * row stayed in the DOM, and `entries` was never updated. Nothing was reported.
 *
 * Measured in a browser before the fix, on a three-item list filtered to one:
 * the heading read "Tasks (1)" while all three rows were still on screen.
 *
 * The existing list tests did not catch it because none of their row templates
 * has a handler -- which is the shape every real list has, since a row is where
 * the delete button and the toggle live.
 */
import assert from 'assert';
import { TemplateInstance } from '../../lib/core/renderer/program/TemplateInstance.js';
import { buildTemplateIR } from '../../lib/compiler/ir/build.js';
import { lowerToProgram } from '../../lib/compiler/ir/lower.js';
import { StateFactory } from '../../lib/core/reactive/createState.js';
import { nextTick } from '../../lib/core/reactive/scheduler.js';

/**
 * Compiles a template and mounts it against a plain reactive state object.
 * @param {string} template - Template source.
 * @param {object} state - Initial state.
 * @returns {{host: Element, instance: TemplateInstance, state: object, statements: number[]}} The mount.
 */
function mount(template, state = {}) {
  const built = buildTemplateIR(template, {});
  assert.strictEqual(built.refusal, null, `template did not compile: ${built.refusal && built.refusal.detail}`);
  const lowered = lowerToProgram(built.ir, {});
  assert.strictEqual(lowered.refusal, null, `template did not lower: ${lowered.refusal && lowered.refusal.detail}`);

  const reactive = new StateFactory().create(state);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const statements = [];

  const instance = new TemplateInstance(lowered.program, {
    program: lowered.program,
    evaluate: (index, locals) => {
      const path = lowered.expressions[index].trim().split('.');
      let value = locals && path[0] in locals ? locals : reactive;
      for (const part of path) {
        if (value === null || value === undefined) return undefined;
        value = value[part];
      }
      return value;
    },
    runStatement: (index) => statements.push(index),
    jobId: 1,
  });

  host.appendChild(instance.create());
  return { host, instance, state: reactive, statements };
}

/**
 * Reads the rendered row labels.
 * @param {Element} host - The mount point.
 * @returns {string[]} One entry per rendered row.
 */
const rows = (host) => [...host.querySelectorAll('li')].map((li) => li.textContent.replace('x', '').trim());

try {
  console.log('🧪 Testing list rows that carry an event handler...');

  // 1. The direct failure: refreshing an instance that has an event op.
  {
    const { instance } = mount('<div><button @click="go()">x</button><p>{{ label }}</p></div>', { label: 'a' });
    assert.doesNotThrow(
      () => instance.refresh(),
      'refresh() must skip bindings that have no watcher, as dispose() does',
    );
    console.log('  ✅ refresh() tolerates an event binding');
  }

  // 2. The behaviour that broke: rows leaving a list that has handlers.
  {
    const template =
      '<ul><@for item in items key="item.id">' +
      '<li><button @click="remove()">x</button>{{ item.label }}</li>' +
      '</@for></ul>';
    const items = [
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
      { id: 3, label: 'three' },
    ];
    const { host, state } = mount(template, { items });
    assert.deepStrictEqual(rows(host), ['one', 'two', 'three'], 'all three rows render');

    // Keep the middle item only. It survives, so it is reused -- and its index
    // changes from 1 to 0, which is what makes ForBinding refresh it.
    state.items = [items[1]];
    await nextTick();
    assert.deepStrictEqual(rows(host), ['two'], 'the rows whose items left the list are removed');

    // And the list keeps reconciling correctly afterwards, which it could not
    // when `entries` was left holding ranges that no longer matched the DOM.
    state.items = [items[0], items[2]];
    await nextTick();
    assert.deepStrictEqual(rows(host), ['one', 'three'], 'the list still reconciles after a removal');

    state.items = [];
    await nextTick();
    assert.deepStrictEqual(rows(host), [], 'emptying the list removes every row');
  }
  console.log('  ✅ rows with handlers are removed when their items leave');

  // 3. The handlers on the surviving rows still work, so the fix did not buy
  //    correctness by dropping the listeners.
  {
    const template =
      '<ul><@for item in items key="item.id">' +
      '<li><button @click="remove()">x</button>{{ item.label }}</li>' +
      '</@for></ul>';
    const items = [
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
    ];
    const { host, state, statements } = mount(template, { items });
    state.items = [items[1]];
    await nextTick();

    const button = host.querySelector('li button');
    button.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.strictEqual(statements.length, 1, 'the surviving row\'s handler still fires');
    console.log('  ✅ the surviving rows keep working handlers');
  }

  console.log('List row event refresh tests passed!');
} catch (error) {
  console.error('List row event refresh tests failed!');
  console.error(error);
  process.exit(1);
}
