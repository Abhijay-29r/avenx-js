import assert from 'assert';

// Set env to test so config validation throws instead of process.exit.
process.env.NODE_ENV = 'test';

import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

/*
 * `state` is a scope root: ComponentScope layers `{ state: owner.state }`
 * beneath the bare state keys, so `state.count` resolves exactly like
 * `count`. The undeclared-reference check (AVX_W03) used to report it anyway,
 * which made every example in the two-way-binding documentation warn on
 * correct code -- and because `avenx check` exits 1 on a warning, fail CI.
 *
 * The existing two-way-binding tests all bind bare names (`data-ax-bind="x"`),
 * so none of them ever went down the documented `state.`-prefixed path.
 */

try {
  console.log('Testing `state` as a template scope root (AVX_W03)...');

  let warnings = [];
  const originalWarn = logger.warn;
  logger.warn = (...args) => warnings.push(args.join(' '));

  const styleProcessor = new StyleProcessor();

  /**
   * Validates a template and returns the identifiers AVX_W03 reported.
   * @param {string} template - The template source.
   * @param {object} [state] - Declared state keys.
   * @returns {string[]} The reported identifier names.
   */
  function undeclared(template, state = {}) {
    warnings = [];
    const parser = new ComponentParser(styleProcessor, [], { warnings: {} });
    // The compiler validates the template *after* translating data-ax-bind,
    // so the validator sees the expansion rather than the directive.
    const translated = parser.processBindDirectives(template);
    parser.validateTemplate(translated, state, {}, {}, {}, 'Demo.component.js', 'Demo');
    return warnings
      .filter((m) => m.includes('AVX_W03'))
      .map((m) => (m.match(/method "([^"]+)"/) || [])[1]);
  }

  try {
    const declared = { draft: '', agreed: false, fruits: [] };

    // 1. A plain read through the `state` root is not undeclared.
    assert.deepStrictEqual(
      undeclared('<p>{{ state.draft }}</p>', declared),
      [],
      '{{ state.draft }} is a valid read',
    );

    // 2. The documented text two-way binding. Its expansion mentions `state`
    //    in both the value binding and the generated @input handler.
    assert.deepStrictEqual(
      undeclared('<input type="text" data-ax-bind="state.draft" />', declared),
      [],
      'data-ax-bind="state.draft" does not warn',
    );

    // 3. The documented checkbox binding, whose expansion is considerably
    //    larger and repeats `state` several times.
    assert.deepStrictEqual(
      undeclared('<input type="checkbox" data-ax-bind="state.agreed" />', declared),
      [],
      'a boolean checkbox binding does not warn',
    );

    // 4. The documented checkbox-group binding.
    assert.deepStrictEqual(
      undeclared('<input type="checkbox" value="apple" data-ax-bind="state.fruits" />', declared),
      [],
      'a checkbox group binding does not warn',
    );

    // 5. A write through the root inside an inline handler.
    assert.deepStrictEqual(
      undeclared('<button @click="state.draft = \'x\'">go</button>', declared),
      [],
      'writing through the state root does not warn',
    );

    // 6. The bare form keeps working, as it always did.
    assert.deepStrictEqual(
      undeclared('<input data-ax-bind="draft" />', declared),
      [],
      'the bare binding form still does not warn',
    );

    // 7. The check is not weakened: a genuine typo is still reported, and a
    //    near-miss on the root name itself is not silently excused.
    assert.deepStrictEqual(
      undeclared('<p>{{ drafft }}</p>', declared),
      ['drafft'],
      'a misspelled state key is still reported',
    );
    assert.deepStrictEqual(
      undeclared('<p>{{ stateX.draft }}</p>', declared),
      ['stateX'],
      'a name merely starting with "state" is still reported',
    );
    assert.deepStrictEqual(
      undeclared('<input data-ax-bind="nope" />', declared).slice(0, 1),
      ['nope'],
      'binding an undeclared bare name is still reported',
    );
  } finally {
    logger.warn = originalWarn;
  }

  console.log('`state` scope root tests passed!');
} catch (error) {
  console.error('`state` scope root tests failed!');
  console.error(error);
  process.exit(1);
}
