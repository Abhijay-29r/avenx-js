import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import avenxPlugin from '../../vite-plugin-avenx/src/index.js';
import { createCompiler } from '../../vite-plugin-avenx/src/compiler.js';
import { isComponentFile, isPageFile } from '../../vite-plugin-avenx/src/utils.js';
import { generateTemplateSourceMap, encodeVLQ } from '../../vite-plugin-avenx/src/sourcemap.js';

console.log('🧪 Testing Source Map Generation in vite-plugin-avenx...');

// 1. Test VLQ Encoder
assert.equal(encodeVLQ(0), 'A');
assert.equal(encodeVLQ(1), 'C');
assert.equal(encodeVLQ(-1), 'D');
console.log('  ✅ VLQ Base64 encoding verified');

// 2. Test File Detection Helpers
assert.equal(isComponentFile('Counter.component.js'), true);
assert.equal(isComponentFile('Counter.component.html'), true);
assert.equal(isComponentFile('Counter.component.avx'), true);
assert.equal(isComponentFile('Counter.html'), true);
assert.equal(isComponentFile('Counter.avx'), true);
assert.equal(isComponentFile('index.html'), false);
assert.equal(isPageFile('About.page.js'), true);
assert.equal(isPageFile('About.page.html'), true);
assert.equal(isPageFile('About.page.avx'), true);
console.log('  ✅ File extension detection helpers verified');

// 3. Test Source Map generation logic with a temporary template file
const tempDir = path.join(process.cwd(), 'test', 'unit', 'temp_sourcemap_test');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const componentFilePath = path.join(tempDir, 'Counter.component.html');
const componentSource = `<state
    count="0"
    title="Counter App"
/>

<action name="reset">
    count = 0;
</action>

<action name="increment">
    count++;
</action>

<div>
    <h1>{{ title }}</h1>
    <p>Current count: {{ count }}</p>
    <button @click="increment()">Plus</button>
    <button @click="reset()">Reset</button>
</div>`;

fs.writeFileSync(componentFilePath, componentSource, 'utf-8');

try {
  const plugin = avenxPlugin();
  const transformResult = plugin.transform(componentSource, componentFilePath);

  assert.ok(transformResult, 'Plugin transform hook should return a result');
  assert.ok(transformResult.code, 'Result must contain code');
  assert.ok(transformResult.map, 'Result must contain source map object');

  const map = transformResult.map;
  assert.equal(map.version, 3, 'Source map version must be 3');
  assert.equal(map.file, 'Counter.component.html', 'Source map file name matches input basename');
  assert.deepEqual(map.sources, [componentFilePath], 'Source map sources array includes file path');
  assert.deepEqual(map.sourcesContent, [componentSource], 'Source map includes original source content');
  assert.ok(typeof map.mappings === 'string' && map.mappings.length > 0, 'Mappings string must be non-empty');

  // Verify compiled code contains wrapped class
  assert.ok(transformResult.code.includes('class Counter extends AvenxComponent'));
  assert.ok(transformResult.code.includes('export default Counter'));

  console.log('  ✅ Transform hook returns valid code and source map');

  // 4. Test page template source map generation
  const pageFilePath = path.join(tempDir, 'Home.page.avx');
  const pageSource = `<state name="Home" />

<action name="navigate">
    console.log("navigating...");
</action>

<main>
    <h1>Welcome Home</h1>
</main>`;

  fs.writeFileSync(pageFilePath, pageSource, 'utf-8');

  const pageResult = plugin.transform(pageSource, pageFilePath);
  assert.ok(pageResult, 'Page plugin transform hook should return a result');
  assert.ok(pageResult.map, 'Page result must contain source map object');
  assert.equal(pageResult.map.file, 'Home.page.avx');
  assert.ok(pageResult.code.includes('class Home extends AvenxPage'));

  console.log('  ✅ Page template source map generation verified');

} finally {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

console.log('✅ All Source Map Generation tests passed successfully!');
