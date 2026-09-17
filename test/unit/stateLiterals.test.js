/**
 * @file stateLiterals.test.js
 * @description `<state>` initialisers: every category found in the repository.
 *
 * A JavaScript object or array literal with unquoted keys --
 * `items="[{ id: 1, name: 'Alice' }]"` -- silently became a string, although
 * state-management.md describes values as "evaluated as JSON/JavaScript
 * expressions" and examples in virtuallist.md, components.md and errors.md use
 * such values as arrays and objects. Constant literals are now evaluated at
 * build time. Every other category keeps its behaviour, and plain text is
 * never diagnosed.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coerceValue, readStateValue, parseDeclarations } from '../../lib/compiler/parser/declarations.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { logger } from '../../lib/core/runtime/AvenxLogger.js';

try {
  console.log('🧪 State initialisers: unchanged categories');

  const unchanged = [
    ['0', 0],
    ['42', 42],
    ['true', true],
    ['false', false],
    ['null', null],
    ['[]', []],
    ['["work", "urgent"]', ['work', 'urgent']],
    ['{"name": "John", "role": "admin"}', { name: 'John', role: 'admin' }],
    ['Guest', 'Guest'],
    ['', ''],
    ["'My Counter App'", 'My Counter App'],
    ["''", ''],
    ["['apple']", ['apple']],
    ["[{'id':'a','label':'Alpha'}]", [{ id: 'a', label: 'Alpha' }]],
    ['[ ... 500 products ... ]', '[ ... 500 products ... ]'],
    ['{{ name }}', '{{ name }}'],
    ['a > b', 'a > b'],
    ['[beta] feature', '[beta] feature'],
    // The documented way to keep bracketed text as a string.
    ["'{ draft }'", '{ draft }'],
  ];
  for (const [raw, expected] of unchanged) {
    assert.deepStrictEqual(coerceValue(raw), expected, `coerceValue(${JSON.stringify(raw)})`);
    assert.strictEqual(readStateValue(raw).notLiteral, null, `${JSON.stringify(raw)} is not diagnosed`);
  }

  console.log('🧪 State initialisers: constant JavaScript literals are evaluated');

  const literals = [
    ["{name: 'John'}", { name: 'John' }],
    ["{ id: 1, name: 'Avenx Framework', category: 'Web' }", { id: 1, name: 'Avenx Framework', category: 'Web' }],
    ["[\n  { id: 1, name: 'Alice' },\n  { id: 2, name: 'Bob' },\n]", [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]],
    ['{ "quoted": true, bare: -1, nested: { list: [1, +2, `three`] } }', { quoted: true, bare: -1, nested: { list: [1, 2, 'three'] } }],
    ["['it\\'s', \"quoted\"]", ["it's", 'quoted']],
    ['{ 1: "numeric key" }', { 1: 'numeric key' }],
  ];
  for (const [raw, expected] of literals) {
    const read = readStateValue(raw);
    assert.deepStrictEqual(read.value, expected, `readStateValue(${JSON.stringify(raw)})`);
    assert.strictEqual(read.notLiteral, null);
  }

  console.log('🧪 State initialisers: non-constant initialisers stay strings and are diagnosed');

  const notConstant = [
    ['{ items: list }', /reference to "list"/],
    ['[Date.now()]', /function call/],
    ['{ list }', /reference to "list"/],
    ['{ ...defaults }', /spread/],
    ['[`${a}`]', /template literal with substitutions/],
    ['{ [key]: 1 }', /computed key/],
    ['{ __proto__: {} }', /"__proto__"/],
    ['[/x/]', /regular expression/],
  ];
  for (const [raw, reason] of notConstant) {
    const read = readStateValue(raw);
    assert.strictEqual(read.value, raw, `${JSON.stringify(raw)} keeps its current string value`);
    assert.match(read.notLiteral || '', reason, `${JSON.stringify(raw)} is diagnosed`);
  }

  console.log('🧪 State initialisers: declarations and warnings');

  const declarations = parseDeclarations('<state\n  tags="[{ id: 1 }]"\n  pending="{ items: list }"\n/>\n<div></div>');
  assert.deepStrictEqual(declarations.state.find((s) => s.name === 'tags').value, [{ id: 1 }]);
  const pending = declarations.state.find((s) => s.name === 'pending');
  assert.strictEqual(pending.value, '{ items: list }');
  assert.match(pending.notLiteral, /list/);
  assert.strictEqual(pending.line, 3);

  const warnings = [];
  const originalWarn = logger.warn;
  logger.warn = (message) => warnings.push(String(message));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-state-literals-'));
  try {
    const file = path.join(dir, 'probe.component.js');
    fs.writeFileSync(
      file,
      "<state products=\"[{ id: 1, name: 'Avenx' }]\" pending=\"{ items: list }\" title=\"Guest\" />\n<div>{{ products.length }} {{ title }} {{ pending }}</div>\n",
    );
    const generated = new ComponentParser(new StyleProcessor()).parse(file);
    assert.match(generated, /super\(\{"products":\[\{"id":1,"name":"Avenx"\}\],"pending":"\{ items: list \}","title":"Guest"\}/);
  } finally {
    logger.warn = originalWarn;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const stateWarnings = warnings.filter((message) => message.includes('AVX_W51'));
  assert.strictEqual(stateWarnings.length, 1, `exactly one AVX_W51, got:\n${warnings.join('\n')}`);
  assert.match(stateWarnings[0], /"pending"/);
  assert.match(stateWarnings[0], /reference to "list"/);

  console.log('  ✅ State literal tests passed!');
} catch (error) {
  console.error('❌ State literal tests failed:', error);
  process.exit(1);
}
