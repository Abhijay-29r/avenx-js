import assert from 'assert';
import StyleProcessor, { encodeVLQ, encodeMapping } from '../../lib/compiler/StyleProcessor.js';

function testVlqEncoding() {
  console.log('  🧪 Testing Base64 VLQ encoder...');

  // Test value 0
  assert.strictEqual(encodeVLQ(0), 'A');

  // Test value 1
  assert.strictEqual(encodeVLQ(1), 'C');

  // Test value -1
  assert.strictEqual(encodeVLQ(-1), 'D');

  // Test value 2
  assert.strictEqual(encodeVLQ(2), 'E');

  // Test encoding mapping sequence
  const state = {
    prevGenCol: 0,
    prevSourceIdx: 0,
    prevSourceLine: 0,
    prevSourceCol: 0,
  };

  // Map to column 0, source 0, line 0, column 0 -> relative changes are all 0
  assert.strictEqual(encodeMapping(0, 0, 0, 0, state), 'AAAA');

  // Map to column 0, source 0, line 3, column 0 -> relative change in line is 3, others 0
  assert.strictEqual(encodeMapping(0, 0, 3, 0, state), 'AAGA');

  console.log('  ✅ Base64 VLQ encoder tests passed!');
}

function testSourceMapGeneration() {
  console.log('  🧪 Testing StyleProcessor source map generation...');

  const processor = new StyleProcessor();

  const componentCssPath = '/absolute/path/to/src/components/my-button.component.css';
  const componentCssContent = `<@global>
@def primary #ff0000;
.global-class {
  color: @primary;
}
</@global>

<@css>
button {
  background: @primary;
  border: none;
}
</@css>`;

  // 1. Register source file
  processor.registerSourceFile(componentCssPath, componentCssContent);

  // 2. Add global CSS from global section
  processor.addGlobalCSS('.global-class {\n  color: #ff0000;\n}', componentCssPath, 3);

  // 3. Extract scoped rules using string primitives and _sourceMapInfo metadata
  const desBlocks = {
    button: 'background: #ff0000;\nborder: none;',
  };
  Object.defineProperty(desBlocks, '_sourceMapInfo', {
    value: {
      button: {
        startLine: 10,
        sourceFile: componentCssPath,
      },
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  // Process a template that matches the block
  const html = '<button @css button>Click me</button>';
  const processedHtml = processor.process(html, desBlocks, 'MyButton');

  // Verify class injection
  assert.match(processedHtml, /class="[a-zA-Z0-9-_\s]+"/);

  const globalStyles = processor.getGlobalStyles();
  assert.ok(globalStyles.includes('.global-class'));
  assert.ok(globalStyles.includes('background: #ff0000;'));

  // 4. Generate source map
  const distDir = '/absolute/path/to/dist';
  const map = processor.getSourceMap(distDir, 'bundle.css');

  assert.strictEqual(map.version, 3);
  assert.strictEqual(map.file, 'bundle.css');
  assert.deepStrictEqual(map.sources, ['../src/components/my-button.component.css']);
  assert.deepStrictEqual(map.sourcesContent, [componentCssContent]);
  assert.ok(map.mappings.length > 0, 'Mappings string should not be empty');

  // Validate line mappings count
  const mappingLines = map.mappings.split(';');
  const totalGeneratedLines = globalStyles.split('\n').length;
  assert.strictEqual(
    mappingLines.length,
    totalGeneratedLines,
    'Mappings must have same number of line delimiters as generated CSS',
  );

  console.log('  ✅ StyleProcessor source map generation tests passed!');
}

function testInlineSourceMap() {
  console.log('  🧪 Testing Base64 Inline Source Map generation...');

  const processor = new StyleProcessor({ dev: true });
  const srcPath = '/path/to/component.css';
  const cssContent = `/* line 1 comment */\n.box {\n  color: blue;\n}`;

  processor.registerSourceFile(srcPath, cssContent);
  processor.addGlobalCSS('.box {\n  color: blue;\n}', srcPath, 2);

  const comment = processor.getInlineSourceMapComment('/path/to/dist', 'bundle.css');
  assert.ok(
    comment.startsWith('/*# sourceMappingURL=data:application/json;charset=utf-8;base64,'),
    'Should start with data URL',
  );
  assert.ok(comment.endsWith(' */'), 'Should end with comment closure');

  // Decode base64 and parse JSON map
  const base64Data = comment
    .replace('/*# sourceMappingURL=data:application/json;charset=utf-8;base64,', '')
    .replace(' */', '');
  const decodedJson = Buffer.from(base64Data, 'base64').toString('utf-8');
  const parsedMap = JSON.parse(decodedJson);

  assert.strictEqual(parsedMap.version, 3);
  assert.strictEqual(parsedMap.file, 'bundle.css');
  assert.ok(parsedMap.sources.length > 0);
  assert.strictEqual(parsedMap.sourcesContent[0], cssContent);

  // Test getGlobalStyles in dev mode
  const globalStylesDev = processor.getGlobalStyles({ dev: true, distDir: '/path/to/dist', cssFileName: 'bundle.css' });
  assert.ok(globalStylesDev.includes('/*# sourceMappingURL=data:application/json;charset=utf-8;base64,'));

  console.log('  ✅ Base64 Inline Source Map tests passed!');
}

function testCommentLinePreservation() {
  console.log('  🧪 Testing Comment multiline line preservation...');

  const processor = new StyleProcessor();
  const srcPath = '/path/to/component.css';
  const multilineCss = `/*
  line 2
  line 3
*/
.target {
  color: green;
}`;

  processor.registerSourceFile(srcPath, multilineCss);
  const hash = processor.getHash(multilineCss, 'Comp');
  processor.extractRules(multilineCss, hash, srcPath, 1);

  assert.strictEqual(processor.scopedRules.length, 1);
  // .target starts at line 5 (1-indexed: line 1 comment start, line 2, line 3, line 4 comment end, line 5 .target)
  assert.strictEqual(processor.scopedRules[0].sourceLine, 5, '.target should map to line 5');

  console.log('  ✅ Comment multiline line preservation tests passed!');
}

(async () => {
  try {
    console.log('🧪 Running CSS Source Maps tests...');
    testVlqEncoding();
    testSourceMapGeneration();
    testInlineSourceMap();
    testCommentLinePreservation();
    console.log('✅ All CSS Source Maps tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ CSS Source Maps tests failed!');
    console.error(error);
    process.exit(1);
  }
})();
