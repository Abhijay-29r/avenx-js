import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { AvenxComponent, RESERVED_INSTANCE_KEYS } from '../../lib/core/runtime/AvenxComponent.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

function runTests() {
  console.log('🧪 Testing reserved method warning AVX_W26 (COMPONENT_METHOD_RESERVED_KEY_COLLISION)...');

  // 1. Verify RESERVED_INSTANCE_KEYS list contains all specified keys
  const expectedKeys = [
    'mount',
    'unmount',
    'update',
    'destroy',
    'scheduleUpdate',
    'onBeforeMount',
    'onMount',
    'onBeforeUpdate',
    'onUpdate',
    'onUnmount',
    'onActivate',
    'onDeactivate',
    'onErrorCaptured',
  ];

  for (const key of expectedKeys) {
    assert.ok(RESERVED_INSTANCE_KEYS.includes(key), `RESERVED_INSTANCE_KEYS should include "${key}"`);
  }

  // 2. Test Runtime Warning on AvenxComponent construction
  const warnings = [];
  const originalWarn = logger.warn;
  logger.warn = (msg) => {
    warnings.push(msg);
  };

  try {
    // Construct component with reserved method names
    new AvenxComponent({}, {}, {}, '<div></div>', {
      update: () => {},
      onMount: () => {},
      customAction: () => {},
    });

    assert.strictEqual(warnings.length, 2, 'Should log 2 warnings for reserved keys "update" and "onMount"');
    assert.ok(warnings[0].includes('[AVX_W26]'), 'First warning should contain [AVX_W26]');
    assert.ok(warnings[0].includes('"update"'), 'First warning should mention "update"');
    assert.ok(warnings[1].includes('[AVX_W26]'), 'Second warning should contain [AVX_W26]');
    assert.ok(warnings[1].includes('"onMount"'), 'Second warning should mention "onMount"');

    // Reset warnings
    warnings.length = 0;

    // Construct component with valid method names only
    new AvenxComponent({}, {}, {}, '<div></div>', {
      increment: () => {},
      resetCount: () => {},
    });

    assert.strictEqual(warnings.length, 0, 'Should log no warnings for non-reserved method names');
  } finally {
    logger.warn = originalWarn;
  }

  // 3. Test Compiler Warning during ComponentParser parsing
  const compilerWarnings = [];
  const styleProcessor = new StyleProcessor();
  const parser = new ComponentParser(styleProcessor);

  logger.warn = (msg) => {
    compilerWarnings.push(msg);
  };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-test-'));
  const testCompPath = path.join(tempDir, 'Colliding.component.js');

  try {
    const compContent = `
<state count="0" />

<action name="onMount">
  this.state.count++;
</action>

<action name="destroy">
  console.log("destroying");
</action>

<action name="customMethod">
  console.log("custom");
</action>

<template>
  <div>Count: {{ count }}</div>
</template>
`;
    fs.writeFileSync(testCompPath, compContent, 'utf-8');

    parser.parse(testCompPath);

    assert.strictEqual(compilerWarnings.length, 2, 'Compiler should emit 2 warnings for "onMount" and "destroy"');
    assert.ok(compilerWarnings[0].includes('[AVX_W26]'), 'Compiler warning should contain [AVX_W26]');
    assert.ok(compilerWarnings[0].includes('"onMount"'), 'Compiler warning should mention "onMount"');
    assert.ok(compilerWarnings[1].includes('[AVX_W26]'), 'Compiler warning should contain [AVX_W26]');
    assert.ok(compilerWarnings[1].includes('"destroy"'), 'Compiler warning should mention "destroy"');
  } finally {
    logger.warn = originalWarn;
    if (fs.existsSync(testCompPath)) fs.unlinkSync(testCompPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  }

  console.log('  ✅ Reserved method warning AVX_W26 unit tests passed successfully!');
}

try {
  runTests();
} catch (err) {
  console.error('❌ Reserved method warning AVX_W26 unit tests failed!');
  console.error(err);
  process.exit(1);
}
