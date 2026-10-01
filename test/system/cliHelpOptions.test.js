/**
 * @file cliHelpOptions.test.js
 * @description `avenx help` documents every flag `avenx serve` parses.
 *
 * The Options block listed only `--trace` under `serve`, while `bin/cli.js`
 * also reads `--port`/`-p`, `--host`/`-h`, `--open`/`-o` and
 * `--no-live-reload` (issue #1351). The README already documented them.
 */

import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_PATH = path.join(__dirname, '../../bin/avenx.js');

console.log('🧪 Testing that `avenx help` lists the serve flags...');

const res = spawnSync(process.execPath, [BIN_PATH, 'help'], {
  encoding: 'utf8',
  env: { ...process.env, NO_COLOR: '1' },
});
assert.strictEqual(res.status, 0, '`avenx help` should exit 0');

const options = (res.stdout || '').split('Options:')[1] || '';
assert.ok(options, 'help output should have an Options section');

for (const flag of ['--port, -p <port>', '--host, -h <host>', '--open, -o', '--no-live-reload', '--trace']) {
  assert.ok(options.includes(flag), `Options should list "${flag}". Got:\n${options}`);
}
console.log('  ✅ every serve flag parsed in bin/cli.js is listed');

assert.ok(/--json, -j.*explain/.test(options), 'the --json row should mention explain');
console.log('  ✅ the --json row mentions explain');

const trailing = (res.stdout || '').split('\n').filter((line) => /\S\s+$/.test(line));
assert.deepStrictEqual(trailing, [], 'no help line should end in trailing whitespace');
console.log('  ✅ no trailing whitespace after text');
