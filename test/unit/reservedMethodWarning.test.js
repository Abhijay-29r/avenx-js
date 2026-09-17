import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  AvenxComponent,
  RESERVED_INSTANCE_KEYS,
  RESERVED_INSTANCE_METHOD_KEYS,
  LIFECYCLE_HOOK_KEYS,
} from '../../lib/core/runtime/AvenxComponent.js';
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

  // The list splits into genuine instance-method collisions, which warn, and
  // documented lifecycle hooks, which are the supported way to define a hook
  // and must not warn (AVX_W26).
  for (const key of ['mount', 'unmount', 'update', 'destroy', 'scheduleUpdate']) {
    assert.ok(RESERVED_INSTANCE_METHOD_KEYS.includes(key), `RESERVED_INSTANCE_METHOD_KEYS should include "${key}"`);
    assert.ok(!LIFECYCLE_HOOK_KEYS.includes(key), `"${key}" is not a lifecycle hook`);
  }
  for (const key of ['onBeforeMount', 'onMount', 'onBeforeUpdate', 'onUpdate', 'onUnmount', 'onActivate', 'onDeactivate', 'onErrorCaptured']) {
    assert.ok(LIFECYCLE_HOOK_KEYS.includes(key), `LIFECYCLE_HOOK_KEYS should include "${key}"`);
    assert.ok(!RESERVED_INSTANCE_METHOD_KEYS.includes(key), `lifecycle hook "${key}" must not be a reserved instance method`);
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

    // "update" collides with a real instance method and warns; "onMount" is a
    // documented lifecycle hook and must not.
    assert.strictEqual(warnings.length, 1, 'Should log 1 warning, for the reserved method "update" only');
    assert.ok(warnings[0].includes('[AVX_W26]'), 'Warning should contain [AVX_W26]');
    assert.ok(warnings[0].includes('"update"'), 'Warning should mention "update"');
    assert.ok(!warnings.some((w) => w.includes('"onMount"')), 'No warning for the lifecycle hook "onMount"');

    // Reset warnings
    warnings.length = 0;

    // Construct component with valid method names only
    new AvenxComponent({}, {}, {}, '<div></div>', {
      increment: () => {},
      resetCount: () => {},
    });

    assert.strictEqual(warnings.length, 0, 'Should log no warnings for non-reserved method names');

    // A component defining every documented lifecycle hook as an action warns
    // for none of them.
    warnings.length = 0;
    new AvenxComponent({}, {}, {}, '<div></div>', {
      onBeforeMount: () => {},
      onMount: () => {},
      onBeforeUpdate: () => {},
      onUpdate: () => {},
      onUnmount: () => {},
      onActivate: () => {},
      onDeactivate: () => {},
      onErrorCaptured: () => {},
    });
    assert.strictEqual(warnings.length, 0, 'Lifecycle hooks defined as actions must not warn');
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

    // onMount is a documented lifecycle hook (no warning); destroy collides
    // with a reserved instance method (warns).
    const w26 = compilerWarnings.filter((m) => m.includes('[AVX_W26]'));
    assert.strictEqual(w26.length, 1, `Compiler should emit 1 AVX_W26, for "destroy" only:\n${compilerWarnings.join('\n')}`);
    assert.ok(w26[0].includes('"destroy"'), 'Compiler warning should mention "destroy"');
    assert.ok(!w26.some((m) => m.includes('"onMount"')), 'No compiler warning for the lifecycle hook "onMount"');
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
