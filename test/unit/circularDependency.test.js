import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AvenxCompiler from '../../lib/compiler.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';
import { AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Circular Dependency Detection in AvenxCompiler...');

const tempDir = path.join(__dirname, 'temp_circular_dep_test');

function cleanup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  cleanup();
  const compDir = path.join(tempDir, 'src', 'components');
  fs.mkdirSync(compDir, { recursive: true });

  // Test 1: Direct 2-component circular JS import loop (CompA <-> CompB)
  const compAPath = path.join(compDir, 'comp-a.component.js');
  const compBPath = path.join(compDir, 'comp-b.component.js');

  fs.writeFileSync(
    compAPath,
    `import CompB from './comp-b.component.js';
<div><CompB /></div>`,
  );

  fs.writeFileSync(
    compBPath,
    `import CompA from './comp-a.component.js';
<div><CompA /></div>`,
  );

  let warnings = [];
  const originalWarn = logger.warn;
  logger.warn = (msg) => {
    warnings.push(msg);
  };

  const compiler = new AvenxCompiler({ rootDir: tempDir, srcDir: 'src' });
  const resultJs = compiler.processComponents();

  logger.warn = originalWarn;

  assert.ok(resultJs.includes('class CompA'), 'CompA should be compiled');
  assert.ok(resultJs.includes('class CompB'), 'CompB should be compiled');
  assert.ok(
    warnings.some((w) => w.includes(AvenxErrorCodes.COMPILER_CIRCULAR_DEPENDENCY)),
    'Should log AVX_W29 warning for circular dependency',
  );
  assert.ok(
    warnings.some((w) => w.includes('CompA -> CompB -> CompA') || w.includes('CompB -> CompA -> CompB')),
    'Warning message should describe cycle path',
  );

  console.log('  ✅ 2-component circular dependency test passed!');

  // Test 2: 3-component circular loop (CompX -> CompY -> CompZ -> CompX)
  cleanup();
  fs.mkdirSync(compDir, { recursive: true });

  fs.writeFileSync(path.join(compDir, 'comp-x.component.js'), `import CompY from './comp-y.component.js';\n<div><CompY /></div>`);
  fs.writeFileSync(path.join(compDir, 'comp-y.component.js'), `import CompZ from './comp-z.component.js';\n<div><CompZ /></div>`);
  fs.writeFileSync(path.join(compDir, 'comp-z.component.js'), `import CompX from './comp-x.component.js';\n<div><CompX /></div>`);

  warnings = [];
  logger.warn = (msg) => {
    warnings.push(msg);
  };

  const compiler3 = new AvenxCompiler({ rootDir: tempDir, srcDir: 'src' });
  const resultJs3 = compiler3.processComponents();

  logger.warn = originalWarn;

  assert.ok(resultJs3.includes('class CompX'), 'CompX should be compiled');
  assert.ok(resultJs3.includes('class CompY'), 'CompY should be compiled');
  assert.ok(resultJs3.includes('class CompZ'), 'CompZ should be compiled');
  assert.ok(
    warnings.some((w) => w.includes(AvenxErrorCodes.COMPILER_CIRCULAR_DEPENDENCY)),
    'Should log AVX_W29 warning for 3-component cycle',
  );

  console.log('  ✅ 3-component circular dependency test passed!');

  // Test 3: Non-circular components compile without warnings
  cleanup();
  fs.mkdirSync(compDir, { recursive: true });

  fs.writeFileSync(path.join(compDir, 'parent.component.js'), `import Child from './child.component.js';\n<div><Child /></div>`);
  fs.writeFileSync(path.join(compDir, 'child.component.js'), `<div>Hello</div>`);

  warnings = [];
  logger.warn = (msg) => {
    warnings.push(msg);
  };

  const compilerClean = new AvenxCompiler({ rootDir: tempDir, srcDir: 'src' });
  const resultJsClean = compilerClean.processComponents();

  logger.warn = originalWarn;

  assert.strictEqual(warnings.length, 0, 'No warnings should be emitted for acyclic components');
  assert.ok(resultJsClean.includes('class Parent'), 'Parent should be compiled');
  assert.ok(resultJsClean.includes('class Child'), 'Child should be compiled');

  console.log('  ✅ Non-circular components test passed!');

  cleanup();
  console.log('🎉 All Circular Dependency tests passed successfully!');
} catch (err) {
  cleanup();
  console.error('❌ Test failed:', err);
  process.exit(1);
}
