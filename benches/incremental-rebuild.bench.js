import fs from 'fs';
import os from 'os';
import path from 'path';
import { performance } from 'perf_hooks';
import AvenxCompiler from '../lib/compiler.js';
import { clearIncrementalCache, incrementalCacheStats } from '../lib/compiler/incrementalCache.js';
import { clearAtlasCache } from '../lib/compiler/atlas/cache.js';

/**
 * Measures what the compilation cache saves a watch rebuild.
 *
 * The number that matters to a developer is the one between saving a file and
 * seeing the page: a rebuild after a one-line edit. That is what this measures,
 * against the cold build of the same project, at two sizes.
 *
 * Three things worth reading off the output:
 *
 * 1. **The saving on a one-file edit.** The cache can only remove the parse, so
 *    the ceiling is the parse's share of a build -- around half. A saving far
 *    below that means units are being invalidated that did not have to be; far
 *    above it means something other than the parse stopped happening, which
 *    would be a correctness question rather than a win.
 * 2. **How the saving scales.** The whole point is that rebuild cost should stop
 *    growing with project size. If the saving does not widen from the small
 *    project to the large one, it has not.
 * 3. **The hit count.** Printed alongside, because a fast rebuild that missed
 *    everything is measuring something else.
 *
 * Correctness is not measured here. `test/unit/incrementalBuild.test.js` asserts
 * the incremental output is byte-identical to a cold build; a benchmark that
 * also tried to be that test would be worse at both.
 */

/**
 * Writes a synthetic project of `count` components sharing one bridge.
 *
 * Deliberately the same shape as `atlas-build.bench.js` generates, so the two
 * benchmarks' numbers can be read against each other.
 * @param {number} count - How many components to generate.
 * @returns {string} The project root.
 */
function generateProject(count) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `avenx-incremental-bench-${count}-`));
  const src = path.join(root, 'src');
  fs.mkdirSync(path.join(src, 'bridges'), { recursive: true });
  fs.mkdirSync(path.join(src, 'pages'), { recursive: true });

  fs.writeFileSync(
    path.join(root, 'avenx.config.json'),
    JSON.stringify({ srcDir: 'src', distDir: 'dist', incremental: true }),
  );

  fs.writeFileSync(
    path.join(src, 'bridges', 'store.bridge.js'),
    `import { bridge } from 'avenx-core/runtime';

export default bridge({
  state: { items: [], total: 0 },
  get count() {
    return this.items.length;
  },
  add(v) {
    this.items.push({ v });
    this.total = this.total + v;
  },
});
`,
  );

  let tags = '';
  for (let i = 0; i < count; i++) {
    const dir = path.join(src, 'components', `comp-${i}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `comp-${i}.component.js`),
      `import store from '../../bridges/store.bridge.js';

<state a="1" b="2" label="x" />

<computed name="doubled" value="a * b" />

<action name="bump">
  state.a = state.a + 1;
  store.add(state.a);
</action>

<div @css box>
  <span @css v>{{ a }}</span>
  <span @css d>{{ doubled }}</span>
  <@for it in store.items>
    <p @css line>{{ it.v }} {{ label }}</p>
  </@for>
  <button @css go @click="bump()">go</button>
</div>
`,
    );
    fs.writeFileSync(
      path.join(dir, `comp-${i}.component.css`),
      `<@css>\nbox { padding: 1rem; }\nv { color: #333; }\nd { font-weight: 700; }\nline { margin: 0; }\ngo { padding: .4rem; }\n</@css>\n`,
    );
    tags += `  <Comp${i} />\n`;
  }

  fs.writeFileSync(path.join(src, 'pages', 'home.page.js'), `<div>\n${tags}</div>\n`);
  fs.writeFileSync(
    path.join(src, 'main.app.js'),
    `import { AvenxApp } from 'avenx-core/runtime';

const app = new AvenxApp({ target: '#app' });
app.initRouter({ '': 'Home' });
`,
  );

  return root;
}

/**
 * Runs one build and returns how long it took.
 * @param {string} root - The project root.
 * @param {boolean} watch - True to allow the compilation cache.
 * @returns {number} The duration in milliseconds.
 */
function buildOnce(root, watch) {
  const compiler = new AvenxCompiler({
    rootDir: root,
    srcDir: 'src',
    distDir: 'dist',
    watch,
    logging: { silent: true },
  });
  const start = performance.now();
  compiler.build();
  return performance.now() - start;
}

/**
 * Edits one component, the way a keystroke-triggered rebuild sees it.
 * @param {string} root - The project root.
 * @param {number} revision - Makes each edit distinct, so no edit is a no-op.
 * @returns {void}
 */
function editOneComponent(root, revision) {
  const file = path.join(root, 'src/components/comp-0/comp-0.component.js');
  fs.writeFileSync(
    file,
    fs.readFileSync(file, 'utf-8').replace(/<span @css v>\{\{ a \}\}<\/span>/, `<span @css v>{{ a }}${'!'.repeat(revision)}</span>`),
  );
}

/**
 * Fastest of several runs, to take the scheduler out of the number.
 * @param {Function} run - Returns a duration in milliseconds.
 * @param {number} runs - How many times to measure.
 * @returns {number} The fastest duration.
 */
function best(run, runs) {
  let fastest = Infinity;
  for (let i = 0; i < runs; i++) {
    fastest = Math.min(fastest, run(i));
  }
  return fastest;
}

/**
 * Measures cold and warm rebuilds for one project size.
 * @param {number} count - How many components.
 * @returns {object} The measurements.
 */
function measure(count) {
  const root = generateProject(count);

  try {
    // Cold: a fresh cache every time, which is what `avenx build` always does.
    const cold = best(() => {
      clearIncrementalCache();
      clearAtlasCache();
      return buildOnce(root, false);
    }, 3);

    // Warm: one build to fill the cache, then the rebuild a save triggers. The
    // edit is real -- a component whose text changed cannot be served from the
    // cache, so the warm number includes recompiling it.
    clearIncrementalCache();
    clearAtlasCache();
    buildOnce(root, true);

    const before = incrementalCacheStats();
    const warm = best((run) => {
      editOneComponent(root, run + 1);
      return buildOnce(root, true);
    }, 3);
    const after = incrementalCacheStats();

    return {
      count,
      cold,
      warm,
      hits: after.hits - before.hits,
      misses: after.misses - before.misses,
      coldPerComponent: cold / count,
      warmPerComponent: warm / count,
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * Runs the benchmark.
 * @returns {void}
 */
function benchmark() {
  const sizes = [50, 300];
  console.log(`Running Incremental Rebuild benchmark at ${sizes.join(' and ')} components...`);

  const results = sizes.map(measure);

  for (const result of results) {
    const saving = ((result.cold - result.warm) / result.cold) * 100;
    console.log(`\n  ${result.count} components`);
    console.log(`    cold build:      ${result.cold.toFixed(2)}ms  (${result.coldPerComponent.toFixed(3)}ms/component)`);
    console.log(`    warm rebuild:    ${result.warm.toFixed(2)}ms  (${result.warmPerComponent.toFixed(3)}ms/component)`);
    console.log(`    rebuild saving:  ${saving.toFixed(0)}%  (${(result.cold / result.warm).toFixed(2)}x faster)`);
    console.log(`    cache:           ${result.hits} hits, ${result.misses} misses across 3 rebuilds`);
  }

  // The saving should widen with project size: that is the difference between a
  // rebuild cost that grows with the project and one that does not.
  const [small, large] = results;
  const smallSaving = (small.cold - small.warm) / small.cold;
  const largeSaving = (large.cold - large.warm) / large.cold;
  console.log(
    `\n  Saving from ${small.count} to ${large.count} components: ` +
      `${(smallSaving * 100).toFixed(0)}% → ${(largeSaving * 100).toFixed(0)}%` +
      `${largeSaving > smallSaving ? '  (widens, as it should)' : '  ⚠️  does not widen — the cache is not absorbing the growth'}`,
  );

  const total = results.reduce((sum, result) => sum + result.warm, 0);
  console.log(`\nTotal time: ${total.toFixed(2)}ms`);
  console.log(`Average time per rebuild: ${(total / results.length).toFixed(2)}ms`);
  console.log(`Ops/sec: ${Math.round(1000 / (total / results.length))}`);
}

benchmark();
