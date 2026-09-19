/**
 * @file checkJsonFileAttribution.test.js
 * @description Which file `avenx check --json` attributes a diagnostic to.
 *
 * Warnings reach the JSON reporter as formatted strings rather than as error
 * objects, so the file is recovered from the message text. The last pattern in
 * that recovery matched any dotted name ending in a known extension -- and the
 * standard footer on a silenceable warning is
 *
 *   Silence this class with "warnings": { "AVX_W52": "off" } in avenx.config.json.
 *
 * `config.js` sits inside `avenx.config.json`, so AVX_W51 and AVX_W52 were both
 * reported against a file called "config.js": a path that exists in no project.
 * A CI job annotating a pull request from this output pointed at a file that is
 * not there, which is worse than pointing nowhere.
 */

import assert from 'assert';
import { parseDiagnostic } from '../../bin/commands/build.js';

console.log('Testing check --json file attribution...');

/**
 * Parses a warning message the way the JSON reporter does.
 * @param {string} message - The formatted warning text.
 * @returns {object} The structured diagnostic.
 */
function parse(message) {
  return parseDiagnostic('warning', [message]);
}

const CONFIG_FOOTER = 'Silence this class with "warnings": { "AVX_W52": "off" } in avenx.config.json.';

// --- the configuration file is never mistaken for a source file ----------
{
  const diagnostic = parse(`[AVX_W52] <Probe> uses the inline event handler "onclick". ${CONFIG_FOOTER}`);
  assert.strictEqual(diagnostic.code, 'AVX_W52', 'the code is still recovered');
  assert.notStrictEqual(
    diagnostic.file,
    'config.js',
    'avenx.config.json must never be read as a source file called config.js',
  );
  assert.strictEqual(
    diagnostic.file,
    null,
    'with no location in the message, the honest answer is null rather than a guess',
  );
  console.log('  ✅ a config-file reference is not reported as the diagnostic\'s file');
}

// --- a real location in the message still wins ---------------------------
{
  const diagnostic = parse(
    `[AVX_W03] Undeclared variable or method "kount" referenced in template of probe.page.js. ${CONFIG_FOOTER}`,
  );
  assert.strictEqual(
    diagnostic.file,
    'probe.page.js',
    'a message that names its template must still be attributed to it, footer or not',
  );
  console.log('  ✅ a named template still wins over the footer');
}

// --- a path is still recovered from a bare mention -----------------------
{
  assert.strictEqual(
    parse('[AVX_W40] Probe.count is declared but read nowhere (src/pages/probe.page.js:1).').file,
    'src/pages/probe.page.js',
    'a bare path in a message is still recovered',
  );
  console.log('  ✅ a bare path is still recovered');
}

// --- a name inside a longer dotted name is not matched -------------------
{
  // The general form of the same mistake: `a.b.js.map` is not `a.b.js`.
  assert.notStrictEqual(
    parse('[AVX_W01] WARNING: bundle.js.map exceeds 600 KB').file,
    'bundle.js',
    'a name must not match inside a longer dotted one',
  );
  console.log('  ✅ a name inside a longer dotted name is not matched');
}

// --- AVX_W51 and AVX_W52 now name their own file --------------------------
{
  // Both used to be attributed to the phantom "config.js". Rather than settle
  // for null, each message now names its template the way AVX_W03 does, so the
  // developer reading the warning and the CI job reading the JSON get the same
  // answer.
  const w52 = parse(
    `[AVX_W52] <Probe> uses the inline event handler "onclick" (in template of probe.page.js). ${CONFIG_FOOTER}`,
  );
  assert.strictEqual(w52.file, 'probe.page.js', 'AVX_W52 names its template');

  const w51 = parse(
    '[AVX_W51] State "o" in <Probe> (in template of probe.page.js) looks like an object or ' +
      `array initialiser but contains a function call. ${CONFIG_FOOTER}`,
  );
  assert.strictEqual(w51.file, 'probe.page.js', 'AVX_W51 names its template');
  console.log('  ✅ AVX_W51 and AVX_W52 name their own template');
}

// --- the code and message survive ----------------------------------------
{
  const diagnostic = parse(`[AVX_W52] <Probe> uses the inline event handler "onclick". ${CONFIG_FOOTER}`);
  assert.ok(
    diagnostic.message.startsWith('<Probe> uses'),
    'the code prefix is still stripped from the message',
  );
  assert.ok(
    diagnostic.message.includes('avenx.config.json'),
    'and the footer is still shown to the developer -- only the file search ignores it',
  );
  assert.strictEqual(diagnostic.severity, 'warning');
  console.log('  ✅ the code, severity and message are unchanged');
}

console.log('✅ check --json file attribution tests passed!');
