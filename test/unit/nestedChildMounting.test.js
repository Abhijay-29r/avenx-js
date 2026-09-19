/**
 * @file nested_child_mounting.test.js
 * @description A component inside a component mounts however its host appeared.
 *
 * `AvenxPage#mountChildComponents` scans the page's subtree for
 * `[data-avenx-comp]` hosts. Mounting a child renders its template, which can
 * introduce hosts of its own -- a component nested inside a component -- and
 * those did not exist in the DOM while the scan was collecting mount points.
 * One pass therefore reached exactly one level below whatever was already
 * rendered.
 *
 * Deeper levels arrived by luck. A page that happened to run another pass
 * picked them up, so a grandchild rendered when its list was in the initial
 * `<state>` and never rendered when the same list was assigned in `onMount` --
 * which is the most ordinary shape there is: fetch on mount, render a list of
 * components that contain components.
 *
 * The failure was silent in every channel that could have caught it. The build
 * was clean, `avenx check` passed, the browser console was empty, and the
 * content was simply absent. Development and production agreed, so comparing
 * them proved nothing either.
 */

import assert from 'assert';
import { Window } from 'happy-dom';

// A real DOM: this test is about what `querySelectorAll` finds in a subtree
// after a child has rendered into it, which the lightweight mock cannot model.
const win = new Window();
globalThis.window = win;
globalThis.document = win.document;
globalThis.DOMParser = win.DOMParser;
globalThis.Node = win.Node;
globalThis.HTMLElement = win.HTMLElement;

const { AvenxApp } = await import('../../lib/core/runtime/AvenxApp.js');
const { AvenxPage } = await import('../../lib/core/runtime/AvenxPage.js');
const { AvenxComponent } = await import('../../lib/core/runtime/AvenxComponent.js');

console.log('🧪 Testing nested child component mounting...');

document.body.innerHTML = '<div id="app"></div>';

// These mirror the constructor the compiler emits for a component --
// `constructor(bridges, props)` calling super with props in sixth position --
// so the test exercises the same shape AvenxPage instantiates.

/** A grandchild: rendered only by its parent component's template. */
class Inner extends AvenxComponent {
  constructor(bridges, props) {
    super({}, {}, bridges, '', {}, props, {}, {}, {});
  }

  render() {
    return `<span data-testid="inner">INNER:${this.props.label ?? ''}</span>`;
  }
}

/** A child that renders a grandchild host of its own. */
class Outer extends AvenxComponent {
  constructor(bridges, props) {
    super({}, {}, bridges, '', {}, props, {}, {}, {});
  }

  render() {
    return `<div data-testid="outer"><div data-avenx-comp="Inner" data-props-label="'${this.props.tag ?? ''}'"></div></div>`;
  }
}

/** Three levels deep, to prove the pass is not simply doing two. */
class Deepest extends AvenxComponent {
  constructor(bridges, props) {
    super({}, {}, bridges, '', {}, props, {}, {}, {});
  }

  render() {
    return '<span data-testid="deepest">DEEPEST</span>';
  }
}

class Middle extends AvenxComponent {
  constructor(bridges, props) {
    super({}, {}, bridges, '', {}, props, {}, {}, {});
  }

  render() {
    return '<div data-testid="middle"><div data-avenx-comp="Deepest"></div></div>';
  }
}

class Top extends AvenxComponent {
  constructor(bridges, props) {
    super({}, {}, bridges, '', {}, props, {}, {}, {});
  }

  render() {
    return '<div data-testid="top"><div data-avenx-comp="Middle"></div></div>';
  }
}

/**
 * Builds an application with the given components registered.
 * @param {Record<string, Function>} components - Components by tag name.
 * @returns {AvenxApp} The application.
 */
function appWith(components) {
  const app = new AvenxApp({ target: '#app' });
  for (const [name, cls] of Object.entries(components)) {
    app.register(name, cls);
  }
  return app;
}

/**
 * Counts elements carrying a test id within a root.
 * @param {object} root - The root element.
 * @param {string} id - The data-testid value.
 * @returns {number} How many were found.
 */
function count(root, id) {
  return root.querySelectorAll(`[data-testid="${id}"]`).length;
}

// --- a list present at first render ------------------------------------
{
  class EagerPage extends AvenxPage {
    constructor(bridges, components) {
      super({ rows: ['a', 'b'] }, {}, bridges, '', {}, components, {}, {}, {});
    }

    render() {
      return `<ul>${this.state.rows
        .map((row) => `<div data-avenx-comp="Outer" data-props-tag="'${row}'"></div>`)
        .join('')}</ul>`;
    }
  }

  const app = appWith({ Outer, Inner });
  app.registerPage('Eager', EagerPage);
  const host = global.document.createElement('div');
  global.document.body.appendChild(host);

  const page = new EagerPage(app.bridges, app.components);
  page.$app = app;
  page.mount(host);

  assert.strictEqual(count(host, 'outer'), 2, 'both children mount');
  assert.strictEqual(count(host, 'inner'), 2, 'and so do both grandchildren');
  page.unmount();
  console.log('  ✅ a list present at first render mounts its grandchildren');
}

// --- a list assigned after mount ---------------------------------------
{
  class LatePage extends AvenxPage {
    constructor(bridges, components) {
      super({ rows: [] }, {}, bridges, '', {}, components, {}, {}, {});
    }

    render() {
      return `<ul>${this.state.rows
        .map((row) => `<div data-avenx-comp="Outer" data-props-tag="'${row}'"></div>`)
        .join('')}</ul>`;
    }
  }

  const app = appWith({ Outer, Inner });
  app.registerPage('Late', LatePage);
  const host = global.document.createElement('div');
  global.document.body.appendChild(host);

  const page = new LatePage(app.bridges, app.components);
  page.$app = app;
  page.mount(host);

  assert.strictEqual(count(host, 'outer'), 0, 'nothing is rendered yet');

  // What `onMount` does in a real application after fetching.
  page.state.rows = ['x', 'y'];
  page.update();

  assert.strictEqual(count(host, 'outer'), 2, 'the children mount on the update');
  assert.strictEqual(
    count(host, 'inner'),
    2,
    'and so must the grandchildren -- this is the defect: the host for each ' +
        'Inner does not exist until its Outer has rendered, so a single pass ' +
        'never reaches it',
  );
  page.unmount();
  console.log('  ✅ a list assigned after mount mounts its grandchildren');
}

// --- three levels, to show the pass is not hard-coded to two ------------
{
  class DeepPage extends AvenxPage {
    constructor(bridges, components) {
      super({ show: false }, {}, bridges, '', {}, components, {}, {}, {});
    }

    render() {
      return this.state.show ? '<div data-avenx-comp="Top"></div>' : '<div></div>';
    }
  }

  const app = appWith({ Top, Middle, Deepest });
  app.registerPage('Deep', DeepPage);
  const host = global.document.createElement('div');
  global.document.body.appendChild(host);

  const page = new DeepPage(app.bridges, app.components);
  page.$app = app;
  page.mount(host);

  page.state.show = true;
  page.update();

  assert.strictEqual(count(host, 'top'), 1, 'the child mounts');
  assert.strictEqual(count(host, 'middle'), 1, 'the grandchild mounts');
  assert.strictEqual(count(host, 'deepest'), 1, 'and so does the great-grandchild');
  page.unmount();
  console.log('  ✅ three levels of nesting mount on a single update');
}

// --- props still reach each level --------------------------------------
{
  class PropPage extends AvenxPage {
    constructor(bridges, components) {
      super({ rows: [] }, {}, bridges, '', {}, components, {}, {}, {});
    }

    render() {
      return `<ul>${this.state.rows
        .map((row) => `<div data-avenx-comp="Outer" data-props-tag="'${row}'"></div>`)
        .join('')}</ul>`;
    }
  }

  const app = appWith({ Outer, Inner });
  app.registerPage('Props', PropPage);
  const host = global.document.createElement('div');
  global.document.body.appendChild(host);

  const page = new PropPage(app.bridges, app.components);
  page.$app = app;
  page.mount(host);
  page.state.rows = ['alpha'];
  page.update();

  const inner = host.querySelector('[data-testid="inner"]');
  assert.ok(inner, 'the grandchild exists');
  assert.ok(
    inner.textContent.includes('alpha'),
    `the prop forwarded through the child must reach it, got "${inner.textContent}"`,
  );
  page.unmount();
  console.log('  ✅ a prop forwarded through the child reaches the grandchild');
}

// Prop *propagation* through a nested chain is covered by
// test/e2e/specs/components/composition.spec.js instead of here. It depends on
// the compiled render program raising `onChildProps` when a prop op writes to a
// child host, and the hand-written render() classes in this file never take the
// compiled path -- a test here would pass whether or not the mechanism works.

// --- repeated updates do not duplicate or churn instances ---------------
{
  class ChurnPage extends AvenxPage {
    constructor(bridges, components) {
      super({ rows: ['a'] }, {}, bridges, '', {}, components, {}, {}, {});
    }

    render() {
      return `<ul>${this.state.rows
        .map((row) => `<div data-avenx-comp="Outer" data-props-tag="'${row}'"></div>`)
        .join('')}</ul>`;
    }
  }

  const app = appWith({ Outer, Inner });
  app.registerPage('Churn', ChurnPage);
  const host = document.createElement('div');
  document.body.appendChild(host);

  const page = new ChurnPage(app.bridges, app.components);
  page.$app = app;
  page.mount(host);

  const firstInner = host.querySelector('[data-avenx-comp="Inner"]').__avenx_comp_instance;
  const firstUid = firstInner && firstInner.uid;

  for (let i = 0; i < 10; i += 1) {
    page.state.rows = [`row${i}`];
    page.update();
  }

  assert.strictEqual(count(host, 'outer'), 1, 'ten updates must not accumulate children');
  assert.strictEqual(count(host, 'inner'), 1, 'nor grandchildren');

  const lastInner = host.querySelector('[data-avenx-comp="Inner"]').__avenx_comp_instance;
  assert.strictEqual(
    lastInner && lastInner.uid,
    firstUid,
    'the instance is reused across updates rather than rebuilt, so listeners and ' +
      'subscriptions are not rebound every time',
  );
  page.unmount();
  console.log('  ✅ repeated updates reuse instances and do not duplicate them');
}

console.log('✅ Nested child component mounting tests passed!');
