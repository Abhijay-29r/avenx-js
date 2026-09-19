/**
 * @file atlasNoReachablePage.test.js
 * @description AVX_W53 -- the application that compiles pages and renders none.
 *
 * `avenx init` scaffolds a main.app.js that constructs an AvenxApp and stops
 * there, and `avenx generate page` tells the developer the page "will be
 * automatically registered and routed if you update src/main.app.js" without
 * updating it. The result compiles, bundles, exits 0, and renders an empty
 * container with nothing in the console. That is the first thing a new user
 * sees, so the build has to say it.
 *
 * The rule is all-or-nothing on purpose, and most of this file is about the
 * cases where it must stay silent: a routed application, one that mounts a
 * page directly, one with no pages, and one whose entry point was never read.
 */

import assert from 'assert';
import { AppModel, AtlasNodeKind, AtlasEdgeKind, Confidence, nodeId } from '../../lib/compiler/atlas/AppModel.js';
import { findNoReachablePage, reportAtlasDiagnostics } from '../../lib/compiler/atlas/diagnostics.js';

/**
 * Builds a model with the given pages and entry-point facts.
 * @param {object} options - Fixture options.
 * @param {string[]} [options.pages] - Page names to add.
 * @param {string|null} [options.entryFile] - The entry file, or null for none.
 * @param {boolean} [options.mountsDirectly] - Whether the entry calls mountPage.
 * @param {string[]} [options.routes] - Route patterns to add.
 * @returns {AppModel} The model.
 */
function modelWith({ pages = [], entryFile = 'src/main.app.js', mountsDirectly = false, routes = [] } = {}) {
  const model = new AppModel();
  for (const name of pages) {
    model.addNode({ id: nodeId(AtlasNodeKind.PAGE, null, name), kind: AtlasNodeKind.PAGE, name });
  }
  for (const pattern of routes) {
    const id = nodeId(AtlasNodeKind.ROUTE, null, pattern);
    model.addNode({ id, kind: AtlasNodeKind.ROUTE, name: pattern, pattern });
    if (pages.length > 0) {
      model.addEdge({
        from: id,
        to: nodeId(AtlasNodeKind.PAGE, null, pages[0]),
        kind: AtlasEdgeKind.ROUTES_TO,
        confidence: Confidence.CERTAIN,
      });
    }
  }
  model.entry = { file: entryFile, mountsDirectly };
  return model;
}

console.log('Testing AVX_W53 (no reachable page)...');

// --- fires on the scaffolded shape --------------------------------------
{
  const finding = findNoReachablePage(modelWith({ pages: ['Home'] }));
  assert.ok(finding, 'a page with no route and no mount must be reported');
  assert.deepStrictEqual(finding.pages.map((p) => p.name), ['Home']);
  assert.strictEqual(finding.entryFile, 'src/main.app.js');
  console.log('  ✅ fires when pages exist but nothing routes or mounts them');
}

// --- names every page, sorted -------------------------------------------
{
  const finding = findNoReachablePage(modelWith({ pages: ['Profile', 'About', 'Home'] }));
  assert.deepStrictEqual(
    finding.pages.map((p) => p.name),
    ['About', 'Home', 'Profile'],
    'pages are listed in a stable order so the message does not churn',
  );
  console.log('  ✅ lists every page in a stable order');
}

// --- silent when a route exists -----------------------------------------
{
  assert.strictEqual(
    findNoReachablePage(modelWith({ pages: ['Home'], routes: ['/'] })),
    null,
    'a routed application renders; nothing to report',
  );
  console.log('  ✅ silent when a route table exists');
}

// --- silent when a route exists but names a different page ---------------
{
  // The route resolves to nothing, which is AVX_W46's and the unresolved
  // record's business. This rule only claims "no way to render at all", and a
  // declared route is a way, however broken.
  assert.strictEqual(
    findNoReachablePage(modelWith({ pages: ['Home'], routes: ['/other'] })),
    null,
    'a declared route, even a wrong one, is not this diagnostic',
  );
  console.log('  ✅ silent when a route exists but resolves elsewhere');
}

// --- silent when the entry mounts a page directly ------------------------
{
  assert.strictEqual(
    findNoReachablePage(modelWith({ pages: ['Home'], mountsDirectly: true })),
    null,
    'app.mountPage() is a supported way to render without a router',
  );
  console.log('  ✅ silent when the entry point calls mountPage');
}

// --- silent when there are no pages --------------------------------------
{
  assert.strictEqual(
    findNoReachablePage(modelWith({ pages: [] })),
    null,
    'an application with no pages has nothing to route',
  );
  console.log('  ✅ silent when the project has no pages');
}

// --- silent when the entry point was never read --------------------------
{
  assert.strictEqual(
    findNoReachablePage(modelWith({ pages: ['Home'], entryFile: null })),
    null,
    'concluding "nothing is routed" from a file that was never read is the ' +
      'inference this module forbids',
  );
  assert.strictEqual(
    findNoReachablePage(Object.assign(modelWith({ pages: ['Home'] }), { entry: undefined })),
    null,
    'a model without entry facts must not produce a finding',
  );
  console.log('  ✅ silent when the entry point was never read');
}

// --- reported through the warning machinery ------------------------------
{
  const messages = [];
  const original = console.warn;
  console.warn = (msg) => messages.push(String(msg));
  let result;
  try {
    result = reportAtlasDiagnostics(modelWith({ pages: ['Home'] }), {});
  } finally {
    console.warn = original;
  }

  assert.strictEqual(result.noReachablePage, 1, 'the report should count the finding');
  const text = messages.join('\n');
  assert.ok(/AVX_W53/.test(text), `expected AVX_W53 in output, got:\n${text}`);
  assert.ok(/Home/.test(text), 'the message should name the page');
  // An application that calls app.mount() for a root component renders
  // something, so the finding must be about the pages being unreachable rather
  // than about the whole application being blank -- overstating it is the kind
  // of claim that teaches a developer to stop trusting the diagnostic.
  assert.ok(
    !/renders nothing/.test(text),
    `the message must not claim the whole application renders nothing:\n${text}`,
  );
  assert.ok(/can reach/.test(text), 'it should say the pages cannot be reached');
  assert.ok(/src\/main\.app\.js/.test(text), 'the message should name the entry file');
  assert.ok(
    !/\{\d\}/.test(text),
    `every placeholder must be substituted, but the message still contains one:\n${text}`,
  );
  console.log('  ✅ reported as AVX_W53 with every placeholder substituted');
}

// --- honours the warnings configuration ----------------------------------
{
  const messages = [];
  const original = console.warn;
  console.warn = (msg) => messages.push(String(msg));
  try {
    reportAtlasDiagnostics(modelWith({ pages: ['Home'] }), { warnings: { AVX_W53: 'off' } });
  } finally {
    console.warn = original;
  }
  assert.strictEqual(messages.length, 0, 'AVX_W53: "off" must silence the warning');

  assert.throws(
    () => reportAtlasDiagnostics(modelWith({ pages: ['Home'] }), { warnings: { AVX_W53: 'error' } }),
    /AVX_W53/,
    'AVX_W53: "error" must fail the build',
  );
  console.log('  ✅ honours "off" and "error" in avenx.config.json');
}

console.log('✅ AVX_W53 tests passed!');
