import assert from 'assert';
import {
  bold,
  createSeverityFormatter,
  cyan,
  detectColorSupport,
  gray,
  green,
  isColorEnabled,
  red,
  setColorEnabled,
  yellow,
} from '../../bin/colors.js';

const ESC = '\u001b';

/**
 * Runs a callback with a temporary process environment and argv.
 * @param {object} options
 * @param {object} [options.env] - Environment overrides ('' removes the key).
 * @param {string[]} [options.argv] - Replacement argv array.
 * @param {function(): any} fn - The callback to execute.
 * @returns {any}
 */
function withProcess({ env = {}, argv = null }, fn) {
  const originalEnv = {};
  for (const key of Object.keys(env)) {
    originalEnv[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  const originalArgv = process.argv;
  if (argv) {
    process.argv = argv;
  }

  try {
    return fn();
  } finally {
    for (const key of Object.keys(originalEnv)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    process.argv = originalArgv;
  }
}

/**
 * Verifies the environment-based color detection rules.
 */
function testDetection() {
  console.log('  Testing color support detection...');

  assert.strictEqual(
    withProcess({ env: { NO_COLOR: '1', FORCE_COLOR: undefined } }, detectColorSupport),
    false,
    'NO_COLOR must disable colors',
  );

  assert.strictEqual(
    withProcess({ env: { NO_COLOR: '', FORCE_COLOR: '1' } }, detectColorSupport),
    true,
    'FORCE_COLOR should enable colors even without a TTY',
  );

  assert.strictEqual(
    withProcess({ env: { NO_COLOR: '', FORCE_COLOR: '0' } }, detectColorSupport),
    false,
    'FORCE_COLOR=0 must disable colors',
  );

  assert.strictEqual(
    withProcess({ env: { NO_COLOR: '', FORCE_COLOR: undefined, TERM: 'dumb' } }, detectColorSupport),
    false,
    'TERM=dumb must disable colors',
  );

  assert.strictEqual(
    withProcess(
      { env: { NO_COLOR: '', FORCE_COLOR: '1' }, argv: ['node', 'avenx', 'build', '--no-color'] },
      detectColorSupport,
    ),
    false,
    '--no-color must win over FORCE_COLOR',
  );

  const detected = withProcess({ env: { NO_COLOR: '', FORCE_COLOR: undefined } }, detectColorSupport);
  assert.strictEqual(typeof detected, 'boolean', 'Detection must always resolve to a boolean');
  if (!process.stdout.isTTY) {
    assert.strictEqual(detected, false, 'Piped or redirected stdout must disable colors');
  }
}

/**
 * Verifies that styling helpers are inert when colors are disabled.
 */
function testDisabledOutput() {
  console.log('  Testing plain output when colors are disabled...');
  setColorEnabled(false);

  assert.strictEqual(isColorEnabled(), false);
  for (const style of [bold, gray, green, yellow, red, cyan]) {
    assert.strictEqual(style('hello'), 'hello', 'Disabled styles must return the raw string');
  }
  assert.ok(!green('✅ done').includes(ESC), 'No escape codes should be emitted when disabled');
}

/**
 * Verifies emitted escape sequences and nesting behaviour.
 */
function testEnabledOutput() {
  console.log('  Testing ANSI output when colors are enabled...');
  setColorEnabled(true);

  assert.strictEqual(isColorEnabled(), true);
  assert.strictEqual(green('ok'), `${ESC}[32mok${ESC}[39m`);
  assert.strictEqual(yellow('warn'), `${ESC}[33mwarn${ESC}[39m`);
  assert.strictEqual(red('err'), `${ESC}[31merr${ESC}[39m`);
  assert.strictEqual(cyan('head'), `${ESC}[36mhead${ESC}[39m`);
  assert.strictEqual(gray('hint'), `${ESC}[90mhint${ESC}[39m`);
  assert.strictEqual(bold('title'), `${ESC}[1mtitle${ESC}[22m`);

  // Attribute-specific resets keep nested styles intact.
  assert.strictEqual(bold(cyan('Avenx')), `${ESC}[1m${ESC}[36mAvenx${ESC}[39m${ESC}[22m`);

  // Message text stays contiguous so output remains greppable.
  const line = green(`✅ Component 'my-button' generated at src/components/my-button/`);
  assert.ok(
    line.includes(`✅ Component 'my-button' generated at src/components/my-button/`),
    'Styling must wrap whole lines rather than splitting the message',
  );
}

/**
 * Verifies the compiler diagnostic formatter tints by severity.
 */
function testSeverityFormatter() {
  console.log('  Testing compiler severity formatter...');
  const format = createSeverityFormatter();

  setColorEnabled(true);
  assert.deepStrictEqual(
    format('warn', ['[AVX_W03] Undeclared variable "userName".']),
    [`${ESC}[33m[AVX_W03] Undeclared variable "userName".${ESC}[39m`],
    'Compiler warnings must be yellow',
  );
  assert.deepStrictEqual(
    format('error', ['❌ Build failed']),
    [`${ESC}[31m❌ Build failed${ESC}[39m`],
    'Compiler errors must be red',
  );
  assert.deepStrictEqual(
    format('fatal', ['boom']),
    [`${ESC}[31mboom${ESC}[39m`],
    'Fatal messages must be red',
  );
  assert.deepStrictEqual(
    format('info', ['bundle.js: 81.29 KB']),
    ['bundle.js: 81.29 KB'],
    'Informational build output must stay untouched',
  );

  const err = new Error('structured');
  assert.strictEqual(format('error', [err])[0], err, 'Non-string arguments must be passed through as-is');

  setColorEnabled(false);
  assert.deepStrictEqual(
    format('warn', ['plain warning']),
    ['plain warning'],
    'Formatter must stay inert when colors are disabled',
  );
}

try {
  console.log('🧪 Testing CLI color helpers...');
  const originalState = isColorEnabled();

  testDetection();
  testDisabledOutput();
  testEnabledOutput();
  testSeverityFormatter();

  setColorEnabled(originalState);
  console.log('✅ All CLI color helper tests passed!');
} catch (error) {
  setColorEnabled(false);
  console.error('❌ CLI color helper tests failed!');
  console.error(error);
  process.exit(1);
}
