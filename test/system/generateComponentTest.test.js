import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import AvenxCompiler from '../../lib/compiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const binPath = path.join(repoRoot, 'bin/avenx.js');
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-component-test-')));

function runAvenx(args) {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

try {
  console.log('🧪 Testing the generated component test...');

  assert.strictEqual(runAvenx(['init']).status, 0, 'init should succeed');
  assert.strictEqual(
    runAvenx(['generate', 'component', 'Widget', '--with-test']).status,
    0,
    'component generation should succeed',
  );

  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(repoRoot, path.join(root, 'node_modules', 'avenx-core'), 'junction');

  const generatedTest = path.join(root, 'src/components/widget/widget.component.test.js');
  const generatedComponent = path.join(root, 'src/components/widget/widget.component.js');
  const compiler = new AvenxCompiler({ rootDir: root });
  const compiled = compiler.compileComponent(generatedComponent);
  fs.writeFileSync(generatedComponent, compiler.wrapUnit(generatedComponent, compiled));
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(path.join(repoRoot, 'test/helpers/register-interpreter.js')).href,
      '--import',
      pathToFileURL(path.join(repoRoot, 'test/helpers/register-happy-dom.js')).href,
      '--test',
      generatedTest,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    },
  );

  assert.strictEqual(
    result.status,
    0,
    `the generated component test should pass:\n${result.stdout || ''}${result.stderr || ''}`,
  );
  console.log('✅ Generated component tests pass under the Node test runner');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}